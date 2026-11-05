const LOGO = "https://www.agnes-ai.com/images/biglogo.png"

const SITES = {
  global: { id: "agnes-ai", name: "Agnes AI · 国际版 API", baseURL: "https://apihub.agnes-ai.com/v1" },
  cn: { id: "agnes-cn", name: "Agnes AI · 国内版 API", baseURL: "https://api.agnes-ai.cn/v1" },
}

// Documented Agnes text models and their capabilities.
// Flash models are free in the current trial tier.
const TEXT_MODELS = {
  "agnes-3.0-flash": { name: "Agnes 3.0 Flash", context: 524288, output: 65536, free: true },
  "agnes-2.5-flash": { name: "Agnes 2.5 Flash", context: 524288, output: 65536, free: true },
  "agnes-2.5-pro": { name: "Agnes 2.5 Pro", context: 1048576, output: 65536, free: false },
  "agnes-2.5-pro-beta": { name: "Agnes 2.5 Pro Beta", context: 1048576, output: 65536, free: false },
}

function isChatModel(model) {
  const id = String(model?.id ?? "").trim()
  const outputs = model.modalities?.output ?? model.output_modalities

  // 1. Any video models or image generation models are strictly filtered out from chat
  if (
    /^agnes-(?:video|image)(?:-|$)/i.test(id) ||
    /(video|image|flux|cogview|seedream|dall-e)/i.test(id) ||
    outputs?.includes?.("video") ||
    outputs?.includes?.("image")
  ) {
    return false
  }

  // 2. Pure text models:
  // - Either explicit output modalities say text
  // - Or is known text model in TEXT_MODELS
  // - Or follows the standard Agnes model naming pattern: agnes-<version>-<tier>
  if (Array.isArray(outputs) && outputs.length > 0 && outputs.every((k) => k === "text")) {
    return true
  }
  if (Object.hasOwn(TEXT_MODELS, id) || /^agnes-(?:[0-9]|v[0-9])/i.test(id)) {
    return true
  }

  return false
}

function modelRow(model, site) {
  const knownText = TEXT_MODELS[model.id]
  const displayName = knownText?.name ?? model.name ?? model.id

  const isFlash = /flash/i.test(model.id)
  const isFree = knownText?.free ?? isFlash
  const seesImages = !!knownText || /^agnes-/i.test(model.id)

  const defaultContext = /pro/i.test(model.id) ? 1048576 : 524288
  const context = knownText?.context ?? (model.context_window || model.context_length || defaultContext)
  const output = knownText?.output ?? (model.max_tokens || 65536)

  return {
    id: model.id,
    providerID: site.id,
    name: displayName,
    api: { id: model.id, url: site.baseURL, npm: "@ai-sdk/openai-compatible" },
    status: "active",
    limit: {
      context,
      input: context,
      output,
    },
    modalities: {
      input: seesImages ? ["text", "image"] : ["text"],
      output: ["text"],
    },
    free: isFree,
    capabilities: {
      temperature: true,
      reasoning: true,
      attachment: seesImages,
      toolcall: true,
      input: { text: true, image: seesImages, audio: false, video: false, pdf: false },
      output: { text: true, image: false, audio: false, video: false, pdf: false },
      interleaved: false,
    },
    headers: {},
    options: {},
    variants: {
      none: {},
      high: {},
    },
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
          fetch(input, init) {
            const url = new URL(input instanceof Request ? input.url : input)
            if (url.origin + url.pathname !== `${site.baseURL}/chat/completions`) {
              throw new Error("Agnes 插件仅允许本站 Chat Completions 请求")
            }
            return fetchImpl(input, { ...init, redirect: "error" })
          },
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
          .filter(isChatModel)
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
  isChatModel,
  modelRow,
  TEXT_MODELS,
}
