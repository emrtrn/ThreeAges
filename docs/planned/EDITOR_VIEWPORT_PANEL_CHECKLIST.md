# Editor Viewport Panel İyileştirme Checklist'i

## Amaç

Editör viewport'unu pencere boyutuna göre ölçeklenen görsel bir alandan çıkarıp,
kendi ölçülerini yöneten gerçek bir çalışma paneline dönüştürmek. Stats ve diğer
viewport overlay'leri panel sınırları içinde kalmalıdır.

## Mevcut Durum

- Canvas masaüstü editörde sabit CSS offset'leriyle orta alana yerleştiriliyor.
- Renderer ve post-process çözünürlüğü hâlâ pencere ölçülerini kullanıyor.
- `editor-viewport-frame` yalnızca çerçeve ve dış alan maskesi görevi görüyor.
- Stats, viewport'tan bağımsız sabit koordinatlarla konumlandırıldığı için
  Outliner ve üst araç çubuğunun altında kalabiliyor.

## Uygulama Checklist'i

### 1. Ölçüm ve güvenli hazırlık

- [ ] Canvas, kamera, post-process ve pointer koordinatı kullanan resize
      noktalarını belirle.
- [ ] Mevcut viewport, Content Drawer açık/kapalı ve Stats görünümü için kısa
      bir başlangıç ekran kaydı veya smoke kanıtı al.

### 2. Renderer'ı viewport ölçüsüne bağlama

- [ ] Renderer boyutunu `window.innerWidth/innerHeight` yerine canvas veya
      viewport host'un gerçek `clientWidth/clientHeight` değerlerinden üret.
- [ ] Kamera aspect/projection ve post-process hedeflerini aynı ölçülerle güncelle.
- [ ] Boyut değişikliklerini `ResizeObserver` ile takip et.
- [ ] Cihaz piksel oranını mevcut performans sınırları içinde koru.

### 3. Gerçek viewport paneli

- [ ] Canvas'ı barındıran gerçek bir `editor-viewport-host` oluştur.
- [ ] Mevcut çerçeve, arka plan ve köşe görünümünü bu host'a taşı.
- [ ] `100vmax` dış alan maskesini ve tekrarlanan sabit canvas offset'lerini kaldır.
- [ ] Content Drawer açılıp kapandığında host'un kullanılabilir alana doğal olarak
      uyduğunu doğrula.

### 4. Viewport overlay'leri

- [ ] Stats'i viewport host içinde sol üst köşeye bağla; sabit sayfa offset'lerini
      kaldır.
- [ ] Stats'in Outliner, toolbar, Details ve Content Drawer altında kalmadığını
      doğrula.
- [ ] Gelecekte eklenecek viewport overlay'leri için aynı host'u ortak yerleşim
      yüzeyi olarak kullan.

### 5. Etkileşim ve regresyon doğrulaması

- [ ] Raycasting ve pointer normalizasyonunu canvas `getBoundingClientRect()`
      ölçülerine göre doğrula.
- [ ] Select/move/rotate/scale gizmo etkileşimlerini kontrol et.
- [ ] Perspective ve orthographic kamera görünümlerinde oran bozulması olmadığını
      doğrula.
- [ ] Content Drawer açık/kapalı ve pencere yeniden boyutlandırma senaryolarını
      test et.
- [ ] `npx.cmd tsc --noEmit` çalıştır.
- [ ] İlgili hedefli browser smoke testlerini çalıştır; ardından mümkünse
      `npm.cmd run build:verify` çalıştır.

## Tamamlanma Kriterleri

- Viewport yalnızca kendisine ayrılan panel alanında render edilir.
- Renderer, kamera ve post-process aynı gerçek viewport ölçülerini kullanır.
- Stats tamamen görünür ve viewport paneline göre konumlanır.
- Panel/drawer boyutu değiştiğinde manuel offset güncellemesi gerekmez.
- Seçim, raycasting ve transform gizmo davranışlarında regresyon oluşmaz.

## Kapsam Dışı

- Dock/undock veya sürüklenebilir panel sistemi.
- Çoklu ya da bölünmüş viewport.
- Genel editor shell yeniden tasarımı.
- Stats içeriğinin veya performans metriklerinin yeniden tasarlanması.
