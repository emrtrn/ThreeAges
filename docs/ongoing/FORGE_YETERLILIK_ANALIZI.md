# Forge Yeterlilik Analizi

Olusturulma tarihi: 2026-07-03

Bu dokuman Forge projesinin yeniden kullanilabilir Three.js oyun/app platformu
olarak yeterlilik durumunu baslik baslik degerlendirmek icin canli analiz
iskeletidir. Analiz ilerledikce her baslik altina kanit, karar, eksik ve
aksiyon notlari eklenecek.

## Degerlendirme Lejanti

- `[ ] Incelenmedi`: Henuz kanit toplanmadi.
- `[~] Kismi`: Temel islev var, fakat eksik, kirilgan veya dogrulanmamis alanlar var.
- `[x] Yeterli`: Amac icin yeterli, dogrulama kaniti var.
- `[!] Riskli`: Kullanimda hata, veri kaybi, guvenlik veya mimari borc riski var.
- `[>] Yol Haritasi`: Su an zorunlu degil, fakat platform hedefi icin planlanmali.

## Analiz Yontemi

Her baslik ayni formatla doldurulacak:

- Durum:
- Kanit:
- Yeterli olanlar:
- Eksikler / riskler:
- Karar:
- Aksiyonlar:

Kanit siralamasi: calisan kod ve testler > editor/runtime davranisi > proje
manifestleri ve veri dosyalari > mimari dokumanlar > sohbet notlari.

## 1. Urun Kimligi ve Platform Hedefi `[ ] Incelenmedi`

Forge'un hangi oyun/app turleri icin yeterli bir temel sundugu, hangi sinirlari
bilerek disarida biraktigi ve reusable platform hedefinin netligi incelenecek.

- Durum:
- Kanit:
- Yeterli olanlar:
- Eksikler / riskler:
- Karar:
- Aksiyonlar:

## 2. Mimari Sinirlar ve Sahiplik Kurallari `[ ] Incelenmedi`

Engine, editor, runtime, game, project ve public asset katmanlarinin net ayrilip
ayrilmadigi; generic platform kodu ile oyuna ozel kurallarin karisip karismadigi
degerlendirilecek.

- Durum:
- Kanit:
- Yeterli olanlar:
- Eksikler / riskler:
- Karar:
- Aksiyonlar:

## 3. Editor Deneyimi ve Uretim Akislari `[ ] Incelenmedi`

`?editor` deneyimi, scene/level authoring, selection, gizmo, details panel,
Content Browser, asset atama, undo/redo, coklu secim ve temel uretilirlik
akislari incelenecek.

- Durum:
- Kanit:
- Yeterli olanlar:
- Eksikler / riskler:
- Karar:
- Aksiyonlar:

## 4. Runtime ve Gameplay Temelleri `[ ] Incelenmedi`

Game mode, pawn/character, input, camera, actor/component modeli, behavior
baglama, level travel, save/load, boot/loading ve playable runtime akisi
degerlendirilecek.

- Durum:
- Kanit:
- Yeterli olanlar:
- Eksikler / riskler:
- Karar:
- Aksiyonlar:

## 5. Asset Pipeline ve Icerik Yonetimi `[ ] Incelenmedi`

Asset manifest, import disiplini, material/mesh/skeletal/audio/UI sidecar
dosyalari, asset health, starter content ve downstream game fork kullanimina
uygunluk incelenecek.

- Durum:
- Kanit:
- Yeterli olanlar:
- Eksikler / riskler:
- Karar:
- Aksiyonlar:

## 6. Veri Semalari, Save/Load ve Validator Kapsami `[ ] Incelenmedi`

Layout, environment, world settings, sidecar dosyalari, save-game verisi ve
`tools/saveValidator.ts` allowlist kapsaminin veri kaybi riski tasiyip
tasimadigi degerlendirilecek.

- Durum:
- Kanit:
- Yeterli olanlar:
- Eksikler / riskler:
- Karar:
- Aksiyonlar:

## 7. Rendering, Aydinlatma ve Gorsel Kalite `[ ] Incelenmedi`

Three.js render ayarlari, editor/runtime goruntu paritesi, material sistemi,
post process, reflection capture, fog, sky/clouds, VFX ve gorsel dogrulama
akislari incelenecek.

- Durum:
- Kanit:
- Yeterli olanlar:
- Eksikler / riskler:
- Karar:
- Aksiyonlar:

## 8. Fizik, Collision ve Hareket Dayanikliligi `[ ] Incelenmedi`

Rapier/Jolt yuzeyleri, static mesh collision authoring, character movement,
kill/respawn, zemin/duvar davranisi, complex collision ve gameplay tarafindaki
kullanim sozlesmeleri degerlendirilecek.

- Durum:
- Kanit:
- Yeterli olanlar:
- Eksikler / riskler:
- Karar:
- Aksiyonlar:

## 9. UI Sistemleri `[ ] Incelenmedi`

Editor UI, runtime HUD/menu, UI view model, kaydet/yukle menuleri, input focus,
responsive davranis ve oyun projeleri icin yeniden kullanilabilir UI temelinin
yeterliligi incelenecek.

- Durum:
- Kanit:
- Yeterli olanlar:
- Eksikler / riskler:
- Karar:
- Aksiyonlar:

## 10. Scripting, Extensibility ve Plugin Hazirligi `[ ] Incelenmedi`

Actor script sistemi, behavior API, plugin hooks, editor genisletilebilirligi ve
oyun projelerinin Forge cekirdegini bozmadan ozellestirme kapasitesi
degerlendirilecek.

- Durum:
- Kanit:
- Yeterli olanlar:
- Eksikler / riskler:
- Karar:
- Aksiyonlar:

## 11. Performans ve Olceklenebilirlik `[ ] Incelenmedi`

Runtime frame maliyeti, editor buyuk sahne davranisi, asset yukleme, instancing,
profiling ihtiyaci, bundle boyutu ve gelecekteki performans altyapisi
incelenecek.

- Durum:
- Kanit:
- Yeterli olanlar:
- Eksikler / riskler:
- Karar:
- Aksiyonlar:

## 12. Build, Packaging ve Dagitim `[ ] Incelenmedi`

Vite build, `build:verify`, dist dogrulamasi, public klasor disiplini, proje
manifestlerinin paketlenmesi ve downstream oyunlara tasinabilirlik
degerlendirilecek.

- Durum:
- Kanit:
- Yeterli olanlar:
- Eksikler / riskler:
- Karar:
- Aksiyonlar:

## 13. Test, Dogrulama ve CI Koruma Agi `[ ] Incelenmedi`

TypeScript, engine tests, build verify, Playwright/browser smoke, visual
dogrulama, fixture kapsami ve regresyon yakalama gucu incelenecek.

- Durum:
- Kanit:
- Yeterli olanlar:
- Eksikler / riskler:
- Karar:
- Aksiyonlar:

## 14. Guvenlik ve Veri Sinirlari `[ ] Incelenmedi`

Dev-server endpointleri, save/load, asset ingestion, dosya yazma sinirlari,
generated content ve izin/scope riskleri degerlendirilecek. Bu baslikta gereken
noktalarda Codex Security taramasi ayrica onayla calistirilmalidir.

- Durum:
- Kanit:
- Yeterli olanlar:
- Eksikler / riskler:
- Karar:
- Aksiyonlar:

## 15. Dokumantasyon ve Onboarding `[ ] Incelenmedi`

Mimari dokumanlar, launch workflow, checklistler, module README'leri, karar
kayitlari ve yeni gelistiricinin projeyi dogru kullanma hizi degerlendirilecek.

- Durum:
- Kanit:
- Yeterli olanlar:
- Eksikler / riskler:
- Karar:
- Aksiyonlar:

## 16. Oyun Sablonu ve Downstream Fork Hazirligi `[ ] Incelenmedi`

Forge'dan uretilen oyun repolarinin kendi icerigini koruyarak upstream
degisiklikleri alabilmesi, default scene/template sozlesmeleri ve fork-sync
akislari incelenecek.

- Durum:
- Kanit:
- Yeterli olanlar:
- Eksikler / riskler:
- Karar:
- Aksiyonlar:

## 17. Yol Haritasi, Onceliklendirme ve Kabul Kriterleri `[ ] Incelenmedi`

Eksiklerin hangi sirayla ele alinacagi, hangi basligin "platform icin yeterli"
sayilacagi ve hangi maddelerin bilincli backlog olarak kalacagi belirlenecek.

- Durum:
- Kanit:
- Yeterli olanlar:
- Eksikler / riskler:
- Karar:
- Aksiyonlar:

## Kanit ve Aksiyon Kaydi

Analiz sirasinda bulunan kararlar ve takip isleri buraya kisa kayit olarak
eklenecek.

| Tarih | Baslik | Bulgu | Aksiyon | Durum |
| --- | --- | --- | --- | --- |
| 2026-07-03 | Dokuman iskeleti | Analiz basliklari olusturuldu. | Basliklar tek tek kanitla doldurulacak. | `[ ]` |
