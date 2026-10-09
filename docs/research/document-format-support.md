# Markdown、PDF 与电子书批注：现状和复用方案

调研日期：2026-10-09。源码基线：本地 HEAD `1064fcf`，manifest/package 版本 `0.5.0`。

本次只检查源码、调研一手资料和提出方案；没有修改运行代码，也没有在 Obsidian 宿主中验证集成。仓库能力不等于用户已经安装的发布版本能力。

## 结论

Scholiast 当前支持 Markdown 和 PDF，尚不支持 EPUB 等电子书。已有的摘录、想法、标签、分组、搜索与批注中心可以继续使用；需要扩展的是来源识别、阅读器交互、原文定位与预览。笔记导出为 Markdown，并不要求来源也必须是 Markdown。

优先路线：补强现有 PDF → 抽出格式适配边界 → 用 epub.js 验证 EPUB → 按实际需求考虑更多格式。若只需立即开展阅读笔记，可先用现成阅读工具，保留 Markdown 摘录与原文链接，无须先扩建插件。

## 当前源码证据

| 位置 | 观察 | 含义 |
| --- | --- | --- |
| [types.ts](../../src/types.ts) 第 30、39、47 行 | PDF 有页码、矩形、引用；位置和来源类型只包含 Markdown/PDF | 已有多格式雏形，不必重写批注主体 |
| [pdf.ts](../../src/pdf.ts) 第 119、170、240、282 行附近 | 捕获 PDF 选区、保存批注、叠加高亮、按页跳转 | PDF 已有实现，依赖宿主 DOM，并非新的 PDF 渲染引擎 |
| [annotation-model.ts](../../src/annotation-model.ts) 第 24、72 行 | 一切非 PDF 默认归为 Markdown | EPUB 不能仅新增扩展名；未知格式应返回 unsupported |
| [main.ts](../../src/main.ts) 第 251、278、426 行 | 非 PDF 进入 Markdown 读取和重新定位；导航按两种格式分支 | 接入新格式前需要集中分发，避免二进制文件进入文本流程 |
| [library-view.ts](../../src/library-view.ts) 第 794 行 | 原文上下文预览只读取 Markdown 行文本 | PDF/EPUB 可显示摘录和想法，但尚无对应原文预览 |
| [store.ts](../../src/store.ts) 第 68 行 | normalize 后将 null 记录过滤掉 | 新版位置进入旧版时可能被丢弃；扩展格式前要规划版本和未知记录保留 |

README 明确限定 PDF 同页文字选区，扫描图片 PDF 没有文字层时不能创建文字批注；批注旁挂于 `scholiast/annotations.json`，没有写入原 PDF。详见 [README](../../README.md)。

### PDF 需要先验证的具体问题

1. `capturePdfSelection` 将 `Range.startContainer/endContainer` 传给只接受 `Element` 的 `getPdfPageElementFromNode`。如果端点是文本节点，函数立即返回 null，会导致选区捕获失败。这是静态检查发现的明确条件路径，尚未在宿主复现。端点类型定义见 [MDN](https://developer.mozilla.org/en-US/docs/Web/API/AbstractRange/startContainer)。
2. `jumpToPdfAnnotation` 在目标页 DOM 尚未存在时滚动到第一个匹配页面，只安排重绘，没有确保加载并再次跳到目标页；长 PDF 懒加载时需要验证。
3. 保存的是页面 DOM 的相对矩形。缩放下原则上可以复用，但旋转、裁剪、文件替换后的正确性没有相应验证；不能将其当成跨版本稳定位置。
4. 当前测试没有 PDF 选区和跳转场景；移动端创建入口主要依赖 MarkdownView，不能据 manifest 的移动端声明推断所有 PDF 交互已经覆盖。

## 优先复用哪些轮子

### PDF：原生阅读器与 PDF++

Obsidian 原生支持 PDF，EPUB 不在其原生格式列表中。[官方格式列表](https://obsidian.md/help/file-formats)

PDF++ 在原生阅读器上增强批注，能将指向 PDF 选区的 Markdown 反向链接显示成高亮。适合立即采用其阅读工作流，也适合验证我们的导出兼容性。[PDF++ 项目](https://github.com/RyotaUshio/obsidian-pdf-plus)

原生链接有 `#page=N` 和 `#page=N&selection=...`；后者保存文本项索引与偏移，不是页面矩形。当前记录只有 quote/rects，无法无损直接推导 selection 参数，需要新捕获逻辑或显式迁移。[PDF++ 作者记录的原生链接语法](https://github.com/RyotaUshio/obsidian-pdf-plus/wiki/Reviewing-Obsidian%27s-native-PDF-viewer)

PDF++ 提供 `pdfPlus.lib` 阅读器访问和 `pdf-menu` 扩展事件，可以做可选适配。但作者明确提示依赖大量 Obsidian 私有 API，README 也提示 v1.0 正在大幅重构。它不能被默认视为稳定 SDK；应隔离版本差异，禁用后仍保留摘录与页码链接。[开发接口](https://github.com/RyotaUshio/obsidian-pdf-plus/wiki/For-developers)、[维护与兼容提示](https://github.com/RyotaUshio/obsidian-pdf-plus)

PDF++ 为 MIT。[许可证](https://github.com/RyotaUshio/obsidian-pdf-plus/blob/main/LICENSE)

建议先采用原生打开/深链能力，验证 PDF++ 联动；当前 JSON 高亮与 PDF++ 的 Markdown backlink 高亮属于两套存储，安装 PDF++ 不会自动读取我们的 JSON，需要显式导出或适配。暂不另建 PDF.js 阅读器，也不默认增加写回 PDF 的功能。

如果之后确实要求自主控制 PDF 阅读器，可使用 PDF.js 已有的加载 Promise、`getPage`、`getTextContent`、`getViewport` 和渲染任务，避免自己解析 PDF 或靠固定延时等待页面。但独立 PDF.js 文档不代表宿主私有对象必然同版本兼容。[PDF.js 页面 API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFPageProxy.html)、[加载任务](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFDocumentLoadingTask.html)

### EPUB：优先 epub.js

epub.js 官方示例已有 `selected(cfiRange)`、`annotations.highlight`、`book.getRange` 与 `rendition.display(cfiRange)`，覆盖选文、渲染高亮、取原文和跳回位置。[官方高亮示例](https://github.com/futurepress/epub.js/blob/master/examples/highlights.html)

其许可为 BSD-2-Clause；源码 package.json 为 0.3.93，这不构成对 npm 最新版本的断言。[package.json](https://github.com/futurepress/epub.js/blob/master/package.json)、[许可证](https://github.com/futurepress/epub.js/blob/master/license)

建议我们只实现 Obsidian 视图、适配和持久化，复用该库的 EPUB 解析、排版和高亮。CFI 是书内位置标识；不要持久化随字号、窗口变化的屏幕页码。CFI 也不保证换版后继续准确，所以应同时保存章节、引用和上下文，识别版本变化并保留失联批注。

epub.js 默认禁用书内脚本。集成时保留该默认行为，并在桌面、移动端和弹出窗口验证本地资源加载与隔离。[官方 README](https://github.com/futurepress/epub.js)

### 更多电子书：foliate-js 或外部转换

foliate-js 提供 EPUB、MOBI、KF8/AZW3、FB2、CBZ 支持和高亮覆盖层；PDF 适配明确为高度实验性质。库本身声明 API 不稳定且没有 release，建议以固定提交接入，不能因为上层阅读器有稳定版本就推断库 API 稳定。[官方 README](https://github.com/johnfactotum/foliate-js)

它适合“必须直接打开多个电子书格式”的后续候选；首期只有 EPUB 时不必引入这份范围。MIT 许可见 [LICENSE](https://github.com/johnfactotum/foliate-js/blob/main/LICENSE)。其 README 要求通过 CSP 等手段隔离书内脚本，能否在 Obsidian 移动端安全加载需要原型验证。

另一条成本更低的路线是让用户通过 calibre `ebook-convert` 将可转换的 MOBI/AZW3 等转为 EPUB，插件只处理 EPUB。转换工具作为桌面端外部工作流，不作为移动端必需依赖。转换后要把文件视为新的阅读版本，不能自动继承旧位置。[官方命令文档](https://manual.calibre-ebook.com/generated/en/ebook-convert.html)

DRM 文件不在该转换路线保证范围内；calibre 本身不支持打开和转换 DRM 文件。[官方 DRM 说明](https://manual.calibre-ebook.com/drm.html)

### 现成完整方案：Annotator 与 Zotero 工作流

Obsidian Annotator 已支持 PDF/EPUB，基于 Hypothesis 并将批注存于本地 Markdown 文件，可用来试验产品体验。但是 README 仍记录 iOS 和跨平台注释兼容问题，因此不宜未经验证就成为我们的核心依赖。[官方项目与边界](https://github.com/elias-sundqvist/obsidian-annotator)

其许可为 AGPL-3.0，不能因我们的仓库是 MIT 就直接复制其实现并假设许可不变；优先独立使用或评估数据导入。[许可证](https://github.com/elias-sundqvist/obsidian-annotator/blob/master/LICENSE)

论文工作流可以由 Zotero 负责 PDF 阅读与批注，再导入 Obsidian。Zotero 官方支持从 PDF 批注生成带返回链接和引用的笔记。[官方阅读与笔记文档](https://www.zotero.org/support/pdf_reader)

Zotero 本身也支持 EPUB 和网页快照批注，官方公告说明桌面 Zotero 7 与 iOS 的能力。[官方 EPUB 公告](https://www.zotero.org/blog/ios-epub-snapshot-annotation-and-pdf-metadata-retrieval/)

Obsidian Zotero Integration 的 README 声明导入 PDF 批注；原 mgmeyers 地址现在重定向到 community-archive，维护状态应单独核查。本次未证实它能导入 EPUB 批注，也未证实它能直接写入 Scholiast JSON。[当前项目](https://github.com/community-archive/obsidian-zotero-integration)

其 `LICENSE.md` 与 package.json 的许可证声明存在 GPLv3/MIT 差异，所以推荐外部工作流联动，暂不建议复制代码嵌入。[LICENSE.md](https://github.com/community-archive/obsidian-zotero-integration/blob/main/LICENSE.md)、[package.json](https://github.com/community-archive/obsidian-zotero-integration/blob/main/package.json)

## 建议的最小调整

以下为结合源码与调研作出的设计建议，尚未实现。

### 1. 保留批注主体，分离来源与位置

摘录、想法、标签、颜色、分组、时间可以复用。增加来源标识，区分稳定 documentId、当前路径、格式、版本指纹及可选外部条目 ID；路径用于查找，指纹辅助识别版本变化，不能代替稳定 ID。

位置按格式建模：

| 格式 | 主要定位 | 辅助数据 |
| --- | --- | --- |
| Markdown | 行列或文本位置 | 原句、前后文 |
| PDF | 物理页号 + 文本选区或页面坐标 | 显示页标签、旋转/坐标系、引用；跨页时多个片段 |
| EPUB | CFI range + 章节资源 | 章节名、原句、前后文、版本标识 |
| 外部阅读器 | 外部条目/批注 ID 与返回链接 | 引用、导入来源、原始定位数据 |

可借鉴 W3C Web Annotation 的 body/target 分离和 TextQuoteSelector（exact/prefix/suffix），逐步提供标准化导出，无须首期把内部数据全部改成 JSON-LD。[W3C 数据模型](https://www.w3.org/TR/annotation-model/)、[引用选择器](https://www.w3.org/TR/annotation-model/#text-quote-selector)

### 2. 设置小的格式适配边界

每个适配器负责：识别来源、捕获选区、恢复高亮、打开位置、获取上下文、给出位置标签与排序键。界面继续管理统一批注；能力由适配器声明，例如可选文本、区域批注、跨页选择、预览。

扫描 PDF 缺少文字层时，优先支持“页码/区域 + 手写想法”，或使用已有 OCR 工具预处理；不把 OCR 引擎和 PDF 排版引擎并入首期。

### 3. 同步调整数据兼容和界面

- `getFileType` 显式识别 Markdown/PDF/EPUB/unsupported，不把未知格式读成 Markdown。
- 数据文件增加 schemaVersion。加载未知格式时保留原始记录并只读展示，不静默过滤；不支持新版 schema 的版本应阻止破坏性回写。
- 重复导入用“导入提供方 + 外部批注 ID”去重；首期做单向导入，不承诺双向同步。
- 详情用来源名和“行 / 页 / 章”位置标签；按适配器显示原文上下文，阅读器不可用时仍显示保存的摘录。
- 保留 JSON 为批注编辑的唯一来源，并提供可读 Markdown 导出及原文链接。若未来维护 Markdown 镜像，应定义单向生成与删除/重命名处理，避免两份可写数据互相覆盖。

## 推荐实施顺序与验收

1. **PDF 补强**：验证并修复文本节点选区、目标页未加载时跳转、页码/selection 深链。验收重启后高亮、长 PDF、缩放、旋转、移动端与弹出窗口；PDF++ 开关均验证。
2. **格式边界与迁移**：将读取、跳转、预览和排序委托给适配器。验收旧 Markdown/PDF 数据保留、未知格式不丢失、重命名仍能查找。
3. **EPUB 最小原型**：用 epub.js 打开本地无 DRM EPUB，选文保存、重启恢复、从批注中心跳回。验收调字号/窗口宽度后位置有效、换版后明确报告失联、移动端资源加载。
4. **按需扩展**：只有真实 MOBI/AZW3 需求再比较 calibre 转换和 foliate-js；论文需求先验证 Zotero 导入。无需一次建设完整电子书阅读器。

## 未决事项

尚未在当前 Obsidian 1.13+ 宿主执行集成原型；PDF++、epub.js 的 API 可用性、离线资源加载、移动端行为和大书性能仍需验证。电子书是否要求直接支持 MOBI/AZW3、是否接受外部阅读器，会影响后续范围，但不影响先完成 PDF 补强和格式边界。
