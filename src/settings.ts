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

    new Setting(containerEl).setName(t("settings.highlightColors", this.plugin)).setHeading();
    const colorList = containerEl.createDiv("aa-settings-colors");
    this.plugin.settings.colors.forEach((color, i) => {
      const row = colorList.createDiv("aa-color-row");
      const swatch = row.createSpan("aa-color-preview");
      swatch.setCssProps({ "--aa-color": color });
      const hexInput = row.createEl("input", {
        attr: { type: "text", value: color, maxlength: "7" }
      });
      row.createSpan({
        cls: "aa-color-name",
        text: getColorName(color, this.plugin) || t("settings.custom", this.plugin)
      });
      const commitHex = async () => {
        const newColor = hexInput.value.trim();
        if (!/^#[0-9a-fA-F]{6}$/.test(newColor)) {
          new Notice(t("notifications.invalidHex", this.plugin));
          return;
        }
        if (newColor === this.plugin.settings.colors[i])
          return;
        this.plugin.settings.colors[i] = newColor;
        swatch.setCssProps({ "--aa-color": newColor });
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
    const customColorRow = colorList.createDiv("aa-color-row is-custom");
    const customSwatch = customColorRow.createSpan("aa-color-preview");
    const customHexInput = customColorRow.createEl("input", {
      attr: { type: "text", placeholder: "#123456", maxlength: "7" }
    });
    customColorRow.createSpan({
      cls: "aa-color-name",
      text: t("ui.customColor", this.plugin)
    });

    // 更新预览色块
    const updateCustomSwatch = () => {
      const value = customHexInput.value.trim();
      const color = validateHexColor(value) ? value : "var(--background-secondary)";
      customSwatch.setCssProps({ "--aa-color": color });
    };

    // 初始化预览
    if (this.plugin.settings.customHighlightColor && validateHexColor(this.plugin.settings.customHighlightColor)) {
      customHexInput.value = this.plugin.settings.customHighlightColor;
    }
    updateCustomSwatch();

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
    const customNameRow = colorList.createDiv("aa-color-row is-custom-name");
    customNameRow.createSpan({
      cls: "aa-color-name is-small",
      text: t("ui.customColorName", this.plugin)
    });
    const customNameInput = customNameRow.createEl("input", {
      attr: { type: "text", placeholder: "自定义", maxlength: "12" }
    });

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
    new Setting(containerEl).setName(t("settings.shortcuts", this.plugin)).setHeading();
    const shortcuts = containerEl.createDiv("aa-shortcut-list");
    void this.renderShortcutHints(shortcuts);

    containerEl.createEl("hr");
    const readingModeNotice = containerEl.createDiv("aa-reading-mode-notice");
    readingModeNotice.setText(t("settings.readingModeNotice", this.plugin));
    new Setting(containerEl).setName(t("settings.about", this.plugin)).setHeading();
    const aboutEl = containerEl.createEl("p");
    aboutEl.setText(t("settings.aboutText", this.plugin).replace("${version}", this.plugin.manifest.version));
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
}
