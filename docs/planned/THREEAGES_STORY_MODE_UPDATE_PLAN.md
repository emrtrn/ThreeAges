# Üç Çağ — Hikâye Modu Güncelleme Öneri Raporu

> **Belge türü:** Durum analizi + güncelleme planı
> **Sürüm:** v1.0
> **Tarih:** 16 Ağustos 2026
> **Kapsam:** `frontier_road` görev zinciri, `src/game/rts/tutorial/*`, zincirin bugünkü
> oyun mekanikleriyle uyumu
> **İlgili kaynaklar:** `public/game-data/missions/frontier_road.json`,
> `src/game/rts/tutorial/`, `docs/planned/THREEAGES_RTS_MARKET_SUPPLY_PLAN.md` (silinmiş,
> geçmişi git'te), `docs/architecture/UNREAL_BASICS_LESSONS.md`

---

## 1. Yönetici özeti

Hikâye modunun **mimarisi sağlam**: saf tahmin fonksiyonları (`missionPredicates.ts`),
dünyadan türeyen durum makinesi (`missionDirector.ts`), veriden okunan zincir
(`frontier_road.json`), inşa temposu kuralı (`missionBuildPolicy.ts`) ve saf işaretçi
kararı (`missionGuideHighlight.ts`). Bu katmanların hiçbirinde yapısal bir sorun yok;
öneriler bu mimariyi **değiştirmiyor, besliyor**.

Sorun **içerik ve senkronizasyon**: zincirin son gerçek düzenlemesi **28 Temmuz 2026**,
bugün **16 Ağustos 2026**. Aradaki ~200 commit oyunun ekonomi, lojistik, askerî ve UI
katmanlarını yeniden şekillendirdi. Zincir bu değişimlerin hiçbirini görmüyor.

En kritik sonuç tek cümlede: **`buy_wood` adımı bugün oyuncuyu kilitleyebilir.** Pazar'dan
alım artık **market stoku** ister, stok yalnızca **yola bağlı bir ticaret noktasından
gelen kervanla** dolar, ve zincirde o yolu çektiren tek bir adım yok. Zincir oyuncuya
basılamayacak bir düğmeyi işaret ediyor.

---

## 2. Bugünkü hikâye modu — envanter

### 2.1 Kod yüzeyi

| Dosya | Rol | Son değişiklik |
|---|---|---|
| [missionScript.ts](src/game/rts/tutorial/missionScript.ts) | Şema: `MissionGoal` kapalı birleşim, `MissionGuide` | 31 Tem 2026 |
| [missionPredicates.ts](src/game/rts/tutorial/missionPredicates.ts) | Hedef başına bir saf yüklem + `MissionWorldSnapshot` | 31 Tem 2026 |
| [missionDirector.ts](src/game/rts/tutorial/missionDirector.ts) | "İlk yanlış yüklem = aktif adım" durum makinesi | 27 Tem 2026 |
| [missionBuildPolicy.ts](src/game/rts/tutorial/missionBuildPolicy.ts) | İnşa temposu (tek seferde bir tane / kota) | 31 Tem 2026 |
| [missionGuideHighlight.ts](src/game/rts/tutorial/missionGuideHighlight.ts) | Hangi kontrolün nabzı atacak | 31 Tem 2026 |
| [missionHintView.ts](src/game/rts/tutorial/missionHintView.ts) | Dünyadaki ok işaretçisi | 31 Tem 2026 |
| [missionModeChoice.ts](src/game/rts/tutorial/missionModeChoice.ts) | `story` / `free` seçimi + `seen` biti | 27 Tem 2026 |
| [rtsMissionPanel.ts](src/game/rts/ui/rtsMissionPanel.ts) | Görev kartı | 28 Tem 2026 |
| [frontier_road.json](public/game-data/missions/frontier_road.json) | 17 adımlık zincir | 28 Tem 2026 (7 Ağu'daki commit içerik değiştirmedi) |

### 2.2 Zincirin bugünkü hâli (17 adım)

`wood_flowing` → `food_flowing` → `first_depot` → `market` → `buy_wood` → `center_lv2`
→ `houses` → `train_workers` → `second_lumber_camp` → `second_farm` → `outpost`
→ `quarry` → `gold_mine` → `barracks` → `guards` → `town` → `raze`

Kapsadığı mekanikler: üretici–yol–depo lojistiği, depo kapasitesi, Pazar alım/satım,
Merkez seviyesi, nüfus tavanı, işçi üretimi, kontrol alanı/karakol, taş & altın, kışla,
asker eğitimi, çağ geçişi, düşman yapısı yıkma.

### 2.3 Zincirin dokunmadığı yer

Zincir hiçbir adımda **yolu birinci sınıf bir konu yapmıyor**. `guide` şemasında yol için
bir aksiyon türü yok; `missionGuideHighlight` yol aracını yalnızca bir **geri düşüş**
olarak gösteriyor (bağlantı ölçen bir hedefte bina zaten dikilmişse). Oysa yol bugün
oyunun ekonomi, arz ve toprak sisteminin ortak omurgası ve hücre başına 4 odun.

---

## 3. Mekanik farkı — 28 Temmuz'dan bugüne

Zincirin donduğu tarihten sonra gelen, **oyuncunun ekranında olan** mekanikler:

| Mekanik | Geldiği tarih | Zincirde? | Sonuç |
|---|---|---|---|
| **Market stoku + ticaret noktaları + kervan arzı** | 4–7 Ağu | ❌ | **`buy_wood` kilitlenebilir** (bkz. K1) |
| Ticaret noktası seçimi & arz paneli (S5/S6) | 5 Ağu | ❌ | Haritadaki 6 nokta anlamsız kalıyor |
| Ağıl + evcil hayvan ekonomisi (`pasture`) | 3 Ağu | ❌ | İkinci yiyecek yolu görünmez |
| Değirmen + üretim komşuluğu (`windmill`, x2 tarla) | 11 Ağu | ❌ | Yerleşim Lv3'ün ödülü öğretilmiyor |
| Tapınak + destek aurası (şifa/direnç) | 27 Tem → 12 Ağu | ❌ | Askerî katmanın tek destek yapısı |
| Okçuluk Alanı + Okçu (Kasaba çağı) | 8–12 Ağu | ❌ | Zincir tam bu kapının önünde bitiyor |
| Topçu + mürettebat sistemi | 8–13 Ağu | ❌ | Kuşatma katmanı hiç anlatılmıyor |
| Formasyonlar + toplu seçim paneli | 10–13 Ağu | ❌ | Ordu kontrolü öğretilmiyor |
| Yırtıcılar (kurt), hayvan misillemesi | 3–4 Ağu | ❌ | Avcı adımında tehdit uyarısı yok |
| Onarım (`repair`) | 31 Tem → 9 Ağu | ❌ | Hasar sonrası tek çare |
| Manuel işçi ataması + otomasyon anahtarı (`R`) | ~1 Ağu | ❌ | `train_workers` adımının devamı yok |
| Duruş (`H` bekle / `G` saldırgan), geri çekilme (`T`) | 27 Tem–2 Ağu | ❌ | `guards` adımı yalnızca eğitmeyi öğretiyor |
| Boştaki işçileri seç (`I`), Merkez'e odaklan (`Home`) | ~1 Ağu | ❌ | — |
| Ordu listesi şeridi (HUD) | 30–31 Tem | ❌ | — |
| Ana menü + savaş kurulum kartı (sis/zafer/zorluk) | 8 Ağu | Kısmen | Hikâye modu bu satırlarla ilişkisiz seçiliyor |
| Sis (fog of war) seçimi | 18 Tem → 3 Ağu | ❌ | Keşif hiç anlatılmıyor |

**Zincirin kapsadığı 17 adımın karşısında, öğretilmeyen en az 16 oyuncu mekaniği var.**
Hikâye modu artık oyunun yarısını anlatıyor.

---

## 4. Kritik bulgular

### K1 — `buy_wood` adımı oyuncuyu kilitleyebilir *(en yüksek öncelik)*

**Kanıt zinciri:**

1. `buildings.json` → `market.market.stocked: ["food", "wood", "stone"]`
2. [marketTradeSystem.ts:175-178](src/game/rts/economy/marketTradeSystem.ts#L175-L178) —
   stok bir lottan azsa `buy()` **`out-of-stock`** döner, cüzdana dokunmaz.
3. Stoku artıran **tek** çağrı:
   [marketSupplySystem.ts:382](src/game/rts/economy/marketSupplySystem.ts#L382) — kervan
   teslimatı. Satış stoku beslemez (KARAR 7-A), maç açılışında tohumlama yok.
4. Kervan ancak oyuncunun Pazar'ı ile bir ticaret noktası **aynı yol ağındaysa** yola çıkar.
5. `frontier_road.json`'da ticaret noktasına yol çektiren adım **yok**.
6. `missionGuideHighlight` `market-bought` hedefinde Pazar'ın `trade-buy:wood` düğmesini
   işaret ediyor — yani **oyuncuya reddedilecek bir düğmeyi bastırıyor**.

**Maliyet ölçüsü (kaba, L şeklinde yol; oyun içi ölçüm gerekir):** Oyuncu Merkez'i
`(-40, 40)`; `player_timber_camp` `(-8, 50)` → ~21 hücre → **~84 odun**.
`player_stone_pit` `(-28, 6)` → ~23 hücre → **~92 odun**. `player_river_port`
`(3.6, 19.3)` → ~32 hücre → **~128 odun**. Pazar'ın kendisi 20 odun. Yani zincirin
5. adımının gerçek bedeli, söylenen bedelin **4–6 katı** ve hiçbir yerde yazmıyor.

> Not: `RTS_BLOCKOUT_MAP` ve `RTS_CoreMatch` haritalarında hiç ticaret noktası yok —
> hikâye zinciri o haritalarda oynanırsa adım **kalıcı olarak** kapalı. Bugünkü
> `defaultScene` (`RTS_GameplayProof.level.json`) altı noktayı da barındırıyor, ama zincir
> bunu hiçbir yerde şart koşmuyor.

### K2 — Hikâye turu varsayılan olarak **Zor** rakiple açılıyor

`gameplay_proof.json` → `"aiProfile": "hard"`.
[aiProfileChoice.ts:82-87](src/game/rts/match/aiProfileChoice.ts#L82-L87) →
`chosen ?? presetProfile ?? DEFAULT`. İlk kez oynayan oyuncunun kayıtlı seçimi yok, yani
**preset kazanıyor**: modu ilk kez gören oyuncu, oyunun en hızlı tepki veren ve ekonomi
avantajı alan rakibiyle başlıyor. Kurulum kartı iki satırı bağımsız sunuyor; hiçbir yerde
"hikâye turu + zor" kombinasyonunun anlamı söylenmiyor.

### K3 — Bölgesel zafer hikâye modunda tamamen kapalı

[main.ts:386](src/main.ts#L386) — `!missionScript && regionalVictoryChosen`.
[RtsApp.ts:1375-1393](src/game/rts/RtsApp.ts#L1375-L1393) — bayrak kapalıysa
`StrategicPointSystem`, `RegionalVictorySystem`, `StrategicPointView` ve
`RtsObjectiveTracker` **null**. Yani hikâye turunda haritadaki iki stratejik geçit
(`west_pass`, `east_pass`) görünmez ve işlevsiz. Gerekçe savunulabilir (zincir maçın
hedefini sahiplenir), ama sonuç şu: **modu öğrenmek için seçen oyuncu, oyunun ikinci
zafer koşulunu hiç görmüyor.**

### K4 — Yol, zincirde birinci sınıf bir konu değil

`MissionGuideAction` yalnızca `build` ve `structure-action` biliyor. Yol aracı ancak
`producer-linked` / `outpost-connected` hedefinde kota dolduğunda geri düşüş olarak
işaret ediliyor. Ticaret noktasına yol, uzak yatağa yol, kesilmiş yolu onarma — hiçbiri
hedeflenebilir değil. Yol bugün oyunun **en pahalı ve en belirleyici** kararı.

### K5 — İnşa temposu kuralı tüm bina türlerine uygulanıyor

[missionBuildPolicy.ts:89](src/game/rts/tutorial/missionBuildPolicy.ts#L89) — `pending > 0`
kontrolü aktif adımın binasıyla sınırlı değil; **istenen** bina türüyle sınırlı. Yani
zincir boyunca (17 adım, Kasaba çağına kadar) oyuncu aynı türden iki binayı **hiçbir zaman**
paralel dikemiyor. Erken oyunda doğru bir fren; `houses`/`second_farm` sonrası yalnızca
sürtünme. Kural adım kapsamına daraltılmalı.

### K6 — `why` metinlerinde donmuş sayılar

`second_lumber_camp.why`: *"Çağ geçişi **500 odun** ister"* — `ages.json` → Kasaba
`{food: 400, wood: 400, stone: 200, gold: 100}`. Sayı yanlış.

Bu, CLAUDE.md'nin "denge verisi ayarlanabilir olmalı" kuralının metin tarafındaki hâli:
**`why` cümleleri büyüklük alıntılamamalı**, ilişki anlatmalıdır ("tek kamp çağ geçişini
tek başına fonlayamaz"). `market.why`'daki "Pazar 20 odun" şu an doğru ama aynı tuzağı
taşıyor.

### K7 — Yeni kadro zincirin tamamen dışında

Tapınak, Değirmen, Ağıl, Okçuluk Alanı, Okçu, Topçu (+ mürettebat) — hiçbiri anılmıyor.
Zincir `town` adımıyla Kasaba çağını açıp hemen `raze` ile bitiyor; yani **Kasaba çağının
kilidini açtığı her şeyi oyuncuya göstermeden kapanıyor.**

### K8 — Ordu kontrolü öğretilmiyor

`intro` yalnızca *"Sağ tık: birlik gönder · WASD: haritayı gez"* diyor. Bugün mevcut olan
ve hiçbir yerde anlatılmayan komutlar: `X` dur, `F` saldır-yürü, `H` bekle,
`G` saldırgan, `T` geri çekil, `I` boştaki işçiler, `R` işçi otomasyonu, `Home` merkeze
dön, `B` inşa paleti, `1-4` kategoriler. Ayrıca formasyon paneli ve grup seçim kartları.

### K9 — Avcı adımı bugün tehlikeli, ama zincir bunu söylemiyor

`food_flowing` oyuncuyu geyiklerin yanına gönderiyor. Haritada `west-wolves` `(-53.5, -13.2)`
ve `east-wolves` `(28, 6)` sürüleri var, yırtıcı sistemi ve hayvan misillemesi çalışıyor
(`predatorSystem.ts`, `wildlifeRetaliation.ts`). Zincir ne uyarıyor ne de savunmayı
o noktaya bağlıyor.

### K10 — Motor testi zinciri "tamamlanabilir" sayıyor, ama dünyayı okumadan

[engine-tests.ts:45085-45150](tools/engine-tests.ts#L45085) — zincirin tamamlanabilirliği
**nesne değişmezlerinden kurulmuş bir fikstür dünyada** kanıtlanıyor. Fikstürde
`marketPurchases: { wood: 100 }` doğrudan yazılı; market stokunun bunu mümkün kılıp
kılmadığı sorulmuyor. Aynı boşluk `razedEnemyBuildings: { outpost: 1 }` için de geçerli:
son adım, AI'ın gerçekten karakol dikmesine bağlı (`aiExpansionManager` diker, ama bu
zincirin garantisi değil, AI'ın davranışı). **Yani zincirin yeşil testi, oyunun
oynanabilirliğini kanıtlamıyor.**

---

## 5. Güncelleme önerisi

### Faz 0 — Kilit çözme *(acil, küçük)* — ✅ **uygulandı (16 Ağu 2026)**

| # | İş | Dosya | Durum |
|---|---|---|---|
| 0.1 | `buy_wood`'dan **önce** bir "Kereste Kampına yol çek" adımı ekle | `frontier_road.json` + yeni hedef türü | ✅ |
| 0.2 | `second_lumber_camp.why`'daki "500 odun" ifadesini büyüklük içermeyen cümleyle değiştir | `frontier_road.json` | ✅ |
| 0.3 | İnşa temposu kuralını aktif adımın binasıyla sınırla | `missionBuildPolicy.ts` | ✅ |
| 0.4 | Hikâye modu seçildiğinde AI profili varsayılanını `normal`'a çek (oyuncunun açık seçimi hâlâ kazanır) | `main.ts` / `aiProfileChoice.ts` | ✅ |
| 0.5 | Motor testine bir *dünya* kapısı ekle: zincirin `market-bought` adımı varsa, seçili Level en az bir ticaret noktası barındırmalı | `tools/engine-tests.ts` | ✅ |

> 0.1 ve 0.5 birlikte gitmeli: biri kilidi açar, öteki bir daha kapanmasını engeller.

#### Faz 0'ın uygulamada verdiği üç karar

Plan yazılırken açık bırakılan, kod yazılırken kapanan noktalar:

1. **`trade-site-supplying` kaynağa göre daralıyor, site türüne göre değil.** Plan
   `siteType?` öneriyordu; uygulanan `resourceId?`. Gerekçe: oyuncu bir *kereste kampına*
   değil, **Pazar'da odun olmadığı için** yol çekiyor — ve `producer-linked` zaten aynı
   daraltmayı yapıyor, böylece iki adım bir çift olarak okunuyor. Bir çatal aynı kaynağı
   besleyen iki site yazarsa ikisi de adımı karşılar; site türü seviye içeriği, kaynak ise
   hedefin konusu.
2. **Yol rehber aksiyonu (`{ kind: "road" }`) Faz 3'ten Faz 0'a çekildi.** İşaretçisiz bir
   yol adımı, kilidi açtığı oyuncuyu tam olarak kilidin bıraktığı yerde bırakırdı — yol
   aracı varsayılan sekmede bile değil ("Lojistik" sekmesinde). Palet nabzı + kart cümlesi
   Faz 0'da; **dünyadaki ok işaretçisinin arz noktasını göstermesi Faz 3'te kaldı.**
   Aksiyon bilinçli olarak hedefsiz: rotayı seçmek turun öğrettiği kararın kendisi.
3. **`buy_wood.why` de değişti** (0.2'nin harfinin dışında, 0.1'in sonucu olarak): kendinden
   önceki adım artık rafı öğretiyor, sonraki cümle onunla çelişemezdi. Komisyon cümlesi
   düştü — seçim paneli zaten söylüyor ve `why` 110 karakter kapısına takıldı.

4. **Zorluk varsayılanı URL'nin moduna bakıyor, depolamanınkine değil.** 0.4'ün ilk hâli
   modu `resolveMissionMode`'dan (depolama) okuyordu; oysa `?mode=` onu geçersiz kılıyor.
   Elle yazılmış bir `?rts&mode=free` bağlantısı, teklifi hiç görmemiş bir tarayıcıda
   "story" çözer ve **serbest maça turun temel rakibini** verirdi. `readMissionModeFromUrl`
   bunun için ayrıldı — iki ayrı `?mode=` okuması eninde sonunda ayrışır, ve o ayrışmanın
   şekli "içinde olmadığı mod için seçilmiş zorluk" olur.

**Ayrıca uygulanırken düzeltilen bir kırılganlık:** zincirin doğrulayıcı testi
"rehber taşıyan ilk adımı" bulup `buildingId`'sini bozuyordu; yol aksiyonu `buildingId`
taşımadığı ve doğrulayıcı onu daha okumadan döndüğü için bu sessizce geçebilir hâle
gelmişti. Test artık **bina adı taşıyan** bir rehber arıyor.

### Faz 1 — Şema genişletmesi

Yeni `MissionGoal` üyeleri (hepsi mevcut anlık görüntüden okunabilir, hiçbiri direktöre
hafıza eklemez):

| Hedef | Ne ölçer | Neyi öğretir |
|---|---|---|
| `trade-site-supplying` `{ siteType?, count }` | `MarketSupplyState === "supplying"` olan nokta sayısı | Yol → kervan → market stoku |
| `structure-repaired` `{ count }` *(sayaç)* | Bu maçta tamamlanan onarım | Onarım |
| `production-adjacency` `{ buildingId, count }` | Komşuluk çarpanı aktif üretici sayısı | Değirmen |
| `aura-covered` `{ count }` | Destek aurası altındaki bina/birim | Tapınak |
| `livestock-penned` `{ count }` | Ağıla kapatılmış hayvan | Ağıl ekonomisi |
| `enemy-units-defeated` `{ role?, count }` *(sayaç)* | Bu maçta öldürülen düşman birimi | Savunma / karşı saldırı |
| `strategic-point-held` `{ count, seconds }` | Kontrol altındaki geçit | Bölgesel zafer (K3'ün karşılığı) |

Yeni `MissionGuideAction` üyeleri:

| Aksiyon | İşaret ettiği |
|---|---|
| `{ kind: "road", target: { siteId \| buildingId \| pointId } }` | Yol aracı + dünyadaki hedefe ok |
| `{ kind: "unit-command", command: "hold" \| "retreat" \| "attackMove" \| … }` | İlgili tuş/panel düğmesi |
| `{ kind: "formation", formationId }` | Formasyon paneli |

**Kural (mimariyi korumak için):** her yeni hedef türü `missionPredicates.ts`'te tam olarak
bir saf yüklem alır; JSON'a koşul dili girmez. Şema kapalı birleşim olarak kalır.

### Faz 2 — Zincirin yeniden kurgusu (perde yapısı)

17 düz adım yerine **4 perde**, her perde bir konu:

**Perde I — Vadi (ekonominin temeli)** — bugünkü 1-3 + 6-10. adımlar
`wood_flowing` → `food_flowing` → `first_depot` → `center_lv2` → `houses`
→ `train_workers` → `second_lumber_camp` → `second_farm`
*Değişiklik:* `food_flowing`'in `why`'ına kurt uyarısı; `train_workers` sonrası
otomasyon anahtarını (`R`) tanıtan tek satır.

**Perde II — Yollar ve ticaret** — *yeni*
`road_to_timber` (`trade-site-supplying`) → `market` → `buy_wood`
*Bu, K1'in çözümü ve aynı zamanda oyunun en özgün mekaniğinin ilk kez adı konması.*

**Perde III — Toprak ve büyüme** — bugünkü 11-13 + yeni
`outpost` → `quarry` → `gold_mine` → `pasture` *(veya `windmill`, Lv3'e bağlı)*
→ `road_to_stone_pit` *(opsiyonel, ikinci arz hattı)*

**Perde IV — Ordu ve sınır** — bugünkü 14-17 + yeni
`barracks` → `guards` → `hold_stance` *(duruş/geri çekilme)* → `town`
→ `archery_range` *(Kasaba'nın ödülü)* → `defend` (`enemy-units-defeated`)
→ `raze`

**Öneri:** `market-bought`, `unit-trained`, `enemy-structure-razed` ve yeni sayaç
hedefleri zaten doğaları gereği tek atımlık; `structure-built` tipli ara adımlara
(`pasture`, `archery_range`) `latch: true` verilmeli — oyuncunun *sahip olduğu* değil
*yaptığı* şeyi ölçtükleri için değil, zincirin ilerlemesini geç oyundaki bir yıkımın
geri almasını engellemek için.

### Faz 3 — Rehber ve kart — ✅ **işaretçi kısmı uygulandı (16 Ağu 2026)**

**Soru:** "kurulan yapıların nereye kurulacağını da belirlesek, oyuncuya kolaylık olmaz mı?"
(kullanıcı, oynarken). Cevap **ikiye ayrıldı**, çünkü §12.9 bu işin bir yarısını zaten
ölçüp geri almıştı:

- **Karar olan "nerede" — dokunulmadı.** Ev, Depo, Tarla, Pazar, Kışla, Karakol. §12.9'un
  iki gerekçesi de duruyor: "kurallara uygun + yola yakın" ile "iyi yer" aynı şey değil, ve
  aday hesaplayan çözücü yapı konunca bir sonraki noktaya atlıyordu. Yer seçimi turun
  öğrettiği kararın kendisi.
- **Karar bile olmayan "nerede" — işaretlendi.** Ocak *yatağın üstüne* kurulur, Avcı
  Kulübesi geyik menzilinde olmak zorunda, kereste yolu belirli bir noktaya gider.
  Oyuncunun bilmediği şey bir tasarım kararı değil, **haritada neyin nerede olduğu**.

`MissionGuide.landmark` (`missionLandmark.ts`) bu ikinciyi karşılıyor: işaret **önerilen
bir yapı yerini değil, seviye yazarının koyduğu nesneyi** gösteriyor. §12.9'un iki tuzağı
da ortadan kalkıyor (mitige edilmiyor): yatağın yeri tek doğru cevap olduğu için öneri
değil, ve aday kümesi statik olduğu için hiçbir şey yerinden oynamıyor.

İşaretlenen 4 adım: `food_flowing` (geyik), `supply_wood` (kereste noktası), `quarry`
(taş yatağı), `gold_mine` (altın yatağı). Oduncu kampı **bilerek** işaretsiz.

Üç uygulama kararı:

1. **Anahtar örnek değil tür.** `landmark.key` seviye id'si (`player_safe_stone`) değil,
   kaynak/tür (`stone`). Örnek id'si zinciri tek haritaya kaynaklardı; tür + "merkeze en
   yakını" başka bir haritaya kopyalandığında da doğru taşa iniyor.
2. **Uyarı işareti geçer.** Bir adımda hem düzeltme ("Ocağın var ama yol değmiyor") hem
   işaret varsa düzeltme kazanır — oyuncunun bakması gereken artık yatak değil, kendi
   binası. İşaret, düzeltilecek bir şey yokken kalan şey.
3. **Sis kuralı aynen.** Keşfedilmemiş zemin işaretlenmez; işaret bir ifşa değil, görülmüş
   bir şeyin teyidi.

**Kural teste bağlandı, listeye değil.** "Hangi yapı işaretlenebilir" `resources.json`'dan
türetiliyor: `safeNode` taşıyan kaynak bir yatağa iner, `tree` taşıyan odun 153 ağaca
dağılmıştır. Ev'e işaret eklemeyi denediğimizde test kırmızı oluyor — yani §12.9'un kuralı
artık tek tek düzenlemelerle aşınamaz.

Faz 3'ün kalan işi (kart cümleleri, tuş ipuçları) duruyor.

### Faz 3 — kalan iş

- ~~Yol aksiyonu için dünya işaretçisi.~~ **Yapıldı** — `landmark` ile, ve yalnız yol
  adımına değil dört adıma birden.
- `missionGuideHighlight`'a **"düğme reddedecek"** kuralı: `market-bought` hedefinde stok
  yoksa işaretçi `trade-buy:*` yerine yol aracına düşsün ve kart *"Pazar'ın rafı boş —
  önce bir arz noktasına yol çek"* desin. (K1'in kalıcı savunması; 0.1 içeriği çözer, bu
  kural benzer bir hatanın tekrarını çözer.)
- Kartta **kontrol ipucu satırı**: aktif adımın `guide`'ı bir tuş komutuysa tuşu yaz.

### Faz 4 — Mod ile kurulum kartının ilişkisi

- ~~**K2:** hikâye satırı seçiliyken zorluk varsayılanı `normal`'a insin.~~ **Yapıldı**
  (Faz 0.4). Varsayılan URL'nin moduna bakıyor, depolamanınkine değil.
- **K3, iki seçenek:**
  - *(a) Basit:* hikâye modunda bölgesel zafer kapalı kalsın, ama zincirin sonuna
    `strategic-point-held` hedefli **isteğe bağlı bir bonus adım** eklenmesin — bunun
    yerine `outro` metni geçitlerin serbest maçta ne işe yaradığını bir cümleyle söylesin.
  - *(b) Tam:* zincir bittikten sonra bölgesel zafer sistemleri **maç sürerken** ayağa
    kalksın. Bu, `RtsApp`'ta geç kurulum gerektirir; maliyeti (a)'nın çok üstünde.
  - **Öneri: (a).** Zincirin maçın hedefini sahiplenmesi doğru bir karar; kayıp bilgi
    tek cümleyle kapanır.
- Sis: hikâye modu sisi zorlamasın, ama `intro` metni sis açıksa keşiften bir cümle
  etsin (`RtsApp` bayrağı zaten elinde).

### Faz 5 — Doğrulama

| Kapı | Ne kanıtlar |
|---|---|
| `npx tsc --noEmit` | Şema genişletmesi derleniyor |
| `npm run test:engine -- --filter mission` | Yeni yüklemler + zincir tamamlanabilirliği |
| **Yeni:** "zincirin hedefleri seçili Level'da karşılanabilir" | K10'un kapanması — market stoklu bir adım varsa ticaret noktası, `raze` adımı varsa düşman genişleme alanı ister |
| `npm run build:verify` | Birleştirmeden önce |
| **Kabul maçı (kullanıcı)** | Zincirin baştan sona tek oturumda oynanması — CLAUDE.md: görsel/oynanış kabulü kullanıcının kararı |

---

## 6. Öncelik sırası

1. **Faz 0** — kilit çözme. Bu yapılmadan hikâye modu ilk kez oynayan biri için bozuk.
2. **Faz 1.1 + Faz 2 Perde II** — yol/ticaret perdesi. Oyunun en özgün mekaniği ve K1'in
   kalıcı çözümü.
3. **Faz 3** — rehber genişletmesi. Yeni adımlar işaretçisiz yarım kalır.
4. **Faz 2 Perde IV + Faz 1 kalan hedefler** — askerî katman ve Kasaba çağının ödülü.
5. **Faz 4** — kurulum kartı ilişkisi.
6. **Faz 2 Perde III'ün opsiyonel adımları** — Ağıl/Değirmen/Tapınak.

---

## 7. Kapsam dışı bırakılanlar

- **İkinci bir zincir** (`?mission=<id>` zaten destekliyor, `missionScriptIdForMode` tek
  yerden dosya adı üretiyor): teknik olarak hazır, ama `frontier_road` güncel değilken
  ikinci bir zincir yazmak aynı borcu ikiye katlar. Faz 0-3 kapandıktan sonra
  değerlendirilmeli.
- **Zincirin maç kurallarını değiştirmesi.** `missionBuildPolicy`'nin dar kapsamı
  (yalnızca oyuncunun paleti, simülasyona dokunmaz) korunmalı — hikâye modu oyunun
  nasıl çalıştığını değiştirmemeli, yalnızca ne yapılacağını söylemeli.
- **Sinematik/diyalog katmanı.** `intro`/`outro` + adım `why` metinleri bugünkü anlatı
  bütçesi; ses ve diyalog için ayrı planlar var
  (`THREEAGES_AUDIO_DESIGN_AND_PRODUCTION_PLAN.md`,
  `THREEAGES_LOCALIZATION_ARCHITECTURE_AND_PRODUCTION_PLAN.md`).
