# magpie-plugin-agnes

Agnes AI 国内 / 国际 API Key 插件，面向 Magpie 的 OpenCode 1.x 插件宿主。无依赖，不启动浏览器，不读取 Cookie，不发送遥测。

| 入口 | Provider ID | API Base URL |
| --- | --- | --- |
| 国际版 API | `agnes-ai` | `https://apihub.agnes-ai.com/v1` |
| 国内版 API | `agens-cn` | `https://api.agnes-ai.cn/v1` |

国内 ID 按需求保留为 **`agens-cn`**，不是 `agnes-cn`。两个入口分别填写各自站点的 API Key。密钥由 Magpie 保存，插件不另写凭据文件。API Key 不等于控制台登录，因此不提供余额 / 套餐用量查询。

## 安装

在 Magpie「插件 → 发现」底部输入：

```text
github:HPygmalion/magpie-plugin-agnes
```

或使用 CLI：

```bash
magpie plugin add github:HPygmalion/magpie-plugin-agnes
```

安装后选择国内或国际入口，输入对应站点 API Key。无需浏览器登录，不占用原社区插件的 `agnes` provider ID。

## 本版只提供文本输出模型

**不提供生图或视频生成，图像 / 视频生成模型不会由本插件加入聊天候选列表，无需手动排除。** 已知对话模型的图片输入（看图）不等于生图，仍保留。

每个 Key 的 `/v1/models` 是模型来源，插件只返回其中满足以下条件的模型：

- 已文档化的 `agnes-3.0-flash`、`agnes-2.5-flash`、`agnes-2.5-pro`、`agnes-2.5-pro-beta`，且上游没有声明冲突输出类型；或
- 上游明确以 `modalities.output` / `output_modalities` 数组声明**仅 text 输出**的模型。

`agnes-image-*`、`agnes-video-*` 即使错误标成 text 也不返回。任何 image / video / audio 等非 text 输出均排除；未知 ID 如果缺少输出模态元数据，也不猜测为聊天模型。新模型只有 ID 没有元数据时，需补充文档依据后更新白名单。

已知模型使用官方文档中的上下文、输出长度、看图、推理和工具能力；其他明确 text 输出的模型不随意声明这些能力。获取模型失败会抛错，不静默返回伪造默认列表。只允许本站 `/chat/completions` 转发，禁止跨站及自动跟随重定向。

### 为什么不提供图像模型单列

经 Magpie `0.1.2115` 宿主源码核对，插件模型声明 image 输出不足以自动从聊天列表排除。为避免要求用户手动筛选，本版直接不暴露图像生成模型，也不保留兼容别名或生图适配代码。不修改 Magpie 本体或用户配置。只有宿主能可靠自动分离插件的生图 / 对话模型后，才适合重新加入生图支持。

Agnes 生图协议本身也需要适配：`response_format` 在 `extra_body` 内，图生图使用 JSON `/images/generations` 与 `extra_body.image`，不是标准 multipart 编辑请求。仅给模型标记 image 不代表已经打通生成链路。

OpenCode 2.x 新插件 API 不在本版支持范围内。

## 离线测试

```bash
npm test
```

也可使用 Bun：

```bash
bun test
```

测试使用模拟 fetch，不需要 Key，不向任何模型发出真实请求。覆盖双站点、认证、输出类型筛选、未知模型保守排除、上游错误、聊天透传、跨站和重定向保护。

**验证边界：离线测试，不代表已在运行中的 Magpie 安装或完成真实推理验证。**

## 参考

- [Agnes 国内 API 文档](https://www.agnes-ai.cn/zh-Hans/docs/overview)
- [Agnes 国际 API 文档](https://www.agnes-ai.com/en/docs/overview)
- [社区 Agnes 插件](https://github.com/magpie-community/plugins/tree/main/packages/agnes)
- [Magpie 0.1.2115 插件模型处理](https://github.com/yetone/magpie/blob/v0.1.2115/internal/provider/plugins.go)

MIT；参考接口约定，未复制社区插件实现代码。
