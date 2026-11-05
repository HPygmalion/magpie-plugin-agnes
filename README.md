# magpie-plugin-agnes

> **Agnes AI 国内与国际双版 API 插件，专为 Magpie 设计。轻量免登录浏览器，纯净文本模型列表，支持一键「只选免费」。**

---

### 🌟 四大核心亮点

1. **🇨🇳 支持国内与国际双版 API 直连**  
   * **国内版**（`https://api.agnes-ai.cn/v1` · ID: `agnes-cn`）与**国际版**（`https://apihub.agnes-ai.com/v1` · ID: `agnes-ai`）双入口独立管理。  
   * 直接填入对应站点的 API Key 即可使用，无需后台无头 Chrome 抓 Cookie 流程，网络、代理与账号互相隔离，稳定不打架。

2. **🌟 精准标记免费模型与「只选免费」一键过滤**  
   * **免费模型精准标记**：对接官方定价文档，`agnes-2.5-flash` 与 `agnes-3.0-flash`（体验期输入/输出/缓存均为 ¥0）均标记 `free: true`。  
   * **一键过滤**：在 Magpie 弹窗中**自动激活并展示绿色的「只选免费」按钮**，点击即可一键勾选全部免费模型。

3. **⚡️ 512K / 1.0M 大上下文与 64K 单次最大输出**  
   * **真实上下文窗口**：Flash 系列配置 524,288 tokens（512K），Pro 系列配置 1,048,576 tokens（1.0M，药丸右侧显示 `1.0M` 角标）。  
   * **最大回复上限**：全系列文本模型准确配置 **65,536 tokens（64K）** 单次最大输出上限，完整透传给 Claude Code / Codex 等 Agent。

4. **🚫 彻底排除生图与视频模型干扰，确保文本列表纯净**  
   * 自动且严格过滤掉所有 `agnes-image-*` 生图模型与 `agnes-video-*` 视频模型。  
   * **绝不将不支持对话的模型混入文本模型列表**，避免在对话列表中误选导致 API 报错，列表清爽纯净。

---

## 插件概览

| 入口 | Provider ID | API Base URL | 默认预填核心文本模型 |
| --- | --- | --- | --- |
| 国际版 API | `agnes-ai` | `https://apihub.agnes-ai.com/v1` | `agnes-3.0-flash`、`agnes-2.5-flash`、`agnes-2.5-pro`、`agnes-2.5-pro-beta` |
| 国内版 API | `agnes-cn` | `https://api.agnes-ai.cn/v1` | `agnes-3.0-flash`、`agnes-2.5-flash`、`agnes-2.5-pro`、`agnes-2.5-pro-beta` |

两个入口各自独立管理 API Key。密钥由 Magpie 统一保存，插件不另写凭据文件。

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

安装后进入「模型 → 供应商」，点击添加对应入口并填入对应站点的 API Key 即可。

---

## 上游模型动态更新与前向兼容

当 Agnes 官方未来更新上游 `/v1/models` 接口时，点击供应商界面的「重新获取模型」即可自动无缝适配，无需升级插件代码：
* **新对话模型**（如 `agnes-3.5-pro`、`agnes-4.0-flash` 等）：自动识别并挂入对话模型列表，Flash 系列自动延续免费标记与大上下文；
* **新视频/生图模型**（如 `agnes-video-3.0`、`agnes-image-3.0` 等）：自动拦截过滤丢弃，绝不污染对话模型列表。

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
- 国际与国内双 Provider 配置与官方 Logo 属性
- 初始预填模型与动态拉取过滤
- 严格排除图像生成与视频模型（确保对话模型列表 100% 纯净）
- 免费标志、上下文窗口与 64K 输出上限校验
- 未来新版本模型的前向兼容解析测试
- 对话请求透传与跨站隔离拦截

---

## 参考

- [Agnes 国内 API 文档](https://www.agnes-ai.cn/zh-Hans/docs/overview)
- [Agnes 国际 API 文档](https://www.agnes-ai.com/en/docs/overview)
- [Agnes 定价与免费政策](https://wiki.agnes-ai.cn/zh-Hans/docs/pricing.md)
- [Magpie 插件开发参考](https://github.com/yetone/magpie)

MIT License.
