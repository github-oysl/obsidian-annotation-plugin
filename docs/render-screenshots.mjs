/**
 * 渲染 README 使用的界面截图。
 *
 * 使用插件真实的 styles.css，并在一个轻量模拟的 Obsidian 外壳中重建各视图的
 * DOM 结构与中英文案，然后逐场景用无头浏览器截图，输出到 docs/screenshots/。
 * 截图仅作展示，不参与插件运行。
 *
 * 需要 puppeteer：npm i -D puppeteer
 * 运行：node docs/render-screenshots.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pluginCss = fs.readFileSync(path.join(REPO, 'styles.css'), 'utf8');
const OUT = path.join(REPO, 'docs/screenshots');
const TMP = path.join(os.tmpdir(), 'scholiast-shots');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

// ---------------------------------------------------------------- icons
const ICONS = {
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  listFilter: '<path d="M3 6h18"/><path d="M7 12h10"/><path d="M10 18h4"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  locate: '<line x1="2" x2="5" y1="12" y2="12"/><line x1="19" x2="22" y1="12" y2="12"/><line x1="12" x2="12" y1="2" y2="5"/><line x1="12" x2="12" y1="19" y2="22"/><circle cx="12" cy="12" r="7"/>',
  library: '<path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/>',
  filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
  arrowUpDown: '<path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/>',
  grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  fileText: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  penTool: '<path d="m12 19 7-7 3 3-7 7-3-3z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="m2 2 7.586 7.586"/><circle cx="11" cy="11" r="2"/>',
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>'
};
const icon = (name, size = 16) =>
  `<svg class="svg-icon" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;

// ---------------------------------------------------------------- theme (Obsidian default light)
const theme = `
:root{
  --font-interface:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",Roboto,Helvetica,Arial,sans-serif;
  --font-text:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",Roboto,Helvetica,Arial,sans-serif;
  --font-monospace:"SFMono-Regular",Consolas,"Liberation Mono",Menlo,monospace;
  --font-ui-small:13px; --font-ui-smaller:12px; --font-ui-medium:15px; --font-bold:700;
  --background-primary:#ffffff; --background-primary-alt:#ffffff;
  --background-secondary:#f5f6f8; --background-secondary-alt:#eef0f2;
  --background-modifier-border:#e0e0e4; --background-modifier-border-hover:#cfcfd6;
  --background-modifier-hover:rgba(0,0,0,.06); --background-modifier-form-field:#ffffff;
  --text-normal:#2e3338; --text-muted:#5c6169; --text-faint:#9aa0a6;
  --text-accent:hsl(254,80%,68%); --text-accent-hover:hsl(254,80%,60%);
  --text-on-accent:#ffffff; --text-error:#e93147; --text-warning:#c98a00;
  --color-orange:#e7832b;
  --interactive-accent:hsl(254,80%,68%); --interactive-accent-hover:hsl(254,80%,61%);
  --radius-s:4px; --radius-m:8px; --radius-l:12px;
  --size-4-1:4px; --size-4-2:8px; --size-4-3:12px;
  --shadow-s:0 1px 2px rgba(0,0,0,.05),0 1px 5px rgba(0,0,0,.05);
  --shadow-l:0 10px 30px rgba(0,0,0,.2);
  --scrollbar-bg:rgba(0,0,0,.05);
}
*,*::before,*::after{box-sizing:border-box;}
html,body{margin:0;padding:0;}
body{background:#e7e7ea;font-family:var(--font-interface);color:var(--text-normal);-webkit-font-smoothing:antialiased;}
.stage{display:flex;flex-direction:column;gap:40px;padding:40px;align-items:flex-start;width:max-content;}
.shot{background:#e7e7ea;}
.panel-frame{border-radius:10px;overflow:hidden;border:1px solid rgba(0,0,0,.08);box-shadow:0 12px 34px rgba(0,0,0,.14);}
h1,h2,h3,p{margin:0;}

/* ---- mock Obsidian window chrome (context only) ---- */
.ob-window{display:flex;background:var(--background-primary);width:1140px;height:660px;}
.ob-ribbon{width:44px;flex-shrink:0;background:var(--background-secondary);border-right:1px solid var(--background-modifier-border);display:flex;flex-direction:column;align-items:center;gap:4px;padding-top:10px;color:var(--text-faint);}
.ob-ribbon span{width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:6px;}
.ob-ribbon span.is-active{color:var(--interactive-accent);background:color-mix(in srgb,var(--interactive-accent) 12%,transparent);}
.ob-main{display:flex;flex-direction:column;flex:1;min-width:0;position:relative;}
.ob-tabbar{display:flex;align-items:center;gap:6px;background:var(--background-secondary);border-bottom:1px solid var(--background-modifier-border);padding:5px 10px;}
.ob-tab{display:flex;align-items:center;gap:6px;padding:4px 12px;border-radius:6px;font-size:12.5px;color:var(--text-muted);}
.ob-tab.is-active{background:var(--background-primary);color:var(--text-normal);box-shadow:var(--shadow-s);}
.ob-editor{flex:1;padding:34px 56px 34px 72px;font-family:var(--font-text);font-size:16px;line-height:1.75;color:var(--text-normal);position:relative;overflow:hidden;}
.ob-editor h1{font-size:26px;font-weight:700;margin-bottom:20px;letter-spacing:.2px;}
.ob-editor p{margin-bottom:16px;}
.ob-selection{background:color-mix(in srgb,var(--interactive-accent) 32%,transparent);border-radius:2px;}
.editor-line{position:relative;}
.editor-line .aa-gutter-marker{position:absolute;left:-30px;top:7px;margin:0;}

/* ---- mock Obsidian modal shell (plugin only styles .aa-note-*) ---- */
.modal-container{position:absolute;inset:0;z-index:100;display:flex;justify-content:center;}
.modal-container.aa-note-popover{background:rgba(20,20,25,.06);pointer-events:none;}
.modal{background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:var(--radius-l);box-shadow:var(--shadow-l);max-width:480px;width:100%;height:max-content;}
.modal-container.aa-note-popover .modal{pointer-events:auto;position:absolute;}
.modal-title{font-weight:600;font-size:15px;padding:14px 16px 0;}
.modal-title:empty{display:none;}

/* ---- mock Obsidian settings item ---- */
.settings-wrap{width:780px;background:var(--background-primary);padding:26px 34px 34px;}
.settings-wrap h2{font-size:20px;font-weight:700;margin-bottom:8px;}
.settings-wrap h3{font-size:16px;font-weight:600;margin:18px 0 8px;}
.settings-wrap > p{font-size:13px;color:var(--text-muted);line-height:1.6;}
.settings-wrap hr{border:none;border-top:1px solid var(--background-modifier-border);margin:16px 0;}
.setting-item{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:14px 0;}
.setting-item-info{min-width:0;}
.setting-item-name{font-size:15px;font-weight:600;color:var(--text-normal);}
.setting-item-description{font-size:12px;color:var(--text-muted);margin-top:3px;line-height:1.5;}
.ob-dropdown{display:inline-flex;align-items:center;gap:8px;height:32px;padding:0 12px;border-radius:8px;border:1px solid var(--background-modifier-border);background:var(--background-secondary);color:var(--text-normal);font-size:13px;}
.aa-shortcut-list p{font-size:13px;color:var(--text-muted);line-height:1.9;margin:0;}
`;

// ---------------------------------------------------------------- shared fragments
const cardHover = (show) =>
  `<div class="aa-card-hover-actions"${show ? ' style="display:flex"' : ''}>` +
  `<button type="button" aria-label="编辑">${icon('pencil', 15)}</button>` +
  `<button type="button" aria-label="更多">${icon('more', 15)}</button></div>`;

const card = ({ color, quote, note, tags = [], meta, file, title, selected, hover, collapsible }) =>
  `<div class="aa-card aa-reading-card${title ? ' has-title' : ''} is-navigable${selected ? ' is-selected' : ''}" style="--aa-accent:${color}">` +
  (title
    ? `<div class="aa-card-title-row"><span class="aa-card-dot" aria-hidden="true"></span><span class="aa-card-title">${title}</span>${cardHover(hover)}</div>`
    : (hover ? cardHover(true) : cardHover(false))) +
  `<div class="aa-card-text${collapsible ? ' is-collapsible' : ''}">${quote}</div>` +
  (note ? `<div class="aa-card-note">${note}</div>` : '') +
  (tags.length ? `<div class="aa-card-tags">${tags.map((t) => `<span class="aa-card-tag">${t}</span>`).join('')}</div>` : '') +
  (file ? `<div class="aa-card-file">${file}</div>` : '') +
  `<div class="aa-card-meta"><span class="aa-card-meta-label">${meta}</span>` +
  `<button class="aa-card-locate" type="button" aria-label="在原文中定位">${icon('locate', 14)}</button></div>` +
  `</div>`;

const editorContent = `
  <h1>卡片盒笔记法：从收集到产出</h1>
  <p>写作不是从空白页开始，而是从已经积累的卡片开始。好的笔记系统让想法在写作时主动浮现，而不是临时翻找。</p>
  <p>卢曼把一条条想法写成<span class="aa-editor-highlight" style="--aa-accent:#60A5FA">原子化的永久笔记</span>，再用链接把它们编织成网络。笔记的价值不在数量，而在于<span class="aa-editor-highlight" style="--aa-accent:#34D399">彼此之间的连接密度</span>。</p>
  <p class="editor-line"><span class="aa-gutter-marker" style="--aa-accent:#FCD34D"></span>收集只是入口，真正的加工发生在<span class="ob-selection">用自己的话重写一遍</span>的那一刻。</p>
  <p>渐进式总结让我们在回顾时逐层提炼，最终把零散的材料<span class="aa-editor-highlight" style="--aa-accent:#8B5CF6">压缩成可以直接放进草稿的论点</span>。</p>`;

const obWindow = (editorInner, extra = '', height = 660) =>
  `<div class="ob-window" style="height:${height}px">
     <div class="ob-ribbon">
       <span class="is-active">${icon('fileText', 18)}</span>
       <span>${icon('search', 18)}</span>
       <span>${icon('star', 18)}</span>
       <span>${icon('penTool', 18)}</span>
       <span>${icon('settings', 18)}</span>
     </div>
     <div class="ob-main">
       <div class="ob-tabbar"><div class="ob-tab is-active">${icon('fileText', 13)} 读书笔记.md</div><div class="ob-tab">${icon('fileText', 13)} 索引.md</div></div>
       <div class="ob-editor">${editorInner}</div>
       ${extra}
     </div>
   </div>`;

// ---------------------------------------------------------------- scenes
const sceneEditor = `
<div class="shot" id="shot-editor">
  <div class="panel-frame">
    ${obWindow(
      editorContent,
      `<div class="aa-selection-toolbar" style="position:absolute;left:300px;top:256px;">
         <button class="aa-selection-color" type="button" style="--aa-accent:#FCD34D" aria-label="暖黄" title="暖黄"></button>
         <button class="aa-selection-color" type="button" style="--aa-accent:#34D399" aria-label="翠绿" title="翠绿"></button>
         <button class="aa-selection-color is-selected" type="button" style="--aa-accent:#60A5FA" aria-label="蔚蓝" title="蔚蓝"></button>
         <button class="aa-selection-color" type="button" style="--aa-accent:#8B5CF6" aria-label="紫色" title="紫色"></button>
         <button class="aa-selection-comment" type="button">批注</button>
       </div>`,
      370
    )}
  </div>
</div>`;

const sceneNote = `
<div class="shot" id="shot-note">
  <div class="panel-frame" style="position:relative;">
    ${obWindow(editorContent)}
    <div class="modal-container aa-note-popover">
      <div class="modal aa-note-popover-panel" style="width:420px;left:430px;top:250px;">
        <div class="modal-title"></div>
        <div class="modal-content aa-note-modal">
          <div class="aa-note-modal-quote" style="--aa-quote-accent:#60A5FA"><p>原子化的永久笔记</p></div>
          <textarea rows="4" placeholder="在此输入你的想法……">重写不是抄写，而是把材料转成自己的语言，并在这一步拆出可以复用的论点。</textarea>
          <div class="aa-note-tags">
            <span class="aa-note-tag"><span>方法论</span><button type="button" aria-label="移除标签 方法论">×</button></span>
            <button class="aa-note-tag-add" type="button" aria-label="添加标签">+</button>
          </div>
          <div class="aa-note-modal-colors">
            <button class="aa-color-swatch" type="button" style="background:#FCD34D" aria-label="暖黄" title="暖黄"></button>
            <button class="aa-color-swatch" type="button" style="background:#34D399" aria-label="翠绿" title="翠绿"></button>
            <button class="aa-color-swatch is-selected" type="button" style="background:#60A5FA" aria-label="蔚蓝" title="蔚蓝"></button>
            <button class="aa-color-swatch" type="button" style="background:#8B5CF6" aria-label="紫色" title="紫色"></button>
          </div>
          <div class="aa-note-save-hint">Ctrl+Enter 保存；点击外部保存修改，Esc 或取消会丢弃修改。</div>
          <div class="aa-note-save-status" role="status" aria-live="polite"></div>
          <div class="aa-modal-buttons">
            <button class="aa-button aa-button-secondary" type="button">取消</button>
            <button class="aa-button aa-button-primary" type="button">保存 · Ctrl+Enter</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>`;

const sceneSidebar = `
<div class="shot" id="shot-sidebar">
  <div class="panel-frame" style="width:380px;height:660px;">
    <div class="aa-sidebar">
      <div class="aa-sidebar-header">
        <h3>批注</h3>
        <div class="aa-sidebar-header-actions">
          <button type="button" aria-label="更多">${icon('more', 16)}</button>
          <button type="button" aria-label="关闭">${icon('x', 16)}</button>
        </div>
      </div>
      <div class="aa-sidebar-search-row">
        <input class="aa-sidebar-search" type="search" placeholder="搜索批注" autocomplete="off" aria-label="搜索批注">
        <button class="aa-filter-button" type="button" aria-label="筛选" aria-expanded="false">${icon('listFilter', 15)}</button>
      </div>
      <div class="aa-sidebar-tabs">
        <button type="button" class="is-active" aria-pressed="true">全部 4</button>
        <button type="button" aria-pressed="false">批注 3</button>
        <button type="button" aria-pressed="false">仅高亮 1</button>
        <button class="aa-tabs-toggle" type="button" aria-label="筛选" aria-expanded="false">${icon('chevronDown', 14)}</button>
      </div>
      <div class="aa-sidebar-list">
        ${card({ color: '#60A5FA', quote: '原子化的永久笔记', note: '每张卡片只写一个观点，标题自成一句话，方便日后直接引用。', tags: ['方法论', '卡片盒'], meta: 'L12 · 今天 14:32', hover: true })}
        ${card({ color: '#34D399', quote: '彼此之间的连接密度', note: '连接越密，回顾时越容易撞见相关的想法。', meta: 'L18 · 今天 09:10' })}
        ${card({ color: '#FCD34D', quote: '用自己的话重写一遍', meta: 'L24 · 昨天 21:05' })}
        ${card({ color: '#8B5CF6', quote: '渐进式总结让我们在回顾时逐层提炼，最终把零散材料压缩成可以直接放进草稿的论点。', note: '从材料到论点的压缩路径。', tags: ['待整理'], meta: 'L31 · 昨天 18:40', collapsible: true })}
      </div>
    </div>
  </div>
</div>`;

const navToggle = (label, selected) => `<button class="aa-library-path${selected ? ' is-selected' : ''}" type="button" aria-pressed="${selected ? 'true' : 'false'}">${label}</button>`;
const navFile = (label, count, indent) => `<button class="aa-library-path" type="button" style="--aa-indent:${indent}px"><span>${label}</span><span class="aa-library-count">${count}</span></button>`;
const navFolder = (label, count, collapsed) =>
  `<div class="aa-library-folder" style="--aa-indent:8px">
     <button class="aa-library-twist" type="button" aria-expanded="${collapsed ? 'false' : 'true'}" aria-label="${collapsed ? '展开' : '折叠'}">${icon(collapsed ? 'chevronRight' : 'chevronDown', 14)}</button>
     <button class="aa-library-path" type="button"><span>${label}</span><span class="aa-library-count">${count}</span></button>
   </div>`;

const sceneLibrary = `
<div class="shot" id="shot-library">
  <div class="panel-frame" style="width:1180px;height:720px;">
    <div class="aa-library is-comfortable has-detail" style="--aa-detail-width:322px;">
      <div class="aa-library-header">
        <div class="aa-library-title-wrap">
          <span class="aa-library-title-icon">${icon('library', 22)}</span>
          <div class="aa-library-title-text">
            <h3>批注中心</h3>
            <p>管理和回顾你在所有笔记中的高亮与批注</p>
          </div>
        </div>
        <div class="aa-library-header-right">
          <span class="aa-library-total">共 8 条批注</span>
          <button type="button" aria-label="更多">${icon('more', 16)}</button>
        </div>
      </div>
      <div class="aa-library-body">
        <div class="aa-library-nav">
          <div class="aa-library-section-title">文件</div>
          ${navToggle(`<span>全部文件</span><span class="aa-library-count">8</span>`, true)}
          ${navFolder('读书笔记', 5, false)}
          ${navFile('卡片盒笔记法.md', 3, 28)}
          ${navFile('渐进式总结.md', 2, 28)}
          ${navFolder('项目', 3, false)}
          ${navFile('研究报告.md', 3, 28)}
          <div class="aa-library-section-title">标签</div>
          ${navToggle(`<span># 方法论</span><span class="aa-library-count">3</span>`, false)}
          ${navToggle(`<span># 引用</span><span class="aa-library-count">2</span>`, false)}
          ${navToggle(`<span># 待整理</span><span class="aa-library-count">2</span>`, false)}
          <button class="aa-library-path aa-library-more-tags" type="button"><span>更多标签…</span></button>
          <div class="aa-library-section-title">颜色</div>
          <div class="aa-library-colors">
            <button class="aa-filter-swatch" type="button" style="--aa-accent:#FCD34D" aria-label="暖黄"></button>
            <button class="aa-filter-swatch" type="button" style="--aa-accent:#34D399" aria-label="翠绿"></button>
            <button class="aa-filter-swatch" type="button" style="--aa-accent:#60A5FA" aria-label="蔚蓝"></button>
            <button class="aa-filter-swatch" type="button" style="--aa-accent:#8B5CF6" aria-label="紫色"></button>
          </div>
          <div class="aa-library-section-title">时间</div>
          ${navToggle('全部时间', true)}
          ${navToggle('今天', false)}
          ${navToggle('近 7 天', false)}
        </div>
        <div class="aa-library-main">
          <div class="aa-sidebar-search-row">
            <input class="aa-sidebar-search" type="search" placeholder="搜索原文、批注或标签…" autocomplete="off" aria-label="搜索原文、批注或标签…">
            <button class="aa-filter-button aa-filter-text-button" type="button" aria-expanded="false">${icon('filter', 13)}<span>筛选</span></button>
            <button class="aa-sort-button" type="button" aria-expanded="false">${icon('arrowUpDown', 13)}<span>排序: 文档位置</span></button>
            <button class="aa-view-toggle" type="button" aria-label="网格视图">${icon('grid', 13)}</button>
          </div>
          <div class="aa-sidebar-tabs">
            <button type="button" class="is-active" aria-pressed="true">全部 8</button>
            <button type="button" aria-pressed="false">批注 5</button>
            <button type="button" aria-pressed="false">仅高亮 3</button>
          </div>
          <div class="aa-library-content">
            <div class="aa-sidebar-list">
              ${card({ color: '#60A5FA', title: '卡片盒笔记法', quote: '原子化的永久笔记', note: '每张卡片只写一个观点，标题自成一句话，方便日后直接引用。', tags: ['方法论', '卡片盒'], file: '读书笔记/卡片盒笔记法.md', meta: 'L12 · 今天 14:32', selected: true })}
              ${card({ color: '#34D399', title: '卡片盒笔记法', quote: '彼此之间的连接密度', note: '连接越密，回顾时越容易撞见相关的想法。', file: '读书笔记/卡片盒笔记法.md', meta: 'L18 · 今天 09:10' })}
              ${card({ color: '#FCD34D', title: '渐进式总结', quote: '用自己的话重写一遍', file: '读书笔记/渐进式总结.md', meta: 'L24 · 昨天 21:05' })}
              ${card({ color: '#8B5CF6', title: '研究报告', quote: '渐进式总结让我们在回顾时逐层提炼，最终把零散材料压缩成可以直接放进草稿的论点。', note: '从材料到论点的压缩路径。', tags: ['待整理'], file: '项目/研究报告.md', meta: 'L31 · 昨天 18:40', collapsible: true })}
            </div>
            <div class="aa-library-detail" style="--aa-accent:#60A5FA" aria-label="我的批注">
              <div class="aa-detail-header">
                <span class="aa-card-dot" aria-hidden="true"></span>
                <span class="aa-detail-title">卡片盒笔记法</span>
                <div class="aa-detail-actions">
                  <button type="button" aria-label="编辑">${icon('pencil', 14)}</button>
                  <button type="button" aria-label="在原文中定位">${icon('locate', 14)}</button>
                  <button type="button" aria-label="收起详情" title="收起详情">${icon('x', 14)}</button>
                </div>
              </div>
              <div class="aa-detail-path">读书笔记/卡片盒笔记法.md</div>
              <div class="aa-detail-label">原文</div>
              <div class="aa-detail-quote"><p>原子化的永久笔记</p></div>
              <div class="aa-detail-label">我的批注</div>
              <div class="aa-detail-note">每张卡片只写一个观点，标题自成一句话，方便日后直接引用。</div>
              <div class="aa-detail-label">标签</div>
              <div class="aa-note-tags aa-detail-tags">
                <span class="aa-note-tag"><span>方法论</span><button type="button" aria-label="移除标签 方法论">×</button></span>
                <span class="aa-note-tag"><span>卡片盒</span><button type="button" aria-label="移除标签 卡片盒">×</button></span>
                <button class="aa-note-tag-add" type="button" aria-label="添加标签">+</button>
              </div>
              <div class="aa-detail-label">位置信息</div>
              <div class="aa-detail-info">
                <div class="aa-detail-info-row"><span class="aa-detail-info-key">行号</span><span class="aa-detail-info-value">12</span></div>
                <div class="aa-detail-info-row"><span class="aa-detail-info-key">创建时间</span><span class="aa-detail-info-value">今天 14:32</span></div>
                <div class="aa-detail-info-row"><span class="aa-detail-info-key">修改时间</span><span class="aa-detail-info-value">今天 15:07</span></div>
              </div>
              <div class="aa-detail-label">原文上下文</div>
              <div class="aa-detail-context">
                <div class="aa-detail-context-row"><span class="aa-detail-context-line">10</span><span class="aa-detail-context-text">写作不是从空白页开始，而是从已经积累的卡片开始。</span></div>
                <div class="aa-detail-context-row is-highlighted"><span class="aa-detail-context-line">11</span><span class="aa-detail-context-text">卢曼把一条条想法写成原子化的永久笔记，再用链接把它们</span></div>
                <div class="aa-detail-context-row is-highlighted"><span class="aa-detail-context-line">12</span><span class="aa-detail-context-text">编织成网络。笔记的价值不在数量，而在连接的密度。</span></div>
                <div class="aa-detail-context-row"><span class="aa-detail-context-line">13</span><span class="aa-detail-context-text">收集只是入口，真正的加工发生在用自己的话重写的那一刻。</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>`;

const settingItem = (name, desc, control) =>
  `<div class="setting-item"><div class="setting-item-info"><div class="setting-item-name">${name}</div><div class="setting-item-description">${desc}</div></div><div class="setting-item-control">${control}</div></div>`;
const dropdown = (label) => `<div class="ob-dropdown"><span>${label}</span>${icon('chevronDown', 14)}</div>`;
const colorRow = (hex, name) =>
  `<div class="aa-color-row"><span style="display:inline-block;width:24px;height:24px;background:${hex};border-radius:4px;border:1px solid var(--background-modifier-border);"></span>` +
  `<input type="text" value="${hex}" maxlength="7">` +
  `<span style="font-size:12px;color:var(--text-muted);">${name}</span></div>`;

const sceneSettings = `
<div class="shot" id="shot-settings">
  <div class="panel-frame">
    <div class="settings-wrap">
      <h2>笺注 · 关于</h2>
      <p>把光标放在标题或句子上，或先选中文字，再高亮或批注</p>
      <hr>
      ${settingItem('默认高亮颜色', '高亮时默认使用的颜色', dropdown('● 蔚蓝'))}
      <hr>
      ${settingItem('语言', '插件界面语言', dropdown('中文'))}
      <h3>高亮颜色</h3>
      <div class="aa-settings-colors">
        ${colorRow('#FCD34D', '暖黄')}
        ${colorRow('#34D399', '翠绿')}
        ${colorRow('#60A5FA', '蔚蓝')}
        ${colorRow('#8B5CF6', '紫色')}
        <div class="aa-color-row" style="border-top:1px dashed var(--background-modifier-border);padding-top:8px;">
          <span style="display:inline-block;width:24px;height:24px;background:#F472B6;border-radius:4px;border:1px solid var(--background-modifier-border);"></span>
          <input type="text" value="#F472B6" maxlength="7">
          <span style="font-size:12px;color:var(--text-muted);">自定义</span>
        </div>
        <div class="aa-color-row" style="padding:4px 0 8px 32px;">
          <span style="font-size:11px;color:var(--text-muted);min-width:80px;">自定义颜色名称</span>
          <input type="text" value="标记粉" maxlength="12" style="width:120px;font-size:12px;">
        </div>
      </div>
      <hr>
      <h3>快捷键</h3>
      <div class="aa-shortcut-list">
        <p>• 切换批注面板 — Ctrl+Shift+A</p>
        <p>• 打开批注中心 — 未绑定</p>
        <p>• 搜索全部批注 — 未绑定</p>
        <p class="aa-shortcut-hint">💡 可在 Obsidian 设置 → 快捷键 中为上述命令绑定快捷键</p>
      </div>
      <hr>
      <div style="padding:10px 12px;margin:8px 0;border-radius:8px;background:var(--background-secondary);color:var(--text-muted);font-size:12px;line-height:1.6;border:1px solid var(--background-modifier-border);">阅读模式会显示对得上的高亮颜色，不会修改笔记原文。</div>
      <h3>关于</h3>
      <p>笺注 0.4.1 — 为 Markdown 和 PDF 添加高亮与批注，通过侧边栏查看当前文档，通过批注中心跨文档回顾。批注独立保存，不修改原文；将 <strong><code>scholiast/annotations.json</code></strong> 纳入知识库同步即可在多设备共享批注。</p>
    </div>
  </div>
</div>`;

// ---------------------------------------------------------------- capture (one scene per page)
const pageHtml = (scene) =>
  `<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>Scholiast preview</title>` +
  `<style>${theme}</style><style>${pluginCss}</style></head>` +
  `<body><div class="stage">${scene}</div></body></html>`;

const scenes = [
  { file: 'editor-highlight.png', scene: sceneEditor, width: 1220 },
  { file: 'note-composer.png', scene: sceneNote, width: 1220 },
  { file: 'sidebar.png', scene: sceneSidebar, width: 460 },
  { file: 'library.png', scene: sceneLibrary, width: 1260 },
  { file: 'settings.png', scene: sceneSettings, width: 860 }
];

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--force-color-profile=srgb', '--font-render-hinting=none']
});
try {
  for (const { file, scene, width } of scenes) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 900, deviceScaleFactor: 2 });
    await page.setContent(pageHtml(scene), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const outPath = path.join(OUT, file);
    await page.screenshot({ path: outPath, fullPage: true });
    const st = fs.statSync(outPath);
    console.log(file, Math.round(st.size / 1024) + 'KB');
    await page.close();
  }
} finally {
  await browser.close();
}
