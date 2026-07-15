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

- [x] Canvas, kamera, post-process ve pointer koordinatı kullanan resize
      noktalarını belirle.
- [x] Mevcut viewport, Content Drawer açık/kapalı ve Stats görünümü için kısa
      bir başlangıç ekran kaydı veya smoke kanıtı al.

### 2. Renderer'ı viewport ölçüsüne bağlama

- [x] Renderer boyutunu `window.innerWidth/innerHeight` yerine canvas veya
      viewport host'un gerçek `clientWidth/clientHeight` değerlerinden üret.
- [x] Kamera aspect/projection ve post-process hedeflerini aynı ölçülerle güncelle.
- [x] Boyut değişikliklerini `ResizeObserver` ile takip et.
- [x] Cihaz piksel oranını mevcut performans sınırları içinde koru.

### 3. Gerçek viewport paneli

- [x] Canvas'ı barındıran gerçek bir `editor-viewport-host` oluştur.
- [x] Mevcut çerçeve, arka plan ve köşe görünümünü bu host'a taşı.
- [x] `100vmax` dış alan maskesini ve tekrarlanan sabit canvas offset'lerini kaldır.
- [x] Content Drawer açılıp kapandığında host'un kullanılabilir alana doğal olarak
      uyduğunu doğrula.

### 4. Viewport overlay'leri

- [x] Stats'i viewport host içinde sol üst köşeye bağla; sabit sayfa offset'lerini
      kaldır.
- [x] Stats'in Outliner, toolbar, Details ve Content Drawer altında kalmadığını
      doğrula.
- [x] Gelecekte eklenecek viewport overlay'leri için aynı host'u ortak yerleşim
      yüzeyi olarak kullan.

### 5. Etkileşim ve regresyon doğrulaması

- [ ] Raycasting ve pointer normalizasyonunu canvas `getBoundingClientRect()`
      ölçülerine göre doğrula.
- [ ] Select/move/rotate/scale gizmo etkileşimlerini kontrol et.
- [x] Perspective ve orthographic kamera görünümlerinde oran bozulması olmadığını
      doğrula.
- [x] Content Drawer açık/kapalı ve pencere yeniden boyutlandırma senaryolarını
      test et.
- [x] `npx.cmd tsc --noEmit` çalıştır.
- [x] İlgili hedefli browser smoke testlerini çalıştır; ardından mümkünse
      `npm.cmd run build:verify` çalıştır.

## 2026-07-15 Doğrulama Kaydı

- `tests/smoke/editor-viewport-panel.spec.ts`: `?editor&debug` altında canvas ve
  Stats'in host içinde kaldığını; WebGL drawing-buffer oranının host ile eşleştiğini;
  Content Drawer ve pencere boyutu değiştiğinde panelin yeniden ölçüldüğünü doğrular.
  Aynı smoke, Top (orthographic/wireframe) ve Perspective (lit) geçişlerinde de
  canvas oranını denetler.
- `npx.cmd tsc --noEmit` ve `npm.cmd run build:verify` başarılıdır. İkincisi import
  sınırlarını, üretim derlemesini, 908 engine kontrolünü ve strict dist doğrulamasını kapsar.
- Sonraki dar doğrulama dilimi: gerçek canvas gizmo sürüklemelerini browser'da
  kanıtlamak. WebGL içindeki handle'lar DOM kimliği taşımadığından, bunun için
  kararlı bir handle-keşif test yüzeyi gerekir.

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
