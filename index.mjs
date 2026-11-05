const SITES = {
  global: { id: "agnes-ai", name: "Agnes AI · 国际版 API", baseURL: "https://apihub.agnes-ai.com/v1" },
  cn: { id: "agens-cn", name: "Agnes AI · 国内版 API", baseURL: "https://api.agnes-ai.cn/v1" },
}

// Only documented Agnes text models get inferred capabilities and limits.
const TEXT_MODELS = {
  "agnes-3.0-flash": { context: 524288, output: 65536 },
  "agnes-2.5-flash": { context: 524288, output: 65536 },
  "agnes-2.5-pro": { context: 1048576, output: 65536 },
  "agnes-2.5-pro-beta": { context: 1048576, output: 65536 },
}

function isChatModel(model) {
  if (/^agnes-(?:image|video)(?:-|$)/i.test(model.id)) return false
  const outputs = model.modalities?.output ?? model.output_modalities
  if (outputs !== undefined) {
    return Array.isArray(outputs) && outputs.length > 0 && outputs.every((kind) => kind === "text")
  }
  // Unknown IDs without modality metadata stay hidden rather than leak generators into chat.
  return Object.hasOwn(TEXT_MODELS, model.id)
}

function modelRow(model, site) {
  const known = TEXT_MODELS[model.id]
  const seesImages = !!known
  return {
    id: model.id,
    providerID: site.id,
    name: typeof model.name === "string" && model.name ? model.name : model.id,
    api: { id: model.id, url: site.baseURL, npm: "@ai-sdk/openai-compatible" },
    status: "active",
    limit: { context: known?.context ?? 0, output: known?.output ?? 0 },
    modalities: { input: seesImages ? ["text", "image"] : ["text"], output: ["text"] },
    capabilities: {
      temperature: true,
      reasoning: !!known,
      attachment: seesImages,
      toolcall: !!known,
      input: { text: true, image: seesImages, audio: false, video: false, pdf: false },
      output: { text: true, image: false, audio: false, video: false, pdf: false },
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
        npm: "@ai-sdk/openai-compatible",
        api: site.baseURL,
        models: {},
      }
    },
    auth: {
      provider: site.id,
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
export const _internal = { SITES, createPlugin, isChatModel }
