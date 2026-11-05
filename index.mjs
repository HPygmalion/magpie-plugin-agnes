import { agnesFetch, imageModelID, upstreamModelID } from "./images.mjs"

const LOGO = "https://www.agnes-ai.com/images/biglogo.png"

const SITES = {
  global: { id: "agnes-ai", name: "Agnes AI · 国际版 API", baseURL: "https://apihub.agnes-ai.com/v1" },
  cn: { id: "agens-cn", name: "Agnes AI · 国内版 API", baseURL: "https://api.agnes-ai.cn/v1" },
}

// Documented Agnes text models and their capabilities.
// Flash models are free in the current trial tier.
const TEXT_MODELS = {
  "agnes-3.0-flash": { name: "Agnes 3.0 Flash", context: 524288, output: 65536, free: true },
  "agnes-2.5-flash": { name: "Agnes 2.5 Flash", context: 524288, output: 65536, free: true },
  "agnes-2.5-pro": { name: "Agnes 2.5 Pro", context: 1048576, output: 65536, free: false },
  "agnes-2.5-pro-beta": { name: "Agnes 2.5 Pro Beta", context: 1048576, output: 65536, free: false },
}

// Documented Agnes image generation models.
// Image models in trial tier are free.
const IMAGE_MODELS = {
  "agnes-image-2.5-flash": { name: "Agnes Image 2.5 Flash", free: true },
  "agnes-image-2.1-flash": { name: "Agnes Image 2.1 Flash", free: true },
}

function modelKind(model) {
  const outputs = model.modalities?.output ?? model.output_modalities
  if (/^agnes-video(?:-|$)/i.test(model.id) || outputs?.includes?.("video")) return "video"
  if (/^agnes-image(?:-|$)/i.test(model.id) || outputs?.includes?.("image")) return "image"
  if (Array.isArray(outputs) && outputs.length > 0 && outputs.every((k) => k === "text")) return "text"
  if (Object.hasOwn(TEXT_MODELS, model.id)) return "text"
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

  const isFree = isImage ? true : (knownText?.free === true)
  const seesImages = isImage || !!knownText

  return {
    id,
    providerID: site.id,
    name: displayName,
    api: { id: model.id, url: site.baseURL, npm: "@ai-sdk/openai-compatible" },
    status: "active",
    limit: {
      context: knownText?.context ?? 0,
      input: knownText?.context ?? 0,
      output: knownText?.output ?? 0,
    },
    modalities: {
      input: seesImages ? ["text", "image"] : ["text"],
      output: isImage ? ["image"] : ["text"],
    },
    free: isFree,
    capabilities: {
      temperature: !isImage,
      reasoning: !isImage && !!knownText,
      attachment: seesImages,
      toolcall: !isImage && !!knownText,
      input: { text: true, image: seesImages, audio: false, video: false, pdf: false },
      output: { text: !isImage, image: isImage, audio: false, video: false, pdf: false },
      interleaved: false,
    },
    headers: {},
    options: {},
    variants: {},
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
