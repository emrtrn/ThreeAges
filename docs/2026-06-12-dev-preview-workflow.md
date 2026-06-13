# Dev Preview ve Layout İş Akışı

> Tarih: 2026-06-12 | Durum: uygulandı | Kapsam: hızlı kontrol + layout verisini sahneden ayırma

## Sabit URL

PC tarayıcı/editör kontrolü için sabit adres:

```text
http://127.0.0.1:5173/?editor&debug
```

Bu URL yalnızca Vite dev server açıkken çalışır. Port `5173` artık `--strictPort` ile sabitlenir; port doluysa Vite başka porta kaçmaz, hata verir.

## VS Code görevleri

`Terminal > Run Build Task` varsayılan olarak `Open Layout Editor` görevini çalıştırır.

Bu görev:

- Vite server kapalıysa `npm run editor` ile başlatır.
- Editör URL'sini tarayıcıda açar.
- Server loglarını `.dev-server/dev-server.out.log` ve `.dev-server/dev-server.err.log` içine yazar.

Diğer görevler:

| Görev | Kullanım |
| --- | --- |
| `Editor Server: Local (Terminal)` | Editör server'ını VS Code terminalinde açık tutar. |
| `Editor Server: LAN Phone Test` | Aynı Wi-Fi'daki telefon testi için `0.0.0.0:5173` açar. |
| `Build` | `npm run build` çalıştırır. |
| `Stop Dev Server` | Port `5173` üzerinde dinleyen dev server sürecini kapatır. |

## Komutlar

```sh
npm run editor
npm run editor:lan
npm run dev:local
npm run dev:lan
npm run build
npm run preview:local
```

## Layout verisi

Render test odası artık burada:

```text
public/layouts/render-test-room.json
```

`SceneApp` bu dosyayı runtime'da fetch eder. Editör modunda `Save Layout` düğmesi Vite middleware endpoint'i olan `/__save-layout` üzerinden bu dosyaya yazar.

## Editör arayüzü

Editör Unreal'dan sadeleştirilmiş üç panelli bir düzene sahip:

- Orta: WebGL viewport.
- Sol: Content Browser; oda parçaları, mobilyalar ve karakterler sürüklenebilir asset kartlarıdır.
- Sağ: Details; seçili objenin `X/Y/Z`, `Rotation Y` ve `Scale` değerleri düzenlenir.
- Üst bar: `Select`, `Move`, `Rotate`, `Scale`, `Delete`, `Save Layout`.

Şimdiki kapsam: asset sürükle-bırak veya tıkla-yerleştir, viewport'ta seçim, seçili objeyi move gizmo ile taşıma, rotate gizmo ile döndürme, scale gizmo ile uniform ölçekleme, Details üzerinden transform düzenleme, silme ve JSON'a kaydetme.

Snap sistemi Unreal Editor yaklaşımını sadeleştirir:

- `Move`: `1`, `10`, `100` birim grid.
- `Rotate`: `5`, `10`, `15`, `30`, `45`, `90` derece.
- `Scale`: `0.05`, `0.1`, `0.25`, `0.5`, `1` additive scale artışı.

Gizmo renkleri Unreal eksen konvansiyonunu takip eder: kırmızı X, yeşil Y, mavi Z. Bu prototipte scale tekil `scale` alanı kullandığı için scale gizmo uniform ölçekleme yapar.
