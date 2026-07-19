# ThreeAges UI Restyling Plan — Referans Görsele Yaklaşma

**Hedef:** `GDD/UI_Reference.png` görselindeki ortaçağ temalı RTS arayüzüne ulaşmak.

**Referansın statüsü:** Görsel, **görsel yönü** temsil eder (palet, doku hissi,
yerleşim bölgeleri); işlevsel taraf bu dokümandaki kararlarla belirlenir ve
görselden saparsa doküman kazanır. (Örnek: görseldeki büyük F/X/H/G komut kartı
bilinçli olarak kompakt çip satırına indirildi.)

**Onaylı düzen taslağı:** Dokusuz, tıklanabilir HTML mockup'ı (inşa sekmeleri +
sabit seçim paneli örnekleriyle) Claude artifact'i olarak yayında:
`https://claude.ai/code/artifact/119b6f0d-d0f7-44d7-9805-f52b97aed215`.
Faz C/D/F uygulaması bu taslağı esas alır.

**Ana tespit:** Referans ekranın işlevsel karşılığı büyük ölçüde zaten mevcut.
Bu bir "sıfırdan UI yazma" işi değil, **restyling + veri zenginleştirme** işidir.
Mevcut paneller "presentation-only" (her değer `RtsApp`'ten push edilir), DOM
diff'leme ve tıklama-geçirgenlik (`ui-interactive`) kuralları yerleşiktir; plan
bu sözleşmeleri bozmadan üzerine tema giydirir.

## Mevcut Durum ↔ Hedef Eşleşmesi

| Referanstaki blok | Mevcut karşılığı | Eksik olan |
|---|---|---|
| Üst kaynak barı (ikon + stok + gelir/dk, nüfus, çağ) | `src/game/rts/ui/rtsHudBar.ts` — hepsi metin olarak var | Kaynak ikonları, arma + krallık adı, süre/duraklat/ayarlar kümesi |
| Sağdaki "Görevler" paneli | `src/game/rts/ui/rtsObjectiveTracker.ts` | Katlanabilir kart görünümü |
| Uyarı bantları ("saldırı altında", "yol kesildi") | `src/game/rts/ui/rtsAttackWatch.ts` + `rtsNotificationFeed.ts` | İkonlu bant stili |
| Alt seçim paneli (portre, HP barı, duruş, birim ızgarası) | `src/game/rts/ui/rtsSelectionPanel.ts` + `rtsSelectionView.ts` — başlık/özet/aksiyon butonları var | Portre, birim slot ızgarası, **sabit çerçeve**, kompakt F/X/H/G çipleri |
| İnşa paneli (sol alt, kategori sekmeli) | `src/game/rts/ui/rtsBuildPalette.ts` — sağ altta, kategorileri düz başlık | Sol alta taşıma, 4 sekme (Ekonomi/Lojistik/Yerleşim/Askeri), sabit ızgara |
| Hız kontrolleri | `src/game/rts/ui/rtsGameSpeedControls.ts` | Üst bara taşınması |

## Fazlar

### Faz A — Tema temeli ✅ (2026-07-19 tamamlandı)

Görsel etkinin ~%70'i buradan gelir; hiçbir TS dosyasına dokunmadan oyun
bambaşka görünür.

- ✅ `src/style.css` `:root`'una `--ta-*` design token'ları eklendi: parşömen
  metin (`--ta-ink`), altın vurgu (`--ta-gold`), bronz kenarlık (`--ta-border`),
  koyu kahve zeminler (`--ta-surface*`), altın gradyanlı birincil / sessiz
  ikincil buton (`--ta-btn*`), çift çerçeve panel gölgesi (`--ta-panel-shadow`).
- ✅ Cinzel (OFL, değişken ağırlıklı TTF) `public/assets/ui/fonts/` altına
  self-host edildi; başlıklar/etiketler Cinzel, gövde Georgia
  (`#ui-overlay` altında — editör DOM'u etkilenmez).
- ✅ Tüm RTS panelleri token'lara geçirildi; takım renkleri ve anlam taşıyan
  durum renkleri korundu. Doğrulama: `tsc` temiz, `check:assets` temiz,
  `smoke:browser` 16/16.

### Faz B — İkon/portre boru hattı ✅ (2026-07-19)

- `public/assets/ui/` altına kaynak, komut, birim/yapı ikonları ve geçici genel
  birim/yapı portreleri eklendi. Bunlar şematik placeholder'lardır; nihai sanat
  aynı dosya yolları korunarak sonradan değiştirilebilir.
- Birim/bina tanımları (game data) artık `icon` ve `portrait` alanlarını taşır;
  doğrulayıcı yalnızca paket içi `/assets/ui/icons/` ve `/assets/ui/portraits/`
  SVG yollarını kabul eder. Panel böylece jenerik ve veri-güdümlü kalır
  (CLAUDE.md'nin "engine'e proje kuralı gömme" ilkesine uygun).
- Engine testi, her gönderilmiş tanımın ikon/portresinin diskteki bir SVG'ye
  çözüldüğünü denetler. Referans görsele yakın nihai sanat üretimi ayrı bir iş
  kalemi olarak kalır.

### Faz C — Üst bar yeniden düzeni ✅ (2026-07-19)

- Sol: arma + krallık adı.
- Orta: ikonlu kaynak hücreleri (stok + gelir/dk aynı hücrede kalır).
- Sağ: Çağ + maç süresi + duraklat/hız/ayarlar kümesi;
  `rtsGameSpeedControls` bağımsız panel olmaktan çıkıp bara yerleşir.
- Korunacak sözleşmeler: tek satır kuralı, `--rts-hud-bar-height` custom
  property'si (kardeş paneller buna göre hizalanır).
- Uygulandı: sol tarafta geçici arma + krallık etiketi, ortada ikonlu kaynak
  hücreleri, sağda çağ/süre/nüfus ve bar içi hız + menü/duraklat kümesi. Süre,
  mevcut simülasyon saatinden gelir; hız kontrolünün sahipliği değişmez, yalnızca
  HUD içindeki konumu değişir.

### Faz D — Sabit çerçeveli seçim paneli ✅ (2026-07-19)

**Ana karar: panel boyutu seçime göre değişmez.** Bugünkü panel içeriğe göre
büyüyüp küçülüyor; hedef, üç bölgeli sabit iskelet:

```text
[ portre + adet ]  [ başlık · özet · HP barı ]  [ aksiyon bölgesi ]
[                 bilgi satırları (taşarsa kayar)                 ]
[ ipucu satırı (tam genişlik)                                     ]
```

- Yükseklik sabittir; bilgi satırları ve aksiyonlar taşarsa **kendi bölgesi
  içinde** kayar (en kötü durum: Pazar — 6 ticaret + yükselt + yık = 8 buton;
  mockup'ta sabit bölgeye sığdığı doğrulandı).
- `rtsSelectionView`'a yeni alanlar: portre, birim sayısı, slot listesi.
  İçerik üretimi (`describeSelection`) aynen kalır — satır metinleri zaten
  doğru; değişen yalnızca yerleşim.
- **Kompakt komutlar:** referans görseldeki büyük F/X/H/G komut kartı
  kullanılmayacak. Birlik seçiminde komutlar, aksiyon bölgesinde küçük çip
  satırı olarak gösterilir (`Saldırı-Hareket [F]` vb.); kısayol bağlama
  `RtsApp`'te kalır, panel sadece gösterir.
- Karar (2026-07-19): boş seçimde panel otomatik gizlenir; inşa paneli kendi
  sabit çerçevesini korur, seçim paneli yalnızca gerçek bir seçim olduğunda
  görünür.
- Tıklama-geçirgenlik kuralı korunur: yalnızca butonlar ve tooltip taşıyan
  gövde `ui-interactive` olur, panelin geri kalanı harita tıklamasını yutmaz.

Uygulandı: sabit yükseklikli üç bölge iskeleti, boş seçim durumu,
veri-güdümlü geçici portre, adet rozeti, HP çubuğu, çoklu seçim için rol bazlı
slot listesi ve F/H/G/X komutlarının yalnızca gösterim amaçlı kompakt çip
satırı. Bilgi/aksiyon bölgeleri kendi içinde kayar; komut bağlama hâlâ `RtsApp`
ve giriş katmanındadır.

### Faz F — Kategorili inşa paneli (sol alt) ✅ (2026-07-19)

Kullanıcı kararı (2026-07-19): inşa paneli sol alta taşınır ve dört kategori
sekmesine ayrılır. (Sağ alttaki mevcut `rtsBuildPalette` bu düzene evrilir;
referans görseldeki "Birim" sekmesi yoktur — birim üretimi ilgili yapının
seçim panelinden yapılır.)

| Sekme | İçerik |
| --- | --- |
| Ekonomi | Tarla, Oduncu Kampı, Taş Ocağı, Altın Madeni, Pazar |
| Lojistik | Yol, Depo, Karakol |
| Yerleşim | Ev, Tapınak *(ileride — kilitli "Yakında" karosu)* |
| Askeri | Kışla, Okçuluk Alanı |

- **Sabit 5×2 ızgara:** en kalabalık sekme (Ekonomi, 5 yapı) genişliği
  belirler; sekme değişince panel boyutu oynamaz (sabit panel ilkesiyle
  tutarlı).
- Karolar ikon + ad + maliyet gösterir; maliyetler `buildings.json`'dan gelir,
  karşılanamayan maliyet mevcut `is-unaffordable` kilidiyle işaretlenir.
- Kısayol önerisi: sekmeler için `1–4`, panel aç/kapa için `B` (Faz F'de
  `defaultInputBindings` üzerinden bağlanır).
- Yol çizimi (`rtsRoadControls`) "Yol" karosunun arkasına taşınır: karo,
  bugünkü yol çizim modunu açar.

**İlerleme (2026-07-19):** Panel sol alta taşındı; Ekonomi/Lojistik/Yerleşim/
Askerî sekmeleri ve sabit 5×2 karo alanı uygulandı. Yapı karoları veri-güdümlü
İkon, ad ve maliyet taşır; Yol karosu yol modunu açar ve sağ tıkla bitirme
bilgisini panelin kendi durum satırında gösterir. Bağımsız yol kartı kaldırıldı.
İnşa ve seçim panelleri ortak 240 px dış yüksekliğe sahiptir. `1–4` ilgili
sekmeyi seçer (gizliyse paneli açar), `B` paneli açıp kapatır; Yerleşim
sekmesinde devre dışı "Tapınak — Yakında" karosu bulunur.

### Faz E — Sağ kolon

- Görev takipçisi katlanabilir "Görevler" kartına dönüşür.
- Saldırı/lojistik uyarıları ikonlu bantlar olur; tıklanınca kameraya odaklanma
  davranışı `rtsAttackWatch`'ta zaten varsa yeniden kullanılır.

## İlkeler ve Kısıtlar

- **UI framework yok** (React vb. göçü kapsamı üçe katlar): mevcut el yazımı
  DOM bileşenleri test edilebilir ve disiplinlidir, korunur.
- Paneller presentation-only kalır; karar `RtsApp`'te, görünüm panelde.
- Her faz küçük, build-geçen adımlarla ilerler: `npx tsc --noEmit` +
  `npm run smoke:browser` her adımda yeşil kalmalı.
- Türkçe etiketler mevcut haliyle korunur.

## Sıralama

Faz A tamamlandı. Kalan sıra: **C → D → F → E** (B'nin boru hattı kısmı
C'den önce, sanat üretimi en sona). C/D/F'nin ikon ihtiyacı B'deki boru hatta
bağlıdır ama geçici placeholder ikonlarla (mockup'taki şematik SVG'ler
başlangıç seti olabilir) B'nin sanat üretimini beklemeden ilerleyebilir.
D ile F aynı alt bölgeyi paylaştığı için art arda yapılmalı; ikisinin toplam
genişliği 1366 px'te yan yana sığmalıdır (mockup oranları: inşa ~%28, seçim
~%68).
