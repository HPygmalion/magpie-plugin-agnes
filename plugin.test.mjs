import assert from "node:assert/strict"
import { test } from "node:test"
import { _internal } from "./index.mjs"
import { agnesFetch, imageModelID, upstreamModelID } from "./images.mjs"
import * as entry from "./opencode.mjs"

const { SITES, LOGO, createPlugin, TEXT_MODELS, IMAGE_MODELS } = _internal
const auth = { type: "api", key: " test-key " }
const base = SITES.cn.baseURL

function recorder(body = { data: [{ url: "https://example.com/result.png" }] }) {
  const calls = []
  const fetch = async (url, options) => {
    calls.push({ url: String(url), options })
    return Response.json(body)
  }
  return { calls, fetch }
}

for (const site of Object.values(SITES)) {
  test(`${site.id}: logo, bootstrap models, free badges, context/output limits, and image model drawer tags`, async () => {
    const recorded = recorder({ data: [
      { id: "agnes-3.0-flash" },
      { id: " agnes-2.5-pro " },
      { id: "agnes-image-2.5-flash" },
      { id: "agnes-video-2.5" },
      { id: "future-film", modalities: { output: ["video"] } },
      { id: "future-image", output_modalities: ["image"] },
      { id: "unknown-without-metadata" },
    ] })

    const plugin = createPlugin(site, recorded.fetch)
    const cfg = {}
    await plugin.config(cfg)

    assert.equal(cfg.provider[site.id].api, site.baseURL)
    assert.equal(cfg.provider[site.id].icon, LOGO)

    // Verify initial bootstrap contains both text models and image drawer models
    const bootstrapKeys = Object.keys(cfg.provider[site.id].models)
    assert.ok(bootstrapKeys.includes("agnes-3.0-flash"))
    assert.ok(bootstrapKeys.includes(imageModelID("agnes-image-2.5-flash")))

    assert.equal(plugin.auth.provider, site.id)
    assert.equal(plugin.auth.icon, LOGO)
    assert.deepEqual(plugin.auth.methods.map((m) => m.type), ["api"])

    const loaded = await plugin.auth.loader(async () => auth)
    assert.equal(loaded.apiKey, "test-key")
    assert.equal(loaded.baseURL, site.baseURL)

    const models = await plugin.provider.models({}, { auth })

    // Expected models: text models and image models, video models excluded!
    assert.deepEqual(
      Object.keys(models).sort(),
      ["agnes-2.5-pro", "agnes-3.0-flash", imageModelID("agnes-image-2.5-flash"), imageModelID("future-image")].sort()
    )

    // Text model checks
    const flash = models["agnes-3.0-flash"]
    assert.equal(flash.free, true)
    assert.equal(flash.limit.context, 524288)
    assert.equal(flash.limit.output, 65536)
    assert.deepEqual(flash.modalities.output, ["text"])
    assert.equal(flash.capabilities.output.text, true)
    assert.equal(flash.capabilities.output.image, false)

    const pro = models["agnes-2.5-pro"]
    assert.equal(pro.free, false)
    assert.equal(pro.limit.context, 1048576)
    assert.equal(pro.limit.output, 65536)

    // Image model drawer checks
    const imgKey = imageModelID("agnes-image-2.5-flash")
    const img = models[imgKey]
    assert.equal(img.api.id, "agnes-image-2.5-flash")
    assert.equal(img.api.url, site.baseURL)
    assert.equal(img.api.npm, "@ai-sdk/openai-compatible")
    assert.deepEqual(img.modalities.output, ["image"])
    assert.equal(img.capabilities.output.text, false)
    assert.equal(img.capabilities.output.image, true)
    assert.equal(img.capabilities.input.image, true)
    assert.equal(img.free, true)
  })
}

test("entry exports only the two plugins; missing auth causes no network request", async () => {
  assert.deepEqual(Object.keys(entry).sort(), ["AgnesAIPlugin", "AgnesCNPlugin"])
  const plugin = createPlugin(SITES.cn, () => { throw new Error("must not fetch") })
  assert.deepEqual(await plugin.provider.models({}), {})
  assert.deepEqual(await plugin.auth.loader(async () => null), {})
})

test("model list errors are visible, with no key in error messages", async () => {
  for (const status of [401, 403, 429, 500]) {
    const plugin = createPlugin(SITES.cn, async () => new Response("upstream", { status }))
    await assert.rejects(plugin.provider.models({}, { auth }), (error) => {
      assert.match(error.message, new RegExp(`HTTP ${status}`))
      assert.equal(error.signIn, [401, 403].includes(status) ? "expired" : undefined)
      assert.ok(!error.message.includes("test-key"))
      return true
    })
  }
  for (const data of [null, {}, { data: [null] }, { data: [{ id: " " }] }]) {
    const plugin = createPlugin(SITES.cn, async () => Response.json(data))
    await assert.rejects(plugin.provider.models({}, { auth }), /模型列表格式错误/)
  }
})

test("generation moves format into extra_body, supplies size, restores upstream ID", async () => {
  const recorded = recorder()
  const adapter = agnesFetch(base, recorded.fetch)
  const response = await adapter(base + "/images/generations", {
    method: "POST",
    headers: { authorization: "Bearer test-key", "content-type": "application/json" },
    body: JSON.stringify({
      model: imageModelID("agnes-image-2.5-flash"),
      prompt: "a majestic flying bird",
      response_format: "url",
      n: 1,
    }),
  })
  const { url, options } = recorded.calls[0]
  assert.equal(url, base + "/images/generations")
  assert.equal(options.headers.get("authorization"), "Bearer test-key")
  assert.deepEqual(JSON.parse(options.body), {
    model: "agnes-image-2.5-flash",
    prompt: "a majestic flying bird",
    size: "1024x1024",
    extra_body: { response_format: "url" },
  })
  assert.deepEqual(await response.json(), { data: [{ url: "https://example.com/result.png" }] })
})

test("JSON references and native size/ratio survive the edit adapter", async () => {
  const recorded = recorder()
  await agnesFetch(base, recorded.fetch)(new Request(base + "/images/edits", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: "agnes-image-2.1-flash",
      prompt: "repaint in watercolor",
      size: "2K",
      ratio: "16:9",
      images: [{ image_url: { url: "https://example.com/ref.png" } }],
    }),
  }))
  assert.equal(recorded.calls[0].url, base + "/images/generations")
  assert.deepEqual(JSON.parse(recorded.calls[0].options.body), {
    model: "agnes-image-2.1-flash",
    prompt: "repaint in watercolor",
    size: "2K",
    ratio: "16:9",
    extra_body: { response_format: "url", image: ["https://example.com/ref.png"] },
  })
})

test("multipart files become JSON data URIs; mask and multiple-output fail before fetch", async () => {
  const recorded = recorder()
  const adapter = agnesFetch(base, recorded.fetch)
  const form = new FormData()
  form.set("model", imageModelID("agnes-image-2.5-flash"))
  form.set("prompt", "edit photo")
  form.set("response_format", "b64_json")
  form.append("image[]", new Blob(["fake-image-bytes"], { type: "image/png" }), "ref.png")
  form.append("image[]", "https://example.com/ref2.png")

  await adapter(base + "/images/edits", { method: "POST", body: form })
  const payload = JSON.parse(recorded.calls[0].options.body)
  assert.equal(payload.model, "agnes-image-2.5-flash")
  assert.deepEqual(payload.extra_body.image, [
    "data:image/png;base64,ZmFrZS1pbWFnZS1ieXRlcw==",
    "https://example.com/ref2.png",
  ])
  assert.equal(payload.extra_body.response_format, "b64_json")

  form.set("mask", new Blob(["mask"], { type: "image/png" }))
  await assert.rejects(adapter(base + "/images/edits", { method: "POST", body: form }), /mask/)

  for (const fields of [{ n: 2 }, { mask: "x" }, { image: "file:///local.png" }]) {
    await assert.rejects(adapter(base + "/images/generations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "agnes-image-2.5-flash", prompt: "cat", ...fields }),
    }))
  }
  assert.equal(recorded.calls.length, 1)
})

test("chat passes through unchanged; other origin and redirects are blocked", async () => {
  const recorded = recorder()
  const adapter = agnesFetch(base, recorded.fetch)
  const init = { method: "POST", body: JSON.stringify({ model: "agnes-3.0-flash", stream: true }) }
  await adapter(base + "/chat/completions", init)
  assert.equal(recorded.calls[0].options.body, init.body)
  assert.equal(recorded.calls[0].options.redirect, "error")
  await assert.rejects(adapter("https://example.com/v1/chat/completions", init), /拒绝/)
  assert.equal(recorded.calls.length, 1)
})
