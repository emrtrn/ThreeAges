# Forge VFX 3D Model Parçacıkları ve Yapı Hasarı Planı

Oluşturulma tarihi: 2026-07-30  
Durum: Planlandı  
Kapsam: Forge Editor VFX sistemine 3D model parçacığı desteği eklemek; bunu oyun-özel yapı hasarı ve kontrollü çöküş efektlerinin düzenlenebilir altyapısı olarak kullanmak.

## 1. Amaç ve ürün kararı

Yapıların altı görsel hasar seviyesi, altı ayrı yıkım animasyonu veya altı benzersiz model üretme zorunluluğu doğurmamalıdır. Yapı runtime'ı sağlık eşiğini belirler; Forge VFX asset'i duman, taş, kiremit ve tahta gibi sunum öğelerini üretir.

İlk teslimin ürün kararı:

- Bir VFX asset'i `sprite` ya da `mesh` renderer kullanabilir.
- `mesh` parçacığı, Content Drawer'da bulunan allowlist'li bir 3D model asset'ine başvurur; dosya yolu, URL veya kullanıcı metniyle keyfi asset yüklemez.
- Aynı efekt, birden çok debris modeli arasından deterministik/rastgele seçim yapabilir.
- Oyun özelindeki sağlık eşikleri ve hangi binanın hangi efekti tetiklediği `game/` runtime/data katmanında kalır. `engine/` ve `editor/` yalnızca genel VFX yeteneğini sağlar.
- İlk sürüm fizik motoru, mesh-mesh çarpışması, kırılabilir mesh ve otomatik mesh parçalama içermez.

Bu ayrım sayesinde sanatçı/dizayncı Content Drawer ve VFX editöründe preset ayarlarını değiştirirken, temel motor kodu veya bina animasyonları çoğalmaz.

## 2. Hedef kullanım örnekleri

| Kullanım | Renderer | Önerilen davranış |
| --- | --- | --- |
| Baca/çatı dumanı | `sprite` | Döngülü, düşük hız, yukarı yön, kalite profiline göre yoğunluk |
| Hafif hasar taşı/kiremiti | `mesh` | Seyrek burst, düşük adet, gravity, kısa yaşam |
| Ağır hasar tahta/duvar parçası | `mesh` | Daha geniş hız aralığı ve dönüş, kontrollü maksimum adet |
| Çöküş tozu | `sprite` | Tek seferlik burst, kısa süreli, opaklığı azalan |
| Kontrollü çöküş enkazı | `mesh` | Birkaç büyük parça; bina runtime'ının zamanlamasına bağlı |

## 3. Veri sözleşmesi (önerilen schema 3)

Mevcut schema 2 `renderer` bloğu geriye uyumlu kalır. 3D model desteği, schema 3'te aşağıdaki genel biçimle eklenir:

```ts
type RendererType = "sprite" | "mesh";

interface ParticleMeshRendererBlock {
  type: "mesh";
  modelIds: string[];          // Content Drawer model asset id'leri
  materialMode: "source" | "tint";
  castShadow: boolean;
  receiveShadow: boolean;
  maxModelParticles: number;   // maxParticles'ı ayrıca güvenli biçimde sınırlar
}
```

Ortak `initialize` ve `update` alanları her iki renderer türünde de aynıdır: başlangıç ölçeği/ölçek aralığı, doğrusal hız, yön, yayılım açısı, dönüş, açısal hız, gravity, drag, acceleration ve yaşam süresi. Model parçacıkları için `startColor`, `endColor`, `opacity`, `softness`, `texture` ve `subUV` ya uygulanmaz ya da editörde renderer türüne göre gizlenir. Uygulanmayan alanlar asset'ten silinmek zorunda değildir; normalize edilmiş sözleşme onların runtime etkisini açıkça tanımlar.

Kararlar:

- `modelIds` boşsa `mesh` renderer geçersizdir; validator asset'i reddeder ya da güvenli `sprite` varsayılanına dönüştürür. Tercih uygulama başlamadan önce netleştirilir; sessizce kaydetme yoktur.
- Referanslar manifest'te tanınan model id'leriyle doğrulanır.
- Schema 1 ve 2 asset'leri sprite olarak okumaya devam eder. Kaydetme yalnızca kullanıcı mesh seçmişse schema 3 üretir.
- Maksimum canlı mesh parçacığı hem efekt asset'i hem global kalite ayarı tarafından sınırlandırılır.

## 4. Uygulama fazları

### Faz 0 — Keşif, sözleşme ve başarı ölçütü

- [x] Mevcut `engine/vfx`, `engine/render-three`, VFX preview ve oyun runtime tüketicilerinin kesin veri akışını çıkar.
- [x] Model asset manifest tiplerini, GLTF yükleme/clone politikasını ve asset hazır olma (readiness) sinyallerini doğrula.
- [x] Schema 3, geriye uyumluluk ve hatalı/eksik model referanslarının davranışı için kısa bir ADR veya bu dokümana karar kaydı ekle.
- [x] Hedef bütçeyi belirle: efekt başına ve sahne genelinde maksimum canlı mesh parçacığı, görünürlük mesafesi ve gölge politikası.
- [x] Kabul sahnelerini seç: boş VFX preview, Content Drawer asseti, oyun içi hafif/ağır hasar ve çöküş.

Çıkış kriteri: veri biçimi ve performans sınırı kabul edilmiş; implementation başlamadan eksik asset/validator kararı kalmamış olmalı.

Karar kaydı (2026-07-30): sprite effect assetleri schema 2 olarak kalır. 3D model renderer seçen assetler schema 3 olarak kaydedilir; schema 1/2 okumaya devam eder. Model referansı yalnızca manifest asset id'si taşır; host tarafındaki resolver bu id'nin statik mesh olduğunu doğrulamadan GLTF yüklemez. İlk güvenlik ve performans sınırı en fazla 8 alternatif model, mesh effect başına en fazla 256 canlı parça ve varsayılan kapalı shadow casting'dir.

### Faz 1 — Genel VFX veri modeli, normalizasyon ve kaydetme

- [x] `ParticleRendererBlock`ı ayırt edici union'a dönüştür; sprite varsayılanı ve mevcut schema 2 okumasını koru.
- [x] `normalizeEffectDefinition`a schema 3 normalizasyonu, sınırlar ve güvenli varsayılanları ekle.
- [x] Preset klonlama, eşitlik, load/save ve runtime dönüşümlerini yeni renderer türü için güncelle.
- [ ] `tools/saveValidator.ts` içinde yeni alanları allowlist et ve model id doğrulamasını parser ile aynı sözleşmede uygula.
- [x] Geçersiz veri, boş dizi, tekrar eden id, aşırı parça limiti ve eski schema için birim testleri yaz.

Çıkış kriteri: sprite assetleri işlev düzeyinde geriye uyumlu, mesh asseti kaydedilip tekrar açıldığında kayıp alan olmadan normalize edilebilmeli.

### Faz 2 — Three.js instanced mesh parçacık runtime'ı

- [x] `THREE.Points` sprite yolunu bozmadan ikinci bir mesh-particle render yolu ekle.
- [x] Modeli bir kez yükle; uyumlu mesh geometrilerini instance edilebilir kaynaklara dönüştür ve parçacık başına clone üretme.
- [x] Konum, ölçek, quaternion/dönüş, hız ve yaşam süresi simülasyonunu ortak particle state'te uygula.
- [x] Her frame yalnızca aktif instance matrislerini güncelle; ölü slotları görünmez yap ve bellek tahsisini sıcak döngüden çıkar.
- [x] Modelde çoklu mesh/material bulunması için ilk sürüm davranışını belirle: destekle, tek mesh ile sınırla veya önbake talep et. Davranış editörde görünür hata/uyarı üretmeli.
- [x] Varsayılan olarak shadow casting kapalı tut; yalnızca düşük adetli büyük enkaz presetlerinde açık seçeneğini sun.
- [x] Asset yüklenemediğinde hata kaydıyla güvenli no-op/fallback uygula; render döngüsünü veya VFX preview'ı bozmamalı.

Çıkış kriteri: bir mesh VFX, bağımsız preview ve oyun sahnesinde sınırlı sayıda instanced parça ile belirlenen hareketi sergiler; sprite VFX'leri değişmez.

Uygulama kararı (2026-07-30): mesh renderer, her kaynak GLTF içindeki render edilebilir primitive'i instance kaynağı sayar. Birden çok primitive içeren modellerde ilk sürüm bunlar arasında bağımsız seçim yapar; büyük, birleşik bir debris modeli gerekiyorsa içerik tek primitive olarak dışa aktarılmalıdır. Kaynak GLTF geometry/material'leri paylaşılır; yalnızca instance matrisleri efekt başına tutulur.

### Faz 3 — VFX editörü ve Content Drawer iş akışı

- [x] Renderer Type seçicisi (`Sprite` / `3D Model`) ekle.
- [ ] `3D Model` seçildiğinde Content Drawer uyumlu modelleri filtreleyen asset picker, seçili modeller listesi, kaldırma ve sıra/random seçim denetimleri ekle.
- [x] Mesh'e özgü alanları göster; sprite'a özgü texture/subUV/softness alanlarını bağlama göre gizle veya devre dışı bırak.
- [x] Mevcut canlı preview'ı seçilen gerçek modelle güncelle; model yüklenirken belirgin loading/invalid durumları göster.
- [ ] Undo/redo, dirty state, save/reload ve klavye ile erişilebilir alanların tüm yeni kontrolleri kapsadığını doğrula.
- [ ] İçerik browser'ında mesh VFX asseti için net bir ikon/özet oluştur.

Çıkış kriteri: kod düzenlemeden Content Drawer'dan bir model seçilip debris efekti oluşturulabilir, preview edilebilir, kaydedilip yeniden düzenlenebilir.

### Faz 4 — Hasar efekt presetleri ve bina entegrasyonu

- [ ] Genel VFX presetlerine en az `debris-stone`, `debris-wood`, `debris-tile` ve `collapse-dust` ekle; bunlar proje asset id'si yerine genel sözleşme örneği veya proje tarafındaki somut preset olarak konumlandırılsın.
- [x] Oyun data/runtime'ında sağlık eşiklerini tanımla: normal (%100–66), hafif hasar (%65–31), ağır hasar (%30–1), çöküş (%0).
- [x] Hafif/ağır hasar girişinde dumanı başlat/durdur, materyal/decal/hasarlı modül kararlarını oyun sunum katmanına bağla.
- [ ] Hafif titreşim ve seyrek debris tetiklerini efekt assetlerinden ayarlanabilir kıl; sürekli olarak her kare yeni efekt oluşturmaktan kaçın.
- [ ] %0 olayında ortak kontrollü çöküş zaman çizelgesini çalıştır: kısa titreme, alçalma/eğilme, burst debris + dust, yıkıntı sunumu ve gameplay collider/state geçişi.
- [ ] Birim/yapı için aynı VFX'in istemsizce üst üste çoğalmasını engelleyecek lifecycle/cleanup kurallarını ekle.

Çıkış kriteri: bir referans binada dört sağlık durumu görünür biçimde ayrılır; çöküş, opaklığı azaltıp zemine gömme yerine kontrollü bir olay olarak okunur.

### Faz 5 — Kalite, performans ve içerik üretim rehberi

- [x] `particleDensity` kalite ayarının hem sprite hem mesh spawn/adet sınırına nasıl uygulanacağını tanımla ve uygula.
- [ ] Uzak mesafe, görünmez emitter ve eşzamanlı yıkım için culling/limit davranışını ölç.
- [ ] RTS performans senaryosuna birden fazla hasarlı/yıkılan bina örneği ekle; draw call, üçgen, aktif instance ve frame-time telemetrisi kaydet.
- [ ] Orta/düşük kalite profillerinde beklenen görsel azaltmayı doğrula; gameplay olayları aynı kalmalı, yalnızca efekt yoğunluğu azalmalı.
- [ ] Sanat üretim kılavuzu ekle: düşük poligon, ortak materyal, pivot/orijin, ölçek, gölge, maksimum alt mesh ve isimlendirme kuralları.
- [ ] Gerekirse performans ölçümüne dayanarak model parçacığına özel global budget/cap ekle.

Çıkış kriteri: kabul sahnesi hedef bütçede çalışır; çoklu çöküşte frame-time veya draw-call regresyonu ölçülmüş ve kabul edilmiş sınırlar içindedir.

## 5. Mimari akış

```text
game yapı sağlığı / çöküş olayı
            │  (effect id, konum, yön, seed)
            ▼
Forge genel VFX runtime
            │
            ├── sprite renderer → duman / toz
            └── instanced mesh renderer → taş / kiremit / tahta
                                      ▲
Content Drawer → VFX asset → model asset id'leri
```

## 6. Test ve teslim kontrol listesi

### Veri ve güvenlik

- [ ] Eski schema 1 ve schema 2 sprite assetleri aynı şekilde yüklenir.
- [ ] Schema 3 mesh asseti normalize edilir, save sonrası alan kaybetmez.
- [ ] Save validator yeni renderer ve mesh alanlarını kabul eder; bilinmeyen, bozuk veya allowlist dışı model referansını güvenli biçimde reddeder/temizler.
- [ ] Manifest dışı URL/path ile model yükleme mümkün değildir.
- [ ] Aşırı `maxParticles`, model sayısı ve sayısal değerler limitlenir.

### Runtime

- [ ] Sprite ve mesh emitter aynı sahnede çalışır; birinin yaşam döngüsü diğerini etkilemez.
- [ ] Mesh parçacıkları gravity, drag, velocity, random rotation ve lifetime değerlerine uyar.
- [ ] Efekt durdurulduğunda veya sahibi kaldırıldığında instance, event listener ve asset referansı sızıntı bırakmaz.
- [ ] Model yükleme hatası render döngüsünü kesmez ve editörde anlaşılır görünür.
- [ ] Shadow seçeneği kapalıyken debris yeni gölge draw-call yükü oluşturmaz.

### Editor ve içerik

- [ ] Content Drawer'dan uyumlu model seçme, çoklu seçim, kaldırma ve kaydetme akışı çalışır.
- [ ] Preview, seçilen modeli ve ayar değişikliklerini canlı gösterir.
- [ ] Undo/redo ile renderer tipi ve model listesi geri/ileri alınabilir.
- [ ] Sprite düzenleme ekranında mevcut alanlar korunur.

### Oyun sunumu

- [ ] Referans yapı %66, %31 ve %0 eşiklerini yalnızca bir kez ve doğru sırada işler.
- [ ] Hafif ve ağır hasar, normal binadan ayırt edilebilir ama okunurluğu bozmayacak ölçüdedir.
- [ ] Çöküşte debris/toz görünür; oyun durumu ve collider geçişi görsel efektin bitmesini beklemeden doğru zamanda gerçekleşir.
- [ ] Aynı anda çoklu yıkımda efekt sayısı/bütçesi kontrollü kalır.

### Zorunlu doğrulama komutları

```powershell
npx.cmd tsc --noEmit
npm.cmd run test:engine
npm.cmd run build:verify
git diff --check
```

- [ ] VFX editor preview, Content Drawer seçimi ve `?editor` kaydet-yeniden aç akışı için Playwright smoke testi eklenmiş ve çalıştırılmıştır.
- [ ] Oyun içi hasar/çöküş akışı için uygun Playwright smoke veya tekrarlanabilir debug senaryosu çalıştırılmıştır.
- [ ] Engine/render değişikliği olduğundan, değişiklik tamamlandığında yerel kalite/performance kontrolü yapılmış ve sonuç kaydedilmiştir.

## 7. Kapsam dışı ve sonraki kararlar

İlk teslimden özellikle dışarıda tutulacaklar:

- Tam fizik simülasyonu, çarpışma, sekme ve navmesh/collider ile debris etkileşimi.
- Çalışma anında mesh kırma/fracture üretimi.
- Skinli/animasyonlu mesh parçacıkları.
- Her yapı seviyesi için benzersiz yıkım animasyonu.
- Model başına farklı materyal parametresini particle sırasında ayrıntılı animasyon.

Bu özellikler ancak Faz 5 ölçümü ve gerçek içerik ihtiyacı gösterirse ayrı plan olarak değerlendirilir.

## 8. Başlangıç sırası

1. Faz 0'daki model asset türü ve GLTF clone/instancing keşfini tamamla.
2. Faz 1'in parser + validator + testlerini, renderer kodundan önce bitir.
3. Faz 2'de tek model/tek mesh renderer ile dikey dilimi çalıştır.
4. Faz 3'te Content Drawer ve preview ile authoring döngüsünü tamamla.
5. En son Faz 4'te bunu bir referans binanın hasar ve çöküş sunumuna bağla.

Bu sıra, önce güvenli ve kaydedilebilir veri sözleşmesini; sonra görünür runtime çıktıyı; en son oyun-özel içerik üretimini doğrular.
