/** 通用确认弹窗：替代原生 confirm，避免阻塞主线程且样式与插件一致。 */
import { type App, Modal } from "obsidian";
import { t } from "./i18n";

export function confirmDialog(app: App, message: string, plugin?: { settings?: { language?: string } }): Promise<boolean> {
  return new Promise((resolve) => {
    const modal = new Modal(app);
    modal.contentEl.createEl("p", { text: message });
    const buttons = modal.contentEl.createDiv("aa-modal-buttons");
    const cancelBtn = buttons.createEl("button", { text: t("ui.cancel", plugin), attr: { type: "button" } });
    cancelBtn.addClass("aa-button", "aa-button-secondary");
    const confirmBtn = buttons.createEl("button", { text: t("ui.confirmAction", plugin), attr: { type: "button" } });
    confirmBtn.addClass("aa-button", "aa-button-primary");
    let confirmed = false;
    confirmBtn.onclick = () => {
      confirmed = true;
      modal.close();
    };
    cancelBtn.onclick = () => modal.close();
    modal.onClose = () => {
      resolve(confirmed);
    };
    modal.open();
  });
}
