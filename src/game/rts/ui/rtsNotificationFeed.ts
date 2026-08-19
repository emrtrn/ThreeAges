/**
 * Notification feed presentation — Vertical Slice Plan v0.2 §51 (Faz 9).
 *
 * The DOM half of {@link RtsNotificationCenter}: it renders `active()` and owns
 * no suppression rules of its own. Keeping the decisions in the pure half is
 * what lets `test:engine` prove §52's "Aynı uyarı sürekli spam oluşturmuyor"
 * without a browser.
 */
import type { RtsNotification } from "./rtsNotifications";
import { markStaticAria, refreshStaticText } from "./rtsStaticText";

const ICON_BY_KIND: Readonly<Record<RtsNotification["kind"], string>> = {
  "population-full": "⌂",
  "resource-depleted": "⛏",
  "logistics-cut": "⛓",
  "logistics-restored": "✓",
  "supply-linked": "✓",
  "supply-cut": "⛓",
  "supply-lost": "⚑",
  "caravan-destroyed": "⚔",
  "outpost-under-attack": "⚔",
  "center-under-attack": "⚔",
  "worker-under-attack": "⚔",
  "age-upgraded": "✦",
  "enemy-age-upgraded": "✦",
  "regional-victory-warning": "⚑",
  "peace-active": "☮",
  "peace-ending": "⚔",
  "peace-ended": "⚔",
  mission: "✧",
  command: "✓",
  "command-refused": "!",
};

/**
 * Notification imagery deliberately reuses the shipped building icons wherever
 * a physical thing is the subject. The small generated set fills only the
 * abstract-state gaps (route, era, strategic point, and treaty), so the feed
 * speaks the same visual language without duplicating the icon library.
 */
const ICON_SRC_BY_KIND: Readonly<Record<RtsNotification["kind"], string>> = {
  "population-full": "/assets/ui/icons/building-house.png",
  "resource-depleted": "/assets/ui/icons/building-quarry.png",
  "logistics-cut": "/assets/ui/icons/notification_logistics_cut.png",
  "logistics-restored": "/assets/ui/icons/notification_logistics_restored.png",
  // Supply notices borrow the route icons for the two that are about a road, and
  // the Market for the one that is about losing the site itself: what a
  // hand-over costs the player is not a broken road — theirs may be intact — but
  // the buy button at the other end of it going dark.
  "supply-linked": "/assets/ui/icons/notification_logistics_restored.png",
  "supply-cut": "/assets/ui/icons/notification_logistics_cut.png",
  "supply-lost": "/assets/ui/icons/building-market.png",
  "caravan-destroyed": "/assets/ui/icons/notification_logistics_cut.png",
  "outpost-under-attack": "/assets/ui/icons/building-outpost.png",
  "center-under-attack": "/assets/ui/icons/building-command-center.png",
  // The subject here is a person, not a place — the same worker portrait the
  // roster and the build palette already use, so the line is read as "one of
  // yours" at a glance rather than as another building warning.
  "worker-under-attack": "/assets/ui/icons/unit-worker.png",
  "age-upgraded": "/assets/ui/icons/notification_age_up.png",
  "enemy-age-upgraded": "/assets/ui/icons/notification_age_up.png",
  "regional-victory-warning": "/assets/ui/icons/notification_regional_victory.png",
  "peace-active": "/assets/ui/icons/notification_peace.png",
  "peace-ending": "/assets/ui/icons/notification_peace.png",
  "peace-ended": "/assets/ui/icons/notification_peace.png",
  mission: "/assets/ui/icons/notification_age_up.png",
  // A command answer has no one subject — it may be a unit, a building or a
  // trade — so it borrows the two icons that already mean "went through" and
  // "stopped", rather than inventing a third visual language for orders.
  command: "/assets/ui/icons/notification_logistics_restored.png",
  "command-refused": "/assets/ui/icons/notification_logistics_cut.png",
};

export class RtsNotificationFeed {
  private readonly root = document.createElement("aside");
  private signature = " ";

  constructor() {
    // No `ui-interactive`: the feed has no controls, and its stylesheet rule
    // already says "a notice must never swallow a click meant for the map". That
    // rule was dead — `#ui-overlay .ui-interactive` (specificity 1,1,0) beat
    // `.rts-notification-feed` (0,1,0), so the computed value was `auto` and the
    // feed *was* eating map clicks, top-centre, exactly where it appears.
    this.root.className = "rts-notification-feed";
    markStaticAria(this.root, "notification.feed.aria");
    this.root.setAttribute("aria-live", "polite");
    (document.getElementById("ui-overlay") ?? document.body).appendChild(this.root);
    this.setNotifications([]);
  }

  /**
   * §13: the feed's own label. Its notices need nothing — their sentences are
   * resolved by `RtsNotifications` and re-pushed — but the region's
   * `aria-label` is written once, and a screen-reader user is the one player
   * who cannot see that a panel is still announcing itself in the old language.
   */
  retranslate(): void {
    refreshStaticText(this.root);
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
      const icon = document.createElement("span");
      icon.className = "rts-notification-icon";
      icon.setAttribute("aria-hidden", "true");
      const iconImage = document.createElement("img");
      iconImage.src = ICON_SRC_BY_KIND[notification.kind];
      iconImage.alt = "";
      iconImage.decoding = "async";
      // Legacy glyphs remain a robust final fallback if a deployment omits a
      // static asset, but ordinary runtime paths use the image set above.
      iconImage.addEventListener("error", () => {
        iconImage.remove();
        icon.textContent = ICON_BY_KIND[notification.kind];
      }, { once: true });
      icon.appendChild(iconImage);
      const text = document.createElement("span");
      text.className = "rts-notification-text";
      text.textContent = notification.text;
      item.append(icon, text);
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
