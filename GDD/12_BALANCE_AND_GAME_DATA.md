# 12 — Balance and Game Data

> **Çalışma adı:** Üç Çağ: Sınır Krallıkları  
> **Doküman türü:** Game Design Document — Denge, Sayısal Tasarım ve Oyun Verisi  
> **Sürüm:** 0.1  
> **Durum:** İlk taslak

> **İlerleme Modeli Revizyonu (2026-07-18):** §26, §29 ve §38 güncellendi. Seviye
> katsayıları artık **çağ içi** merdivene (Lv1–3) uygulanır; çağ ekseninin ayrı
> katsayısı `KR-06` gereği şu an 1.00'dır (§29.1). Çağ atlama binaları
> yükseltmez, **Lv1'e sıfırlar**. Model: `02 §25`. Denge verisi:
> `public/game-data/balance/buildings.json` (`levels: BuildingLevelBalance[]`).
>
> **Kapsam Hizalaması (v0.2):** Bu belgenin tasarım gövdesi 0.1 taslağıdır; **üretim kapsamı** `13_VERTICAL_SLICE_PRODUCTION_PLAN_v0.2.md` (Ürün A/B/C kapıları) tarafından belirlenir. **Önemli:** Veri klasörü konumu (`/game-data/` vs Forge'un `public/` + save-validator pipeline'ı) henüz kilitlenmemiştir; bu bir açık teknik karardır — bkz. `TECH_DECISIONS.md`. Tüm sayılar başlangıç hipotezidir.

---

## 1. Dokümanın Amacı

Bu doküman oyundaki tüm sayısal değerlerin nasıl tanımlanacağını, saklanacağını, test edileceğini ve sürümleneceğini belirler.

Kapsam:

- kaynak üretimi ve ekonomi temposu,
- nüfus ve Refah,
- yapı maliyetleri ve süreleri,
- çağ atlama,
- birim maliyetleri, sağlık, hasar ve karşıtlıklar,
- karakol, yol ve stratejik bölge değerleri,
- zafer sayaçları,
- AI zorluk parametreleri,
- veri şemaları, doğrulama ve test araçları,
- telemetri ve denge değişikliği süreci.

Bu belgede verilen bütün sayılar **başlangıç hipotezidir**. Oynanış testinden önce kesin kabul edilmemelidir.

---

## 2. Denge Hedefi

Oyuncu her aşamada en az iki anlamlı seçenek arasında karar vermelidir. Hiçbir kaynak, yapı, birlik veya zafer yolu her durumda açıkça en iyi seçenek olmamalıdır.

Öncelik sırası:

1. Maç süresi
2. Çağ süreleri
3. Ekonomik büyüme
4. Nüfus eğrisi
5. Birim üretim temposu
6. Yapı dayanıklılığı
7. Birim karşıtlıkları
8. Ayrıntılı maliyet ayarları

İlk amaç mükemmel matematiksel eşitlik değil; anlaşılır fırsat maliyeti, karşı hamle imkânı ve tutarlı maç temposudur.

---

# BÖLÜM A — VERİ MİMARİSİ

## 3. Önerilen Klasör Yapısı

```text
/game-data/
├── schema/
│   ├── resources.schema.json
│   ├── buildings.schema.json
│   ├── units.schema.json
│   ├── ages.schema.json
│   ├── ai.schema.json
│   ├── maps.schema.json
│   └── difficulty.schema.json
├── balance/
│   ├── resources.json
│   ├── buildings.json
│   ├── units.json
│   ├── ages.json
│   ├── combat.json
│   ├── logistics.json
│   ├── victory.json
│   ├── difficulty.json
│   └── ui_timing.json
├── maps/
│   └── twin_rivers_01.json
├── presets/
│   ├── prototype.json
│   ├── debug_fast.json
│   ├── economy_test.json
│   ├── combat_test.json
│   ├── ai_test.json
│   └── vertical_slice.json
└── versions/
    └── balance_changelog.md
```

## 4. Veri Formatı

Ana format olarak JSON önerilir.

Nedenleri:

- web ve TypeScript ile doğrudan uyum,
- JSON Schema doğrulaması,
- otomatik tip üretimi,
- kolay runtime yükleme,
- Codex tarafından güvenli biçimde düzenlenebilme.

## 5. Kod ve Veri Sınırı

### Veride tutulacaklar

- maliyetler,
- sağlık ve hasar,
- üretim ve inşaat süreleri,
- hareket hızı ve menzil,
- nüfus kullanımı,
- footprint,
- çağ gereksinimleri,
- kontrol yarıçapları,
- yol bonusları,
- zafer sayaçları,
- AI utility ağırlıkları,
- zorluk katsayıları,
- UI zamanlamaları.

### Kodda tutulacaklar

- formüller,
- durum makineleri,
- pathfinding,
- hedef seçme algoritması,
- bağlantı grafiği,
- save/load,
- event sistemi.

Kod içinde özel birim kimliğine göre sayı yazılmamalıdır.

```ts
// Yanlış
if (unitId === "unit_guard_t1") damage = 12;

// Doğru
damage = unitData.stats.attackDamage;
```

## 6. Kimlik Standardı

```text
resource_food
building_town_center_t1
building_storage_t2
unit_guard_t1
unit_archer_t2
age_settlement
difficulty_normal
map_twin_rivers_01
```

Kimlikler gösterilen addan ayrı, benzersiz ve save dosyalarıyla uyumlu olmalıdır.

## 7. Doğrulama

Oyun başlamadan önce otomatik kontroller yapılmalıdır:

- yinelenen veya eksik ID,
- negatif maliyet,
- sıfır veya negatif süre,
- geçersiz referans,
- eksik model,
- upgrade döngüsü,
- erişilemeyen çağ gereksinimi,
- üretim binası olmayan birim,
- geçersiz nüfus veya kapasite değeri.

---

# BÖLÜM B — ANA TEMPO HEDEFLERİ

## 8. Maç Süresi

| Ölçü | Hedef |
|---|---:|
| İdeal maç | 20–30 dk |
| Kabul edilebilir | 15–40 dk |
| Alarm sınırı | Maçların %20’den fazlası 40+ dk |

## 9. Çağ Süreleri

| Aşama | Hedef süre |
|---|---:|
| Yerleşim | 6–10 dk |
| Kasaba | 10–14 dk |
| Krallık | 5–10 dk |

Kasaba aşaması maçın en uzun ve en yoğun bölümü olmalıdır.

## 10. Temel Eşikler

| Olay | Hedef zaman |
|---|---:|
| İlk keşif teması | 2–5 dk |
| İlk askerî temas | 5–9 dk |
| İlk karakol | 5–9 dk |
| İlk büyük çatışma | 10–16 dk |
| Krallık geçişi | 17–23 dk |

---

# BÖLÜM C — EKONOMİ

## 11. Ekonomi Ölçü Birimi

Ana ölçü `kaynak/dakika` olacaktır. UI gelir hızı da aynı ölçüyü kullanır.

## 12. İşçi Başına Temel Üretim

| Kaynak | İlk test aralığı |
|---|---:|
| Yiyecek | 6–8 / dk |
| Odun | 5–7 / dk |
| Taş | 4–6 / dk |
| Altın | 3–5 / dk |

Yiyecek en hızlı, altın en yavaş ve stratejik üretim olmalıdır.

## 13. Başlangıç Ekonomisi

- Başlangıç işçisi: **5**
- İşçi üretim süresi: **25–30 sn**
- İşçi maliyeti: **50 yiyecek**

Önerilen ilk dağılım:

```text
2 yiyecek
2 odun
1 inşaat / serbest görev
```

## 14. Üretim Yapısı Kapasitesi

| Seviye | İşçi kapasitesi | Üretim katsayısı |
|---|---:|---:|
| T1 | 3 | 1.00 |
| T2 | 4 | 1.20–1.30 |
| T3 | 5 | 1.40–1.60 |

## 15. Yerel Tampon

| Seviye | Önerilen kapasite |
|---|---:|
| T1 | 30–45 |
| T2 | 50–70 |
| T3 | 80–110 |

Yol kesildiğinde üretimin 30–90 saniye içinde etkilenmesi hedeflenir.

## 16. Global Depolama

Merkez başlangıç kapasitesi:

| Kaynak | Kapasite |
|---|---:|
| Yiyecek | 500 |
| Odun | 500 |
| Taş | 300 |
| Altın | 300 |

Depo katkısı:

| Seviye | Kaynak başına kapasite |
|---|---:|
| T1 | +250 |
| T2 | +400 |
| T3 | +600 |

## 17. Kaynak Düğümü Kapasiteleri

| Kaynak | Küçük | Orta | Büyük |
|---|---:|---:|---:|
| Odun kümesi | 1200 | 2400 | 4000 |
| Taş | 500 | 900 | 1500 |
| Altın | 350 | 700 | 1200 |

Tarlalar sürdürülebilir üretim kullanabilir.

---

# BÖLÜM D — NÜFUS VE REFAH

## 18. Çağlara Göre Nüfus

| Çağ | Üst sınır hedefi |
|---|---:|
| Yerleşim | 20 |
| Kasaba | 35 |
| Krallık | 50 |

## 19. Birim Nüfus Maliyeti

| Birim | Nüfus |
|---|---:|
| İşçi | 1 |
| Muhafız | 1 |
| Okçu | 1 |
| Süvari | 2 |
| Kuşatma | 3 |

## 20. Ev Kapasitesi

| Seviye | Kapasite |
|---|---:|
| Ev T1 | 5 |
| Ev T2 | 8 |
| Ev T3 | 12 |

## 21. Refah

- Aralık: `0–100`
- Başlangıç: `40–50`
- Kasaba geçiş eşiği: `45`
- Krallık geçiş eşiği: `65`

Önerilen bileşen ağırlıkları:

| Bileşen | Ağırlık |
|---|---:|
| Barınma | %25 |
| Yiyecek güvenliği | %25 |
| Bağlı yapı oranı | %20 |
| Güvenlik | %15 |
| Altyapı | %15 |

Refah hedef değere saniyede yaklaşık `0.1–0.4` puan yaklaşmalıdır.

---

# BÖLÜM E — YAPI MALİYETLERİ VE SÜRELERİ

## 22. İlk Yapı Maliyet Hipotezi

| Yapı | Yiyecek | Odun | Taş | Altın |
|---|---:|---:|---:|---:|
| Ev T1 | 0 | 80 | 0 | 0 |
| Depo T1 | 0 | 120 | 40 | 0 |
| Tarla T1 | 0 | 80 | 0 | 0 |
| Oduncu Kampı T1 | 0 | 100 | 0 | 0 |
| Taş Ocağı T1 | 0 | 100 | 40 | 0 |
| Altın Madeni T1 | 0 | 100 | 30 | 0 |
| Kışla T1 | 0 | 160 | 60 | 0 |
| Karakol T1 | 0 | 140 | 100 | 0 |
| Kule T1 | 0 | 80 | 160 | 0 |
| Kuşatma Atölyesi | 0 | 240 | 180 | 100 |

## 23. İnşaat Süreleri

| Yapı sınıfı | Hedef süre |
|---|---:|
| Ev | 20–35 sn |
| Kaynak yapısı | 25–45 sn |
| Depo | 35–55 sn |
| Kışla | 45–70 sn |
| Karakol | 45–75 sn |
| Kule | 50–80 sn |
| Kuşatma Atölyesi | 70–110 sn |
| Merkez çağ yükseltmesi | 90–180 sn |

## 24. Yükseltme Maliyeti

- T1 → T2: yeni T1 yapının yaklaşık `%70–100` maliyeti
- T2 → T3: yeni T1 yapının yaklaşık `%120–180` maliyeti

Yükseltme yalnızca üretim yüzdesi değil; kapasite, dayanıklılık veya yeni işlev açmalıdır.

---

# BÖLÜM F — ÇAĞ ATLAMA

## 25. Yerleşimden Kasabaya

Başlangıç test aralığı:

```text
Yiyecek: 500–700
Odun: 300–450
Taş: 100–200
Altın: 100–200
Süre: 90–120 sn
```

Ek koşullar:

- temel ekonomik yapılar,
- en az bir askerî yapı,
- bir karakol veya aktif genişleme,
- Refah eşiği.

## 26. Kasabadan Krallığa

```text
Yiyecek: 900–1300
Odun: 500–800
Taş: 400–700
Altın: 450–750
Süre: 120–180 sn
```

Ek koşullar:

- gelişmiş askerî yapı,
- aktif dış bölge,
- yüksek Refah.

**Çağ atlama tamamlandığında sahibin tüm yapıları yeni çağın Lv1 modeline geçer
ve seviyeleri 1'e sıfırlanır** (`02 §24`). Çağ atlamanın bina-seviyesi önkoşulu
yoktur; bu yüzden yukarıdaki listeden "Seviye II yapılar" koşulu kaldırıldı.

> **v0.1'den değişiklik.** Bu bölüm daha önce "çağ atlama tamamlandığında tüm
> yapılar otomatik yükseltilmez" diyordu. Yeni modelde yapılar otomatik olarak
> *yükselmez* ama otomatik olarak **sıfırlanır** — kazanım çağın kendisinde
> değil, yeniden tırmanılacak seviye merdiveninde ve daha güçlü taban modelde.

---

# BÖLÜM G — BİRİM MALİYETLERİ

## 27. İlk Birim Maliyet Hipotezi

| Birim | Yiyecek | Odun | Taş | Altın | Nüfus |
|---|---:|---:|---:|---:|---:|
| İşçi | 50 | 0 | 0 | 0 | 1 |
| Muhafız T1 | 60 | 20 | 0 | 0 | 1 |
| Okçu T1 | 50 | 40 | 0 | 0 | 1 |
| Süvari | 100 | 0 | 0 | 70 | 2 |
| Kuşatma | 0 | 140 | 100 | 60 | 3 |

## 28. Üretim Süreleri

| Birim | Süre |
|---|---:|
| İşçi | 25–30 sn |
| Muhafız | 25–35 sn |
| Okçu | 30–40 sn |
| Süvari | 45–60 sn |
| Kuşatma | 60–90 sn |

## 29. Seviye Maliyet Katsayısı

Katsayı **çağın içindeki** seviye merdivenine uygulanır. Çağ ekseninin ayrı bir
maliyet katsayısı yoktur (bkz. §29.1).

| Seviye (çağ içi) | Katsayı |
|---|---:|
| Lv1 | 1.00 |
| Lv2 | 1.20–1.35 |
| Lv3 | 1.45–1.70 |

### 29.1 Çağ ekseni katsayısı — şu an 1.00

`KR-06` gereği ilk sürümde **çağ atlamanın kendisi stat ölçeklemesi vermez**:
çağ atlayınca binalar Lv1'e döner ve o çağın Lv1 taban değerleriyle çalışır.
Yani bugün `çağ katsayısı = 1.00` ve ilerleme hissini tamamen seviye merdiveni
taşır.

Bu bilinçli bir sadeleştirmedir, kalıcı bir karar değil. Üçüncü çağ eklenirken
(`13 §55`) yeniden değerlendirilmelidir: iki eksen de düz olursa geç oyun
binaları erken oyun binalarından yalnızca model olarak ayrılır.

---

# BÖLÜM H — SAVAŞ DENGESİ

## 30. Time to Kill

Eşit seviye temel birimlerin 1v1 çatışması:

- hedef: **8–15 saniye**

Bu süre oyuncuya geri çekilme ve destek komutu vermek için zaman bırakmalıdır.

## 31. İlk Sağlık Aralıkları

| Birim | Sağlık |
|---|---:|
| İşçi | 40–60 |
| Muhafız | 90–130 |
| Okçu | 60–90 |
| Süvari | 140–200 |
| Kuşatma | 180–280 |

## 32. Hasar ve Saldırı Aralığı

| Birim | Hasar | Saldırı aralığı |
|---|---:|---:|
| Muhafız | 10–14 | 1.2–1.6 sn |
| Okçu | 8–12 | 1.4–1.9 sn |
| Süvari | 18–26 | 1.6–2.2 sn |
| Kuşatma | 40–80 yapı hasarı | 3–6 sn |

## 33. Yumuşak Karşıtlık Tablosu

| Saldıran | Hafif | Ağır | Yapı |
|---|---:|---:|---:|
| Muhafız | 1.00 | 1.20 | 0.35 |
| Okçu | 1.20 | 0.80 | 0.25 |
| Süvari | 1.35 | 0.75 | 0.30 |
| Kuşatma | 0.35 | 0.30 | 2.50 |

Bu katsayılar sağlık, hız, menzil ve nüfus maliyetiyle birlikte değerlendirilmelidir.

## 34. Hareket Hızları

Göreli katsayı:

| Birim | Hız |
|---|---:|
| Kuşatma | 0.60–0.75 |
| Muhafız | 1.00 |
| Okçu | 1.00–1.05 |
| İşçi | 1.00 |
| Süvari | 1.40–1.70 |

## 35. Yol Hareket Bonusu

| Yol | Bonus |
|---|---:|
| Yol I | +5% |
| Yol II | +12% |
| Yol III | +20% |

## 36. Dost Bölgede İyileşme

- Son hasardan sonra bekleme: `8–12 sn`
- İyileşme: maksimum sağlığın `%1–2 / sn`
- Düşman yakınında durur.

---

# BÖLÜM I — YAPI SAĞLIĞI VE KUŞATMA

## 37. Yapı Sağlık Sınıfları

| Yapı sınıfı | Sağlık |
|---|---:|
| Küçük ekonomik | 300–500 |
| Ev | 300–450 |
| Depo | 500–800 |
| Askerî yapı | 650–1000 |
| Karakol | 700–1200 |
| Kule | 800–1400 |
| Merkez | 1800–3000 |

## 38. Seviye Sağlık Katsayısı

Çağ içi merdivene uygulanır; çağ ekseni için bkz. §29.1 (şu an 1.00).

| Seviye (çağ içi) | Katsayı |
|---|---:|
| Lv1 | 1.00 |
| Lv2 | 1.35–1.55 |
| Lv3 | 1.75–2.10 |

Sağlık, seviye düşerken de uygulanır: çağ atlayınca `HealthComponent.setMax`
tavanı Lv1 taban değerine **indirir**.

## 39. Hedef Yıkım Süreleri

### Karakol

- kuşatmasız: `45–90 sn`
- kuşatmalı: `20–45 sn`

### Merkez

- kuşatmasız: `2–4 dk`
- kuşatmalı: `45–120 sn`

## 40. Onarım

Toplam tamir maliyeti, eksik sağlık oranına göre orijinal yapı maliyetinin yaklaşık `%40–60` üst sınırında olmalıdır.

---

# BÖLÜM J — KARAKOL, YOL VE BÖLGE

## 41. Kontrol Alanı Yarıçapları

| Kaynak | Önerilen yarıçap |
|---|---:|
| Merkez T1 | 14–18 hücre |
| Merkez T2 | 18–22 |
| Merkez T3 | 22–26 |
| Karakol T1 küçük alan | 5–7 |
| Karakol T1 tam alan | 9–12 |
| Karakol T2 | 12–15 |
| Karakol T3 | 15–18 |

## 42. Karakol Minimum Mesafesi

Tam alan yarıçapının yaklaşık `%60–80` oranı ilk test değeri olarak kullanılabilir.

## 43. Yol Maliyeti

- Yol I: segment başına `2–5 odun`
- Yol II yükseltme: `2–4 odun + 1–3 taş`

10 segmentlik kısa yolun kurulumu yaklaşık `10–25 saniye` hedeflenebilir.

## 44. Stratejik Nokta Ele Geçirme

- Tek askerî birim: `30–45 sn`
- Küçük grup: `15–25 sn`

Ele geçirme ağırlıkları:

| Birim | Ağırlık |
|---|---:|
| İşçi | 0 veya 0.25 |
| Muhafız | 1 |
| Okçu | 1 |
| Süvari | 1.5 |
| Kuşatma | 0.5 |

## 45. Bölgesel Zafer Sayacı

- Başlangıç değeri: `180 sn`
- Test aralığı: `120–240 sn`
- Nokta kaybında yavaş gerileme
- İki noktanın rakibe geçmesi halinde hızlı sıfırlama

---

# BÖLÜM K — AI ZORLUK PARAMETRELERİ

## 46. Normal

```text
Ekonomi çarpanı: 1.00
Yapı maliyeti: 1.00
Üretim süresi: 1.00
Fog of war: Açık
```

Normal, oyunun adil temel deneyimidir.

## 47. Kolay

| Parametre | Değer yaklaşımı |
|---|---:|
| Ekonomi çarpanı | 0.90–1.00 |
| Tepki gecikmesi | +1–3 sn |
| Baskın sıklığı | Düşük |
| Kompozisyon kalitesi | Düşük/Orta |
| Geri çekilme kalitesi | Düşük/Orta |

## 48. Zor

| Parametre | Değer yaklaşımı |
|---|---:|
| Ekonomi çarpanı | 1.00–1.08 |
| Tepki gecikmesi | Daha kısa |
| Baskın sıklığı | Orta/Yüksek |
| Kompozisyon kalitesi | Yüksek |
| Geri çekilme kalitesi | Yüksek |

Ekonomi bonusu yalnız testler gerekli gösterirse kullanılacaktır.

## 49. Güç Oranı Eşikleri

```text
Saldır: Dost güç / düşman güç >= 1.10
Riskli saldırı: 0.90–1.10 ve hedef çok değerliyse
Geri çekil: < 0.80
```

## 50. Plan Kararlılığı

Yeni planın utility puanı mevcut plandan yaklaşık `%20–30` daha yüksek olmadıkça AI plan değiştirmemelidir. Acil olaylar istisnadır.

---

# BÖLÜM L — UI ZAMANLAMALARI

## 51. İlk Değerler

| Sistem | Süre |
|---|---:|
| Tooltip gecikmesi | 0.25–0.5 sn |
| Bilgi bildirimi | 3–5 sn |
| Önemli bildirim | 5–8 sn |
| Kritik bildirim | 8–12 sn veya çözülene kadar |
| Merkez saldırı tekrar uyarısı | 10–20 sn |

Kamera hızları ve zoom sınırları da veri dosyasında tutulmalıdır.

---

# BÖLÜM M — TEST PRESETLERİ

## 52. Debug Fast

- üretim ve inşaat x5,
- düşük çağ maliyeti,
- 30 saniyelik zafer sayacı,
- fog kapatma seçeneği,
- kısa AI karar aralığı.

## 53. Economy Test

- savaş AI kapalı,
- gelir değerleri görünür,
- yüksek nüfus sınırı,
- bağlantı kesme aracı,
- otomatik ekonomi raporu.

## 54. Combat Test

- sınırsız kaynak,
- hızlı birim üretimi,
- sabit savaş alanı,
- hasar logları,
- yapılaşma kapalı.

## 55. AI Test

- utility puanları görünür,
- plan zorlama,
- kaynak ekleme,
- fog bilgisini sıfırlama,
- tehdit haritası görünümü.

## 56. Vertical Slice

Oyuncuya sunulacak gerçek denge değerleri yalnız bu presette bulunmalıdır.

---

# BÖLÜM N — DENGE TEST SIRASI

## 57. Faz 1 — İzole Ekonomi

- işçi üretimi,
- gelir hızları,
- ilk yapı zamanları,
- nüfus,
- çağ maliyeti.

## 58. Faz 2 — İnşaat ve Genişleme

- ilk karakol,
- yol maliyeti,
- dış kaynak amortisi,
- depo kapasitesi,
- kontrol alanı.

## 59. Faz 3 — Temel Savaş

- 1v1,
- 5v5,
- karışık kompozisyon,
- kuşatma,
- geri çekilme.

## 60. Faz 4 — AI

- açılış,
- çağ geçişi,
- baskın,
- ana saldırı,
- toparlanma.

## 61. Faz 5 — Tam Maç

- maç süresi,
- zafer türü,
- kartopu,
- geri dönüş,
- kullanılmayan içerik,
- rota kullanımı.

## 62. Faz 6 — Zorluk

Önce Normal dengelenir. Kolay ve Zor, Normal profilden türetilir.

---

# BÖLÜM O — TEST MATRİSLERİ

## 63. Birim Karşılaştırması

| Saldıran | Savunan | Ölçek | Çağ | Sonuç | Süre |
|---|---|---:|---|---|---:|
| Muhafız | Muhafız | 5v5 | T1 | TBD | TBD |
| Muhafız | Okçu | 5v5 | T1 | TBD | TBD |
| Süvari | Okçu | 3v5 | T3 | TBD | TBD |
| Kuşatma | Karakol | 1 + koruma | T3 | TBD | TBD |

## 64. Ekonomi Açılışları

| Strateji | İlk ev | İlk kışla | İlk karakol | Kasaba | Ordu gücü |
|---|---:|---:|---:|---:|---:|
| Dengeli | TBD | TBD | TBD | TBD | TBD |
| Hızlı çağ | TBD | TBD | TBD | TBD | TBD |
| Erken baskı | TBD | TBD | TBD | TBD | TBD |
| Hızlı genişleme | TBD | TBD | TBD | TBD | TBD |

Hiçbir açılış her ölçütte en iyi olmamalıdır.

---

# BÖLÜM P — TELEMETRİ

## 65. Her Maçta Toplanacaklar

- maç süresi,
- zafer türü,
- zorluk,
- çağ geçiş zamanları,
- ilk temas,
- ilk karakol,
- ilk büyük çatışma,
- kaynak gelirleri,
- işçi sayısı,
- nüfus,
- ordu kompozisyonu,
- yapı sayıları,
- stratejik nokta kontrolü,
- yol uzunluğu,
- bağlantı kesintileri.

## 66. Kullanılmayan İçerik

Bir yapı veya birim maçların `%10`undan azında kullanılıyorsa şu ihtimaller araştırılır:

- pahalı,
- çok geç açılıyor,
- rolü anlaşılmıyor,
- alternatifi daha iyi,
- harita desteklemiyor.

## 67. Kartopu Ölçümü

- ilk büyük çatışmayı kazananın maç kazanma oranı,
- ilk karakolu kaybedenin kazanma oranı,
- iki dakika çağ gerisinde kalan tarafın kazanma oranı,
- beş veya daha fazla işçi kaybeden tarafın kazanma oranı.

Tek erken olay maçların `%80–90`ından fazlasını belirliyorsa sistem yeniden değerlendirilmelidir.

---

# BÖLÜM Q — DENGE DEĞİŞİKLİĞİ SÜRECİ

## 68. Tek Değişken İlkesi

Mümkün olduğunda aynı test grubunda yalnız bir ana değişken değiştirilmelidir.

## 69. Değişiklik Boyutu

- küçük: `%5–10`
- orta: `%10–20`
- büyük: sistemsel yeniden tasarım

## 70. Changelog

```text
Balance v0.1.4
- Guard T1 health: 110 → 120
  Reason: Archer matchup too one-sided.
- Outpost T1 stone cost: 120 → 100
  Reason: First expansion occurred too late.
```

## 71. Balance Version

Oyun build sürümünden ayrı tutulmalıdır.

```text
Game Build: 0.3.2
Balance Version: 0.1.4
```

Save dosyası balance sürümünü saklamalıdır.

---

# BÖLÜM R — OTOMATİK TESTLER

## 72. Veri Validasyonu

- tüm ID’ler benzersiz,
- referanslar geçerli,
- maliyetler negatif değil,
- süreler pozitif,
- upgrade zinciri döngüsüz,
- çağ gereksinimleri erişilebilir,
- tüm birimlerin üretim binası mevcut.

## 73. Basit Simülasyonlar

- 10 dakikalık ekonomi simülasyonu,
- birim 1v1 çatışması,
- yapı yıkım süresi,
- bölgesel sayaç,
- AI bütçe planı.

## 74. Denge Linter

Örnek uyarılar:

- T2 birim T1’den ucuz,
- upgrade yeni bina kurmaktan çok pahalı,
- kuşatma yapı katsayısı normal birimden düşük,
- yapı kendi gereksinimini istiyor,
- nüfus limiti teknik bütçeyi aşıyor.

## 75. Snapshot Testleri

Balance verisinden otomatik olarak:

- DPS,
- efektif sağlık,
- amorti süresi,
- çağ maliyetini biriktirme süresi

çıktıları üretilmelidir.

---

# BÖLÜM S — EDGE CASE’LER

## 76. Bozuk Veri

- development build açık hata verir,
- production build bozuk veriyle maç başlatmaz,
- sessizce rastgele fallback kullanılmaz.

## 77. Runtime Modifikatör Sırası

```text
Temel Değer
→ Seviye
→ Zorluk
→ Kalıcı Teknoloji
→ Geçici Durum
→ Minimum/Maksimum Clamp
```

## 78. Yuvarlama

- simülasyon float,
- UI anlaşılır yuvarlama,
- maliyetler tam sayı,
- UI ve gerçek değer arasında yanıltıcı fark olmamalıdır.

## 79. Frame Rate Bağımsızlığı

Üretim, iyileşme ve zafer sayaçları frame rate’e bağlı olmamalıdır.

---

# BÖLÜM T — VERTICAL SLICE KAPSAMI

## 80. Zorunlu Özellikler

- JSON tabanlı oyun verisi
- JSON Schema doğrulaması
- TypeScript tipleri
- kaynak verileri
- yapı verileri
- birim verileri
- çağ verileri
- combat katsayıları
- lojistik katsayıları
- zafer sayaçları
- zorluk profilleri
- debug presetleri
- vertical slice preseti
- balance version
- changelog
- otomatik referans kontrolü
- basit combat simülasyonu
- basit ekonomi simülasyonu
- telemetri olayları
- denge debug paneli

## 81. Ertelenebilecek Özellikler

- canlı oyun içi balance editörü,
- uzaktan config güncelleme,
- A/B testi,
- makine öğrenimiyle denge,
- çoklu fraksiyon matrisi,
- mod desteği,
- oyuncu yapımı veri paketleri.

## 82. İlk Teknik Prototip

```text
JSON içinde İşçi maliyetini değiştir
→ Oyunu yeniden başlat
→ Kod değişmeden yeni maliyet uygulansın
```

İkinci test:

```text
Muhafız vs Muhafız simülasyonu
→ Çatışma süresi
→ DPS
→ Kalan sağlık raporu
```

Üçüncü test:

```text
10 dakikalık ekonomi simülasyonu
→ Kaynak stokları
→ İşçi sayısı
→ Tahmini çağ zamanı
```

---

# BÖLÜM U — AÇIK SORULAR VE KARARLAR

## 83. Açık Sorular

### Veri

- Hot reload gerekli mi?
- JSON Schema’dan TypeScript tipi otomatik üretilecek mi?
- Veri build sırasında mı paketlenecek?
- Eski save uyumluluğu ne kadar korunacak?

### Ekonomi

- İşçi üretimi tamamen doğrusal mı kalacak?
- Güvenli altın Kasaba geçişine tek başına yetmeli mi?
- Ortak depo kapasitesi mi, kaynak başına kapasite mi kullanılacak?
- T3 üretim bonusu ne kadar güçlü olmalı?

### Savaş

- Süvari vertical slice içinde kesin mi?
- Ok mermisi hareketli hedefi kaçırabilir mi?
- Yapılarda ayrı zırh değeri gerekli mi?
- Muhafız ağır sınıf mı kabul edilecek?

### Zafer ve AI

- 180 saniyelik sayaç doğru mu?
- Zor AI bonus olmadan yeterli mi?
- Kolay AI ekonomi çarpanı düşürülmeli mi?
- Plan değişim eşiği hangi yüzde olmalı?

## 84. Şimdilik Alınmış Kararlar

- Sayısal değerler kod içine gömülmeyecektir.
- Ana veri formatı JSON olacaktır.
- JSON Schema doğrulaması kullanılacaktır.
- Prototype, debug ve vertical slice presetleri ayrılacaktır.
- Normal zorluk temel çarpanlarda `1.0` kullanacaktır.
- Kolay ve Zor önce karar kalitesiyle ayrışacaktır.
- Zor AI bonusu yalnız gerekirse ve yaklaşık `%5–10` sınırında olacaktır.
- Maç süresi hedefi 20–30 dakikadır.
- Kasaba aşaması maçın en uzun bölümüdür.
- Başlangıç işçisi için 5 kullanılacaktır.
- Nüfus limitleri 20/35/50 olarak test edilecektir.
- Birim karşıtlıkları yumuşak olacaktır.
- Temel 1v1 çatışma 8–15 saniye hedefleyecektir.
- Bölgesel sayaç ilk olarak 180 saniye test edilecektir.
- Önce Normal zorluk dengelenecektir.
- Denge değişiklikleri changelog ve ayrı sürüm numarası kullanacaktır.
- Otomatik validasyon ve basit simülasyonlar vertical slice için zorunludur.

---

## 85. Kabul Kriterleri

- [ ] Veri ve kod sınırı nettir.
- [ ] JSON ve şema yaklaşımı kabul edilmiştir.
- [ ] Tempo hedefleri test edilebilir durumdadır.
- [ ] Ekonomi başlangıç değerleri yeterlidir.
- [ ] Yapı ve çağ maliyetleri prototip için uygundur.
- [ ] Birim sağlık, hasar ve karşıtlık yaklaşımı kabul edilmiştir.
- [ ] Yol, karakol ve stratejik bölge değerleri test edilebilir durumdadır.
- [ ] AI zorluk profilleri yeterince ayrışmaktadır.
- [ ] Denge test sırası kabul edilmiştir.
- [ ] Telemetri ve changelog yaklaşımı yeterlidir.
- [ ] Otomatik validasyon kapsamı uygundur.

---

## 86. Üretim Kontrol Listesi

### Veri altyapısı

- [ ] `/game-data` klasörü oluştur
- [ ] JSON Schema dosyalarını oluştur
- [ ] TypeScript tiplerini tanımla veya üret
- [ ] Veri yükleyici geliştir
- [ ] Referans çözücü geliştir
- [ ] Validasyon raporu oluştur
- [ ] Balance version ekle
- [ ] Changelog oluştur

### Ekonomi

- [ ] Kaynak üretim verilerini ekle
- [ ] İşçi üretimini veri tabanlı yap
- [ ] Yerel tampon değerlerini ekle
- [ ] Depo kapasitelerini ekle
- [ ] Nüfus ve Refah değerlerini ekle
- [ ] Çağ maliyetlerini ekle

### Yapı ve savaş

- [ ] Yapı maliyetlerini ekle
- [ ] İnşaat sürelerini ekle
- [ ] Yapı sağlıklarını ekle
- [ ] Birim maliyetlerini ekle
- [ ] Birim sağlık ve hasarını ekle
- [ ] Karşıtlık matrisini ekle
- [ ] Hareket ve yol bonuslarını ekle
- [ ] İyileşme değerlerini ekle

### Bölge ve AI

- [ ] Kontrol yarıçaplarını ekle
- [ ] Karakol mesafesini ekle
- [ ] Yol maliyetlerini ekle
- [ ] Ele geçirme sürelerini ekle
- [ ] Bölgesel sayacı ekle
- [ ] Kolay/Normal/Zor profillerini ekle
- [ ] AI güç eşiklerini ekle
- [ ] Plan kararlılığı değerlerini ekle

### Test

- [ ] Debug Fast preset oluştur
- [ ] Economy Test preset oluştur
- [ ] Combat Test preset oluştur
- [ ] AI Test preset oluştur
- [ ] 1v1 combat simülasyonu geliştir
- [ ] 10 dakikalık ekonomi simülasyonu geliştir
- [ ] Denge linter kuralları ekle
- [ ] Snapshot çıktıları üret
- [ ] Telemetri olaylarını bağla

---

## 87. Revizyon Notları

### Sürüm 0.1

- JSON tabanlı oyun verisi yaklaşımı tanımlandı.
- Ana maç, çağ ve temas süreleri hedeflendi.
- Kaynak üretimi, işçi, nüfus ve Refah için ilk değerler oluşturuldu.
- Yapı, birim ve çağ maliyet hipotezleri eklendi.
- Sağlık, hasar, hareket ve karşıtlık aralıkları tanımlandı.
- Karakol, yol, stratejik nokta ve zafer sayacı değerleri oluşturuldu.
- Kolay, Normal ve Zor AI parametreleri ayrıştırıldı.
- Test presetleri, telemetri, changelog ve otomatik validasyon yaklaşımı eklendi.
