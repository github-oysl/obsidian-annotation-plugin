# Scholiast · 笺注

Read Markdown, PDF and ebooks in Obsidian — **select and capture without the mouse**, keeping your flow and leaving the original file untouched.

在 Obsidian 里读 Markdown、PDF 和电子书——**不动鼠标圈选、随手记下想法**，阅读不中断，原文不被改动。

[English guide](#english-guide) · [中文使用指南](#中文使用指南) · [源码与开发说明](https://github.com/github-oysl/obsidian-annotation-plugin-src/blob/main/docs/README.md)

> User manual for **0.8.0** (flow notes) / **0.8.0 使用手册（心流笔记）**. Minimum Obsidian version: **1.13.0**。

All screenshots below were captured in **Obsidian for macOS (desktop), Scholiast 0.7.0**, using original demo documents. English examples use English plugin text; the host UI follows its own language setting.

以下截图均来自 **macOS 桌面版 Obsidian 中实际运行的 Scholiast 0.7.0**，使用原创演示文档；英文示例切换插件语言，宿主界面语言独立设置。

## English guide

Scholiast exists to keep you reading: highlight and note in place, without switching windows or reaching for the mouse. We call it **flow notes**.

Search **Scholiast** in the command palette for all commands; settings live in **Settings → Scholiast**, key bindings in **Settings → Hotkeys**. This page covers only the common paths.

### Flow notes in 30 seconds

- **Capture in place:** highlight, write a note and add tags right on the source; the original file is never modified and no markers are inserted.
- **Keyboard first:** in Markdown, place the cursor and record; in PDFs and ebooks, hold the activation key, type a label to select, and use Left/Right to extend.
- **Capture now, organize later:** grouping, review and export wait until after reading.

Annotations are stored separately under the vault's `scholiast/` folder and can sync with the vault; reading and annotation need no network.

> **PDF flow notes are available in 0.8.0.** Read one full page at a time, turn pages with the arrow keys, select text with labels, and capture page or region notes on scans. PDF and ebooks share the keyboard selection settings.

### Install and update

1. Download `main.js`, `manifest.json` and `styles.css` from the [distribution releases](https://github.com/github-oysl/obsidian-annotation-plugin/releases), or from the same tested build.
2. Create `plugins/scholiast/` in your vault configuration directory (usually `.obsidian/plugins/scholiast/`) and place the three files there.
3. Enable **Scholiast** in **Settings → Community plugins**. To update, replace the three files and reload; keep your existing `data.json` and the vault's `scholiast/` folder.

Plugin ID: `scholiast`. The reader engine is bundled offline; no calibre, account or conversion service is required. For a development build, see the [source documentation](https://github.com/github-oysl/obsidian-annotation-plugin-src/blob/main/docs/README.md).

### Quick start (keyboard first)

**Markdown**

1. Place the cursor on a sentence, heading or code line (or select text first).
2. Run **Add note to current selection**, or **Highlight current selection (default color)**, from the command palette.
3. Press `Enter` / `Ctrl+Enter` to save; `Tab` / `Shift+Tab` cycles colors without touching the mouse.

![Desktop Markdown: run Add note to current selection from the command palette](docs/screenshots/en-md-flow.png)

**Ebooks**

1. In **Settings → Scholiast**, enable **keyboard selection** (once); `Space` is the default activation key.
2. Click into the text and hold `Space` until paragraph labels appear, then type a label to choose a start.
3. Use Left/Right to extend by sentence; press `Enter` to open the note editor and save.

![桌面端电子书：按住 Space 显示段落标签 / Desktop ebook paragraph labels](docs/screenshots/ebook-keyboard.png)

![桌面端电子书：选择起点后按右键扩展范围 / Desktop ebook range extended with Right](docs/screenshots/ebook-keyboard-range.png)

![Desktop note editor: source excerpt, my note, tag and color](docs/screenshots/en-note-editor.png)

**PDF**

1. Enable **ebook and PDF keyboard selection** in **Settings → Scholiast**; the activation key defaults to `Space`.
2. Focus the page. Arrow Right/Down advances a page; Arrow Left/Up goes back. Hold the activation key and type a text-block label, then a sentence label when offered.
3. Release the key to keep the range, use Left/Right to adjust its endpoint, then press `Enter` to write a note. `Esc` cancels. Space and the mouse wheel do not turn pages.
4. For scans, run the PDF page-note or region-note command. Move a region with arrows, resize with `Shift`+arrows, and press `Enter` to write.

Mouse works too: use the floating toolbar in Markdown/ebooks, or select PDF text and choose a color or note from its context menu.

### Recommended shortcuts

Bind these four commands in **Settings → Hotkeys** so you rarely leave the keyboard. No command has a default shortcut; avoid assigning the ebook activation key to another action.

| Command | Use |
| --- | --- |
| Add note to current selection | Write a thought |
| Highlight current selection (default color) | Quick highlight |
| Toggle annotation panel | Review the current document |
| Undo last annotation operation | Take back a mistake |

### Annotate the three formats

| Format | How |
| --- | --- |
| Markdown | Select text, or just place the cursor to infer a range; the toolbar and command palette both highlight and add notes |
| PDF | Keyboard labels or the context menu select within one page; scanned pages support keyboard page or region notes |
| EPUB, MOBI, AZW3, FB2 | Built-in reader for unencrypted files; annotate with the palette or pencil, and optionally enable keyboard selection |

![桌面端浅色电子书阅读器与批注面板 / Desktop ebook reader and annotation panel](docs/screenshots/reader-light.png)

![桌面端 PDF：选文后右键高亮或写批注 / Desktop PDF context menu](docs/screenshots/pdf-menu.png)

**Limits:** PDF and ebook keyboard selection is **off by default**; turn it on once to use labels. PDF ranges stay within one physical page. Complex columns, rotated text and scans may need separate regions or page notes. Code or math ranges that exist only in the source cannot be shown fully in reading mode.

### The full-keyboard workflow

**Markdown: the cursor is the range.** You do not have to select first — **Highlight current selection** / **Add note to current selection** infers the range: an ATX heading uses its heading text, prose uses the current sentence (falling back to the paragraph), and fenced code uses the current nonempty code line. Empty lines and fence markers create nothing.

**Ebooks: label selection.** Hold the activation key → type a paragraph/sentence label to pick the start → use Left/Right to extend by sentence (the reader follows the endpoint across pages in the same chapter) → press `Enter` to write a note. Releasing the key alone never saves; `Esc` cancels, and `Backspace` steps back one level while choosing labels. Cross-chapter ranges are not supported yet.

**PDF: page and range.** Outside selection mode, arrows turn a physical page. Hold the activation key → choose a block/sentence label → release to retain the range → adjust the endpoint with Left/Right → press `Enter` to write. Page and region commands also work when keyboard selection is disabled. A near match asks you to choose the existing annotation before editing.

**Delete and undo stay on the keyboard too.** Bind **Delete annotation (cursor / selected / visible page)**: it prefers an explicit range or selected annotation, and shows letter labels when there are multiple candidates. Approximate PDF ranges also require choosing a label before deletion; an unmatched range keeps its selection. `Ctrl/Cmd+Z` undoes annotation changes in reading views and the annotation panel; `Ctrl/Cmd+Y` or `Ctrl/Cmd+Shift+Z` redoes them. Text inputs and Markdown source editing retain their normal text history.

### Review and organize

![Desktop annotation card: Source excerpt and My note](docs/screenshots/en-card.png)

The pen ribbon icon or **Toggle annotation panel** reviews the current document; **Open annotation library** reviews across documents. Cards separate the **source excerpt** from **my note**, with search, color/tag/file filters and sorting. In the reading panel, click a card or focus it and press `Enter` to return to the source. In the annotation library, clicking a card opens its details; use the locate button to return to the source. The pencil edits, and the more-actions menu copies the excerpt or exact link, recolors, reassigns the position or creates a separate Markdown note. Multi-select selects cards for grouping, batch recoloring or tags.

![Desktop annotation library: navigation, results and details](docs/screenshots/en-library.png)

Exports and separate notes are **one-way snapshots**; editing them never writes back to the stored annotations. For native tag workflows, add normal Markdown tags in the exported file.

### Data and privacy essentials

- Annotations, document identities and groups live in the vault's `scholiast/annotations.json`; reading position, recent reading and panel visibility in `scholiast/reading-state.json`; settings in the plugin's `data.json`.
- Back up the original files and both vault JSON files, and include them in vault sync across devices — but **avoid editing the same store on two devices at once**.
- Reading and annotation need no network; book scripts and external resources are blocked. There is no cloud account and no automatic conflict merging.
- Renaming or moving a source **inside Obsidian** preserves identity and annotations; deleting keeps records marked as missing. A new edition can break positions — the excerpt and note remain readable: use **Reassign** on a card, or **重新关联缺失文档** for a missing document.

### Troubleshooting

- **No ebook in the file list:** enable the host's “show all file types”, or use the read/import commands.
- **Highlight or position no longer matches:** the source may have changed; the excerpt and note remain — select the correct text and use **Reassign**.
- **No text in a scanned PDF:** use page or region notes; PDF selection cannot span pages.
- **Book does not open:** only unencrypted files up to 100 MiB are supported; DRM and conversion are not.
- **Can PDF be keyboard-driven?** Yes: enable the shared selection setting for text labels; page and region notes have command-palette entry points. Cross-page ranges are not supported.
- **Mobile:** the quick-actions button offers Markdown highlight/note/panel entry points; mobile ebook flows still need acceptance testing.

For the complete command and settings reference, use the command palette, **Settings → Scholiast** and **Settings → Hotkeys**. Report issues with the plugin/Obsidian version, OS and steps in the [source issue tracker](https://github.com/github-oysl/obsidian-annotation-plugin-src/issues).

## 中文使用指南

Scholiast 想做的是让阅读不被打断：读到哪里、想到什么，就在原地高亮、记想法，不用切窗口，也不用找鼠标。我们把它叫作**心流笔记**。

命令面板搜索 **Scholiast** 可找到全部命令；详细设置见 **设置 → Scholiast**，键盘绑定见 **设置 → 快捷键**。本页只讲最常用的路径。

### 30 秒了解心流笔记

- **就地记录**：直接在原文上高亮、写想法、加标签，原文保持不动，不会插入任何符号。
- **键盘优先**：Markdown 把光标停在句子就能记；PDF 与电子书按住激活键、输入标签即可圈选，左右键逐句增减。
- **先记后理**：分组、回顾、导出都留到之后，不打断当下阅读。

批注独立保存在知识库的 `scholiast/` 目录，可随知识库同步；阅读与批注不依赖网络服务。

> **0.8.0 已支持 PDF 心流笔记。** PDF 每次展示完整一页，方向键翻页，标签圈选原文；扫描页可用页面或区域笔记。PDF 与电子书共用键盘圈选设置。

### 安装与更新

1. 从[分发仓库 Releases](https://github.com/github-oysl/obsidian-annotation-plugin/releases) 下载 `main.js`、`manifest.json`、`styles.css`，或取自同一次已验证构建。
2. 在知识库配置目录下创建 `plugins/scholiast/`（常见为 `.obsidian/plugins/scholiast/`），放入这三个文件。
3. 在 **设置 → 社区插件** 启用 **Scholiast**。更新时替换这三个文件并重新加载即可，请保留已有的 `data.json` 与 `scholiast/` 数据目录。

插件 ID 为 `scholiast`；阅读引擎离线内嵌，不需要 calibre、账户或格式转换服务。源码构建见[开发说明](https://github.com/github-oysl/obsidian-annotation-plugin-src/blob/main/docs/README.md)。

### 快速上手（键盘优先）

**Markdown**

1. 光标停在想记的句子、标题或代码行上（也可以先选中一段文字）。
2. 命令面板运行 **给当前选中写批注**，或 **高亮当前选中（默认颜色）**。
3. `Enter` / `Ctrl+Enter` 保存；输入时 `Tab` / `Shift+Tab` 换色，全程不碰鼠标。

![桌面端 Markdown：光标停在正文，通过命令面板写批注](docs/screenshots/zh-md-flow.png)

**电子书**

1. 在 **设置 → Scholiast** 打开 **启用键盘圈选**（只需一次），激活键默认 `Space`。
2. 点进正文，按住 `Space` 直到出现段落标签，输入标签选择起点。
3. 按左右键逐句增减范围，`Enter` 打开想法编辑器，保存后即成批注。

![桌面端电子书：按住 Space 显示段落标签 / Desktop ebook paragraph labels](docs/screenshots/ebook-keyboard.png)

![桌面端电子书：选择起点后按右键扩展范围 / Desktop ebook range extended with Right](docs/screenshots/ebook-keyboard-range.png)

![桌面端批注编辑器：原文摘录、想法、标签与颜色](docs/screenshots/zh-note-editor.png)

**PDF**

1. 在 **设置 → Scholiast** 启用 **电子书与 PDF 键盘圈选**，激活键默认 `Space`。
2. 聚焦页面，右/下方向键到下一页，左/上方向键到上一页；按住激活键并输入文字块标签，需要时再输入句子标签。
3. 松键保留圈选，左右键调整终点，`Enter` 写想法，`Esc` 取消。Space 与滚轮不会翻页。
4. 扫描页可通过命令面板给当前页或区域写想法；方向键移动区域，`Shift`+方向键调整大小，`Enter` 编辑。

习惯鼠标也可以：Markdown / 电子书使用浮动工具栏，PDF 选文后从右键菜单选颜色或写想法。

### 推荐快捷键

为下面四个命令在 **设置 → 快捷键** 绑定顺手的组合键，就能尽量不离开键盘。命令默认都没有快捷键，注意别把电子书的激活键再分给其他动作。

| 命令 | 用途 |
| --- | --- |
| 给当前选中写批注 | 记下想法 |
| 高亮当前选中（默认颜色） | 快速高亮 |
| 切换批注面板 | 回看当前文档 |
| 撤销上次批注操作 | 记错可撤 |

### 三种文档怎么批注

| 格式 | 怎么做 |
| --- | --- |
| Markdown | 选中文字，或只放光标让命令推断范围；浮动工具栏与命令面板都能高亮、写想法 |
| PDF | 键盘标签圈选或右键菜单批注，范围限同一页；扫描页可用键盘页面批注或区域批注 |
| EPUB / MOBI / AZW3 / FB2 | 内置阅读器打开未加密文件，用色板或铅笔批注，可开启全键盘圈选 |

![桌面端浅色电子书阅读器与批注面板 / Desktop ebook reader and annotation panel](docs/screenshots/reader-light.png)

![桌面端 PDF：选文后右键高亮或写批注 / Desktop PDF context menu](docs/screenshots/pdf-menu.png)

**使用边界**：PDF 与电子书键盘圈选**默认关闭**，开启一次后即可使用标签；PDF 范围限同一物理页。复杂多栏、旋转文字和扫描页可能需要分别圈选区域或写页面笔记。此外，仅在源码中存在的代码、公式范围无法在阅读模式完整显示。

### 全键盘工作流

**Markdown：光标即范围。** 不必先选文——`高亮当前选中` / `给当前选中写批注` 就近推断：标题取标题正文，正文取当前句子（无句界时取段落），围栏代码取当前非空代码行；空行与围栏标记不创建批注。

**电子书：标签圈选。** 按住激活键 → 输入段落/句子标签选起点 → 左右键逐句增减（同章节跨页会跟随终点）→ `Enter` 记想法。只松开激活键不会保存；`Esc` 取消，选择标签时 `Backspace` 回上一级。跨章节范围暂不支持。

**PDF：单页与范围。** 未圈选时方向键翻物理页；按住激活键 → 输入块/句标签 → 松键保留范围 → 左右键调整终点 → `Enter` 记想法。页面与区域命令不要求开启键盘圈选；近似范围需先明确选择已有批注再编辑。

**删除与撤销也不离键盘。** 绑定 **删除批注（光标 / 选择 / 可见页）**：优先使用明确原文范围或已选批注，候选多条时显示字母标签。PDF 近似范围也需输入标签确认删除；未匹配保留圈选。阅读正文与批注面板中 `Ctrl/Cmd+Z` 撤销批注，`Ctrl/Cmd+Y` 或 `Ctrl/Cmd+Shift+Z` 重做；输入框与 Markdown 源码编辑保留原本的文字历史。

### 回顾与整理

![桌面端批注卡片：原文摘录与我的想法](docs/screenshots/zh-card.png)

侧栏笔形图标或 **切换批注面板** 查看当前文档，**打开批注中心** 跨文档回顾。卡片区分**原文摘录**与**我的想法**，支持搜索、颜色/标签/文件筛选与排序。阅读面板点击卡片或聚焦后按 `Enter` 回原文；批注中心点击卡片查看详情，用定位按钮回原文。铅笔编辑，更多菜单可复制原文、复制精确链接、改色、重新指定位置或转为独立 Markdown 笔记。多选模式只选择卡片，用于分组、批量改色或加标签。

![桌面端批注中心：导航、结果与详情](docs/screenshots/zh-library.png)

导出与独立笔记都是**单向快照**，修改它们不会改回原批注；需要原生标签时，请在导出的 Markdown 中自行添加。

### 数据与隐私要点

- 批注、文档身份与分组存于知识库内 `scholiast/annotations.json`；阅读位置、最近阅读与面板开关存于 `scholiast/reading-state.json`；设置存于插件目录 `data.json`。
- 备份请包含原文件与上述两个知识库 JSON。多设备使用时纳入同步，并**避免两台设备同时编辑同一存储**。
- 阅读与批注不依赖网络，书内脚本与外部资源会被阻止；插件不提供云账户，也不自动合并多设备冲突。
- 在 Obsidian 内改名/移动原文件会保留身份与批注；删除仅保留记录并标记缺失。换版后原句可能失联，摘录与想法仍可读，可在卡片菜单 **重新指定**，或对缺失文件执行 **重新关联缺失文档**。

### 常见问题

- **文件列表找不到电子书**：启用宿主“显示所有类型文件”，或使用阅读 / 导入命令。
- **高亮或位置失联**：原文件可能已变化；摘录与想法仍在，选中正确原文后用 **重新指定**。
- **扫描 PDF 不能选文**：改用页面批注或区域批注；PDF 不支持跨页选区。
- **PDF 能否用键盘操作？**：可以。开启共用圈选设置后使用文字标签；页面与区域笔记可从命令面板发起，暂不支持跨页范围。
- **电子书打不开**：仅支持未加密、不超过 100 MiB 的文件，不支持 DRM 与格式转换。
- **移动端**：快捷操作按钮提供 Markdown 高亮 / 写想法 / 侧栏入口；移动端电子书仍待验收。

更多命令、设置项与排查细节，以插件内命令面板、**设置 → Scholiast** 与 **设置 → 快捷键** 为准；如遇问题，可在[源码问题区](https://github.com/github-oysl/obsidian-annotation-plugin-src/issues)附上插件 / Obsidian 版本、系统与复现步骤。

## License / 许可

[MIT](LICENSE) · [Source / 源码](https://github.com/github-oysl/obsidian-annotation-plugin-src) · [Developer documentation / 开发文档](https://github.com/github-oysl/obsidian-annotation-plugin-src/blob/main/docs/README.md)
