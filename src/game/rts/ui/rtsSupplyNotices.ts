/**
 * What the feed says about a trade site — supply plan Faz S5.
 *
 * The severance itself needed no code: Faz S3 already drops the lane when the
 * road breaks, walks the animals home and leaves the shelf where it was. What
 * was missing is that *nothing said so*. A supply lane is the one economic link
 * a player cannot see failing — the Market looks fine, the shelf number simply
 * stops moving, and the cell that broke is somewhere else on the map, possibly
 * in fog.
 *
 * Pure, and separated from {@link RtsApp} for the reason every notification rule
 * in this project is: the decision of *when* a line is news is the part worth
 * pinning, and `test:engine` cannot construct an `RtsApp`. What is left in the
 * app is the loop that samples sites and the memory of what they looked like
 * last frame.
 *
 * The three kinds are not interchangeable and the split is behavioural, not
 * cosmetic — see `rtsNotifications.ts` for their rules:
 *
 * - `supply-linked` fires on the frame goods start moving. A producer built
 *   already-linked is not news, but a trade site's link is *bought* — 84 to 120
 *   wood of road, drawn on purpose — so the moment it pays off is said out loud.
 * - `supply-cut` is polled while the site is stopped, exactly as a producer's cut
 *   is, and only for a site that has fed this kingdom before.
 * - `supply-lost` is one-shot per change of hands. Under KARAR 4-A the road is
 *   what holds a site, so a hand-over is an event with a date rather than a
 *   condition to be re-raised at.
 */
import type { MarketSupplyState } from "../economy/marketSupplySystem";
import type { RtsNotificationRequest } from "./rtsNotifications";
import { t } from "../../localization/LocalizationService";
import { resourceLabel } from "./resourceLabels";

/** The site facts a notice is written from — a subset of `MarketSupplySnapshot`. */
export interface SupplyNoticeSite {
  readonly siteId: string;
  /** Localization key for the site's name; resolved here, where the line is written. */
  readonly nameKey: string;
  readonly resourceId: string;
}

export interface SupplyNotice {
  /** The line to raise, or null when nothing changed worth saying. */
  readonly post: RtsNotificationRequest | null;
  /**
   * Retire a live `supply-cut` for this site before posting.
   *
   * Not a courtesy: the red line and the green one must never sit in the feed
   * together saying opposite things about the same port. Letting the warning
   * lapse on its own display timer would do exactly that for several seconds.
   */
  readonly clearCut: boolean;
}

const NOTHING: SupplyNotice = { post: null, clearCut: false };

/**
 * One site's notice for this frame.
 *
 * @param previous the state this site was in last frame; `undefined` on the
 *   first look, which is why the "first link" wording is the fallback rather
 *   than a case — a site that is already supplying the first time it is sampled
 *   is still news, and there is no earlier state to have restored from.
 * @param everSupplied whether this site has fed this kingdom at some point in
 *   the match. The gate on every bad-news branch, and it does two jobs at once:
 *   the shipped map authors six sites in point-symmetric pairs (§3.7), so
 *   without it the feed would fill with warnings about the opponent's half of
 *   the map — and since a kingdom can only have been supplied by a site it paved
 *   to, it is also what keeps the feed inside what the player has scouted.
 */
export function supplyNotice(
  site: SupplyNoticeSite,
  state: MarketSupplyState,
  previous: MarketSupplyState | undefined,
  everSupplied: boolean,
): SupplyNotice {
  const resource = resourceLabel(site.resourceId);
  const name = t(site.nameKey);
  if (state === "supplying") {
    if (previous === "supplying") return NOTHING;
    return {
      clearCut: true,
      post: {
        kind: "supply-linked",
        subject: site.siteId,
        text: previous === "rival"
          ? t("notification.supply.captured", { site: name, resource })
          : previous === "cut"
            ? t("notification.supply.reconnected", { site: name, resource })
            : t("notification.supply.linked", { site: name, resource }),
      },
    };
  }
  if (!everSupplied) return NOTHING;
  if (state === "rival") {
    if (previous === "rival") return NOTHING;
    return {
      clearCut: false,
      post: {
        kind: "supply-lost",
        subject: site.siteId,
        text: t("notification.supply.lost", { site: name, resource }),
      },
    };
  }
  return {
    clearCut: false,
    post: {
      kind: "supply-cut",
      subject: site.siteId,
      text: t("notification.supply.cut", { site: name, resource }),
    },
  };
}
