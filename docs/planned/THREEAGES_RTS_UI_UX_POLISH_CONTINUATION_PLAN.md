# ThreeAges RTS UI/UX İyileştirme Devam Planı

> **Durum:** Aktif devam planı
> **Tarih:** 2026-07-27
> **Amaç:** RTS'nin orta çağ görsel dilini korurken oyuncunun karar vermesi gereken bilgiyi görünür, kısa ve yanlış dokunmaya kapalı hâle getirmek.
> **Kapsam:** Seçim paneli, üst HUD, duraklat menüsü, görev kartı ve yol yerleştirme geri bildirimi.

---

## 1. Mevcut durum ve kesinleşen kararlar

### Tamamlananlar

- Birim seçim paneli, yapı seçim panelinin daha sade hiyerarşisine yaklaştırıldı.
  - Başlık doğrudan birim adıdır; gereksiz `Seçim` başlığı yoktur.
  - Birim sağlık, canlı görev/komut, duruş ve güçlü/zayıf bilgi kalır.
  - Sabit açıklama metni kaldırıldı; aynı rolün tekli seçimi altında gereksiz tekrar eden küçük slot/ikon gösterilmez.
  - Saldırı-Hareket, Koru, Serbest ve Dur artık basılabilir kart görünümünde değildir; kısayol hatırlatıcısı olarak nötr metindir.
  - Panelde scrollbar yoktur; içerik sığacak şekilde düzenlenir.

- Dar üst HUD için kaynaklar gizlenmeden kompakt düzen eklendi.
  - `1180px` altında arma, kaynak etiketi ve gelir satırı sadeleşir; kaynak miktarı/kapasitesi kalır.
  - `840px` altında HUD, kaynaklar üstte ve maç/yardımcı kontroller altta olacak şekilde iki satıra geçer.

- Duraklat menüsündeki kamera ayarları temaya uyarlandı.
  - `Kamera yumuşatma`, gerçek etkisini anlatan `Yakınlaştırma yumuşaklığı` olarak adlandırılır.
  - Her slider canlı sözel durum (`Yavaş/Normal/Hızlı`, `Anlık/Dengeli/Yumuşak`) ve `Varsayılan` geri alma eylemi taşır.
  - Başlangıç ve duraklat ekranında eylem butonları açılışta koyu ikincil yüzeydedir. Altın yalnızca hover, klavye odağı veya gerçek kalıcı seçim/işlem durumudur.

### Korunacak kurallar

1. HUD kaynakları her çözünürlükte görünür kalır; yer açmak için ekonomi verisi gizlenmez.
2. Görünüm değişiklikleri ekonomi, yol maliyeti, simülasyon hızı veya birim komutlarının davranışını değiştirmez.
3. Türkçe metin kısa, açık ve durum odaklıdır. Salt yazı puntosunu küçültmek taşma çözümü değildir.
4. Tehlikeli eylemler (`Teslim Ol`, `Yık`) nötr eylem gibi görünmez; mevcut onay akışı korunur.
5. Yeni durum düğmesi ya gerçek bir eylem olmalı ya da düğme görünümüne sahip olmamalıdır.

---

## 2. Sonraki uygulama sırası

### Faz UX-1 — Görev kartını kısa, taranabilir ve isteğe bağlı ayrıntılı yap

**Öncelik:** Yüksek

**Sorun:** Sağ üst görev kartındaki uzun açıklama, oyuncu haritayı oynarken sürekli okunacak metin gibi davranıyor. Başlık ve sonraki eylem kayboluyor.

**Hedef düzen:**

- Üst satır: `GÖREV 1/5` ve isteğe bağlı daralt/aç simgesi.
- Ana satır: Tek satır veya en fazla iki satır güçlü görev başlığı.
- Görev henüz anlatılıyorsa: en fazla iki kısa öğretici cümle.
- Sayısal ilerleme varsa ayrı ve sabit konumlu satır: ör. `0/1 Oduncu Kampı`.
- Ayrıntı metni sadece açıldığında görünür; kartın açık/kapalı durumu erişilebilir isim ve `aria-expanded` ile ifade edilir.

**Muhtemel dosyalar:**

- `src/game/rts/ui/rtsMissionPanel.ts`
- `src/style.css`
- Gerekirse görev metinlerini sağlayan tutorial/mission veri yüzeyi.

**Kabul kriterleri:**

- 1366×768'de görev kartı harita üzerinde gereksiz büyümez.
- Oyuncu yalnızca başlık ve ilerleme ile sıradaki eylemi anlayabilir.
- Ayrıntıyı açıp kapamak görev simülasyon durumunu değiştirmez.
- Uzun başlık/öğretici metin taşmaz; scrollbar oluşmaz.

### Faz UX-2 — Yol yerleştirme geri bildirimini başlangıç, önizleme ve bitiş olarak ayır

**Öncelik:** Yüksek

**Sorun:** Kare önizleme rotayı gösteriyor; ancak oyuncu ilk tıklamanın nerede kilitlendiğini ve sağ tıklamanın neyi bitireceğini hızlı okumuyor. Alt palet metni de tek uzun cümle oluyor.

**Hedef düzen:**

- İlk nokta konduğunda zeminde küçük, temaya uygun başlangıç işareti.
- Geçerli önizlemede bitiş ucu; geçersiz rota/karelerde ayrı kırmızı uyarı tonu.
- Palet durum metni iki parçaya ayrılır:
  - kısa kip: `Yol çiziliyor`
  - ikinci satır: `Sağ tık: bitir · 10 hücre · 40 Odun`
- Yol Sil kipinde geri dönüşü olmayan ağ bölünmesi uyarısı mevcut davranışla aynı kalır, yalnızca okunur hâle gelir.

**Muhtemel dosyalar:**

- `src/game/rts/roads/roadPlacementSystem.ts`
- `src/game/rts/ui/rtsRoadControls.ts`
- `src/game/rts/ui/rtsBuildPalette.ts`
- `src/game/rts/RtsApp.ts`
- `src/style.css`

**Kabul kriterleri:**

- Sol tıkla yol zinciri başlar, sağ tık/Escape mevcut bitirme/iptal davranışını korur.
- Geçerli ve geçersiz önizleme, renk körlüğüne bağımlı olmadan uç işareti ve metinle ayrılır.
- Maliyet yalnızca mevcut yol hücresi/maliyet hesabını yansıtır; UI hesap yapmaz.
- Mevcut yol ağı, lojistik ve silme güvenlik kuralları için motor testleri değişmeden geçer.

### Faz UX-3 — HUD yoğunluk ve küçük ekran kabul turu

**Öncelik:** Orta

**Amaç:** Yeni kompakt HUD'nin gerçek oyun değerleri ve yaygın viewport'larda düzenli kalmasını görsel olarak doğrulamak; yalnızca gerçek taşma bulunursa sınırlı CSS düzeltmesi yapmak.

**Kontrol noktaları:**

| Viewport | Beklenti |
|---|---|
| 1920×1080 | Arma, dört kaynak etiketi/gelir, maç bilgisi ve hız grubu aynı satırda okunur. |
| 1366×768 | Kaynaklar, nüfus, boş işçi, duraklat ve hız grubu çakışmaz; yatay sayfa taşması yoktur. |
| 1024×768 | Kaynak ikonları ve `mevcut/kapasite` görünür; ikincil kaynak metni sadeleşebilir. |
| 840px ve altı | İki HUD satırı görünür; seçim, görev ve bildirim panelleri yayınlanan HUD yüksekliğini temizler. |

**Kabul kriterleri:**

- Kaynaklar hiçbir breakpoint'te `display: none` ile kaybolmaz.
- `document.documentElement.scrollWidth <= window.innerWidth`.
- HUD yüksekliği değiştiğinde bildirim, görev ve debug panelleri `--rts-hud-bar-height` üzerinden doğru aşağı kayar.

### Faz UX-4 — Seçim ve yapı paneli tutarlılık turu

**Öncelik:** Orta

**Amaç:** İlk iyileştirmeden sonra işçi, muhafız, okçu, üretim binası, depo ve yarım inşaatın tek bir bilgi hiyerarşisiyle okunmasını kontrol etmek.

**Kontrol listesi:**

- Portre + başlık + can + tek ana durum sırası korunuyor mu?
- Aynı anda iki kez yazılan statik açıklama, ikon veya sayaç var mı?
- Üretim kuyruğu, depo kapasitesi ve inşaat ilerlemesi yalnızca bağlamda gösteriliyor mu?
- Birim kısayolları yalnızca gerçekten tıklanabilir olduğunda kart/düğme görünümünde mi?
- Tekli ve karışık grup seçiminde slot özeti doğru mu?
- Panel yüksekliği sabit kalırken scrollbar oluşuyor mu?

**Muhtemel dosyalar:**

- `src/game/rts/ui/rtsSelectionPanel.ts`
- `src/game/rts/ui/rtsSelectionView.ts`
- `src/style.css`

Bu faz, yeni özellik eklemekten çok screenshot ve manuel oynama sonucu bulunan gerçek tekrar/taşma sorunlarını küçük yamalarla kapatır.

---

## 3. Uygulama sınırları

- `RtsHudBar` yalnızca sunum ve canlı HUD bağlama yüzeyidir. Kaynak kapasitesi/gelir hesabı ekonomi sistemlerinde kalır.
- Yolun sağ tık önceliği `RtsApp` komut akışında kalır; açıklama metni ve DOM görünümü UI katmanına aittir.
- Yerleştirme önizlemesinin gerçek modelini gizleme. Geçerli/geçersiz bilgi zemin çerçevesi, uç işareti veya overlay ile verilir.
- Görev kartı salt okunurdur; görevi onaylayan veya simülasyonu değiştiren yeni düğme eklenmez.
- UI metinleri ve durum etiketleri Türkçe kalır.
- Kullanıcının çalışma ağacındaki ilgisiz değişikliklere dokunulmaz. Bu oturumda özellikle `public/game-data/presets/gameplay_proof.json` UI çalışmasının parçası değildir.

---

## 4. Doğrulama sırası

Her TypeScript değişikliğinden sonra:

1. `npx.cmd tsc --noEmit`
2. İlgili motor/UI testi
3. `npm.cmd run build:verify` (uygulanabilir tam kapı)
4. Playwright ile hedeflenen masaüstü ve dar viewport smoke kontrolü

### Bilinen smoke notu

`tests/smoke/rts-building-placement.spec.ts` geçmişte testin geçici layout dosyalarını yazabildi. Smoke çalıştırılırsa:

- yalnızca testin ürettiği `__playwright-smoke*.level.json` ve `public/project.3dgame.json` değişiklikleri test sonrası geri temizlenir;
- kullanıcıya ait çalışma ağacı değişiklikleri restore/revert edilmez;
- debug yüzeyindeki hız kontrolü ile oyuncu HUD'undaki hız kontrolü seçicilerde ayrı scope'lanır.

---

## 5. Sonraki oturum için başlangıç komutu

1. Bu belgeyi oku.
2. `Faz UX-1` ile başla: önce `rtsMissionPanel.ts` ve ilgili CSS'i incele.
3. Küçük, tamamlanabilir bir görev kartı dilimi uygula; doğrula; ardından `Faz UX-2`ye geç.
4. Manuel değerlendirme için her görsel dilim sonunda screenshot iste veya lokal tarayıcı görüntüsü sun.

