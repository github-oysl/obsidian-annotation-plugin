/** 批注文件的读写、旧数据迁移，以及内存里的增删改。 */
import { MarkdownView, Notice } from "obsidian";
import { dispatchAnnotationHistory, type AnnotationHistoryOp } from "./annotation-history";
import {
  ANNOTATION_STORE_DIR,
  ANNOTATION_STORE_FILE,
  DEFAULT_SETTINGS,
  LEGACY_ANNOTATION_STORE_DIR,
  generateId,
  getFileType,
  normalizeAnnotation,
  type AnnotationStoreData,
} from "./annotation-model";
import { getCodeMirror, refreshHighlights } from "./editor-highlights";
import { confirmDialog } from "./confirm";
import { t } from "./i18n";
import type ArticleAnnotator from "./main";
import type { Annotation, AnnotationDraft, AnnotatorSettings, HighlightGroup } from "./types";

export function getAnnotationStorePath(plugin: ArticleAnnotator) {
    return plugin.annotationStorePath;
  }

export function getLegacyAnnotationStorePath(plugin: ArticleAnnotator) {
    return `${LEGACY_ANNOTATION_STORE_DIR}/${ANNOTATION_STORE_FILE}`;
  }

export async function ensureAnnotationStoreDir(plugin: ArticleAnnotator) {
    const adapter = plugin.app.vault.adapter;
    try {
      if (!await adapter.exists(ANNOTATION_STORE_DIR)) {
        await adapter.mkdir(ANNOTATION_STORE_DIR);
      }
    } catch (error) {
      if (!await adapter.exists(ANNOTATION_STORE_DIR)) {
        throw error;
      }
    }
  }

export async function readAnnotationStoreFile(plugin: ArticleAnnotator, filePath: string) : Promise<AnnotationStoreData | null> {
    const adapter = plugin.app.vault.adapter;
    if (!await adapter.exists(filePath)) {
      return null;
    }
    try {
      const raw = await adapter.read(filePath);
      return JSON.parse(raw) as AnnotationStoreData;
    } catch (error) {
      console.error(`Scholiast: failed to read annotation store: ${filePath}`, error);
      new Notice(t("notifications.syncedStoreReadFailed", plugin));
      return null;
    }
  }

export async function readAvailableAnnotationStore(plugin: ArticleAnnotator) {
    const primary = await plugin.readAnnotationStoreFile(plugin.getAnnotationStorePath());
    if (primary) {
      return { data: primary, source: "primary" };
    }
    const legacy = await plugin.readAnnotationStoreFile(plugin.getLegacyAnnotationStorePath());
    if (legacy) {
      return { data: legacy, source: "legacy" };
    }
    return { data: null, source: null };
  }

export function getAnnotationStoreCollections(plugin: ArticleAnnotator, data: AnnotationStoreData | null | undefined) {
    return {
      annotations: Array.isArray(data?.annotations) ? data.annotations.map((item) => normalizeAnnotation(item as AnnotationDraft)).filter((item): item is Annotation => item !== null) : [],
      groups: Array.isArray(data?.groups) ? data.groups as HighlightGroup[] : []
    };
  }

export function hasAnnotationStoreContent(plugin: ArticleAnnotator, data: AnnotationStoreData | null | undefined) {
    const { annotations, groups } = plugin.getAnnotationStoreCollections(data);
    return annotations.length > 0 || groups.length > 0;
  }

export function applyAnnotationStoreData(plugin: ArticleAnnotator, data: AnnotationStoreData | null | undefined) {
    const { annotations, groups } = plugin.getAnnotationStoreCollections(data);
    plugin.data = annotations;
    plugin.groups = groups;
  }

export async function readAnnotationStore(plugin: ArticleAnnotator) {
    const { data } = await plugin.readAvailableAnnotationStore();
    return data;
  }

export async function writeAnnotationStore(plugin: ArticleAnnotator, data: AnnotationStoreData) {
    const adapter = plugin.app.vault.adapter;
    await plugin.ensureAnnotationStoreDir();
    await adapter.write(plugin.getAnnotationStorePath(), JSON.stringify(data, null, 2));
  }

export async function readLegacyPluginData(plugin: ArticleAnnotator): Promise<AnnotationStoreData | null> {
    const legacy = (await plugin.loadData()) as AnnotationStoreData | null;
    return legacy && typeof legacy === "object" ? legacy : null;
  }

export async function writeLegacyPluginData(plugin: ArticleAnnotator, data: object) {
    const local = await plugin.readLegacyPluginData() || {};
    await plugin.saveData({
      ...local,
      ...data
    });
  }

export async function migrateLegacyPluginData(plugin: ArticleAnnotator, settingsFallback: AnnotatorSettings | null = null): Promise<AnnotatorSettings | null> {
    const legacy = await plugin.readLegacyPluginData();
    if (!legacy)
      return settingsFallback || null;
    const migratedAnnotations = Array.isArray(legacy.annotations) ? legacy.annotations as AnnotationDraft[] : [];
    const migratedGroups = Array.isArray(legacy.groups) ? legacy.groups as HighlightGroup[] : [];
    if (migratedAnnotations.length > 0 || migratedGroups.length > 0) {
      await plugin.writeAnnotationStore({
        annotations: migratedAnnotations,
        groups: migratedGroups
      });
      new Notice(t("notifications.annotationsMigrated", plugin));
    }
    const nextSettings = Object.assign({}, settingsFallback || DEFAULT_SETTINGS, legacy.settings || {});
    await plugin.writeLegacyPluginData({ settings: nextSettings });
    return nextSettings;
  }

export async function loadSettingsAndData(plugin: ArticleAnnotator) {
  try {
    const local = await plugin.readLegacyPluginData();
    const hasLocalAnnotationData = plugin.hasAnnotationStoreContent(local);
    plugin.settings = Object.assign({}, DEFAULT_SETTINGS, local?.settings || {});
    // 颜色默认值升级：仍恰好使用旧版默认色板的用户，迁移到黄/绿/蓝/紫四色；自定义过的不受影响。
    const legacyDefaultColors = ["#FCD34D", "#FBBF24", "#F97316", "#EF4444", "#8B5CF6", "#06B6D4"];
    if (JSON.stringify(plugin.settings.colors) === JSON.stringify(legacyDefaultColors))
      plugin.settings.colors = [...DEFAULT_SETTINGS.colors];
    const { data: synced, source } = await plugin.readAvailableAnnotationStore();
    if (!synced) {
      if (hasLocalAnnotationData) {
        const migratedSettings = await plugin.migrateLegacyPluginData(plugin.settings);
        if (migratedSettings) {
          plugin.settings = migratedSettings;
        }
        const migrated = await plugin.readAnnotationStoreFile(plugin.getAnnotationStorePath());
        if (migrated) {
          plugin.applyAnnotationStoreData(migrated);
          return;
        }
      }
      plugin.data = [];
      plugin.groups = [];
      return;
    }
    if (source === "legacy") {
      if (plugin.hasAnnotationStoreContent(synced)) {
        // Only create the new sync file immediately when we are migrating real annotation data.
        await plugin.writeAnnotationStore(synced);
      } else if (hasLocalAnnotationData) {
        const migratedSettings = await plugin.migrateLegacyPluginData(plugin.settings);
        if (migratedSettings) {
          plugin.settings = migratedSettings;
        }
        const migrated = await plugin.readAnnotationStoreFile(plugin.getAnnotationStorePath());
        if (migrated) {
          plugin.applyAnnotationStoreData(migrated);
          return;
        }
      }
    }
    plugin.applyAnnotationStoreData(synced);
  } finally {
    const store = await plugin.readAnnotationStoreFile(plugin.getAnnotationStorePath());
    if (store)
      await forgetLegacyAnnotationCopies(plugin);
  }
}

export async function reloadAnnotationStoreFromVault(plugin: ArticleAnnotator) {
    if (plugin.isReloadingAnnotationStore)
      return;
    plugin.isReloadingAnnotationStore = true;
    try {
      const synced = await plugin.readAnnotationStore();
      plugin.applyAnnotationStoreData(synced);
      plugin.refreshAnnotationViews(plugin.activeFile);
      refreshHighlights(plugin);
      plugin.schedulePdfRender();
    } finally {
      plugin.isReloadingAnnotationStore = false;
    }
  }

/** 批注只留在知识库文件里。插件 data.json 只保留设置，避免两份记录各走各的同步。 */
export async function forgetLegacyAnnotationCopies(plugin: ArticleAnnotator) {
    const local = await plugin.readLegacyPluginData();
    if (!local || (!("annotations" in local) && !("groups" in local)))
      return;
    const next = { ...local };
    delete next.annotations;
    delete next.groups;
    await plugin.saveData(next);
  }

export async function persistAll(plugin: ArticleAnnotator) {
    await plugin.writeAnnotationStore({
      annotations: plugin.data,
      groups: plugin.groups
    });
    await forgetLegacyAnnotationCopies(plugin);
  }

export async function saveAnnotations(plugin: ArticleAnnotator) {
    await plugin.persistAll();
  }

export async function saveSettings(plugin: ArticleAnnotator) {
    await plugin.writeLegacyPluginData({ settings: plugin.settings });
  }

export function getActiveFilePath(plugin: ArticleAnnotator) {
    return plugin.activeFile?.path || null;
  }

export function getAnnotationsForFile(plugin: ArticleAnnotator, filePath: string) {
    return plugin.data.filter((a) => a.filePath === filePath);
  }

export async function addAnnotation(plugin: ArticleAnnotator, annotation: AnnotationDraft | null | undefined) : Promise<Annotation | null> {
    const normalized = normalizeAnnotation(annotation);
    if (!normalized)
      return null;
    plugin.data.push(normalized);
    try {
      await plugin.saveAnnotations();
    } catch (error) {
      plugin.data = plugin.data.filter((item) => item !== normalized);
      throw error;
    }
    plugin.refreshAnnotationViews(plugin.activeFile);
    refreshHighlights(plugin);
    if (normalized.fileType === "pdf")
      plugin.schedulePdfRender(normalized.filePath, 60);
    return normalized;
  }

export async function removeAnnotation(plugin: ArticleAnnotator, id: string, recordHistory = false) {
    const target = plugin.data.find((a) => a.id === id) || null;
    plugin.data = plugin.data.filter((a) => a.id !== id);
    await plugin.saveAnnotations();
    plugin.refreshAnnotationViews(plugin.activeFile);
    refreshHighlights(plugin);
    if (target?.fileType === "pdf")
      plugin.schedulePdfRender(target.filePath, 60);
    if (recordHistory && target)
      plugin.pushAnnotationHistory("remove", target);
  }

export function pushAnnotationHistory(plugin: ArticleAnnotator, type: AnnotationHistoryOp["type"], annotation: Annotation, previous?: Annotation) {
    if (annotation.fileType === "pdf")
      return;
    const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view?.file || view.file.path !== annotation.filePath)
      return;
    const cm = getCodeMirror(view.editor);
    if (!cm)
      return;
    dispatchAnnotationHistory(cm, { type, annotation, previous });
  }

async function replaceAnnotationSnapshot(plugin: ArticleAnnotator, annotation: Annotation) {
    const idx = plugin.data.findIndex((item) => item.id === annotation.id);
    if (idx === -1) {
      await addAnnotation(plugin, annotation);
      return;
    }
    plugin.data[idx] = annotation;
    await plugin.saveAnnotations();
    plugin.refreshAnnotationViews(plugin.activeFile);
    refreshHighlights(plugin);
    if (annotation.fileType === "pdf")
      plugin.schedulePdfRender(annotation.filePath, 60);
  }

export async function applyAnnotationHistory(plugin: ArticleAnnotator, op: AnnotationHistoryOp) {
    if (op.type === "update") {
      await replaceAnnotationSnapshot(plugin, op.annotation);
      return;
    }
    if (op.type === "remove") {
      if (!plugin.data.some((item) => item.id === op.annotation.id))
        return;
      await plugin.removeAnnotation(op.annotation.id, false);
      return;
    }
    if (plugin.data.some((item) => item.id === op.annotation.id))
      return;
    await plugin.addAnnotation(op.annotation);
  }

export async function updateAnnotation(plugin: ArticleAnnotator, id: string, updates: Partial<AnnotationDraft>) {
    const idx = plugin.data.findIndex((a) => a.id === id);
    if (idx === -1)
      return;
    const next = normalizeAnnotation({ ...plugin.data[idx], ...updates, updated: Date.now() });
    if (!next)
      return;
    const previous = plugin.data[idx];
    plugin.data[idx] = next;
    try {
      await plugin.saveAnnotations();
    } catch (error) {
      const currentIndex = plugin.data.indexOf(next);
      if (currentIndex !== -1)
        plugin.data[currentIndex] = previous;
      throw error;
    }
    plugin.refreshAnnotationViews(plugin.activeFile);
    refreshHighlights(plugin);
    if (next.fileType === "pdf")
      plugin.schedulePdfRender(next.filePath, 60);
  }

export async function clearFileAnnotations(plugin: ArticleAnnotator) {
    if (!plugin.activeFile) {
      new Notice(t("notifications.openFileFirst", plugin));
      return;
    }
    const count = plugin.getAnnotationsForFile(plugin.activeFile.path).length;
    if (count === 0) {
      new Notice(t("notifications.noAnnotations", plugin));
      return;
    }
    const msg = t("notifications.clearFileConfirm", plugin).replace("${n}", String(count));
    if (!await confirmDialog(plugin.app, msg, plugin))
      return;
    const activePath = plugin.activeFile.path;
    const activeType = getFileType(plugin.activeFile);
    plugin.data = plugin.data.filter((a) => a.filePath !== activePath);
    await plugin.saveAnnotations();
    plugin.refreshAnnotationViews(plugin.activeFile);
    refreshHighlights(plugin);
    if (activeType === "pdf") {
      plugin.clearPdfHighlightLayers(activePath);
      plugin.schedulePdfRender(activePath, 60);
    }
    new Notice(t("notifications.fileCleared", plugin).replace("${n}", String(count)));
  }

export function getGroupsForFile(plugin: ArticleAnnotator, filePath: string) {
    return plugin.groups.filter((g) => g.filePath === filePath);
  }

export async function addGroup(plugin: ArticleAnnotator, name: string, filePath: string) {
    const group = {
      id: generateId(),
      name,
      filePath,
      collapsed: false,
      order: Date.now(),
      created: Date.now()
    };
    plugin.groups.push(group);
    await plugin.persistAll();
    return group;
  }

export async function removeGroup(plugin: ArticleAnnotator, groupId: string) {
    // 将分组中的批注移出分组
    plugin.data = plugin.data.map((a) => {
      if (a.groupId === groupId) {
        return { ...a, groupId: null };
      }
      return a;
    });
    plugin.groups = plugin.groups.filter((g) => g.id !== groupId);
    await plugin.persistAll();
  }

export async function renameGroup(plugin: ArticleAnnotator, groupId: string, newName: string) {
    const group = plugin.groups.find((g) => g.id === groupId);
    if (!group) return;
    group.name = newName;
    await plugin.persistAll();
  }

export async function updateGroup(plugin: ArticleAnnotator, groupId: string, updates: Partial<HighlightGroup>) {
    const group = plugin.groups.find((g) => g.id === groupId);
    if (!group) return;
    Object.assign(group, updates);
    await plugin.persistAll();
  }

export async function addAnnotationToGroup(plugin: ArticleAnnotator, annotationId: string, groupId: string) {
    const annotation = plugin.data.find((a) => a.id === annotationId);
    if (!annotation) return;
    annotation.groupId = groupId;
    annotation.updated = Date.now();
    await plugin.persistAll();
  }

export async function removeAnnotationFromGroup(plugin: ArticleAnnotator, annotationId: string) {
    const annotation = plugin.data.find((a) => a.id === annotationId);
    if (!annotation) return;
    annotation.groupId = null;
    annotation.updated = Date.now();
    await plugin.persistAll();
  }

export function getAnnotationsForGroup(plugin: ArticleAnnotator, groupId: string) {
    return plugin.data.filter((a) => a.groupId === groupId);
  }
