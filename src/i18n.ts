/** 界面文案。当前语言来自插件设置。 */
import { Platform } from "obsidian";

// ==================== i18n System ====================
export type LocaleNode = string | { [key: string]: LocaleNode | undefined };

const LANGUAGES: Record<string, LocaleNode> = {
  "en": {
  "pluginName": "Scholiast",
  "commands": {
    "toggleSidebar": "Toggle annotation panel",
    "openLibrary": "Open annotation library",
    "exportAnnotations": "Export current file annotations",
    "searchAnnotations": "Search all annotations",
    "clearFileAnnotations": "Clear current file annotations",
    "mobileHighlight": "Highlight current selection (default color)",
    "mobileAddNote": "Add note to current selection",
    "locateAtCursor": "Locate annotation at cursor",
    "editAtCursor": "Edit annotation at cursor",
    "deleteAtCursor": "Delete annotation at cursor"
  },
  "notifications": {
    "pluginLoaded": "📝 Scholiast loaded",
    "openFileFirst": "Please open a file first",
    "noAnnotations": "No annotations in current file",
    "openEditableNote": "Please open an editable note first",
    "placeCursor": "Place the cursor on a heading or body text.",
    "annotationExists": "⚠️ This area already has an annotation, please delete it first before re-highlighting",
    "annotationSaved": "✅ Annotation saved",
    "confirmDelete": "Are you sure you want to delete this annotation?",
    "fileNotFound": "File not found or has been moved",
    "crossPageNotSupported": "Cross-page selection is not supported. Please select text within the same page.",
    "invalidHex": "Please enter a valid hex color, e.g. #FCD34D",
    "invalidHexColor": "Please enter a valid hex color, e.g. #FCD34D",
    "syncedStoreReadFailed": "Failed to read synced annotations file",
    "annotationsMigrated": "Annotations migrated to vault storage",
    "exportDone": "✅ Exported:",
    "clearFileConfirm": "Are you sure you want to clear all ${n} annotations in the current file?",
    "highlightAdded": "✅ ${color} Highlight added",
    "customColorSaved": "✅ Custom color saved",
    "customColorCleared": "✅ Custom color cleared",
    "customColorNameSaved": "✅ Custom color name saved",
    "fileCleared": "🗑️ Cleared ${n} annotations",
    "cursorMiss": "No annotation or highlight at the cursor",
    "annotationDeleted": "Deleted. Undo to restore it",
    "annotationLocated": "Located this annotation",
    "anchorLost": "This annotation no longer matches the text. It is marked in the sidebar",
    "reassigned": "Rebound to the current selection"
  },
  "ui": {
    "highlight": "Highlight",
    "note": "Note",
    "color": "Color:",
    "placeholder": "Enter your thoughts here...",
    "save": "💾 Save",
    "saveAction": "Save",
    "saveHint": "${shortcut} saves. Clicking outside saves changes; Esc or Cancel discards them.",
    "saving": "Saving…",
    "saveFailed": "Could not save. Your draft is still here; try again.",
    "expandQuote": "Show full quote",
    "collapseQuote": "Collapse quote",
    "backToList": "Back to annotations",
    "hideDetail": "Hide details",
    "resizeDetail": "Resize details",
    "comfortableView": "Comfortable spacing",
    "compactView": "Compact spacing",
    "cardEditHint": "${shortcut} saves, Esc cancels. Clicking elsewhere also saves.",
    "noteComposerTitle": "Write note",
    "close": "Close",
    "edit": "Edit",
    "delete": "Delete",
    "cancel": "Cancel",
    "searchPlaceholder": "Enter keywords to search...",
    "searchHint": "↑↓ chooses a result, Enter opens it",
    "noResults": "No matching annotations.",
    "noData": "No annotation data yet",
    "all": "All",
    "highlights": "Highlights",
    "notes": "Notes",
    "emptyHint": "Place the cursor on a heading or sentence, or select text, then highlight or add a note.",
    "deleteConfirm": "Delete this annotation?",
    "search": "🔍 Search",
    "export": "📤 Export",
    "clear": "🗑️ Clear",
    "navigate": "Navigate",
    "editNote": "Edit note",
    "editNoteTitle": "✏️ Edit note",
    "searchAll": "🔍 Search all annotations",
    "searchResults": "${n} annotations found",
    "clearFileConfirm": "Clear ${n} annotations for the current file?",
    "mobileHighlight": "🔖 Highlight",
    "mobileAddNote": "✏️ Add note",
    "mobileSidebar": "📚 Sidebar",
    "sidebarTitle": "📝 Scholiast",
    "fabAriaLabel": "Scholiast quick actions",
    "customColor": "Custom",
    "customColorDesc": "Custom highlight color (hex)",
    "customColorName": "Custom color name",
    "customColorNameDesc": "Display name for custom color in menu",
    "invalidHexColor": "Please enter a valid hex color, e.g. #FCD34D",
    "locationPage": "Page {page}",
    "locationLine": "Line {line}",
    "pdfAddNote": "✏️ Write note",
    "group": "📦 Group",
    "groupSelected": "Group selected",
    "cancelSelection": "Cancel selection",
    "selectMultiple": "☑️ Multi-select",
    "groupName": "Group name",
    "createGroup": "Create group",
    "renameGroup": "Rename group",
    "groupAssignPrompt": "Group ${n} annotations into:",
    "renameGroupPrompt": "Rename group \"${name}\":",
    "ungroupConfirm": "Remove ${n} annotations from \"${name}\"?",
    "ungrouped": "Ungrouped",
    "reassign": "Reassign",
    "reassignHint": "Select the new sentence in the note, then reassign.",
    "anchorAmbiguous": "This sentence appears more than once",
    "anchorMissing": "The original sentence was not found",
    "anchorFileMissing": "The note file is gone",
    "orphanHeading": "Annotations whose files are gone",
    "ungroup": "Ungroup",
    "collapseGroup": "Collapse group",
    "expandGroup": "Expand group",
    "groupCount": "${n} annotations",
    "sidebarHeading": "Annotations",
    "moreActions": "More actions",
    "searchAnnotationsPlaceholder": "Search annotations",
    "filter": "Filter",
    "tabAll": "All ${n}",
    "tabNotes": "Notes ${n}",
    "tabHighlights": "Highlights ${n}",
    "openLibrary": "Open annotation library",
    "multiSelect": "Multi-select",
    "exportCurrent": "Export annotations in this note",
    "clearCurrent": "Clear annotations in this note",
    "librarySoon": "Annotation library is not ready yet.",
    "changeColor": "Change color",
    "addTag": "Add tag",
    "tagName": "Tag name",
    "copyQuote": "Copy quote",
    "copyNote": "Copy note",
    "copyObsidianLink": "Copy Obsidian link",
    "convertToNote": "Turn into note",
    "copied": "Copied",
    "copyFailed": "Could not copy",
    "noteCreated": "Created a note",
    "noteSource": "Source",
    "emptyReading": "No annotations yet. Select text to add a highlight or a note.",
    "filterEmpty": "Nothing matches the current filters.",
    "clearFilters": "Clear filters",
    "sort": "Sort",
    "sortPosition": "Document position",
    "sortCreated": "Created time",
    "sortUpdated": "Modified time",
    "filterColor": "Color",
    "filterTag": "Tag",
    "notesOnly": "Notes only",
    "tagsOnly": "Tags only",
    "noNoteToCopy": "This highlight has no note text.",
    "libraryTitle": "Annotation library",
    "librarySubtitle": "Review highlights and annotations across your notes",
    "totalCount": "${n} annotations",
    "menuExportAll": "Export all annotations",
    "menuBatchManage": "Batch manage",
    "menuOpenSidebar": "Open annotations for current note",
    "menuSettings": "Settings",
    "menuHelp": "Help docs",
    "searchQuotesPlaceholder": "Search quotes, notes or tags…",
    "sortBy": "Sort: ${n}",
    "viewList": "List view",
    "viewGrid": "Grid view",
    "detailQuote": "Quote",
    "detailNote": "My note",
    "detailNoNote": "No note text",
    "detailTags": "Tags",
    "detailLocation": "Location",
    "detailLine": "Line",
    "detailCreated": "Created",
    "detailUpdated": "Modified",
    "detailContext": "Source context",
    "detailEmpty": "Select an annotation on the left to preview it.",
    "detailNoContext": "Could not read the source note.",
    "locate": "Locate in source note",
    "moreTags": "More tags…",
    "apply": "Apply",
    "resetFilters": "Reset",
    "filterOther": "Other",
    "modified": "Modified",
    "allFiles": "All files",
    "navFiles": "Files",
    "collapseFolder": "Collapse",
    "expandFolder": "Expand",
    "filterTime": "Time",
    "timeAll": "Any time",
    "timeToday": "Today",
    "timeWeek": "Last 7 days",
    "toolbarYellow": "Yellow",
    "toolbarGreen": "Green",
    "toolbarBlue": "Blue",
    "toolbarPurple": "Purple",
    "toolbarComment": "Comment",
    "removeTag": "Remove tag"
  },
  "settings": {
    "defaultColor": "Default highlight color",
    "defaultColorDesc": "Color used when highlighting by default",
    "highlightColors": "Highlight colors",
    "custom": "Custom",
    "shortcuts": "Shortcuts",
    "about": "About",
    "language": "Language",
    "languageDesc": "Interface language for the plugin",
    "shortcutsHint": "💡 Set shortcuts in Obsidian Settings → Hotkeys",
    "notBound": "not bound",
    "readingModeNotice": "Reading mode shows highlights that still match the text. The note file itself is not modified.",
    "aboutText": "Scholiast ${version} — Highlight and annotate Markdown and PDF files. Review annotations in the sidebar or across your vault in the annotation library. Annotations do not modify the source files. Sync <strong><code>scholiast/annotations.json</code></strong> with your vault to share annotations across devices.",
  },
  "colorNames": {
    "#FCD34D": "Warm Yellow",
    "#34D399": "Green",
    "#60A5FA": "Blue",
    "#8B5CF6": "Purple",
    "#FBBF24": "Amber",
    "#F97316": "Orange",
    "#EF4444": "Red",
    "#06B6D4": "Cyan"
  },
  "time": {
    "today": "Today",
    "yesterday": "Yesterday"
  },
  "export": {
    "title": "# 📍 Annotations Export — ${name}\n\n",
    "exportTime": "> Export time: ",
    "totalCount": "> Total annotations: ",
    "items": " items",
    "note": "**Note:** ",
    "location": "*Location: ",
    "fileType": "*File type: ",
    "time": "*Time: ",
    "pdf": "PDF",
    "markdown": "Markdown",
    "fileSuffix": "-annotations-export.md",
    "exportDone": "✅ Exported:"
  }
},
  "zh": {
  "pluginName": "笺注",
  "commands": {
    "toggleSidebar": "切换批注面板",
    "openLibrary": "打开批注中心",
    "exportAnnotations": "导出当前文件批注",
    "searchAnnotations": "搜索全部批注",
    "clearFileAnnotations": "清空当前文件批注",
    "mobileHighlight": "高亮当前选中（默认颜色）",
    "mobileAddNote": "给当前选中写批注",
    "locateAtCursor": "定位光标处的批注或高亮",
    "editAtCursor": "编辑光标处的批注或高亮",
    "deleteAtCursor": "删除光标处的批注或高亮"
  },
  "notifications": {
    "pluginLoaded": "📝 笺注已加载",
    "openFileFirst": "请先打开一个文件",
    "noAnnotations": "当前文件没有批注",
    "openEditableNote": "请先打开一个可编辑的笔记",
    "placeCursor": "请把光标放到要批注的正文或标题上",
    "annotationExists": "⚠️ 该区域已有批注，请先删除再重新标注",
    "annotationSaved": "✅ 批注已保存",
    "confirmDelete": "确定删除这条批注？",
    "fileNotFound": "文件不存在或已被移动",
    "crossPageNotSupported": "跨页选择暂不支持，请在同一页内选择文本",
    "invalidHex": "请输入有效的 hex 颜色，如 #FCD34D",
    "invalidHexColor": "请输入有效的十六进制颜色，如 #FCD34D",
    "syncedStoreReadFailed": "同步批注文件读取失败",
    "annotationsMigrated": "批注已迁移到知识库存储",
    "exportDone": "✅ 已导出：",
    "clearFileConfirm": "确定清空当前文件的 ${n} 条批注？",
    "highlightAdded": "✅ ${color} 高亮已添加",
    "customColorSaved": "✅ 自定义颜色已保存",
    "customColorCleared": "✅ 自定义颜色已清空",
    "customColorNameSaved": "✅ 自定义颜色名称已保存",
    "fileCleared": "🗑️ 已清空 ${n} 条批注",
    "cursorMiss": "光标处没有批注或高亮",
    "annotationDeleted": "已删除，撤销可恢复",
    "annotationLocated": "已定位到这条批注",
    "anchorLost": "这条批注对不上原文，已在侧边栏标出",
    "reassigned": "已重新指定到当前选区"
  },
  "ui": {
    "highlight": "高亮",
    "note": "批注",
    "color": "颜色：",
    "placeholder": "在此输入你的想法……",
    "save": "💾 保存",
    "saveAction": "保存",
    "saveHint": "${shortcut} 保存；点击外部保存修改，Esc 或取消会丢弃修改。",
    "saving": "正在保存…",
    "saveFailed": "保存失败，草稿已保留，请重试。",
    "expandQuote": "展开原文",
    "collapseQuote": "收起原文",
    "backToList": "返回批注列表",
    "hideDetail": "收起详情",
    "resizeDetail": "调整详情宽度",
    "comfortableView": "舒适间距",
    "compactView": "紧凑间距",
    "cardEditHint": "${shortcut} 保存，Esc 取消。点别处也会保存。",
    "noteComposerTitle": "写批注",
    "close": "关闭",
    "edit": "编辑",
    "delete": "删除",
    "cancel": "取消",
    "searchPlaceholder": "输入关键词搜索…",
    "searchHint": "↑↓ 选择结果，Enter 打开",
    "noResults": "没有找到匹配的批注。",
    "noData": "暂无批注数据",
    "all": "全部",
    "highlights": "高亮",
    "notes": "批注",
    "emptyHint": "把光标放在标题或句子上，或先选中文字，再高亮或批注",
    "deleteConfirm": "确定删除这条批注？",
    "search": "🔍 搜索",
    "export": "📤 导出",
    "clear": "🗑️ 清空",
    "navigate": "定位",
    "editNote": "编辑",
    "editNoteTitle": "✏️ 编辑批注",
    "searchAll": "🔍 搜索全部批注",
    "searchResults": "共 ${n} 条批注",
    "clearFileConfirm": "确定清空当前文件的 ${n} 条批注？",
    "mobileHighlight": "🔖 高亮",
    "mobileAddNote": "✏️ 写批注",
    "mobileSidebar": "📚 面板",
    "sidebarTitle": "📝 笺注",
    "fabAriaLabel": "笺注快捷操作",
    "customColor": "自定义",
    "customColorDesc": "自定义高亮颜色（十六进制）",
    "customColorName": "自定义颜色名称",
    "customColorNameDesc": "在菜单中显示的颜色名称",
    "invalidHexColor": "请输入有效的十六进制颜色，如 #FCD34D",
    "locationPage": "第 {page} 页",
    "locationLine": "第 {line} 行",
    "pdfAddNote": "✏️ 写批注",
    "group": "📦 分组",
    "groupSelected": "分组选中",
    "cancelSelection": "取消选择",
    "selectMultiple": "☑️ 多选",
    "groupName": "分组名称",
    "createGroup": "创建分组",
    "renameGroup": "重命名分组",
    "groupAssignPrompt": "将 ${n} 个批注分组到：",
    "renameGroupPrompt": "重命名分组「${name}」：",
    "ungroupConfirm": "确定将「${name}」中的 ${n} 个批注取消分组？",
    "ungrouped": "未分组批注",
    "reassign": "重新指定",
    "reassignHint": "先在正文里选中新的句子，再点重新指定。",
    "anchorAmbiguous": "这篇里有多处相同原文",
    "anchorMissing": "找不到原来的句子",
    "anchorFileMissing": "笔记文件已经不在",
    "orphanHeading": "文件已不在的批注",
    "ungroup": "取消分组",
    "collapseGroup": "折叠分组",
    "expandGroup": "展开分组",
    "groupCount": "${n} 条批注",
    "sidebarHeading": "批注",
    "moreActions": "更多",
    "searchAnnotationsPlaceholder": "搜索批注",
    "filter": "筛选",
    "tabAll": "全部 ${n}",
    "tabNotes": "批注 ${n}",
    "tabHighlights": "仅高亮 ${n}",
    "openLibrary": "打开批注中心",
    "multiSelect": "多选模式",
    "exportCurrent": "导出当前文档批注",
    "clearCurrent": "清除当前文档批注",
    "librarySoon": "批注中心还在做，下一步就会接上。",
    "changeColor": "修改颜色",
    "addTag": "添加标签",
    "tagName": "标签",
    "copyQuote": "复制原文",
    "copyNote": "复制批注",
    "copyObsidianLink": "复制 Obsidian 链接",
    "convertToNote": "转成笔记",
    "copied": "已复制",
    "copyFailed": "复制失败",
    "noteCreated": "已生成笔记",
    "noteSource": "来源",
    "emptyReading": "暂无批注。选中一段文字即可添加高亮或批注。",
    "filterEmpty": "当前筛选条件下没有内容。",
    "clearFilters": "清除筛选",
    "sort": "排序",
    "sortPosition": "文档位置",
    "sortCreated": "创建时间",
    "sortUpdated": "修改时间",
    "filterColor": "颜色",
    "filterTag": "标签",
    "notesOnly": "仅有批注",
    "tagsOnly": "仅有标签",
    "noNoteToCopy": "这条高亮没有批注文字",
    "libraryTitle": "批注中心",
    "librarySubtitle": "管理和回顾你在所有笔记中的高亮与批注",
    "totalCount": "共 ${n} 条批注",
    "menuExportAll": "导出全部批注",
    "menuBatchManage": "批量管理",
    "menuOpenSidebar": "打开当前文档批注",
    "menuSettings": "设置",
    "menuHelp": "帮助文档",
    "searchQuotesPlaceholder": "搜索原文、批注或标签…",
    "sortBy": "排序: ${n}",
    "viewList": "列表视图",
    "viewGrid": "网格视图",
    "detailQuote": "原文",
    "detailNote": "我的批注",
    "detailNoNote": "暂无批注文字",
    "detailTags": "标签",
    "detailLocation": "位置信息",
    "detailLine": "行号",
    "detailCreated": "创建时间",
    "detailUpdated": "修改时间",
    "detailContext": "原文上下文",
    "detailEmpty": "点击左侧卡片查看批注详情。",
    "detailNoContext": "无法读取原文笔记。",
    "locate": "在原文中定位",
    "moreTags": "更多标签…",
    "apply": "应用",
    "resetFilters": "清空",
    "filterOther": "其他",
    "modified": "修改",
    "allFiles": "全部文件",
    "navFiles": "文件",
    "collapseFolder": "折叠",
    "expandFolder": "展开",
    "filterTime": "时间",
    "timeAll": "全部时间",
    "timeToday": "今天",
    "timeWeek": "近 7 天",
    "toolbarYellow": "黄色",
    "toolbarGreen": "绿色",
    "toolbarBlue": "蓝色",
    "toolbarPurple": "紫色",
    "toolbarComment": "批注",
    "removeTag": "移除标签"
  },
  "settings": {
    "defaultColor": "默认高亮颜色",
    "defaultColorDesc": "高亮时默认使用的颜色",
    "highlightColors": "高亮颜色",
    "custom": "自定义",
    "shortcuts": "快捷键",
    "about": "关于",
    "language": "语言",
    "languageDesc": "插件界面语言",
    "shortcutsHint": "💡 可在 Obsidian 设置 → 快捷键 中为上述命令绑定快捷键",
    "notBound": "未绑定",
    "readingModeNotice": "阅读模式会显示对得上的高亮颜色，不会修改笔记原文。",
    "aboutText": "笺注 ${version} — 为 Markdown 和 PDF 添加高亮与批注，通过侧边栏查看当前文档，通过批注中心跨文档回顾。批注独立保存，不修改原文；将 <strong><code>scholiast/annotations.json</code></strong> 纳入知识库同步即可在多设备共享批注。",
  },
  "colorNames": {
    "#FCD34D": "暖黄",
    "#34D399": "翠绿",
    "#60A5FA": "蔚蓝",
    "#8B5CF6": "紫色",
    "#FBBF24": "琥珀",
    "#F97316": "橙色",
    "#EF4444": "赤红",
    "#06B6D4": "青色"
  },
  "time": {
    "today": "今天",
    "yesterday": "昨天"
  },
  "export": {
    "title": "# 📍 批注导出 — ${name}\n\n",
    "exportTime": "> 导出时间：",
    "totalCount": "> 批注总数：",
    "items": " 条",
    "note": "**批注：** ",
    "location": "*位置：",
    "fileType": "*类型：",
    "time": "*时间：",
    "pdf": "PDF",
    "markdown": "Markdown",
    "fileSuffix": "-批注导出.md",
    "exportDone": "✅ 已导出："
  }
}
};

function readLocale(node: LocaleNode | undefined, key: string): LocaleNode | undefined {
  if (!node || typeof node === "string") {
    return undefined;
  }
  return node[key];
}

export function t(key: string, plugin?: { settings?: { language?: string } }): string {
  const lang = plugin?.settings?.language || "zh";
  const keys = key.split(".");
  let result: LocaleNode | undefined = LANGUAGES[lang];
  for (let i = 0; i < keys.length; i++) {
    const keyPart = keys[i];
    if (keyPart === undefined) {
      return key;
    }
    const next = readLocale(result, keyPart);
    if (next !== undefined) {
      result = next;
    } else {
      result = LANGUAGES.zh;
      for (let j = i; j < keys.length; j++) {
        const fallbackKey = keys[j];
        if (fallbackKey === undefined) {
          return key;
        }
        const fallbackNext = readLocale(result, fallbackKey);
        if (fallbackNext !== undefined) {
          result = fallbackNext;
        } else {
          return key;
        }
      }
      return typeof result === "string" ? result : key;
    }
  }
  return typeof result === "string" ? result : key;
}

/** 弹窗和侧边栏里显示的保存快捷键。Mac 用 ⌘↩，其他系统用 Ctrl+Enter。 */
export function chordLabel(): string {
  return Platform.isMacOS ? "⌘↩" : "Ctrl+Enter";
}

export interface StoredHotkey {
  modifiers?: string[];
  key?: string;
}

export function formatStoredHotkey(hotkey: StoredHotkey): string {
  const mods = (hotkey.modifiers ?? []).map((mod) => {
    if (mod === "Mod")
      return Platform.isMacOS ? "⌘" : "Ctrl";
    if (mod === "Shift")
      return Platform.isMacOS ? "⇧" : "Shift";
    if (mod === "Alt")
      return Platform.isMacOS ? "⌥" : "Alt";
    if (mod === "Meta")
      return Platform.isMacOS ? "⌘" : "Win";
    if (mod === "Ctrl")
      return "Ctrl";
    return mod;
  });
  const rawKey = hotkey.key ?? "";
  const prettyKey = rawKey.length === 1 ? rawKey.toUpperCase() : rawKey;
  if (Platform.isMacOS)
    return `${mods.join("")}${prettyKey}`;
  return [...mods, prettyKey].filter((part) => part.length > 0).join("+");
}

export function getColorName(color: string, plugin?: { settings?: { language?: string; customHighlightColor?: string; customHighlightColorName?: string } }): string {
  const custom = plugin?.settings?.customHighlightColor;
  const customName = plugin?.settings?.customHighlightColorName?.trim();
  if (custom && custom.toLowerCase() === color.toLowerCase() && customName)
    return customName;
  const lang = plugin?.settings?.language || "zh";
  const names = readLocale(LANGUAGES[lang], "colorNames");
  const name = names && typeof names !== "string" ? names[color.toUpperCase()] : undefined;
  return typeof name === "string" ? name : color;
}
