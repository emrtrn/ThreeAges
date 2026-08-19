# Three Ages — Localization Glossary

Localization Plan §16's required glossary, produced by Faz 2.

These terms carry the game's design identity and are **not** open to free
translation. The English column is the source text (Plan §3.1); the Turkish
column is the approved term. Both are already shipped — this table is written
from `public/game-data/locales/{en,tr}/`, which stays the single source of
truth. If a term changes there, change it here in the same edit.

For a new language this document is the context pack a translator gets
*before* the string files (Plan §18.1).

## 1. Named entities

Gameplay ids never change with language; they are the stable half of Plan §3.4.
Balance data carries the **key**, never the name (Plan §9) — `nameKey` in
`public/game-data/balance/*.json`, checked at load by `validateGameData.ts`.

| Gameplay ID | Key | English (source) | Turkish (approved) | Definition | Do not use |
| --- | --- | --- | --- | --- | --- |
| `command_center` | `building.command_center.name` | Centre | Merkez | The kingdom's one command building: the first depot, the source of the free road ring and of every centre-led tier upgrade. | Command Center in player-facing text — the UI name is the shorter one. |
| `outpost` | `building.outpost.name` | Outpost | Karakol | A military building whose control radius extends the buildable area, and the only thing that takes a strategic pass. | Watchtower, Tower |
| `depot` | `building.depot.name` | Depot | Depo | A storage building that raises the ceiling deliveries stop at. | Warehouse, Ambar |
| `house` | `building.house.name` | House | Ev | Raises the population cap. | — |
| `farm` | `building.farm.name` | Farm | Tarla | Endless food producer, opened at Centre Lv2. | Field, Çiftlik |
| `windmill` | `building.windmill.name` | Windmill | Değirmen | Food processing building. | — |
| `hunting_camp` | `building.hunting_camp.name` | Hunting Camp | Avcı Kulübesi | Finite food producer worked against wildlife. | Hunter's Lodge |
| `pasture` | `building.pasture.name` | Pasture | Ağıl | Food producer stocked by driving tameable animals into it. | Barn, Corral |
| `lumber_camp` | `building.lumber_camp.name` | Lumber Camp | Oduncu Kampı | Wood producer worked against nearby trees. | Sawmill |
| `quarry` | `building.quarry.name` | Quarry | Taş Ocağı | Stone producer raised on a stone deposit. | Mine |
| `gold_mine` | `building.gold_mine.name` | Gold Mine | Altın Madeni | Gold producer raised on a gold deposit. | — |
| `market` | `building.market.name` | Market | Pazar | Trades one resource for another out of a shelf that caravans fill. | Trading Post, Çarşı |
| `temple` | `building.temple.name` | Temple | Tapınak | Prosperity building. | — |
| `barracks` | `building.barracks.name` | Barracks | Kışla | Trains the Guard and the Siege Gun. | — |
| `archery_range` | `building.archery_range.name` | Archery Range | Okçuluk Alanı | The first military building the Town Age opens; trains the Archer. | — |
| `worker_placeholder` | `unit.worker.name` | Worker | İşçi | Builds, repairs and staffs producers. Never fights. | — |
| `guard_placeholder` | `unit.guard.name` | Guard | Muhafız | Heavy melee unit. | Soldier, Asker |
| `archer_placeholder` | `unit.archer.name` | Archer | Okçu | Light ranged unit. | — |
| `siege_placeholder` | `unit.siege.name` | Siege Gun | Topçu | Heavy ranged unit built to break structures; outranges its escort. | Cannon; Artillery alone |
| `caravan` | `unit.caravan.name` | Pack Donkey | Yük Eşeği | The animal that carries a supply site's goods to the Market. Never selected, never ordered. | Trader; Kervan alone |
| `river_port` | `building.trade_site.river_port.name` | River Port | Nehir Limanı | A map-authored food supply site. | — |
| `timber_camp` | `building.trade_site.timber_camp.name` | Free Timber Camp | Bağımsız Oduncu Kampı | A map-authored wood supply site, independent of the player's own Lumber Camp. | Independent Lumber Camp |
| `stone_pit` | `building.trade_site.stone_pit.name` | Stone Pit | Taş Sahası | A map-authored stone supply site. | — |
| `settlement` | `common.age.settlement.name` | Settlement | Yerleşim | The opening age. Its centre runs Lv1–Lv3. | Village, Köy |
| `town` | `common.age.town.name` | Town | Kasaba | The second age, entered one-way from Settlement Lv3. | City, Şehir |
| `food` | `common.resource.food.name` | Food | Yiyecek | — | — |
| `wood` | `common.resource.wood.name` | Wood | Odun | — | Timber, in resource lines |
| `stone` | `common.resource.stone.name` | Stone | Taş | — | — |
| `gold` | `common.resource.gold.name` | Gold | Altın | The numeraire: everything the Market prices is priced in it. | — |
| `aggressive` | `unit.stance.aggressive` | Free | Serbest | The stance in which a unit chases what it sees. | Aggressive — the UI word is the shorter one. |
| `hold` | `unit.stance.hold` | Hold Position | Pozisyonu Koru | The stance in which a unit does not leave its post. | Guard — that is a unit name. |
| `attack_move` | `unit.order.attack_move` | Attack-move | Saldırı-hareket | The order that walks to a point and engages what it meets. | — |
| `regionalVictory` | `objective.regional_victory.title` | Regional Victory | Bölgesel Zafer | The second win condition: hold both strategic passes together for long enough. | Domination |

## 2. Concepts that appear inside sentences

These have no name key of their own — they are systems the text talks *about*,
and a translator who renders one of them two different ways in two panels has
broken the same rule §16 exists to prevent.

| English (source) | Turkish (approved) | Definition | Where it appears |
| --- | --- | --- | --- |
| Control Area | Kontrol Alanı | The radius around a centre or outpost inside which the kingdom may build, and by which a strategic pass is taken. | Inside sentences: `hud.warning.outside_control`, `selection.outpost.control_radius`. |
| Local Buffer | Yerel Tampon | What a producer holds on site until a caravan takes it. | `selection.producer.buffer`. |
| Global Stock | Global Stok | The kingdom's wallet, shown in the HUD bar. | `hud.resource.income`. |
| External Economy | Dış Ekonomi | Deposits and supply sites outside the starting control area — richer, and contestable. | — |
| Road Network | Yol Ağı | The connected road graph a producer must reach for its harvest to arrive. | `road.hint.*`, `hud.warning.unlinked_road`. |

## 3. Notes for translators

- **Never inflect a placeholder's value inside the pattern.** Turkish case
  suffixes glued to `{building}` were the bug Faz 2 removed, and
  `tools/engine-tests.ts` now refuses them. Rewrite the sentence so the
  placeholder stands alone.
- **Keyboard letters are parameters, not text.** `{key}` comes from the live
  binding table; never spell a letter into a translation.
- **Cost lines are assembled from `common.cost.entry`.** Translate that one
  pattern and every price in the game follows it.
- **A mission card is measured.** `title` <= 40 and `why` <= 110 characters, in
  every language — `test:engine` reads the locale files to check it.
- **Length budget:** Plan §15.1. Assume up to +35% over English.
