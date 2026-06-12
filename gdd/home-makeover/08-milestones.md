# Ev Ustası — 08 Milestones & Plan

> Durum: taslak | Versiyon: 0.1 | Tarih: 2026-06-12 | Bağımlı: tüm GDD bölümleri, balance/parameters.md

Solo geliştirme, hedef ~3 ay (13 hafta). **Başlangıç tarihi açık:** bu proje sırada Power City'den sonra ikinci; takvim Emre'nin kararına bağlı (00-overview açık sorusu). Plan bu yüzden göreli haftalarla (H1–H13) yazıldı. İlke "riskli varsayım önce" (Lens #14 Risk Mitigation): bu projenin en riskli varsayımları (1) 3D'de tek-parmak yerleştirme UX'i, (2) sürt-sil hissinin mobil performansı, (3) müşteri tepkisinin okunabilirliği, (4) GLB yük bütçesi — hepsi ilk haftalarda oynanır hâle gelir.

## 0. Ön koşul — geliştirme ortamı (H1'in parçası)

Kod bu depoda (**`C:\Users\emret\Desktop\3DGameDev`**) yürütülür. ✅ **Kuruldu (2026-06-12):** klasör, kök CLAUDE.md/MEMORY.md ve Claude agent'lı 3D geliştirme sistemi (6 dev agent: scene-3d-dev, gameplay-dev, ui-dev, juice-audio-dev, asset-pipeline, qa-poki); GDD GameDesign'dan buraya taşındı. H1 içinde kalanlar:

- Temel proje iskeleti (`src/`, build aracı — motor kararıyla birlikte).
- ✅ **Motor kararı (2026-06-12): Three.js** (`three@0.184.0` pinli; Vite + TypeScript iskeleti, gltf-transform asset pipeline'ı). Karşılaştırma ve gerekçe: `docs/2026-06-12-engine-decision.md`; H1 teknik görev listesi karar notu §5'te.
- Asset pipeline ilk halkası: Kenney GLB içe aktarma + sıkıştırma + lazy-load iskeleti (ders L8).

## 1. Dikey dilim tanımı (kalite kapısı 1)

Şunlar **oynanır ve hissettirir** durumda:

- "Maple Street" 3 işi ("Studio Flat", "Cozy Bedroom", "Small Kitchen"), 3 arketip ("Grandma Rose", "The Bookworm", "The Minimalist").
- Tam iş döngüsü: sürt-sil temizlik, boya, grid-snap yerleştirme, **canlı müşteri tepkisi + nedenli puan etiketleri + Taste Meter**, "Hidden Wish", teslim sekansı + yıldız + ödeme.
- "Job Board" + katalog (asgari: Starter Set + 5–8 satın alınabilir eşya) + save (M9).
- FTUE ilk 30 sn birebir 05-ux-ui tablosuna uygun; temel juice (sürtme, yerleşim pop'u, tepki, teslim) yerinde.
- Placeholder görsel/karakter kabul (emote 2D balon fallback'i yeter); sayılar elle girilmiş ilk tahmin kabul.

**Geçme kriteri:** Dış test (2–3 kişi, en az 1 mobil): ilk sürtme < 5 sn gözleniyor; test oyuncusu hangi eşyanın neden puan getirdiğini sorulduğunda **doğru açıklıyor** (L9 testi — twist'in kanıtı); ilk teslim < 4 dk; "bir iş daha" isteği kendiliğinden doğuyor.

## 2. Tam MVP tanımı (yayın adayı)

- 2(–3) mahalle, 12–15 iş, 8–9 kategori, 6–8 arketip, "Design Rank" + milestone seti (04-content).
- 5 rewarded yerleşim + Poki SDK tam entegrasyon (07-monetization).
- Tüm juice/SFX tablosu (06), 1 müzik loop'u, müşteri karakter tepkileri (en az fallback seviyesinde tutarlı).
- systems-balancer simülasyonuyla doğrulanmış `balance/parameters.md` (3★ erişilebilirliği, iş süresi 2–4 dk vb.).
- Mobil + masaüstü doğrulanmış; GLB yük bütçesi tech-architect planına uygun (ilk anlamlı ekran küçük paket).

## 3. Haftalık plan (göreli)

| Hafta | Odak | Çıktı / kontrol |
| --- | --- | --- |
| H1 | **Kurulum + kapılar:** ~~3DGameDev klasörü + Claude agent geliştirme sistemi~~ (✅ 2026-06-12) + ~~motor seçimi (tech-architect)~~ (✅ 2026-06-12: Three.js); `market-analyst` doygunluk taraması + `design-critic` GDD gate; GLB pipeline ilk halkası | Motor kararı verili ✅; bir Kenney odası mobilde 60 fps render; GDD revizyon listesi |
| H2 | **Yerleştirme sistemi (en riskli UX):** grid + duvar/yüzey çapaları, hayalet, snap, döndürme, store (M4); 4 açılı kamera + duvar saydamlaştırma | Dik telefonda tek parmakla eşya yerleştirme "iyi hissettiriyor" |
| H3 | **Temizlik:** kir maskesi sürt-sil (≤1 kare), çöp, faz yapısı + sekmeler (M2, 01) | Sürtme tatmini mobilde doğrulandı; bir oda uçtan uca temizleniyor |
| H4 | **Twist çekirdeği:** etiket sistemi, puan hesabı, Taste Meter, müşteri kartı, canlı tepki + nedenli etiketler, "Hidden Wish" (M5) | Yerleştir → tepki → metre zinciri ≤ 0,5 sn; L9 testi iç oynamada geçiyor |
| H5 | Boya sistemi (M3) + teslim sekansı + yıldız/ödeme (M6) + "Job Board" (M1) | İş döngüsü uçtan uca kapanıyor |
| H6 | Katalog + aletler (M7) + save (M9) + FTUE ilk 30 sn | **Dikey dilim tamam** → dış test + `design-critic` ara bakışı |
| H7 | Dilim geri bildirimi işlenir; `systems-balancer` simülasyonları → `balance/parameters.md` v1 | Pacing/3★ hedefleri ilk doğrulama |
| H8 | İçerik genişletme: "Riverside Lofts", yeni kategoriler/arketipler, "Design Rank" + milestone'lar (M8, 04-content) | MVP içerik kapsamı yerinde |
| H9 | Poki SDK + 5 rewarded yerleşim + adblock/fallback davranışları (07) | Teklif akışları uçtan uca |
| H10 | Görsel geçiş: ışık/palet düzeni, müşteri karakterleri + emote'lar (veya fallback kararı), oda set dressing | Placeholder'lar emekli |
| H11 | Juice/SFX tablosunun tamamı + müzik (06); performans/yük bütçesi: GLB sıkıştırma, lazy-load, alt segment test (L8) | Alt segment mobilde akıcı; ilk yük hedefte |
| H12 | Denge turu 2 (gerçek oturum verisiyle), playtest (5+ kişi, en az 2'si mobil), hata temizliği | Retention/pacing gözlemleri işlendi |
| H13 | **Final gate:** `design-critic` son değerlendirme; "Hillside Villas" durum kararı; Poki QA hazırlığı, build/submission | Poki'ye gönderim |

Ritim notları: haftalık tek odak; her hafta sonunda oynanır build. H1 kapıları (market/critic) kod kurulumuyla paralel yürür; kapı "kırmızı" derse H2–H3 işleri büyük ölçüde tema-bağımsızdır (3D yerleştirme + sürt-sil her dekorasyon temasında yaşar) — pivot maliyeti içerik katmanında kalır.

## 4. Kesilebilirler (sıralı — üstteki önce kesilir)

1. "Hillside Villas" (3. mahalle) → yayın sonrası güncellemeye.
2. "Cat Person" + quirk özel asset'leri ("cat bed" vb.).
3. R5 "Fresh Clients" (07 açık sorusu zaten şüpheli) ve R4 "Magic Vacuum".
4. Müşteri yürüme/eşyaya bakma animasyonları → sabit poz + 2D emote balonu fallback'i.
5. "Kitchen & Table Props" kategorisi (Food Kit yüzey eşyaları) → masa/tezgâhlar boş kalabilir.
6. "Rugs" alt katman kuralı → halı da normal ayak izi kaplar (üstüne eşya konmaz).
7. Oda ambiyans sesleri; müzik teslim kısması → basit tek loop.
8. Pinch zoom → sabit zoom yeter.
9. `commercialBreak` → MVP rewarded-only yayınlanabilir.

Kesilemezler: canlı müşteri tepkisi + nedenli puan etiketi (twist), sürt-sil ≤ 1 kare hissi, FTUE ilk 30 sn, grid-snap yerleştirme, sürümlenmiş save, R1+R2.

## 5. Riskler ve izleme

| Risk | Erken sinyal | Önlem |
| --- | --- | --- |
| İlk 3D projesi: motor/pipeline öğrenme eğrisi | H1–H2 hedefleri taşar | Kapsam zaten tek oda/sabit kamera; agent sistemi + tech-architect planı H1'de; taşarsa H8 içerik haftası daraltılır |
| Dik kadrajda 3D oda okunmuyor (05 açık sorusu) | H2 prototipi | duvar saydamlaştırma; olmazsa kamera eğimi/FOV revizyonu; son çare yatay-birincil pivot (erken, ucuzken) |
| Sürt-sil performansı alt segmentte düşük | H3 cihaz testi | maske çözünürlüğü düşürme, decal başına ilerleme modeli (M9 notu); his bütçesi pazarlıksız |
| Müşteri karakteri asset/animasyon yükü | H4 placeholder, H10 taşar | fallback zinciri (kesilebilir #4) baştan tasarımda; twist 2D balonla da çalışır |
| GLB toplam boyutu ilk yükü şişirir (L8) | H11 bütçe ölçümü | kategori/mahalle lazy-load, mesh sıkıştırma, FTUE odası minimal paket — H1'den itibaren pipeline kuralı |
| "Temizlik fazı tekrara düşer" | dilim testinde CLEAN sıkıyor | oda başına kir sayısı pacing'i (balance), alet upgrade'leri; R4 sübap — ama tasarım basıncı yasak (07) |
| Power City takvimiyle çakışma | başlangıç gecikir | plan göreli; H1 kurulumu (3DGameDev + motor seçimi) Power City yayın beklerken öne alınabilir (Emre kararı) |

## Açık sorular

- Başlangıç tarihi: Power City H13 sonrası mı, kısmi örtüşmeli mi (H1 kurulum haftası öne çekilebilir mi)? → Emre.
- H1'de market/critic kapıları "kırmızı" derse pivot protokolü: tema mı (ev→başka mekân: kafe, ofis?), twist mi revize edilir? Gate çıktısıyla netleşecek.
- Playtest havuzu (H12): önceki oyunun öğrenci çevresi bu türün kitlesiyle (dekorasyon, kadın oyuncu payı yüksek) örtüşüyor mu; ek test kanalı gerekir mi?
- Poki QA/inceleme süresi gönderim sonrası ek süre ister; "yayında" tanımı planın dışında mı tutulacak? (Power City'dekiyle aynı soru — ilk Poki sürecinde birlikte öğrenilecek.)
