# Faz 0 - RTS Landscape Level Envanteri ve V1 Saha Kilidi

Olusturulma tarihi: 2026-07-23
Kaynak plan: `THREEAGES_RTS_LANDSCAPE_LEVEL_PLAN.md` Faz 0
Durum: Envanter cikarildi - topoloji ONAYLANDI (2026-07-23); geriye yalniz manuel tarayici referansi kaldi

Bu dokuman Faz 0'in yazili ciktisi. Amac, legacy blockout verisini kayipsiz
tasimak icin baslangic envanterini ve V1 duz-zemin arazi sinirini kilitlemek.
Butun koordinatlar kaynaktan dogrulandi:

- Marker verisi: `src/game/rts/world/rtsMapBlockout.ts` (`RTS_BLOCKOUT_MAP`)
- Preset verisi: `public/game-data/presets/gameplay_proof.json`
- AI profili: `public/game-data/balance/ai.json`
- Dunya sinir sabiti: `src/game/rts/world/rtsGround.ts`
  (`RTS_WORLD_HALF_EXTENT = 70`)

Koordinat sozlesmesi: X sag/sol, Z ileri/geri, `y = 0` yuruyus yuzeyi. Oyuncu
merkezi guney-bati (`-X, +Z`), dusman merkezi kuzey-dogu (`+X, -Z`) kosesinde.

---

## 1. RTS_BLOCKOUT_MAP marker envanteri (Faz 0 gorev 1)

### 1.1 Start ve landmark noktalari

| Ne | Alan | X | Z | Not |
| --- | --- | --- | --- | --- |
| Oyuncu start | `playerStart` | -38 | 38 | Guney-bati kose |
| Dusman start | `enemyStart` | 38 | -38 | Kuzey-dogu kose; tum enemy anchor/route offset'i buna gore |
| Merkezi genisleme | `centralExpansion` | 0 | 0 | Sadece zone marker (gorsel), gameplay node degil |
| Dis kaynak isareti | `externalResource` | 27 | 13 | Sadece zone marker (gorsel), gameplay node degil |

### 1.2 Resource node'lari (`resourceNodes`, 6 adet)

| id | resourceId | kind | X | Z |
| --- | --- | --- | --- | --- |
| `player_safe_stone` | stone | safe | -42 | 26 |
| `player_safe_gold` | gold | safe | -34 | 26 |
| `enemy_safe_stone` | stone | safe | 34 | -26 |
| `enemy_safe_gold` | gold | safe | 42 | -26 |
| `external_stone` | stone | external | -34 | 16 |
| `external_gold` | gold | external | 34 | 16 |

Not: enemy_safe stone/gold `(-4,-14)` ve `(4,-14)` enemy-relative konumdadir; Faz
8 quarry/gold_mine anchor'lari yalniz bu iki node'u ortebildigi icin bu
koordinatlar korunmalidir.

### 1.3 Agaclar (`trees`)

Kaynak liste 74 temel giris; `denseForestTrees()` her girisi ikiye katlar ve
kapasiteyi 2x yapar. Runtime'da toplam **148 agac**, her biri **capacity 60**.

| forestId | Temel giris | Dense sonrasi | Yaklasik merkez (X, Z) |
| --- | --- | --- | --- |
| `player-grove` | 14 | 28 | (-52, 36) bati kose |
| `enemy-grove` | 14 | 28 | (52, -34) dogu kose |
| `west-grove` | 12 | 24 | (-45, 8) bati flank |
| `east-grove` | 12 | 24 | (44, -7) dogu flank |
| `north-grove` | 11 | 22 | (-8, -48) kuzey kenar |
| `south-grove` | 11 | 22 | (9, 41) guney kenar |

Korunacak degismezler (marker tasimasinda): her agacin `id`, `forestId`,
`variant` (pine/tree1/tree2) ve `capacity` degeri. `denseForestTrees` uretim
kurali Level'a tasinirken ya onceden pisirilir (148 acik marker) ya da ayni
uretim kurali korunur. `-dense` id son eki uretim tarafindan atanir.

Not (bkz. bellek [[forest-gather-radius-map-coupling]]): grove'lar gercek yerel
havuzlardir; gatherRadius harita capina (~198) yaklastirilirsa orman tek global
havuza doner. Level tasimasinda grove ayrimini koru.

### 1.4 Navigation blocker'lari (`navigationBlockers`, 1 adet)

| Tanim | min (x,y,z) | max (x,y,z) | Gameplay etkisi |
| --- | --- | --- | --- |
| Merkez sirt (central ridge) | (-12, -1, -4) | (12, 4, 4) | X -12..12, Z -4..4 gecilmez; bati/dogu flank'a zorlar |

Bu tek AABB, iki-flank oynanisinin **tek** gameplay engelidir. `createRockRidge`
gorseli bu AABB'den turer. Ayrica `createBoundaryPlaceholders` dort kenar kaya
uretir ama bunlar sadece gorsel; gercek kenar `RtsNavigation` dunya sinirinca
(`RTS_WORLD_HALF_EXTENT = 70`) uygulanir.

### 1.5 Stratejik noktalar (`strategicPoints`, 2 adet)

Yalniz `regionalVictory` flag'i acikken aktif.

| id | name | X | Z | captureRadius |
| --- | --- | --- | --- | --- |
| `west_pass` | Bati Gecidi | -20 | -20 | 10 |
| `east_pass` | Dogu Gecidi | 20 | 20 | 10 |

Ikisi de origin'den gecen, base-base diagonaline dik cizgi uzerinde; her iki
merkeze ~60.7 birim esit uzaklikta (baslangic kontrol yaricapi 28). Merkez
sirtini `(x -12..12, z -4..4)` capraz keser.

### 1.6 Dusman base anchor'lari (`enemyBaseAnchors`, 14 adet)

Tum offset'ler `enemyStart (38, -38)`'e gore; mutlak = start + offset.

| buildingId | offset (x,z) | mutlak (X, Z) |
| --- | --- | --- |
| farm | (-12, 0) | (26, -38) |
| lumber_camp | (12, 0) | (50, -38) |
| quarry | (-6, 12) | (32, -26) |
| gold_mine | (6, 12) | (44, -26) |
| depot | (0, 12) | (38, -26) |
| barracks | (0, -12) | (38, -50) |
| archery_range | (-12, -18) | (26, -56) |
| market | (0, -22) | (38, -60) |
| house | (-12, -6) | (26, -44) |
| house | (12, -6) | (50, -44) |
| house | (-16, -6) | (22, -44) |
| house | (16, -6) | (54, -44) |
| house | (-12, -10) | (26, -48) |
| house | (12, -10) | (50, -48) |

Korunacak degismezler: `buildingId`, `owner=enemy`, konum. quarry/gold_mine
enemy safe node'larini ortmek zorunda (bkz. 1.2).

### 1.7 Dusman base yol omurgasi (`enemyBaseRoute`, 7 nokta)

Route tag: `rts.route:enemy:base:0` (adapter bunu zorunlu kilar).

| # | offset (x,z) | mutlak (X, Z) |
| --- | --- | --- |
| 0 | (0, 6) | (38, -32) |
| 1 | (0, 8) | (38, -30) |
| 2 | (-12, 8) | (26, -30) |
| 3 | (-12, 4) | (26, -34) |
| 4 | (-12, 8) | (26, -30) |
| 5 | (12, 8) | (50, -30) |
| 6 | (12, 4) | (50, -34) |

Segmentler idempotent (nokta 4 geri izleme); tek polyline dallanan agi ifade
eder.

### 1.8 Dusman genisleme bolgeleri (`enemyExpansions`, 2 adet)

Tercih sirasi: once bati, sonra dogu. Her biri outpost + depot + production + 2
route (biri fallback).

**enemy_west** (`id: enemy_west`)

| Rol | buildingId | offset (x,z) | mutlak (X, Z) |
| --- | --- | --- | --- |
| outpost | outpost | (-28, 6) | (10, -32) |
| depot | depot | (-28, -2) | (10, -40) |
| production | farm | (-28, 14) | (10, -24) |

- Route 0: `(-12,8)->(-24,8)->(-24,14)->(-24,-2)` -> mutlak `(26,-30)->(14,-30)->(14,-24)->(14,-40)`
- Route 1 (fallback): `(-12,8)->(-12,18)->(-24,18)->(-24,14)->(-24,-2)`

**enemy_east** (`id: enemy_east`)

| Rol | buildingId | offset (x,z) | mutlak (X, Z) |
| --- | --- | --- | --- |
| outpost | outpost | (28, 6) | (66, -32) |
| depot | depot | (28, -2) | (66, -40) |
| production | lumber_camp | (28, 14) | (66, -24) |

- Route 0: `(12,8)->(24,8)->(24,14)->(24,-2)` -> mutlak `(50,-30)->(62,-30)->(62,-24)->(62,-40)`
- Route 1 (fallback): `(12,8)->(12,18)->(24,18)->(24,14)->(24,-2)`

Korunacak: route tag kurallari, outpost'un baglanmis kontrol yaricapi (12) icinde
depot/production sirasi (yol -> depot).

---

## 2. Preset oyun verisi (Faz 0 gorev 2 - TASIMADA DEGISTIRILMEYECEK)

`public/game-data/presets/gameplay_proof.json`:

| Alan | Deger |
| --- | --- |
| `id` | gameplay_proof |
| `label` | Gameplay Proof (Urun A) |
| `flags` | {} (bos) |
| `startingResources` | food 500, wood 500, stone 0, gold 0 |
| `startingUnits` | guard 0, worker 5 |
| `enemyStartingResources` | food 500, wood 500, stone 0, gold 0 |
| `enemyStartingUnits` | guard 0, worker 5 |
| `gameSpeed` | 1 |
| `mapState` | two_flanks_blockout |
| `aiProfile` | normal |

AI profili `normal` (`ai.json` -> profiles): `economyMultiplier 1.0`,
`reactionDelaySeconds 1`.

Bu blok Level tasimasi boyunca **aynen** kalir; Level yalniz mekansal otoritedir,
denge/preset verisi tasinmaz (plan §4).

Not (RtsApp koddaki sabitler): kod `STARTING_GUARD_COUNT = 3` ve
`STARTING_WORKER_COUNT = 5` varsayilanlarini tutar, ama preset `guard 0` verdigi
icin mac guard'siz baslar; worker 5 preset ile ayni. Bu varsayilanlar preset
degeri gelince ezilir (`counts.guard ?? STARTING_GUARD_COUNT`).

---

## 3. V1 oynanabilir alan siniri (Faz 0 gorev 3)

Dunya: `RTS_WORLD_HALF_EXTENT = 70` -> 140x140 birim kare, kenar
`RtsNavigation` ile zorlanir. Landscape (Faz 3) ayni 140x140 ayak izini kaplar.

Gameplay icerigi asagidaki kutuya sigar (uc noktalar):

| Yon | En uc gameplay ogesi | Deger |
| --- | --- | --- |
| Bati (min X) | enemy-relative olmayan trees / player-grove | X ~ -58 |
| Dogu (max X) | east enemy expansion outpost/route | X ~ 66 |
| Kuzey (min Z) | north-grove / enemy market | Z ~ -60 |
| Guney (max Z) | player-grove / south-grove | Z ~ 46 |

**V1 duz oynanabilir plato onerisi:** merkezi X `[-46, 46]`, Z `[-46, 46]`
bandini **duz veya cok dusuk egimli** tut. Bu band iki base'i (±38), merkezi
genislemeyi (0,0), tum resource node'lari (±42), tum enemy base/expansion
anchor'larini ve iki flank koridorunu icerir.

Plato disi (kenar seridi, |X| veya |Z| > ~46): dekoratif yukselti, sirt, kaya;
gameplay'e girmez, gerekiyorsa marker blocker veya dunya siniri ile kapatilir.

---

## 4. Topoloji taslagi (Faz 0 gorev 4 - ONAYLANDI 2026-07-23)

V1 hedefi: **duz/cok dusuk egimli oynanabilir ova**; gorunen yukselti dekoratif
veya acik navigation blocker. Onerilen topoloji:

1. **Merkezi plato** (X,Z ∈ [-46,46]): duz. Iki base, merkez, kaynaklar,
   anchor'lar burada.
2. **Merkez sirt** (X -12..12, Z -4..4): gorunur yukselti + **acik**
   `BP_RTS_NavigationBlocker` (legacy AABB'nin bire bir karsiligi). Bu, iki-flank
   oynanisinin tek gameplay engeli.
3. **Bati flank koridoru** (X < -12 seridi, merkez sirtin batisi): duz, gecileb
   ilir. `west_pass (-20,-20)` bu koridordan gecer.
4. **Dogu flank koridoru** (X > 12 seridi): duz, gecilebilir. `east_pass (20,20)`
   buradan gecer.
5. **Kenar dekoru** (plato disi serit): tepe/sirt/kaya, gorsel; gameplay disi.
   Gerekirse ek marker blocker.

Iki flank uzerinden oyuncu (-38,38) ve dusman (38,-38) arasinda en az bir gecerli
rota kalmali (plan Faz 2 kabulu). Merkez sirt disinda hicbir gizli gameplay
blocker turetilmez (plan §4).

**Onay gereken kararlar** (bkz. bolum 7): plato sinirlari (±46), merkez sirt
yuksekligi/genisligi, kenar dekor yuksekligi, flank koridor genisligi.

---

## 5. Mevcut davranis referansi (Faz 0 gorev 5-6)

Bu iki gorev calisan tarayici gerektirir; asagidaki URL'ler ve beklenen witness
degerleri kaydedildi. Ekran goruntusu/debug yakalamasi kontrollu manuel adim
olarak yapilir (otomasyon shipped Level'i overwrite etmez, plan §4).

| Ne | URL |
| --- | --- |
| Mevcut RTS gameplay_proof | `http://127.0.0.1:5173/?rts&preset=gameplay_proof` |
| Debug overlay ile | `http://127.0.0.1:5173/?rts&preset=gameplay_proof&debug` |
| Hedef (Faz 1 sonrasi) | `http://127.0.0.1:5173/?rts&preset=gameplay_proof&flags=levelAssets` |

Kayit altina alinacak referanslar:

- `canvas.dataset.rtsLevel` -> mevcut durumda **`blockout`** (Level yok).
- `canvas.dataset.rtsAuthoredWorld` -> mevcut durumda **`disabled`**.
- Startlar arasi path: iki flank uzerinden gecerli (merkez sirt AABB engel).
- Temel build placement: `y = 0` ground plane raycast; duz zeminde beklenen X/Z.

Manuel yakalama adimi (Faz 1'e gecmeden veya beraber):

```powershell
npm.cmd run smoke:browser -- tests/smoke/rts-assetization-baseline.spec.ts
```

---

## 6. Kaynak dokuman uyumsuzlugu (dogrulandi)

`THREEAGES_RTS_CONTENT_ASSETIZATION_PLAN.md` Faz E, Landscape mount'unu teslim
edilmis gibi yaziyor. Kodda dogrulanan gercek durum:

- `RtsApp.buildScene()` her zaman `createRtsGround()` (duz plane + grid) ekler.
- `loadAuthoredWorld` yalniz static instance + light mount eder; **Landscape
  mount YOK**.
- `authoredWorldIntended` sadece `levelHasAuthoredWorld` (instance/light) ile
  belirlenir.

Yani Landscape runtime mount'u bu planin Faz 4'unde ilk kez gelecek. Assetization
planindaki stale iddia Faz 6'da duzeltilir/buraya yonlendirilir.

---

## 7. Kabul ve acik kararlar

Faz 0 kabul kriterleri (plan):

- [x] Tasima listesi eksiksiz (bolum 1): start, resource, tree, strategic point,
  anchor, expansion, route, blocker cikarildi.
- [x] Preset oyun verisi kayit altinda (bolum 2); tasimada degistirilmeyecek.
- [x] V1 duz-zemin siniri acik (bolum 3): merkezi plato X,Z ∈ [-46,46].
- [x] Topoloji taslagi (bolum 4): kullanici onayladi (2026-07-23).
- [ ] Ekran goruntusu/debug referansi (bolum 5): tarayici oturumunda yakalanacak.

Terrain-aware davranis bu faza sizmadi; Faz 7'ye ayrildi.

**Kullanici onaylari (2026-07-23):**

1. V1 plato siniri **X,Z ∈ [-46,46]** (onerilen). Kenar seridi dekoratif.
2. Merkez sirt **legacy AABB birebir blocker** (onerilen); iki-flank korunur.
3. Kenar dekoru **sadece dunya-siniri** (onerilen); ek marker blocker yok.

Onay sonrasi bir sonraki kod dilimi plan §10 uyarinca **Faz 1** (ayrilmis
`RTS_GameplayProof.level.json` + `levelRef` + editor acilis akisi) olur.
