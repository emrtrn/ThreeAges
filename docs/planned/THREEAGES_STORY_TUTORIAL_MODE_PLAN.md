# ThreeAges Hikâye / Öğretici Tur Modu — Tasarım Çalışması

Oluşturulma tarihi: 2026-07-26
Durum: Onaylandı — **Faz 1 kodu tamamlandı**, oyuncu doğrulaması bekliyor
Kapsam: Oyuncunun sırayla verilen görevleri yaparak **tek bir tam tur** oynadığı,
öğretici işlevi de gören yönlendirilmiş maç modu.

---

## 1. Problemin Doğru Tanımı

Başlangıç iddiası şuydu: "RTS oynamış biri bile yol/depo gibi yeni mekanikleri
sezgisel olarak tahmin edemez." Kodu okuduktan sonra bu iddia doğru, ama sebebi
sanıldığından farklı.

**Oyun zaten kendini anlatıyor — sadece kimse bakmıyor.**

`src/game/rts/ui/rtsSelectionView.ts:322-334` içinde her lojistik durumunun hem
kısa etiketi hem de tam açıklaması yazılı:

| Durum | Etiket | Açıklama |
| --- | --- | --- |
| `outside-control` | Kontrol Dışı | "Kontrol alanı kaybedildi; Karakolu veya alanı geri alın." |
| `unlinked-road` | Yol Yok | "Yapı footprint'ine temas eden bir yol hücresi gerekli." |
| `unlinked-depot` | Depo Yok | "Aynı yol ağında tamamlanmış bir Depo gerekli." |
| `depot-occupied` | Depo İşgal Altında | "Bağlı Depo düşman işgali altında; işgali kaldırın." |

Bu metinler mükemmel. Sorun şu: oyuncu **tarlayı seçmedikçe** hiçbirini görmez.
Yeni oyuncu tarlayı kurar, yiyeceğin artmadığını fark eder, sebebini bilmediği
için tarlayı yanlış yere kurduğunu sanır, bir tane daha kurar, yine olmaz ve
oyunu bırakır. Yapının üzerine tıklayıp panelin lojistik satırını okumak,
**ancak böyle bir sistem olduğunu zaten bilen** bir oyuncunun yapacağı şeydir.

Aynı örüntü `rtsObjectiveTracker.ts:52`'de de görülüyor: stratejik noktanın
"yola bağlı karakol gerekir" ipucu, tam olarak bu keşfedilebilirlik açığı
fark edildiği için tek tek elle eklenmiş bir yama. Her keşfedilemeyen kural için
ayrı bir ipucu dizesi yazmak sürdürülebilir değil.

> **Sonuç:** Öğretici modun asıl işi yeni metin yazmak değil, **dikkati doğru
> sıraya sokmak**. Metnin çoğu hazır; eksik olan, oyuncunun onu okumak için
> gereken sebebi doğru anda yaratan bir yapı.

---

## 2. Gerçekten Tahmin Edilemeyen Mekanikler

Aşağıdaki liste koddan çıkarıldı; her biri, tür deneyimi olan bir oyuncunun
**yanlış** tahmin edeceği bir kural. Öğretici turun omurgası bu listedir —
tahmin edilebilir olan hiçbir şey görev olmamalıdır.

### 2.1 İşçiler kaynağa gönderilmez; yapı işçiyi kendisi tutar

`economyProductionSystem.ts:1-5`: "completed producers **reserve nearby idle
workers**, have them walk to the site". AoE refleksi olan oyuncu işçiyi seçip
ormana tıklar ve mantıklı hiçbir şey olmaz. Bu, oyunun ilk 60 saniyesinde
karşılaşılan ve en sert beklenti kıran kuraldır.

### 2.2 Üretim dört koşulun hepsini birden ister

`productionLogisticsSystem.ts:9`: bir üretim yapısının hazineye kaynak akıtması
için (a) kontrol alanı içinde olması, (b) footprint'ine **fiziksel olarak temas
eden** bir yol hücresi bulunması, (c) o yol bileşeninin **aynı sahibin
tamamlanmış bir deposuna** ulaşması, (d) o deponun düşman işgalinde olmaması
gerekir. Dört koşul, hiçbiri türün standardı değil.

### 2.3 Üretim önce yerel tampona gider

Yapı üretir, ama kaynak **local buffer**'da birikir; hazineye ancak bağlantı
kurulunca aktarılır (`economyProductionSystem.ts` `localBuffer` /
`logisticsTransferSystem.ts`). Yani "tarla çalışıyor ama yiyeceğim artmıyor"
durumu bir hata değil, tasarımın kendisi — ve hiçbir yerde ilk bakışta
görünmüyor.

### 2.4 Yükseltme binadan değil, Merkez'den yapılır

`kingdomProgressionSystem.ts:1-16`: krallığın tek bir aktif `{age, level}`
kademesi var, yalnız Komuta Merkezi'nden satın alınır ve **o sahibin bütün
yapılarına aynı anda** uygulanır. Bina başına yükseltme butonu, maliyeti ve
ilerleme çubuğu yok. Her binayı tek tek yükseltmeye alışmış oyuncu, binaları
seçip yükseltme butonu arar ve bulamaz.

### 2.5 Genişleme = karakol; her yere inşa edilemez

Yapı yalnızca kontrol alanı içine kurulur, kontrol alanı Merkez ve karakollarla
büyür, karakolun tam yarıçapı ise yola bağlı olmasına göre değişir
(`territoryControlRadius` vs `territoryConnectedControlRadius`,
`kingdomProgressionSystem.ts:46-47`). "Karakolu yola bağlarsan kontrol alanı
büyür" kuralı hiçbir yerde söylenmiyor.

### 2.6 Stratejik nokta orduyla alınmaz

`strategicPointSystem.ts` + `rtsMatchOverlay.ts:58`: geçit, üzerine birlik
göndererek değil, **yola bağlı bir karakolun kontrol alanıyla** alınır. Zaten
iki ayrı yere ipucu yazılmış olması, kuralın ne kadar tahmin edilemez olduğunun
kanıtı.

### 2.7 Depo yıkılmadan da kesilebilir

`logisticsOccupationSystem.ts`: düşman deponun üstünde durarak, binayı
yıkmadan, sahipliğini almadan lojistiği keser. Türde eşi olmayan bir baskın
biçimi — ve savunma tarafında da öğretilmesi gereken bir tehdit.

### 2.8 İkinci halka (bu turda öğretilmeyecek, sonraya)

Market dönüşümü, kuşatma birimleri, sis altında hafıza (enemy memory), pazar
komisyonunun kademeyle değişmesi. Bunlar ilk tur için fazla; §7'de not edildi.

---

## 3. Tasarım Kararı: Ayrı Kampanya Değil, **Yönlendirilmiş Maç**

`GDD/13_VERTICAL_SLICE_PRODUCTION_PLAN_v0.2.md:311` "Kampanya"yı açıkça kapsam
dışı bırakıyor; `GDD/10_CAMERA_CONTROLS_AND_UI.md:1172` ise "tam tutorial ilk
vertical slice için zorunlu değildir" diyor. Bu plan ikisiyle de çelişmiyor,
çünkü önerilen şey ayrı bir kampanya altyapısı değil:

> **Öğretici tur, normal maçın kendisidir.** Aynı `RtsApp`, aynı simülasyon,
> aynı zafer koşulu. Üzerine eklenen tek şey, maçın durumunu **okuyan** ve
> oyuncuya sırayla hedef veren bir yönetmen (director) katmanıdır.

Bunun üç somut faydası var:

1. **Simülasyona hiçbir yeni durum eklenmez.** Yönetmen yalnız okur; hiçbir
   sistemin sahibi değildir. Öğretici modun bozulması maçı bozamaz.
2. **Tur gerçek bir maç olarak biter.** Oyuncu "eğitim bitti, şimdi asıl oyunu
   oyna" ekranına çarpmaz; görev zinciri bittiğinde yönetmen sessizce çekilir ve
   aynı maç serbest oyun olarak devam eder. Kullanıcının istediği "bir tur
   oynar" tam olarak budur.
3. **Fork'lar hikâyeyi kod yazmadan değiştirir.** CLAUDE.md'nin "editör/motor
   çekirdeği genel kalsın, proje kuralları veriye gitsin" kuralı gereği görev
   zinciri `public/game-data/` altında veridir.

### 3.1 Neden event değil, poll

Yönetmenin başarı koşulları, HUD'ın zaten her karede okuduğu snapshot'lar
üzerinde **saf yüklem (predicate)** olacak:
`productionLogistics.snapshots().some(s => s.owner === "player" && s.status === "linked")`
gibi. Kodun geri kalanı da böyle çalışıyor (`rtsNotifications.ts:9-11` bunu
açıkça anlatıyor). Poll'ün üç avantajı:

- **Sıra bağımsız:** Oyuncu 4. adımı yanlışlıkla 2. adımda yaparsa, 4. adıma
  gelindiğinde koşul zaten sağlanmış olur ve adım anında geçilir. Event tabanlı
  bir zincir burada kilitlenirdi.
- **Geri alınabilir:** Oyuncu depoyu yıkarsa adım yeniden açılır. Yönetmen
  "yapıldı" bayrağı tutmaz, dünyanın o anki halini sorar.
- **Restart güvenli:** `RtsApp` yeniden başlatıldığında yönetmen sıfırlanır,
  ayrı bir kalıcılık sorunu doğmaz.

---

## 4. Mimari

### 4.1 Yeni dosyalar

```
src/game/rts/tutorial/
  missionScript.ts       // tip tanımları + kapalı MissionGoal birleşimi
  missionPredicates.ts   // hedef türü -> saf yüklem tablosu
  missionDirector.ts     // saf durum makinesi (DOM yok, test:engine kapsamında)
src/game/rts/ui/
  rtsMissionPanel.ts     // sunum: aktif görev kartı
public/game-data/missions/
  frontier_road.json     // hikâye turu verisi
```

Ayrı bir `missionScriptLoader.ts` yazılmadı: yükleme `gameDataLoader.ts`
(`loadMissionScript`), doğrulama `validateGameData.ts` (`validateMissionScript`)
içine kondu. Diğer bütün `public/game-data/` dosyaları o iki modülden geçiyor;
görev betiğine ayrı bir yol açmak, aynı sözleşmenin ikinci bir kopyasını
yaratmak olurdu.

`missionDirector.ts` DOM'a dokunmaz — `rtsNotifications.ts`'in kurduğu örüntü
(`test:engine` ekran görüntüsüne değil duruma bakar) burada da geçerli. Zincirin
kilitlenmezliği, sıra bağımsızlığı ve geri alınabilirliği motor testiyle
pinlenir; "ekranda güzel duruyor mu" sorusu kullanıcıya sorulur (CLAUDE.md
görsel kabul kuralı).

### 4.2 Adım şeması (taslak)

```ts
interface MissionStep {
  readonly id: string;
  readonly title: string;          // "Tarlayı depoya bağla"
  readonly why: string;            // tek cümle gerekçe — asıl öğreten satır
  readonly goal: MissionGoal;      // veri anahtarlı yüklem
  readonly reveal?: MissionReveal; // kamera odağı + vurgulanacak UI öğesi
  readonly unlocks?: readonly string[]; // palete eklenen bina id'leri
  readonly reminderSeconds?: number;    // ilerleme yoksa yumuşak hatırlatma
  readonly beat?: MissionBeat;     // hikâye metni / scripted olay
}

type MissionGoal =
  | { kind: "structure-built"; buildingId: string; count: number }
  | { kind: "producer-linked"; resourceId?: string; count: number }
  | { kind: "population-headroom"; min: number }
  | { kind: "tier-reached"; age: SettlementAge; level: 1 | 2 | 3 }
  | { kind: "control-radius-covers"; markerId: string }
  | { kind: "unit-count"; unitId: string; min: number }
  | { kind: "strategic-point-held"; pointId: string }
  | { kind: "enemy-structure-destroyed"; buildingId: string };
```

`goal` tipleri kapalı bir birleşim: her biri `missionPredicates.ts`'te tek bir
saf fonksiyona bağlanır. Yeni bir hedef türü eklemek, veri yazan kişinin değil,
kod yazan kişinin işi — bu bilinçli, çünkü sınırsız script dili istemiyoruz.

### 4.3 Doğrulama yükümlülüğü

CLAUDE.md'deki allowlist tuzağının aynısı burada da geçerli: görev dosyası
`public/game-data/` altında olduğu için `validateGameData.ts` tarafında bir
`validateMissionScript` gerekir, yoksa alan sessizce düşer. **Faz 2'ye
bırakılmadı, Faz 1'de yazıldı** — burada risk normalden yüksek, çünkü hatalı
bir görev betiği "yanlış oynanan bir maç" değil, **asla tamamlanamayan bir
adım** üretir ve mahsur bıraktığı oyuncu, tanımı gereği oyunun yanıldığını
anlayacak bilgiye sahip olmayan kişidir.

Bu yüzden doğrulayıcı bina id'lerini de referans kontrolünden geçirir:
`loadMissionScript` kendisine `buildingBalance` anahtarlarını alır, `"farmm"`
gibi bir yazım hatası maç başlamadan patlar.

### 4.4 Sunum katmanı

| Katman | Yeniden kullanım |
| --- | --- |
| Aktif görev kartı | Yeni `RtsMissionPanel` — `rtsObjectiveTracker.ts` ile aynı görsel dil |
| Görev tamamlandı / hikâye vuruşu | Mevcut `RtsNotificationCenter` (yeni bir `mission` kind'ı) |
| Dünya üzerinde hedef işareti | `strategicPointView.ts` / `commandMarkers` örüntüsü |
| "Göster" butonu | `cameraController` ile hedefe pan + ilgili palet butonunu darbeli vurgu |
| Mod seçimi | `rtsMatchOverlay.ts` başlangıç kartına üçüncü satır; `victoryConditionChoice.ts`'in sessionStorage örüntüsü birebir kopyalanır |

---

## 5. Hikâye Çerçevesi

> **Sınır Yolu.** Kral, terk edilmiş bir sınır vadisini yeniden yerleştirmen
> için seni gönderdi. Vadide eski bir yol ağının kalıntıları var — bir zamanlar
> burada işleyen bir krallık vardı ve yollar kesildiğinde açlıktan dağıldı.
> Nehrin karşı yakasında aynı emri almış bir rakip lord var.

Bu çerçeve bedavaya geliyor, çünkü:

- **Yolun neden var olduğunu anlatıyor.** Öğretilecek en zor mekanik (§2.2),
  hikâyenin tam merkezinde: "burası yollar kesildiği için çöktü."
- **Mevcut haritayla uyumlu.** Nehir ve iki kanat zaten var
  (`THREEAGES_RTS_PORT_AND_FISHING_PLAN.md` §3.3: nehir haritanın ortasında,
  iki üsse de ~60 birim uzakta).
- **Anlatı altyapısı gerektirmiyor.** Karakter, diyalog ağacı, sinematik yok;
  görev kartındaki `why` satırı ve birkaç bildirim yeterli. Ses ve portre
  isteğe bağlı bir cila olarak Faz 4'te durur.

Anlatının tonu **danışman sesi** olmalı: emir veren değil, sebep söyleyen. Her
görevin `why` satırı, oyuncuya kuralı değil kuralın **niçin**'ini verir —
kuralı zaten oyunun kendi paneli yazıyor (§1).

---

## 6. Görev Zinciri — "Sınır Yolu"

Hedef süre: 20–25 dakika, yani `GDD/01`'in 20–30 dakikalık maç hedefiyle aynı.
Her görev **tam olarak bir** tahmin edilemez kuralı öğretir ve görünür bir
ödülle biter. Tahmin edilebilir olan hiçbir şey (kamerayı kaydır, birim seç)
kendi başına görev değildir — 0. adımın içinde erir.

| # | Görev | Öğrettiği kural | Başarı koşulu |
| --- | --- | --- | --- |
| 0 | **Vadiye iniş** | Kamera, seçim, hareket | Bir işçiyi işaretli noktaya götür |
| 1 | **İlk hasat** | §2.1 — işçiyi sen göndermezsin, tarla kendi işçisini tutar | `structure-built: farm` + tarlada çalışan işçi ≥ 1 |
| 2 | **Dolu ambar, boş hazine** | §2.3 — üretim yerel tamponda birikir | Tarlanın `localBuffer` doldu, hazine artmadı (bilgi vuruşu; oyuncudan eylem istemez) |
| 3 | **Depoyu kur** | §2.2(c) — deposuz bağlantı yok | `structure-built: depot` |
| 4 | **Yolu çek** | §2.2(b) — yol footprint'e temas etmeli | `producer-linked: food, 1` |
| 5 | **Çatı ve nüfus** | Nüfus tavanı | `population-headroom ≥ 5` |
| 6 | **Merkezden büyü** | §2.4 — yükseltme Merkez'den, krallık geneline | `tier-reached: settlement, 2` |
| 7 | **Sınırın ötesi** | §2.5 — karakol kontrol alanını büyütür, yola bağlıysa daha da büyütür | Karakol kuruldu **ve** yola bağlı (`control-radius-covers`) |
| 8 | **Odun ve taş** | Uzun yol / güvenli yol tercihi | İkinci ve üçüncü `producer-linked` |
| 9 | **Kesik yol** | §2.7 — düşman depoyu yıkmadan keser | Scripted küçük baskın; oyuncu bağlantıyı geri kazanır |
| 10 | **Kışla** | Askerî üretim | `unit-count: guard ≥ 3` |
| 11 | **Kasaba** | Çağ geçişi ve gereksinimleri | `tier-reached: town, 1` |
| 12 | **Vadinin sahibi** | §2.6 — geçit orduyla değil karakolla alınır | `strategic-point-held` **veya** rakip ileri karakolu yıkıldı |

12. görev bittiğinde yönetmen çekilir, görev kartı kapanır ve maç normal
kurallarla devam eder — oyuncu isterse rakip merkezi yıkarak askerî zaferle
bitirir. **"Öğretici bitti" ekranı yok.**

### 6.1 Zorluğun yönetimi

- 0–8 arası `aiBalance.army.peaceSeconds` uzatılmış bir profille geçer; AI
  ekonomi kurar, saldırmaz. Zaten var olan saldırmazlık penceresi
  (`intentScorer.ts:316`) kullanılır — yeni bir "AI'yı kapat" anahtarı **gerekmez**.
- 9. görevdeki baskın scripted'dir ve küçüktür: amacı öldürmek değil, kesik
  bağlantı bildirimini (`logistics-cut`) canlı olarak göstermek.
- 10. görevden sonra AI normal profiline döner. Turun son üçte biri gerçek maç.

### 6.2 Kilitlenmeme garantisi

- Her adımın koşulu poll edilir; oyuncu adımı bozarsa (depoyu yıkarsa) adım
  yeniden açılır.
- `reminderSeconds` süresince ilerleme yoksa görev kartı ikinci bir satır açar:
  daha somut bir ipucu + "Göster" butonu (kamerayı hedefe pan eder, ilgili palet
  butonunu vurgular).
- Kaynak yetersizliğiyle kilitlenme: turun preset'i başlangıç kaynaklarını
  cömert verir (`tutorial` preset'i, `core_match`'in kopyası + fazladan odun).
- Her adımda "Atla" değil, **"Bu turu serbest oyuna çevir"** seçeneği bulunur:
  tek bir buton yönetmeni tamamen kaldırır, maç devam eder.

### 6.3 İlk oyun testinin getirdiği düzeltme (2026-07-27)

Zincirin ilk hali oyun testinde iki yerden kırıldı; ikisi de tasarımın kendi
ölçütüne göre hata, "zorluk" değil.

**1. Yanlış açılış: tarla.** Bu projede *her* yapı odunla satın alınıyor (ev 50,
depo 60, karakol 100, kışla 140; yol hücresi başına 4). Zincir tarla → depo →
yol → ev → Merkez Lv2 sırasını dayattığında oyuncu açılış odununu, eline hiç
odun *geçmeden* harcıyor ve hiçbir şey inşa edemediği bir duruma düşüyordu.
Yönetmen bunu göremez: adımların her biri tek tek hâlâ sağlanabilir durumda, ama
bileşke bir kilit. Ayrıca §2.1'in dersi (yapı işçisini kendi tutar) oduncu
kampında tarladakiyle birebir aynı şekilde öğreniliyor — yani açılışı odun yapmak
hiçbir ders kaybettirmiyor. Zincir artık **Oduncu Kampı → Depo → yol bağlantısı**
ile açılıyor; tarla, ekonomi ayakta durduktan sonra 6. adımda geliyor.

Bu, `test:engine`'de bir değişmezle sabitlendi: odun akmaya başlamadan önce
zincirin istediği yapıların toplam odun maliyeti, en cömert olmayan preset'in
açılış stoğunun yarısını geçemez. Kalan yarısı yollara ve yanlış yere konmuş bir
iki binaya ait.

**2. Sayısız çoklu hedef.** "Üç üretim yapısını hatta bağla"
(`producer-linked, count: 3`, kaynak belirtilmemiş) oyuncuya *hangi* üç yapının
kastedildiğini söylemiyordu, kaçının sayıldığını da göstermiyordu. İki düzeltme:
adım kaynak kaynak ayrıldı (Taş Ocağı adımı, Altın Madeni adımı — her biri kendi
`resourceId`'siyle ve kendi cümlesiyle), ve yüklem tablosu artık yalnız
"oldu/olmadı" değil **sayı** döndürüyor (`measureGoal`). Görev kartı hedefi
birden büyük olan adımlarda `2/3` sayacını gösteriyor. `isGoalMet` aynı ölçümden
türetiliyor, yani kartın gösterdiği sayı ile zincirin ilerlediği sayı aynı okuma.

**3. Pazar zincire girdi (yeni `market-trade` hedefi).** Kullanıcının isteği ve
aynı zamanda odun sıkışıklığının tasarım içi cevabı: açılıştaki yiyecek yığını
(500) yalnız işçi/asker eğitiminde harcanıyor, yani ilk dakikalarda ölü sermaye.
Pazar 20 odun ve o yığını altına, altını da odun ve taşa çeviriyor. İki adım
eklendi — Pazar'ı kur, bir işlem yap — ve ikincisi yeni bir hedef türü gerektirdi:
`market-trade`, `enemy-structure-razed` gibi bir sayaç, çünkü takas dünyada
okunabilir bir iz bırakmıyor (satın alınan odunla kesilen odun cüzdanda
ayırt edilemez). Sayaç `RtsApp.trade()` içinde, başarılı olabilen tek çağrı
yerinde tutuluyor.

Zincir bu haliyle 15 adım. Açık kalan §11.1 (ayrı `tutorial` preset'i) **hâlâ
açık** — bu düzeltme kilidi preset'i değiştirmeden, zincirin kendi sırasıyla
çözüyor, ki maçın dengesine dokunmamak tercih edilir.

---

## 7. Kapsam Dışı (bilinçli)

- Kampanya altyapısı, birden çok senaryo, meta ilerleme (GDD/13 kapsam dışı).
- Sinematik, diyalog ağacı, seslendirme.
- Market, kuşatma, liman, sis mekaniklerinin öğretilmesi — bunlar ikinci bir
  tura ya da §8'deki bağlamsal ipucu katmanına kalır.
- Ayrı bir öğretici harita: ilk sürüm mevcut `RTS_CoreMatch` üzerinde çalışır.
  Özel harita ancak Faz 4'te, zincir oturduktan sonra düşünülür.

---

## 8. Yan Kazanç: Serbest Maç İçin Bağlamsal İpucu Katmanı

`missionPredicates.ts` bir kez yazıldığında, `GDD/10` §87'nin "İlk Maç
İpuçları" listesi neredeyse bedava gelir: aynı yüklemler, görev zinciri yerine
**tetikleyici** olarak kullanılır. "Oyuncunun 90 saniyedir bağlantısız bir üretim
yapısı var" → tek seferlik ipucu bildirimi. Bu, §1'de tarif edilen "her kural
için elle ipucu dizesi yazma" örüntüsünü kalıcı olarak bitirir.

Bu, hikâye turunun tek seferlik bir yatırım olmadığı anlamına geliyor: asıl
çıktı **yüklem tablosu**, hikâye onun ilk müşterisi.

---

## 9. Uygulama Fazları

### Faz 1 — Döngü kanıtı (en kritik faz)

- [x] `missionScript.ts` tip tanımları + kapalı `MissionGoal` birleşimi
- [x] `missionPredicates.ts`: `structure-built`, `producer-linked` yüklemleri
- [x] `missionDirector.ts` saf durum makinesi (poll, sıra bağımsız, geri alınabilir)
- [x] `test:engine`: sıra bağımsızlığı, geri alınabilirlik, kilitlenmezlik testleri
- [x] `RtsMissionPanel` — başlık + `why`
- [x] `RtsApp` içinde yönetmenin `onFrame`'e bağlanması (yalnız okur, 4 Hz poll)
- [x] Zincirin ilk üç adımı (tarla → depo → yol) `frontier_road.json` içinde
- [x] `validateMissionScript` + bina id referans kontrolü (Faz 2'den öne alındı)
- [x] `?mission=<id>` boot yolu; betik yüklenemezse maç normal maç olarak açılır
- [x] `npm run build:verify` yeşil
- [ ] **Kullanıcı oyunu açar ve zincirin doğru hissettirdiğini söyler**

Faz 1'de bilinçli olarak yapılmayanlar (Faz 2'ye ait): başlangıç kartındaki mod
seçimi, `reminderSeconds` + "Göster", "serbest oyuna çevir" butonu, görev
kartında ilerleme sayacı.

Faz 1'in tek amacı şunu doğrulamak: "tarla → depo → yol" üçlüsünü hiç bilmeyen
biri, yardım almadan geçebiliyor mu? Cevap hayırsa zincir değil, mekanik
tartışılmalı.

### Faz 2 — Tam zincir

- [x] Kalan yüklemler: `outpost-connected`, `population-headroom`,
      `tier-reached`, `unit-count`, `enemy-structure-razed` + her biri için
      `validateMissionGoal` dalı
- [x] Tek seferlik adımlar için `latch` alanı (opt-in; varsayılan hâlâ
      "yüklem yanlışsa adım yeniden açılır")
- [x] Zincir yazıldı — **15 adım** (aşağıdaki iki sapma + §6.3'teki oyun testi düzeltmesi)
- [x] Başlangıç kartında "Maç türü" satırı (Hikâye turu / Serbest maç)
- [x] "Tutoriali geç": kartta tek tık + `missionSeen` biti (localStorage), böylece
      turu bir kez çözen oyuncuya bir daha varsayılan olarak açılmıyor
- [x] "Serbest oyuna çevir" — duraklatma menüsünde, `MissionDirector.abandon()`
- [x] Görev kartında ilerleme sayacı (`measureGoal`, çoklu hedefli adımlarda `2/3`)
- [ ] `reminderSeconds` + "Göster" davranışı
- [ ] `tutorial` preset'i (§6.2'deki kaynak dengesi için) — §6.3'ten sonra
      zorunlu değil, cila

**Zincirde iki bilinçli sapma:**

1. **0. görev ("Vadiye iniş") ayrı bir adım değil.** Konum tabanlı bir hedef
   (`unit-near-point`) yazmayı ve haritaya marker koymayı gerektiriyordu; oysa
   birlik seçip göndermek bu planın kendi ölçütüne göre **tahmin edilebilir** bir
   şey, yani görev olmamalı. Kontroller `intro` metninin içinde veriliyor.
2. **9. görev ("Kesik yol") Faz 3'e taşındı.** Scripted baskın gerektiriyor;
   zincir onsuz da baştan sona tamamlanabiliyor.

**Bir tasarım düzeltmesi:** §6'daki `control-radius-covers` hedefi
`outpost-connected` oldu. `RtsApp.outpostConnectedToMainRoad()` zaten var ve
territory sistemi karakolun yarıçapını tam olarak ona göre veriyor — yani
öğretilen kural doğrudan ölçülüyor, haritaya marker koyup onun bir sonucunu
ölçmek yerine. Taşınan bir marker'ın adımı sessizce bozması da böylece imkânsız.

### Faz 3 — Tempo ve tehdit

- [ ] Uzatılmış saldırmazlık penceresiyle öğretici AI profili
- [ ] 9. görevin scripted baskını
- [ ] 10. görevden sonra normal AI profiline dönüş
- [ ] Turun baştan sona tek oturumda oynanabildiğinin doğrulanması

### Faz 4 — Hikâye cilası

- [ ] Anlatı metin geçişi (danışman sesi, her görevde tek cümle `why`)
- [ ] Dünya üzerinde görev işaretçisi
- [ ] (İsteğe bağlı) özel öğretici harita `RTS_Tutorial.level.json`
- [ ] (İsteğe bağlı) portre / seslendirme

### Faz 5 — Bağlamsal ipuçları (serbest maç)

- [ ] Aynı yüklemler tetikleyici olarak (§8)
- [ ] `rtsObjectiveTracker.ts:52`'deki elle yazılmış ipucunun bu katmana taşınması

---

## 10. Verilen Kararlar (eski "Karar Bekleyen Sorular")

1. **Mod seçimi** başlangıç kartına üçüncü satır olarak kondu, `victoryCondition`
   örüntüsüyle. Mod satırı zafer koşulunun **üstünde**: hangi tür maç oynandığı,
   o maçın nasıl biteceğinden önce gelen karar.
2. **Varsayılan:** ilk kez oynayana Hikâye turu, turu bir kez çözene Serbest maç.
   "Çözmek" üç şeyden biri: turu bitirmek, ortasında bırakmak, ya da kartta
   Serbest maç seçmek — üçü de aynı soruyu yanıtlıyor. Bu, seçimin (session) ve
   `missionSeen` bitinin (local) ayrı yerlerde durmasını gerektirdi.
3. **Harita:** Faz 1–3 mevcut haritalarda kalıyor.
4. **12. görevin bitişi:** rakip ileri karakolunun yıkılması
   (`enemy-structure-razed`). Bölgesel zafer bayrağından bağımsız — öğretici
   turun deneysel bir bayrağa bağlı olmaması, bir hedef türü yazmaktan değerli.
5. **Anlatı derinliği:** görev başına tek cümlelik `why`. Ayrı hikâye vuruşu yok;
   `intro` ve `outro` çerçeveyi kuruyor.

## 11. Açık Kalan Sorular

1. **Öğretici preset'i.** `gameplay_proof` çağ atlamayı test etmek için kaynağı
   bilerek yüksek tutuyor; bu, 2. adımın ("dolu ambar, boş hazine") dersini
   zayıflatıyor — 5000 yiyecek varken tarlanın 40 birimlik ambarı görünmez.
   Ayrı bir `tutorial` preset'i mi, yoksa zincir bunu kabul mü etsin?
2. **`reminderSeconds` eşiği.** İlerleme olmayan kaç saniye sonra kart ikinci
   satırını açmalı? Adım başına mı, tek genel değer mi?

---

## 12. İlgili Dokümanlar

- `GDD/01_CORE_GAMEPLAY_LOOP.md` — öğretilecek döngünün kaynağı
- `GDD/05_TERRITORY_LOGISTICS_AND_ROADS.md` — yol/depo/kontrol alanı kuralları
- `GDD/10_CAMERA_CONTROLS_AND_UI.md` §86–87 — kilitli içerik ve ilk maç ipuçları
- `GDD/13_VERTICAL_SLICE_PRODUCTION_PLAN_v0.2.md` §6.4 — kampanyanın kapsam dışılığı
- `docs/architecture/UNREAL_BASICS_LESSONS.md` — aktif yürütme hattı
