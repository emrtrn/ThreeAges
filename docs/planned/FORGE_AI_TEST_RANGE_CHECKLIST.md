# Forge AI Test Range — Uygulama ve Doğrulama Checklist'i

> **Amaç:** Forge'ün AI altyapısının yalnızca tek bir devriye demosu değil; algı, karar, yol bulma, çoklu ajan etkileşimi, hedef/nokta seçimi ve rezerve edilebilir dünya nesneleri içeren tekrar edilebilir bir oyun test sahnesinde çalıştığını kanıtlamak.
>
> **Çalışma adı:** `AI Test Range` / `AI Playground`
>
> **Kapsam ilkesi:** Bu çalışma bir genel amaçlı "squad AI" motoru üretmek için değil, mevcut Forge AI katmanlarının birlikte çalıştığını gösteren küçük, okunabilir ve otomasyona uygun bir vertical slice üretmek içindir.

> **Kod tabanına karşı doğrulama (2026-07-07):** Bu checklist'in dayandığı
> altyapı gerçekten mevcut. `engine/ai` (blackboard, behaviorRunner, queryRunner,
> smartObjects, targetPoints), `engine/navigation` (grid + clearance + local
> avoidance) ve `engine/perception` doğrulandı. Plandaki `forge.setPatrolTarget`,
> `forge.moveToPatrolTarget`, `forge.advancePatrolTarget`,
> `forge.runQueryToBlackboard`, `forge.claimSmartObject`, `forge.useSmartObject`
> task'ları `engine/ai/behaviorRunner.ts` default registry'sinde hazır.
> `AI_SYSTEM_RESEARCH_AND_PLAN.md` Faz 0–6 büyük ölçüde tamamlanmış ve Playground
> içinde çalışan bir `AI_Test` (patrol → chase → punch) demosu var. Yani bu iş
> **yeni motor yazmak değil, mevcut motoru bir sahnede kanıtlamaktır.**

> **Gerçekçi eforü küçümseme:** 7 milestone, ~6 oda, 4 ajan rolü, runtime test
> HUD/assertion katmanı ve Playwright kapsamı toplamı efektif olarak küçük bir
> oyundur; tek oturumluk bir iş değildir. "Checklist" formatı, işi çok sayıda
> küçük teslimata bölmek içindir — her milestone ayrı bir iş paketi olarak ele
> alınmalı, tümü bir arada yapılmamalıdır (bkz. §12–§13).

---

## 1. Başarı Tanımı

Proje, aşağıdaki maddeler aynı sahnede güvenilir biçimde gösterilebildiğinde başarılı sayılır:

- Bir AI ajanı Target Point rotasında devriye gezer.
- Oyuncuyu görüş konisinde algıladığında devriyeyi kesip takip eder.
- Görüşü kaybedince son bilinen konumu araştırır ve uygun durumda devriyeye geri döner.
- Ses/alarm stimulus'una mesafesine göre tepki verir.
- Engel çevresinden path bulur; geçemeyeceği dar alanlarda güvenli biçimde başarısız olur.
- Birden fazla AI ajanı aynı noktada üst üste binmeden hareket eder.
- Ajanlar query ile hedef veya konum seçebilir.
- İki ajan aynı Smart Object slotunu aynı anda alamaz.
- Bir keşifçi/guard tarafından gönderilen mesaj, başka ajanların görev önceliğini değiştirebilir.
- Tüm davranışlar `?debug` ve `Show > AI Navigation` ile gözlemlenebilir.
- Test sahnesi Editor Play, doğrudan Runtime ve production build'de çalışır.

---

## 2. Mimari Sınırlar — Başlamadan Önce

### Değişmez kurallar

- [ ] Test sahnesine özgü görevler, mesaj tipleri, HUD ve koordinasyon kuralları `src/game/ai/` veya `src/game/scripts/` altında kalacak.
- [ ] Genel AI altyapısı (`engine/ai`, `engine/navigation`, `engine/perception`) yalnızca gerçek bir platform eksikliği kanıtlandığında değiştirilecek.
- [ ] `engine/*` hiçbir zaman `editor/*` veya test sahnesine özgü `src/game/*` kodunu import etmeyecek.
- [ ] AI runtime state'i; blackboard değerleri, aktif node, perception, path, query sonucu ve Smart Object reservation bilgisi layout dosyasına yazılmayacak.
- [ ] Editor yalnızca authoring/debug rolünde kalacak; karar verme Game Mode veya Editor Play runtime'ında çalışacak.
- [ ] Yeni layout alanı eklenirse `tools/saveValidator.ts` allowlist'i ve round-trip testi aynı iş paketinde güncellenecek.
- [ ] Yeni dev endpoint, dosya yazma yolu veya generated-content akışı eklenirse Codex Security diff scan için kullanıcıya açık öneri verilecek.

### Referans komutları

```bash
# Her TypeScript değişikliğinden sonra
npx tsc --noEmit

# Engine/runtime değişikliğinde
npm run test:engine
npm run build:verify
npm run check:assets

# Tarayıcı / editor doğrulaması gerektiğinde
npm run smoke:browser
```

> PowerShell shim sorunu yaşanırsa `npx.cmd` ve `npm.cmd` kullanılmalı.

---

## 3. Önerilen Dosya ve Varlık Düzeni

Bu isimler öneridir; mevcut starter-content yapısına uyacak biçimde değiştirilmesi serbesttir.

```text
public/assets/starter-content/
  Levels/
    AI_Test_Range.level.json
  AI/
    TestRange_Guard.blackboard.json
    TestRange_Guard.behavior.json
    TestRange_Scout.blackboard.json
    TestRange_Scout.behavior.json
    TestRange_Worker.blackboard.json
    TestRange_Worker.behavior.json
    TestRange_Cover.query.json
    TestRange_Workstation.query.json
  Actors/
    TestRange_Guard.actor.json
    TestRange_Scout.actor.json
    TestRange_Worker.actor.json
    TestRange_AlarmButton.actor.json
    TestRange_Workstation.actor.json

src/game/ai/testRange/
  testRangeMessages.ts
  testRangeTasks.ts
  testRangeScenarioState.ts
  testRangeHud.ts
  testRangeAssertions.ts

tests/smoke/
  ai-test-range.spec.ts
```

### Entegrasyon gerçeği — `src/game/ai/testRange/` gerçekten neye ihtiyaç duyar?

> **Önce bu soruyu cevapla:** Bu test sahnesi büyük olasılıkla **yeni engine/game
> task'ına ihtiyaç duymaz.** Devriye, chase, investigate, query, smart object
> claim/use, perception→blackboard akışlarının tümü `engine/ai/behaviorRunner.ts`
> default registry'sinde built-in `forge.*` task/decorator/service olarak zaten
> var. Bu durumda testRange işi ağırlıklı olarak **asset authoring (level +
> blackboard/behavior/query/actor JSON) + birkaç mesaj handler'ı**dır, yeni
> TypeScript task değil.

- [ ] Milestone'lar başlamadan karar ver: hangi davranış gerçekten built-in
      `forge.*` ile çözülemiyor? Yalnızca o dar boşluk için testRange task'ı yaz.
- [ ] **Eğer** yeni project-task gerekiyorsa, bağlama noktası bellidir:
      `createGameAiTaskRegistry()` (`src/game/ai/tasks.ts`) bugün yalnızca
      `createDefaultAiTaskRegistry()` döndürüyor ve bu registry hem editor Play
      (`SceneApp.ts`) hem runtime (`RuntimeSceneApp.ts`) tarafından
      `AISubsystem`'e veriliyor. testRange task'ları, default registry'yi saran
      (önce testRange map'ine, yoksa default'a düşen `get(taskId)`) bir composite
      registry ile eklenir. `AiTaskRegistry` arayüzü tek metotludur:
      `get(taskId): AiTaskHandler | undefined`.
- [ ] `team.alert` / `team.clear` gibi koordinasyon mesajları **task değil**;
      ScriptMessageBus abonelikleridir (bkz. Milestone 6 notu) — registry'ye
      değil, ajanların subscribe/dispatch katmanına aittir.

### Basit görsel sözleşme

- [ ] Kırmızı kapsül: `Guard` / düşman.
- [ ] Mavi kapsül: `Ally` / dost.
- [ ] Sarı kapsül: `Worker` / görev ajanı.
- [ ] Mor kapsül: `Scout` / alarmcı.
- [ ] Beyaz kapsül: pasif hedef veya test işaretçisi.
- [ ] Her AI üzerinde kısa state etiketi gösterilir: `PATROL`, `CHASE`, `INVESTIGATE`, `WAIT`, `QUERY`, `USE`, `FAILED`.
- [ ] Aktif hedef yerde halka/ok ile gösterilir.
- [ ] Test odası girişinde kısa hedef metni ve başarı/failure göstergesi bulunur.

> İlk sürümde kapsül, renk, basit text/HUD ve wireframe debug yeterlidir. Karakter model, animasyon ve efekt kalitesi testin ön koşulu değildir.

---

## 4. Milestone 0 — Sahne İskeleti ve Gözlemlenebilirlik

### Hedef

AI Test Range, oyuncunun sırayla test odalarına girebildiği küçük bir eğitim/laboratuvar alanı olarak açılır.

### Checklist

- [ ] `AI_Test_Range` level/layout oluştur.
- [ ] Player Start, zemin, temel ışık, giriş alanı ve dönüş/spawn noktası ekle.
- [ ] En az altı ayrık test odası veya açık alan bölgesi planla:
  - [ ] Devriye koridoru
  - [ ] Görüş/takip odası
  - [ ] Son bilinen konum odası
  - [ ] Ses/alarm odası
  - [ ] Navigation ve dar geçit laboratuvarı
  - [ ] Query + Smart Object çalışma alanı
- [ ] Oda girişlerine sabit kısa açıklama yerleştir.
- [ ] Oda başarı durumlarını tutacak minimal runtime test state/HUD tasarla.
- [ ] `?debug` ve `Show > AI Navigation` açıldığında sahne okunur kalacak şekilde alanları yerleştir.
- [ ] Sahneye en az bir AI Navigation Volume yerleştir.
- [ ] Nav bounds dışında kalan sahne dekorlarının AI testlerini etkilemediğini doğrula.

### Kabul kriteri

- [ ] Editor'de sahne kaydedilir ve tekrar açıldığında tüm test odaları korunur.
- [ ] Editor Play ile açılan Game Mode ve doğrudan `/` Game Mode aynı sahneyi yükler.
- [ ] `/?debug` ve `/?editor&debug` konsol hatası üretmez.

### AI ajanına verilebilecek iş paketi

```text
Forge içinde AI Test Range için yalnızca test sahnesi iskeletini oluştur.
Mevcut AI altyapısına veya engine katmanına davranış ekleme. Level/layout, temel
blockout, AI Navigation Volume, Player Start, test odası isimleri ve minimal HUD
alanlarıyla sınırlı kal. Yeni layout alanı eklemen gerekirse saveValidator allowlist
ve round-trip testini aynı değişiklikte yap. TypeScript, engine testleri ve build
kapısını çalıştır; sonuçları dosya bazında raporla.
```

---

## 5. Milestone 1 — Tek Ajan: Devriye → Takip → Araştır → Devriyeye Dön

### Hedef

Mevcut `AI_Test` davranışını test odası içinde açık, tekrar edilebilir ve ölçülebilir hale getirmek.

> **Sıfırdan kurma; kopyala/uyarla.** Playground'da patrol → chase → punch yapan
> çalışan bir `AI_Test` actor/behavior/blackboard seti (`public/assets/
> starter-content/AI/AI_Test.behavior.json` ve eşlik eden asset'ler) zaten var.
> Guard'ı bu setten türet: kopyala, `TestRange_Guard.*` olarak yeniden adlandır,
> investigate dalını ekle. Bu, milestone'un yükünü yarıya indirir ve halihazırda
> geçen bir referans davranışı temel alır.

### Guard davranış ağacı

```text
Selector (reactive priority)
├─ Attack branch
│  └─ Hedef menzildeyse attack intent mesajı
├─ Chase branch
│  └─ Oyuncu görüşteyse canlı hedefe ilerle
├─ Investigate branch
│  └─ Son bilinen hedef konumuna ilerle ve kısa süre bekle
└─ Patrol branch
   └─ Target Point rotasında devriye
```

### Checklist

- [ ] **Başlangıç noktası:** mevcut Playground `AI_Test` actor/behavior/blackboard
      setini kopyala ve `TestRange_Guard.*` olarak uyarla (sıfırdan kurma).
- [ ] Guard için blackboard asset'i oluştur:
  - [ ] `target`
  - [ ] `hasLineOfSight`
  - [ ] `lastKnownTargetPosition`
  - [ ] `targetDistance`
  - [ ] `inAttackRange`
  - [ ] `patrolTarget`
- [ ] En az üç Target Point içeren bir rota oluştur.
- [ ] Target Point'lerde `nextTargetPoint`, `waitTime`, `acceptanceRadius`, `speedOverride` değerlerini authorla.
- [ ] Devriye dalında `forge.setPatrolTarget`, `forge.moveToPatrolTarget`, `forge.advancePatrolTarget` akışını kullan.
- [ ] Görüşte takip dalını `forge.moveToBlackboard` veya eşdeğer canlı hedef akışıyla kur.
- [ ] Görüş kaybında `lastKnownTargetPosition` hedefini kullanarak araştırma dalını kur.
- [ ] Saldırı menzilinde gerçek hasar sistemi yazmak yerine `ai.attack.intent` veya `punch` mesajı üret.
- [ ] Guard üstü state etiketi ve aktif hedef işaretçisini bağla.
- [ ] Guard, devriye sırasında chase branch'e geçince eski movement intent'ini güvenli biçimde bırakıyor mu doğrula.

### Kabul kriterleri

- [ ] Guard, rota boyunca Target Point sırasını doğru izler.
- [ ] Oyuncu görüş konisine girince guard en geç bir behavior değerlendirme döngüsünde `CHASE` durumuna geçer.
- [ ] Oyuncu engel arkasına geçtiğinde `hasLineOfSight=false` olur; guard son bilinen noktaya yönelir.
- [ ] Araştırma tamamlanınca guard tekrar rota hedefi edinir.
- [ ] Attack intent yalnızca tanımlı mesafe koşulunda yayılır.
- [ ] Guard hiçbir durumda Player Start possession adayına dönüşmez.

### Manuel test senaryosu

- [ ] Oyuncuyu guard'ın görüş konisinin dışına yerleştir: yalnızca `PATROL` görülmeli.
- [ ] Görüş konisine gir: `CHASE` state'i ve hedef işaretçisi görünmeli.
- [ ] Bir duvarın arkasına geç: `INVESTIGATE` ve son bilinen konum işaretçisi görünmeli.
- [ ] Guard araştırmayı bitirsin: tekrar `PATROL` görülmeli.
- [ ] Yakın mesafede attack intent log/HUD olayı görünmeli.

---

## 6. Milestone 2 — Perception: Görüş, Ses ve Alarm

### Hedef

Ajanların yalnızca oyuncu konumunu polling ile takip etmediğini; sight, hearing ve gameplay stimulus'larıyla karar değiştirdiğini göstermek.

### Oda A — Görüş konisi testi

- [ ] Duvarlı bir oda kur: oyuncu aynı mesafede ama önce FOV dışında, sonra FOV içinde olacak şekilde hareket edebilsin.
- [ ] Sight radius, field of view, near sight radius ve target-lost grace değerlerini görünür test koşullarıyla ayarla.
- [ ] `Show > AI Navigation` görünümünde sight cone'u doğrula.

**Kabul:**

- [ ] FOV dışındaki oyuncu algılanmaz.
- [ ] FOV içindeki ve LOS açık oyuncu algılanır.
- [ ] Aradaki blocker LOS'u keser.
- [ ] Kısa LOS kopmasında grace boyunca son hedef belleği korunur.

### Oda B — Ses/alarm testi

- [ ] Bir `AlarmButton` veya `NoiseEmitter` actor'ü oluştur.
- [ ] Oyuncu etkileşimi, konum ve loudness taşıyan noise veya gameplay stimulus üretir.
- [ ] Yakında bir guard, orta mesafede bir guard ve uzak bir guard yerleştir.
- [ ] Guard behavior tree'ye `INVESTIGATE_NOISE` dalı ekle.
- [ ] Blackboard'da `lastHeardPosition`, `lastStimulusSense`, `lastStimulusEvent` veya eşdeğer alanları göster.

**Kabul:**

- [ ] Yakındaki ajan alarm noktasına yönelir.
- [ ] Menzil dışındaki ajan tepki vermez.
- [ ] Hearing olayı sight hedefini gereksiz yere silmez.
- [ ] Debug görünümünde hearing radius ve son duyulan konum gözlemlenir.

### Oda C — Hasar/alert mesajı testi

- [ ] `Damage.*`, `alert`, `ui-action` veya `game-event` biçimlerinden birini test mesajı olarak seç.
- [ ] Hedeflenmiş mesajın doğrudan ilgili ajana ulaştığını doğrula.
- [ ] Takım mesajı ile çevredeki ajanların hearing radius / gameplay stimulus kuralına göre tepki verip vermediğini doğrula.

---

## 7. Milestone 3 — Navigation, Clearance ve Çoklu Ajan Hareketi

### Hedef

Ajanların yalnızca açık zeminde düz ilerlemediğini; güvenli path, clearance ve lokal avoidance ile çalıştığını kanıtlamak.

### Oda A — Engel çevresinden geçiş

- [ ] Start ve goal arasında doğrudan çizgiyi kesen büyük bir blocker yerleştir.
- [ ] Guard veya test kapsülünü hedefe gönderen kısa behavior tree kur.
- [ ] `?debug` ile path polyline, current waypoint ve nav grid'i izle.

**Kabul:**

- [ ] Ajan blocker'ın içinden geçmez.
- [ ] Uygun rota varsa engelin çevresinden dolaşır.
- [ ] Waypoint'lere ulaşınca path progression güncellenir.
- [ ] Hedefe ulaştığında task success döner.

### Oda B — Dar geçit ve clearance

- [ ] İki geçit oluştur: biri küçük ajan için geçilebilir, biri tanımlı effective radius için geçilemez olsun.
- [ ] Küçük ve büyük kapsül için farklı `navAgent.radius` / `clearancePadding` değerleri authorla.
- [ ] Debug görünümünde raw blocker, inflated forbidden footprint ve selected-agent clearance halkasını aç.

**Kabul:**

- [ ] Küçük ajan uygun dar geçidi güvenle geçer.
- [ ] Büyük ajan geçilemeyen koridorda path failure üretir; duvarın içine sıkışmaz.
- [ ] Failure, state etiketi/HUD ve debug satırında görünür.

### Oda C — İki ajan avoidance ve stuck recovery

- [ ] Aynı hedefe farklı başlangıç noktalarından yönelen iki kapsül yerleştir.
- [ ] Bir karşılaşma senaryosu ve bir aynı koridorda geçiş senaryosu kur.
- [ ] Gerekirse üçüncü ajanla kalabalık/stuck olasılığını artır.

**Kabul:**

- [ ] Ajanlar sürekli üst üste binmez.
- [ ] Separation hareketi onları birbirinden uzaklaştırır.
- [ ] Uzun süre ilerleme kaydedemeyen ajan replan/recovery davranışına geçer.
- [ ] Recovery tükendiğinde güvenli failure verir; sonsuz döngüye girmez.

---

## 8. Milestone 4 — Query/EQS: En Uygun Hedefi Seçme

### Hedef

Ajanın en yakın şeyi körlemesine seçmediğini; aday üretip test/score sonuçlarına göre karar verdiğini göstermek.

### Test A — Cover veya gözlem noktası seçimi

- [ ] En az üç adet `CoverPoint` veya Target Point yerleştir.
- [ ] Noktaları kasıtlı olarak farklı niteliklerle tasarla:
  - [ ] Yakın ama oyuncuya açık
  - [ ] Biraz uzak ama görüşü kesen
  - [ ] Yakın ama nav ile erişilemeyen
- [ ] `TestRange_Cover.query.json` oluştur.
- [ ] Generator olarak uygun bir nokta üretim yöntemi seç.
- [ ] Testlerde en az distance, line-of-sight ve nav reachable kullan.
- [ ] Kazanan konumu/entity'yi blackboard'a yaz.
- [ ] Query adayları, başarısız adaylar ve kazanan işaretçisini overlay'de doğrula.

### Kabul kriterleri

- [ ] Query aynı koşullarda deterministik olarak aynı kazananı seçer.
- [ ] Erişilemeyen veya testten kalan aday kazanmaz.
- [ ] En yakın aday her zaman kazanmaz; tasarlanan skorlama mantığı sonucu değiştirir.
- [ ] Query cache/interval kullanılıyorsa güncelleme aralığı boyunca gereksiz tekrar çalışmaz.

### Test B — Yardımcı/işçi için en uygun iş noktası

- [ ] `smartObjectsByTag` veya actor/tag tabanlı aday seçimi kullan.
- [ ] İki iş istasyonu ve farklı uzaklık/erişilebilirlik koşulları oluştur.
- [ ] Worker, query sonucuna göre uygun iş istasyonunu seçer.

---

## 9. Milestone 5 — Smart Object: Claim, Use, Release

### Hedef

Dünya üzerindeki rezerve edilebilir aktivite noktalarının çoklu ajan için güvenli çalıştığını doğrulamak.

### Checklist

- [ ] En az iki `Workstation` veya `Terminal` actor'üne `SmartObjectComponent` bağla.
- [ ] Her Smart Object için tag, slot, interaction position, cooldown ve enabled değerlerini authorla.
- [ ] Worker behavior tree'de şu akışı kur:

```text
Query free workstation
→ Write entity + slot to Blackboard
→ Claim Smart Object
→ Move to interaction position
→ Use Smart Object
→ Wait / perform fake work
→ Release Smart Object
```

- [ ] İki worker'ı aynı anda tek slotlu istasyona gönder.
- [ ] Bir worker'ı claim sonrası hedefe ulaşmadan durduracak veya yok edecek bir test düğmesi eklemeyi değerlendir.
- [ ] Claim timeout/expiry sonrası slotun yeniden kullanılabildiğini gözlemle.
- [ ] `smart-object.use` veya tanımlı message type'ın hedef actor'e ulaştığını doğrula.

### Kabul kriterleri

- [ ] Aynı slot, aynı anda yalnızca bir ajan tarafından claim edilir.
- [ ] İkinci ajan rezerve slotu query sonucu olarak seçmez veya claim failure sonrası uygun fallback'e geçer.
- [ ] Use tamamlanınca veya claim süresi dolunca slot serbest kalır.
- [ ] Reservation verisi layout/asset dosyasına yazılmaz.
- [ ] Debug/HUD ile slot sahibi ve boş/dolu durum izlenebilir.

---

## 10. Milestone 6 — Takım Davranışı: Mesaj Tabanlı Koordinasyon

### Hedef

Tam bir generic squad framework kurmadan, birden fazla bağımsız AI ajanının mesaj ve farklı davranış ağaçlarıyla birlikte çalışabildiğini göstermek.

### Rol dağılımı

| Rol | Renk | Birincil davranış | Alarm tepkisi |
|---|---:|---|---|
| Scout | Mor | Uzak görüş, keşif, alarm yayma | Oyuncuyu görür, `team.alert` yollar, güvenli gözlem noktasına geçer. |
| Guard A | Kırmızı | Devriye / chase | Son bilinen oyuncu konumuna gider. |
| Guard B | Kırmızı | Devriye / cover | Query ile uygun cover veya flank-benzeri gözlem noktasına gider. |
| Worker | Sarı | Smart Object görevi | İşini bırakmaz veya yalnızca kritik alarmda güvenli noktaya çekilir. |

### Mesaj sözleşmesi önerisi

```ts
// src/game/ai/testRange/testRangeMessages.ts
export type TestRangeMessageType =
  | 'team.alert'
  | 'team.clear'
  | 'ai.attack.intent'
  | 'smart-object.use';

export interface TeamAlertPayload {
  sourceEntityId: string;
  targetEntityId: string | null;
  lastKnownPosition: [number, number, number] | null;
  urgency: 'low' | 'high';
}
```

> **Önemli — `team.alert` / `team.clear` otomatik perception stimulus'u DEĞİL.**
> Faz 4 script-message → perception köprüsü yalnızca `Damage.*`, `alert`,
> `ui-action`, `game-event` mesajlarını gameplay stimulus'una çevirir. `team.*`
> yeni tiplerdir; hiçbir perception dalını kendiliğinden tetiklemez. Bunları
> ScriptMessageBus üzerinden **açıkça** yayınlayıp, alan ajanlarda açıkça
> subscribe edip blackboard'a yazan bir handler katmanı gerekir. Yani "mesajı
> alan Guard A yönelir" adımı, göründüğünden daha fazla iş içerir: elle yazılan
> bir subscribe → blackboard-write → behavior-tree-dal-tetikleme zinciri. Bu
> katman `src/game/ai/testRange/testRangeMessages.ts` altında kalır. Alternatif:
> koordinasyonu mevcut `alert`/`game-event` stimulus tipleri üzerine bindirip
> perception köprüsünü yeniden kullanmak — daha az kod, ama semantik olarak daha
> az temiz. İş paketinde bu iki yoldan biri açıkça seçilmeli.

### Checklist

- [ ] Scout için perception odaklı behavior tree oluştur.
- [ ] Scout oyuncuyu gördüğünde `team.alert` mesajı üretir.
- [ ] Mesajı alan Guard A, last known position'a yönelir.
- [ ] Mesajı alan Guard B, query ile tanımlı response point/cover point seçer.
- [ ] Worker için alarm politikasını açıkça tanımla: görmezden gel, işi bitir, kaç veya güvenli bekleme noktasına git.
- [ ] Alarm bittiğinde `team.clear` veya timeout tabanlı normale dönüş davranışı tanımla.
- [ ] Her role farklı state etiketi ve farklı hedef işaretçisi ver.

### Kabul kriterleri

- [ ] Scout tek başına oyuncuyu görünce en az iki diğer ajanın davranışı değişir.
- [ ] Guard A ve Guard B aynı hedefe körlemesine yığılmaz; görevleri farklılaşır.
- [ ] Worker, belirlenen alarm politikasına tutarlı uyar.
- [ ] Mesaj kaynağı yok olduğunda veya sahne yeniden kurulduğunda eski subscription'lar sızıntı yapmaz.
- [ ] Bu mekanik `src/game/ai/testRange/` altında kalır; generic `engine/squad` sistemi eklenmez.

---

## 11. Milestone 7 — Görünür Test Durumu ve Otomatik Regresyon

### Runtime HUD / Test paneli

- [ ] Her oda için `Not started`, `Running`, `Passed`, `Failed` durumu göster.
- [ ] Başarı koşulları yalnızca görsel algıya bırakılmaz; mümkün olduğunda runtime assertion ile kayıt altına alınır.
- [ ] **Assertion kaynağını debug snapshot deseninden besle.** Test durumları,
      görsel DOM yerine mevcut `getAiDebugSnapshot()` (host getter) + saf,
      DOM'suz `formatAiDebug()` (`src/scene/debugStats.ts` deseni; bkz.
      `AI_SYSTEM_RESEARCH_AND_PLAN.md`) üzerinden okunmalı. Böylece
      `testRangeAssertions.ts` engine testinde ve Playwright'ta aynı veriyi
      doğrular; blackboard/state/reservation değerleri tek kaynaktan gelir. Yeni
      test alanları gerekiyorsa snapshot tipini genişlet, ayrı bir gözlem yolu
      açma.
- [ ] Örnek assertion'lar:
  - [ ] Guard chase'e geçti.
  - [ ] Guard last-known position'a ulaştı.
  - [ ] Büyük ajan dar geçitte failure verdi.
  - [ ] İki worker aynı slotu aynı anda alamadı.
  - [ ] Scout mesajı sonrası Guard A/B farklı response aldı.
- [ ] Test reset butonu veya level reload mekanizması ekle.

### Browser smoke / Playwright

- [ ] `?editor` açılır, test scene yüklenir ve AI Navigation görünümü açılıp kapanır.
- [ ] Editor Play, Game Mode'u açar ve konsol hatası yoktur.
- [ ] Runtime `?debug` açılır; AI debug satırları görünür.
- [ ] En az bir guard'ın path takip ettiği veya state değiştirdiği doğrulanır.
- [ ] En az bir Smart Object reservation durumunun değiştiği doğrulanır.
- [ ] Test sahnesi reload sonrası tekrar çalışır.

### Build / paket doğrulaması

- [ ] `npx tsc --noEmit` temiz.
- [ ] `npm run test:engine` temiz.
- [ ] `npm run build:verify` temiz.
- [ ] `npm run check:assets` temiz.
- [ ] Production `dist/` içinde editor UI veya dev endpoint string sızıntısı yok.
- [ ] Production build'de AI Test Range açılır ve temel guard senaryosu çalışır.

---

## 12. Önerilen Uygulama Sırası

Bu sıra, hata ayıklama maliyetini düşük tutar. Bir sonraki adıma geçmeden önce önceki aşamanın kabul kriterleri tamamlanmalı.

- [ ] **P0:** Sahne iskeleti, blockout, Navigation Volume, test odası metinleri.
- [ ] **P1:** Tek Guard — patrol → chase → investigate → patrol.
- [ ] **P2:** Sight/FOV/LOS ve target-lost grace testleri.
- [ ] **P3:** Hearing/alarm ve gameplay stimulus testleri.
- [ ] **P4:** Engel çevresi pathfinding, dar geçit, clearance failure.
- [ ] **P5:** İki ajan avoidance ve stuck recovery.
- [ ] **P6:** Cover/response point query testi.
- [ ] **P7:** Smart Object claim/use/release yarışı.
- [ ] **P8:** Scout + iki Guard + Worker ile takım mesaj senaryosu.
- [ ] **P9:** HUD/assertion, Playwright smoke, production build doğrulaması.

> **Kritik öncelik:** Takım davranışı P8'den önce yapılmayacak. Tek ajan karar zinciri ve navigation güvenilir değilse çoklu ajanlar yalnızca hata ayıklama maliyetini büyütür.

---

## 13. AI Ajanlarıyla Çalışma Kuralları

Her görev, tek bir net teslimata bölünmeli. Aynı anda birden fazla ajana aynı dosya kümesini değiştirtme.

### Her görev istemine eklenecek çekirdek metin

```text
Forge mimari sınırlarına uy. Bu işi sadece istenen kapsamda yap.
Engine katmanını yalnızca gerçekten platform düzeyi bir eksik varsa değiştir;
oyun/test sahnesine özgü davranışları src/game/ai/testRange altında tut.
Yeni layout veya sidecar alanı eklenirse tools/saveValidator.ts doğrulamasını ve
ilgili round-trip testini aynı değişiklikte ekle. Editor kodunu runtime bundle'a
sızdırma. İş sonunda değişen dosyaları, kabul kriterlerini, çalıştırdığın
komutları ve kalan manuel testleri raporla. Otomatik commit/push yapma.
```

### İş paketi şablonu

```md
## İş Paketi: <kısa ad>

### Amaç
<tek cümle>

### Sınır
- Değiştirilebilir dosyalar: ...
- Dokunulmaması gereken alanlar: ...
- Engine değişikliği: yasak / gerekirse önce gerekçelendir.

### Yapılacaklar
- [ ] ...

### Kabul kriterleri
- [ ] ...

### Doğrulama
- [ ] npx tsc --noEmit
- [ ] npm run test:engine
- [ ] npm run build:verify
- [ ] Manuel / Playwright senaryosu: ...

### Teslim raporu
- Değişen dosyalar
- Test sonucu
- Bilinen sınırlamalar
- Sonraki mantıklı iş paketi
```

---

## 14. Çıkış Kriterleri — AI Test Range v1

Aşağıdaki kutuların tamamı işaretlenmeden bu çalışma "tamamlandı" sayılmamalı:

- [ ] Devriye rotası Target Point'lerle çalışıyor.
- [ ] Reactive selector, devriyeden chase/attack davranışına anında öncelik veriyor.
- [ ] Sight, FOV, LOS ve target-lost grace beklenen sonuçları veriyor.
- [ ] Hearing ve gameplay stimulus'ları doğru ajana/mesafeye ulaşıyor.
- [ ] Ajanlar path buluyor; blocker/clearance kurallarını ihlal etmiyor.
- [ ] Path yoksa güvenli failure oluşuyor.
- [ ] Çoklu ajan avoidance ve stuck recovery gözlemleniyor.
- [ ] Query doğru aday/kazanan seçimini görünür biçimde kanıtlıyor.
- [ ] Smart Object reservation yarışında tek sahip kuralı korunuyor.
- [ ] Scout alarmı Guard A/B davranışını farklılaştırıyor.
- [ ] Runtime state layout'a yazılmıyor.
- [ ] Editor Play, Runtime ve production build eşdeğer temel davranışı gösteriyor.
- [ ] TypeScript, engine test, build verify ve asset check kapıları yeşil.
- [ ] En az bir browser smoke/Playwright testi bu sahnenin kritik yolunu kapsıyor.

---

## 15. Bilinçli Olarak v1 Dışında Bırakılanlar

Bu liste, test sahnesinin gereksiz biçimde motor projesine dönüşmesini önler.

- [ ] Generic squad manager / shared squad blackboard.
- [ ] Formasyon, flank planner veya taktiksel kuşatma sistemi.
- [ ] Behavior Tree görsel node graph editörü.
- [ ] Tam StateTree sistemi.
- [ ] Gerçek combat, hasar, ölüm, ragdoll veya silah sistemi.
- [ ] Gelişmiş cover generation.
- [ ] Multiplayer/replication.
- [ ] Büyük ölçekli crowd simulation.

Bu maddelerden biri gerçekten gerekirse, önce ayrı bir plan/checklist açılmalı; AI Test Range v1 kapsamına doğrudan eklenmemeli.

---

## 16. Kaynak Dokümanlar

- `docs/planned/AI_SYSTEM_RESEARCH_AND_PLAN.md`
- `docs/architecture/ARCHITECTURE.md`
- `docs/architecture/UNREAL_BASICS_LESSONS.md`
- `AGENTS.md`
- `CLAUDE.md`

