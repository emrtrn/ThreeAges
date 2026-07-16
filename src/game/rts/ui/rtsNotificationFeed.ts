/**
 * Notification feed presentation — Vertical Slice Plan v0.2 §51 (Faz 9).
 *
 * The DOM half of {@link RtsNotificationCenter}: it renders `active()` and owns
 * no suppression rules of its own. Keeping the decisions in the pure half is
 * what lets `test:engine` prove §52's "Aynı uyarı sürekli spam oluşturmuyor"
 * without a browser.
 */
import type { RtsNotification } from "./rtsNotifications";

export class RtsNotificationFeed {
  private readonly root = document.createElement("aside");
  private signature = " ";

  constructor() {
    this.root.className = "rts-notification-feed ui-interactive";
    this.root.setAttribute("aria-label", "Bildirimler");
    this.root.setAttribute("aria-live", "polite");
    (document.getElementById("ui-overlay") ?? document.body).appendChild(this.root);
    this.setNotifications([]);
  }

  /**
   * Rebuilds only when the visible set actually changed. The feed is pushed
   * every frame, so the signature is what keeps a persistent warning from
   * rebuilding its own DOM sixty times a second.
   */
  setNotifications(notifications: readonly RtsNotification[]): void {
    const signature = notifications.map((entry) => `${entry.id}:${entry.raises}`).join("|");
    if (signature === this.signature) return;
    this.signature = signature;

    this.root.hidden = notifications.length === 0;
    this.root.replaceChildren(...notifications.map((notification) => {
      const item = document.createElement("p");
      item.className = "rts-notification";
      item.dataset.severity = notification.severity;
      item.dataset.rtsNotification = notification.kind;
      const text = document.createElement("span");
      text.textContent = notification.text;
      item.appendChild(text);
      // "×3" means this problem has been raised three separate times — a
      // recurring failure the player keeps not fixing. A first raise says
      // nothing extra, so it stays silent rather than showing a noisy "×1".
      if (notification.raises > 1) {
        const raises = document.createElement("span");
        raises.className = "rts-notification-repeats";
        raises.textContent = `×${notification.raises}`;
        item.appendChild(raises);
      }
      return item;
    }));
  }

  dispose(): void {
    this.root.remove();
  }
}
