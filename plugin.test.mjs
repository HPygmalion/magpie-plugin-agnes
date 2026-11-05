import assert from "node:assert/strict"
import { test } from "node:test"
import { _internal } from "./index.mjs"
import * as entry from "./opencode.mjs"

const { SITES, LOGO, createPlugin, TEXT_MODELS } = _internal
const auth = { type: "api", key: " test-key " }

function recorder(body = { data: [] }) {
  const calls = []
  const fetch = async (url, options) => {
    calls.push({ url: String(url), options })
    return Response.json(body)
  }
  return { calls, fetch }
}

for (const site of Object.values(SITES)) {
  test(`${site.id}: logo, bootstrap models, free badges, context/output limits, zero image/video in chat`, async () => {
    const recorded = recorder({ data: [
      { id: "agnes-3.0-flash" },
      { id: " agnes-2.5-pro " },
      { id: "agnes-image-2.5-flash" },   // Must be filtered out!
      { id: "agnes-image-2.1-flash" },   // Must be filtered out!
      { id: "agnes-video-2.5" },         // Must be filtered out!
      { id: "agnes-image-3.0-flash" },   // Future image model - must be filtered out!
      { id: "agnes-video-3.0" },         // Future video model - must be filtered out!
      { id: "future-flux", modalities: { output: ["image"] } },
      { id: "future-film", modalities: { output: ["video"] } },
      { id: "agnes-3.5-flash" },         // Future text flash model - accepted & free!
      { id: "agnes-4.0-pro" },           // Future text pro model - accepted!
      { id: "unknown-without-metadata" }, // Filtered out!
    ] })

    const plugin = createPlugin(site, recorded.fetch)
    const cfg = {}
    await plugin.config(cfg)

    assert.equal(cfg.provider[site.id].api, site.baseURL)
    assert.equal(cfg.provider[site.id].icon, LOGO)

    // Initial bootstrap must contain only pure text models, zero image models!
    const bootstrapKeys = Object.keys(cfg.provider[site.id].models)
    assert.deepEqual(bootstrapKeys, Object.keys(TEXT_MODELS))
    assert.ok(!bootstrapKeys.some((k) => /image|video/i.test(k)))

    assert.equal(plugin.auth.provider, site.id)
    assert.equal(plugin.auth.icon, LOGO)
    assert.deepEqual(plugin.auth.methods.map((m) => m.type), ["api"])

    const loaded = await plugin.auth.loader(async () => auth)
    assert.equal(loaded.apiKey, "test-key")
    assert.equal(loaded.baseURL, site.baseURL)

    const models = await plugin.provider.models({}, { auth })

    // Expected models: ONLY pure text chat models!
    assert.deepEqual(
      Object.keys(models).sort(),
      ["agnes-2.5-pro", "agnes-3.0-flash", "agnes-3.5-flash", "agnes-4.0-pro"].sort()
    )

    // Verify zero image or video models exist in the returned dictionary
    for (const id of Object.keys(models)) {
      assert.ok(!/image|video|flux/i.test(id), `Model ${id} should not be in chat models!`)
      assert.deepEqual(models[id].modalities.output, ["text"])
      assert.equal(models[id].capabilities.output.text, true)
      assert.equal(models[id].capabilities.output.image, false)
      assert.equal(models[id].capabilities.output.video, false)
    }

    // Verify Flash models are marked free
    assert.equal(models["agnes-3.0-flash"].free, true)
    assert.equal(models["agnes-3.0-flash"].limit.context, 524288)
    assert.equal(models["agnes-3.0-flash"].limit.output, 65536)

    assert.equal(models["agnes-3.5-flash"].free, true)
    assert.equal(models["agnes-3.5-flash"].limit.context, 524288)
    assert.equal(models["agnes-3.5-flash"].limit.output, 65536)

    // Verify Pro models have 1M context and 64K output
    assert.equal(models["agnes-2.5-pro"].free, false)
    assert.equal(models["agnes-2.5-pro"].limit.context, 1048576)
    assert.equal(models["agnes-2.5-pro"].limit.output, 65536)

    assert.equal(models["agnes-4.0-pro"].free, false)
    assert.equal(models["agnes-4.0-pro"].limit.context, 1048576)
    assert.equal(models["agnes-4.0-pro"].limit.output, 65536)
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

for (const site of Object.values(SITES)) {
  test(`${site.id}: chat unchanged, redirects blocked, no image/video or cross-site calls`, async () => {
    const calls = []
    const plugin = createPlugin(site, async (url, options) => {
      calls.push({ url, options })
      return new Response("mock stream")
    })
    const loaded = await plugin.auth.loader(async () => auth)
    const init = { method: "POST", body: JSON.stringify({ model: "agnes-3.0-flash", stream: true }) }
    assert.equal(await (await loaded.fetch(site.baseURL + "/chat/completions", init)).text(), "mock stream")
    assert.equal(calls[0].options.body, init.body)
    assert.equal(calls[0].options.redirect, "error")
    for (const url of [
      "https://example.com/v1/chat/completions",
      Object.values(SITES).find((s) => s !== site).baseURL + "/chat/completions",
      site.baseURL + "/images/generations",
      site.baseURL + "/videos",
    ]) {
      assert.throws(() => loaded.fetch(url, init), /仅允许/)
    }
    assert.equal(calls.length, 1)
  })
}
