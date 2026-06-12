# 3DGameDev — Ev Ustası (Home Makeover) Geliştirme Projesi

Bu depo **Ev Ustası**'nın (çalışma adı; klasör adı `home-makeover`) geliştirme deposudur: Poki'de yayınlanmak üzere, **3D HTML5** (Three.js ya da Babylon.js — karar bekliyor) bir ev yenileme/dekorasyon oyunu. House Flipper × Sims yapı modu harmanı; özgün twist **canlı müşteri tepkisi + Hidden Wish** sistemi.

Tasarım stüdyosu ayrı depodadır: `c:\Users\emret\Desktop\GameDesign` (konsept, araştırma, eleştiri agent'ları orada). Bu depo **tasarımı koda dönüştürür**.

## Geliştirici profili

- Emre — teknoloji öğretmeni, 12 yıl Unreal Engine, Phaser ile yayınlanmış bir 2D oyun ("Şehir Enerji Mühendisi"). **İlk 3D web projesi ve ilk Poki yayını** — Three.js/Babylon.js API'lerini ve Poki süreçlerini açıklayarak ilerle.
- İletişim Türkçe. **Kod, yorumlar, commit mesajları, dosya/klasör adları ve oyun içi metinler İngilizce**; tasarım/karar dokümanları Türkçe.

## Tek doğruluk kaynağı: GDD

- Tasarım dokümanı: `gdd/home-makeover/` (00-overview … 08-milestones). Mekanik/akış sorularında önce GDD'ye bak; koda GDD'de olmayan davranış ekleme.
- **Sayıların tek kaynağı `gdd/home-makeover/balance/parameters.md`** — koda sabit gömme; veriler ayrı data modüllerinden (JSON/TS) yüklensin ve balance dosyasıyla eşlensin.
- Kod ile GDD çelişirse **sessizce düzeltme; işaretle ve sor**. Tasarım değişikliği önce GDD'ye işlenir, sonra koda.
- GDD durumu: **taslak v0.1** — `market-analyst` ve `design-critic` kapıları henüz koşulmadı (GameDesign deposunda koşulacak; GDD'yi mutlak yolla okurlar). Kapılar bitmeden yalnız **tema-bağımsız iskelet** kodu yaz (motor kurulumu, render döngüsü, input, asset pipeline).

## Poki çıtası (her teknik karar buna vurulur)

1. **3 sn anlaşılır, 8 sn ilk ödül, 30 sn bağlanma** — menüsüz açılış, küçük ilk paket.
2. **Mobile-first tek parmak:** faz sekmeli input şeması (Clean'de sürt, Furnish'te sürükle) — GDD 05.
3. **Hızlı yük:** ilk anlamlı ekran < 3 sn (orta seviye mobil, 4G); GLB'ler lazy-load.
4. **Reklam = opt-in rewarded** (5 yerleşim GDD 07'de); `commercialBreak` yalnız teslim sonrası.
5. **Hesap yok, dış link yok;** kayıt localStorage (sürümlenmiş JSON, migration alanı).
6. **Juice şart:** her etkileşime partikül + ses + nedenli puan etiketi (GDD 06).
7. **Klon değil:** twist'i (canlı müşteri tepkisi + Hidden Wish) zayıflatan kısayollara girme.

## Performans bütçesi (tech-architect netleştirene kadar varsayılan)

- İlk etkileşime kadar yük < 5 MB sıkıştırılmış; 60 fps hedef / 30 fps taban (low-end Android Chrome).
- Draw call'lar instancing/atlas ile düşük; mobilya GLB'leri kategori bazında lazy-load.
- Tek sahne mimarisi (backlog değerlendirmesi: "tek sahne, çatışmasız, kapsam kontrol edilebilir").

## Klasör yapısı

```
gdd/home-makeover/   Tasarım dokümanı + balance/ (tek doğruluk kaynağı)
docs/                Teknik kararlar, mimari notlar (architecture.md vb.), postmortem
src/                 Oyun kodu (iskelet motor kararıyla kurulacak)
public/assets/       İşlenmiş asset'ler (GLB, atlas, ses) + manifest
tools/               Asset pipeline ve yardımcı scriptler
MEMORY.md            Oturum hafızası — her oturum başında oku, sonunda güncelle
```

`src/` iskeleti motor kararı (H1) sonrasında kurulur; boş klasör önceden açma.

## Agent sistemi

Geliştirme görevlerinde ilgili uzman agent'a delege et (kullanıcı aksini istemedikçe):

| Agent | Ne zaman |
|---|---|
| `scene-3d-dev` | 3D sahne, kamera, ışık, GLB yükleme, instancing, render performansı |
| `gameplay-dev` | Mekanik implementasyonu: faz durum makinesi, grid yerleştirme, puanlama, save |
| `ui-dev` | HUD, hibrit HTML/CSS arayüz, FTUE akışı, tek parmak input, responsive layout |
| `juice-audio-dev` | Partikül, tween, ses entegrasyonu, game feel cilası |
| `asset-pipeline` | Kenney GLB işleme/optimizasyon, atlas, manifest, lazy-load, eksik asset listesi |
| `qa-poki` | Performans bütçesi doğrulama, cihaz/tarayıcı testi, Poki SDK uyumluluk kontrolü |

**Tipik akış:** GDD bölümü oku → ilgili dev agent'a görev → `qa-poki` doğrulaması → MEMORY.md güncelle. Tasarım sorusu çıkarsa GameDesign deposundaki tasarım agent'larına (design-critic vb.) iş açılması Emre'ye önerilir.

## Çalışma kuralları

- Önceki projeden taşınan dersler GDD 00-overview bölüm 5'te (L1–L12 uyarlaması) — özellikle: mobile-first baştan (L6), asset şişmesi yok / lazy-load (L8), neden-sonuç ekranda okunur (L9), tek dev sınıf yok — GDD 02'deki M1–M9 sistem sınırları modül sınırıdır (L11).
- Her mekanik (M1–M9) bağımsız test edilebilir modül olarak yazılır; sahne sınıfı orkestratördür, iş mantığı taşımaz.
- Asset lisans takibi: `public/assets/` altındaki her kaynağın menşei (Kenney paketi adı / üretilmiş) manifest'te kayıtlı olmalı.
- Teknik karar verildiğinde `docs/` altına tarihli kısa karar notu (neden bu, neyi eledi).

## Oturum hafızası

@MEMORY.md
