# Changelog

All notable changes to this plugin will be documented in this file.

## [0.4.3] - 2026-10-08

### Changed
- 按社区审查的 ESLint 规则整改：改用 Obsidian 的 DOM 辅助方法与跨窗口 `instanceOf`、`window` 定时器，补齐浮动 Promise 的 `void`，并收敛不安全类型
- 设置页改用 `setHeading()` 标题，移除内联样式与 `innerHTML`；PDF 视图改用 `getActiveViewOfType` 替代弃用的 `activeLeaf`
- `minAppVersion` 提升到 `1.7.2`（匹配所用 API 的最低版本）
- 新增 ESLint 配置与 `npm run lint`

### Release
- Tag: `0.4.3`（无 v 前缀）
- Assets: `main.js`, `manifest.json`, `styles.css`

## [0.4.2] - 2026-10-08

### Changed
- 修复社区审查反馈：插件描述以句号结尾，README 标题与插件名一致
- 发布流程把源码与文档同步到公开仓库，满足社区目录“被审查仓库须包含源码”的要求
- 发布资产生成 GitHub 构建来源证明

### Release
- Tag: `0.4.2`（无 v 前缀）
- Assets: `main.js`, `manifest.json`, `styles.css`

## [0.4.1] - 2026-10-08

### Changed
- 插件定名为 Scholiast（中文「笺注」）：插件 ID `scholiast`，名称与描述更新
- 批注数据目录改为知识库根目录的 `scholiast/annotations.json`；本版本不迁移旧目录数据
- README 补充编辑器、写批注面板、侧边栏、批注中心和设置页的效果截图，并加入可复现的截图生成脚本 `docs/render-screenshots.mjs`

### Release
- Tag: `0.4.1`（无 v 前缀）
- Assets: `main.js`, `manifest.json`, `styles.css`

## [0.4.0] - 2026-10-08

### Changed
- 首次更名尝试，定名为 Marginalia。因与他人插件重名，随即在 `0.4.1` 中改为 Scholiast，本版本已废弃

## [0.2.6] - 2026-09-24

### Changed
- 批注中心补上标题，文件夹可折叠，左侧可按标签、颜色和时间筛选
- 在批注中心点卡片会在旁边打开原文，管理页留在原地
- 手动删除批注后，编辑器光标回到删除前的位置

### Release
- Tag: `0.2.6`（无 v 前缀）
- Assets: `main.js`, `manifest.json`, `styles.css`

## [0.2.5] - 2026-09-24

### Changed
- 当前文档侧栏改成阅读优先：搜索、数量标签和菜单收在顶部，卡片只留色边
- 点击卡片定位原文；编辑和更多在悬停或触控时出现
- 新增批注中心、选区工具条和行号槽圆点
- 批注可以带标签。高亮和批注仍是同一条记录

### Release
- Tag: `0.2.5`（无 v 前缀）
- Assets: `main.js`, `manifest.json`, `styles.css`

## [0.2.4] - 2026-09-24

### Added
- 光标放在已有批注或高亮上时，可以定位、编辑或删除
- 编辑会改原来的那一条；删除后可以用撤销恢复

### Release
- Tag: `0.2.4`（无 v 前缀）
- Assets: `main.js`, `manifest.json`, `styles.css`

## [0.2.3] - 2026-09-23

### Changed
- 批注快捷键只打开草稿。Ctrl+Enter 保存，写了内容后点弹窗外面也会保存；Esc 和取消丢弃草稿
- 侧边栏操作按钮保持可见，搜索结果可用方向键选择并用 Enter 打开
- 源码按文案、存储、PDF、侧边栏和设置拆开

### Release
- Tag: `0.2.3`（无 v 前缀）
- Assets: `main.js`, `manifest.json`, `styles.css`

## [0.2.1] - 2026-07-06

### Fixed
- 命令面板去除"手机端："前缀，命令名称更简洁
- 修正 README 文档与实际插件操作的多处不一致

## [0.2.0] - 2026-06-28

### Added
- 笔记本内页风格卡片设计（Moleskine 横线底+装订孔+页边距竖线+色条）
- 侧边栏单击定位正文、双击进入编辑模式
- 自定义高亮颜色（第 7 色）支持
- 批注分组功能（HighlightGroup）
- 电脑/iPad/手机三端适配

## [0.1.15] - 2026-05-19

### Added
- 支持平板（iPad）设备适配
- 设置页面关于文本更新：说明支持电脑/iPad/手机三端

## [0.1.14] - 2026-05-18

### Added
- 支持手机端（Android）适配
- 设置页面关于文本更新：说明支持 Android 端

## [0.1.13] - 2026-05-18

### Added
- 新增中/英文界面切换功能
- 批注全局删除操作增加两次确认提示，防止误删

### Release
- Tag: `0.1.13`（无 v 前缀）
- Assets: `main.js`, `manifest.json`, `styles.css`

## [0.1.12] - 2026-05-17

### Changed
- 本地插件目录、仓库 `manifest.json`、GitHub Release tag 统一升级到 `0.1.12`
- 延续 `0.1.11` 的审核修复状态：Release 仅保留 `main.js`、`manifest.json`、`styles.css`，仓库已补 `LICENSE`

### Release
- Tag: `0.1.12`（无 v 前缀）
- Assets: `main.js`, `manifest.json`, `styles.css`

## [0.1.11] - 2026-05-17

### Added
- 本地插件目录、仓库 `manifest.json`、GitHub Release tag 统一升级到 `0.1.11`
- 补充英文主内容 + 中文折叠区 README
- 手动安装说明改为直接下载 `main.js`、`manifest.json`、`styles.css`

### Audit Fix
- 删除 `0.1.10` Release 中多余的 `article-annotator.zip`
- 删除 `0.1.11` Release 中多余的 `article-annotator.zip`
- 为仓库补充 `LICENSE`（MIT）
- 对齐 README 与当前 Release 资产，移除 zip 相关描述

### Release
- Tag: `0.1.11`（无 v 前缀）
- Assets: `main.js`, `manifest.json`, `styles.css`

## [0.1.8] - 2026-05-16

### Changed
- 更新 `main.js` 到 v0.1.8 功能
- 更新 `styles.css` 增强 UI 样式
- 更新 `manifest.json` 版本号

### Removed
- 移除英文版界面（i18n 保留中文翻译，lang 硬编码为 zh）

### Release
- Tag: `0.1.8`（无 v 前缀）
- Assets: `main.js`, `manifest.json`, `styles.css`

## [0.1.0] - 2026-05-15

### Added
- 首次发布：文本高亮和批注功能（类似 Microsoft Word 批注）
- 侧边栏面板管理批注
- 批注卡片拖拽排序
- 仅支持 Windows 桌面端
