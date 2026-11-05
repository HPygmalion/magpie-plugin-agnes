import { agnesFetch, imageModelID, upstreamModelID } from "./images.mjs"

const LOGO = "https://www.agnes-ai.com/images/biglogo.png"

const SITES = {
  global: { id: "agnes-ai", name: "Agnes AI · 国际版 API", baseURL: "https://apihub.agnes-ai.com/v1" },
  cn: { id: "agnes-cn", name: "Agnes AI · 国内版 API", baseURL: "https://api.agnes-ai.cn/v1" },
}

// Documented Agnes text models and their capabilities.
// Trial free pricing applies only to eligible default accounts per Agnes pricing documentation.
const TEXT_MODELS = {
  "agnes-3.0-flash": { name: "Agnes 3.0 Flash", context: 524288, output: 65536, free: true },
  "agnes-2.5-flash": { name: "Agnes 2.5 Flash", context: 524288, output: 65536, free: true },
  "agnes-2.5-pro": { name: "Agnes 2.5 Pro", context: 1048576, output: 65536, free: false },
  "agnes-2.5-pro-beta": { name: "Agnes 2.5 Pro Beta", context: 1048576, output: 65536, free: false },
}

// Documented Agnes image generation models.
const IMAGE_MODELS = {
  "agnes-image-2.5-flash": { name: "Agnes Image 2.5 Flash" },
  "agnes-image-2.1-flash": { name: "Agnes Image 2.1 Flash" },
}

function modelKind(model) {
  const id = String(model?.id ?? "").trim()
  const outputs = model.modalities?.output ?? model.output_modalities

  // 1. Video models are strictly excluded
  if (/^agnes-video(?:-|$)/i.test(id) || /video/i.test(id) || outputs?.includes?.("video")) {
    return "video"
  }

  // 2. Explicit output modalities take precedence over name heuristics
  if (Array.isArray(outputs) && outputs.length > 0) {
    if (outputs.includes("image") && !outputs.includes("text")) return "image"
    if (outputs.every((k) => k === "text")) return "text"
    if (!outputs.includes("text") && !outputs.includes("image")) return "unsupported"
  }

  // 3. Image models identified by prefix or explicit output
  if (
    /^agnes-image(?:-|$)/i.test(id) ||
    outputs?.includes?.("image")
  ) {
    return "image"
  }

  // 4. Text chat models:
  // - Known verified text model in TEXT_MODELS
  // - Or standard Agnes text model naming pattern: agnes-<version>-<tier>
  if (Object.hasOwn(TEXT_MODELS, id) || /^agnes-(?:[0-9]|v[0-9])/i.test(id)) {
    return "text"
  }

  return "unsupported"
}

function modelRow(model, site) {
  const kind = modelKind(model)
  const isImage = kind === "image"
  const knownText = TEXT_MODELS[model.id]
  const knownImage = IMAGE_MODELS[model.id]

  const id = isImage ? imageModelID(model.id) : model.id
  const displayName = isImage
    ? (knownImage?.name ?? model.name ?? model.id)
    : (knownText?.name ?? model.name ?? model.id)

  // Do NOT guess free status from model name; only use explicit documented verification
  // or explicit upstream metadata. Image models are false to prevent chat auto-selection.
  const isFree = isImage ? false : (knownText?.free ?? (model.free === true))
  const seesImages = isImage || !!knownText || /^agnes-/i.test(model.id)

  // Validate limits as positive integers; do not fabricate numbers for unknown models
  const context = knownText?.context ?? (
    Number.isInteger(model.context_window) && model.context_window > 0 ? model.context_window :
    Number.isInteger(model.context_length) && model.context_length > 0 ? model.context_length :
    Number.isInteger(model.limit?.context) && model.limit.context > 0 ? model.limit.context : 0
  )
  const output = knownText?.output ?? (
    Number.isInteger(model.max_tokens) && model.max_tokens > 0 ? model.max_tokens :
    Number.isInteger(model.limit?.output) && model.limit.output > 0 ? model.limit.output : 0
  )

  const hasReasoning = !isImage && (!!knownText || model.capabilities?.reasoning === true)
  const hasToolCall = !isImage && (!!knownText || model.capabilities?.toolcall === true)

  return {
    id,
    providerID: site.id,
    name: displayName,
    api: { id: model.id, url: site.baseURL, npm: "@ai-sdk/openai-compatible" },
    status: "active",
    limit: {
      context: isImage ? 0 : context,
      input: isImage ? 0 : context,
      output: isImage ? 0 : output,
    },
    modalities: {
      input: seesImages ? ["text", "image"] : ["text"],
      output: isImage ? ["image"] : ["text"],
    },
    free: isFree,
    capabilities: {
      temperature: !isImage,
      reasoning: hasReasoning,
      attachment: seesImages,
      toolcall: hasToolCall,
      input: { text: true, image: seesImages, audio: false, video: false, pdf: false },
      output: { text: !isImage, image: isImage, audio: false, video: false, pdf: false },
      interleaved: false,
    },
    headers: {},
    options: {},
    variants: hasReasoning
      ? {
          none: {},
          high: {},
        }
      : {},
  }
}

function apiKeyOf(auth) {
  return auth?.type === "api" && typeof auth.key === "string" ? auth.key.trim() : ""
}

function createPlugin(site, fetchImpl = globalThis.fetch) {
  return {
    async config(cfg) {
      cfg.provider ??= {}
      cfg.provider[site.id] = {
        ...cfg.provider[site.id],
        name: site.name,
        icon: LOGO,
        npm: "@ai-sdk/openai-compatible",
        api: site.baseURL,
        models: {
          ...Object.fromEntries(
            Object.keys(TEXT_MODELS).map((id) => [id, modelRow({ id }, site)])
          ),
          ...Object.fromEntries(
            Object.keys(IMAGE_MODELS).map((id) => [imageModelID(id), modelRow({ id }, site)])
          ),
          ...(cfg.provider[site.id]?.models ?? {}),
        },
      }
    },
    auth: {
      provider: site.id,
      icon: LOGO,
      methods: [{ type: "api", label: site.name + " · API Key" }],
      async loader(getAuth) {
        const key = apiKeyOf(await getAuth())
        if (!key) return {}
        return {
          baseURL: site.baseURL,
          apiKey: key,
          fetch: agnesFetch(site.baseURL, fetchImpl),
        }
      },
    },
    provider: {
      id: site.id,
      async models(_provider, { auth } = {}) {
        const key = apiKeyOf(auth)
        if (!key) return {}
        const res = await fetchImpl(`${site.baseURL}/models`, {
          headers: { authorization: `Bearer ${key}`, accept: "application/json" },
          signal: AbortSignal.timeout(15000),
          redirect: "error",
        })
        if (!res.ok) {
          const error = new Error(`${site.name}: 获取模型失败 (HTTP ${res.status})`)
          if (res.status === 401 || res.status === 403) error.signIn = "expired"
          throw error
        }
        const body = await res.json()
        if (!Array.isArray(body?.data) || body.data.some((m) => typeof m?.id !== "string" || !m.id.trim())) {
          throw new Error(`${site.name}: 模型列表格式错误`)
        }
        const rows = body.data
          .map((m) => ({ ...m, id: m.id.trim() }))
          .filter((m) => ["text", "image"].includes(modelKind(m)))
          .map((m) => modelRow(m, site))
        return Object.fromEntries(rows.map((row) => [row.id, row]))
      },
    },
  }
}

export const AgnesAIPlugin = async () => createPlugin(SITES.global)
export const AgnesCNPlugin = async () => createPlugin(SITES.cn)
export const _internal = {
  SITES,
  LOGO,
  createPlugin,
  modelKind,
  modelRow,
  TEXT_MODELS,
  IMAGE_MODELS,
  imageModelID,
  upstreamModelID,
}
