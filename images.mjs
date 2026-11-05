// Magpie requires an ImagesAPI-recognized ID keyword (such as 'imagen') in addition to output.image
// to automatically classify and surface the model into the dedicated '图像模型' drawer.
// api.id and upstreamModelID ensure the real upstream model ID is used on the wire.
export const imageModelID = (id) => `${id}-imagen`
export const upstreamModelID = (id) => (typeof id === "string" ? id.replace(/-imagen$/, "") : id)

async function referenceImage(value) {
  if (typeof value === "string") {
    const s = value.trim()
    if (/^https:\/\/[^\s/$.?#].[^\s]*$/i.test(s)) return s
    if (/^data:image\/[a-z0-9.+_-]+;base64,[A-Za-z0-9+/=]+$/i.test(s)) return s
  }
  if (value instanceof Blob && typeof value.type === "string" && /^image\//.test(value.type)) {
    return `data:${value.type};base64,${Buffer.from(await value.arrayBuffer()).toString("base64")}`
  }
  throw new Error("Agnes 参考图必须是有效 HTTPS URL、图像 Data URI 或图像文件")
}

export function agnesFetch(baseURL, fetchImpl = globalThis.fetch) {
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input)
    const base = new URL(baseURL + "/")
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) {
      throw new Error("Agnes 插件拒绝向其他站点发送凭据")
    }

    // Pass through chat completions directly
    if (url.pathname === base.pathname + "chat/completions") {
      return fetchImpl(input, { ...init, redirect: "error" })
    }

    // Handle image generation and editing requests
    if (![base.pathname + "images/generations", base.pathname + "images/edits"].includes(url.pathname)) {
      throw new Error(`Agnes 插件仅支持 chat/completions 与 images/generations 接口，收到: ${url.pathname}`)
    }

    const request = new Request(input, init)
    if (request.method !== "POST") throw new Error("Agnes 图像接口仅支持 POST")

    const multipart = request.headers.get("content-type")?.startsWith("multipart/form-data")
    let body = {}
    let images = []

    if (multipart) {
      const form = await request.formData()
      if (form.has("mask")) {
        throw new Error("Agnes 未支持 mask 局部重绘；请改用参考图和提示词")
      }
      for (const [key, val] of form.entries()) {
        if (key === "image" || key === "image[]") {
          images.push(val)
        } else {
          body[key] = val
        }
      }
    } else {
      const parsed = await request.json()
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Agnes 图像请求必须是 JSON 对象")
      }
      body = parsed
      const value = body.image ?? body.images ?? body.extra_body?.image
      images = value == null ? [] : Array.isArray(value) ? value : [value]
    }

    // Reject mask in both top-level and extra_body
    if (body.mask != null || body.extra_body?.mask != null) {
      throw new Error("Agnes 未支持 mask 局部重绘；请改用参考图和提示词")
    }

    if (body.n != null && Number(body.n) !== 1) {
      throw new Error("Agnes 当前仅支持单张生成 (n=1)")
    }
    if (typeof body.model !== "string" || !body.model.trim() || typeof body.prompt !== "string" || !body.prompt.trim()) {
      throw new Error("Agnes 图像请求缺少必填的 model 或 prompt")
    }
    if (body.extra_body != null && (typeof body.extra_body !== "object" || Array.isArray(body.extra_body))) {
      throw new Error("Agnes extra_body 必须是对象")
    }

    // Sanitize extra_body so existing unvalidated extra_body.image cannot bypass validation
    const extra = { ...body.extra_body }
    delete extra.image
    delete extra.mask

    const format = body.response_format ?? extra.response_format ?? "url"
    if (format !== "url" && format !== "b64_json" && format !== "b64" + "_json") {
      throw new Error(`Agnes response_format 仅支持 url 或 b64_json，收到: ${format}`)
    }
    const normalizedFormat = format === "b64_json" || format === "b64" + "_json" ? "b64_json" : "url"
    extra.response_format = normalizedFormat

    if (images.length) {
      extra.image = await Promise.all(
        images.map((value) => referenceImage(value?.image_url?.url ?? value?.image_url ?? value?.url ?? value))
      )
    }

    if (url.pathname.endsWith("/edits") && !images.length) {
      throw new Error("Agnes 图像编辑缺少参考图")
    }

    const returnBase64 = body.return_base64 === true || body.return_base64 === "true" || body.return_base64 === "1"

    const payload = {
      model: upstreamModelID(body.model),
      prompt: body.prompt,
      size: body.size && body.size !== "auto" ? body.size : "1024x1024",
      ...(body.ratio ? { ratio: body.ratio } : {}),
      ...(returnBase64 ? { return_base64: true } : {}),
      extra_body: extra,
    }

    const headers = new Headers(request.headers)
    headers.set("content-type", "application/json")
    headers.delete("content-length")

    url.pathname = base.pathname + "images/generations"
    return fetchImpl(url.href, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: request.signal,
      redirect: "error",
    })
  }
}
