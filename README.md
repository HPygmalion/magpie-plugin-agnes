# magpie-plugin-agnes

Agnes AI 国内 / 国际 API Key 插件，面向 Magpie 的 OpenCode 1.x 插件宿主。无依赖，不启动浏览器，不读取 Cookie，不发送遥测。

| 入口 | Provider ID | API Base URL | 默认模型 |
| --- | --- | --- | --- |
| 国际版 API | `agnes-ai` | `https://apihub.agnes-ai.com/v1` | 内置 4 个官方文本模型 |
| 国内版 API | `agens-cn` | `https://api.agnes-ai.cn/v1` | 内置 4 个官方文本模型 |

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

## 模型清单与特性

1. **默认不再为空**：初始配置已预填官方已文档化的 4 个核心文本模型，安装后无需手动点击「重新获取模型」即可直接使用。填写 API Key 后点击刷新可同步上游最新模型。
2. **免费模型标注**：
   - 官方免费体验模型：`agnes-2.5-flash`、`agnes-3.0-flash` 均已标为 `free: true`，Magpie 路由分流与免费策略可自动感知。
   - 付费商用模型：`agnes-2.5-pro`、`agnes-2.5-pro-beta`。
3. **上下文窗口与输出**：
   - `agnes-2.5-flash` / `agnes-3.0-flash`：524,288 tokens（512K）。
   - `agnes-2.5-pro` / `agnes-2.5-pro-beta`：1,048,576 tokens（1.0M，Magpie 标签显示 `1.0M`）。
   - 最大输出均为 65,536 tokens。
4. **排除图像与视频生成模型**：
   - `agnes-image-*`、`agnes-video-*` 以及一切声明非纯文本输出的模型彻底过滤，不混入聊天模型列表中。

### 为什么当前版本不提供图像模型

经 Magpie `0.1.2115` 宿主源码核对，插件模型声明 image 输出不足以自动从聊天列表排除（Magpie 上游 Issue #2792 尚未完成）。为避免要求用户手动筛选，本版直接不暴露图像生成模型。待 Magpie 上游支持插件图像模型与聊天模型自动分栏后，再跟进启用。

## 离线测试

```bash
npm test
```

也可使用 Bun：

```bash
bun test
```

## 参考

- [Agnes 国内 API 文档](https://www.agnes-ai.cn/zh-Hans/docs/overview)
- [Agnes 国际 API 文档](https://www.agnes-ai.com/en/docs/overview)
- [社区 Agnes 插件](https://github.com/magpie-community/plugins/tree/main/packages/agnes)

MIT；参考接口约定，未复制社区插件实现代码。
