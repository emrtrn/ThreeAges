# Ev Ustası — 06 Juice & Audio

> Durum: taslak | Versiyon: 0.1 | Tarih: 2026-06-12 | Bağımlı: 02-mechanics.md, 05-ux-ui.md, GameDesign deposunda docs/game-feel-summary.md

Çerçeve: Steve Swink'in game feel modeli (GameDesign deposunda `docs/game-feel-summary.md`). Bu oyunun "feel" yükü iki yerde toplanır: (1) **sürtme-silme** — parmakla sahne arasında sürekli, gerçek zamanlı kontrol hissi (Swink'in "real-time control" tanımına bu oyunda en yakın an); (2) **yerleştirme + tepki** — input → response → polish zinciri: bırakış pop'u anında, müşteri tepkisi yarım saniye içinde, puan etiketi nedenli. Juice süs değil; "temizledim mi, beğendi mi, neden?" sorularının cevabıdır.

## 1. Tepki bütçesi (response metrics)

- **Sürtme ≤ 1 kare:** Kir, parmağın altında aynı karede silinir; gecikme bu mekaniğin tatminini doğrudan öldürür (en sıkı performans bütçesi burada — tech-architect).
- **İlk algılanabilir tepki ≤ 100 ms:** Her dokunuş (eşya seçimi, yerleştirme, swatch, buton) aynı karede görsel pop + ses başlangıcı alır; uzun animasyonlar (rulo süpürmesi, müşteri yürüyüşü, kutlama) ilk tepkinin **arkasından** gelir.
- **Müşteri tepkisi ≤ 0,5 sn:** Yerleşim pop'u anlık, emote 0,3–0,5 sn içinde — "gördü ve tepki verdi" hissi; daha geç gelirse neden-sonuç bağı kopar (M5).
- **ADSR ilkesi:** Hızlı atak, kısa sürdürme, yumuşak bırakma; hiçbir kutlama girdiyi bloklamaz (konfeti yağarken oyuncu sonraki eşyayı sürükleyebilir).
- **Öncelik = mekanik önem:** Teslim/3★ > "Hidden Wish" keşfi > rank atlama > müşteri tepkisi > yerleşim pop'u > sürtme dokusu > UI. İki büyük kutlama üst üste binmez; sıraya alınır.
- **Tutarlı dil (metaphor):** Temizlik olayları köpük/parıltı dilinde, beğeni olayları kalp/yıldız dilinde, para olayları coin dilinde — kanallar karışmaz.

## 2. Olay → geri bildirim tablosu

Kanallar: G = görsel/partikül, A = animasyon/tween, S = ses (sfx id), K = kamera/ekran, H = HUD. SFX adları üretim listesidir (OGG+MP3 çifti, ders L3).

| Olay | G | A | S (sfx id) | K | H |
| --- | --- | --- | --- | --- | --- |
| Sürtme (kir altında) | köpük + parıltı izi parmağı takip eder | kir maskesi gerçek zamanlı erir | `scrub_loop` (pitch parmak hızına bağlı) | — | kalan kir sayacı |
| Kir lekesi bitti | parıltı patlaması | decal son kırıntısı "pop" | `dirt_done` | — | sayaç düşer |
| Çöp toplandı | küçük toz | kavisli uçuş → kutu | `trash_pop` + `bin_thunk` | — | sayaç düşer |
| Temizlik %100 | oda geneli parıltı süpürmesi | ışık sıcaklığı/parlaklığı yükselir (oda "nefes alır") | `sparkling_sting` | çok hafif parlaklık geçişi | "Sparkling Clean!" bandı |
| Swatch uygulandı | rulo izi + boya damlası | yüzey boyunca süpürme | `paint_roll` | — | — |
| Hayalet geçerli/geçersiz | yeşil/kırmızı ton | yumuşak snap kayması | `snap_tick` (kısık) | — | — |
| Eşya yerleşti | toz halkası | squash-stretch pop | `place_thud` (boyuta göre 2–3 varyant) | mikro punch (çok hafif) | — |
| Eşya "Store" | küçülerek tepsiye uçar | — | `store_whoosh` | — | tepsi rozeti |
| Müşteri kalp (sevdi) | kalp patlaması eşyanın üstünde | emote zıplaması | `react_love` | — | "Cozy +12" etiketi metreye uçar |
| Müşteri nötr-onay | tek onay ikonu | baş sallama | `react_ok` (kısık) | — | küçük "+X" |
| Müşteri surat (sevmedi) | gri bulutçuk | omuz silkme (mizahi) | `react_meh` (komik tını, ceza tınısı değil) | — | "Clutter -8" etiketi |
| "Hidden Wish" keşfi | "?" → kalbe dönüşür + yıldız tozu | kartta yuva açılma animasyonu | `wish_found` (özel, sıcak) | hafif punch | "Hidden Wish! +X" |
| Taste Meter yıldız çentiği geçildi | metre üzerinde yıldız parlar | çentik pop | `star_tick` | — | — |
| "Deliver" aktifleşti | buton yumuşak nabız | — | — | — | — |
| **Teslim sekansı** | konfeti + coin yağmuru | kamera yavaş oda turu, önce/sonra kaydırıcı | `delivery_fanfare`, coin sayacı `coin_count` | tur + yumuşak dönüş | puan kategorileri tek tek sayar |
| 3★ "Dream Home!" | yoğun konfeti + müşteri kalp patlaması | yıldızlar tek tek çakılır | `three_star_sting` | hafif punch ×3 | "Tip!" satırı |
| Milestone / rank atlama | flaş + rozet | banner kayar girer | `rank_up_fanfare` | hafif punch | rozet + açılan içerik önizleme |
| Katalog satın alma | podyum + parıltı | eşya döner | `purchase` | — | coins düşer (sayaç tween) |
| Yetersiz bakiye | fiyat etiketi kırmızı | yatay titreşim | `denied` | — | coins kısa vurgu |
| Rewarded etki başlar/biter | aura / söner | süre rozeti | `boost_start` / `boost_end` (kısık) | — | rozet |
| UI: panel/sekme/buton | — | slide/pop | `ui_click`, `ui_back` | — | — |

## 3. Ses mimarisi

Önceki projeden taşınan model (ders L3):

- **Kanallar:** master / music / ambience / sfx / ui. Mute + seviye localStorage'da kalıcı; tarayıcı autoplay kilidi ilk dokunuşta açılır.
- **Format:** OGG ana + MP3 fallback; `snake_case` İngilizce adlandırma; eksik dosya boot'u bloklamaz.
- **Ses yorgunluğu kuralları:** `scrub_loop` sürekli ama parmak kalkınca aynı karede durur (loop'un takılı kalması yasak); `place_thud`/`react_*` pitch varyasyonlu + minimum aralıklı; emote sesleri kuyrukta üst üste çalmaz (M5 tepki kuyruğuyla hizalı).
- **Müzik:** 1 hafif, pozitif loop **[MVP]**; teslim sekansında kısa süreliğine kısılıp fanfara yer açar. Oda ambiyansı (saat tiktakı, dışarıdan kuş) **[KES]**.

## 4. "Sürt-sil" dokunsal sahnesi (özel odak)

Oyunun ilk 5 saniyedeki vaadi budur; PowerWash Simulator/ASMR temizlik tatmini hedeflenir:

1. **Sürekli kontrol:** Parmak kirde gezdiği sürece silme + köpük + ses kesintisiz; mikro gecikme bile yok (≤ 1 kare bütçesi).
2. **Doku çeşitliliği:** Kir tipleri görsel olarak farklı silinir (leke "erir", toz "süpürülür") ama girdi aynı kalır — çeşitlilik gözde, kontrolde değil.
3. **Bitirme vuruşu:** Decal'in son %10'u tek süpürmede komple gider (sondaki kırıntı avı sinir bozucudur — cömert bitiş eşiği, değer → `balance/parameters.md`).
4. **Oda dönüşümü:** Temizlik ilerledikçe oda ışığı kademeli ısınır; %100'de "nefes alma" anı — temizlik yalnız decal silmek değil, mekânı canlandırmak olarak hissedilir.

## 5. Uygulama notları

- Tüm dinamik efektler koddan (shader maskesi, partikül, tween); GLB modeller temiz kalır (ders L2). 3D partikül bütçesi alt segment mobile göre sınırlanır (tech-architect).
- Müşteri tepkileri karakter animasyonu gerektirir; fallback zinciri: tam animasyon → sabit poz + 2D emote balonu (twist görsel taşıyıcısını asset riski öldüremez — 08-milestones kesilebilirler).
- Ekran flaşı/punch yoğunluğu sınırlı (fotosensitivite + küçük ekran); kamera punch'ı 3D'de mide bulandırmamalı — rotasyon değil yalnız hafif ölçek/poz.
- Teslim sekansının toplam süresi kısa tutulur ve "Skip" hep görünür (00-overview başarı ölçütü: skip oranı).

## Açık sorular

- `scrub_loop`'un pitch'i parmak hızına bağlanması hoş mu, yorucu mu — playtest.
- Oda ışığı ısınma geçişi düşük donanımda (lightmap yoksa) nasıl ucuzlatılır — tech-architect (renk grading fallback?).
- Müşteri emote'ları 3D başın üstünde 2D balon mu, 3D partikül mü? Okunabilirlik (L12) 2D balonu işaret ediyor; sahne bütünlüğü 3D'yi — erken prototipte karar.
- Müzik üretim kaynağı (kendi üretimi mi, lisanslı paket mi) → GameDesign deposunda `assets-notes/` + tech-architect pipeline'ı.
