# Motor Kararı: Three.js vs Babylon.js (tech-architect analizi)

> Tarih: 2026-06-12 | Durum: **KARAR — Emre onayladı (2026-06-12)** | Kapsam: 08-milestones H1 motor kararı
> Öneri: **Three.js** (npm `three@0.184.0`, Haziran 2026 itibarıyla güncel; Babylon karşılaştırması `@babylonjs/core@9.12.0` üzerinden)

## 1. Oyunun gerçek teknik ihtiyaç profili

Karar genel "hangi motor daha iyi" sorusuyla değil, **bu oyunun GDD'den çıkan ihtiyaç listesiyle** verildi:

| İhtiyaç (GDD kaynağı) | Teknik karşılık | Motor bağımlılığı |
| --- | --- | --- |
| Tek oda, 4 sabit kamera açısı, serbest orbit yok (05) | Basit sahne grafı + sabit kamera rig'i | **Düşük** — iki motorda da önemsiz |
| Sürt-sil kir maskesi ≤ 100 ms (M2) | Render-target'a fırça boyama + decal shader'da alpha maskesi | **Düşük** — her ikisinde de özel shader işi; motor "hazır" vermiyor |
| Grid-snap hayalet yerleştirme (M4) | Raycast + özel grid mantığı | **Düşük** — iş mantığı zaten motor-bağımsız modül (L11) |
| Kenney GLB lazy-load + sıkıştırma (L8) | glTF loader + Draco/meshopt + KTX2 | **Düşük** — ikisinde de olgun |
| Duvar saydamlaştırma (05 açık sorusu) | Kameraya bakan duvar materyal opaklığı | **Düşük** |
| Instancing (perf bütçesi) | InstancedMesh / thin instances | **Düşük** |
| Partikül + tween juice (06) | Koddan efekt (L2) | **Orta** — Babylon'da hazır partikül sistemi var; Three'de elle/küçük lib |
| HUD ve menüler (05) | **Hibrit HTML/CSS** — motor GUI'si kullanılmayacak | **Yok** |

Sonuç: Oyunun zor kısımları (sürt-sil hissi, zevk puanlama, grid yerleştirme) **iki motorda da bizim yazacağımız kod.** Motor farkı; paket boyutu, öğrenme/iterasyon hızı ve agent-destekli üretim kalitesinde ortaya çıkıyor.

## 2. Karşılaştırma tablosu

Ölçütler: GDD 00-overview açık sorusundaki 4 kriter + tech-architect standart ölçütleri.

| Ölçüt | Three.js (r184) | Babylon.js (9.12) | Kazanan |
| --- | --- | --- | --- |
| **Paket boyutu / TTI** | Tam import 724 KB min / **182 KB gzip** (bundlephobia, doğrulandı); tree-shake ile daha az. | Tree-shaken ES6 ile bile tipik **~1–1,5 MB min / ~400 KB+ gzip**; topluluk forumlarında bundle şişmesi kronik konu. JS parse süresi de düşük cihazda TTI'ya yazar. | **Three** (net) |
| **GLB pipeline olgunluğu** | GLTFLoader + Draco/meshopt/KTX2 olgun; `gltf-transform` CLI ekosistemiyle doğal eşleşme. | glTF loader'ı sektörde referans kalitesinde; sanitize/inspect araçları güçlü. | Berabere (Babylon hafif önde, ama ikisi de fazlasıyla yeterli) |
| **Mobil performans (low-end Android, WebGL2)** | Daha ince runtime; draw call kontrolü elde. | Karşılaştırılabilir; motor katmanı biraz daha kalın. | Berabere (asıl belirleyici bizim sahne disiplinimiz) |
| **Agent-destekli geliştirilebilirlik** | Eğitim verisi/örnek havuzu açık ara en geniş 3D web kütüphanesi; Claude agent'ları daha isabetli, daha az uydurma API'li kod üretir. Kir-maskesi, instancing, GLB optimizasyonu için bire bir örnek bolluğu. | Dokümantasyon mükemmel ama topluluk örnek hacmi daha küçük; agent üretiminde API isabeti daha düşük. | **Three** (GDD'nin açık kriteri; 6 dev agent'lı iş akışımızda çarpan etkisi) |
| **İterasyon hızı / hazır piller** | "Kütüphane" — picking, drag, debug GUI elle kurulur (bir kez, ~H1-H2). | "Motor" — PointerDragBehavior, DynamicTexture, Inspector (mükemmel debug aracı), hazır partikül. | **Babylon** |
| **Emre'nin tecrübesiyle uyum** | Phaser'dan tanıdık "kütüphane + kendi mimarin" modeli. | Scene/Observable/Behavior yapısı Unreal zihin modeline daha yakın. | Babylon (hafif) |
| **API kararlılığı** | Aylık sürüm, kırıcı değişiklikler olağan → **sürüm pinlenir**, bilinçli yükseltilir. | Geriye uyumluluk politikası örnek düzeyde. | **Babylon** |
| **3 aylık takvime etki** | İnce başlangıç; eksik piller dar kapsam (tek oda, sabit kamera) sayesinde ucuz. | Hazır piller H2-H3'te zaman kazandırır ama paket/TTI bütçesi H11'de geri ödetir. | Three (hafif) |

## 3. Öneri ve gerekçe: Three.js

1. **Poki çıtasının en sert maddesi yük süresi** (ilk anlamlı ekran < 3 sn, ilk paket < 5 MB). Motor için 182 KB gzip ile başlamak, ~400 KB+ ile başlamaya göre bütçenin asset'e (GLB/atlas/ses) kalmasını sağlar; düşük cihazda JS parse süresi de kısalır. Bu fark her teslimde değil, **her açılışta** ödenir.
2. **Agent-destekli geliştirme GDD'de yazılı bir karar kriteri** ve bu depo 6 dev agent'la çalışacak. Three.js'in devasa örnek havuzu, agent'ların ürettiği kodun ilk seferde çalışma oranını belirgin yükseltir — solo + 13 haftalık takvimde bu pratik olarak "ikinci geliştirici" etkisi.
3. **Babylon'un avantajları bu oyunda az yer buluyor:** GUI'si kullanılmayacak (hibrit HTML/CSS kararı), serbest kamera yok (ArcRotateCamera gereksiz), fizik yok, oyunun çekirdek mekanikleri zaten özel kod. Babylon'un kalın motor katmanına paket bütçesinden ödediğimizin karşılığını alamıyoruz.
4. **Backlog'daki Babylon eğilimi analiz değil, not:** "iç mimari dekoratör planıyla birebir örtüşüyor" ifadesi kaynak web sohbetinden gelen bir izlenim; ölçüt tablosunda karşılığı çıkmadı.

### Babylon'dan vazgeçtiklerimiz ve telafileri

| Kayıp | Telafi |
| --- | --- |
| Inspector (sahne debug) | three.js devtools tarayıcı eklentisi + `lil-gui` debug paneli + Spector.js (draw call analizi) |
| PointerDragBehavior | M4 zaten özel grid mantığı istiyor; raycast + pointer event sarmalayıcısı H2'de bir kez yazılır |
| Hazır partikül sistemi | L2 ilkesi gereği efektler zaten koddan; ince özel partikül modülü (juice-audio-dev) — önceki projede Phaser'da yapıldı, model hazır |
| Geriye uyumlu API | `three` sürümü **pinlenir** (0.184.0); yükseltme yalnız bilinçli, migration guide ile (proje 3 ay — muhtemelen hiç gerekmez) |

### Kararı geri döndürecek sinyal

H1 render testi (bir Kenney odası + instancing + sürt-sil maskesi prototipi) mobilde hedefe ulaşamazsa veya geliştirme hissi beklenmedik sürtünme üretirse, H1 sonunda Babylon'a dönüş maliyeti düşüktür: iş mantığı modülleri (M1–M9) motor-bağımsız yazılacak, motor teması yalnız `scene/` katmanında yaşayacak.

## 4. Önerilen stack iskeleti (H1)

- **Build:** Vite + TypeScript (hızlı HMR, kolay code-splitting → GLB/kategori lazy-load `import()` ile).
- **3D:** `three@0.184.0` (pinli) + `GLTFLoader` + meshopt decoder; sıkıştırma pipeline'ı `tools/` altında `@gltf-transform/cli` (meshopt + KTX2 + prune).
- **UI:** Hibrit HTML/CSS overlay (05 kararı) — motor GUI'si yok.
- **Debug:** `lil-gui` + Spector.js + fps/draw call overlay (qa-poki ölçüm standardı).
- **Ses:** Howler.js veya ince WebAudio sarmalayıcı (L3 merkezi ses sistemi) — H3'te kesinleşir.
- **Modül sınırları:** M1–M9 saf TS modülleri (motor import etmez); `scene/` katmanı orkestratör (L11).

## 5. İlk haftanın teknik görev listesi (H1, karar onayı sonrası)

1. Vite + TS iskeleti, `src/` yapısı (CLAUDE.md klasör planına göre).
2. Kenney Furniture Kit'ten 1 oda + ~10 mobilya GLB: gltf-transform sıkıştırma → yükleme → InstancedMesh testi.
3. Mobil ölçüm (gerçek orta seviye Android, Chrome): fps + ilk yük boyutu + ilk ekran süresi → qa-poki raporu.
4. Sürt-sil maskesi teknik spike'ı (render-target fırça + decal shader) — H3'ün riskini öne çek.
5. 4 açılı kamera rig'i + duvar saydamlaştırma spike'ı — 05'in "en erken UX riski" dik kadraj sorusuna veri.

## Kaynaklar

- npm registry: [three 0.184.0](https://www.npmjs.com/package/three), [@babylonjs/core 9.12.0](https://www.npmjs.com/package/@babylonjs/core) (2026-06-12'de doğrulandı)
- [Bundlephobia — three@0.184.0](https://bundlephobia.com/package/three@0.184.0): 724 KB min / 182 KB gzip
- Babylon bundle boyutu topluluk tartışmaları: [ES6 modules and tree shaking](https://forum.babylonjs.com/t/es6-modules-and-tree-shaking-bundle-size/22734), [Treeshaking but bundle still over 5MB](https://forum.babylonjs.com/t/treeshaking-but-bundle-still-over-5mb/44370)
- GDD: `gdd/home-makeover/00-overview.md` (karar kriterleri), `02-mechanics.md` (M2/M4 teknik notlar), `05-ux-ui.md` (kamera/input), `08-milestones.md` (H1 tanımı)
