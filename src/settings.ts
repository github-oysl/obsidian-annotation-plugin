/** 插件设置页：颜色、语言，以及已经绑定的快捷键。 */
import { type App, Notice, PluginSettingTab, Setting } from "obsidian";
import { validateHexColor } from "./annotation-model";
import { formatStoredHotkey, getColorName, t, type StoredHotkey } from "./i18n";
import type ArticleAnnotator from "./main";

export class AnnotatorSettingTab extends PluginSettingTab {
  plugin: ArticleAnnotator;
  constructor(app: App, plugin: ArticleAnnotator) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: t("pluginName", this.plugin) + " · " + t("settings.about", this.plugin) });
    containerEl.createEl("p", {
      text: t("ui.emptyHint", this.plugin)
    });
    containerEl.createEl("hr");
    
    // Default color
    new Setting(containerEl)
      .setName(t("settings.defaultColor", this.plugin))
      .setDesc(t("settings.defaultColorDesc", this.plugin))
      .addDropdown((dropdown) => {
        this.plugin.settings.colors.forEach((color) => {
          dropdown.addOption(color, `● ${getColorName(color, this.plugin)}`);
        });
        dropdown.setValue(this.plugin.settings.defaultColor);
        dropdown.onChange(async (value) => {
          this.plugin.settings.defaultColor = value;
          await this.plugin.saveSettings();
        });
      });
    
    containerEl.createEl("hr");
    new Setting(containerEl)
      .setName(t("settings.language", this.plugin))
      .setDesc(t("settings.languageDesc", this.plugin))
      .addDropdown((dropdown) => {
        dropdown.addOption("zh", "中文");
        dropdown.addOption("en", "English");
        dropdown.setValue(this.plugin.settings.language);
        dropdown.onChange(async (value) => {
          this.plugin.settings.language = value;
          await this.plugin.saveSettings();
          this.display();
        });
      });
    
    containerEl.createEl("h3", { text: t("settings.highlightColors", this.plugin) });
    const colorList = containerEl.createDiv("aa-settings-colors");
    this.plugin.settings.colors.forEach((color, i) => {
      const row = colorList.createDiv("aa-color-row");
      row.style.cssText = "display:flex;align-items:center;gap:8px;margin:4px 0;";
      const swatch = row.createEl("span");
      swatch.style.cssText = `display:inline-block;width:24px;height:24px;background:${color};border-radius:4px;border:1px solid var(--background-modifier-border);`;
      const hexInput = row.createEl("input", {
        attr: { type: "text", value: color, maxlength: "7" }
      });
      hexInput.style.cssText = "width:80px;padding:2px 6px;font-family:monospace;";
      const label = row.createEl("span", {
        text: getColorName(color, this.plugin) || t("settings.custom", this.plugin)
      });
      label.style.cssText = "font-size:12px;color:var(--text-muted);";
      const commitHex = async () => {
        const newColor = hexInput.value.trim();
        if (!/^#[0-9a-fA-F]{6}$/.test(newColor)) {
          new Notice(t("notifications.invalidHex", this.plugin));
          return;
        }
        if (newColor === this.plugin.settings.colors[i])
          return;
        this.plugin.settings.colors[i] = newColor;
        swatch.style.background = newColor;
        await this.plugin.saveSettings();
      };
      hexInput.onchange = () => {
        void commitHex();
      };
      hexInput.addEventListener("keydown", (evt) => {
        if (evt.key === "Enter") {
          evt.preventDefault();
          void commitHex();
        }
      });
    });
    
    // 自定义颜色设置
    const customColorRow = colorList.createDiv("aa-color-row");
    customColorRow.style.cssText = "display:flex;align-items:center;gap:8px;margin:4px 0;padding:8px 0;border-top:1px dashed var(--background-modifier-border);";
    const customSwatch = customColorRow.createEl("span");
    customSwatch.style.cssText = "display:inline-block;width:24px;height:24px;border-radius:4px;border:1px solid var(--background-modifier-border);background:var(--background-secondary);";
    const customHexInput = customColorRow.createEl("input", {
      attr: { type: "text", placeholder: "#FCD34D", maxlength: "7" }
    });
    customHexInput.style.cssText = "width:80px;padding:2px 6px;font-family:monospace;";
    const customLabel = customColorRow.createEl("span", {
      text: t("ui.customColor", this.plugin)
    });
    customLabel.style.cssText = "font-size:12px;color:var(--text-muted);";
    
    // 更新预览色块
    const updateCustomSwatch = () => {
      const value = customHexInput.value.trim();
      if (validateHexColor(value)) {
        customSwatch.style.background = value;
        customSwatch.style.borderColor = value;
      } else {
        customSwatch.style.background = "var(--background-secondary)";
        customSwatch.style.borderColor = "var(--background-modifier-border)";
      }
    };
    
    // 初始化预览
    if (this.plugin.settings.customHighlightColor && validateHexColor(this.plugin.settings.customHighlightColor)) {
      customHexInput.value = this.plugin.settings.customHighlightColor;
      updateCustomSwatch();
    }
    
    // 输入时实时更新预览
    customHexInput.oninput = () => {
      updateCustomSwatch();
    };
    
    // 失去焦点时验证并保存
    const commitCustomColor = async () => {
      const value = customHexInput.value.trim();
      if (value && !validateHexColor(value)) {
        new Notice(t("ui.invalidHexColor", this.plugin));
        customHexInput.value = this.plugin.settings.customHighlightColor || "";
        updateCustomSwatch();
        return;
      }
      if ((this.plugin.settings.customHighlightColor || "") === (value || ""))
        return;
      this.plugin.settings.customHighlightColor = value || "";
      await this.plugin.saveSettings();
      new Notice(value ? t("notifications.customColorSaved", this.plugin) : t("notifications.customColorCleared", this.plugin));
    };
    customHexInput.onblur = () => {
      void commitCustomColor();
    };
    customHexInput.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter") {
        evt.preventDefault();
        void commitCustomColor();
      }
    });
    
    // 自定义颜色名称输入框
    const customNameRow = colorList.createDiv("aa-color-row");
    customNameRow.style.cssText = "display:flex;align-items:center;gap:8px;margin:4px 0;padding:4px 0 8px 32px;";
    const customNameLabel = customNameRow.createEl("span", {
      text: t("ui.customColorName", this.plugin)
    });
    customNameLabel.style.cssText = "font-size:11px;color:var(--text-muted);min-width:80px;";
    const customNameInput = customNameRow.createEl("input", {
      attr: { type: "text", placeholder: "自定义", maxlength: "12" }
    });
    customNameInput.style.cssText = "width:120px;padding:2px 6px;font-size:12px;";
    
    // 初始化名称
    if (this.plugin.settings.customHighlightColorName) {
      customNameInput.value = this.plugin.settings.customHighlightColorName;
    }
    
    // 失去焦点时保存名称
    const commitCustomName = async () => {
      const name = customNameInput.value.trim() || "自定义";
      if (name === this.plugin.settings.customHighlightColorName)
        return;
      this.plugin.settings.customHighlightColorName = name;
      await this.plugin.saveSettings();
      new Notice(t("notifications.customColorNameSaved", this.plugin));
    };
    customNameInput.onblur = () => {
      void commitCustomName();
    };
    customNameInput.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter") {
        evt.preventDefault();
        void commitCustomName();
      }
    });
    
    containerEl.createEl("hr");
    containerEl.createEl("h3", { text: t("settings.shortcuts", this.plugin) });
    const shortcuts = containerEl.createDiv("aa-shortcut-list");
    void this.renderShortcutHints(shortcuts);
    
    containerEl.createEl("hr");
    const readingModeNotice = containerEl.createDiv();
    readingModeNotice.style.cssText = "padding:10px 12px;margin:8px 0;border-radius:8px;background:var(--background-secondary);color:var(--text-muted);font-size:12px;line-height:1.6;border:1px solid var(--background-modifier-border);";
    readingModeNotice.setText(t("settings.readingModeNotice", this.plugin));
    containerEl.createEl("h3", { text: t("settings.about", this.plugin) });
    const aboutEl = containerEl.createEl("p");
    aboutEl.innerHTML = t("settings.aboutText", this.plugin).replace("${version}", this.plugin.manifest.version);
  }
  async renderShortcutHints(container: HTMLElement) {
    const commands: Array<[string, string]> = [
      ["toggle-sidebar", "commands.toggleSidebar"],
      ["export-annotations", "commands.exportAnnotations"],
      ["search-annotations", "commands.searchAnnotations"],
      ["clear-file-annotations", "commands.clearFileAnnotations"],
      ["mobile-highlight-default-color", "commands.mobileHighlight"],
      ["mobile-add-note-to-selection", "commands.mobileAddNote"],
      ["locate-annotation-at-cursor", "commands.locateAtCursor"],
      ["edit-annotation-at-cursor", "commands.editAtCursor"],
      ["delete-annotation-at-cursor", "commands.deleteAtCursor"]
    ];
    let stored: Record<string, unknown> = {};
    try {
      const raw = await this.app.vault.adapter.read(`${this.app.vault.configDir}/hotkeys.json`);
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object")
        stored = parsed as Record<string, unknown>;
    } catch {
      stored = {};
    }
    if (!container.isConnected)
      return;
    container.empty();
    const pluginId = this.plugin.manifest.id;
    for (const [id, nameKey] of commands) {
      const bound = stored[`${pluginId}:${id}`];
      const hotkeys = Array.isArray(bound) ? bound.filter((item): item is StoredHotkey => !!item && typeof item === "object") : [];
      const label = hotkeys.length > 0
        ? hotkeys.map((hotkey) => formatStoredHotkey(hotkey)).join("，")
        : t("settings.notBound", this.plugin);
      container.createEl("p", { text: `• ${t(nameKey, this.plugin)} — ${label}` });
    }
    container.createEl("p", {
      text: t("settings.shortcutsHint", this.plugin),
      cls: "aa-shortcut-hint"
    });
  }
};
