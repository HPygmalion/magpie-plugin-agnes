import assert from "node:assert/strict"
import { test } from "node:test"
import { _internal } from "./index.mjs"
import * as entry from "./opencode.mjs"

const { SITES, LOGO, createPlugin, TEXT_MODELS } = _internal
const auth = { type: "api", key: " test-key " }

for (const site of Object.values(SITES)) {
  test(`${site.id}: logo, bootstrap models, API key, text only with free & context badges`, async () => {
    const calls = []
    const plugin = createPlugin(site, async (url, options) => {
      calls.push({ url, options })
      return Response.json({ data: [
        { id: "agnes-3.0-flash" },
        { id: " agnes-2.5-pro " },
        { id: "agnes-image-2.5-flash" },
        { id: "agnes-video-2.5" },
        { id: "agnes-image-2.1-flash", modalities: { output: ["text"] } },
        { id: "future-film", modalities: { output: ["video"] } },
        { id: "future-image", output_modalities: ["text", "image"] },
        { id: "agnes-2.5-flash", modalities: { output: ["audio"] } },
        { id: "unknown-without-metadata" },
        { id: "invalid-metadata", output_modalities: "text" },
        { id: "empty-metadata", output_modalities: [] },
        { id: "explicit-text", output_modalities: ["text"] },
      ] })
    })
    const cfg = {}
    await plugin.config(cfg)
    assert.equal(cfg.provider[site.id].api, site.baseURL)
    assert.equal(cfg.provider[site.id].icon, LOGO)
    // Default models must not be empty before clicking refresh
    assert.deepEqual(Object.keys(cfg.provider[site.id].models), Object.keys(TEXT_MODELS))
    assert.equal(cfg.provider[site.id].models["agnes-3.0-flash"].free, true)
    assert.equal(cfg.provider[site.id].models["agnes-3.0-flash"].limit.context, 524288)
    assert.equal(cfg.provider[site.id].models["agnes-2.5-pro"].free, false)
    assert.equal(cfg.provider[site.id].models["agnes-2.5-pro"].limit.context, 1048576)

    assert.equal(plugin.auth.provider, site.id)
    assert.equal(plugin.auth.icon, LOGO)
    assert.deepEqual(plugin.auth.methods.map((m) => m.type), ["api"])

    const loaded = await plugin.auth.loader(async () => auth)
    assert.equal(loaded.apiKey, "test-key")
    assert.equal(loaded.baseURL, site.baseURL)

    const models = await plugin.provider.models({}, { auth })
    assert.deepEqual(Object.keys(models), ["agnes-3.0-flash", "agnes-2.5-pro", "explicit-text"])
    assert.equal(calls[0].url, site.baseURL + "/models")
    assert.equal(calls[0].options.headers.authorization, "Bearer test-key")
    assert.equal(calls[0].options.redirect, "error")

    for (const row of Object.values(models)) {
      assert.equal(row.providerID, site.id)
      assert.deepEqual(row.modalities.output, ["text"])
      assert.equal(row.capabilities.output.image, false)
      assert.equal(row.capabilities.output.video, false)
    }
    assert.equal(models["agnes-3.0-flash"].capabilities.input.image, true)
    assert.equal(models["agnes-3.0-flash"].free, true)
    assert.equal(models["agnes-3.0-flash"].limit.context, 524288)
    assert.equal(models["agnes-2.5-pro"].free, false)
    assert.equal(models["agnes-2.5-pro"].limit.context, 1048576)
    assert.equal(models["explicit-text"].capabilities.reasoning, false)
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
