# magpie-plugin-agnes

Agnes AI 国内版 / 国际版 API Key 插件，面向 Magpie 的 OpenCode 1.x 插件宿主。无外部依赖，不启动浏览器，不读取 Cookie，不发送遥测。

| 入口 | Provider ID | API Base URL | 默认模型 |
| --- | --- | --- | --- |
| 国际版 API | `agnes-ai` | `https://apihub.agnes-ai.com/v1` | 内置核心对话模型与生图模型 |
| 国内版 API | `agens-cn` | `https://api.agnes-ai.cn/v1` | 内置核心对话模型与生图模型 |

国内 ID 按需求保留为 **`agens-cn`**（不是 `agnes-cn`）。两个入口分别填写对应站点的 API Key。密钥由 Magpie 统一保存，插件不另写凭据文件。

---

## 安装

在 Magpie「扩展 → 插件 → 发现」底部安装框中输入：

```text
github:HPygmalion/magpie-plugin-agnes
```

或使用 Magpie 命令行：

```bash
magpie plugin add github:HPygmalion/magpie-plugin-agnes
```

安装后进入「模型 → 供应商」，点击添加/编辑对应入口并填入 API Key 即可。

---

## 核心特性

### 1. 独立「图像模型」抽离展示（对标 Loomy / Antigravity）
* **自动单列**：针对 Agnes 的生图模型（如 `agnes-image-2.5-flash`、`agnes-image-2.1-flash`），通过标准白名单兼容别名（`-imagen` 后缀），使其能被 Magpie 底层 `gateway.Drawers` 精准捕获并自动放置在弹窗底部的**「图像模型」**区域中。
* **Agent 对话隔离**：图像模型不会出现在 Agent 对话模型的候选列表里。生图模型在 Magpie 的「设置 → 图像」中作为主力出图模型勾选使用。
* **生图协议自动适配**：
  * 请求发出前自动还原为官方真实 ID（`agnes-image-2.5-flash`）。
  * 自动将 `response_format` 规范化放入 `extra_body.response_format`。
  * 图生图 / 编辑请求自动将参考图转换为 Data URI 并注入 `extra_body.image`。
  * 默认尺寸智能补全（`1024x1024`）。

### 2. 免费模型与「只选免费」按钮
* **免费模型标记**：根据 Agnes 官方定价文档，`agnes-2.5-flash`、`agnes-3.0-flash` 以及生图模型在体验期均为 ¥0 免费，已标注 `free: true`。
* **快速过滤**：Magpie 检测到免费模型后，会在弹窗的「模型」区域自动提供 **`只选免费`** 操作按钮，一键仅保留免费模型。

### 3. 上下文与最大输出（64K）
* **上下文窗口**：
  * Flash 系列：**512K**（524,288 tokens）
  * Pro 系列：**1.0M**（1,048,576 tokens，药丸右侧显示 `1.0M` 角标）
* **单次最大输出**：全系列文本模型最大回复 token 均已完整配置为 **65,536 tokens（64K）**，作为 `max_tokens` 准确透传给 Agent。

### 4. 彻底排除视频模型
* `agnes-video-*` 及包含 `video` 输出的模型已被彻底过滤，不混入对话或出图列表中。

### 5. 官方 Logo 支持
* 自动配置 Agnes AI 官方 Logo（`https://www.agnes-ai.com/images/biglogo.png`），在供应商弹窗与列表头部正常显示图标。

### 6. 上游模型动态更新与前向兼容
当 Agnes 官方未来更新上游 `/v1/models` 列表时，在供应商弹窗点击「重新获取模型」即可自动无缝适配，无需更新插件代码：
* **新出的图像模型**（命名符合 `agnes-image-*` 或上游声明了 image 输出）：插件动态将其归入「图像模型」专属区域，别名转换与生图请求适配器自动生效；
* **新出的对话模型**（如 `agnes-3.5-pro`、`agnes-4.0-flash` 等）：自动识别并挂入对话模型列表，Flash 系列自动延续免费标记；
* **新出的视频模型**（如 `agnes-video-3.0` 等）：自动拦截过滤，绝不混入对话列表。

---

## 离线测试

项目自带完整的单元测试套件，使用 Node.js / Bun 原生测试运行器，不发起任何收费或外部网络请求：

```bash
# Node.js
npm test

# 或 Bun
bun test
```

测试覆盖：
- 国际与国内双 Provider 配置与 Logo 属性
- 初始预填模型与动态拉取过滤
- 未来新版本模型的前向兼容解析测试（动态识别新生图模型与新对话模型）
- 免费标志、上下文窗口与 64K 输出上限校验
- 图像模型别名映射与独立图像抽离标记
- 图像生成与编辑的协议转换（`extra_body`、尺寸补全、Data URI 格式化）
- 对话请求透传与跨站隔离拦截

---

## 参考

- [Agnes 国内 API 文档](https://www.agnes-ai.cn/zh-Hans/docs/overview)
- [Agnes 国际 API 文档](https://www.agnes-ai.com/en/docs/overview)
- [Agnes 定价与免费政策](https://wiki.agnes-ai.cn/zh-Hans/docs/pricing.md)
- [Magpie 插件网关与生图适配源码](https://github.com/yetone/magpie)

MIT License.
