# Scholiast 源码与开发说明

这份文档解释源码、数据流与验证方式。面向使用者的中英双语图文指南位于[根目录 README](../README.md)。

## 项目定位与设计依据

Scholiast 在 Obsidian 内阅读原始学习文档，并管理独立存储的高亮、摘录、想法和标签。原始文件保留在知识库，批注内容存于 JSON；导出 Markdown 是单向快照。

- [领域术语](../CONTEXT.md)：阅读位置与批注位置是不同概念。
- [阅读与批注设计](design/reading-and-annotation.md)、[键盘圈选设计](design/ebook-keyboard-annotation.md)。
- [ADR 0001](adr/0001-vault-resident-original-documents.md)：复用原生文件入口，外部文件复制导入。
- [ADR 0002](adr/0002-precision-links-and-optional-markdown-export.md)：精确回原文，Markdown 按需导出。
- [已确认键盘决策](design/keyboard-implementation-decisions.md)：默认关闭、无默认快捷键、统一撤销不拦截 Ctrl/Cmd+Z。

## 模块地图

| 模块 | 职责 |
| --- | --- |
| `src/main.ts` | 插件生命周期、命令注册、Markdown/PDF 交互与界面协调 |
| `src/types.ts`、`annotation-model.ts`、`document-format.ts` | 批注/文档/位置类型、数据归一化与格式判断 |
| `src/store.ts`、`store-schema.ts` | 知识库数据读写、迁移、串行写入、备份与失败恢复 |
| `src/anchor.ts`、`annotation-range.ts` | 引文/上下文匹配与范围定位 |
| `src/editor-highlights.ts`、`reading-highlight.ts`、`annotation-history.ts` | Markdown 编辑与阅读高亮、编辑器历史 |
| `src/pdf.ts` | PDF 选文、页面/区域批注与页面就绪后的定位 |
| `src/reader.ts` | 文档身份与进度、导入/最近阅读、电子书视图及宿主消息边界 |
| `runtime/ebook-frame.js` | 离线引擎入口、章节清理、选区/位置消息、导航与覆盖层 |
| `runtime/ebook-keyboard.js` | 每个 iframe 独立的标签、临时范围、方向键扩展、确认与焦点 |
| `runtime/ebook-appearance.js` | 章节深浅主题与字号；保留 URL 插图、SVG 和固定布局内容 |
| `src/sidebar.ts`、`library-view.ts`、`annotation-card.ts` | 文档侧栏、跨文档批注中心、共享摘录/想法卡片 |
| `src/note-modal.ts`、`note-draft.ts`、`highlight-colors.ts` | 草稿保存/取消/重试与共享色板 |
| `src/annotation-query.ts`、`filter-popover.ts`、`filter-chips.ts` | 搜索、排序与筛选 |
| `src/i18n.ts`、`settings.ts`、`styles.css` | 中英文案、声明式设置与主题样式 |
| `vendor/foliate-js/` | 固定版本的电子书阅读引擎；许可证随源码保留 |
| `esbuild.config.mjs` | 内嵌阅读运行时与样式，构建单一 `main.js` |

上表中省略路径的 TypeScript 文件同样位于 `src/`。公共类型用于宿主侧；章节 DOM 和范围只在 iframe 中操作，不能把旧 DOM 当作长期位置。

## 数据与运行流程

```text
知识库中的原始文档
  → 文档记录（稳定 ID、格式、源文件摘要）
  → 原生 Markdown/PDF 视图或电子书 iframe
  → 选区草稿 → 明确保存 → annotations.json
  → 高亮覆盖层、共享卡片与批注中心

当前位置 → reading-state.json → 下一次打开时恢复
批注位置 → 精确链接/定位请求 → 引文核对 → 精确、部分或失联反馈
```

### 存储边界

- `scholiast/annotations.json` 使用 schema v2，保存文档、批注和分组。旧 ID、未知记录与附加字段保留；未来 schema 阻止回写。
- `scholiast/reading-state.json` 使用 schema v1，按文档 ID 保存阅读位置、最近打开时间和面板开关。电子书恢复要求源文件摘要一致。
- 设置保存在插件 `data.json`，与批注数据分开。
- 注释存储串行写入并做暂存/写后校验，失败恢复；首次旧版迁移保留 `.v1-backup.json`。阅读进度防抖 800 毫秒，视图关闭等待写盘。
- 文件改名保留文档身份，缺失文件保留批注；不自动覆盖含糊原文匹配，不自动双向同步 Markdown 导出，不提供跨设备同时写入的事务保证。

### 电子书会话

1. 宿主读取知识库原文件，核对大小与摘要，创建带 CSP 的 iframe，内嵌全部引擎依赖。
2. iframe 就绪握手后接收文件、批注、阅读位置与键盘配置；各格式章节先清理，再交给阅读器。
3. `relocate` 传回 CFI/章节，宿主保存阅读进度。分页、字号和宽度可以变化，长期位置不使用视觉页号。
4. 标签圈选保存临时 CFI 与引文。Enter 创建草稿，保存成功才生成批注；失败保留草稿。重复范围打开原记录编辑。
5. 宿主验证消息的来源窗口、会话 token 与加载 generation，避免旧会话保存；关闭清理计时器、事件、预览与 blob URL。

**焦点约束：**分页器把正文元素的 `focusin` 视为导航请求。聚焦整章 `body` 会把当前页跳到章节开头，进而覆盖阅读进度。键盘返回正文应只聚焦章节窗口；打开宿主弹窗前先聚焦宿主视图，避免 Obsidian 对章节未增强 DOM 恢复焦点时抛错。相关回归必须在长章节的后续页执行，首页测试无法发现此问题。

### 安全与格式范围

电子书正文清理并受 CSP 限制，书内脚本、外部资源与表单不可执行；阅读依赖离线内嵌。支持未加密 EPUB/MOBI/AZW3/FB2，单文件上限 100 MiB，ZIP 单资源 64 MiB、展开合计 256 MiB。不新增 calibre 或格式转换依赖。

PDF 区域使用明确记录的 DOM 归一化坐标；旋转不匹配时停止旧区域绘制。不能把这一实现描述为原生 PDF 用户空间坐标。

## 开发与本地安装

在源码目录运行：

```sh
npm ci
npm run dev
```

生产构建：

```sh
npm run build
```

构建先执行 TypeScript 检查，再内嵌引擎、样式与解压依赖，生成压缩 `main.js`。运行时安装只需要同一构建的 `main.js`、`manifest.json`、`styles.css`。将它们复制到测试知识库实际配置目录下的 `plugins/scholiast/`，然后重新加载插件。

更新时备份旧运行文件，只替换这三个文件。不要覆盖 `data.json`、批注 JSON 或阅读进度，也不要把个人知识库与数据提交到源码仓库。当前最低 Obsidian 版本为 1.13.0，设置使用声明式定义；版本与平台声明以 [manifest.json](../manifest.json) 为准。

## 验证

| 命令 | 验证层与前提 |
| --- | --- |
| `npm test` | 存储、草稿、撤销、会话边界与标签/分句逻辑；宿主 API 使用替身 |
| `npm run lint` | TypeScript 与 Obsidian 插件规范 |
| `npm run build` | 类型检查与离线生产打包 |
| `npm run test:keyboard` | 安装 Chrome 后运行真实章节 DOM、分页、CFI 和 CSP 集成测试 |
| `npm run test:host` | macOS 已安装 Obsidian；使用临时 profile/知识库验证真实插件、JSON 和进程重启 |
| `npm run test:ebooks` | 历史四格式与恶意 EPUB 回归；样本生成需要 calibre 的 `ebook-convert` |

`test:keyboard` 和 `test:host` 直接生成原创 EPUB，不依赖 calibre。宿主脚本可通过 `SCHOLIAST_OBSIDIAN` 指定应用可执行文件；默认路径与运行时复制针对 macOS，不表示 Windows 已验收。

宿主进度回归覆盖长章节后续页 → 聚焦 → 圈选 → 保存想法 → 立即关闭 → 正常重开，并确认批注原文仍在当前页；另验证第二章恢复及独立进程重启。恢复检查按原文位置判断，允许字号/窗口重排改变页边界。报告与临时截图位于忽略目录 `.test-output/`。

最终验证数量、独立 Standards/Spec 审核及未覆盖范围见[本轮键盘验证](design/keyboard-validation.md)和[实现状态](design/implementation-status.md)。原生输入法、移动端、多窗口和其他格式的大书仍需人工验收。

## 图文指南维护

[用户指南](../README.md)提供完整英文和中文步骤。当前阅读器、编辑器和双语卡片截图由 `tests/ebook-host.browser.mjs` 在隔离 Obsidian 中生成：

```text
.test-output/guide-reader-light.png     → docs/screenshots/reader-light.png
.test-output/guide-reader-dark.png      → docs/screenshots/reader-dark.png
.test-output/guide-note-editor.png      → docs/screenshots/note-editor.png
.test-output/guide-annotation-zh.png    → docs/screenshots/annotation-zh.png
.test-output/guide-annotation-en.png    → docs/screenshots/annotation-en.png
```

测试通过后，目视检查并复制截图，再检查 README 的本地链接与图片是否存在。使用原创样本，不展示个人路径、私人正文或令牌。旧 `render-screenshots.mjs` 是静态布局辅助脚本，不能代替真实宿主验收。

## 分发与发布

- [源码仓库](https://github.com/github-oysl/obsidian-annotation-plugin-src)：TypeScript、运行时、样式、测试与设计。
- [分发仓库](https://github.com/github-oysl/obsidian-annotation-plugin)：构建产物与 Release。开发工作树可能领先于正式版本。
- [.github/workflows/release.yml](https://github.com/github-oysl/obsidian-annotation-plugin-src/blob/main/.github/workflows/release.yml)：推送与 manifest 版本一致的纯版本号 tag 后，构建并验证，将三个运行文件、版本兼容映射、完整中英手册、配图与开发说明同步到分发仓库，再创建/更新 Release。普通分支推送不触发正式发布。

发布前同步版本号、完成验证并更新中英文指南。工作流所需 `RELEASE_TOKEN` 由维护者在仓库 secrets 中配置；不要写入源码。本轮版本为 0.7.0，包含阅读与批注操作优化、单句段落直接选中和 slouyang 署名修正，见 [版本说明](releases/0.7.0.md)。

许可证：[MIT](../LICENSE)。第三方引擎许可证见 vendor 目录。
