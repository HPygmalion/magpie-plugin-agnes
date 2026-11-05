# magpie-plugin-agnes

> **Agnes AI 国内与国际双版 API 插件，专为 Magpie 设计。轻量免登录浏览器，支持图像模型独立抽离与免费过滤。**

---

### 🌟 四大核心亮点

1. **支持国内与国际双版 API 直连**  
   * **国内版**（`https://api.agnes-ai.cn/v1` · ID: `agnes-cn`）与**国际版**（`https://apihub.agnes-ai.com/v1` · ID: `agnes-ai`）双入口独立存在。  
   * 直接填入对应站点的 API Key 即可使用，无需复杂的后台无头 Chrome 抓 Cookie 流程，网络与代理配置互不干扰。

2. **精准标记免费模型与上下文窗口**  
   * **免费标记**：对接官方定价文档，`agnes-2.5-flash`、`agnes-3.0-flash` 及生图模型（体验期 ¥0）均标注 `free: true`，在 Magpie 弹窗中**自动激活并展示绿色的「只选免费」一键过滤按钮**。  
   * **完整上下文与 64K 输出**：Flash 标明 512K 上下文，Pro 标明 1.0M 上下文（药丸显示 `1.0M` 角标）；全系文本模型准确配置 **65,536 tokens（64K）** 单次最大输出上限。

3. **支持图像模型独立单列（对标 Loomy / Antigravity）**  
   * **专属区域抽离**：利用 Magpie 底层 `ImagesAPI` 别名机制，将生图模型（`agnes-image-2.5-flash` 等）自动归入弹窗底部的**「图像模型」**独立栏目。  
   * **Agent 对话隔离**：图像模型不在 Agent 聊天的候选列表中干扰，可在「设置 → 图像」中作为主力生图模型勾选。  
   * **生图协议自动适配**：发出请求时自动将 `response_format` 规范化置入 `extra_body`，支持图生图参考图转换，还原真实官方 ID。

4. **全自动排除视频模型**  
   * 彻底拦截并过滤 `agnes-video-*` 及一切包含视频输出的模型，即使上游后续发布新的视频模型也不会混入对话或出图清单。

---

## 插件概览

| 入口 | Provider ID | API Base URL | 默认预填模型 |
| --- | --- | --- | --- |
| 国际版 API | `agnes-ai` | `https://apihub.agnes-ai.com/v1` | 内置 4 个核心文本模型 + 2 个生图模型 |
| 国内版 API | `agnes-cn` | `https://api.agnes-ai.cn/v1` | 内置 4 个核心文本模型 + 2 个生图模型 |

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
* **新出图模型**（符合 `agnes-image-*` 或声明了 image 输出）：自动归入底部的「图像模型」独立区域，别名转换与生图请求适配器自动生效；
* **新对话模型**（如 `agnes-3.5-pro`、`agnes-4.0-flash`）：自动识别并挂入对话模型列表，Flash 系列自动延续免费标记；
* **新视频模型**（如 `agnes-video-3.0`）：自动拦截过滤丢弃，绝不污染对话列表。

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
- 上游新发布模型的前向兼容解析测试（动态识别新生图模型与新对话模型）
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
