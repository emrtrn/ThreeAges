# Three Ages: Kingdoms of the Frontier — Audio Design and Production Plan

> **Türkçe ad:** Üç Çağ: Sınır Krallıkları  
> **İngilizce ad:** Three Ages: Kingdoms of the Frontier  
> **Belge türü:** Ses tasarımı, SFX, müzik, voice-over ve üretim planı  
> **Sürüm:** v1.1  
> **Tarih:** 9 Ağustos 2026 (v1.0) — 20 Ağustos 2026 (v1.1: kod envanteri, faz tablosu, şema kararları)  
> **Hedef araçlar:** Adobe Firefly (SFX), Gemini Music / müzik üretimi, ses düzenleme aracı (Audacity veya eşdeğeri)  
> **Hedef platform:** Masaüstü web tarayıcısı  
> **Ana kullanım:** Oyunun tüm ses varlıklarını ortak bir üretim standardıyla planlamak, üretmek, oyuna entegre etmek ve test etmek

---

## 0. Yürütme izi

Bu belgenin §1–§78'i **ne üretileceğini** anlatır ve v1.0'dan beri değişmedi. Bu
bölüm **hangi sırayla yapılacağını** ve nerede kalındığını taşır; belge ancak
bununla yürütülebilir bir plan olur.

### Bu belgede ne nerede

Belge uzun ve iki farklı işi taşıyor: **ne üretileceği** (§1–§78, v1.0'dan beri
sabit) ve **nerede kalındığı** (§0 + §47.0 + §79–§81). İkincisini ararken
bakılacak altı yer:

| Aradığınız | Bölüm |
|---|---|
| **Fazlar ve hangisindeyiz** | §0 → *Fazlar* tablosu, hemen aşağıda |
| **Ne yapıldı, hangi gün** | §0 → *Progress Log* |
| **Sırada ne var, madde madde** | §69 — kutulu görev listesi |
| **Hangi ses hangi dosyayla karşılandı** | §81.1 — olay olay üretim kaydı (22 Ağu 2026'da boşaldı) |
| **Faz 5'te gerçekten ne kaldı** | §82 — üç kovaya ayrılmış; §48–§50'nin kutuları bayat |
| **Ses üretimi olarak ne kaldı** | §82.17 — iki klip, promptlarıyla |
| **Neyin üretilmeyeceği** | §82.11 — kapsam dışı bırakılan kalemler ve gerekçeleri |
| **Bölgesel ambiyans üretim listesi** | §82.13 |
| **Ses stili neye kilitlendi** | §47.0 — kalem kalem, referans varlık id'siyle |
| **Kalite kapıları** | §67 (Gate A–D), §45/§46 (Paket 1 kabulü) |

§69 "yapılacaklar", §81.1 "kalanlar" — ikisi kesişir ama aynı şey değildir:
§69 üretim adımlarını sayar, §81.1 oyunda o an yanlış ses çalan olayları. Paket 1
bittiği için §81.1'in listesi bugün boş; sayfa üretim kaydı olarak duruyor.

### Durum işaretleri

| İşaret | Anlam |
|---|---|
| ✅ | Tamamlandı ve doğrulandı |
| 🔨 | Devam ediyor |
| ⏳ | Sıradaki |
| ⬜ | Başlanmadı |
| ⛔ | Kapsam dışı bırakıldı |

### Fazlar

| Faz | Konu | Durum | Kabul kapısı |
|---|---|---|---|
| **Faz 0** | Kararlar + runtime iskeleti (bus, event tablosu şeması, director, RtsApp mount) | ✅ | `tsc` yeşil, event tablosu sözleşme testleri yeşil, maçta listener pozu güncelleniyor |
| **Faz 1** | Uçtan uca hat: kancalar, mix hiyerarşisi, ilk gerçek UI/yapı sesleri | ✅ | Maçta ses duyuluyor, menü sesleri arka planın üstünde okunuyor; cooldown, instance limiti, mesafe kesmesi ve sis kapısı çalışıyor |

**§77'nin yedi stil-kilidi maddesi ve bağlandıkları yer.** Hepsinin artık bir
tetikleyicisi var; Faz 2'de üretilen varlık `events.json`'da klip id'sini
değiştirmekten ibaret olacak:

| Stil-kilidi maddesi | Olay | Tetikleyici |
|---|---|---|
| Sword hit | `combat.sword_swing`, `combat.body_impact` | animasyon notify |
| Bow release | `combat.arrow_release` | animasyon notify |
| Cannon fire | `siege.cannon_fire` | `launchShot`, namludan |
| Logistics disconnected | `notify.warning` | bildirim severity'si |
| UI click | `ui.click`, `ui.error` | build palette |
| Building complete | `building.complete`, `building.place` | inşaat tamamlanma + yerleştirme onayı |
| Settlement music | `music.settlement` | maç başlangıcı, tek loop |

Bunların yanında §23'ün yapı hasarı (`structure.impact`, `structure.collapse`)
ve §25'in ambiyans yatağı (`world.ambience`) bağlandı.

**Sis kapısı.** Faz 1'de fark edilen ve ilk sürümde eksik olan şey: sunum, sis
binder'ının görünmez yaptığı birimler için de tik atmaya devam ediyor, yani
notify'ları gelmeye devam ediyor. Kapı olmadan görülmeyen bir düşman kolu
**duyuluyordu** — oyuncuya verilmemiş bir keşif aracı. Çizilen efektleri binder
saklıyor; sesin binder'ı yok, bu yüzden `worldAudioAudible(x, z)` üzerinden
kendisi soruyor. Her dünya sesi bu kapıdan geçer; UI sesleri geçmez (oyuncunun
kendi komutunun cevabı haritaya değil oyuncuya aittir).

**Ne bağlanmadı.** Pazar/ekonomi sesleri (§16) — Paket 2–4'ün işi. Birim
seçimi/komut sesleri bu satırda bir süre duruyordu ama 21 Ağustos'ta Guard VO'su
ile birlikte bağlandı: `voice.guard_select`, `voice.guard_move`,
`voice.guard_attack`. Worker ve Archer aynı profilden gelecek (§47.0).

§5.11'in üç stinger'ı (çağ atlama, zafer, yenilgi) 20 Ağustos'ta bağlandı ve
artık placeholder klip üzerinde çalıyor — ayrıntısı §5.11'de. Kalan iki madde
bilinçli olarak açık: **büyük alarm** zaten `notify.alert` olarak var (ayrı bir
stinger'a gerek yok, aynı işi yapar), **maç başlangıcı** ise perde kalkışıyla
çakıştığı için Faz 4'ün müzik durum makinesine bırakıldı — orada zaten bir
"maça giriş" geçişi tanımlanacak.
| **Faz 2** | Package 1 üretimi (Firefly 12 SFX → Settlement müziği → Guard VO), §70/§71/§72 sırasıyla | ✅ | Gate B (§45, §46) — 22 Ağustos 2026'de geçildi |
| **Faz 3** | Stil kilidi (§47) + üretim kaydı (§63) | ✅ | 7 stil-kilidi maddesi onaylandı — §47.0 |
| **Faz 4** | Müzik durum makinesi + crossfade (§28, §35) | ✅ | Durum geçişleri maçta duyuluyor, sinyal kaynağı tanımlı — §35.2 |
| **Faz 5** | Paket 2–4 (UI/notification/ekonomi → yapı/lojistik → birim/savaş) | 🔨 | Gate C (§67) — çalışma sayfası §82 |
| **Faz 6** | Paket 5 (ambience + müzik) | ✅ | Menü/settlement/expansion/tension/battle ×4, üç stinger, harita yatağı ve yedi bölge yatağı sevk edildi — §51 |
| **Faz 7** | Paket 6 polish + mix + erişilebilirlik slider'ları (§62) | 🔨 | Gate D — slider'lar (§62.0/§62.2) ve ducking (§82.16) indi; loudness pass, codec testi ve tekrar yorgunluğu kaldı |
| **Faz 8** | Full-match audio QA (§68) + performans bütçesi doğrulaması (§61) | ⬜ | Gate D |

### Faz 0 neden Package 1'den önce gelir

§77 "önce temsilî paket üret, oyunda test et" diyor ve bu doğru. Ancak
"oyunda test et" adımı, oyunda **çalar hiçbir şey yokken** yapılamaz: bu planın
yazıldığı gün RTS maçında tek bir ses yoktu (§79). Bu yüzden sıra bir yerde
tersine çevrildi:

> Önce **hat** kurulur (placeholder seslerle), sonra **ses** üretilir.

Placeholder olarak proje zaten `assets/starter-content/Sounds/` altında
manifest'e kayıtlı 20 klip taşıyor (`starter-snd-ui-click`,
`starter-snd-footstep-stone`, `starter-snd-impact-light`,
`starter-snd-explosion-01`, `starter-snd-collapse-01`, …). Bunlar oyunun ses
kimliği değildir ve hiçbiri sevk edilmeyecektir; görevleri tek şey: mix
hiyerarşisi (§9), tekrar kontrolü (§11), spatial attenuation (§10) ve bütçe
(§61) **tek bir Firefly üretimi yapılmadan önce** gerçek maçta doğrulansın.

**Hangi kanal placeholder, hangisi değil.** Faz 1 boyunca bu ayrıldı ve
`events.json`'da klip id'sinin önekinden okunur:

| Önek | Ne | Kanallar |
|---|---|---|
| `sfx-*` | Gerçek demo ses, `public/assets/audio/` altında, §6/§7 standardında | UI, info/warning bildirimleri, yapı yerleştirme/tamamlanma/iptal |
| `starter-snd-*` | Forge şablon içeriği, yer tutucu | ~~Aşağıdaki §81 sayımındaki her şey~~ — **hiçbiri, 21 Ağustos 2026'dan beri** |

Faz 2'nin işi ikinci sütunu boşaltmaktı ve boşaldı: bugün `events.json`'daki 29
olayın tamamı üretilmiş varlık çalıyor. Beklendiği gibi kod değişikliği değil,
klip id'si değişikliğiydi.

**Bir düzeltme (20 Ağustos).** Bu tablo bir süre "beş kanal placeholder" dedi;
tabloyu olay olay sayınca daha fazlası çıktı. Unutulan ikisi, tam da
sayılmadıkları için unutulacak olanlar: **birimin iş sesleri** (adım, balta,
kazma — savaş değiller, o yüzden "savaş" satırına girmemişlerdi) ve **alarm
bildirimi** (`notify.alert`, bir çöküş sample'ı; bildirimler "gerçek" sütununda
yazdığı için sorgulanmamıştı). Aynı gün bağlanan üç stinger de doğduğu anda bu
sütuna yazıldı. Sayım artık §81'de olay olay duruyor — 26 olayın 16'sı — ve
orayı boşaltmak Faz 2'nin tanımıdır.

Kazanç şu: Faz 2'de üretilen her varlık, üretildiği gün oyunda dinlenebilir. §46'nın
test senaryosu ve §47'nin stil kilidi ancak böyle gerçek bir gözlem olur.

### Progress Log

| Tarih | Ne yapıldı |
|---|---|
| 2026-08-09 | v1.0 — Audio Bible, envanterler, prompt sistemleri, paketler ve kabul kapıları yazıldı. |
| 2026-08-20 | Kod envanteri çıkarıldı (§79). Boşluğun ses varlıklarında değil **entegrasyon hattında** olduğu görüldü: engine'de bus, spatial subsystem ve SoundCue editörü hazır, RtsApp'te tek satır audio yok. |
| 2026-08-20 | v1.1 — §58 şeması runtime'a bağlandı, §59 bus kararı verildi, SoundCue/event tablosu iş bölümü (§80) yazıldı, dosya adı harf durumu ve lokalizasyon bağı eklendi, faz tablosu açıldı. |
| 2026-08-20 | Faz 0 uygulandı: `voice` + `notifications` bus'ları eklendi, `engine/audio/audioEventTable.ts` (şema + director) yazıldı, `public/game-data/audio/events.json` açıldı, RtsApp'e `AudioSubsystem` mount edildi (listener pozu + autoplay kilidi + notify/notification kancaları). Yol boyunca iki gerçek hata düzeldi: `playedRequests()` sınırsız büyüyordu, ve varsayılan bus tablosu testi bus listesini yeniden yazıyordu (ikisi de artık türetiliyor). `build:verify` yeşil (1526 check). |
| 2026-08-20 | **Hat kulakla doğrulandı** — maçta adım, darbe, savurma, ok, patlama ve bildirim sesleri duyuluyor; mesafe/pan ve tekrar kontrolü çalışıyor. Faz 0 kapandı. |
| 2026-08-20 | Faz 1 kancaları tamamlandı: UI click/error, yapı yerleştirme + tamamlanma, yapı hasarı + çöküş, top ateşleme anı, ambiyans ve müzik yatağı. §77'nin yedi maddesinin tamamı artık tetikleniyor. Yol boyunca bir hata yakalandı: **dünya seslerinin sis kapısı yoktu** — görülmeyen düşman duyuluyordu; `worldAudioAudible` eklendi. |
| 2026-08-20 | İlk mix dinlemesi: arka plan yatağı menü seslerini bastırıyordu. Tabloya `buses` bloğu eklendi (§58) ve §9'un öncelik sırası ilişki olarak teste bağlandı. Ayrıca bir yarış kapatıldı: tablo maç başlamadan yüklenmezse yataklar hiç başlamıyordu — soğuk cache'te maç sessiz geçecekti. |
| 2026-08-20 | **İlk gerçek sesler girdi.** Kullanıcının verdiği demo SFX seti `public/assets/audio/` altına §7'nin klasör yapısı ve §6'nın adlandırma standardıyla alındı, manifest'e dokuz `sound` varlığı olarak kaydedildi. UI, bildirim ve yapı kanalları artık placeholder değil. Savaş, ambiyans ve müzik hâlâ starter-content — o kanallar için üretilmiş ses yok. |
| 2026-08-20 | **Faz 1 kapandı** — mix kulakla doğrulandı, menü sesleri arka planın üstünde okunuyor. |
| 2026-08-20 | Paket 2'nin UI yarısı, yeni varlık üretmeden: `ui.select` (§11'in 260 ms yeniden-seçim cooldown'u ile), `ui.command`, `ui.cancel`, `building.cancel`. Manifest'te bekleyen üç demo klip (`ui/toggle`, `ui/back`, `build_cancel`) kullanıldı. Birim/yapı seçimi, komut verme, mod iptali, duraklat ve inşaat geri çekme artık duyuluyor. |
| 2026-08-20 | **§62'nin ses seviyesi ayarları geldi** (Faz 7'nin ilk parçası). Duraklat kartında dört slider: Ana ses, Müzik, Efektler, Ortam. Model `yetkili × oyuncu` çarpımı (§59.1); sekiz dile çevrildi. `voice`, `ui` ve `notifications` bilinçli olarak slider almadı. Yol boyunca kapatılan boşluk: RtsApp kullanıcı ayarlarını grafik için okuyup kaydediyor ama `audio.busVolumes` bloğunu tamamen görmezden geliyordu. |
| 2026-08-20 | **Slider'lar kulakla ve gözle onaylandı** — §62'ye uygulanan durum yazıldı (§62.0). Faz 7 açıldı. |
| 2026-08-20 | **§5.11'in üç stinger'ı bağlandı**: çağ atlama (yalnız çağ geçişi, çağ içi seviye atlama değil), zafer, yenilgi. `music` bus'ında — gerekçesi §5.11'de, ve gerekçe §62'nin "kritik bilgi yalnız sesle verilmez" kuralına dayanıyor. Kalan iki madde kapatıldı: büyük alarm zaten `notify.alert`, maç başlangıcı Faz 4'e. Üçü de placeholder klip çalıyor. |
| 2026-08-20 | Zafer stinger'ı da duyulmuyordu; gerekçem ("sessizliğe çalıyor, fazlasına gerek yok") yarı yanlıştı. Yenilgi üç saniyelik bir vanaydı ve duyuldu, zafer 0.16 saniyelik bir bipti ve duyulmadı: **süre de okunabilirliğin parçası**, kazanç kadar. İkisi 0.63'e, zaferin klibi uzun olanla değişti. Yol boyunca bir hata: açıklama notu `events` bloğunun içine yazıldı — olay id'leri `_` ile başlayamaz, tablo yüklenirken patlıyordu ve oyunda tek ses kalmazdı; test yakaladı. |
| 2026-08-20 | **Editöre "Veri → Ses Olayları" tablosu eklendi.** Yeni endpoint, yeni validator, yeni şema yok: `/__save-gamedata` zaten `game-data/**.json` kapsıyordu ve jenerik Data Table editörü `assetOptions` ile varlık seçicisini zaten biliyordu — iş, `editorCatalog.ts`'e bir tanım kaydetmekten ibaret kaldı. Kaydetme runtime'ın kendi normalizer'ıyla doğrulanıyor. Yeni test: `clips` bir `sound` seçicisi olmak zorunda, ve şemanın her alanının editör metadata'sı olmak zorunda (yoksa şemaya eklenen alan formda etiketsiz ham bir kutu olarak belirir). |
| 2026-08-20 | `npm run audio:manifest` yazıldı (`tools/sync-audio-manifest.mjs`): üretilen klipleri klasörden okuyup manifest kaydını üretiyor. Ayrı bir klip tablosu **bilinçli olarak** yapılmadı — §6/§7 zaten o tablo, araya bir üçüncüsü girseydi senkron tutulacak fazladan bir yer olurdu. Betik ayrıca §6'nın harf durumu kuralını, id çakışmasını, dosyası silinmiş kaydı ve `events.json`'ın karşılıksız kliplerini kolluyor. Mevcut dokuz kayıt üzerinde dosyayı bayt bayt aynı üretmesi, hiçbir şeyi bozmadığının kanıtı. |
| 2026-08-21 | **İnşaat sesi açıldı** (§17'nin `SFX-BLD-003/004` maddesi, kod tarafı). `building.build_loop`: yapı kurulurken şantiyede çalan konumlu bir döngü. Üç karar yazıldı: (1) döngü, tek tek çekiç darbeleri değil — İşçi paketinde çekiç klibi yok, yani darbeyi asacak bir notify de yok; (2) haritada aynı anda **tek** döngü çalar, ekibi işbaşında olan en yakın şantiyede — dört temel dört çekiç değil bir bulamaç olurdu, üstelik director'ın `stop()`'u olay id'siyle çalıştığı için ikinci bir kopya zaten tek tek durdurulamazdı; (3) kapı ekipte, temelde değil — yolda olan işçi sessiz, ses işle birlikte başlıyor. Şantiye biterse/yıkılırsa döngü 0.35 s'de kısılıyor, bitiş sesi onun üstüne biniyor. Yol boyunca kapatılan boşluk: klip editörden `build-loop` id'siyle içeri alınmıştı — §6'ya uymayan bir ad, ve `audio:manifest`'in dosyadan türettiği id ile ayrışıyordu. Dosya `sfx_building_build_loop_01.ogg` olarak yeniden adlandırıldı, eski kayıt düşürüldü. |
| 2026-08-20 | §69'un kontrol listesi gerçeğe getirildi: Faz 0/1'de yapılan yedi madde hâlâ boş kutuydu (UI click, yapı yerleştirme/tamamlanma, cooldown, instance limiti, spatial attenuation, event mapping, varyant seçimi). Yanlış bir kontrol listesi listesizlikten kötü. §0'a "bu belgede ne nerede" tabelası eklendi — faz tablosu belgenin en başındaydı ve tam bu yüzden bulunamıyordu. |
| 2026-08-20 | Çağ atlama stinger'ı **kulakla doğrulandı**. Teşhis yöntemi kayda değer: iki tur "yine denesenize"den sonra soru tahminle değil, olayın klibi geçici olarak duyulmaması imkânsız bir sese (çöküş, etkin 0.63) alınarak kapatıldı — çaldı, yani kanca baştan beri doğruydu ve mesele duyulabilirlikti. Kalıcı yer tutucu 0.54'e ayarlandı (0.17 duyulmuyor, 0.63 duyuluyor; arası). Ayrıca `playStinger` artık sonucunu logluyor: bir stinger maçta en fazla üç kez, oyuncunun baktığı anda çalar — reddi her zaman arızadır ve aksi halde "kod çalıştı, oyun sessiz" ayrımı hiçbir yerde görünmez. |
| 2026-08-20 | Çağ atlama stinger'ı duyulmuyordu — kanca doğruydu, mix değildi. Aynı anda basılan bildirim kartının bipi `notifications` bus'ında tam kazançta (0.40), stinger ise en sessiz bus'ta 0.17'de: maskeleniyordu. Zafer/yenilgi duyuluyordu çünkü onlar sessizliğe çalıyor. `volume` "kanalı için yüksek" demek, ve en sessiz kanalda bir bildirimi aşmak 1'den fazlasına mal oluyor: 2.2 (etkin 0.40). Placeholder da ayırt edilebilir bir klibe alındı. |
| 2026-08-20 | **Çöküş klipleri `structure.collapse`'a geri verildi.** Kullanıcı maç açılışında kaynağı belirsiz bir çöküş sesi duydu: `notify.alert` bir çöküş sample'ı çalıyordu (Faz 0'dan beri) ve alarm bildirimi mesafesiz olduğu için haritada bakılacak yeri yoktu. `notify.alert` → `starter-snd-door-open`, `stinger.defeat` → `starter-snd-steam-01`. Kural §81.1'e yazıldı: yer tutucu yanlış ses olabilir, başka bir olayın doğru sesi olamaz. |
| 2026-08-21 | **Müzik artık çalma listesi: dört settlement parçası, birbirine geçerek.** §35'in geçiş sistemi uygulandı. Uygulamadan önce iki yanlış varsayım düzeldi: (1) tabloda üç klip vardı ama `loop: true` + `maxInstances: 1` demek director'ın **bir** klip seçip maç boyunca onu döndürmesi demekti — karışık çalma hiç yoktu, dördüncü klip manifest'te olduğu hâlde seçilemiyordu bile; (2) SoundCue editörü bu iş için yanlış araç — crossfade node'u yok (V2 notu), ve RTS hattı zaten cue okumuyor (`evaluateSoundCue` yalnız `RuntimeSceneApp` + DialogueEditor'de). Yeni `engine/audio/musicDirector.ts`: shuffle bag (arka arkaya aynı parça yok, tur sınırında da yok) + equal-power crossfade. `AudioEventDirector`'dan ayrı, çünkü onun işi bir tetiğin **çalıp çalmayacağına** karar vermek (cooldown, cap, mesafe, bütçe) ve `trigger()` handle'ı kendinde tutuyor — bir fade ise tam olarak handle'a ihtiyaç duyar. Fade primitifi hazırdı (`handle.setVolume(v, fade)`), eksik olan sahiplenmeydi. Geçiş anı klibin **ölçülen** süresinden: `AudioSubsystem` decode'da `buffer.duration` kaydediyor (`clipDurationSeconds`), böylece fade müziğin sonuna oturuyor ve üretilmiş parça kendi loop dikişine hiç ulaşmıyor — `loop` bu yüzden `false`. Ayarlar `events.json`'ın yeni `music` bloğunda: `gapSeconds: 0` gerçek crossfade, pozitif değer §35'in "fade out → pencere → fade in" modeli; `segmentSeconds` yalnız süresi henüz bilinmeyen klip için yedek. Equal-power, lineer değil: ilişkisiz iki parça lineer geçişte orta noktada ~3 dB düşer ve her geçiş çukur yapar. Yedi yeni sözleşme testi — hiçbiri süre pinlemiyor, örtüşmeyi/güç korunumunu/çalma sırasını pinliyor. `build:verify` yeşil (1539 check). |
| 2026-08-20 | Placeholder sayımı olay olay çıkarıldı (§81) ve §0'ın "beş kanal" ifadesi düzeltildi: yedi. Sayılmadıkları için gözden kaçan ikisi birimin iş sesleri ve alarm bildirimiydi. Sayarken bir üretim tuzağı da göründü: envanterler rolleri ayırıyor, olay tablosu ayırmıyor — rol başına ses üretmek bugün çalmayacak bir kütüphane demek (§81.2). Yeni sözleşme testi: bir olay üretilmiş ile placeholder klibi karıştıramaz. |
| 2026-08-21 | **Paket 1'in tamamı üretildi ve girdi.** §81.1'in on altı satırı boşaldı: top ateşi (×5), yapıya top impact (×4), kılıç savurma (×4), gövde darbesi (×4), yay (×4), topçu enkazı (×4), yapı çöküşü (×6), adım (×4), balta (×4), alarm (×2), ambiyans (170 s tek loop), dört settlement parçası ve üç stinger. Guard VO'su da geldi (seçim ×1, hareket ×4, saldırı ×4). `events.json` artık 29 olay taşıyor ve **hiçbiri `starter-snd-*` çalmıyor** — Faz 2'nin tanımı buydu. §81.4'ün üç adımı (dosyayı koy → `audio:manifest` → editörden seç) tam olarak beklendiği gibi işledi: hiçbiri için `RtsApp.ts` açılmadı. |
| 2026-08-22 | **Gate B geçildi.** §46'nın dokuz sorusu ve Gate B'nin yedi onay maddesi, birçok kez oynanmış maçlar üzerinden kullanıcı tarafından cevaplandı: dokuz sorunun sekizi temiz, yedi onayın hepsi onay. Ardından §47'nin on iki kalemi kilitlendi (§47.0) — tension/battle parçaları ve Paket 2–5 artık bu referansa uyar. §63'ün üretim kaydı için ayrı dosya açılmadı: kayıt tutulacak tek şey hangi varlığın referans olduğu ve o zaten §47.0'ın tablosunda manifest id'siyle duruyor. Faz 2 ve Faz 3 kapandı. |
| 2026-08-22 | **Tek olumsuz cevap: "crossfade hissedemedim, sanki normal bitip yenisi başlıyor."** Teşhis ölçümle kapatıldı ve kod aklandı — direktör headless koşturulunca 114.03 s'de ikinci parçayı sokup 120.02 s'de birincisini susturuyor, yani 6 saniyelik örtüşme gerçekten var; hat da temiz (bed olay direktörünü baypas ediyor, `maxInstances` reddetmiyor). Sebep zamanlamada: klipler tam 120.00 s ve `handoverAt = uzunluk − crossfade` örtüşmeyi **her zaman son 6 saniyeye** koyuyor. Ogg sayfa profili o saniyelerin sessiz olmadığını gösteriyor, ama üretilmiş bir parça orada kendi kapanışını çalıyor ve gelen parça kendi girişini — iki parçanın en zayıf yerleri üst üste geliyor. §35.0 loop dikişinden kaçınmayı doğru kurmuştu; kaçınılan yerin aynı zamanda parçanın finali olduğu düşünülmemişti. İki yol §35.1'de: önce yalnız tuning (`crossfadeSeconds` 6 → 16-20, örtüşme kendiliğinden erkene kayar), yetmezse bir kuyruk kırpması. |
| 2026-08-22 | **Yatakların bellek yolu değişti: müzik artık stream ediliyor** (§61.1). Müzik 4 parçadan 20'ye çıkınca ölçüldü ve bir eşiğin geçildiği görüldü: `decodeAudioData` her parçayı ham örneklere açıyor, önbellek yalnız `dispose()`'da temizleniyor, yani iki dakikalık stereo bir parça ~44 MiB'ı sekme kapanana kadar tutuyor — çalmasa bile. Yirmi parçada ~880 MiB. §61'in "streaming stratejisi test edilmeli" satırı test edilmemişti. `AudioPlayOptions.stream` eklendi, `music` ve `ambience` yatakları ona geçti. Sözleşme testi: yataklar stream eder, başka hiçbir olay edemez — çünkü bir stream zamanlanmış bir örneğe değil hazır olduğu ana başlar, ki bu kılıç darbesi için yanlış takas. Yol boyunca: `tools/` type-check dışında olduğu için `AudioPlaybackHandle`'a eklenen üye testlerdeki stub'da sessizce eksik kaldı; `tsc` bir şey demedi, çalıştırılsa atacaktı. |
| 2026-08-22 | Editörün Ses Olayları tablosu kategorilendi: 29 düz bölüm yerine §5'in **11 kanal başlığı**, her biri kapalı ve sayaçlı. ECONOMY ile LOGISTICS boş olduğu hâlde listede duruyor — ikisi de bir karar taşıyor (biri "henüz bağlanmadı", diğeri "kendi sesi olmayacak") ve alınmış bir kararın, tekrar sorulacağı yerde yazılı olması en ucuz yer. Sınıflandırılmamış bir olay kaybolmuyor, sonda sarı bir başlık altında görünüyor: akla ilk gelen uygulama (kategori başına filtrele) eşleşmeyeni sessizce yutardı. Katman `EditorDataTableDef.entryCategories` olarak genel eklendi. |
| 2026-08-22 | **Sekme değişiminde müzik boşluğu düzeltildi.** Kullanıcı bildirdi: başka sekmeye geçince oyun duruyor, müzik devam ediyor, dönünce devir gelmiyor. Kök sebep, yatağın iki yarısının iki ayrı saatte koşması — parça ses aygıtının zamanında, devir zamanlaması ise kare başına biriken `audioClock`'ta. Gizli sekmede kareler durup müzik durmayınca parça tükeniyor, zamanlama hâlâ ortasında sanıyor. Çözüm: `MusicDirector.setPaused` iki yarıyı birden askıya alıyor ve her zamanlanmış anı, hiçbir şeyin çalmadığı süre kadar ileri kaydırıyor — böylece host'un saatinin o sırada işleyip işlemediği önemsizleşiyor (gizli sekme: kaydırma sıfır; duraklatılmış maç: gerçek). Sekme gizlenince ayrıca `AudioContext.suspend()` çağrılıyor, çünkü bir media element askıya alınmış context'in içinden de kendi konumunu ilerletir. Duraklatma geçişlere kanca takarak değil durumdan uzlaştırılıyor: duraklatmanın birden fazla girişi var ve birini atlamak aynı ayrışmayı geri getirirdi. Bu, kodda yazılı bir kararı tersine çeviriyor — müzik daha önce bilerek duraklatma kapısının dışındaydı. |
| 2026-08-22 | **Faz 4 kapandı: müzik durum makinesi** (§35.2). §79.4'ün "Faz 4'e girmeden önce yazılmalı" dediği sinyal kaynağı kuruldu — görünür düşman + aktif çatışma + merkeze tehdit, üçü de sis kapısından geçerek (perde arkasındaki ordu için gerilen müzik, verilmemiş bir keşif aracı olurdu). Hasar oranı bilinçle dışarıda: `rtsAttackWatch` yalnız yapıları örnekliyor. Yükseliş anında, düşüş `calmSeconds` sonra ve yarıda kesilen düşüş pencereyi baştan başlatıyor — savaş dikenli, örneği birebir izleyen bir durum tek çarpışmada birkaç kez crossfade yapardı. Eşikler `events.json` → `music.states`; motorda değil oyunda ayrıştırılıyor, çünkü "kaç düşman görünüyor" bu oyuna ait bir soru. `setPlaylist` devri beklemeden başlatıyor: bunsuz battle müziği settlement parçası ne zaman biterse o zaman gelirdi, ki bu makinenin hiç çalışmamasından ayırt edilemez. Menü müziği kendi küçük yığınında (`rtsMenuMusic.ts`) — menü `RtsApp`'ten önce çalışıyor; soğuk açılışta otomatik oynatma politikası reddeder ve ilk harekette yeniden denenir. `build:verify` yeşil (1550 check). |
| 2026-08-22 | **Faz 5 açıldı ve kalanı gerçeğe getirildi (§82).** §48–§50'nin kutuları v1.0'dan kalmaydı ve Faz 0–4'ün yaptıklarını saymıyordu. Kalan iş üç kovaya ayrıldı — kanca / varlık / **önce animasyon** — ve üçüncüsü sayılmasa görülmeyecek olan: tüm skeleton sidecar'larında yalnız altı notify adı authored (`footstep`, `body-impact`, `sword-swing`, `arrow-release`, `throw-release`, `chop-impact`), yani §50'nin istediği yay germe / kalkan / çekiç / topçu geri tepmesi için asılacak işaret yok. Bunlar ses üretim işi değil klip işi, ve kazmanın §81.1'de iptal edilme sebebiyle aynı. Yol boyunca bir de ücretsiz kanal göründü: `throw-release` authored ama hiçbir sese bağlı değil. |
| 2026-08-22 | **Yapı sesleri hasar sunum tablosuna taşınıyor — tasarım onaylandı (§82.5).** Kullanıcının önerisi ve §82.4'ün yapı yarısını yerinden ediyor: varyantı `damage.buildings.<id>.material` string'inden okumak hem çağ körüydü hem 15 binanın 10'unda authored değildi; `debris` slot'u ikisini de çözüyor çünkü `defaults` her binayı kapsıyor ve zaten çağ başına ayrık. Slot bir **olay id'si** adlandırır (klip değil — mix, cooldown ve mesafe olay tablosunundur), alan tek: `sound`, string ya da çağ haritası. Çıplak string iki çağı birden ezdiği için üç katmanlı override istisna tablosunu bedavaya veriyor. Kayda değer gerekçe kullanıcıdan geldi: kasaba efekti kiremit ama kasaba **sesi taş** — efektin malzemesini nereden çıktığı seçiyor (debris anchor'ı `roof`, parçalar çatıdan dökülüyor), sesin malzemesini binanın neden yapıldığı. Sesi efekt id'sinden türetseydik bu ayrım ifade edilemezdi; `sound`'un authored olmasının en iyi gerekçesi bu. Ateş sesi ayrı bir cins: `heavySmoke` saniyede bir yeniden doğan bir spawn, sesi aynı ritimde tetiklemek kekemelik olurdu — bir yatak, ve `building.build_loop`'un tek-döngü kuralıyla. `structureMaterialVariant` retire olacak. |
| 2026-08-22 | **§82.5 uygulandı: yapı sesleri artık hasar tablosundan sürülüyor.** `RtsDamageSlot.sound` indi (string ya da çağ haritası), üç katmanlı override'ı bedavaya aldı, ve `structureMaterialVariant` ile `RTS_AUDIO_SPLIT`'in `structure.impact` satırı retire oldu — yapılarda olay id'si artık türetilmiyor. Uygulanırken üç şey netleşti. Birincisi: `sound` yalnızca çalınan üç slot'a (`debris`, `collapseDust`, `heavySmoke`) yazılabiliyor, çünkü `lightSmoke`/`ruinSmoke` saniyelerle ölçülen aralıklarla yeniden doğuyor ve oraya yazılan bir ses hiç çalmayan bir alan olurdu — validator reddediyor, sessizce yok saymıyor. İkincisi: olay tablosunun "tetiklenmeyen kayıt" testi hasar tablosunu okumayı öğrendi; yoksa veriden tetiklenen her yeni olay öksüz görünürdü. Üçüncüsü, formun pürüzü kendiliğinden çözüldü: form authored veriden render ettiği için `sound`, `sound.settlement` ve `sound.town` yollarının üçüne birden etiket vermek yetiyor — hangisi yazılmışsa o kutu çıkıyor, mod anahtarı gerekmiyor. Üretim tarafı iki klip seti bekliyor: ahşap isabet ve dikişsiz ateş döngüsü. Olaylar bugün var ve çalıyor — ahşap setler taşı işaret ediyor, ateş `starter-snd-fire-01` üzerinde duruyor — yani kalan iş kod değil, klip. |
| 2026-08-22 | **§81.2'nin ertelediği ayrım kararı verildi (§82.4).** Kullanıcı sordu: Guard/Archer/Worker için ayrı ses üretmeden önce olay ayrımı kodda yapılmalı, yoksa üretilen varyantların bir kısmı hiç çalmaz. Doğru soru, ve cevap eksen üzerine çıktı. Önce sorunun **küçük** olduğu görüldü: `sword-swing` yalnız Guard rig'inde, `arrow-release` yalnız Archer'da, `chop-impact`/`throw-release` yalnız Worker'da authored — yani zaten rol başına ayrıklar. Gerçekten paylaşılan üç olay var. Eksen **rol değil `armorClass`** seçildi: zaten authored (guard/siege heavy, archer/worker light), kulağın duyduğu eksen o (bir darbe vuranın rolüne değil vurulanın zırhına benzer — §20 bunu zaten `SFX-GRD-004`/`005` ile söylüyor), ve dört değil iki set demek. İki işaret zıt özneyi okuyor: adım yapanın, darbe üzerine indiğinin. Yapılar kendi ekseninde (malzeme). `resolveRtsAudioVariant` varyantı yalnız tablo cevaplıyorsa seçiyor — müzik durum makinesiyle aynı geri düşüş şekli — ki üretim sınıf sınıf inebilsin. Bugün varyant sevk edilmedi, yani duyulacak değişiklik yok; ayrım kasten klipten önce indi. Yeni üretim 3 set / 12 klip (rol ekseninde 9 set olurdu). İki açık uç yazıldı: 15 binanın 10'u malzeme beyan etmiyor (doldurmanın **görsel** yan etkisi var, moloz ailesini de seçiyor), ve ayrım tekrar kontrolünü ikiye böldüğü için varyantlar indiğinde `cooldownMs`/`maxInstances` yeniden ayarlanmalı. |
| 2026-08-22 | **`unit.death` bağlandı** (§82.2) — Faz 5'in ilk maddesi. Kanca `updateUnitDeaths`'in `onDefeated`'ı: yenilgi karesinde bir kez, iki taraf için de, sis kapısından geçerek. Üç rol için tek olay (§81.2'nin kararı). Zamanlama bilinçle klibe bırakıldı: kanca ölüm animasyonunun başladığı karede çalar, gövdenin indiği anda değil, ve düşüşü işaretlemek her ölüm klibine bir notify yazmayı gerektirirdi — kazmanın tuzağı. Bugün yer tutucu çalıyor (`starter-snd-impact-light`), üretim promptu §82.2'de. Sözleşme testi magnitude pinlemiyor, tekrar kontrolünün **var olduğunu** pinliyor: bir ölüm doğası gereği toplu gelir ve `cooldownMs`'i mix geçişinde 0'a düşürmek hata olarak sessiz, ses olarak duvardır. |
| 2026-08-23 | **Paket 3 indi: yapılar ve lojistik** (§82.7). 21 klip, 10 olay, 7 kanca. Kullanıcının ayrıca söylediği iki kullanım zıt ve ikisi de sözleşme olarak sabitlendi: `building.complete` **tek** klip adlandırıyor (tamamlanma krallığın imza sesi; rastgele dört klip çeşitlilik değil "dört farklı şey oldu" diye duyulur, diğer üçü manifestte seçenek olarak duruyor), `building.construction_hammer` **dördünü de** (bir ekibin her darbesinin aynı olması bozuk gibi duyulan şeydir). Şantiye yatağı kaldı ve darbeler üstüne bindi — yatağın kendi notu neden yalnız olduğunu söylüyordu, çekiç klibi yoktu; kadans hâlâ notify beklemiyor, zamanlayıcının ve bantlı **rastgele**, çünkü eşit aralık makine gibi duyulur. Yalnız uygularken çıkan üçü: yolun başarısı aracın durumundan okunamıyor (durum modu söylüyor, zemini değil — `RoadGraph.version` okunuyor), bağlantı yoklaması her simülasyon tick'inde çalıştığı için kapıya alınmak zorundaydı (`roads.version:territory.version`; aynı desenin hücre başına hâli yol inşasını saniyelerce dondurmuştu), ve "bölge genişledi" bir yüksek-su işareti olmalı — üstelik aynı karede bir bağlantı sesi çaldıysa susuyor, yoksa tek olay iki kez anlatılıyor. `editorCatalog.ts`'in "lojistiğin kendi sesi yok ve olmayacak" kaydı bu teslimatla bozuldu; silinmedi, bozulduğu yazıldı. |
| 2026-08-22 | **Paket 2 indi: UI, bildirimler ve ekonomi** (§82.6). 38 klip, 27 olay. §82.3'ün "seçim paneli butonları" maddesi on dört kanca yazılmadan kapandı: hepsi zaten `announce` ile bildirim atıyordu, ses bildirimin **türüne** bağlandı (`command` → `ui.confirm`, `command-refused` → `ui.error`), ve kendi cevabı olan çağıran için `RtsNotificationRequest.sound` eklendi. Üç tier kaldırılmadı, altına kondu — klibi olmayan tür hâlâ tier'ını duyuyor, ve harita `Partial` olduğu için klibi olmayan bir türü yazmak imkânsız. Üretim sesleri tick'te değil **geçişte**: üretici `producing`'e girdiği karede, yapının konumunda (§16'nın tek sert kuralı). Hover tek delege dinleyicide, çünkü paneller yeniden kuruluyor ve buton başına dinleyici sonradan eklenen paneli sessiz bırakırdı. İki klip eksik geldi (çağ atlama / düşman çağ atlama), kancaları yazılmadı — tablonun cevaplayamayacağı olay üretmemek için. |
| 2026-08-22 | Yol boyunca bir tutarsızlık: `stg_age_up_02.ogg` diskten silinip içeriği `stg_age_up_01.ogg` üzerine yazılmıştı (bayt bayt aynı — yani bir yeniden adlandırma, ve §81.1'in "sevk edilmiş ama çalınmayan" tek varlığını temizliyor), ama manifest hâlâ `stg-age-up-02` kaydını taşıyordu. `audio:manifest` bunu yakalıyor ama **düzeltmiyor** — dosyası olmayan kaydı bildirip yazmayı reddediyor, ki silmenin kasıtlı olduğunu bilemez. Kayıt elle düşürüldü. |
| 2026-08-22 | **Müzik geçiş ayarları editöre açıldı** (§80.1). §35.1 "editörden düzenlenebilir" diyordu ve yanlıştı: Ses Olayları tablosu `section: "events"` ile açılıyor, `music` bloğu formda hiç yoktu. Ayrı bir tablo — aynı dosya, başka derinlik — çünkü ikisinin satırı farklı: olay id'si tekrar eder, `crossfadeSeconds` etmez; bir dikişin özelliği asılacak bir olay satırı bulamaz. Kaydetme iki yarıyı da doğruluyor (motor `music.states`'i dokunmadan geçirir, doğrulaması oyundadır), çünkü iki tablo da tüm dosyayı yazar. Yol boyunca bir hata: skaler girdili bir tabloda "Varsayılana dön" değeri boş nesneye çeviriyordu — `{...structuredClone(18)}` `{}` verir; olay tablosunda görünmemişti çünkü orada her girdi bir nesne, `roads.json` de aynı şekilde etkileniyordu. |
| 2026-08-22 | **İlk dakikada savaş müziği düzeltildi** (§35.2). Kullanıcı bildirdi, ve tahmini ("kurtlar mı tehdit sayılıyor") doğruydu — ama kurtlar `visibleEnemies`'e hiç girmiyordu; giriş **aktif çatışma** sütunundandı. Sahipli toprağa giren bir yırtıcı gerçek bir savaş hedefidir ve yakındaki muhafızlar onu otomatik hedefler: tek kurda cevap veren iki muhafız `battleActiveFights: 2` eşiğini karşılıyordu. İkinci delik aynı sütunda sis kapısının hiç olmamasıydı — haritanın öbür ucundaki, görülmemiş bir AI çarpışması oyuncunun müziğini sürüyordu; sinyalin öteki iki girdisi baştan beri o kapıdan geçiyordu. Ders: bir sinyalin girdileri aynı kuralı paylaşmalı, yoksa yarısı diğer yarısının reddettiği şeyi kabul eder. Kural tek yerde (`countsAsActiveFight`) ve testte. |
| 2026-08-22 | Menü müziği aynı sekme hatasını taşıyordu ve kullanıcı yakaladı: menüdeyken başka sekmeye geçince ses devam ediyor, parça bitince yenisine geçmiyordu. Sebep birebir aynı — menünün kendi kare döngüsü de `requestAnimationFrame`, gizli sekmede duruyor, ses aygıtı durmuyor. Aynı tutma uygulandı. Asıl ders hatanın kendisi değil **iki kez yapılmış olması**: bir müzik yatağı sahiplenen her yığının onu `visibilitychange`'de tutması ve context'i askıya alması gerekiyor, ve eksik bir çağrı tam olarak modülün kendi testinin göremeyeceği şey. Kaynak düzeyinde bir kontrol eklendi — `MusicDirector` kuran her dosya bu üç kancayı taşımak zorunda — ki üçüncü sahip eklendiğinde build söylesin. |
| 2026-08-23 | **`dirt` adı emekli oldu: mevcut adım seti §82.4'ün `light` yarısı ilan edildi.** Kullanıcı ağır adım setini üretmeye girerken sordu, ve soru doğru yerdeydi: dirt seti kalacak mı. Kalmadı — çünkü §82.4'ün gerekçesi zaten "§19'un Worker'ı ile §21'in Archer'ı ikisi de light; tasarımın aralarında adlandırdığı fark gövde değil zemin (dirt)" diyordu, yani mevcut dört klip light setin adı konmamış hâliydi. Light'ı ayrıca üretmek onları **ölü varlık** yapardı: her birimin `armorClass`'ı light ya da heavy, yani iki varyant da sevk edildiğinde base olay bir daha hiç tetiklenmez. Ama base silinemiyor da — `rtsAudioEventIds()` sözleşmesi `unit.footstep`'in tabloda cevaplanmasını zorunlu tutuyor ve `test:engine` bunu kontrol ediyor. Çözüm ikisini birden kapatıyor: dosyalar `sfx_unit_footstep_light_NN.ogg` oldu ve **base olay onlara işaret ediyor**; ayrı bir `unit.footstep_light` kaydı açılmadı, çünkü `resolveRtsAudioVariant` cevaplanmayan varyantı base'e düşürüyor ve aynı dört dosyayı tutan ikinci bir kayıt kalıcı bir kopya olurdu. Ad değişikliğinin kendi gerekçesi de var: `dirt` bir **zemin** ekseni vaat ediyor, kod ise tek boyut taşıyor ve o boyut zırh. Yollar çağa göre toprak→arnavut kaldırımı boyandığı için zemin ekseni ileride gerçekten istenebilir; o gün ikinci bir boyut demek, ve isim onu şimdiden vaat etmemeli. `unit.footstep_heavy` üretimde; indiğinde `cooldownMs`/`maxInstances` §82.4'ün açık ucu gereği ikiye bölünmüş olacak, kulakla yeniden ayarlanmalı. |
| 2026-08-23 | **`unit.footstep_heavy` sevk edildi — §82.4'ün ayrımı ilk kez gerçekten duyuluyor.** Dört klip girdi, olay tabloya eklendi, kodda tek satır değişmedi: `RTS_AUDIO_SPLIT` bu varyantı zaten bekliyordu ve `resolveRtsAudioVariant` tablo cevap verdiği an ona geçiyor — §81.4'ün "klip inince kod değişmez" sözü sınandı ve tuttu. Yeni olayın **her sayısı light'ınkiyle aynı**, bilerek: kablolama tek olay dört rig'e hizmet ederken ayarlanmıştı ve doğruydu, o yüzden bir işçinin adımıyla bir muhafızınki arasında farklı olması gereken tek şey kayıt. İkisini burada da ayırmak, oyuncunun duyduğu her değişikliğin kaynağını belirsiz bırakırdı. Tek istisna zorunluydu: `maxInstances` olay başına, yani ayrım tek başına haritanın eşzamanlı adım tavanını 4'ten 8'e çıkarıyordu — §82.4'ün yazdığı açık uç. İkisi de 3'e çekildi (toplam 6, authored tavana yakın, ve iki sınıftan biri yürürken hâlâ iki adamdan fazlası duyuluyor). Kalan iki paylaşılan olay: `combat.body_impact_*` ve `unit.death_*`. |
| 2026-08-23 | **Rig, bir işaretin ne demek olduğunu değiştirebilir (§82.8).** §82.4'ün zırh ayrımı bir hatayı ortaya çıkardı: `siege_placeholder` `heavy`, yani ağır adım seti indiği gün **top arabası çizme sesi çalmaya başladı** — Siege rig'indeki dört `footstep` işareti tekerlek teması, ve tekerlekli bir top ne yürür ne çizme giyer. Ayrımdan önce de yanlıştı, ama paylaşılan toprak sesinin altında duyulmuyordu. Düzeltme üçüncü bir zırh sınıfı **değil**: `armorClass` "üzerine inen darbe ne kadar acıtır" sorusunu cevaplıyor ve `siege` orada Guard'la dürüstçe aynı sınıfta; farklı olan sesi çıkaran mekanizma, ve o rig'in özelliği. Zırhı genişletmek bir savaş sayısına animasyon sorusu cevaplatırdı. İkinci tablo geldi (`RTS_ROLE_NOTIFY_AUDIO`, rig → işaret → ses) ve iki tür geçersiz kılma taşıyor, çünkü bir rig iki farklı şekilde katılmayabilir: `instead` yerine geçiyor (işaret burada tekerlek demek, adım *ayrıca* çalmamalı), `alongside` üstüne biniyor (gövde gıcırtısının kendi işareti yok, temas işaretlerine biniyor ve kendi `cooldownMs`'i ile seyreliyor). Tek klip ailesi bunu yapamazdı — temas başına bir hız ile birkaç saniyede bir hız aynı sette duramaz; bir işaretin iki olay beslemesinin gerekçesi katman değil **iki ritim**. Geri düşüş §82.4'ünkiyle birebir aynı şekilde, yani kod kliplerden önce indi: bugün top arabası hâlâ ağır adım çalıyor, yanlış ama duyulur. `alongside` bu düşüşü taşımıyor ve taşımamalı — eklemeli bir sesin düşeceği yer yok — ve çözücünün gıcırtıyı asla yerine geçen olarak döndürmediği testte pinlendi, çünkü ikisini karıştırmak gıcırtı indiği gün tekerleği susturur. |
| 2026-08-23 | **Paket 4 indi: 28 klip, 8 olay (§82.9).** Beşi saf veriydi — kod §82.4/§82.8'den beri bekliyordu — üçü kanca istedi. **Birim kanalında artık starter içeriği yok:** `unit.death` 22 Ağustos'tan beri `starter-snd-impact-light` üzerinde duruyordu ve Faz 5'in son yer tutucusuydu. Üç tavan §82.4'ün açık ucu gereği yeniden ayarlandı (`unit.death` 3→2, `combat.body_impact` 6→4), çünkü her ayrım olay başına tavanı ikiye katlıyor. Kanca isteyen üçünde asıl karar uçuş seslerinin **nereye çakılacağıydı**: bir uçuş sesi fiziksel olarak mermiyle hareket eder ve `AudioPlaybackHandle` çalarken taşınamıyor, yani iki uçtan biri seçilmek zorunda. Varış ucu seçildi — kalkış zaten kendi yerinde cevaplanıyor (`combat.arrow_release`, `siege.cannon_fire`) ve aynı noktaya ikinci bir ses koymak onu birincinin altına gömerdi; varış ucunda ise başka hiçbir şeyin yapmadığı işi yapıyor: *buraya bir şey inecek*, oyuncunun bakması gereken yerde ve inmeden önce. Gülle bunu bütün uçuş süresi kadar önden söylüyor. `siege.shell_impact` hasar sesine eklemeli, iki katman: duvarın çatlağı malzemenin verdiği ses, bu onu veren patlama. Yol boyunca iki küçük şey: yetim-olay testi rig geçersiz kılmalarını tanımıyordu (§82.8 id'leri eklendi), ve `rolloff`'un [0,10] sınırı ilk yazdığım 11'i reddetti — doğrulayıcı çalışıyor. |
| 2026-08-23 | **Maçtan iki rapor, iki farklı cins hata (§82.10).** *Gülle ıslığı hiç duyulmuyordu* ve şüphe mesafe kapısındaydı; ölçüm başka yeri gösterdi: rapor ile ıslık **aynı karede** başlıyor, rapor 1.00 sn ve 0.5, ıslık 1.00 sn ve 0.22, üstelik ıslık iniş noktasında yani kameradan daha uzakta. Islık bütün uzunluğu boyunca bangın altında. Zamanlama düzeltmesi yok — uçuş 0.45–1.05 sn ve klip 1.00 sn, yani mermi klipten kısa ve var olmayan bir boşluğa geciktirilemez (0.3 sn erteleme onu bu sefer isabet patlamasının altına sokar). Cevap mikste: 0.22 → 0.4, refDistance 30 → 45, rolloff 7 → 4. Gerçekten ayrışmış bir ıslık üretim işi, tablo işi değil. *Dönüşte gıcırtı yoktu* ve bu işaret modelinin kendi kör noktasıydı: yerinde dönüşte temas işareti yok, tekerlekler bir yere gitmiyor. İkinci tetikleyici eklendi ama **eşik paylaşıldı** — mürettebatın strafe'i zaten `turnRateDegPerSecond * 0.25`'i okuyordu, `siegeTurnGateDegPerSecond` dışa açıldı ve gıcırtı aynı fonksiyonu okuyor; iki ayrı sayı olsaydı biri kayar, top ya sessizce döner ya dururken gıcırdardı. Yaw hızı yeniden ölçülmüyor, sunumun ölçtüğü okunuyor — ikinci bir ölçüm sıfır okurdu, çünkü ilk örnekleyici işaretini çoktan ilerletmiş oluyor. |
| 2026-08-23 | **Beş kapsam kararı ve iki üretim listesi (§82.11–§82.13).** Kullanıcı kalan listeyi okudu: stinger klasörü doğru çıktı — yanlış olan §29'un bayat satırıydı, ve düzeltildiği yazıldı (aynı olguyu iki yerde tutan belge, biri güncellenince *yanlış varlık* raporu üretiyor). Düşman çağ atlaması ayrı klip almayacak: tek `notify.age_up` iki türü de çalacak, çünkü oyuncununkini ayıran şey zaten `stinger.age_up` ve `pitchVariation` sabit kaydırma değil rastgele aralık — aynı sesi verecek iki satır borç olurdu. Tamir kapsam dışı (yapılar kendiliğinden iyileşiyor, kanca asılacak an yok). Yay germe / kalkan / topçu geri tepmesi üretilmeyecek, ve bununla **C kovası tamamen kapandı** — üçü de ikinci katmandı, üç anın da bugün sesi var. Kalan tek serbest işaret `throw-release` ayrıntılandırıldı ve aynı oturumda **kapsam dışı** bırakıldı (§82.12) — gerekçe kalkan bloğununkiyle aynı: `combat.body_impact` isabeti zaten veriyor. İşaretin kendisi duruyor, çünkü ses kancası değil: taşı elden bırakan tüketici o. Bölgesel ambiyans listesi haritadan çıkarıldı (§82.13): yedi yer, mono 30–45 sn — harita geneli yatak 170 sn/stereo/10 MB olduğu için aynı ölçü yedi kez 70 MB demekti. |
| 2026-08-23 | **Bölgesel ambiyans indi — 7 klip, 7 olay, kanca (§82.13).** Kullanıcı yedi yatağı üretti (mono/48 kHz/26.00 sn, toplam 4.8 MB) ve aynı gün bağlandı. Olaylar `world.zone_*` adlandı, `ambience.zone_*` değil: editör kataloğu id önekine göre gruplanıyor ve bunlar `world.ambience` ile aynı §5.8 kanalı — yeni bir önek COMBAT'ınkinin yanına ikinci bir istisna olurdu. Yatak `structure.fire_loop`'un desenini alıyor (played dönmeden sahiplenme yok, durdurma başlatılan id ile, tek instance) ve üç karar bunun üstüne bindi: **aynı anda tek yatak** (iki yatak iki yer değil bir bulamaç), **iki yarıçap** 45 giriş / 62 çıkış (tek yarıçapla sınırda park etmiş kamera yatağı bir kare açıp bir kare kapatır — §35'in müzik asimetrisiyle aynı sebep), ve **duraklatınca susmuyor** (çekiç yalan olur, koru koru olmaya devam eder). Korunun çapası ağırlık merkezi: en yakın gövde olsaydı kesilen her ağaç yatağı yana yürütürdü. `stream: true` mevcut sözleşmeye uyularak seçildi — decode 26 sn'de ~5 MB/klip demekti; element yolunun loop dikişi duyulursa sözleşme kanıtla gözden geçirilecek, tek girdi istisna yapılmayacak. Dört sözleşme testi indi, hepsi ilişki pinliyor. |
| 2026-08-23 | **Bölge yatakları yere göre çalmıyordu — üç hata (§82.14).** Kullanıcı ortamı temizleyip dinledi ve "kameranın yerine göre değil sırayla çalıyor" dedi; rapor doğruydu ve tek hata değildi. **(1)** Mesafe kameranın gözünden ölçülüyordu: göz 20–40 birim yukarıda ve geride, yani her bölge mesafesinde zoom seviyesi vardı ve aynı noktada zoom yapmak bölge değiştirebiliyordu — ölçüm `focusX`/`focusZ`'ye, zemine ve düzlemsele taşındı (yan kazanç: kare başına statik çapa başına bir `heightAt` gitti). **(2)** Yarıçaplar tahminle seçilmişti; ölçüm bitirdi — haritanın korularının en yakın komşusu 27.5 birim, oyuncunun başlangıcı kendi korusuna 16.1 birim, ve ilk 45/62 yarıçapı komşuların birkaçını birden yutuyordu, yani yatak bir yere *varınca* değil öncekinden yeterince *uzaklaşınca* değişiyordu. Şimdi 18/25, ve çıkış yarıçapının en dar çapa aralığının altında kalması pinlendi — pinlendiği gün işe yaradı, ilk düzeltmenin seçtiği 30'u reddetti. **(3)** Devralan bölge koşulsuz tutuluyordu; küçük haritada bu "sonsuza kadar tut" demek. Kural sıraya bağlandı: giriş yarıçapındaki en yakın kazanır, devralan yalnız kimse bir marj kadar yakın değilken korur, marj da üçüncü bir sabit değil iki yarıçapın farkı. Ayrıca bir kontrol geri alındı: "bölge yatağı dünya yatağının altında olmalı" seviyeyi pinliyordu ve kullanıcının ilk dinleme oturumu (dünya yatağı 0, bölgeler 1) onu regresyon diye raporladı. |
| 2026-08-23 | **Koru kaldırıldı, nehir kendi çizgisine bağlandı (§82.15).** İkinci dinleme oturumu: kullanıcı beş yatağı onayladı, koruyu reddetti, nehre daha iyi bir çapa önerdi. **Koru** varlığıyla ve mekanizmasıyla gitti — harita geneli ambiyans zaten orman taşıyor, ve bu projenin koruları vahşi orman değil dikilmiş kümeler, yani yatak orada olmayan bir şeyi anlatıyordu; yedi yatak altıya indi ve §82.14'ün "en dar çapa aralığı" testi dayanağını kaybetti (koruların 27.5 birimini okuyordu). **Nehir** landscape spline'ından okunuyor artık: yol iki yerde yarım authored — Level'ın `riverWaters`'ı hangi spline'ın nehir olduğunu söylüyor, çizgiyi Landscape sidecar'ı veriyor — ve `resolveRtsRiverPaths` ikisini Landscape mount olduğu anda birleştiriyor. Çapa artık kameranın baktığı noktaya en yakın *nehir üstü* nokta (merkezde 1.0 birim, oyuncu üssünde 51.7, yani üste yatak yok). Üç şey uygularken çıktı: köşeye snap değil **segment izdüşümü** (6 nokta ~190 birim, en yakın köşe kıyıdan onlarca birim uzak olabilir); `points` bir küme, sıra `segments` zincirinde — authored sırada okumak bugün doğru ama nehrin ortasına editörde nokta eklendiği gün nehri kendi üstüne katlardı; ve tek çapa id'siyle kayan bir nokta, ki bu devralan mesafesinin **yatağın konduğu noktadan** ölçülmesini gerektirdi (handle taşınamıyor, §82.9). `cooldownMs` altı yatakta da 0'a indi: yeniden oturma aynı olayı aynı karede durdurup başlatmak, yani 0 ile crossfade, başka her değerle delik. Latent bir hata kapsam dışı bırakıldı: `rtsLevelAdapter`'ın rota çözümü spline dönüşünü yok sayıyor — bugün ısırmıyor (rotaların hepsi dönüşsüz) ama aynı okumayı yapan ilk nehir denemesi çizgiyi haritanın dışına koydu. |
| 2026-08-24 | **Ducking indi** (§82.16): §9'un üç öneri satırı ve §52'nin iki kutusu. Yol boyunca üç şey çıktı — duck sabitleri v1.1'den beri **hiçbir yerden çağrılmıyordu**; *mutlak seviye* olarak yazıldıkları için oldukları gibi uygulansalar authored 0.22'lik ambiyansı **yükselteceklerdi** (çarpana çevrildi); ve stinger'lar `music` bus'ında olduğu için bir müzik duck'ı fanfarı kendi kendine kısacaktı (yatak duck'ı `MusicDirector.setDuck` ile bus'a dokunmadan indi). Duck'ı kapatan şey zamanlayıcı değil sesin bitişi — director'a `isPlaying` eklendi. Ayrıca **voice slider'ı** (§62.2, sekiz dil + CJK subset) ve plan tazelendi (Faz 6 ✅, §51/§52 kutuları, §82.7/§82.8/§82.2'nin bayat 'kalan' satırları). 9 yeni sözleşme testi; `test:engine` 1567 yeşil. |

---

## 1. Belgenin amacı

Bu belge, **Three Ages: Kingdoms of the Frontier** için üretilecek bütün ses varlıklarının ortak bir tasarım ve teknik sistem altında hazırlanmasını sağlar.

Ana hedefler:

1. Oyunun ses kimliğini üretim başlamadan önce tanımlamak.
2. SFX, ambiyans, müzik ve kısa birim seslendirmelerini birbirinden kopuk üretmemek.
3. Adobe Firefly ile üretilecek ses efektleri için tekrar kullanılabilir prompt şablonları oluşturmak.
4. Gemini ile üretilecek oyun müzikleri için ortak müzikal yön ve durum sistemi belirlemek.
5. Aynı olayın arka arkaya tekrar etmesinden doğan ses yorgunluğunu azaltmak.
6. Küçük ölçekli RTS savaşlarında okunabilirliği korumak.
7. Sesleri oyunun temel kimliği olan **yol, Depo, Karakol, kontrol alanı ve lojistik ağı** ile ilişkilendirmek.
8. Ses üretimini paketlere ve kabul kapılarına bölerek gereksiz yeniden üretimi azaltmak.
9. Dosya adlandırma, varyant, loop, seviye, spatial audio ve runtime davranışlarını standartlaştırmak.
10. Projeye doğrudan uygulanabilecek bir kontrol listesi ve üretim kaydı oluşturmak.

Bu belge yalnızca bir “ses listesi” değildir. Aynı zamanda bir **Audio Bible**, üretim planı ve teknik entegrasyon rehberidir.

---

## 2. Proje kapsamı ve ses tasarımına etkisi

Güncel oynanabilir kapsam:

- Tek oyunculu RTS
- Tek AI rakip
- Masaüstü web
- Yaklaşık 20–30 dakikalık hedef maç süresi
- Küçük ölçekli üs kurma ve lojistik
- Dört temel kaynak:
  - Yiyecek
  - Odun
  - Taş
  - Altın
- İki güncel oynanabilir çağ:
  - Settlement / Yerleşim
  - Town / Kasaba
- Dört birim rolü:
  - Worker / İşçi
  - Guard / Muhafız
  - Archer / Okçu
  - Artillery / Topçu
- Küçük ve okunabilir çatışmalar
- Yol, Depo, Karakol ve kontrol alanına bağlı lojistik ağı
- AI ekonomisi, genişlemesi, savunması ve saldırısı
- Askerî zafer
- Koşullu bölgesel zafer
- Koşullu fog of war
- Minimap yok

### Ses tasarımında kapsam dışı

İlk tam ses paketi için aşağıdakiler hedeflenmez:

- Süvari sesleri
- Eski koçbaşı sesleri
- Üçüncü çağ için özel müzik veya SFX
- Çok oyunculu iletişim sesleri
- Büyük ordulara özel kitlesel savaş sistemi
- Karmaşık kahraman voice-over sistemi
- Uzun anlatıcı monologları
- Kampanya sinematikleri
- Tam orkestral adaptive stem sistemi
- Her yapı için ayrı uzun ambiyans loop’u
- Her kaynak düğümü için benzersiz bir ses ailesi

---

## 3. Ana ses vizyonu

# Grounded Frontier Medieval RTS

Oyunun ses dünyası “yüksek fantastik destan” yerine **küçük ama büyüyen bir sınır krallığının fiziksel dünyasını** duyurmalıdır.

Ana his:

> Ahşap, taş, demir, deri, yay kirişi, çekiç, ağır teker, uzak kuşlar, rüzgâr ve insan emeği. Savaş yoğunlaştığında müzik ve efektler dramatikleşir; ancak oyun hiçbir zaman sürekli sinematik gürültüye dönüşmez.

### Temel nitelikler

- Ciddi
- Fiziksel
- Topraklı
- Orta çağ
- Kontrollü fantastik
- Okunabilir
- Düşük ses yorgunluğu
- Premium klasik PC RTS hissi
- Küçük ölçekli savaşlara uygun
- Sürekli “epik” olmayan
- Oyuncu kararını destekleyen

### Kaçınılacak genel yön

- Aşırı Hollywood trailer sesi
- Sürekli dev davullar
- Yoğun brass bombardımanı
- Neon-fantasy “magic whoosh”
- Modern askeri radyo sesleri
- Mobil oyuna benzer parlak “reward ding”
- Slot-machine ödül sesleri
- Çok yüksek loudness
- Her eyleme ses ekleme
- Sürekli aynı tek vuruş efektini tekrar kullanma
- Komik veya karikatürize birim sesleri
- Aşırı kahramansı asker replikleri

---

## 4. Ses tasarım sütunları

### 4.1 Oynanış bilgisi önce gelir

Bir ses yalnızca atmosfer için değil, mümkün olduğunca bir oyun durumunu anlatmalıdır.

Örnek:

- Lojistik kesildi → “bir bağlantı bozuldu” hissi
- Yapı tamamlandı → “iş bitti” hissi
- Kaynak tükendi → “üretim kaynağı kalmadı” hissi
- Karakol saldırı altında → “sınır hattı tehdit altında” hissi
- Merkez saldırı altında → daha yüksek öncelikli alarm

### 4.2 Küçük orduda güçlü bireysel okunabilirlik

25–40 birimlik savaşta her bir kılıç darbesi aynı anda öne çıkmamalıdır.

Ana prensip:

- Yakın saldırılar: kısa ve kontrollü
- Ok: daha ince, hızlı
- Top: ağır ve düşük frekanslı
- Yapı hasarı: savaş seslerinden ayrışan ahşap/taş kırılması

### 4.3 Lojistik oyunun kimliğidir

Ses sistemi şu olaylara özel dikkat vermelidir:

- Yol bağlantısı
- Lojistik kesilmesi
- Lojistik geri gelmesi
- Depo stok davranışı
- Dış üretim ağının çalışması
- Karakol sınır güvenliği
- Bağlantı problemi

### 4.4 Müzik oyunu bastırmaz

Müzik sürekli “ön plan” olmamalıdır.

RTS oyuncusu:

- kaynak okuyacak,
- bildirim dinleyecek,
- savaş komutu verecek,
- birim acknowledgement seslerini duyacak.

Bu nedenle müzik orta seviyede, geniş dinamik aralıkta ve çok yoğun olmayan orkestrasyonla üretilmelidir.

### 4.5 Varyasyon tekrar yorgunluğunu azaltır

Sık tekrarlanan seslerde minimum varyant hedefleri:

| Olay | Minimum varyant |
|---|---:|
| UI click | 3 |
| UI confirm | 3 |
| UI error | 2 |
| Kılıç darbesi | 5 |
| Ok atışı | 4 |
| Ok impact | 4 |
| Top ateşi | 3 |
| Top impact | 4 |
| Yapı hasarı | 5 |
| Seçim voice line | 3 |
| Hareket voice line | 4 |
| Saldırı voice line | 3 |

---

## 5. Ana audio kategorileri

```text
AUDIO
├── UI
├── NOTIFICATIONS
├── ECONOMY
├── BUILDING
├── LOGISTICS
├── UNITS
├── COMBAT
├── WORLD_AMBIENCE
├── MUSIC
├── VOICE
└── STINGERS
```

### 5.1 UI

Arayüz ve komut geri bildirimi.

### 5.2 Notifications

Oyuncunun dikkatini gerektiren durumlar.

### 5.3 Economy

Kaynak üretimi, pazar, işçi ve ekonomik süreçler.

### 5.4 Building

Yerleştirme, inşaat, tamamlama, yükseltme ve yıkım.

### 5.5 Logistics

Yol, Depo, bağlantı ve kontrol ağı.

### 5.6 Units

Hareket, seçim, üretim ve role özgü mekanik sesler.

### 5.7 Combat

Silah, mermi, darbe ve yapı hasarı.

### 5.8 World Ambience

Haritanın yaşayan dünya hissi.

### 5.9 Music

Menü ve maç durumlarına bağlı müzik.

### 5.10 Voice

İnsan birimlerinin kısa acknowledgement replikleri.

### 5.11 Stingers

Kısa tek seferlik müzikal geçişler:
- zafer
- yenilgi
- çağ atlama
- büyük alarm
- maç başlangıcı

**Durum (20 Ağustos 2026): üçü bağlandı, ikisi bilinçli olarak bağlanmadı.**

| Stinger | Olay | Tetikleyici | Durum |
|---|---|---|---|
| Çağ atlama | `stinger.age_up` | `KingdomProgressionSystem` tamamlanma olayı, yalnız `kind === "town"` | ✅ placeholder klip |
| Zafer | `stinger.victory` | `showMatchResult`, `outcome === "victory"` | ✅ placeholder klip |
| Yenilgi | `stinger.defeat` | `showMatchResult`, `outcome === "defeat"` | ✅ placeholder klip |
| Büyük alarm | — | `notify.alert` bunu zaten yapıyor (§24) | ⛔ ayrı ses gereksiz |
| Maç başlangıcı | — | Perde kalkışı; Faz 4'ün "maça giriş" geçişi | ⏳ Faz 4 |

Üç karar bu satırların altında duruyor ve üçü de yeniden tartışılacak cinsten,
o yüzden gerekçesiyle yazılıdır.

**1. Stinger'lar `music` bus'ındadır, `notifications` değil.** İşlevleri
duyurmak, yani sınıf olarak bildirime yakınlar; ama bir stinger *müziktir* —
§71 onları skorla aynı enstrüman setinden üretiyor — ve Müzik slider'ını kısan
oyuncu ne istediğini söylemiştir. Bunu göze alabilmemizin tek sebebi §62'nin
kuralının burada da tutması: bu üç anın hiçbiri yalnızca sesle taşınmıyor. Çağ
atlama bildirim kartını basıyor, sonuç ekranı sahanın üstünde duruyor. Sessizlik
oyuncuya süslemeden başka bir şeye mal olmuyor. Tersi doğru olsaydı — bilgi
yalnız stinger'da olsaydı — bus kararı da tersine dönerdi.

**2. Çağ atlama stinger'ı yalnız çağ geçişinde çalar, çağ içi seviye atlamada
değil.** İkisi de aynı olay akışından geliyor ve ikisi de bir bildirim kartı
basıyor; fanfarı ikisine birden vermek, kilometre taşı sesini kilometre taşı
olmayana harcamak olurdu. Sonuç kulakla da okunuyor: seviye atlama bir bip, çağ
atlama bir bip + fanfar.

**Bir ölçüm, ileride "neden bu sayı bu kadar büyük" diye sorulduğunda.** `music`
bus'ı 0.18'de ve bir *yatak* için yazıldı; üstünde çalan tek seferlik bir ses,
işini yapabilmek için yatağın kat kat üstünde olmak zorunda. Çağ atlama
stinger'ı bunun uç örneği: kendi bildirim kartıyla aynı karede çalıyor ve kart
`notifications` bus'ında tam kazançta. Kulakla ölçüldü — etkin 0.17'de hiç
duyulmuyor, 0.63'te kaçırılması imkânsız — ve 0.54'e (volume 3) yerleşti. Bu,
hiyerarşiyle kavga değil: `volume` zaten "kanalı için yüksek" demek, ve bir
yatak ile bir fanfar aynı kanalda aynı işi yapmıyor.

Zafer ve yenilgi bir süre 1'de (etkin 0.18) bırakıldı, gerekçe "onlar sessizliğe
çalıyor, fazlasına gerek yok" idi. **Yarısı doğruydu.** Yenilgi üç saniyelik bir
vanaydı ve duyuldu; zafer 0.16 saniyelik bir bipti ve duyulmadı. Sessizliğe
çalmak, ses oyuncu başını kaldırmadan bitiyorsa hiçbir şey kazandırmıyor —
kazanç kadar **süre** de okunabilirliğin parçası. İkisi de 0.63'e alındı ve
klipleri uzunlukça olanlarla değiştirildi.

**3. Zafer/yenilgi stinger'ı koşulla değil ekranla birlikte çalar.** Maçın
bitmesi ile oyuncuya söylenmesi aynı kare değil; ses söylenmeye aittir. Altta
ambiyans ve müzik yatakları çalmaya devam ediyor — sonuç ekranının altında
yatağı kısmak (ducking) Faz 4'ün işi, çünkü kısılacak bir crossfade henüz yok.

---

# 6. Audio ID ve dosya adlandırma standardı

Dosya adları:

- İngilizce
- küçük harf
- `snake_case`
- anlamlı kategori öneki
- varyant numarası iki haneli

Örnek:

```text
sfx_ui_click_01.ogg
sfx_ui_confirm_01.ogg
sfx_building_place_01.ogg
sfx_building_complete_01.ogg
sfx_combat_sword_hit_01.ogg
sfx_unit_archer_shoot_01.ogg
sfx_artillery_fire_01.ogg
sfx_logistics_disconnected_01.ogg
amb_world_countryside_day_01.ogg
vo_guard_move_01.ogg
mus_gameplay_settlement_01.ogg
stg_victory_01.ogg
```

### Önekler

| Önek | Anlam |
|---|---|
| `sfx_` | Kısa ses efekti |
| `amb_` | Ambiyans |
| `vo_` | Voice-over |
| `mus_` | Müzik |
| `stg_` | Stinger |

### Küçük harf bir stil tercihi değil, bir dağıtım şartıdır

Dosya adlarının küçük harf olması yukarıda estetik bir kural gibi duruyor; bu
projede değil. Windows dosya sistemi harf durumuna duyarsız, git index'i duyarlı
ve dağıtım hedefi Linux. Bunun sonucu daha önce bu depoda yaşandı: diskteki
dosya adını düzeltmek yetmedi, `git ls-files` ile `ls` ayrıştı ve varlık Linux
checkout'unda 404 verdi.

Mevcut placeholder içeriğin `.OGG` uzantısı büyük harflidir
(`Collapse01.OGG`) — **bu, izlenecek örnek değildir.** Üretilecek her yeni ses:

- dosya adı ve uzantı tamamen küçük harf,
- `snake_case`,
- ve depoya girdikten sonra `git ls-files public/assets/audio` çıktısı diskteki
  adla birebir aynı.

Bir dosyanın adı yalnızca yeniden adlandırılarak düzeltilemez; git index'inden
de düşürülmesi gerekir.

---

# 7. Önerilen klasör yapısı

```text
public/assets/audio/
  sfx/
    ui/
    notifications/
    economy/
    buildings/
    logistics/
    units/
    combat/
  ambience/
  voice/
    worker/
    guard/
    archer/
  music/
    menu/
    gameplay/
    results/
  stingers/

audio-source/
  prompts/
  firefly/
  gemini/
  voice/
  edited/
  approved/
  rejected/
```

---

# 8. Teknik ses formatı standardı

## 8.1 Master dosyalar

Önerilen:

- WAV
- 48 kHz
- 24-bit

Master dosya runtime’a doğrudan koyulmak zorunda değildir.

## 8.2 Runtime

Web için başlangıç tercihi:

- OGG Vorbis veya Opus
- 48 kHz
- SFX için orta-yüksek kalite
- Müzik için optimize stereo

Tarayıcı uyumluluğu proje içinde doğrulanmalıdır.

## 8.3 Mono / stereo

### Mono önerilen

- birim saldırıları
- yapı etkileri
- world-space SFX
- kılıç
- ok
- top
- işçi
- yapı hasarı

Sebep: world-space spatialization daha tutarlı olur.

### Stereo önerilen

- müzik
- dünya ambiyansı
- büyük UI modal stinger’ları

### UI

UI efektleri stereo olabilir ancak çoğu küçük UI sesi merkezde veya hafif geniş sunulmalıdır.

---

# 9. SFX loudness ve mix başlangıç ilkeleri

Kesin değerler oyun içinde test edilmelidir.

Başlangıç öncelik sırası:

1. Kritik notification
2. Aktif oyuncu komutu
3. Seçili birim voice
4. Aktif savaş SFX
5. Yapı/economy feedback
6. Ambiyans
7. Müzik

### Prensip

Oyuncunun verdiği komut, uzaktaki rastgele savaştan daha anlaşılır olmalıdır.

### Ducking önerisi

Kısa ducking uygulanabilir:

- kritik notification sırasında müzik: hafif düşer
- voice line sırasında yakın savaş SFX: çok hafif düşer
- zafer/yenilgi stinger sırasında normal müzik: hızlı fade

Aşırı side-chain efekti kullanılmamalıdır.

---

# 10. Spatial audio kuralları

## 10.1 Dünya sesleri

World-space SFX:

- uzaklaştıkça düşmeli
- kameraya göre pan yapmalı
- haritanın tamamından tam ses gelmemeli

## 10.2 Önerilen algısal kategoriler

### Yakın

- kılıç
- yay
- işçi aleti
- yapı hasarı

### Orta mesafe

- top ateşi
- büyük yapı tamamlanması
- karakol alarmı

### Global / UI

- çağ atlama
- kritik merkez alarmı
- zafer
- yenilgi

## 10.3 Topçu

Top ateşi diğer world SFX’lerden daha uzak mesafeden duyulabilir.

Ancak:

- haritanın her yerinden tam güçte çalmamalı
- çok düşük frekanslı sürekli rumble oluşturmamalı

---

# 11. Runtime tekrar kontrolü

Aynı sesin üst üste spam edilmesi önlenmelidir.

### Cooldown örnekleri

| Olay | Önerilen minimum cooldown |
|---|---:|
| UI click | 50–100 ms |
| Aynı unit selection | 250–500 ms |
| Building hit | 80–150 ms |
| Logistics warning | 4–8 sn |
| Population full | 6–10 sn |
| Center under attack | 5–10 sn |
| Outpost under attack | 5–8 sn |

Değerler başlangıç noktasıdır.

### Aynı frame’de ses sayısı

Örnek:

20 Muhafız aynı anda vurduğunda 20 ayrı aynı darbe sesini tam güçte çalmak yerine:

- maksimum eşzamanlı örnek sınırı
- random pitch
- random gain
- distance priority
- event clustering

kullanılmalıdır.

---

# 12. Pitch ve gain varyasyonu

AI üretimi varyantlar bulunmasına rağmen runtime’da küçük değişiklikler uygulanabilir.

Öneri:

```text
pitch: ±2–4%
gain: ±1–2 dB
```

Özellikle:

- kılıç
- ok impact
- çekiç
- taş/ahşap hasarı

için yararlıdır.

Voice-over ve müzikte random pitch uygulanmaz.

---

# 13. Adobe Firefly SFX prompt sistemi

Her prompt şu yapıyı izlemelidir:

```text
A. Sesin oyun içi işlevi
B. Fiziksel kaynak
C. Süre
D. Şiddet
E. Frekans karakteri
F. Ortam
G. Kaçınılacaklar
H. Loop bilgisi
```

## 13.1 Genel SFX prompt şablonu

```text
Create a clean game-ready sound effect for a grounded medieval real-time strategy game.

Event:
[EVENT]

Physical sound:
[PHYSICAL SOURCE]

Character:
[SHORT / HEAVY / DRY / WOODEN / METALLIC / DISTANT / IMPACTFUL]

Duration:
[DURATION]

The sound should be readable in a busy RTS mix, with a clear transient and controlled low frequencies.

No music, no voice, no cinematic trailer boom, no modern machinery, no sci-fi sound, no excessive reverb, no background ambience unless explicitly requested.
```

## 13.2 Loop prompt şablonu

```text
Create a seamless ambient audio loop for a grounded medieval frontier RTS.

Scene:
[SCENE]

Elements:
[ELEMENTS]

Mood:
[MOOD]

Keep the sound natural, low intensity and suitable for continuous playback under gameplay. Avoid prominent one-shot events that reveal the loop point.

Seamless loop.
No music.
No dialogue.
No modern vehicles.
No obvious repeating pattern.
No cinematic effects.
```

---

# 14. SFX envanteri — UI

## P1 öncelikli

| ID | Ses | Varyant |
|---|---|---:|
| `SFX-UI-001` | Normal click | 3 |
| `SFX-UI-002` | Confirm | 3 |
| `SFX-UI-003` | Error / unavailable | 2 |
| `SFX-UI-004` | Hover subtle | 2 |
| `SFX-UI-005` | Open panel | 2 |
| `SFX-UI-006` | Close panel | 2 |
| `SFX-UI-007` | Select unit | 3 |
| `SFX-UI-008` | Select building | 3 |
| `SFX-UI-009` | Attack command | 2 |
| `SFX-UI-010` | Move command | 2 |
| `SFX-UI-011` | Rally point | 2 |
| `SFX-UI-012` | Pause | 1 |
| `SFX-UI-013` | Resume | 1 |

### UI ses dili

Ana malzeme:

- küçük ahşap click
- ince metal latch
- deri/metal kombinasyonu
- düşük yoğunluklu bronz

Kaçınılacak:

- casino coin
- modern keyboard
- sci-fi beep
- smartphone tap
- aşırı parlak “ding”

---

# 15. Adobe Firefly — UI örnek promptları

## 15.1 UI click

```text
Create a very short premium medieval RTS interface click.

A small dry wooden button press combined with a subtle forged-metal latch tick.

Duration around 0.10 to 0.18 seconds.

Crisp and readable, restrained, elegant, not bright.

No music, no coin sound, no digital beep, no keyboard sound, no reverb, no cinematic boom.
```

## 15.2 Confirm

```text
Create a short positive confirmation sound for a serious medieval RTS interface.

A compact wooden click followed by a restrained antique bronze chime with very short decay.

Duration under 0.5 seconds.

The result should feel successful but practical, not magical or celebratory.

No casino reward sound, no orchestral music, no digital beep, no sparkling fantasy effect.
```

## 15.3 Error

```text
Create a short unavailable-action sound for a grounded medieval RTS interface.

A muted iron clack with a low wooden knock, communicating that an action is blocked.

Duration under 0.4 seconds.

Dry, restrained and clear.

No alarm siren, no buzzer, no electronic beep, no music, no comedic sound.
```

---

# 16. SFX envanteri — ekonomi

| ID | Olay |
|---|---|
| `SFX-ECO-001` | Worker begins work |
| `SFX-ECO-002` | Resource production tick — optional |
| `SFX-ECO-003` | Food production |
| `SFX-ECO-004` | Wood production |
| `SFX-ECO-005` | Stone production |
| `SFX-ECO-006` | Gold production |
| `SFX-ECO-007` | Market buy |
| `SFX-ECO-008` | Market sell |
| `SFX-ECO-009` | Stock full |
| `SFX-ECO-010` | Resource depleted |

### Not

Sürekli kaynak üretim tick’i kullanılacaksa çok düşük yoğunluklu olmalıdır.

Tercih:

- kullanıcı etkileşiminde ses
- önemli durum değişiminde ses

Saniyede birçok kez kaynak artışı için ses üretilmemelidir.

---

# 17. SFX envanteri — yapı ve inşaat

| ID | Olay | Öncelik |
|---|---|---|
| `SFX-BLD-001` | Building placement | P1 |
| `SFX-BLD-002` | Invalid placement | P1 |
| `SFX-BLD-003` | Construction hammer 01 | P1 |
| `SFX-BLD-004` | Construction hammer 02 | P1 |
| `SFX-BLD-005` | Construction wood movement | P2 |
| `SFX-BLD-006` | Building completed | P1 |
| `SFX-BLD-007` | Building level-up | P2 |
| `SFX-BLD-008` | Age upgrade start | P2 |
| `SFX-BLD-009` | Age upgrade complete | P1 |
| `SFX-BLD-010` | Demolish confirm | P2 |
| `SFX-BLD-011` | Building collapse wood | P2 |
| `SFX-BLD-012` | Building collapse stone | P2 |

### Building completed

Büyük fanfare yerine:

- ahşap/taş final construction hit
- kısa metal fastening
- düşük yoğunluklu başarı chime

---

# 18. SFX envanteri — lojistik

Bu kategori oyunun ses kimliği açısından kritik kabul edilir.

| ID | Olay | Öncelik |
|---|---|---|
| `SFX-LOG-001` | Road placement | P1 |
| `SFX-LOG-002` | Road segment complete | P2 |
| `SFX-LOG-003` | Depot connected | P1 |
| `SFX-LOG-004` | Logistics disconnected | P1 |
| `SFX-LOG-005` | Logistics restored | P1 |
| `SFX-LOG-006` | Local buffer full | P2 |
| `SFX-LOG-007` | Outpost connected | P2 |
| `SFX-LOG-008` | Territory expanded | P2 |
| `SFX-LOG-009` | Road erase | P2 |

## 18.1 Lojistik kesildi promptu

```text
Create a short alarm sound for a medieval RTS logistics network being disconnected.

Begin with a heavy wooden route marker snap and a broken forged-iron chain link, followed by a restrained low warning resonance.

Duration around 0.8 to 1.2 seconds.

The sound must communicate a supply connection being severed, not generic combat.

No explosion, no sword clash, no modern alarm, no electronic siren, no music, no cinematic trailer boom.
```

## 18.2 Lojistik geri geldi

```text
Create a short positive logistics-restored sound for a grounded medieval RTS.

Use two pieces of wood settling into place, a small iron chain connection click, and a restrained warm bronze confirmation tone.

Duration under 1 second.

Practical and reassuring, not magical.

No digital beep, no casino reward sound, no choir, no music.
```

---

# 19. SFX envanteri — Worker

## Hareket

- ayak sesleri
- kumaş
- hafif ekipman

## İş

- çekiç
- balta
- kazma
- ahşap taşıma
- taş işleme

Önerilen:

| ID | Ses |
|---|---|
| `SFX-WRK-001` | Worker footsteps dirt |
| `SFX-WRK-002` | Worker hammer |
| `SFX-WRK-003` | Worker axe chop |
| ~~`SFX-WRK-004`~~ | ~~Worker pickaxe stone~~ — iptal 2026-08-21, bkz. §81.1 |
| `SFX-WRK-005` | Worker construction generic |
| `SFX-WRK-006` | Worker death |

---

# 20. SFX envanteri — Guard

| ID | Ses | Varyant |
|---|---|---:|
| `SFX-GRD-001` | Heavy infantry footsteps | 3 |
| `SFX-GRD-002` | Shield movement | 3 |
| `SFX-GRD-003` | Sword swing | 4 |
| `SFX-GRD-004` | Sword hit armor | 5 |
| `SFX-GRD-005` | Sword hit flesh/light | 4 |
| `SFX-GRD-006` | Shield hit | 4 |
| `SFX-GRD-007` | Guard death | 3 |

### Guard ses karakteri

- orta-ağır
- kuru metal
- büyük şövalye zırhı kadar ağır değil
- pratik garnizon piyadesi

---

# 21. SFX envanteri — Archer

| ID | Ses | Varyant |
|---|---|---:|
| `SFX-ARC-001` | Light footsteps | 3 |
| `SFX-ARC-002` | Bow draw | 4 |
| `SFX-ARC-003` | Bow release | 4 |
| `SFX-ARC-004` | Arrow flight | 3 |
| `SFX-ARC-005` | Arrow wood impact | 4 |
| `SFX-ARC-006` | Arrow armor impact | 4 |
| `SFX-ARC-007` | Archer death | 3 |

### Archer ses karakteri

- Muhafızdan daha ince
- daha hızlı transient
- daha az düşük frekans
- yay release sesi savaşta okunabilir

---

# 22. SFX envanteri — Artillery

Topçu görsel olarak ağır mobil saha topudur.

Ses kimliği:

- pahalı
- yavaş
- ağır
- uzun menzilli
- yapıya karşı tehlikeli

| ID | Ses | Varyant |
|---|---|---:|
| `SFX-ART-001` | Wheel roll | 3 |
| `SFX-ART-002` | Heavy carriage creak | 3 |
| `SFX-ART-003` | Cannon fire | 3 |
| `SFX-ART-004` | Cannon mechanical recoil | 3 |
| `SFX-ART-005` | Cannonball flight | 3 |
| `SFX-ART-006` | Cannonball ground impact | 4 |
| `SFX-ART-007` | Cannonball stone building | 5 |
| `SFX-ART-008` | Cannonball wooden building | 5 |
| `SFX-ART-009` | Artillery destroyed | 3 |

## 22.1 Top ateşi promptu

```text
Create a heavy late-medieval field cannon firing sound for a grounded fantasy-medieval RTS.

A compact iron or dark-bronze cannon discharges black powder with a powerful short blast, a dense low-mid body, a sharp muzzle crack, and a brief wooden carriage recoil creak.

Duration around 1.5 to 2 seconds.

Powerful and weighty, but not a gigantic naval cannon or modern artillery weapon.

No modern explosive tail, no cinematic sub-bass drop, no machine gun, no sci-fi sound, no music, no battlefield ambience.
```

## 22.2 Yapıya top impact

```text
Create a medieval cannonball impact against a stone building for a strategy game.

A heavy iron ball hits masonry with one deep impact, fractured stone, short debris scatter, and a restrained structural groan.

Duration around 1 second.

Strong but game-readable.

No huge explosion, no modern demolition blast, no long debris avalanche, no music.
```

---

# 23. Combat SFX genel envanteri

| ID | Olay |
|---|---|
| `SFX-CMB-001` | Generic melee whoosh |
| `SFX-CMB-002` | Metal-on-metal hit |
| `SFX-CMB-003` | Metal-on-shield |
| `SFX-CMB-004` | Light unit hit |
| `SFX-CMB-005` | Heavy unit hit |
| `SFX-CMB-006` | Wooden building hit |
| `SFX-CMB-007` | Stone building hit |
| `SFX-CMB-008` | Building critical damage |
| `SFX-CMB-009` | Small wooden collapse |
| `SFX-CMB-010` | Medium stone collapse |

---

# 24. Notification sesleri

Bildirim sesleri üç seviyeye ayrılmalıdır.

## Info

- lojistik geri geldi
- çağ atlama tamamlandı
- bölgesel avantaj

## Warning

- kaynak tükendi
- nüfus dolu
- AI çağ atladı
- saldırmazlık dönemi bitiyor

## Alarm

- lojistik kesildi
- karakol saldırı altında
- merkez saldırı altında
- bölgesel zafer kritik

### Tasarım kuralı

Aynı kart rengi gibi yalnız pitch farkıyla üç seviye oluşturulmamalıdır.

- Info → daha sıcak, kısa
- Warning → daha metalik, keskin
- Alarm → daha düşük ve geniş

---

# 25. Dünya ambiyansı

İlk harita için tek temel dünya ambiyansı yeterlidir.

Ana loop:

`amb_world_frontier_day_01.ogg`

### İçerik

- hafif rüzgâr
- uzak kuşlar
- seyrek yaprak hışırtısı
- uzak küçük yerleşim aktivitesi
- çok hafif doğal alan hissi

### Kaçınılacak

- sürekli yakın kuş ötüşü
- belirgin 5–10 saniyelik tekrar
- her loop’ta aynı büyük olay
- yoğun dere/nehir sesi bütün haritaya
- sürekli insan konuşması
- müzik benzeri tonal drone

---

# 26. Bölgesel ambiyans katmanları — ikinci faz

İlk tam ses paketinden sonra aşağıdaki zone ambience’lar eklenebilir.

| Bölge | Ses |
|---|---|
| Orman | yaprak, kuş, hafif dal |
| Nehir | yumuşak akan su |
| Köprü | tahta gıcırtısı + su |
| Yerleşim | uzak çalışma, çekiç |
| Pazar | çok düşük insan uğultusu |
| Taş Ocağı | seyrek metal-taş |
| Altın Madeni | seyrek kazma / taş |

Bu katmanlar kamera bölgeye yaklaşınca duyulmalıdır.

---

# 27. Music Bible

## 27.1 Müzik hedefi

Müzik:

- oyuna kimlik verir
- uzun süre dinlenebilir
- karar vermeyi bastırmaz
- sürekli yüksek yoğunlukta değildir
- savaş durumunu destekler
- harita ve krallık büyümesini hissettirir

### Ana enstrüman ailesi

Önerilen:

- low strings
- restrained frame drums
- hand percussion
- wooden flutes
- lute / plucked strings
- bowed folk strings
- subtle low brass
- soft horns
- sparse medieval percussion

### Kontrollü fantastik katman

Çok hafif:

- düşük drone
- açık hava horn
- uzun string pad

Ancak “magic fantasy soundtrack” seviyesine çıkmamalıdır.

---

# 28. Müzik durum sistemi

İlk sürüm için önerilen ana durumlar:

```text
MENU
SETTLEMENT
EXPANSION
TENSION
BATTLE
RESULT
```

## 28.1 Main Menu

Rol:
- oyun kimliğini kurmak
- ağır fakat davetkâr olmak

Süre:
- 2:30–4:00

## 28.2 Settlement

Rol:
- üs kurma
- erken ekonomi
- sakin planlama

Yoğunluk:
- düşük

## 28.3 Expansion

Rol:
- dış ekonomi
- karakol
- yol
- harita merkezi

Yoğunluk:
- düşük-orta

## 28.4 Tension

Rol:
- düşman yakın
- sınır tehdit altında
- küçük çatışma öncesi

Yoğunluk:
- orta

## 28.5 Battle

Rol:
- gerçek çatışma
- saldırı
- merkez baskısı

Yoğunluk:
- orta-yüksek

Not:
Battle müziği “boss battle” kadar yoğun olmamalıdır.

## 28.6 Result

- Victory stinger
- Defeat stinger

---

# 29. İlk müzik paketi

| ID | Dosya | Hedef |
|---|---|---|
| `MUS-001` | `mus_menu_frontier_NN.ogg` ✅ ×4 | Menü |
| `MUS-002` | `mus_gameplay_settlement_NN.ogg` ✅ ×4 | Sakin ekonomi |
| `MUS-003` | `mus_gameplay_expansion_NN.ogg` ✅ ×4 | Genişleme |
| `MUS-004` | `mus_gameplay_tension_NN.ogg` ✅ ×4 | Tehdit |
| `MUS-005` | `mus_gameplay_battle_NN.ogg` ✅ ×4 | Savaş |
| `STG-001` | `stg_age_up_01.ogg` ✅ | Çağ |
| `STG-002` | `stg_victory_01.ogg` ✅ | Zafer |
| `STG-003` | `stg_defeat_01.ogg` ✅ | Yenilgi |

**Sevk edilen: 20 parça + 3 stinger (22 Ağustos 2026).** Plan durum başına tek
parça diyordu; her biri **dört** oldu — tekrar yorgunluğu için, ve çalma listesi
zaten shuffle bag olduğu için bedava. Hepsi 120.00 s / 48 kHz stereo, yani
`crossfadeSeconds` bir kez ayarlanıp hepsinde tutuyor. Üretim Firefly'ın alan
tabanlı arayüzüyle yapıldı (§30-§34'ün metin promptları Gemini formatında
kaldı; alanlara çevrimi 22 Ağustos oturumundadır).

**Bir düzeltme (23 Ağustos 2026).** Bu paragraf bir süre "`stg_age_up_01.ogg`
sevk edildi ama artık hiçbir olay çalmıyor, çağ atlama `-02`'ye geçti" dedi ve
**tersi doğru**: `-02` aynı gün `-01`'in üzerine yeniden adlandırıldı (§0'ın
22 Ağustos kaydı), manifest kaydı elle düşürüldü, ve diskte bugün yalnız
`stg_age_up_01.ogg` var — `stinger.age_up`'ın çaldığı dosya odur. Stinger
klasöründe üç dosya var, üçü de bağlı, yetim yok. Boşta duran bir ad
*düzeltilmesi gereken bir varlık* sanıldığı için silinmedi, düzeltildiği
yazıldı.

---

# 30. Gemini müzik prompt sistemi

Her müzik promptu:

```text
A. Oyun
B. Durum
C. Tempo
D. Enstrüman
E. Duygu
F. Yoğunluk
G. Loop
H. Kaçınılacaklar
```

## 30.1 Global müzik stil çekirdeği

```text
Create instrumental background music for a serious small-scale medieval frontier real-time strategy game.

The music should feel grounded, strategic and mature rather than heroic fantasy.

Use restrained medieval and orchestral colors: low strings, plucked folk strings, wooden flute, soft horn, frame drum and light hand percussion.

Keep the arrangement spacious enough for game sound effects and unit voices.

No vocals.
No choir.
No modern electronic drums.
No cinematic trailer drops.
No heroic blockbuster brass.
No aggressive mastering.
No obvious imitation of an existing game soundtrack.
```

---

# 31. Gemini prompt — Settlement

```text
Create a seamless gameplay music track for the settlement-building phase of a serious medieval frontier RTS.

Mood:
calm, focused, practical, slightly hopeful.

Tempo:
around 70–85 BPM.

Instrumentation:
soft plucked strings, low warm strings, sparse wooden flute, light frame drum only occasionally, subtle natural percussion.

The track should support building, resource management and planning without demanding attention.

Keep melodic repetition gentle and unobtrusive.

Length:
about 3 minutes.

Create a loop-friendly ending.

No vocals, no choir, no heroic brass, no battle drums, no dark horror tone, no modern synths, no cinematic trailer effects.
```

---

# 32. Gemini prompt — Expansion

```text
Create loop-friendly gameplay music for the expansion phase of a grounded medieval frontier RTS.

Mood:
purposeful, exploratory, strategic, cautiously optimistic.

Tempo:
around 85–100 BPM.

Instrumentation:
plucked medieval strings, low bowed strings, restrained frame drums, wooden flute, subtle horn phrases.

The track should suggest roads being built, outposts being established and the kingdom extending into contested territory.

Moderate energy, but not battle music.

Length:
about 3 minutes.

No vocals, no choir, no massive brass, no modern drums, no fantasy magic ambience, no cinematic trailer drops.
```

---

# 33. Gemini prompt — Tension

```text
Create loop-friendly tension music for a serious medieval RTS.

Mood:
alert, uncertain, controlled pressure.

Tempo:
around 90–105 BPM.

Instrumentation:
low strings, muted hand percussion, sparse frame drum, short horn textures and very subtle plucked ostinato.

The music should work when enemy forces approach, an outpost is threatened or the logistics network is at risk.

Do not fully resolve into battle intensity.

Length:
2 to 3 minutes.

No vocals, no choir, no horror sound design, no huge drums, no modern synths, no cinematic trailer boom.
```

---

# 34. Gemini prompt — Battle

```text
Create loop-friendly battle music for a small-scale medieval frontier RTS.

Mood:
urgent, disciplined, dangerous, tactical.

Tempo:
around 110–125 BPM.

Instrumentation:
driving low strings, restrained frame drums, hand percussion, short horn phrases and sparse plucked strings.

The battle should feel like 25–40 soldiers fighting around a frontier settlement, not a massive fantasy army.

Keep enough space for sword, arrow and cannon sound effects.

Length:
2 to 3 minutes.

No vocals, no choir, no oversized taiko drums, no superhero brass, no cinematic trailer drop, no modern electronic rhythm.
```

---

# 35. Müzik geçiş sistemi

## 35.0 Uygulanan durum (2026-08-21)

Aşağıdaki geçiş modeli `engine/audio/musicDirector.ts` olarak uygulandı ve
`music.settlement`'ın dört parçası üzerinde çalışıyor. Uygulama iki noktada
buradaki öneriyi genişletti:

- **Boşluk bir ayar oldu, sabit değil.** `events.json` → `music.gapSeconds`.
  Sıfırda iki parça örtüşür (gerçek crossfade), pozitifte aşağıdaki
  fade-out → pencere → fade-in modeli olur. İkisi aynı hareketin farklı
  örtüşmesi, ve hangisinin istendiği müzik hakkında bir karar.
- **Geçiş anı sayaçtan değil, parçanın kendi süresinden.** Klip decode
  edildiğinde süresi ölçülüp saklanıyor, fade müziğin sonuna oturuyor.
  `segmentSeconds` yalnızca süresi henüz bilinmeyen klip için yedek.

Fade eğrisi lineer değil **equal-power** (sin/cos): ilişkisiz iki parça lineer
geçişte orta noktada yaklaşık 3 dB düşer, yani her geçiş duyulur bir çukur
yapar. Parça sırası shuffle bag — dört parça bitmeden hiçbiri tekrar etmez,
tur sınırında da aynı parça arka arkaya gelmez.

Durum bazlı geçiş (settlement → tension → battle) hâlâ açık: onun için gereken
savaş yoğunluğu sinyali yok. Direktör onu taşıyacak biçimde — "sıradaki parçayı
torbadan çek" yerine "durumdan çek" — ama o sinyal ayrı bir iş.

## 35.1 Geçiş duyulmuyor — Gate B'nin tek revizyon maddesi (22 Ağustos 2026)

Kullanıcının §46 dinlemesindeki tek olumsuz cevap: *"crossfade hissedemedim,
sanki normal bitip yenisi başlıyor."* Teşhis, tahmin yerine ölçümle kapatıldı ve
sonuç **koda değil zamanlamaya** çıktı.

**Kod doğru çalışıyor.** Direktör gerçek ayarlarla (`crossfadeSeconds: 6`,
`gapSeconds: 0`) ve gerçek klip süresiyle headless koşturuldu: 114.03 s'de ikinci
parça giriyor, 120.02 s'de birincisi susuyor — tam 6 saniyelik, equal-power bir
örtüşme. Hat da temiz: bed olay direktörünü baypas edip `audioSubsystem.play`'e
gidiyor, yani `maxInstances` ikinciyi reddetmiyor; saat gerçek saniye.

**Ölçülen asıl sebep: fade parçanın *bitişine* oturuyor.** Dört settlement
parçasının süresi tam **120.00 s** (48 kHz stereo, Ogg granule'den ölçüldü) ve
`handoverAt = uzunluk − crossfade` olduğu için örtüşme her zaman **son 6
saniyeye** düşer. Kodlanmış sayfa boyutu profili, o son 6 saniyenin sessiz
olmadığını gösteriyor (114-118 s hâlâ parça ortasının %85-100'ü, yalnız son
1 saniye %60-77'ye iniyor) — yani kırpılan bir şey yok. Ama üretilmiş bir parça
o saniyelerde **kendi kapanışını** çalıyor: çözülen bir kadans, seyrelen bir
doku. Gelen parça da aynı anda **kendi girişini** çalıyor. İki parçanın en zayıf
yerleri üst üste geliyor, ve kulak bunu "biri bitti, öteki başladı" diye okuyor.
Örtüşme matematiksel olarak var, müzikal olarak yok.

Bunu §35.0'ın kararı davet etti: *"fade müziğin sonuna oturuyor, böylece
üretilmiş parça kendi loop dikişine hiç ulaşmıyor."* Dikişten kaçınmak doğruydu;
kaçınılan yerin parçanın kapanışı olduğu düşünülmemişti. Loop olarak üretilmemiş
bir parçada "dikiş" ile "final" aynı yerdedir.

### İki yol, sırasıyla denenecek

1. **Yalnız tuning.** `crossfadeSeconds`'ı büyüt (6 → 16-20). Örtüşme otomatik
   olarak erkene kayar (`120 − 20 = 100. saniye`), gelen parça giden parçanın
   kapanışı sürerken çoktan kurulmuş olur. Kod değişikliği sıfır: `events.json`
   → `music.crossfadeSeconds`. **Uygulandı, 18 saniye** (22 Ağustos) — kulakla
   doğrulanması bekliyor.

   Bu satır bir süre "editörden **Veri → Ses Olayları**'yla da düzenlenebilir"
   dedi ve bu **yanlıştı**: o tablo `section: "events"` ile açılıyor, yani
   yalnızca olay satırlarını gösteriyor; `music` bloğu formda hiç yoktu. Doğrusu
   22 Ağustos'ta yapıldı — ayrı bir tablo, aynı dosyanın başka bir derinliği:
   **Veri → Ses — Müzik Geçişleri** (§80.1).
2. **Kod, birincisi yetmezse.** Fade'in parçanın *sonundan önce* bitmesini
   sağlayan bir kuyruk kırpması (`tailTrimSeconds`): şu an fade nereye konursa
   konsun hep `uzunluk` anında biter, yani kapanış her seferinde çalınır.
   Kırpma, kapanışı tamamen atlatır. Ayarın kendisi tuning, ama `handoverAt`
   onu bilmiyor — orası bir satırlık bir ekleme.

Gate B bu madde yüzünden bloke edilmedi: §47'de kilitlenen şey parçaların
**stili**, ve stil onaylandı. Bu bir geçiş zamanlaması sorunu.

## 35.2 Durum makinesi uygulandı (22 Ağustos 2026)

§28'in altı durumundan **dördü** maça ait ve artık çalışıyor; MENU kabuğun,
RESULT ise §5.11'in iki stinger'ı. Yirmi parça (5 durum × 4) sevk edildi ve
hepsi bir olaya bağlı.

### Sinyal — §79.4'ün kapattığı boşluk

§35'in birleşik skoru üç girdiyle kuruldu (kullanıcının seçimi; **hasar oranı
bilinçli olarak dışarıda** — `rtsAttackWatch` yalnız yapıları örnekliyor ve
birimlere genişletmek ayrı bir iş):

| Girdi | Ne sayıyor |
|---|---|
| Görünür düşman | Sis kapısından geçen düşman birimleri — işçiler hariç |
| Aktif çatışma | O an hedef tutan birimler, iki taraftan da |
| Merkeze tehdit | Görülen en yakın düşmanın oyuncu merkezine uzaklığı |

**Sis kapısı burada da geçerli** ve gerekçesi Faz 1'dekiyle aynı: perde arkasındaki
bir ordu için gerilen müzik, oyuncuya verilmemiş bir keşif aracı olurdu. Düşman
işçisi sayılmıyor — görüş alanına giren bir toplayıcı saldırı değil.

### İlk dakikada savaş müziği — düzeltildi (22 Ağustos 2026)

Kullanıcının raporu: *"oyuna girer girmez ilk dakika bitmeden battle müziğine
geçiş oluyor, acaba kurtlar mı tehdit olarak görülüyor?"* Evet — ama sanıldığı
yerden değil. Kurtlar `visibleEnemies`'e hiç girmiyor (hayvan bir `Unit` değil,
`WildlifeAnimal`); giriş **aktif çatışma** sütunundandı ve sayım iki delik
taşıyordu:

1. **Av, savaş sayılıyordu.** Sahipli toprağa giren bir yırtıcı `predators.hostile()`
   ile gerçek bir savaş hedefi olur, yakındaki muhafızlar onu otomatik olarak
   hedefler (V3'ün territory kuralı) — yani **tek bir kurda cevap veren iki
   muhafız**, `battleActiveFights: 2` eşiğini karşılıyordu. Sinyalin öteki yarısı
   "wildlife is not an enemy" derken bu yarısı diyordu ki bir kurt temizliği
   savaştır. Artık `attackTarget.owner === "wild"` sayılmıyor.
2. **Sis kapısı bu sütunda yoktu.** `visibleEnemies` ve `threatDistance`
   görülebilirlikten geçiyordu, `activeFights` geçmiyordu: haritanın öbür
   ucundaki, hiç görülmemiş bir AI çarpışması (ya da AI'nın kendi kurt derdi)
   oyuncunun müziğini sürüyordu. Aynı gerekçe, aynı kapı.

Kapının kayıp gibi görünüp kayıp olmadığı nokta: oyuncunun kendi birimleri her
zaman kendi görüşünün içindedir, yani **pusuya düşürülen** birim kurbanın
tarafından sayılmaya devam eder — pusucu görünmezken bile. Kural artık
`countsAsActiveFight` olarak tek yerde yazılı ve sözleşme testiyle bağlı.

### Kurallar

```text
battle    aktif çatışma >= 2  YA DA  görülen düşman merkeze <= 28 birim
tension   görünür düşman >= 1
expansion (barış) çağ = town
settlement (barış) çağ = settlement
```

§28.3'ün expansion'ı bir tehdit değil bir **aşama** — o yüzden çağdan geliyor,
savaş sinyalinden değil. Merkeze tehdit maddesi darbe beklemiyor: kasaba
meydanına yürüyen kuşatma kolu, ilk vuruş inmeden battle'dır.

### Çırpınmayı önleyen asimetri

Makine örneğin bir saf fonksiyon değil, çünkü savaş dikenli: bir çatışma iki
saniyeliğine biter, sonraki çift kapanırken yeniden başlar. Örneği birebir
izleyen bir durum, tek bir çarpışmada battle ile settlement arasında birkaç kez
gidip gelir ve her seferinde crossfade yapardı. Bu yüzden:

> **Yükseliş anında, düşüş `calmSeconds` sonra.** Yarıda kesilen bir düşüş
> penceresini baştan başlatır — yani sürekli parlayan bir çarpışma hiç sakine
> ulaşmaz. Savaşa geç kalmak, sakine erken varmaktan kötüdür.

Eşikler `events.json` → `music.states`, dördü de kulakla ayarlanır. Motor değil
**oyun** tarafında ayrıştırılıyor (`rtsMusicState.ts`): "kaç düşman görünüyor"
ve "merkez nerede" bu oyuna ait sorular, ve bunları bilen bir motor şablon
olmaktan çıkardı. Motor yanındaki geçiş zamanlamasını okumaya devam ediyor —
o her çalma listesi için doğru.

### Geçiş anı

Durum değişince `MusicDirector.setPlaylist` devri **beklemeden** başlatıyor.
Bunsuz battle müziği, settlement parçası ne zaman biterse o zaman gelirdi — iki
dakikaya kadar geç, ki bu durum makinesinin hiç çalışmamasından ayırt edilemez.
Zaten süren bir geçiş varsa sıraya alınıyor: yatak iki ses, üç değil.

### Menü müziği (§28.1)

Kendi küçük yığınında (`rtsMenuMusic.ts`), çünkü menü `RtsApp`'ten **önce**
çalışıyor — subsystem, mix ve kare döngüsü henüz yok. Yeniden yazılan bir şey
yok: aynı `AudioSubsystem`, aynı `MusicDirector`, aynı tablo girdisi, yalnız
sahibi farklı. Maç başlarken 0.6 s'de kısılıp context'i bırakıyor.

**Soğuk açılışta duyulmaması beklenir ve bu bir hata değildir:** tarayıcı,
etkileşim görmemiş bir sayfayı seslendirmez ve menü ilk ekrandır. İlk harekette
yeniden deneniyor — maçtan dönüşte etkileşim çoktan olmuştur, ilk ziyarette ise
genellikle kurulum satırları okunurken olur. Menüden hiç durmadan geçen bir
oyuncu sessizlik duyar.

---

İlk sürümde tam adaptive stem sistemi önerilmez.

Tercih:

```text
current track
→ 1–3 sec fade out
→ short transition window
→ new track 1–3 sec fade in
```

### Battle trigger önerisi

Tek bir düşman görülünce battle müziğine geçilmemelidir.

Battle geçişi için birleşik bir skor kullanılabilir:

- görünür düşman birim sayısı
- aktif çatışma sayısı
- oyuncu merkezine tehdit
- seçili ordunun savaşı
- hasar oranı

### Tension

Battle öncesi tampon durum olarak kullanılabilir.

---

# 36. Voice-over hedefi

Tam seslendirilmiş karakter sistemi yerine kısa **RTS acknowledgement voice set** önerilir.

Voice-over kullanılacak birimler:

- Worker
- Guard
- Archer

Topçu:

- İnsan sesi verilmesi zorunlu değildir.
- Araç/mekanik sesleri kimliğini daha iyi korur.
- Eğer ileride topçu mürettebatı görsel olarak eklenirse ayrı değerlendirilir.

---

# 37. Voice-over genel stil

### İngilizce

Dil:
- modern ve anlaşılır İngilizce
- hafif tarihî tat
- ağır Shakespeare dili yok

### Cümle uzunluğu

Hedef:
- 1–5 kelime
- maksimum yaklaşık 2 saniye

### Oyuncu emrine cevap

Replikler:

- kısa
- sakin
- profesyonel
- spam edildiğinde rahatsız etmeyen

### Kaçınılacak

- “For glory!”
- “For the king!” her ikinci replik
- bağırarak konuşma
- kahraman monoloğu
- komedi
- modern askeri jargon
- “roger that”
- “copy”
- modern radyo tonu

---

# 38. Worker voice lines

## Selection

```text
Ready for work.
What needs doing?
I'm here.
```

## Move

```text
On my way.
Right away.
I'll get there.
Moving.
```

## Build / Work

```text
I'll see to it.
Let's get to work.
I'll start here.
Consider it done.
```

## Invalid / cannot

```text
Can't do that.
Not from here.
There's no way through.
```

## Under attack

```text
We're under attack!
Help!
Enemies here!
```

---

# 39. Guard voice lines

## Selection

```text
At your command.
Ready.
Standing by.
```

## Move

```text
Forward.
Moving out.
On the march.
We'll take position.
```

## Attack

```text
Engage!
To arms!
Strike them!
With me!
```

## Hold

```text
Hold here.
Stand your ground.
We hold this line.
```

## Stop

```text
Halt.
Hold.
Stay here.
```

## Under attack / low health

```text
We're taking losses!
They're on us!
Hold the line!
```

---

# 40. Archer voice lines

## Selection

```text
Ready.
Bow at hand.
Awaiting orders.
```

## Move

```text
Moving.
We'll find a position.
On our way.
Taking ground.
```

## Attack

```text
Loose!
Take aim!
Arrows ready!
Mark the target!
```

## Hold

```text
Holding here.
We'll cover this ground.
Position set.
```

## Under attack

```text
They're too close!
We're exposed!
Fall back!
```

---

# 41. Voice line varyasyon politikası

Aynı birim seçildiğinde:

- sırayla değil random
- bir önceki replik mümkünse tekrar edilmez

Önerilen:

```text
selection: 3–4
move: 4–5
attack: 3–4
hold: 2–3
special: 2–3
```

Her birim başına yaklaşık:

```text
15–20 voice line
```

yeterlidir.

Toplam ilk hedef:

```text
Worker: ~18
Guard: ~18
Archer: ~18
Total: ~54 short lines
```

---

# 42. Voice recording / TTS üretim standardı

Hangi araç kullanılırsa kullanılsın:

- aynı karakter için aynı ses modeli
- aynı mikrofon hissi
- aynı oda
- aynı compression karakteri
- aşırı reverb yok
- tam kuru ses veya çok hafif oda

### Karakter yönü

Worker:
- yetişkin erkek
- pratik
- sıcak
- hafif yorgun ama isteksiz değil

Guard:
- yetişkin erkek
- orta-ağır
- disiplinli
- net

Archer:
- yetişkin erkek
- daha hafif
- hızlı
- dikkatli

### Aşırı aksan

Kaçınılmalı.

Hafif nötr British / European medieval flavor düşünülebilir ancak anlaşılırlık önceliklidir.

---

# 43. Building audio hierarchy

Bütün yapılar için ayrı soundscape üretmek yerine ortak aileler kullanılır.

### Civilian

- Ev
- Tarla
- Pazar
- Depo

### Production

- Oduncu Kampı
- Taş Ocağı
- Altın Madeni

### Military

- Kışla
- Okçuluk Alanı
- Karakol

### Strategic

- Merkez

### Kural

Yapı seçildiğinde kısa bir “building selection identity” olabilir.

Örnek:

Pazar:
- hafif coin/wood movement

Kışla:
- kısa metal equipment movement

Ancak her seçime uzun ambiyans çalınmamalıdır.

---

# 44. Kritik oyun olayları için öncelik

Ses üretiminde aşağıdaki olaylar mutlaka güçlü geri bildirim almalıdır.

## Tier 1 — kritik

- Merkez saldırı altında
- Lojistik kesildi
- Yapı tamamlandı
- Birim saldırı komutu
- Top ateşi
- Çağ atlama tamamlandı
- Zafer
- Yenilgi

## Tier 2 — önemli

- Karakol saldırı altında
- Kaynak tükendi
- Nüfus dolu
- Lojistik geri geldi
- Depo bağlandı
- Üretim başladı
- Birim üretildi

## Tier 3 — atmosfer

- hafif işçi sesleri
- pazar ambience
- çevre kuşları
- yapı idle sesleri

---

# 45. Audio Package 1 — stil testi

Paket 1 ses yönünü kilitlemek için minimum ancak temsil edici olmalıdır.

**Tamamlandı — 22 Ağustos 2026.** Kutular üretilmiş varlıklara göre işaretlendi.
İki maddede varyant sayısı planlanandan farklı çıktı ve ikisi de bilinçli:
*Construction hammer* tek tek darbe değil tek bir konumlu döngü oldu
(`building.build_loop`, gerekçesi §69'da), *Logistics disconnected/restored* ise
kendi sesini hiç almadı — bildirim tier'ı taşıyor (`notify.alert` / `notify.info`).
*Arrow impact* ayrı üretilmedi; tabloda ayrı bir olay yok (§81.2).

## UI

- [x] UI click ×3
- [x] UI confirm ×2
- [x] UI error ×2

## Building

- [x] Building placement ×2
- [x] Construction hammer ×3
- [x] Building complete ×2

## Combat

- [x] Sword swing ×3
- [x] Sword hit ×4
- [x] Bow release ×3
- [x] Arrow impact ×3
- [x] Cannon fire ×3
- [x] Cannon stone impact ×3

## Logistics

- [x] Logistics disconnected ×2
- [x] Logistics restored ×2

## Ambience

- [x] Frontier day ambience ×1 seamless loop

## Music

- [x] Settlement gameplay track ×1

## Voice

- [x] Guard selection ×3
- [x] Guard move ×3
- [x] Guard attack ×2

### Paket 1 kabul amacı

Şunları test eder:

- UI dili
- metal/ahşap malzeme dili
- savaş yoğunluğu
- topçunun ağırlığı
- lojistik kimliği
- voice tonu
- müzik ile SFX dengesi
- ambiyans yoğunluğu

---

# 46. Paket 1 oyun içi test senaryosu

Tek bir test maçı hazırlanmalıdır.

### Test akışı

1. Ana menü
2. Maç başlat
3. Birim seç
4. Worker seç
5. Yapı yerleştir
6. İnşaatı tamamla
7. Muhafız seç
8. Hareket emri ver
9. Saldırı başlat
10. Okçu saldırısı
11. Topçu saldırısı
12. Yol kesintisi oluştur
13. Lojistiği tekrar bağla
14. 3–5 dakika normal oynanış
15. Müzik + savaş + notification aynı anda test

### Sorular

- UI click rahatsız ediyor mu?
- Guard voice, kılıç darbesinden ayrışıyor mu?
- Top ateşi fazla yüksek mi?
- Top impact yapıya çarptığını anlatıyor mu?
- Lojistik alarmı savaş alarmından farklı mı?
- Ambiyans tekrar ediyor gibi duyuluyor mu?
- Settlement müziği 5 dakika sonra yoruyor mu?
- Müzik savaş seslerini kapatıyor mu?
- Çok sayıda Guard aynı anda vurunca ses patlıyor mu?

---

# 47. Stil kilitleme

## 47.0 Kilitlendi — 22 Ağustos 2026

Paket 1 Gate B'yi geçti (§67) ve aşağıdaki kalemler kullanıcı tarafından
kilitlendi. **Kilit ne demektir:** bundan sonra üretilecek her ses — tension ve
battle parçaları, Paket 2–5'in tamamı, Worker ve Archer VO'su — bu referansa
uyar. Bir kalemi değiştirmek artık bir tuning değil, kilidi açma kararıdır ve
üretilmiş kütüphaneyi geriye dönük etkiler.

| Kalem | Kilitlenen | Referans varlık |
|---|---|---|
| UI click karakteri | Kısa, tok, tonal olmayan; tekrar tekrar basıldığında yormuyor | `sfx-ui-click-01` |
| Wood/metal oranı | Mevcut yapı + savaş dengesi | `sfx-building-*`, `sfx-combat-sword-swing-*` |
| Cannon low-frequency miktarı | Mevcut bas seviyesi — oyunun en ağır sesi, ama baskın değil | `sfx-artillery-fire-01…05` |
| Sword impact şiddeti | Mevcut sertlik | `sfx-combat-body-impact-01…04` |
| Arrow transient karakteri | Mevcut transient | `sfx-combat-bow-release-01…04` |
| Notification tonal dili | info/warning/alert üçlüsü birbirinden okunuyor | `sfx-notify-{info,warning,alert}` |
| Ambience yoğunluğu | Arka planda kalıyor, dikişi duyulmuyor | `amb-world-frontier-day-01`, bus 0.22 |
| Müzik enstrüman ailesi | Settlement setinin enstrümanları | `mus-gameplay-settlement-01…04` |
| Music loudness | Olay 0.5 × `music` bus 0.18 | §58 tablosu |
| Voice profili | Guard'ın tonu; Worker ve Archer bunun üstüne kurulur | `vo-guard-*` |
| Voice compression | Mevcut; kılıç darbesinin üstünden ayrışıyor (§46 s.2) | `vo-guard-attack-01…04` |
| Global reverb miktarı | Mevcut mesafe/attenuation eğrisi | §10 |

Bu kilidin dayandığı gözlem §46'nın dokuz sorusudur; cevapları ve Gate B'nin
yedi onayı 22 Ağustos 2026 tarihli oturumda alındı. §63'ün üretim kaydı bu
tablodur: ayrı bir dosya açılmadı, çünkü kayıt tutulacak tek şey **hangi varlığın
referans olduğu** ve o zaten manifest id'siyle burada duruyor.

---

Paket 1 kabul edildiğinde aşağıdakiler sabitlenmelidir.

- UI click karakteri
- wood/metal oranı
- cannon low-frequency miktarı
- sword impact şiddeti
- arrow transient karakteri
- notification tonal dili
- ambience yoğunluğu
- müzik enstrüman ailesi
- music loudness
- voice actor / TTS profili
- voice compression
- global reverb miktarı

---

# 48. Paket 2 — UI, notifications ve ekonomi

Varlıklar 22 Ağustos 2026'da üretildi ve girdi; kancaları aynı gün bağlandı
(§82.6). Kalan iki kutunun sebebi tek: klip yok.

- [x] Tüm UI ailesi — click, confirm, error, hover, panel aç/kapa, birim seç,
      yapı seç, saldırı/hareket komutu, rally, duraklat, devam
- [x] Population full
- [x] Resource depleted
- [x] Logistics disconnected — madde "ayrı asset üretmeyeceğiz" diyordu,
      üretildi; artık `notify.alert`'e düşmüyor, kendi klibi var
- [x] Logistics restored — aynı şekilde, `notify.info`'dan ayrıldı
- [x] Outpost attack
- [x] Center attack
- [ ] Age-up — **klip üretilmedi.** `sfx_notify_age_up_01.ogg` teslim listesinde
      vardı ama klasöre düşmedi; bildirim tier'ına (info) düşüyor ve üstünde
      `stinger.age_up` zaten çalıyor
- [x] ~~Enemy age-up~~ — **ayrı klip üretilmeyecek** (karar 23 Ağustos 2026,
      §82.11). Tek klip iki bildirim türünü de karşılar; ayıran şey klip değil,
      oyuncununkine eşlik eden `stinger.age_up`
- [x] Regional victory warning
- [x] Market buy
- [x] Market sell
- [x] Stock full — iki tetikleyici: deponun tavana vurduğu kare, ve yeri olmayan
      bir alımın reddi
- [x] Basic production interactions — iş başlangıcı (yalnız emirle) + kaynak başına
      üretim sesi, üreticinin *üretmeye geçtiği* karede

---

# 49. Paket 3 — yapılar ve lojistik

- [ ] Placement
- [ ] Invalid placement
- [ ] Construction
- [ ] Completion
- [ ] Upgrade
- [ ] Demolition
- [ ] Road placement
- [ ] Road erase
- [ ] Depot connection
- [ ] Territory expansion
- [ ] Outpost connection
- [ ] Optional building identity sounds

---

# 50. Paket 4 — birimler ve savaş

## Worker

- [ ] footsteps
- [ ] hammer
- [ ] axe
- ~~pickaxe~~ (iptal 2026-08-21, bkz. §81.1)
- [ ] death
- [ ] voice

## Guard

- [ ] footsteps
- [ ] sword
- ~~shield~~ ⛔ üretilmeyecek (§82.11)
- [ ] impacts
- [ ] death
- [ ] voice

## Archer

- [ ] footsteps
- ~~draw~~ ⛔ üretilmeyecek (§82.11)
- [ ] release
- [ ] arrow flight
- [ ] impacts
- [ ] death
- [ ] voice

## Artillery

- [ ] wheel
- [ ] carriage
- [ ] fire
- ~~recoil~~ ⛔ üretilmeyecek (§82.11)
- [ ] cannonball
- [ ] stone hit
- [ ] wood hit
- [ ] destroyed

---

# 51. Paket 5 — ambience ve müzik

**Tamamlandı (22–23 Ağustos 2026).** Kutular §29'un sevk kaydına ve diskteki
dosyalara göre işaretlendi; sayılar plandan farklı çıktığı yerde neden farklı
olduğu yazıldı.

- [x] Menu ×4
- [x] Settlement ×4
- [x] Expansion ×4
- [x] Tension ×4
- [x] Battle ×4
- [x] Age-up stinger
- [x] Victory
- [x] Defeat
- [x] World base ambience — `amb_world_frontier_day_01`
- [x] Bölgesel ambiyans ×6 — liste, şartname ve promptlar §82.13'te
      (nehir, yerleşim, pazar, taş ocağı, altın madeni, tarla; orman üretildi ve
      §82.15'te geri alındı)

---

# 52. Paket 6 — polish

- [x] Random pitch/gain — `pitchVariation`, olay başına (§58)
- [x] Concurrent instance limits — `maxInstances` + global bütçe (§61)
- [x] Cooldowns — `cooldownMs`, gerçek saniyeyle (§11)
- [x] Distance attenuation — `refDistance`/`rolloff`/`maxDistance` + sis kapısı
- [x] Music crossfade — equal-power, parçanın kendi süresinden zamanlanıyor (§35)
- [x] Critical notification ducking — §82.16
- [x] Voice ducking — §82.16
- [ ] Final loudness pass
- [ ] Browser codec test
- [x] Asset preload policy — yataklar stream, kısa sesler decoded (§61.1)
- [ ] Low-performance fallback
- [ ] Mobile kapsam dışı kontrol
- [ ] Full-match audio fatigue test — §68

---

# 53. Firefly üretim çalışma akışı

```text
1. Envanter ID seç
2. Event fonksiyonunu doğrula
3. Prompt şablonunu doldur
4. 3–6 aday üret
5. En iyi 2 adayı seç
6. Trim yap
7. Noise / unwanted tail temizle
8. Gerekirse transient düzenle
9. Loudness normalize et
10. Game-ready master export
11. Runtime OGG/Opus türevi üret
12. Oyun içinde gerçek olayla test et
13. Kabul / revise / reject
14. Üretim kaydına ekle
```

---

# 54. Müzik üretim çalışma akışı

```text
1. Music state seç
2. Global music style core ekle
3. BPM ve instrumentation belirle
4. 2–4 aday üret
5. En iyi kompozisyonu seç
6. Intro ve outro analiz et
7. Loop uygunluğunu test et
8. Gerekirse edit yap
9. 10 dakika tekrar test et
10. SFX altında test et
11. Combat transition test et
12. Runtime türevini export et
13. Music state sistemine bağla
```

---

# 55. Ses düzenleme checklist’i

Her SFX için:

- [ ] Başta gereksiz silence yok
- [ ] Sonda gereksiz tail yok
- [ ] Click/pop yok
- [ ] Stereo ise phase sorunu yok
- [ ] Noise yok veya kabul edilebilir
- [ ] Bass kontrol altında
- [ ] Mid frekans oyun içinde okunuyor
- [ ] Aşırı limiter yok
- [ ] Normalize edilmiş
- [ ] Gerçek runtime ölçüsünde test edildi
- [ ] 3+ aynı ses üst üste test edildi

---

# 56. Loop checklist’i

Ambiyans ve müzik:

- [ ] Loop point duyulmuyor
- [ ] Ani volume jump yok
- [ ] Tonal reset yok
- [ ] Aynı belirgin kuş/çekiç sürekli tekrar etmiyor
- [ ] 10 dakika dinleme testi geçti
- [ ] Headphones test edildi
- [ ] Normal speaker test edildi

---

# 57. Voice checklist’i

- [ ] Aynı karakter aynı ses profili
- [ ] Aynı loudness
- [ ] Aynı EQ karakteri
- [ ] Aynı reverb
- [ ] Replik kısa
- [ ] Modern jargon yok
- [ ] Birbirine çok benzeyen replik yok
- [ ] Attack replikleri fazla bağırmıyor
- [ ] Selection spam testi geçti
- [ ] Subtitle gerekmez; replik oynanış için kritik bilgi taşımıyor

---

# 58. Audio event veri modeli — kesinleşmiş şema

Ses dosyaları doğrudan gameplay koduna dağınık şekilde sabitlenmemelidir.

v1.0 bu bölümü bir öneriyle bırakmış ve "kesin şema mevcut runtime audio
mimarisi incelendikten sonra uyarlanmalıdır" demişti. §79'daki envanter o
incelemedir; aşağısı borcun ödenmiş hâlidir.

**Konum:** `public/game-data/audio/events.json`
**Şema kaynağı:** `engine/audio/audioEventTable.ts` (`normalizeAudioEventTable`)
**Runtime:** `AudioEventDirector` (aynı dosya) → `AudioSubsystem.playOneShot`

```json
{
  "schema": 1,
  "events": {
    "combat.sword_swing": {
      "clips": ["starter-snd-impact-light"],
      "bus": "sfx",
      "volume": 0.55,
      "pitchVariation": 0.05,
      "cooldownMs": 60,
      "maxInstances": 4,
      "spatial": true,
      "refDistance": 8,
      "maxDistance": 55,
      "rolloff": 1.1
    }
  }
}
```

### Mix hiyerarşisi olayda değil bus'ta

Tablonun ikinci bloğu `buses` — §9'un öncelik sırasının tek yazıldığı yer:

```json
"buses": {
  "notifications": 1,
  "ui": 0.9,
  "voice": 0.9,
  "sfx": 0.8,
  "ambience": 0.22,
  "music": 0.18
}
```

Bu blok Faz 1'de, ilk dinlemede eksikliği anlaşıldığı için eklendi: arka plan
yatağı menü seslerini bastırıyordu. Yanlış çözüm her olayın `volume`'ünü tek tek
kısmaktı; doğrusu bu. Sebebi §59'un bus'lara verdiği görevin ta kendisi:

> Sürekli çalan bir yatakla anlık bir klik'i **elle** karşılaştırmak, hiyerarşiyi
> hiçbir yerde bir arada görülemeyen sayıların ortalaması hâline getirir.

`buses` bloğuyla bir olayın `volume`'ü artık "**kendi kanalı için** yüksek"
demektir — bir yazarın gerçekten yargılayabileceği tek şey budur. Kanalların
birbirine göre yeri ise tek tabloda durur.

Testler burada da **ilişkiyi** pinler, seviyeyi değil: `music ≤ ambience < sfx ≤
ui ≤ notifications`. Her sayı değişebilir, sıra değişemez.

### 58.1 Oyuncunun slider'ı bu tabloyu değiştirmez, çarpar

§62'nin ses seviyesi ayarları duraklat kartında dört slider olarak yaşıyor: Ana
ses, Müzik, Efektler, Ortam. Model:

```text
etkin bus gain = yetkili mix (events.json) × oyuncu çarpanı (0…1)
```

Değiştirmek değil **çarpmak** kasıtlı. Slider bir bus'ın kazancını doğrudan
yazsaydı, oyuncu farkında olmadan yukarıdaki öncelik sırasını düzleştirebilirdi;
ayrıca mix'in her yeniden ayarlanışı herkesin kayıtlı ayarını kaydırırdı.
Çarpımla `1` = "oyunun istediği gibi", `0` = sessiz — altındaki denge ne olursa
olsun.

Slider almayan üç bus var ve bu da bir karar: `voice` (içerik yok, §13'ün
yasakladığı "yarım sistem"), `ui` ve `notifications` (oyunun oyuncuya cevabı;
§62'nin "kritik bilgi yalnızca sesle verilmez" kuralı iki yönlü çalışır —
alarmlarını kısmış bir oyuncu tasarımın ulaşamadığı oyuncudur). Ana ses hepsini
kapsar, ki her şeyi susturmanın dürüst yolu odur.

### Alan adları neden `AudioPlayOptions` ile aynı

`volume`, `pitch`, `bus`, `spatial`, `refDistance`, `maxDistance`, `rolloff`,
`loop` — hepsi engine'in `AudioPlayOptions` arayüzünde **zaten** var ve spatial
panner'a birebir bağlanıyor. Yeni bir isim uydurmak (§10'un "yakın / orta / uzak"
kategorileri için ayrı bir enum gibi) tabloyu okunur yapmaz, sadece araya bir
çeviri katmanı koyar. Tablo runtime'ın dilinde yazılır; §10'un kategorileri
tablodaki `maxDistance` **değerleriyle** ifade edilir.

İki alan tabloya özgüdür, çünkü tek bir çalmanın değil **olayın** özelliğidir:

| Alan | Anlam |
|---|---|
| `clips` | Varyant listesi — manifest **sound asset id**'leri (dosya adı değil, §80) |
| `pitchVariation` | ±oran; her çalmada `pitch` bu aralıkta rastgelelenir (§12) |
| `cooldownMs` | Aynı olayın iki çalması arasındaki en kısa süre (§11) |
| `maxInstances` | Aynı olaydan aynı anda kaç örnek duyulabilir (§11, §61) |

### `clips` neden dosya adı değil manifest id'si

VFX tarafında yerleşmiş kural: *bir varlık asla keyfî bir yol veya URL
adlandıramaz*; id yalnızca proje o varlığı sevk ettiğinde çözülür. Ses için de
aynısı geçerli olmalı — aksi hâlde `events.json` üzerinden public kökün
herhangi bir dosyasına işaret edilebilir ve eksik bir dosya sessiz bir 404'e
dönüşür. Manifest id'si çözülemediğinde olay **çalınmaz ve raporlanır**.

### Amaç

- veri odaklı ayar
- tekrar kontrolü
- kolay denge
- merkezi mix
- kod içine dosya adı gömmemek

### Tablo `public/game-data/` altındadır — ve testler bunu bozmamalıdır

`events.json` bir **tuning** dosyasıdır, tıpkı `balance/units.json` gibi: mix
seviyeleri, cooldown'lar ve mesafeler kulakla ayarlanacaktır. Bu yüzden
`tools/engine-tests.ts` bu tabloda **sözleşmeyi** pinler, **değeri** değil:

- ✅ her olayın en az bir `clips` girdisi var
- ✅ her `clips` girdisi manifest'te `assetType: "sound"` olarak mevcut
- ✅ kodun adıyla çağırdığı her olay tabloda var (ve tersi: tabloda yetim olay yok)
- ✅ `maxInstances ≥ 1`, `cooldownMs ≥ 0`, `maxDistance > refDistance`
- ❌ "`combat.sword_swing` sesi 0.55'tir" — bu bir sonraki mix pasında kırmızıya döner

---

# 59. Audio bus yapısı — karar

v1.0 yedi bus önermişti. Engine'de beş vardı (`master`, `music`, `sfx`, `ui`,
`ambience`). Karar: **`voice` ve `notifications` eklendi; `Combat` ve `World`
eklenmedi.**

```text
master
├── music
├── ui
├── voice          ← eklendi
├── notifications  ← eklendi
├── sfx            (Combat + World burada)
└── ambience
```

Gerekçe basit ve §9'un ducking kuralından çıkıyor: bir bus ancak **başka bir
şeyden bağımsız kısılması gerekiyorsa** vardır.

- `voice` ve `notifications` ayrı, çünkü §9 tam olarak bunları ayrı kısmayı
  istiyor ("kritik notification sırasında müzik hafif düşer", "voice line
  sırasında yakın savaş SFX çok hafif düşer") ve §62 bunlara ayrı slider
  vaat ediyor.
- `combat` ve `world` ayrı **değil**, çünkü ikisini birbirine göre kısan tek bir
  kural yok. `sfx` altında kalmaları hiçbir şeyi kaybettirmiyor; ayrılmaları ise
  SoundCue şemasını, kaydedici allowlist'i ve editör açılır menüsünü kullanılmayan
  iki seçenekle şişirirdi. İhtiyaç doğduğunda eklemek tek satırlık bir iştir.

### Bus eklemenin dokunduğu yerler

Bir bus id'si eklemek üç dosyayı birden ilgilendirir; biri unutulursa kaydedici
sessizce alanı düşürür (CLAUDE.md'nin allowlist tuzağı):

1. `engine/audio/audioBus.ts` → `AUDIO_BUS_IDS`
2. `tools/saveValidator.ts` → `SOUND_CUE_BUS_IDS`
3. `src/editor/SoundCueEditor.ts` → bus seçicisi (listeden türetiliyorsa kendiliğinden gelir)

### Faydası

- kullanıcı ayarları
- mixing
- ducking
- debug
- future accessibility

İlk vertical slice’ta bütün kullanıcı slider’larının UI’da görünmesi zorunlu değildir; ancak altyapı bus seviyesinde kurulabilir.

---

# 60. Debug audio paneli — öneri

Geliştirme modunda faydalı olabilir:

```text
Audio Debug
- current music state
- active music track
- active SFX count
- last 10 audio events
- max concurrent sounds
- voice cooldown
- notification cooldown
- master/music/sfx gain
- listener camera position
```

Bu panel production UI değildir.

---

# 61. Performans bütçesi

Web platformu nedeniyle:

- aynı anda yüzlerce ses çalınmamalı
- gereksiz uzun WAV runtime kullanılmamalı
- savaş SFX için instance limit konulmalı
- müzik ve ambience streaming/loading stratejisi test edilmeli

Başlangıç hedefi:

```text
simultaneous important SFX: 16–24
music: 1
ambience: 1–3 layers
voice: 1–3
```

Kesin değerler browser testleriyle belirlenmelidir.

## 61.1 "Streaming stratejisi test edilmeli" — test edildi (22 Ağustos 2026)

Yukarıdaki dört maddenin sonuncusu uzun süre tek satır olarak durdu. Müzik 4
parçadan 20'ye çıkınca ölçüldü ve bir eşiğin geçildiği görüldü:

| | 4 parça | 20 parça |
|---|---|---|
| Disk | 24 MB | **118 MB** (tüm `public/assets`'in %31'i) |
| Açılmış hâli (RAM) | ~176 MiB | **~880 MiB** |

Sebep, müziğin tek atışlık bir SFX gibi işlenmesiydi: `decodeAudioData` dosyayı
ham örneklere açıyor ve önbellek yalnız `dispose()`'da temizleniyordu. İki
dakikalık stereo bir parçanın açılmış hâli
**120 s × 48 kHz × 2 kanal × 4 bayt ≈ 44 MiB**, ve sekme kapanana kadar orada
duruyor — çalmasa bile.

Çözüm standart ve uygulandı: **yataklar media element üzerinden stream ediliyor**
(`AudioPlayOptions.stream`, `events.json`'da olay başına açılıyor). Bellekte 44
MiB yerine küçük bir tampon kalıyor. İkinci kazanç ölçülmedi ama kulakla
doğrulandı: bir parça artık ilk çalışında 5.8 MB indirme + decode beklemiyor, ve
o bekleme tam da crossfade'in ortasına düşüyordu.

Kısa sesler decoded yolda kalır ve kalmalıdır — bir stream zamanlanmış bir
örneğe değil hazır olduğu ana başlar, ki bu bir kılıç darbesi için yanlış takas.
Sözleşme testi bunu tutuyor: `music`/`ambience` bus'ındaki yataklar stream eder,
başka hiçbir olay edemez.

---

# 62. Ses erişilebilirliği

İlk sürümde temel olarak:

- Music volume
- SFX volume
- Voice volume

düşünülebilir.

İleri aşamada:

- critical notifications volume
- mute voice
- high-contrast audio cues
- text equivalents for critical audio

## 62.0 Uygulandı — 20 Ağustos 2026 (Faz 7'nin ilk parçası)

Duraklat kartında dört slider var, kamera ayarlarının altında, sekiz dile
çevrilmiş durumda:

| Slider | Bus | Neden bu dördü |
|---|---|---|
| Ana ses | `master` | Her şeyin üstünde; slider'ı olmayan kanalları da bu kapatır |
| Müzik | `music` | Yatak + §5.11 stinger'ları |
| Efektler | `sfx` | Dünyanın kendi sesleri |
| Ortam | `ambience` | Ambiyans yatağı |

**Model: `etkin bus kazancı = yetkili mix (events.json) × oyuncu çarpanı`**
(§58.1). Değiştirme değil çarpma, ve fark ilk bakışta göründüğünden büyük:

- Slider `1`'de oyuncu oyunu **tasarlandığı gibi** duyar; `0` yetkili seviye ne
  olursa olsun sessizdir. Oyuncunun mutlak beklediği tek değer budur.
- Mix daha sonra yeniden ayarlandığında **kimsenin kayıtlı ayarı yerinden
  oynamaz** — çarpan korunur, altındaki sayı değişir.
- Bir slider §9'un öncelik sırasını **düzleştiremez**: her kanal kendi yetkili
  seviyesinden ölçeklenir, bir kanalın seviyesini diğerinin üstüne yazamaz.

**Slider almayan üç kanal ve sebebi:**

- `ui` ve `notifications` — bunlar oyunun oyuncuya *cevabı*. Kritik bilginin
  yalnız sesle verilmemesi kuralı iki yönlü işler: uyarılarını susturmuş bir
  oyuncu, tasarımın ulaşamadığı bir oyuncudur. Her şeyi kapatmanın dürüst yolu
  `master`'dır ve o zaten bunları da kapatır.
- ~~`voice` — tek bir replik kaydedilmedi. Var olmayan bir sistemin slider'ı,
  oyuncunun sürüklediği ve hiçbir şey olmayan bir kontroldür.~~ **Bu gerekçe
  22 Ağustos'ta geçersizleşti** (VO indi) ve slider 24 Ağustos'ta eklendi —
  §62.2.

Ayarlar `userSettingsStore`'daki `audio.busVolumes` altında, slot'lardan bağımsız
olarak saklanıyor. Yol boyunca kapanan boşluk buydu: RtsApp bu dosyayı grafik
tercihleri için okuyup yazıyor, ama `audio.busVolumes` bloğunu tamamen görmezden
geliyordu — yazılan ses ayarı bir sonraki açılışta okunmuyordu.

**Kabul:** görsel ve işitsel olarak kullanıcı tarafından onaylandı (20 Ağustos
2026).

### Kural

Kritik bilgi yalnızca sesle verilmemelidir.

Lojistik kesildi gibi olaylar:

```text
audio + notification card + visual state
```

birlikte kullanılmalıdır.

## 62.2 Voice slider'ı — 24 Ağustos 2026

§62.0 `voice` kanalına slider vermemeyi tek bir gerekçeye dayandırmıştı: proje
henüz tek replik kaydetmemişti, ve olmayan bir sistemin slider'ı oyuncunun
sürükleyip hiçbir şey olmadığını gördüğü bir kontroldür. Gerekçe iki gün sonra
geçersiz oldu — üç rol (guard, archer, worker) 57 klip ile indi — ama madde
listede kaldı, ve bir denetimde ancak kod ile diskin karşılaştırılmasıyla
görüldü. **Bir gerekçe, dayandığı olgu değiştiğinde kendiliğinden düşmüyor.**

Bugün beşinci satır eklendi. Gerekçenin tersine dönmesi kayda değer: VO
İngilizce kalıyor (§37) ve oyun sekiz dile lokalize (§62.1), yani **oyuncunun
kısmak isteyeceği en muhtemel kanal** yalnız `master` üzerinden ulaşılabilir
olandı. §62.1'in tablosu bunu zaten güvenli kılıyor — replikler karakter taşır,
bilgi taşımaz — o yüzden susturulması hiçbir oyun bilgisini kaybettirmiyor.

`ui` ve `notifications` slider almamaya devam ediyor, ve o gerekçe hâlâ ayakta:
onlar oyunun oyuncuya *cevabı*, ve kritik bilginin yalnız sesle verilmemesi
kuralı iki yönlü işler.

## 62.1 Lokalizasyon ile bağ

Bu kuralın bu projede ikinci ve daha sert bir gerekçesi var: **voice-over
İngilizce kalıyor** (§37), oyun ise lokalize edildi. Rusça oynayan bir oyuncu
Guard'ın "Under attack!" replikini anlamak zorunda bırakılamaz.

Bu yüzden ses ve lokalizasyon şu şekilde ayrışır:

| Kanal | Dil | Kural |
|---|---|---|
| VO replikleri (§38–§40) | Yalnızca İngilizce | **Karakter taşır, bilgi taşımaz.** Bir repliğin anlaşılmaması hiçbir oyun bilgisini kaybettirmemeli. |
| Notification kartları | Lokalize | Bilginin taşındığı yer burasıdır (`RtsNotificationCenter` + locale tabloları). |
| Görsel durum | Dilsiz | Kesik yol, kırmızı çerçeve, sayaç. |
| Stinger / alarm SFX (§24) | Dilsiz | Aciliyeti taşır, içeriği değil. |

Pratik sonuç: "Karakol saldırı altında" olayının **sesi** oyuncuyu haritaya
baktırır; **ne olduğunu** lokalize notification kartı söyler. Ses kanalına
lokalize edilmemiş bilgi koymak, oyunu İngilizce bilmeyen oyuncu için sessizce
zorlaştırır ve bunu hiçbir test yakalamaz.

VO'nun ileride lokalize edilmesi kapsam dışıdır (§2) — ama bu tabloya uyulduğu
sürece **gerekmez de**, ki bu tablonun asıl faydası budur.

---

# 63. Üretim kayıt şablonu

```text
Audio ID:
Runtime event:
Category:
Asset name:
Prompt version:
Prompt:
Generator:
Generation date:
Generated variants:
Selected source:
Edit notes:
Master format:
Runtime format:
Mono/Stereo:
Loop:
Duration:
Default gain:
Pitch variation:
Cooldown:
Max instances:
Spatial:
Attenuation:
In-game tested:
Approval status:
Revision notes:
```

---

# 64. Prompt sürümleme

```text
audio_style_core_v1.0
firefly_ui_v1.0
firefly_combat_v1.0
firefly_building_v1.0
firefly_logistics_v1.0
firefly_ambience_v1.0
gemini_music_core_v1.0
voice_direction_v1.0
```

Bir kategori için önemli bir düzeltme yapıldığında yalnız bireysel prompt değil kategori şablonu da güncellenmelidir.

---

# 65. Genel Firefly negatif yönlendirme sözlüğü

Gerektiğinde:

```text
no music
no vocals
no dialogue
no cinematic trailer boom
no modern machinery
no gunshot unless explicitly required
no sci-fi
no electronic beep
no neon fantasy sound
no excessive reverb
no huge sub-bass drop
no stadium ambience
no crowd cheering
no comedy
no cartoon sound
no background ambience
no long tail
```

Hepsi her prompta kopyalanmamalıdır.

---

# 66. Müzik negatif yönlendirme sözlüğü

```text
no vocals
no choir
no modern electronic drums
no EDM
no trap rhythm
no cinematic trailer drop
no superhero brass
no massive taiko
no constant battle intensity
no horror ambience
no cheerful tavern music
no comedy
no obvious imitation of existing game music
```

---

# 67. Üretim kalite kapıları

## Gate A — Audio Bible

- [ ] Ses vizyonu onaylandı
- [ ] Ana kategori sistemi onaylandı
- [ ] Naming onaylandı
- [ ] Firefly prompt çekirdeği onaylandı
- [ ] Müzik yönü onaylandı
- [ ] Voice yaklaşımı onaylandı

## Gate B — Package 1 ✅ (22 Ağustos 2026)

Yedi maddenin tamamı, §46'nın test senaryosu birçok kez oynandıktan sonra
kullanıcı tarafından onaylandı. Tek revizyon maddesi ses varlıklarında değil
geçiş zamanlamasındaydı — §35.1.

- [x] UI dili onaylandı
- [x] Combat yoğunluğu onaylandı
- [x] Cannon sesi onaylandı
- [x] Logistics uyarısı onaylandı — ayrı bir savaş alarmı olmaması da onaylandı
- [x] Ambience onaylandı
- [x] Settlement music onaylandı
- [x] Guard voice onaylandı

## Gate C — Core Audio

- [ ] Bütün Tier 1 sesler tamam
- [ ] Tier 2 ana sesler tamam
- [ ] Tüm birim savaş seti tamam
- [ ] Music state sistemi çalışıyor

## Gate D — Release Audio

- [ ] Full-match mix testi
- [ ] Browser test
- [ ] Repeat fatigue testi
- [ ] Performance testi
- [ ] No missing event
- [ ] Final mastering / runtime gain pass

---

# 68. Full-match audio QA

20–30 dakikalık gerçek maçta kontrol edilmelidir:

- İlk 5 dakikada UI yorucu mu?
- Worker sesleri fazla mı?
- İnşaat sesleri aynı geliyor mu?
- Savaş başladığında miks çöküyor mu?
- Top her ateşte diğer her şeyi bastırıyor mu?
- Okçular duyuluyor mu?
- Guard voice gereğinden sık mı?
- Lojistik kesildi uyarısı kaçırılıyor mu?
- Center attack alarmı yeterince farklı mı?
- Settlement → Expansion → Tension → Battle geçişleri doğal mı?
- Battle bittikten sonra müzik sakinleşiyor mu?
- Ambiyans savaş sonrasında dünyayı tekrar hissettiriyor mu?
- 20 dakika sonunda müzik tekrar hissi veriyor mu?

---

# 69. İlk uygulanacak görev listesi

## Ön hazırlık — Faz 0 (tamamlandı, 2026-08-20)

- [x] Runtime audio event sistemini gözden geçir → §79
- [x] Bus yapısını belirle → §59 (`voice` + `notifications` eklendi)
- [x] Audio event şemasını kesinleştir → §58, `engine/audio/audioEventTable.ts`
- [x] Audio asset loader kurallarını belirle → manifest `sound` id'leri, §58
- [x] SoundCue / olay tablosu iş bölümü → §80
- [x] `RtsApp`'e audio mount (listener pozu, autoplay kilidi, notify + notification kancaları)
- [x] Audio klasör yapısını oluştur (§7) — `public/assets/audio/sfx/{ui,notifications,buildings}/` açıldı
- [x] Master/runtime formatını kesinleştir (§8) — `.ogg`, tarayıcıda çalıyor

## Package 1 Firefly

*Kutular 20 Ağustos 2026'da gerçek duruma göre düzeltildi; §81.1 ile aynı gerçeği
sayar.*

- [x] UI click — `sfx-ui-click-01`
- [x] UI error — `sfx-ui-error-01`
- [x] Building place — `sfx-building-place-01`
- [x] Building complete — `sfx-building-complete-01`
- [x] UI confirm — demo setinde `sfx-ui-toggle-01` / `sfx-ui-back-01` olarak geldi
      (seçim ve geri alma); ayrı bir "confirm" üretilmedi, ihtiyaç da görünmedi
- [x] Cannon fire — `sfx-artillery-fire-01…05`
- [x] Cannon stone impact — `sfx-structure-impact-stone-01…04`
- [x] Sword swing — `sfx-combat-sword-swing-01…04`
- [x] Sword hit — `sfx-combat-body-impact-01…04`
- [x] Bow release — `sfx-combat-bow-release-01…04`
- [x] Arrow impact — ayrı üretilmedi: tabloda ayrı bir olay yok, isabet
      `combat.body_impact`'e düşüyor (§81.2'nin "olay başına üret" kuralı)
- [x] Construction hammer — olay açıldı: `building.build_loop`
      (`sfx-building-build-loop-01`). Tek tek darbe değil, şantiyede çalan
      konumlu bir döngü; gerekçesi ve tek-döngü kuralı `RTS_AUDIO`'nun kendi
      notunda. §17'nin `SFX-BLD-005` (construction wood movement) maddesi hâlâ
      açık ve bu döngüye ikinci bir katman olarak eklenebilir.
- [x] Frontier ambience — `amb-world-frontier-day-01` (170 s tek loop)
- [x] Logistics disconnected / restored — **kendi sesleri yok ve olmayacak.**
      Bildirim tier'ı taşıyor: kesinti `notify.alert`, dönüş `notify.info`
      (§24'ün üç seviyesi). §77'nin stil-kilidi maddesi bu kanalla karşılanıyor.

## Package 1 Gemini

- [x] Settlement music — dört parça, `mus-gameplay-settlement-01…04`, her biri
      120.00 s. §71'in kuralı karşılandı: kabul edildi (Gate B), yani tension ve
      battle parçalarının önü artık açık
- [x] Üç stinger — `stg-age-up-02`, `stg-victory-01`, `stg-defeat-01`
      (`stg-age-up-01` shipped ama artık bir olay onu çalmıyor)

## Package 1 Voice

- [x] Guard selection — `vo-guard-selection-01`
- [x] Guard move — `vo-guard-move-01…04`
- [x] Guard attack — `vo-guard-attack-01…04`

## Entegrasyon

Bu bloğun tamamı Faz 0/1'de yapıldı; kalan tek madde Faz 4'ün işi.

- [x] Audio event mapping — `rtsAudioEvents.ts` + `events.json`, testle bağlı
- [x] Random variant — director tetik başına klip seçiyor
- [x] Cooldown
- [x] Max instances
- [x] Spatial attenuation — mesafe kesmesi ve sis kapısı dahil
- [x] Music crossfade — `engine/audio/musicDirector.ts`, shuffle bag +
      equal-power geçiş. Zamanlaması hâlâ ayarlanacak: §35.1
- [x] Package 1 test map — §46 senaryosu birçok kez oynandı; Gate B geçildi

---

# 70. Önerilen ilk Firefly üretim sırası

Sırayla:

```text
1. UI click
2. UI confirm
3. UI error
4. Building placement
5. Building complete
6. Sword hit
7. Bow release
8. Cannon fire
9. Cannon stone impact
10. Logistics disconnected
11. Logistics restored
12. Frontier ambience
```

Sebep:

Bu sıra oyunun ses materyal dilini en az üretimle test eder:

- ahşap
- metal
- darbe
- ağır patlama
- notification
- ambience

---

# 71. Önerilen ilk müzik üretim sırası

```text
1. Settlement
2. Main Menu
3. Expansion
4. Tension
5. Battle
6. Victory
7. Defeat
8. Age Up
```

Settlement kabul edilmeden diğer parçaların tamamı üretilmemelidir.

Settlement parçası:

- enstrüman
- mix
- reverb
- ton
- dönem hissi

için ana stil referansı olacaktır.

---

# 72. Önerilen ilk voice üretim sırası

```text
1. Guard
2. Worker
3. Archer
```

Guard en iyi test karakteridir.

Neden:

- hem selection
- hem move
- hem attack
- hem hold

durumlarını taşır.

Guard voice tonu onaylandıktan sonra Worker ve Archer aynı kayıt standardıyla hazırlanır.

---

# 73. Audio asset kabul kriterleri

Her final ses:

- [ ] Oyun olayını doğru anlatıyor
- [ ] Başka olayla karışmıyor
- [ ] Oyun içinde okunuyor
- [ ] Fazla yüksek değil
- [ ] Fazla uzun değil
- [ ] Gereksiz reverb yok
- [ ] Modern veya sci-fi çağrışım yapmıyor
- [ ] Aynı kategoriyle stil uyumlu
- [ ] Varyantları birbirine çok benzemiyor
- [ ] Runtime formatı doğru
- [ ] Dosya adı doğru
- [ ] Oyun içinde en az bir kez test edildi

---

# 74. Müzik kabul kriterleri

- [ ] 5–10 dakika tekrar dinlemede yorucu değil
- [ ] Oyun efektlerini kapatmıyor
- [ ] Orta çağ frontier hissi veriyor
- [ ] Fazla fantastik değil
- [ ] Fazla sinematik değil
- [ ] Belirgin melodik loop hissi düşük
- [ ] Transition için uygun
- [ ] Savaş şiddeti oyunun ölçeğine uygun
- [ ] Stereo image fazla geniş değil
- [ ] Mastering agresif değil

---

# 75. Voice kabul kriterleri

- [ ] Kısa
- [ ] Anlaşılır İngilizce
- [ ] Rolü doğru taşıyor
- [ ] Modern askeri dil yok
- [ ] Aşırı kahramansı değil
- [ ] Spam testinde rahatsız etmiyor
- [ ] Aynı birim replikleri aynı karaktere ait gibi
- [ ] Worker, Guard ve Archer sesleri birbirinden ayrılıyor

---

# 76. Son üretim stratejisi

Ses üretimi şu sırayla ilerlemelidir:

```text
Audio Bible
→ Audio inventory
→ Package 1
→ In-game test
→ Style lock
→ UI + Notifications
→ Buildings + Logistics
→ Units + Combat
→ Voice
→ Music states
→ Ambience layers
→ Mix / performance polish
→ Full-match QA
```

---

# 77. Ana karar

Bu proje için ses tarafında **önce bütün assetleri üretmek**, sonra entegrasyon yapmak doğru yaklaşım değildir.

En güvenli yöntem:

> **Temsil edici küçük bir ses paketi üret → gerçek oyunda test et → ses materyal dilini ve mix seviyelerini kilitle → aynı aileyi genişlet.**

Özellikle ilk stil kilidi şu yedi alanda yapılmalıdır:

1. UI click
2. Building complete
3. Sword hit
4. Bow release
5. Cannon fire
6. Logistics disconnected
7. Settlement music

Bu yedi öğe onaylandığında projenin ses kimliğinin büyük bölümü tanımlanmış olur.

## 77.1 Bir düzeltme: hat sesten önce gelir

Yukarıdaki karar doğru ama uygulanabilir olması için bir ön koşulu var. "Gerçek
oyunda test et" adımı, oyunda çalar hiçbir şey yokken yapılamaz — ve §79'un
gösterdiği gibi RTS maçında hiçbir ses yoktu.

Bu yüzden §76'nın zinciri başında bir halka daha taşır:

```text
Audio Bible
→ Audio inventory
→ Runtime hattı (Faz 0–1, placeholder seslerle)   ← eklendi
→ Package 1
→ In-game test
→ Style lock
→ ...
```

Placeholder aşaması ses üretimi **değildir** ve ses kimliğine dair hiçbir karar
vermez. Yalnızca şunları Firefly'a tek prompt gitmeden doğrular: mix hiyerarşisi
(§9), tekrar kontrolü (§11), spatial attenuation (§10), instance bütçesi (§61)
ve olay eşlemesi (§58). Faz 2'de üretilen ilk gerçek klip, hazır bir hattın
üstüne düşer.

---

# 79. Kod envanteri — 20 Ağustos 2026

Bu bölüm planın yazıldığı gün yoktu ve v1.1'de eklendi. Sebebi: plan boyunca
"mevcut runtime audio mimarisi" defalarca anılıyor ama hiçbir yerde ne olduğu
yazmıyor. Envanter çıkarılınca boşluğun beklenen yerde olmadığı görüldü.

## 79.1 Engine'de hazır olan

| Ne | Nerede | Plan karşılığı |
|---|---|---|
| Web Audio backend, buffer cache, one-shot + handle'lı çalma, fade | `engine/audio/audioSubsystem.ts` | §8.2, §9 |
| Spatial `PannerNode` (HRTF, inverse distance, `refDistance`/`maxDistance`/`rolloff`) | aynı dosya | §10 |
| `setListenerPose()` — kamera dinleyici pozu | aynı dosya | §10.1 |
| `resumeContext()` — tarayıcı autoplay kilidi | aynı dosya | — |
| Bus grafiği + mix snapshot + hazır menü duck'ı | `engine/audio/audioBus.ts` | §59, §9 |
| SoundCue grafiği: random / modulator / loop / delay / mixer | `engine/audio/soundCueTypes.ts`, `soundCueEvaluator.ts` | §4.5, §12 |
| SoundCue **editörü** (görsel graf, 650+ satır) | `src/editor/SoundCueEditor.ts` | §4.5 |
| `assetType: "sound"` / `"soundCue"` manifest desteği | `engine/assets/manifest.ts` | §7 |
| `/__save-soundcue` + kaydedici allowlist | `tools/saveValidator.ts` | — |
| 20 adet manifest'li placeholder klip | `public/assets/starter-content/Sounds/` | Faz 1 |

Yani §12'nin pitch/gain varyasyonu ve §4.5'in varyant sistemi **authoring
seviyesinde zaten çözülmüş**; üretilecek varyantlar için bir editör hazır
bekliyor.

## 79.2 Boşluk: RTS maçında ses yok

`AudioSubsystem` yalnızca Forge sahne yolunda (`SceneApp`, `RuntimeSceneApp`)
mount ediliyordu. Oyunun kendisi olan `RtsApp` ayrı bir render yoludur ve
ortak altyapıyı kendiliğinden almaz — bu ayrışma daha önce ortam
singleton'larında (sis, skylight) yaşandı ve aynısı ses için de geçerliydi:
`RtsApp.ts`'in 7241 satırında tek bir audio referansı yoktu.

Bu, planın gerçek boşluğunun **ses varlıkları değil entegrasyon hattı** olduğu
anlamına gelir. Faz 0 tam olarak bunu kapatır.

## 79.3 Zaten bizi bekleyen kancalar

Bunlar yeniden yazılmamalıdır; §58'in olay tablosu bunların **üstüne** oturur.

**1. Animasyon notify akışı** — `src/game/rts/content/rtsNotifyEffects.ts`

`RTS_NOTIFY_AUDIO_ONLY` sabiti şu isimleri taşıyor: `footstep`, `chop-impact`,
`dig-impact`, `sword-swing`, `arrow-release`. Bunlar birim kliplerinde authored,
`*.skeleton.json` sidecar'larına yazılmış, engine testinde pinlenmiş ve
kaynak dosyanın kendi yorumunda **açıkça bu plana** devredilmiş:

> "A name with no entry here is not an error and not a gap: it is a marker the
> asset authors for a consumer that does not exist yet. The audio plan is the
> one this is waiting for."

Savaş SFX'inin (§23) büyük kısmı buradan akar ve `RtsApp.playUnitNotify` tek
çağrı noktasıdır.

**2. Notification merkezi** — `src/game/rts/ui/rtsNotifications.ts`

`RtsNotificationCenter` zaten dedup, cooldown, severity ve "kaç kez raise
edildi" sayımını yapıyor. §11'in notification cooldown tablosu pratikte
**kurulu**: ses yalnızca `post()` sonucu `"posted"` olduğunda çalmalı;
`"refreshed"` (koşul hâlâ sürüyor) ve `"suppressed"` (cooldown yuttu) sessiz
kalmalı. Bu, §11'in "aynı uyarı spam olmasın" şartını sıfır yeni kodla verir.

**3. VFX bütçe deseni** — `RtsNotifyEffectBudget`

Mesafe kesmesi + isim başına global rate cap + paylaşılan instance bütçesi.
§61'in ses bütçesi için birebir şablon; `AudioEventDirector` bilinçli olarak
aynı biçimde yazıldı (istek → bağlayıcı veya null, çalmayı çağıran yapar).

## 79.4 Faz 4 için tanımlanması gereken

Müzik durum makinesinin (§28, §35) bir **sinyal kaynağı** yok.
`src/game/rts/ui/rtsAttackWatch.ts` Tension/Battle için en yakın aday, ancak
kendi yorumunda "combat'ın damage-event bus'ı yok, bu yüzden sağlık örnekleniyor"
diyor. §35'in "battle trigger" tanımı bu sinyale bağlanmalı; Faz 4'e girmeden
önce yazılması, Faz 4 içinde keşfedilmesinden ucuzdur.

---

# 80. SoundCue ile olay tablosu arasındaki iş bölümü

Projede iki ayrı mekanizma var ve ikisi de "aynı sesin varyantını seç, pitch'ini
oynat" yapabiliyor. Hangisinin ne zaman kullanılacağı yazılmazsa ikisi de
yarım kullanılır.

| | **SoundCue** (`*.soundcue.json`) | **Olay tablosu** (`events.json`) |
|---|---|---|
| Sorusu | "Bu ses **neye benziyor**?" | "Bu ses **ne zaman ve kaç kere** duyulur?" |
| Sahibi | Ses tasarımcısı, görsel editörde | Tasarım/denge, JSON'da |
| Kapsamı | Tek bir sesin iç yapısı | Oyunun tüm ses bütçesi |
| Yapar | Varyant seçimi, katmanlama, gecikme, modülasyon, loop | Cooldown, instance limiti, mesafe kesmesi, bus yönlendirme, mix seviyesi |
| Yapmaz | Tekrar kontrolü, bütçe — bir cue kendini kaç kez çaldığını bilmez | Katmanlama — tablo tek bir klip çalar |

### Kural

> Bir sesin **içi** SoundCue'nun, **sıklığı** olay tablosunundur.

Pratikte: basit bir olay (UI click, üç varyant) doğrudan tabloda `clips` listesi
olarak yaşar — bunun için grafik açmak israftır. Katmanlı bir olay (top ateşi =
namlu patlaması + gövde gümbürtüsü + gecikmeli yankı) bir SoundCue olur ve tablo
o cue'yu tek bir id olarak adlandırır.

Tablonun `clips` alanı bu yüzden ileride hem `sound` hem `soundCue` id'si kabul
edecek şekilde genişletilebilir; Faz 0 yalnızca `sound` çözer, çünkü katmanlı
tek bir ses henüz üretilmedi.

## 80.1 Editörde iki ses tablosu, tek dosya

`events.json` iki farklı şey taşıyor ve ikisinin **satırı** aynı değil:

| Tablo | Bölüm | Satırı |
|---|---|---|
| **Ses Olayları** | `events` | Olay id'si — otuz küsur satır, §5'in 11 kanal başlığı altında |
| **Ses — Müzik Geçişleri** | `music` | Adlandırılmış ayar — birer tane, tekrar etmez |

Ayrı tablo olmasının sebebi budur. `crossfadeSeconds` bir sesin özelliği değil,
**iki çalma arasındaki dikişin** özelliği; asılacağı bir olay satırı yok, ve
`section: "events"` ile açılan form onu göremiyordu. §35.1'in tuning yolu tam
olarak bu yüzden "dosyayı elle aç" demekti.

Formda dört giriş var: geçiş süresi, parçalar arası boşluk, süresi bilinmeyen
klip için yedek tutma, ve durum makinesinin dört eşiği (`states`). Sınırlar
runtime'ın kendi ayrıştırıcılarından birebir kopyalandı — form ikinci bir görüş
bildirmiyor, yalnızca reddedilecek değere yanlışlıkla ulaşmayı zorlaştırıyor.

**Kaydetme iki yarıyı da doğruluyor.** Dosyanın `music.states` bloğu motorun
değil oyunun (§35.2: "kaç düşman görünüyor" bu oyuna ait bir soru) ve motor
normalizer'ı onu dokunmadan geçiriyor. İki tablo da tüm dosyayı yazdığı için
ikisinin de doğrulaması aynı bileşik doğrulama: crossfade ayarlayan biri, maçın
açılışta reddedeceği bir eşiği kaydeden kişi olamaz.

Yol boyunca bir hata da düzeldi: skaler girdisi olan bir tabloda **"Varsayılana
dön"** düğmesi değeri boş nesneye çeviriyordu (`{...structuredClone(18)}` → `{}`).
Olay tablosunda hiç görünmemişti çünkü orada her girdi bir nesne; müzik
tablosunun dört girdisinin üçü çıplak sayı. `roads.json` de aynı şekilde
etkileniyordu.

---

# 81. Faz 2 çalışma sayfası — placeholder üzerinde duran kanallar

§0 "yer tutucu sütununu boşalt" diyor; bu bölüm o sütunu **olay olay** sayar ve
her satıra üretilecek dosyanın adını yazar. Amaç, Firefly'a oturulduğunda "ne
üreteceğim" sorusunun sorulmaması.

**Bu sayfa 22 Ağustos 2026'da kapandı: sütun boşaldı.** Aşağıdaki tablo artık
kalan işin listesi değil, **üretim kaydıdır** — hangi olayın hangi dosyayla
karşılandığının kaydı. Bugünkü `events.json`'da **29 olay var ve hiçbiri
`starter-snd-*` çalmıyor**; `npm run audio:manifest` 69 dosya / 69 kayıt
raporluyor. Faz 2'nin tanımı buydu.

Sayım ilk olarak 20 Ağustos 2026'da yapılmıştı: 26 olayın 16'sı Forge şablon
içeriği çalıyordu.

## 81.1 Sayım — kapandı

| # | Olay | Şu an çalan | Üretilecek dosya | Varyant | Prompt kaynağı |
|---|---|---|---|---:|---|
| 1 | `unit.footstep` | `starter-snd-footstep-stone` | `sfx/units/sfx_unit_footstep_light_NN.ogg` | 4 | §19 `SFX-WRK-001` |
| 2 | `unit.chop_impact` | `starter-snd-impact-light` | `sfx/units/sfx_unit_axe_chop_NN.ogg` | 3 | §19 `SFX-WRK-003` |
| 3 | ~~`unit.dig_impact`~~ | — | ~~`sfx/units/sfx_unit_pickaxe_stone_NN.ogg`~~ | 0 | **iptal — aşağıdaki nota bakın** |
| 4 | `combat.sword_swing` | `starter-snd-light-01/02` | `sfx/combat/sfx_combat_sword_swing_NN.ogg` | 3 | §20 `SFX-GRD-003` |
| 5 | `combat.arrow_release` | `starter-snd-ui-click` | `sfx/combat/sfx_combat_bow_release_NN.ogg` | 3 | §21 `SFX-ARC-003` |
| 6 | `combat.body_impact` | `starter-snd-impact-light` | `sfx/combat/sfx_combat_body_impact_NN.ogg` | 4 | §20 `SFX-GRD-004/005` |
| 7 | `siege.cannon_fire` | `starter-snd-explosion-02` | `sfx/combat/sfx_artillery_fire_NN.ogg` | 3 | §22.1 (prompt hazır) |
| 8 | `siege.wreck_blast` | `starter-snd-explosion-01/02` | `sfx/combat/sfx_artillery_destroyed_NN.ogg` | 3 | §22 `SFX-ART-009` |
| 9 | `structure.impact` | `starter-snd-impact-light` | `sfx/combat/sfx_structure_impact_stone_NN.ogg` | 4 | §22.2 (prompt hazır) |
| 10 | `structure.collapse` | `starter-snd-collapse-01/02` | `sfx/combat/sfx_structure_collapse_NN.ogg` | 3 | §23 `SFX-CMB-009/010` |
| 11 | `notify.alert` | `starter-snd-door-open` | `sfx/notifications/sfx_notify_alert_01.ogg` | 1 | §24 (Alarm: düşük ve geniş) |
| 12 | `world.ambience` | `starter-snd-birds-01` | `ambience/amb_world_frontier_day_01.ogg` | 1 loop | §25 (içerik listesi hazır) |
| 13 | `music.settlement` | `starter-snd-music-01` | `music/gameplay/mus_gameplay_settlement_01.ogg` | 1 loop | §31 (prompt hazır) |
| 14 | `stinger.age_up` | `starter-snd-fire-sparks-01` | `stingers/stg_age_up_01.ogg` | 1 | §71 (8. sıra) |
| 15 | `stinger.victory` | `starter-snd-smoke-01` | `stingers/stg_victory_01.ogg` | 1 | §71 (6. sıra) |
| 16 | `stinger.defeat` | `starter-snd-steam-01` | `stingers/stg_defeat_01.ogg` | 1 | §71 (7. sıra) |

**3. sıra neden iptal edildi** (2026-08-21, kullanıcının kararı). `unit.dig_impact`
kazma-taşa sesiydi ve taş ocağı ile altın madeninden beklenmişti. Tetikleyicisi
ise Worker'ın `dig-impact` notify'ıydı ve o notify tek bir klipte authored'dı:
`Farming_dig_and_plant_seeds`. Yani sesin çalabildiği tek yer **tarlaydı** —
tohumlama ve hasat animasyonlarının yanında, kazma sesi. Ocak ve maden ise hiç
ulaşmıyordu: `mining` aktivitesi kendi klibini iddia etmez, paylaşılan
`Fixing_Kneeling` diz çökmesine biner ve o klip hiçbir temas işaretlemez.

Taşınmadı, silindi. Worker rig'inde 51 klip var ve hiçbiri kazma sallamıyor;
sesi doğru binaya taşımak için önce animasyon lazım.

**Klipler de gitti (22 Ağustos'ta fark edildi).** Bu paragraf bir süre
"`sfx_unit_pickaxe_stone_01–04.ogg` diskte duruyor ve manifest'te kayıtlı" dedi;
durum bu değil — dört dosya da silinmiş ve manifest'ten düşmüş
(`audio:manifest` 69 dosya / 69 kayıt raporluyor, karşılıksız kayıt yok). Bir
mining/pickaxe animasyonu geldiği gün olay geri açılabilir ama klipler **yeniden
üretilecek**. Bugün aynı raporda "shipped but no event plays it yet" diyen tek
varlık `stg-age-up-01` — çağ atlama stinger'ı `-02`'ye geçtiğinde geride kaldı.

**Placeholder seçerken bir kural** — kulakla bulundu, ucuz değil: *bir yer tutucu,
o klibi zaten sahiplenen bir kanaldan ödünç alınmaz.* Alarm bildirimi bir süre
çöküş sample'ı çaldı; sonuç, bir şey ters gittiğinde — maçın ilk poll'unda
lojistik henüz bağlanmamışken dahi — oyunun "bina yıkılıyor" demesiydi, üstelik
haritada gösterilecek bir yer olmadan. Yer tutucu yanlış ses olabilir; **başka
bir olayın doğru sesi** olamaz. Çöküş klipleri artık yalnız `structure.collapse`'ın.

Yol: hepsi `public/assets/audio/` altında, klasörler §7'den, adlandırma §6'dan.
Manifest id'si dosya adının tire'lisidir — `sfx_artillery_fire_01.ogg` →
`sfx-artillery-fire-01` — mevcut dokuz varlık zaten bu kuralda.

## 81.2 Sayarken çıkan bir şey: tablo, envanterlerden daha kaba

§19–§23 rolleri ayırıyor — Worker'ın toprak adımı, Guard'ın ağır adımı,
Archer'ın hafif adımı; kılıcın zırha vuruşu ile ete vuruşu; ahşap yapı ile taş
yapı. Çalışan koddaki olay tablosu bunları ayırmıyor: **herkes** için tek bir
`unit.footstep`, her darbe için tek bir `combat.body_impact`, her yapı için tek
bir `structure.impact` var. Kanca animasyon notify'ından geliyor ve notify rolü
taşımıyor.

Bunun üretim için pratik sonucu şudur ve önce yazılmazsa boşa üretim olur:

> Faz 2'de **rol başına değil, olay başına** üretilir. Tabloda tek satır olan
> şeye üç set ses üretmek, ikisinin hiç çalmayacağı bir kütüphane demektir.

Ayrımın kendisi kötü bir fikir değil — Guard'ın adımı Archer'ınkinden ağır
olmalı, bu doğru. Ama bu bir **kod kararıdır** (notify'ın rolü taşıması ya da
olay id'sinin role göre seçilmesi), ses üretimi kararı değil, ve sırası Faz 2
değil. Faz 5'te birim/savaş paketi açılırken alınır; o gün üretilecek olan da
"aynı sesin rol varyantı" olur, sıfırdan bir set değil.

> **Karar 22 Ağustos 2026'da verildi ve rol çıkmadı: §82.4.** Eksen `armorClass`
> (light/heavy) ve yapılarda malzeme (wood/stone) — ikisi de zaten authored, ve
> ikisi de kulağın duyduğu eksen. Yukarıdaki "aynı sesin rol varyantı" ifadesi
> bu yüzden düzeltilmiş sayılır: varyant role göre değil, **zırha** göre.

## 81.3 Üretim sırası

§70'in on iki maddesi hâlâ doğru sıra; yukarıdaki sayımla kesiştirilince Faz 2
şöyle ilerler:

1. **Top ateşi + yapıya top impact** (7, 9) — promptları §22.1/§22.2'de hazır,
   ve oyunun en ağır iki sesi. Ağırlık dili burada kilitlenir.
2. **Kılıç savurma + darbe + yay** (4, 5, 6) — savaşın okunabilirliği.
3. **Ambiyans** (12) — tek seamless loop; §56'nın loop checklist'i geçilmeden
   kabul edilmez.
4. **Settlement müziği** (13) — §71'in kuralı: bu kabul edilmeden diğer parçalar
   üretilmez, çünkü stil referansı odur.
5. **Üç stinger** (14–16) — Settlement'ın enstrüman setinden, onun ardından.
6. **Birim iş sesleri + alarm + çöküş** (1, 2, 3, 8, 10, 11) — geri kalanı.

## 81.4 Bir varlık geldiğinde ne değişir

Üç adım, ve üçü de kod değil:

1. Dosya `public/assets/audio/<§7 klasörü>/` altına konur (küçük harf, §6).
2. `npm run audio:manifest` çalıştırılır — manifest'i klasörden üretir.
3. Editörde **Veri → Ses Olayları** açılır, olayın klibi dropdown'dan seçilir.
   (Ya da `events.json` elle düzenlenir; tablo aynı dosyayı yazar.)

`tsc` çalıştırmak gerekmez; `RtsApp.ts` açılmaz. Faz 0/1'in tüm amacı buydu.

**2. adımda neden ayrı bir tablo yok.** Manifest kaydı klip başına ~30 satır ve
bunun yalnızca dördü değişiyor; biri de (`bytes`) insanın bilemeyeceği bir sayı.
Yani bu bir kopyalama işi ve betiğe ait. Akla gelen ilk çözüm "aralara bir klip
tablosu koyalım" oluyor; koymamanın sebebi şu: **§6 ve §7 zaten o tablodur.**
Dosya adı id'yi taşıyor (`sfx_artillery_fire_01.ogg` → `sfx-artillery-fire-01`),
klasör kategoriyi taşıyor, manifest sonucu taşıyor. Araya el yazımı bir tablo
girseydi, senkron tutulacak üçüncü bir yer olurdu ve davet ettiği hata sessiz
cinsten: adı değişmiş bir dosyayı gösteren satır, ya da hiçbir satırın anmadığı
bir dosya.

Betiğin **türetmediği** tek şey insanın yazdığı alanlar: mevcut bir kaydın
`name` ve `license` alanları korunur ("UI Click" ve "Notification Info"
editöryel; bir başlık büyütücü onları "Ui Click" ve "Notify Info" yapardı).
Geri kalan alanlar her koşuda yeniden yazılır, yani betiği iki kez çalıştırmak
hiçbir şeyi değiştirmez — mevcut dokuz kayıt üzerinde birebir aynı dosyayı
üretmesi de bunun kanıtı.

Aynı koşu dört şeyi de kolluyor, çünkü hepsi bu adımda olur ve hiçbiri kendini
belli etmez:

- **Büyük harfli dosya adı** — §6'nın en sert kuralı. Windows harf durumuna
  duyarsız, git index'i duyarlı, dağıtım hedefi Linux; bu depo daha önce tam
  bu yüzden Linux checkout'unda 404 veren bir varlık sevk etti.
- **İki dosyanın aynı id'ye düşmesi.**
- **Dosyası silinmiş manifest kaydı** — çalma anında 404 verir, ve kulakta
  "olay hiç bağlanmamış" gibi duyulur.
- **`events.json`'ın adlandırdığı ama hiçbir varlığın karşılamadığı klip.**

Üretilmiş ama henüz hiçbir olayın çalmadığı klip *hata değil* — teslimatın
normal sırası budur — sadece not olarak yazılır. `--check` bayrağı yazmadan
kontrol eder, ileride bir CI kapısına bağlanmak isterse diye.

**Editör tablosu (Veri → Ses Olayları).** Olay başına bir satır: klip seçici,
bus, seviye, cooldown, aynı anda en fazla, mesafe alanları. Yeni bir yazma yolu
açmadı — `/__save-gamedata` zaten `game-data/**.json` kapsıyor ve kaydetme,
runtime'ın kendi `normalizeAudioEventTable`'ı ile doğrulanıyor, yani formun
kaydedebildiği hiçbir tablo maçta yüklenmeyi reddedemez.

`clips` alanının seçici olması işin asıl sebebi: alan manifest ses id'si
istiyor, ve elle yazılan yanlış bir id hiçbir şeye çözülüp **sessizlik** çalıyor
— hiç bağlanmamış bir olaydan ayırt edilemez. Dropdown, projenin gerçekten sevk
ettiği seslerden seçtiriyor. Content Drawer'dan import edilen ses manifest'e
kaydolduğu için listede kendiliğinden çıkar.

Doğrulama: `npm run test:engine -- --filter "RTS audio"`. Üç kontrol bu adımları
kolluyor — tablonun adlandırdığı her klibin gerçekten manifest'te bir `sound`
varlığı olması, her kanalın kendi bus'ına gitmesi, ve bir olayın **üretilmiş ile
placeholder klibi karıştırmaması**. Sonuncusu tam da bu geçiş dönemi için var:
tablo klibi tetikleme başına rastgele seçtiği için yarı-değiştirilmiş bir varyant
seti üç kere gerçek kılıcı, dördüncüde stok gümbürtüyü çalar — ki bu kulakta
"üretim yarım" değil "mix bozuk" diye okunur. Sayımın kendisi teste bağlanmadı:
o sayı Faz 2 ilerledikçe sıfıra iner, ve onu pinleyen bir test her teslimatta
kırmızıya düşerdi.

---

# 78. Kaynak bağlam notu

Bu plan hazırlanırken oyunun güncel proje bağlamındaki şu kararlar esas alınmıştır:

- oyun küçük ölçekli tek oyunculu bir RTS’dir;
- güncel kadro Worker, Guard, Archer ve Artillery’dir;
- kuşatma birimi güncel tasarımda menzilli Topçu’dur;
- lojistik, yol, Depo ve Karakol sistemleri oyunun temel kimliğidir;
- ana savaş ölçeği yaklaşık 25–40 birimdir;
- güncel oynanabilir kapsam iki çağdır;
- minimap kapsam dışıdır;
- tam ses paketi hâlen tamamlanmamış üretim alanıdır.

Bu nedenle ses planı yeni oyun sistemi icat etmek yerine mevcut oynanış olaylarını daha okunabilir ve karakterli hale getirmeye odaklanır.

---

# 82. Faz 5 çalışma sayfası

§48–§50'nin kutuları v1.0'dan kalma ve Faz 0–4'ün yaptıklarını saymıyor. Bu
bölüm Faz 5'in **gerçek** kalanını taşır; §81 Faz 2 için neyse bu da Faz 5 için
odur.

## 82.1 Üç kova

Kalan iş üç farklı cinsten ve karıştırılırsa sıra yanlış kurulur:

| Kova | Ne gerektirir | Örnek |
|---|---|---|
| **A. Kanca** | Yalnız kod; ses ya var ya yer tutucuyla açılır | Seçim paneli butonları, birim ölümü, yol döşeme |
| **B. Varlık** | Firefly üretimi; kanca da yeni | Pazar al/sat, yıkım, seviye atlama, bildirimlerin tür bazlı sesleri |
| **C. Önce animasyon** | Klipte `notify` yok — ses işi değil, klip işi | Yay germe, kalkan bloğu, çekiç, topçu geri tepmesi |

**C bir duvar ve önce görülmesi gerekiyor.** Tüm `*.skeleton.json` sidecar'larında
yalnız altı notify adı authored: `footstep`, `body-impact`, `sword-swing`,
`arrow-release`, `throw-release`, `chop-impact`. §50'nin istediklerinin çoğunun
asılacağı işaret yok — kazmanın §81.1'de iptal edilme sebebiyle birebir aynı
durum. Bunlar için ses üretmek, çalmayacak bir kütüphane demektir.

Bu arada `throw-release` **authored ama hiçbir sese bağlı değil** — klipte
duruyor, `RTS_NOTIFY_AUDIO_EVENTS`'te karşılığı yok. Bir süre "ücretsiz bir
kanal" diye duruyordu; 23 Ağustos'ta **kapsam dışı** bırakıldı (§82.11 madde 5),
ve ses kancası olmadan da bir tüketicisi olduğu için sessiz kalması bir kayıp
değil. İşaretin kendisine dokunulmuyor.

## 82.2 Bağlandı — `unit.death` (22 Ağustos 2026)

§19/§20/§21'in `SFX-WRK-006` / `SFX-GRD-007` / `SFX-ARC-007` maddeleri, **tek
olay** olarak. Üç değil bir, çünkü §81.2 bunu zaten karara bağlamıştı: tablo
envanterlerden kaba ve rol başına set üretmek yarısı hiç çalmayan bir kütüphane
demek. Rol ayrımı bir **kod** kararıdır (olay id'si role göre seçilsin, ya da
işaret rolü taşısın) ve adımın rol ayrımıyla aynı geçişe aittir.

**Kanca:** `updateUnitDeaths`'in `onDefeated`'ı — birim yenildiği karede bir kez
çağrılan, tam da bu iş için ayrılmış nokta (cesedin kaldırılması otuz saniye
sonrası, ayrı bir kanca). İki taraf da duyulur; sis kapısı hangi ölümün
duyulacağına karar verir.

**Zamanlama kliptedir, kodda değil.** Kanca ölüm animasyonunun *başladığı* karede
çalar, gövdenin yere indiği anda değil. Düşüşü işaretlemek her ölüm klibine bir
notify yazmayı gerektirir — §81.1'in yazdığı tuzak. Bu yüzden klip vuruşu kendi
taşır: önce sendeleme ve teçhizat hışırtısı, sonra ağırlığın oturması.

**Bugün gerçek klipler çalıyor** — `unit.death` / `unit.death_heavy`, §82.9'da
indi. Aşağıdaki paragraf yer tutucu döneminden kalma ve *o dönemin gerekçesi*
olarak duruyor; bugünün durumu değil:

**~~Bugün yer tutucu çalıyor~~** (`starter-snd-impact-light`) ve bu bilinçli:
§0'ın Faz 0 doktrini — önce hat, sonra ses. Yer tutucunun `combat.body_impact`
ile karışabilir olması tam olarak Gate C'den önce değiştirilmesinin sebebi.
`events.json` boş `clips` dizisini bilerek reddediyor, yani olayın var olması
için bir klip şart.

### Üretim promptu — `SFX-UNIT-DEATH`

Dört varyant, `sfx/units/sfx_unit_death_NN.ogg`:

```text
Create a short grounded medieval RTS unit death sound heard from a mid-distance strategy camera.

A body going down: a brief cloth and leather rustle with light metal kit shifting, then the weight settling into dirt with a dull low thud.

Duration around 0.6 to 1.0 seconds, with the impact landing about 0.3 seconds in rather than at the very start.

Physical and restrained. It must read as a person falling, not as a weapon landing a hit — the killing blow already has its own sound.

No voice, no scream, no gore squelch, no music, no cinematic impact boom, no reverb tail.
```

Geldiğinde §81.4'ün üç adımı: dosyaları klasöre koy → `npm run audio:manifest` →
editörde **Veri → Ses Olayları → UNITS → unit.death** klipleri seç. `RtsApp.ts`
açılmaz.

## 82.3 Sırada, kovalarına göre

**A (kanca):**

- [x] `unit.death`
- [x] Paylaşılan olayların varyant ayrımı (§82.4) — kod indi, klip bekliyor.
      **23 Ağustos:** `light` yarısı adını aldı — `sfx_unit_footstep_dirt_NN`
      → `sfx_unit_footstep_light_NN`, ve `unit.footstep` base'i onlara işaret
      ediyor (ayrı `unit.footstep_light` kaydı yok, geri düşüş zaten light'ı
      oraya yolluyor). `unit.footstep_heavy` de indi — adım olayı artık iki
      sınıfa tam ayrık, ve `combat.body_impact` aynı şekilde `_light_`
      kliplerine geçti. Kalan klip: `combat.body_impact_heavy`,
      `unit.death_light`/`_heavy`.
- [x] Siege rig'inin adım işaretleri tekerleğe bağlandı (§82.8) — kod indi,
      klipler de indi (23 Ağustos), tekerlek ve gıcırtı çalıyor.
- [x] Paket 4 indi: 28 klip, 8 olay (§82.9) — ölüm ikilisi, ağır gövde
      darbesi, topçu tekerleği/gıcırtısı, ok ve gülle uçuşu, mermi isabeti.
      `unit.death`'in yer tutucusu emekli oldu; birim kanalında starter
      içeriği kalmadı.
- [x] Yapı sesleri hasar tablosundan (§82.5) — kod indi; ahşap isabet ve ateş
      döngüsü klipleri bekliyor (olaylar var, taş sete ve `starter-snd-fire-01`'e
      işaret ediyor)
- [x] Seçim paneli butonları (§82.6) — on dört aksiyonun hiçbirine dokunulmadan
      çözüldü: `command` → `ui.confirm`, `command-refused` → `ui.error`,
      bildirim **türü** haritası üzerinden. Rally ve pazar al/sat kendi seslerini
      ayrıca adıyla veriyor.
- [x] Yol döşeme / silme (§18 `SFX-LOG-001`/`009`) — §82.7. Başarı yol grafiğinin
      `version` sayacından okunuyor, aracın döndürdüğü durumdan değil: durum
      hangi *modda* olduğunu söyler, zeminin değişip değişmediğini değil.
- [x] Yapı/lojistik kancalarının geri kalanı (§82.7): geçersiz yerleştirme,
      yıkım onayı, seviye/çağ atlama başlangıcı, depo ve karakol bağlandı,
      bölge genişledi, ve şantiyenin çekiç/kereste katmanı.
- [x] ~~`throw-release` işaretine bir ses~~ — ⛔ üretilmeyecek
      (karar 23 Ağustos 2026, §82.11 madde 5): isabet zaten duyuluyor

**B (varlık):** ~~pazar al/sat + stok dolu (§16)~~ (üretildi, §82.6),
~~yıkım onayı (§17)~~ ve ~~yapı seviye atlama / çağ atlama başlangıcı
(§17 `BLD-007`/`008`)~~ ve ~~depo bağlandı ve bölge genişledi
(§18 `LOG-003`/`008`)~~ (üretildi, §82.7); ~~tamir~~ (§82.11: yapı kendiliğinden
iyileşiyor, tamir diye bir oyuncu eylemi yok — kapsam dışı), ~~ahşap yapıya top
isabeti (§22)~~ (`structure.impact_wood` ×4 indi), bildirimlerin tür bazlı
sesleri — §82.6'dan sonra **yedisi** kendi sesine sahip (nüfus, kaynak, lojistik
kesik/geri, karakol, merkez, bölgesel zafer); kalan türler hâlâ üç tier'a
düşüyor ve çağ atlama klibi henüz yok (artık **tek** klip, §82.11).

**C (önce animasyon): kova kapatıldı — 23 Ağustos 2026.** İçindekilerin hepsi ya
başka bir yoldan indi ya da kapsam dışı bırakıldı, ve kova bir bekleme listesi
olarak durmaya devam etseydi her denetimde yeniden sayılırdı:

- ~~çekiç~~ — §82.7 çıkardı: klipler geldi, kadans zamanlayıcının ve rastgele.
- ~~topçu tekerlek/gövde~~ — §82.8/§82.9: rig'in `footstep` işaretleri tekerlek
  diye okundu, gıcırtı üstüne bindi, klipler indi.
- ~~ok uçuşu~~ — §82.9: varış ucuna çakıldı, işaret gerektirmedi.
- **⛔ Yay germe, kalkan hareketi/bloğu, topçu geri tepmesi** — üretilmeyecek
  (karar 23 Ağustos 2026, §82.11). Üçü de authored bir işaret bekliyordu; işaret
  yazmak animasyon işi, ve o iş bu üç ses için yapılmayacak.

**Ayrıca:** Worker ve Archer VO (§38/§40) — metinler hazır, Guard profili (§47.0)
referans, kanca `playSelectionAudio` içinde bugün yalnız Guard'ı soruyor.

## 82.4 Paylaşılan olayların ayrımı — karar (22 Ağustos 2026)

§81.2 bu soruyu açık bırakmıştı ve doğru soruydu: tabloda tek satır olan şeye rol
başına ses üretmek, yarısı hiç çalmayacak bir kütüphane demek. Kullanıcı Faz 5'e
girerken sordu, ve karar **eksen üzerine** verildi.

### Sorun sanıldığından küçük

Üç olay gerçekten paylaşılıyor: `unit.footstep` (dört rig), `combat.body_impact`
(üç rig), `structure.impact` (her yapı). Geri kalanlar **zaten rol başına ayrık**,
çünkü işaret tek bir rig'de authored:

| İşaret | Nerede authored | Sonuç |
|---|---|---|
| `sword-swing` | yalnız Guard | zaten bir Guard sesi |
| `arrow-release` | yalnız Archer | zaten bir Archer sesi |
| `chop-impact`, `throw-release` | yalnız Worker | zaten bir Worker sesi |
| `footstep` | Worker 6, Guard 8, Archer 8, Siege 4 | **paylaşılıyor** |
| `body-impact` | Guard 3, Siege 1, Worker 2 | **paylaşılıyor** |

### Eksen rol değil, zırh sınıfı

`armorClass` dengede zaten authored — `guard`/`siege` = `heavy`,
`archer`/`worker` = `light`, yapılar = `structure`. Üç gerekçe:

1. **Zaten var.** Yeni veri authoring'i sıfır.
2. **Kulağın duyduğu eksen bu.** Bir darbede duyulan şey vuranın rolü değil,
   vurulanın zırhıdır — §20 bunu zaten söylüyor: `SFX-GRD-004` "sword hit armor"
   ile `SFX-GRD-005` "sword hit flesh" yan yana. Rolle ayırmak (Guard vurdu /
   Siege vurdu) üç seti **yanlış eksende** üretmek olurdu.
3. **Dört değil iki set.** §19'un Worker'ı ile §21'in Archer'ı ikisi de light;
   tasarımın aralarında adlandırdığı fark gövde değil zemin ("dirt").

Aynı eksen üç olayı birden çözüyor: `unit.footstep` (yürüyenin zırhı),
`combat.body_impact` (**hedefin** zırhı), `unit.death` (ölenin zırhı).

**İki işaret zıt özneyi okuyor ve bu tutarsızlık değil, kararın kendisi:** bir
adım *yapanın* sesidir, bir darbe *üzerine indiği şeyin*.

`structure.impact` kendi ekseninde: hasar tablosunun malzeme sınıfı (§23'ün
`CMB-006` ahşap / `CMB-007` taş).

### Geri düşüş — ayrımın klipten önce inebilmesinin sebebi

`resolveRtsAudioVariant` varyantı yalnız **tablo cevaplıyorsa** seçer, yoksa
paylaşılan sese düşer. Müzik durum makinesiyle aynı şekil ("projenin sevk
etmediği bir durum, çalanı korur"), ve iki şey sağlıyor: üretim sınıf sınıf
gelebilir (ağır set hafif setten aylar önce inebilir, arada sessiz kare yok), ve
tek set üreten bir fork bu mekanizmayı hiç bilmek zorunda kalmaz.

**Bugün hiçbir varyant sevk edilmedi, yani duyulacak değişiklik yok.** Kod
ayrımı kasten üretimden önce indi — sorunun aslı buydu: klip üretilmeden ayrım
yoksa, üretilen kliplerin bir kısmı hiç çalmaz.

### Maliyet

Bugün 3 paylaşılan set (12 klip). Ayrımdan sonra 6 set, ama mevcut kliplerin bir
kısmı bir tarafı zaten karşılıyor (`sfx_structure_impact_stone_*` zaten taş).
Yeni üretim **3 set / 12 klip**: ağır adım, zırhlı darbe, ahşap yapı isabeti.
Rol ekseninde bu 9 set olurdu.

### İki açık uç

- **`structure.impact` için veri eksik.** 15 binanın yalnız 5'i malzeme beyan
  ediyor (`lumber_camp`/`hunting_camp`/`pasture` ahşap, `quarry`/`gold_mine`
  taş). Kalanlar paylaşılan sese düşer. Alanı doldurmak ucuz ama **görsel yan
  etkisi var**: malzeme sınıfı aynı zamanda moloz efekt ailesini seçiyor. Yani
  bu bir ses işi değil, bilinçli bir içerik kararı — o yüzden kendiliğinden
  doldurulmadı.
- **Ayrım, tekrar kontrolünü ikiye böler.** `cooldownMs` ve `maxInstances` olay
  başınadır, yani `combat.body_impact_light` + `_heavy` toplamda iki kat örneğe
  izin verir. Varyantlar sevk edildiğinde bu sayılar yeniden ayarlanmalı.

## 82.5 Yapı sesleri hasar tablosundan sürülür — tasarım (22 Ağustos 2026)

Kullanıcının önerisi, ve §82.4'ün yapı yarısını **yerinden ediyor**. Kayıt için
önce o: §82.4 `structure.impact` varyantını `damage.buildings.<id>.material`
string'inden okuyordu, ve o kaynağın iki zayıflığı vardı — **çağ körü** (bir ev
yerleşimde ahşap, kasabada taş dökülür; tek bir malzeme adı bunu söyleyemez) ve
**15 binanın 10'unda authored değil**. `debris` slot'u ikisini de çözüyor:
`defaults` üzerinden her binayı kapsıyor ve zaten çağ başına ayrık. Ses için
doğru kaynak malzeme alanı değil, **o çağda gerçekten dökülen şey**.

### Slot bir olay id'si adlandırır, klip değil

`effects` bir efekt varlığı id'si adlandırıyor ve efektin içini efekt varlığı
biliyor. Ses de öyle: slot bir **olay id'si** adlandırır, o sesin neye benzediğini
`events.json` bilmeye devam eder. Damage tablosuna klip id'si yazmak §58/§80'in
sınırını delerdi — mix hiyerarşisi, cooldown, mesafe kesmesi ve instance bütçesi
olay tablosunundur, ve bir klip id'si onların hiçbirini taşımaz.

### Tek alan: `sound`, string ya da çağ haritası

```jsonc
// damage.defaults.slots
"debris":       { "sound": { "settlement": "structure.impact_wood",
                             "town":       "structure.impact_stone" } },
"collapseDust": { "sound": { "settlement": "structure.collapse_wood",
                             "town":       "structure.collapse_stone" } },
"heavySmoke":   { "sound": "structure.fire_loop" },
"lightSmoke":   { },   // sessiz
"ruinSmoke":    { }    // sessiz
```

**Üç katmanlı override bedavaya geliyor** ve tarif edilen istisna tablosunu
birebir veriyor — yeni mekanizma yok:

```jsonc
"materials": {
  "stone": { "slots": { "debris":       { "sound": "structure.impact_stone" },
                        "collapseDust": { "sound": "structure.collapse_stone" } } },
  "wood":  { "slots": { "debris":       { "sound": "structure.impact_wood" },
                        "collapseDust": { "sound": "structure.collapse_wood" } } }
}
```

Çıplak bir string burada **iki çağı birden** ezer. Sonuç:

| Bina | Yerleşim | Kasaba | Nereden |
|---|---|---|---|
| Ev, depo, kışla, tapınak… | ahşap | taş | `defaults` |
| Oduncu kampı, avcı kulübesi, ağıl | ahşap | ahşap | `material: "wood"` |
| Taş ocağı, altın madeni | taş | taş | `material: "stone"` |

`sound`'un string **veya** harita olması kayma riskini yapısal olarak kaldırıyor:
`ages` ile anahtar anahtar eşleşmesi gereken paralel bir harita olsaydı, üçüncü
bir çağ eklendiği gün biri sessiz kalırdı. Ayrıca `collapseDust` gibi `effects`'i
çağa bağlı **olmayan** bir slot bile sesini çağa bağlayabiliyor — ki tam olarak
istenen budur.

### Ses ile efekt neden ayrışıyor — ve bu neden doğru

Kasaba çağı debris efekti `rts-fx-debris-tile` (kiremit), ama kasaba çağı **sesi
taş**. Bu bir tutarsızlık değil, kararın kendisi ve ayrı bir alan olmasının en
iyi gerekçesi:

> Efektin malzemesini **nereden çıktığı** seçiyor — debris anchor'ı `roof`, yani
> parçalar çatıdan dökülüyor ve çatı kiremit. Sesin malzemesini ise binanın
> **neden yapıldığı** seçiyor, ve yapılar yoğunlukla taş.

Sesi efekt id'sinden türetseydik (`rts-fx-debris-tile` → "kiremit sesi") bu ayrım
ifade edilemezdi ve her bina yanlış duyulurdu. `sound`'un authored olmasının
sebebi budur.

### Ateş sesi bir yatak, bir patlama değil

`heavySmoke` bir **tekrar eden spawn** (`intervalSeconds: 1`): efekt her saniye
yeniden doğuyor. Sesi aynı ritimde tetiklemek saniyede bir yeniden başlayan bir
çıtırtı, yani kekemelik olurdu. Ateş bir yataktır: ağır hasar kademesine girince
başlar, tamir ya da yıkım ile 0.35 s'de kısılır.

Ve `building.build_loop`'un kuralı burada da geçerli, aynı gerekçeyle:
**haritada tek ateş çalar, en yakın yanan binada.** Dört yanan ev dört ateş
değil bir bulamaçtır, üstelik direktörün `stop()`'u olay id'siyle çalıştığı için
ikinci kopya tek tek durdurulamaz. `updateBuildLoopAudio` birebir kopyalanacak
şekil.

### Uygulama kapsamı

| Yer | Ne |
|---|---|
| `rtsContentCatalog.ts` | `RtsDamageSlot.sound` (string ya da çağ haritası), `RtsResolvedDamageSlot.sound` (tek string ya da null), normalizasyon + override katmanı |
| `validateRtsContentDamageSection` | `sound` doğrulaması; `/__save-gamedata` bu yoldan geçiyor |
| `RtsApp` | `onStructureImpact` ve çöküş slot'un sesini çalar; `updateFireLoopAudio` (build loop'un ikizi) |
| `editorCatalog.ts` | `sound` için alan metadata'sı — hasar tablolarının formunda etiketli görünsün |
| `events.json` | `structure.impact_wood`, `structure.collapse_wood`, `structure.fire_loop` (yeni); `impact_stone`/`collapse_stone` mevcut kliplerle |
| `engine-tests.ts` | Damage tablosunun adlandırdığı her olay id'si, olay tablosunda karşılık bulmalı |

**Retire olan:** `structureMaterialVariant` ve `RTS_AUDIO_SPLIT`'in
`structure.impact` satırı. Aynı sorunun zayıf cevabıydı ve iki kaynak doğruluk
bırakmak en kötüsü olurdu — yapılarda olay id'si artık **türetilmiyor**,
authored. Birimlerin zırh varyantı (§82.4: `unit.footstep`, `combat.body_impact`,
`unit.death`) aynen kalır: onların hasar tablosu yok, ve orada türetme doğru
cevap.

**Bir pürüz:** `sound` union tipi ve Data Table formu path tabanlı, yani authored
olana göre bir kutu ya da iki kutu gösterecek. Uygulanırken bakılacak tek yer.

### Üretim

| Olay | Durum |
|---|---|
| `structure.impact_stone` | ✅ tabloda, mevcut `sfx-structure-impact-stone-01…04` |
| `structure.impact_wood` | ⏳ tabloda, **taş sete işaret ediyor** — 4 ahşap varyant bekliyor |
| `structure.collapse_stone` | ✅ tabloda, mevcut `sfx-structure-collapse-01…06` |
| `structure.collapse_wood` | ⏳ tabloda, **taş sete işaret ediyor** — 3-4 ahşap varyant bekliyor |
| `structure.fire_loop` | ⏳ tabloda, **`starter-snd-fire-01` duruyor** — dikişsiz döngü bekliyor (§56'nın loop checklist'i) |

Beş olayın beşi de `events.json`'da ve bugün çalıyor; bekleyen iki set klip
değişimi, olay değil. Yani §81.4'ün üç adımı geçerli: dosyaları klasöre koy →
`npm run audio:manifest` → editörde **Veri → Ses Olayları**'ndan klipleri seç.
`RtsApp.ts` açılmaz.

Minimum kazanç iki set: **ahşap isabet + ateş döngüsü.** Gerisi bağlama authored
olduğu için kod değil veri değişikliğiyle gelir.


## 82.6 Paket 2 indi — UI, bildirimler ve ekonomi (22 Ağustos 2026)

Kullanıcı §48'in listesini üretti ve `public/assets/audio/` köküne bıraktı;
§81.4'ün üç adımı işletildi (klasör → `npm run audio:manifest` → olay tablosu),
ve kanca tarafında §82.3'ün A kovasındaki "seçim paneli butonları" maddesi
kapandı. **38 yeni klip, 27 yeni olay.**

### Kararların üçü kayda değer

**1. On dört buton, on dört kanca değil.** §82.3 doğru teşhisi koymuştu —
`runSelectionAction`'ın hiçbir aksiyonu `playUiAudio` çağırmıyordu — ama çözümü
her aksiyona bir çağrı eklemek olsaydı, sonraki aksiyon yine sessiz doğardı.
Hepsi zaten `announce` üzerinden bir bildirim **atıyor**, o yüzden ses bildirimin
*türüne* bağlandı: `command` → `ui.confirm`, `command-refused` → `ui.error`
(`RTS_NOTIFICATION_KIND_AUDIO_EVENTS`). Bildirim merkezi zaten tekrarları
eliyor, yani bedava gelen şey yalnız kapsam değil, spam koruması da.

Kendi cevabı olan çağıran için `RtsNotificationRequest.sound` var: pazar alımı
tezgâhın sesiyle cevaplıyor, genel bir onayla değil. Merkez bu alanı **çözmüyor**,
yalnız taşıyor — olay id'si hâlâ tek dosyada (`rtsAudioEvents.ts`), bildirim
modülü saf durum olarak kalıyor.

**2. Tier haritası kaldırılmadı, altına konuldu.** `notify.info/warning/alert`
hâlâ kendi klibi olmayan her türü cevaplıyor. Yeni harita **kısmi** (`Partial`)
ve bu bilinçli: 20+ bildirim türü var, 7'sinin klibi üretildi, ve klibi olmayan
bir türü haritaya yazmak tablonun cevaplayamayacağı bir olay üretirdi. Çağ atlama
ikilisi tam olarak bu yüzden dışarıda (§48).

**3. Üretim sesi tetikleyicisi geçişte, tick'te değil.** §16'nın tek sert kuralı
"saniyede birçok kez kaynak artışı için ses üretilmemelidir" idi. Kaynak *varışı*
her tick çalışır; onun yerine ses üreticinin `producing`'e **geçtiği** karede
çalıyor (`previousProductionStatus`, `syncNotifications` içinde, `logistics-cut`
ile birebir aynı taban çizgisi deseni). Maç başına birkaç düzine kez, ve yapının
konumunda — uzaktaki bir tarlanın açılışı kısık duyuluyor, bu da bilgi.

Aynı desen `economy.stock_full` için de: depo tavana **vurduğunda** bir kez,
tavanda kaldığı sürece değil. İkinci tetikleyicisi pazar reddi ("yeri yok"), ve
tablonun en uzun cooldown'u (2 s) bu yüzden — bir depo kaybında dört kaynak
saniyeler içinde dolabiliyor.

### Hover iki kez düzeltildi — kullanıcı dinlemesi (22 Ağustos 2026)

İlk sürüm üç varyanttı ve seviyesi 0.12'ydi. Kullanıcı ikisini de reddetti, ve
ikisi de bu dokümanın kendi kurallarının yanlış yere uygulanmasıydı.

**1. Varyant ekseni yanlıştı.** Tablodaki her tekrarlanan ses için doğru olan
kural — tek klip takılı loop gibi okunur — hover'da tersine dönüyor. Oyuncu
yapı kartları sırasında saniyede altı buton geçiyor, ve her geçişte değişen bir
ses *çeşitlilik* değil **altı farklı kontrol** diye duyuluyor: kulak değişen sesi
işaretçinin altındaki şey hakkında yeni bilgi sayıyor. Diğer her yerde tekrar
saniyelere yayılıyor ve orada tek klip kırık geliyor.

Doğru eksen kullanıcının kendi önerisiydi: **ne olduğuna göre ayır, kaçıncı kez
olduğuna göre değil.** `ui.hover` (kontroller) + `ui.hover_card` (resimli kart —
bugün yapı ve yol küçük görselleri), her biri tek klip, jitter yok. Hedefin
`<img>` taşıyıp taşımadığına bakılıyor, sınıf listesine değil, yani sonradan
eklenen bir kart kendiliğinden kart oluyor. Üçüncü klip (`hover_03`) yedek
duruyor.

**2. Sessizliğin sebebi ses değil, sökülen dinleyiciydi — ve teşhis iki kez
yanlış kondu.** Kayda değer olan hata değil, hatayı bulduran şey.

Kanca `dispose()`'a eklenecekken, yamanın substring eşleşmesi ilk denk gelen
satıra düştü ve `detachUiHoverAudio?.()` **ses kilidini açan closure'ın içine**
girdi:

```ts
const unlock = (): void => {
  this.audioSubsystem.resumeContext();
  this.detachAudioUnlock?.();
  this.detachUiHoverAudio?.();   // ← ilk pointerdown'da hover dinleyicisi gidiyor
};
```

Yani hover, maçın **ilk tıklamasına kadar** çalışıyor ve sonra tamamen ölüyordu.
`tsc` memnun (kod geçerli), hiçbir test DOM dinleyici ömrünü kapsamıyor, ve
davranış "bir süre çalışıp kesilen ses" olduğu için mix problemine benziyordu.

İlk iki teşhisim — klip uzunluğu, sonra seviye — kullanıcının "ilk yapıyı
kurduktan sonra" ifadesinden türetilmişti ve ikisi de makuldü: propagasyonu
durduran kod yok, klipler kısa (granule ölçümü: 0.2 s). Ama ikisi de tahmindi.
Sorunu çözen üçüncü rapordu: **"herhangi bir simgeye ya da sekme düğmesine
tıkladıktan sonra kesiliyor."** Yapı kurmakla ilgisi yoktu, tıklamayla vardı — ve
"her tıklama" bir mix problemi olamaz, bir yaşam döngüsü problemidir.

Buradan çıkan iki kural:

- **Bir sesin "bir süre sonra kesilmesi" mix hipotezini davet ediyor ve genelde
  kanca hipotezi doğru oluyor.** Kesilme *neyin ardından* olduğu sorulmadan
  seviye ayarlamak, çalışan bir sayıyı boşuna değiştirmek demek.
- **Substring `replace` ile yama, satır yerine metin eşleştiriyor.** `dispose()`
  içindeki dört boşluklu satır, bir closure içindeki altı boşluklu satırın alt
  dizesi — ve `replace(old, new, 1)` ilk denk geleni alıyor.

Seviye 0.12'ye **geri alındı**: 0.22'ye çıkarılmasının tek gerekçesi yanlış çıkan
teşhisti, ve bu sayı hakkındaki tek gerçek veri 0.12'nin duyulduğu ve kimsenin
kısık bulmadığı. `maxInstances` 2'den 3'te kaldı; o gerekçe teşhisten bağımsızdı
ve ayakta: 80 ms'de tetiklenen 0.2 s'lik klip hızlı bir taramada ikisini birden
ayakta tutuyor ve üçüncü geçiş reddediliyor.

### Hover: bir dinleyici, her buton

`ui.hover` HUD host'una (`#ui-overlay`) delege edildi, kontrol başına değil.
Sebep yazım tasarrufu değil: paneller seçim değiştikçe yeniden kuruluyor, yani
buton başına dinleyici her kurulumda yeniden bağlanmak zorunda kalır ve sonradan
eklenen bir panel sessiz doğar. Host'ta bağlıyken bir kontrol, HUD içinde
`<button>` olmakla sesi kazanıyor.

`pointerover` (delege edilebilen tek biçim) + `relatedTarget` kontrolü: olay bir
butonun kendi çocukları arasında da tetikleniyor, kontrol olmasa etiket + ikon
taşıyan bir buton tek geçişte iki kez tıklardı.

### İki klip eksik, dört dosya taşındı

`sfx_notify_age_up_01.ogg` ve `sfx_notify_enemy_age_up_01.ogg` listedeydi ama
klasöre düşmedi. Kanca hazır: klipler geldiğinde tek yapılacak
`RTS_NOTIFICATION_KIND_AUDIO_EVENTS`'e iki satır ve tabloya iki giriş.

Kökte adı zaten üretilmiş bir klibe ait olan iki dosya vardı
(`sfx_notify_alert_01`, `sfx_notify_info_01`) ve §48'in listesinde ikisi de yoktu.
Üzerine yazmak yerine **varyant** olarak girdiler (`alert_03`, `info_02`) — 21
Ağustos'ta üretilmiş bir klibi teslim listesinde adı geçmeyen bir dosya için
silmek geri alınamaz, varyant eklemek ise `notify.alert`'in kendi notunun zaten
istediği şey. `sfx_ui_click_01` ve `sfx_ui_error_01` ise listede **adıyla**
geçiyordu, yani yeni üretim eskisinin yerini alsın diye gelmişti; onlar üzerine
yazıldı.


## 82.7 Paket 3 indi: yapılar ve lojistik (23 Ağustos 2026)

21 klip klasöre düştü, **10 yeni olay** ve **7 yeni kanca** açıldı; iki dosya
(`sfx_building_complete_01`, `sfx_building_place_01`) 20 Ağustos'un demo setinin
üzerine yazıldı, çünkü manifest id'si dosya adından türüyor ve yeni üretim
listede **adıyla** geliyordu — §82.6'nın `sfx_ui_click_01` için verdiği kararın
aynısı.

### Bir olayın klip sayısı bir tasarım kararıdır

Teslimatta dört tamamlanma klibi ve dört çekiç klibi vardı ve **zıt biçimde**
kullanılıyorlar. Kullanıcı ikisini de ayrıca söyledi, ve ayırt eden şey sayı
değil ne söyledikleri:

- **`building.complete` tek klip adlandırır.** Tamamlanma krallığın imza sesi;
  rastgele dört farklı klip *çeşitlilik* olarak değil, "dört farklı şey oldu"
  olarak duyulur. Diğer üçü manifestte **seçenek** olarak duruyor — id'yi
  değiştirip dinlersin, hepsini listelemezsin.
- **`building.construction_hammer` dördünü de adlandırır.** Bir ekibin her
  darbesinin aynı olması, bozuk gibi duyulan tam olarak şeydir.

Bu ayrım `test:engine`'de bir sözleşme olarak sabitlendi ve sabitlenen şey
kasten "bir" ile "birden fazla" — hangi klip ve kaç tane değil, ki yeniden
dinleme ya da beşinci bir çekiç yeşil kalsın.

### Şantiye: yatak kaldı, darbeler üstüne bindi

`building.build_loop`'un kendi notu neden yalnız olduğunu söylüyordu: çekiç
klibi yoktu, yani *darbe başına* çalacak bir şey yoktu ve sürekli bir bulamaç
işin yerini tutuyordu. Şimdi darbe var. Yatak **altında kaldı** çünkü başka bir
iş yapıyor (şantiye sürekli bir *yer*), ve ikisi çakışırsa çare tablodaki
`building.build_loop.volume` — orası ayar, ve oynaması için var.

Kadans bir zamanlayıcının ve **rastgele**: darbeyi asacak bir notify hâlâ yok
(inşaatçı idle pozunda duruyor), ve sabit bir aralık o cevabı yanlış verirdi —
eşit vuruş makine gibi duyulur, bantlı rastgele aralık ise insan gibi. Çekiç ve
kereste tek havuz değil iki ayrı olay, ki oranları (`CONSTRUCTION_HAMMER_SHARE`)
authored kalsın.

### Lojistik başlığının kararı bozuldu

`editorCatalog.ts`'teki LOGISTICS başlığı "kendi sesi yok ve olmayacak — tier'lar
taşıyor (§69)" diye kayıtlıydı. Bu teslimat onu bozdu: bir yolun döşenmesi, bir
deponun ağa katılması ve sınırın dışarı taşınması bir tier'ın söyleyebileceği üç
şey değil. Not silinmedi, **bozulduğu yazıldı** — bir kararın tersine dönmesi
kaydın kendisi.

### Üç şey yalnız uygularken çıktı

**1. Yolun başarısı aracın durumundan okunamıyor.** `RoadPlacementSystem` şu an
hangi *modda* olduğunu döndürüyor, zeminin değişip değişmediğini değil: rota
çizmenin iki tıklaması da "kuruldu sonra kuruldu değil" bırakıyor, ve boş zemine
yapılan bir silme tıklaması dolu zemindekinin aynısı görünüyor. `RoadGraph.version`
yalnız *commit edilmiş* topoloji değiştiğinde ilerliyor, yani sesin sorduğu tek
soruyu cevaplayan sayaç o.

**2. Bağlantı yoklaması kareye kaçamaz.** `outpostConnectedToMainRoad` bir ağ
yürüyüşü, ve yoklama `syncNotifications` içinde — yani **her simülasyon tick'i**,
8x'te kare başına defalarca. Koşulsuz sorsaydık depo ve karakol başına bir BFS
sıcak yola girerdi; aynı desenin hücre başına hâli (`territory.refresh`) yol
inşasını saniyelerce dondurmuştu. Yanıt yalnız yol topolojisi ya da mülkiyet
oynadığında değişebilir, o yüzden kapı `roads.version:territory.version`.
Bileşik anahtarın ikinci yarısı ihmal değil: sınır kaymasıyla rota yasal hale
gelebiliyor, tek bir hücre döşenmeden.

**3. "Bölge genişledi" bir yüksek-su işareti olmalı.** Delta olsaydı bir baskında
kaybedilip geri alınan zemin ikinci kez genişleme diye duyulurdu. Ayrıca aynı
karede bir bağlantı sesi çaldıysa susuyor — karakolun ağa katılması yarıçapını
zaten genişleten şey, ve ikisini birden duymak tek olayı iki kez anlatmak olur.
Açılış ölçümü de büyüme değil: merkezin kendi zemini sıfırdan bir sıçrama olarak
geliyor.

### Kalan

`building.complete`'in üç alternatifi bilerek bağlı değil (yukarıdaki karar).

**24 Ağustos güncellemesi:** bu paragrafın geri kalanı bayatlamıştı ve
düzeltiliyor — tamir §82.11'de kapsam dışı bırakıldı, ahşap yapıya top isabeti
(`structure.impact_wood` ×4) indi, ve çağ atlama **tek** klibe düştü (§82.11
madde 2), o da §82.17'de tek başına duruyor.

## 82.8 Rig, işaretin ne demek olduğunu değiştirebilir (23 Ağustos 2026)

§82.4'ün zırh ayrımının **ortaya çıkardığı** bir hata, ve düzeltmesi ayrımın
kendisiyle aynı şekle sahip.

### Hata

`siege_placeholder`'ın `armorClass`'ı `heavy`. Ağır adım seti indiği gün top
arabası Guard için üretilmiş **çizme sesi** çalmaya başladı. Siege rig'inde dört
`footstep` işareti authored ve bunlar tekerlek temasları — tekerlekli bir top ne
yürür ne çizme giyer. Ayrım olmadan da yanlıştı (paylaşılan toprak sesini
çalıyordu) ama duyulmuyordu; ağır sete geçince duyulur oldu.

### Eksen zırh değil rig

Üçüncü bir zırh sınıfı (`siege`) yanlış cevap olurdu. `armorClass` "üzerine inen
darbe ne kadar acıtır" sorusunu cevaplıyor ve `siege` bu soruda Guard'la
dürüstçe aynı sınıfta. Farklı olan **sesi çıkaran mekanizma**, ve o birimin
dayanıklılığının değil rig'inin özelliği. Zırhı bunu taşıyacak kadar genişletmek
bir savaş sayısına animasyon sorusu cevaplatmak olurdu, ve `combat.body_impact_heavy`
o gün istemediği bir topçu seti isterdi.

O yüzden ikinci bir tablo: `RTS_ROLE_NOTIFY_AUDIO`, rig → işaret → ses.

### İki tür geçersiz kılma, çünkü bir rig iki farklı şekilde katılmayabilir

- **`instead` yerine geçer.** İşaret bu rig'de tekerlek demek, o yüzden adım
  *ayrıca* çalmamalı.
- **`alongside` üstüne biner.** Top yuvarlanırken gövde gıcırdıyor ve bunun kendi
  işareti yok; temas işaretlerine biniyor ve **kendi `cooldownMs`'i ile
  seyreliyor**. Tek klip ailesi bunu yapamazdı: temas başına bir hız ile birkaç
  saniyede bir hız aynı sette duramaz. Bir işaretin iki olay beslemesinin
  gerekçesi bu — katman değil, **iki farklı ritim**.

### Geri düşüş — yine klipten önce inebilmesi için

`resolveRtsRoleNotifyEvent` §82.4'ünkiyle birebir aynı şekle sahip: rig'in kendi
sesi yalnız **tablo cevaplıyorsa** seçilir, yoksa paylaşılan sese düşer. Bugün
tekerlek klipleri yok, yani top arabası ağır adımı çalmaya devam ediyor —
yanlış ama duyulur. Sessizlik daha kötü bir hata olurdu, ve klipleri beklemek
kodla kliplerin aynı commit'te inmesini zorunlu kılardı.

`alongside` bu geri düşüşü **taşımıyor** ve taşımamalı: eklemeli bir ses için
düşülecek bir yer yok, cevaplanmayan katman yalnızca sessiz. Çözücü gıcırtıyı
asla yerine geçen olarak döndürmüyor — testte pinlenmiş, çünkü ikisini
karıştırmak gıcırtı indiği gün tekerleği susturur.

### Kalan — kalmadı (23 Ağustos 2026)

`siege.wheel_roll` (×3) ve `siege.carriage_creak` (×3) aynı gün indi (§82.9);
top arabası artık Guard'ın çizmesini değil kendi tekerleğini çalıyor. İkisi de
`rtsAudioEventIds()` dışında kaldı, yani tablo onları cevaplamak **zorunda
değil** — tıpkı bir varyant gibi, isteğe bağlı olarak inşa edilmiş.

## 82.9 Paket 4 indi — ölüm, ağır darbe, topçu hattı (23 Ağustos 2026)

28 klip, 8 olay. Beşi saf veriydi (kod zaten bekliyordu), üçü kanca istedi.

### Kod dokunmadan inenler

| Olay | Klip | Nasıl |
|---|---|---|
| `unit.death` | ölüm light ×3 | base, §82.4 geri düşüşü light'ı buraya yolluyor |
| `unit.death_heavy` | ölüm heavy ×3 | varyant |
| `combat.body_impact_heavy` | ×4 | varyant |
| `siege.wheel_roll` | tekerlek ×3 | §82.8 `instead` |
| `siege.carriage_creak` | gıcırtı ×3 | §82.8 `alongside` |

**Birim kanalında artık starter içeriği yok.** `unit.death` 22 Ağustos'tan beri
`starter-snd-impact-light` üzerinde duruyordu (§82.2, kanca kliplerden önce
inmişti); Faz 5'in son yer tutucusu bu paketle emekli oldu.

**Üç tavan yeniden ayarlandı**, §82.4'ün açık ucu gereği: `cooldownMs` ve
`maxInstances` olay başına, yani her ayrım tavanı ikiye katlıyor. `unit.death`
3 → 2 (toplam 4), `combat.body_impact` 6 → 4 (toplam 8). Adımlar bu ayarı
`unit.footstep_heavy` indiğinde zaten almıştı.

### Kanca isteyen üçü — ve uçuş sesinin nereye çakılacağı sorusu

`combat.arrow_flight`, `siege.cannonball_flight`, `siege.shell_impact`. İlk
ikisi aynı soruyu soruyor: bir uçuş sesi fiziksel olarak mermiyle birlikte
**hareket eder**, ve `AudioPlaybackHandle` çalarken taşınamıyor
(`stop`/`setVolume`/`setPitch` var, konum yok — bkz. 10 sn'lik loop tartışması).
Yani uçuş sesi iki uçtan birine çakılmak zorunda.

**Varış ucu seçildi.** Kalkış zaten kendi yerinde cevaplanıyor —
`combat.arrow_release` Archer'ın işaretinden, `siege.cannon_fire` namludan — ve
aynı noktaya ikinci bir ses koymak onu büyük ölçüde birincinin altına gömerdi.
Varış ucunda ise başka hiçbir şeyin yapmadığı işi yapıyor: **buraya bir şey
inecek**, hem de oyuncunun bakması gereken yerde ve inmeden az önce. Gülle için
bu özellikle değerli, çünkü atış karesinde tetikleniyor ve merminin bütün uçuş
süresi kadar önden gidiyor.

Karakol'un ikiz oku tek uçuş sesi çalıyor: birlikte atılan iki ok tek bir vızıltı,
ve olayın kendi cooldown'u ikinciyi zaten reddederdi.

`siege.shell_impact` isabet karesinden geliyor (`setImpactHandler`, zaten oradaydı
ve yalnız VFX + is çiziyordu). Hasar sesine **eklemeli**: duvarın
`structure.impact_stone`'u malzemenin verdiği ses, bu onu veren patlama. Maçta
ikisi tek bir çamurlu güm gibi okunursa kısılacak olan bu, çünkü *neyin*
vurulduğunu söyleyen malzeme çatlağı.

Klipler yere göre adlandırılmış (`sfx_artillery_ground_impact_*`) ama olay
mermiye göre: aynı olay duvarda da çalıyor.

## 82.10 Maçtan gelen iki rapor — ıslık ve dönüş (23 Ağustos 2026)

Kullanıcı §82.9'u oynadı ve iki şey bildirdi. İkisi de gerçekti, ve ikisi de
farklı cinsten hata.

### 1. Gülle ıslığı hiç duyulmuyor — ve sebebi tahmin değil ölçüm

Okun uçuşu kısık olmasına rağmen duyuluyordu, gülleninki hiç. Şüphe önce mesafe
kapısındaydı; ölçüm başka yeri gösterdi:

| | süre | volume |
|---|---|---|
| `siege.cannon_fire` | 1.00 s | 0.5 |
| `siege.cannonball_flight` | 1.00 s | 0.22 |
| uçuş süresi | 0.45–1.05 s (`distance / 19`, kırpılmış) | — |

Rapor ıslıkla **aynı karede** başlıyor, tam bir saniye sürüyor, iki kat gürültülü,
ve kameraya daha yakın (ıslık iniş noktasında). Yani ıslık bütün uzunluğu boyunca
bangın altında kalıyor.

**Zamanlama düzeltmesi yok.** Uçuşu klipten kısa olan bir mermi, var olmayan bir
boşluğa geciktirilemez — 0.3 sn ertelemek ıslığı bu sefer isabet patlamasının
altına sokardı. O yüzden cevap mikste: `volume` 0.22 → 0.4, `refDistance`
30 → 45, `rolloff` 7 → 4. Düz rolloff onu uzak uçta ayakta tutan şey, o yüzden
fazla gelirse çekilecek olan `volume`.

Gerçekten ayrışmış bir ıslık istiyorsak bu bir **üretim** değişikliği: ya daha
kısa ve vurgulu bir ıslık, ya daha kısa bir rapor. Tablo bunu çözemez.

### 2. Dönüşte gıcırtı yok — işaret modelinin kendi kör noktası

§82.8 gıcırtıyı temas işaretlerine bindirmişti, ve yerinde dönüşte hiç temas
işareti yok: tekerlekler bir yere gitmiyor. Top gözle görülür şekilde bir saniye
boyunca sessizce dönüyordu — görüntüyle sesin olayın olup olmadığı konusunda
anlaşamaması.

Kanca ikinci bir tetikleyici aldı, ama **eşik paylaşılıyor**: mürettebatın strafe
animasyonu zaten `turnRateDegPerSecond * 0.25`'i geçince oynuyor, ve gıcırtı artık
aynı fonksiyonu okuyor (`siegeTurnGateDegPerSecond`, dışa açıldı). İki ayrı sayı
olsaydı sonunda biri kayardı: ya top sessizce dönerdi ya da dururken gıcırdardı.
Testte pinlenen de bu — büyüklük değil, eşiğin dönüş hızının **içinde** olduğu ve
pozun hâlâ tam o sayıyı cevapladığı.

Yaw hızı yeniden ölçülmüyor; sunumun bu kare zaten ölçtüğü değer okunuyor. İkinci
bir ölçüm sıfır okurdu, çünkü ilk örnekleyici karşılaştırdığı işareti çoktan
ilerletmiş oluyor.

Kendi zamanlayıcısı yok: gıcırtıları aralayan şey olayın `cooldownMs`'i, yuvarlanan
işaretlerde olduğu gibi. Tekerleğin de tetiklendiği bir karede ikisinden biri
reddediliyor, ve hangisi olduğu önemli değil — ses zaten aynı ses.

## 82.11 Beş kapsam kararı (23 Ağustos 2026)

Kullanıcı §82.10 sonrası kalan listeyi okudu ve beşini kapattı. Dördü kapsam
daraltması, biri bir yanlış anlamanın düzeltilmesi — ve beşi de listeyi
*kısalttığı* için yazılıyor: kapatılmayan bir madde her denetimde yeniden
sayılır, ve "neden hâlâ burada" sorusu üçüncü kez sorulduğunda cevabı kimse
hatırlamaz.

### 1. Stinger klasörü doğru; yanlış olan dokümandı

Soru "`stingers/` içindeki dosyalar yanlış mı adlandırılmış" idi ve soruyu
doğuran şey §29'un bayat bir satırıydı: `stg_age_up_02.ogg`'nin çaldığını ve
`-01`'in yetim kaldığını yazıyordu. Diskte üç dosya var — `stg_age_up_01`,
`stg_victory_01`, `stg_defeat_01` — üçü de manifestte, üçü de bir olayın
adlandırdığı dosya; yetim yok, yanlış ad yok. Yeniden adlandırma zaten 22
Ağustos'ta yapılmıştı (§0'ın kaydı); güncellenmemiş olan §29'du ve şimdi
düzeltildi.

**Buradan çıkan şey dosyalarla ilgili değil.** Aynı olguyu iki yerde tutan bir
belgede biri düzeltildiğinde diğeri *yanlış varlık* raporu üretiyor — ve o rapor
bir oturum başlatıyor. §29 gibi envanter tabloları artık üretim kaydı değil;
hangi dosyanın çaldığının tek doğru kaynağı `events.json` ile manifesttir.

### 2. Düşman çağ atlaması ayrı klip almayacak

`sfx_notify_age_up_01.ogg` ve `sfx_notify_enemy_age_up_01.ogg` iki ayrı teslim
kalemiydi. **Tek klip üretilecek**, iki bildirim türü de onu çalacak.

Gerekçe kolaylık değil, okunabilirlik: iki haber de aynı cinsten ("bir krallık
çağ atladı"), ve oyuncununkini ayıran şey zaten var — `stinger.age_up` müzik
bus'ında, yalnız oyuncunun kendi atlamasında. Yani bildirim klibi *olayı*
söylüyor, stinger *kimin olduğunu*. İki ayrı klip aynı ayrımı ikinci kez, ve daha
zayıf bir kanalda yapmaya çalışırdı.

Tablo bunu iki olayla değil **tek olayla** taşıyacak (`notify.age_up`), çünkü
şema bir olayı klibinden ayırıyor ama iki olayın aynı klibi çalması onları
duyulur biçimde ayırmıyor: `pitchVariation` rastgele bir aralık, sabit bir
kaydırma değil. Aynı sesi verecek iki satır, ileride "bunlar neden ayrı" diye
sorulacak bir borç olurdu.

**İnecek şey, klip geldiğinde:** `events.json`'a bir `notify.age_up` girdisi ve
`RTS_NOTIFICATION_KIND_AUDIO_EVENTS`'e iki satır (`age-upgraded` ve
`enemy-age-upgraded`, ikisi de aynı olayı adlandırıyor). Tablo boş `clips`
dizisini reddettiği için sıra tersine çevrilemez — klip önce iner.

### 3. Tamir sesi kapsam dışı

§82.3'ün B kovasında "tamir (§17)" duruyordu. Oyunda tamir diye bir oyuncu eylemi
yok: yapılar kendiliğinden iyileşiyor. Ses üretmek şöyle dursun, kanca asılacak
bir an bile yok — ve kendiliğinden ilerleyen bir onarıma ses koymak §16'nın
kaynak tick'i için verdiği kararla aynı sebeple yanlış olurdu.

### 4. Yay germe, kalkan hareketi/bloğu, topçu geri tepmesi üretilmeyecek

C kovasının kalan üç maddesi. Hepsi authored bir animasyon işareti bekliyordu ve
o işaretleri yazmak animasyon işi; o iş bu üç ses için yapılmayacak. Kova böylece
tamamen kapandı (§82.3).

Kaybedilen şey kayda değer ve küçük: üçü de **ikinci bir katman** olurdu, birinci
katmanı olmayan bir an değil. Yay germe `combat.arrow_release`'in hemen öncesi,
kalkan bloğu `combat.body_impact`'in üstü, geri tepme `siege.cannon_fire`'ın
kuyruğu. Üç anın da bugün bir sesi var; olmayacak olan detay.

### 5. Worker'ın taş atışı da üretilmeyecek

Aynı oturumda `throw-release` ayrıntılandırıldı, promptu yazıldı, ve sonra
kapsam dışı bırakıldı — gerekçe 4. maddeninkiyle birebir aynı şekle sahip:
`combat.body_impact` isabeti zaten veriyor, yani eksik olan **ikinci bir
katman**. Bir tur içinde hem yazılıp hem kapatılması, listenin dördüncü maddeyle
gerçekten daraldığının ölçüsü. Ayrıntısı §82.12'de; işaretin kendisi duruyor,
çünkü ses kancası değil.

## 82.12 `throw-release` — kapsam dışı (23 Ağustos 2026)

Bir tur boyunca üretim listesinde durdu, ayrıntılı promptu yazıldı, ve
**üretilmeyecek.** Kullanıcının kararı tek cümleydi ve doğru cümleydi: isabet
zaten yeterli.

Kaydın burada durma sebebi bu bölümün silinmemiş olması: `throw-release`
tüm sidecar'lardaki tek "authored ama hiçbir sese bağlı değil" işaret, ve bu
onu her denetimde *kapatılabilir bir boşluk* gibi gösteriyor. İki kere
sayılmaması için bir kere yazılıyor.

**Neden kayıp değil.** Worker'ın taşı, ses için üç uçtan yalnız birini sessiz
bırakıyor:

| Uç | Durum |
|---|---|
| Atışın kendisi | sessiz — ⛔ kapsam dışı |
| Uçuş | sessiz, ve kalması doğru: menzil 6 birim, ve §82.9 uçuş sesini varış ucuna çakmıştı; 6 birimde varış ucu zaten atış ucudur |
| İsabet | **duyuluyor** — hedefin `React_*` klibindeki `body-impact` → `combat.body_impact` |

Yani atışın *sonucu* okunuyor; eksik olan yalnız atanın kendi hareketi, ve bu
kamera mesafesinde bir Worker'ın kolu zaten okunmuyor.

**İşarete dokunulmuyor.** `RTS_THROW_RELEASE_NOTIFY` bir ses kancası değil:
`playUnitNotify` onu efekt bütçesinden önce tüketip taşı elden bırakıyor
(`releasePendingThrow`). Kapsam dışı olan yalnız ses; işaret silinirse taş kolun
uzanmasını beklemeden havalanır.

## 82.13 Bölgesel ambiyans — üretim listesi (§26 / §51)

§26 bunu "ikinci faz" diye bırakmıştı ve listesi haritadan değil genel bir RTS
tahmininden geliyordu. Aşağısı **bu haritada gerçekten olan yerlerin** listesi:
her satırın karşılığı `rts-content.json`'da bir bina ya da
`balance/trade-sites.json`'da bir ticaret sahası.

### Ortak şartname

| Alan | Değer | Sebep |
|---|---|---|
| Önek / klasör | `amb_zone_*.ogg` → `public/assets/audio/ambience/` | §6, §7 |
| Kanal | **mono** | Konumlu çalacaklar; Web Audio'da pan yalnız mono kaynakta doğru (§8.3) |
| Örnekleme | 48 kHz | Sevk edilen her varlıkla aynı |
| Süre | **30–45 sn**, dikişsiz loop | `amb_world_frontier_day_01` 170 sn / stereo / 10 MB — o bir *harita geneli* yatak ve tek tane. Yedi konumlu yatak aynı boyda olursa 70 MB'lık bir ses bütçesi demek (§61). Mono 40 sn ≈ 0.6 MB. |
| Seviye | Yatak, olay değil | `world.ambience`'ın altında oturmalı; yaklaşınca *fark edilmeli*, dinlenmemeli |
| Varyant | **1** | Hepsi loop; §82.7'nin kuralı — bir yatak tek klip, bir olay havuz |

§25'in kaçınılacaklar listesi hepsi için geçerli: belirgin 5–10 saniyelik tekrar
yok, her loop'ta aynı büyük olay yok, tonal drone yok, sürekli insan konuşması
yok.

### Liste

> **§82.15 bu listeden bir satır düşürdü.** Orman yatağı üretildi, denendi ve
> geri alındı — harita geneli ambiyans zaten orman taşıyor ve bu haritanın
> koruları vahşi orman değil. Satır silinmedi; *üretilip reddedildiği* yazıldı,
> çünkü bir sonraki denetimde "orman neden yok" sorusunun cevabı burada aranır.

| # | Dosya | Yer (oyundaki karşılığı) | İçerik |
|---|---|---|---|
| 1 | ~~`amb_zone_forest_01.ogg`~~ ⛔ | ~~Ağaç kümeleri, `lumber_camp`, `timber_camp`~~ | **Kaldırıldı, §82.15** |
| 2 | `amb_zone_river_01.ogg` | Nehir ve `river_port` ticaret sahası | Yumuşak akan su, kıyı çakılında hafif hareket, seyrek su kuşu |
| 3 | `amb_zone_settlement_01.ogg` | `command_center` + `house` kümesi | Uzak çalışma, seyrek çekiç, tahta/kapı, çok uzak insan uğultusu (kelime yok) |
| 4 | `amb_zone_market_01.ogg` | `market` | Çok düşük insan uğultusu, hafif tahta sandık ve terazi, seyrek madeni para |
| 5 | `amb_zone_quarry_01.ogg` | `quarry`, `stone_pit` ticaret sahası | Seyrek metal-taş vuruş, moloz kayması, taş tozu hissi |
| 6 | `amb_zone_goldmine_01.ogg` | `gold_mine` | Kapalı/oyuk akustik, seyrek kazma, uzak damla |
| 7 | `amb_zone_farmland_01.ogg` | `farm`, `windmill`, `pasture` | Rüzgârda ekin, uzak hayvan (seyrek), değirmen ahşabının yavaş gıcırtısı |

**§26'nın köprü satırı listeye alınmadı:** bu haritada köprü varlığı yok — kodda
geçen "bridge" yalnız yol grafiğinin terimi. Bir köprü authored edildiği gün
eklenir.

### İndi — 23 Ağustos 2026

Yedi klip de üretildi ve kanca aynı gün yazıldı. Sevk edilen ölçüler: **mono,
48 kHz, 26.00 sn**, ~700 KB each (toplam 4.8 MB). Süre şartnamenin 30–45 sn
bandının biraz altında; sonucu loop noktasının daha sık gelmesi, ve bu ancak
maçta duyularak yargılanır.

Kanca `src/game/rts/audio/rtsZoneAmbience.ts` (saf tablo + çapa çözümü) ile
`RtsApp.updateZoneAmbienceAudio` (yatağı başlatan/durduran) arasında bölündü —
`structure.fire_loop`'un deseni: `played` dönmeden çapa sahiplenilmiyor,
durdurma **başlatılan id** ile yapılıyor, tek instance.

Karara bağlanan altı şey:

- **Olay adları `world.zone_*`**, `ambience.zone_*` değil. Editör kataloğu
  tabloyu id önekine göre grupluyor ve bunlar §5.8 — `world.ambience` ile aynı
  kanal. Yeni bir önek, COMBAT'ınkinin yanına ikinci bir istisna koymak olurdu.
- **Aynı anda tek yatak.** Kasabayla pazarın arasındaki bir kamera ikisini birden
  çalardı, ve üçüncü bir yatağın (`world.ambience`) altındaki iki yatak iki yer
  değil bir bulamaçtır. En yakın bölge kazanıyor — zaten oyuncunun baktığı yer o.
- **İki yarıçap, biri diğerinden geniş** (45 giriş / 62 çıkış). Tek yarıçapla
  sınırda park etmiş bir kamera yatağı bir kare açıp bir kare kapatır, ve bir
  bölgenin kenarı tam da oyuncunun durup baktığı yerdir. §35'in müzik durum
  makinesi aynı asimetriyi aynı sebeple taşıyor.
- **Maç duraklatılınca susmuyor.** `updateBuildLoopAudio`'nun çekiç için verdiği
  gerekçe burada tersine dönüyor: donmuş bir tarlanın üstündeki çekiç yalan,
  ama koru duraklatınca koru olmaktan çıkmıyor. Yatak ambiyansı ve müziği
  izliyor, işi değil.
- ~~**Korunun çapası ağaçlarının ağırlık merkezi**~~ — koruyla birlikte gitti
  (§82.15). Gerekçesi nehirde yaşıyor: bir yeri en yakın *parçasına* bağlamak,
  o parça değiştikçe yürüyen bir yatak demek.
- **`stream: true`**, mevcut sözleşmeye uyarak. `test:engine` "ambience ya da
  music kanalındaki her yatak stream eder, ve yalnız oyuncunun *indiğini*
  duyduğu ses decode edilir" diye tutuyor; 26 sn'lik bir klip decode edilse
  ~5 MB RAM (yedisi 35 MB) demekti. Karşı taraf da gerçek: element yolunda loop
  dikişi duyulabilir. Bu bir **dinleme** sorusu — dikiş maçta duyuluyorsa
  sözleşme kanıtla gözden geçirilir, tek girdiyi istisna yapmakla değil.

**Çapalar** — hepsi maçın zaten sahip olduğu şeyler, elle yerleştirilmiş ses
işaretleri değil (bir işaret, ilkiyle senkron tutulacak ikinci bir harita olurdu):

| Zone | Çapa |
|---|---|
| ~~forest~~ | ⛔ kaldırıldı (§82.15) |
| river | landscape'in nehir spline'ı üzerindeki en yakın nokta (§82.15; ilk sürüm `river_port` idi) |
| quarry | `stone_pit` + dikilmiş `quarry` |
| goldmine | dikilmiş `gold_mine` |
| settlement | dikilmiş `command_center` (`house` değil — bir ev kasaba değildir) |
| market | dikilmiş `market` |
| farmland | dikilmiş `farm` / `windmill` / `pasture` |

`lumber_camp` bilerek yoktu (koruya dikiliyor, korunun çapasının yanında
dururdu) ve §82.15 koruyu kaldırınca `timber_camp` de listeden düştü.

Sözleşme testleri `--filter "zone ambience"` altında; bugünkü hâli §82.15'in
sonunda. Büyüklükler değil ilişkiler pinlendi — ayarlar oynayabilsin.

### Prompt şablonu

Her satır için §13.2'nin loop şablonuna şu çekirdek geçirilir:

```text
Create a seamless looping ambience bed for one location in a grounded medieval frontier real-time strategy game, heard as the camera moves near that place.

Location: <yukarıdaki satırın "Yer" sütunu>.
Content: <"İçerik" sütunu>.

Duration around 40 seconds, seamless loop, mono.

It must sit under a map-wide outdoor ambience and under gameplay sound effects: noticeable when the camera arrives, never the thing the player is listening to.

Keep every element sparse and irregular so no single element repeats on an audible cycle.

No music, no tonal drone, no melody, no close continuous birdsong, no intelligible speech, no cinematic swell, no reverb tail at the loop point.
```

## 82.14 Maçtan gelen rapor — "yere göre değil, sırayla çalıyor" (23 Ağustos 2026)

Kullanıcı §82.13'ü dinlemek için ortamı temizledi (diğer kanalları kapattı,
`world.ambience`'ı 0'a çekti, bölge yataklarını 1'e aldı) ve şunu bildirdi:
yataklar kameranın bulunduğu yere göre değil, **sırayla** çalıyor gibi.

Rapor doğruydu ve tek bir hata değildi. Üçü de aynı yöne itiyordu, o yüzden
kulakta tek bir arıza gibi duyuluyordu.

### 1. Mesafe gözden ölçülüyordu, kameranın baktığı yerden değil

`camera.position` yerde değil: pitch 55° ile 20–40 birim yukarıda ve geride
(`rtsCameraConfig`). Yani her bölge mesafesine zoom seviyesi ekleniyordu — aynı
noktada durup **zoom yapmak** bölge seçimini değiştirebiliyordu. Oyuncunun
"buradayım" derken kastettiği şey kameranın baktığı nokta, ve controller onu
zaten `focusX`/`focusZ` olarak veriyor.

Ölçüm artık zeminde ve odaktan; `Math.hypot` ile düzlemsel. Yan kazanç: statik
çapa başına kare başına bir `groundSurface.heightAt` çağrısı gitti — yükseklik
yalnız seçilen çapa için, tetiklerken bir kez örnekleniyor.

### 2. Yarıçaplar haritaya göre değil, tahminle seçilmişti

Ölçüm bunu tek satırda bitirdi. Sevk edilen blockout haritasının koruları:

| | |
|---|---|
| Koru sayısı | 6 |
| En yakın komşu | **27.5** birim |
| Oyuncunun başlangıcı → kendi korusu | **16.1** birim |

İlk yarıçaplar 45 giriş / 62 çıkış'tı. 62, bu haritada bir bölgenin *yarısını*
değil, komşularının birkaçını birden yutuyor: bir kez kasabayı alan yatak, kamera
haritanın öbür ucuna gidene kadar bırakmıyor. Dışarıdan bakınca bu tam olarak
"yere göre değil sırayla çalıyor" gibi duyuluyor — çünkü yatak *bir yere
varınca* değil, **öncekinden yeterince uzaklaşınca** değişiyor.

Şimdi 18 giriş / 25 çıkış, ve çıkış yarıçapı haritanın en dar çapa aralığının
altında tutuluyor. Bu bir test olarak pinlendi ve pinlendiği gün işe yaradı: ilk
düzeltme 30 seçmişti, test onu 27.5'e karşı reddetti.

### 3. Devralan bölge koşulsuz tutuluyordu

Birinci sürümün kuralı "incumbent hâlâ çıkış yarıçapındaysa onu döndür" idi.
Küçük bir haritada bu, "sonsuza kadar tut" ile aynı şey. Kural sıraya bağlandı:

1. **Giriş yarıçapındaki en yakın bölge kazanır** — bir yere varmak anında
   cevaplanır;
2. *ancak* devralan, çıkış yarıçapı içindeyken ve başkası **belirgin biçimde**
   daha yakın değilken yatağı korur;
3. yoksa yatak yok — iki yerin arası bir yer değildir, ve altta `world.ambience`
   zaten çalıyor.

"Belirgin" üçüncü bir sabit değil, **iki yarıçapın arasındaki boşluk**. Aynı
gevşeklik iki farklı çırpınmayı birden kapatıyor: sınırda park etmiş kamera
(devralan boşluğu köprüler) ve iki bölgeye neredeyse eşit uzaklıkta duran kamera
(devralan, öteki tam bir marj kadar yakın olana dek kazanır). §82.10'un gıcırtı
eşiğiyle aynı ders: iki sayı yerine bir sayı ve ondan **türetilen** bir marj.

### Testin öğrendiği

Bir kontrol de bu turda geri alındı: bölge yatağının seviyesi `world.ambience`'ın
**altında** olmalı diye yazılmıştı. Kullanıcının ilk dinleme oturumu tam tersini
yaptı — dünya yatağını sıfırlayıp bölge yataklarını 1'e aldı — ve o kontrol bunu
regresyon diye rapor etti. Seviye ayardır; pinlenen şey artık yalnız şekil (tek,
konumlu, loop) ve **ilişkiler** (çıkış > giriş, erişim ≤ `maxDistance`, çıkış ≤
en dar çapa aralığı).

## 82.15 Koru kaldırıldı, nehir kendi çizgisine bağlandı (23 Ağustos 2026)

İkinci dinleme oturumu. Kullanıcı altı yatağın beşini onayladı, birini reddetti
ve birine daha iyi bir çapa önerdi. İkisi de aynı cinsten karar: **yatak, orada
olan şeyi anlatmalı.**

### Koru yatağı geri alındı — varlık ve mekanizma birlikte

Gerekçe iki parçaydı ve ikincisi asıl olan: **(1)** harita geneli ambiyans zaten
orman taşıyor, yani yatak ikinci bir kat oluyordu; **(2)** bu projenin koruları
vahşi orman değil, dikilmiş ağaç kümeleri — üzerlerine vahşi doğa sermek orada
olmayan bir şeyi anlatıyordu.

Kaldırılan: `amb_zone_forest_01.ogg`, manifest kaydı, `world.zone_forest` olayı,
`forest` bölge türü, koru ağırlık merkezi hesabı, ve `timber_camp` ticaret
sahasının eşlemesi. Bu §82.13'ün yedi yatağını **altıya** indiriyor.

Not, ses değil **çapa mekanizması** da gittiği için yazılıyor: koru merkezi
`rtsStaticAmbienceAnchors`'ın tek dinamik hesabıydı ve onunla birlikte
§82.14'ün "en dar çapa aralığı" testi de dayanağını kaybetti (o test koruların
27.5 birimlik aralığını okuyordu). Yarıçaplar 18/25'te kaldı — ölçüm hâlâ
geçerli, ölçtüğü şey artık listede yok.

### Nehir bir nokta değil, bir çizgi

Kullanıcının gözlemi doğruydu ve veriye kadar takip edildi: nehir landscape
üzerinde bir spline'a oturtulmuş bir çukur, ve o spline runtime'da okunabiliyor.

Yol **iki yerde yarım** authored ve ikisi de tek başına yeterli değil:

| Nerede | Ne taşıyor |
|---|---|
| Level'ın `riverWaters[0]` | su yüzeyi (opaklık, köpük, yansıma) + `splineRef`, `landscapeRef` |
| Landscape sidecar'ın `splines[]` | asıl çizgi — terrain'e kazınan oluk, 6 nokta |

Yani `riverWaters` **hangi** spline'ın nehir olduğunu söylüyor (yol değil, çit
değil), çizgiyi Landscape veriyor. Çözüm ikisini birleştiriyor:
`resolveRtsRiverPaths` (`src/game/rts/world/rtsRiverPaths.ts`), Landscape mount
olduğu anda — yani zemin yüzeyinin gerçek olduğu aynı anda — bir kez.

Çözülen çizgi haritayı çaprazlıyor:

```text
(-67.7,-67.1) → (-46.3,-31.4) → (-13.6,-18.5) → (12.5,20.4) → (48.3,38.4) → (66.8,66.5)
```

**Çapa artık kameranın baktığı noktaya en yakın *nehir üstü* nokta.** Ölçülen
örnekler: harita merkezinde (0,0) nehir 1.0 birim ötede, (12,20)'de 0.2, oyuncu
üssünde (-38,38) ise 51.7 — yani üste yatak yok, ve olmaması doğru.

Üç şey uygularken çıktı:

**1. Nokta değil, doğru parçası üzerine izdüşüm.** Nehir 6 noktayla ~190 birim
gidiyor, yani en yakın *köşe* kıyıda oturan bir kameradan onlarca birim uzakta
olabilir. Snap yerine segment izdüşümü; testte iki uçtan da pinlendi (ortada
kayar, uçta kırpılır).

**2. Nokta listesi sıralı değil, segmentler sıralı.** `points` bir küme, gerçek
sıra `segments`'in `startPointId`/`endPointId` zincirinde. Listeyi authored
sırada okumak bugün doğru sonuç veriyor ama editörde nehrin ortasına bir nokta
eklendiği gün — o nokta listeye *sona* eklendiği için — nehir kendi üstüne
katlanırdı. Zincir yürünüyor, ve yürüyüş noktaların hepsini tüketmezse authored
sıraya düşülüyor.

**3. Tek çapa id'si, kayan bir nokta.** Nehir boyunca ilerlerken yatak yeniden
oturuyor ama aynı olay: `RTS_RIVER_AMBIENCE_ANCHOR_ID` her nokta için aynı —
bir nehir, ne kadar uzun olursa olsun, bir yer. Bu da devralan-mesafesi
kuralında bir düzeltme gerektirdi: mesafe artık **yatağın konduğu noktadan**
ölçülüyor, o bölgenin şu an en yakın olduğu noktadan değil. `AudioPlaybackHandle`
taşınamıyor (§82.9), yani yatak başladığı yerden çalıyor — ve yarıçapın
cevapladığı soru tam olarak "o ses hâlâ tutulacak kadar yakın mı".

**`cooldownMs` 0'a indi** (altı yatağın hepsinde). Yeniden oturma, aynı olayı
aynı karede durdurup başlatmak demek: `stop()` instance'ı hemen serbest
bırakıyor, yani 0 ile bu bir crossfade, herhangi bir başka değerle bir delik.
Bu olayları başka hiçbir şey tetiklemiyor — kontrol edilecek bir tekrar yok.

### Bir latent hata, kapsam dışı bırakıldı

`rtsLevelAdapter`'ın rota çözümü spline actor'ünün **dönüşünü yok sayıyor**
(`spline.position[i] + p.position[i]`). Sevk edilen rotaların hepsi
position `[0,0,0]` ve rotation yok, o yüzden bugün ısırmıyor — ama nehir
spline'ı `rotation: [0,-61,0]` taşıyor ve aynı okumayı yapan ilk deneme onu
haritanın dışına koydu. Nehir kendi yolunu Landscape sidecar'ından okuyor
(orası yerel koordinat + terrain konumu), yani bu düzeltmeye ihtiyaç duymadı.
Rota çözümüne dokunulmadı: orası AI navigasyonu, ve bu oturumun konusu değildi.

## 82.16 Ducking indi — dört sebep, üç mekanizma (24 Ağustos 2026)

§9'un "ducking önerisi" ve §52'nin iki kutusu, planın en uzun süre **yazılı ama
çalışmayan** maddesiydi. `MENU_DUCK_MIX` ve `NOTIFICATION_DUCK_MIX`
`engine/audio/audioBus.ts` içinde v1.1'den beri duruyordu, testleri bile vardı —
ve tüm projede **sıfır çağrı yeri**. Bir sabitin doğru tanımlanmış olması onun
uygulandığı anlamına gelmiyor, ve bunu yakalayan şey bir test değil, sabitin
adını arayan bir denetim oldu.

### Ducking bir seviye değil, bir çarpan

Bulunduğu hâliyle inseydi mix'i bozardı. Sabitler **mutlak bus seviyesi** olarak
yazılmıştı (`ambience: 0.3`) ve §58 aradan geçip miksi tabloya taşıdı: bu oyun
`ambience`'ı **0.22**'de yazıyor. Duraklat menüsünde ambiyansı 0.3'e "kısmak",
onu %36 **yükseltmek** olurdu — duck, kıstığı şeyin en gürültülü hâli.

O yüzden model §58.1'in slider modeliyle aynı şekle getirildi:

```text
etkin bus kazancı = yetkili mix (events.json) × oyuncu çarpanı × duck çarpanı
```

Üç katman da çarpan, ve hiçbiri diğerini ezmiyor: tablo yeniden ayarlanınca
`music: 0.6` hâlâ "niyet edilenin altıda beşi" demek.

### Dört sebep

| Sebep | Ne kısılır | Neden bu derinlik |
|---|---|---|
| **Duraklat** | müzik, ambiyans, sfx, voice | Oyuncunun kendi açtığı menü — dördün en derini olabilir |
| **Kritik bildirim** (yalnız `alert`) | müzik, ambiyans, sfx | Alarm kazanmalı; `info` da kıssaydı mix dakikada birkaç kez nefes alırdı |
| **Voice hattı** | sfx, ambiyans (hafif) | §9 "çok hafif" diyor; bir replik dakikada birkaç kez geliyor |
| **Stinger** | ambiyans, sfx — **müzik değil** | Aşağıdaki tuzak |

### Stinger kendi bus'ını kısamaz

§5.11 stinger'ları **`music` bus'ına** yolluyor, ve bu bilinçli: skorla birlikte
yazılıyorlar, müziği susturmuş oyuncu onları da duymak istememiştir. Aynı
yönlendirme bu duck için bir tuzak: "fanfarın altında müzik geri çekilsin" diye
müzik bus'ını kısmak, **fanfarı da kısar**.

O yüzden üçüncü mekanizma: `MusicDirector.setDuck()`. Yatağın kendi handle
kazancı, bus'a hiç dokunmadan. Sabit ikiye bölündü — `STINGER_DUCK_MIX`
(dünya, bus üzerinden) ve `STINGER_MUSIC_BED_DUCK` (yatak, director üzerinden) —
ve testte pinlenen şey büyüklükler değil, `STINGER_DUCK_MIX`'in `music`
**adlandırmadığı**.

Yatak duck'ı fade ile yazılıyor ve yükselmekte olan bir parçaya **hiç
yazılmıyor**: o parçanın kazancını `stepFadeIn` sürüyor, araya yazmak onu
eğrisinden atlatır — geçişin ortasında bir tık. Duck yalnız fade'in *hedefini*
değiştiriyor, o yüzden crossfade ducklanmış hâlde bile equal-power kalıyor
(testte: ducklanmış geçişin gücü `volume × duck`).

### İki duck aynı anda: çarpım değil, minimum

Bir replik sırasında gelen bir alarm `sfx`'i 0.8 × 0.7 = 0.56'ya indirirdi —
ikisinin de istemediği bir derinlik, ve hangisi önce biterse orada bir sıçrama.
`mergeDucks` **minimum** alıyor: iki sebep bir bus'ın daha sessiz olması için iki
gerekçedir, iki kat sessiz olması için değil. Minimum ayrıca sıradan bağımsız,
yani mix karenin duck'ları hangi sırada gördüğüne bağlı değil.

### Duck ne kadar sürer: tahmin değil, sesin kendisi

Bir duck'ı **açan** şey tetikleyici (yalnız orası bildirimin kritik olduğunu ya
da konuşanın bir birim olduğunu bilir), **kapatan** şey ise sesin bitmesi.
Zamanlayıcı ile kapatmak iki yönde de yanlış: kısa tutarsan mix repliğin ikinci
yarısının altında geri geliyor, uzun tutarsan sessizliğin üstünde asılı kalıyor.

Bunun için director'a tek bir okuma eklendi — `isPlaying(eventId)`. Sözleşmeyi
bozmuyor: çağıran hâlâ handle'a erişemiyor, durduramıyor, ne çaldığını
okuyamıyor; yalnız *bitip bitmediğini* sorabiliyor. Duck sesini en fazla bir
kare aşıyor (`advance()` karede bir eliyor).

Duraklat duck'ı bu listeye girmiyor: o sesten değil **durumdan** sürülüyor ve
her kare `flow.phase`'den yeniden hesaplanıyor — `syncAudioBedsPaused`'ın kendi
notunda yazdığı sebeple, duraklatmanın birden fazla girişi var ve birinde
kaçırılan kanca miksi çalışan bir maçın üstünde kısık bırakır.

### Aşağı hızlı, yukarı yavaş

`AUDIO_DUCK_ATTACK_SECONDS = 0.08`, `AUDIO_DUCK_RELEASE_SECONDS = 0.45`. Asimetri
duck ile pump arasındaki farkın kendisi: inişin, kendisini isteyen sese
yetişmesi gerekiyor; çıkışın böyle bir randevusu yok, ve inişle aynı hızda
çıkmak mix'i her bildirimde nefes alır hâle getirir. Yavaş çıkış ayrıca art arda
gelen iki duck'ı tek bir kademe gibi duyuruyor.

### Kalan

Bu bölüm §9'un üç öneri satırının üçünü de karşılıyor. Kalan iki polish maddesi
(final loudness pass, browser codec testi) ses üretimi ve tarayıcı testi işi,
kod işi değil — ve derinliklerin doğru olup olmadığı **maçta dinlenerek**
yargılanacak: hepsi `audioBus.ts`'te tek satırlık ayar, testler yalnız ilişkiyi
tutuyor (duraklat > maç içi ducklar, hiçbiri `notifications`'ı kısmıyor).

## 82.17 Kalan üretim: iki klip (24 Ağustos 2026)

Faz 5'in B kovasında ses üretimi bekleyen **iki** kalem kaldı. İkisi de kanca
istemiyor: biri saf tablo, diğeri tabloya tek alan.

### 1. `notify.age_up` ×1 — çağ atlama bildirimi

§82.11 madde 2'nin kararı: tek klip, iki bildirim türü de onu çalıyor. Bugün
`age-upgraded` ve `enemy-age-upgraded` info/warning tier'ına düşüyor.

```text
Create a short notification cue for a medieval frontier strategy game, announcing that a kingdom has advanced to a new age.

A brief, bright metallic bell-like accent with a soft low body under it, ringing once and settling. It reports news; it is not a fanfare — the player's own age-up already has a musical stinger over it.

Duration around 0.8 to 1.2 seconds, with a clean tail that does not ring on.

No music, no melody, no chord progression, no voice, no cinematic riser, no long reverb.
```

**İndiğinde:** klasöre koy → `npm run audio:manifest` → `events.json`'a
`notify.age_up` girdisi → `RTS_NOTIFICATION_KIND_AUDIO_EVENTS`'e iki satır
(`age-upgraded`, `enemy-age-upgraded`, ikisi de aynı olayı adlandırıyor).

### 2. Archer "dur" VO ×3 — `voice.archer_stop`

§40'ın stop repliği hiç kaydedilmedi, ve sonucu bugün duyulabilir bir boşluk:
yalnız okçu seçiliyken **X sessiz**. Guard'ın karşılığı var, Worker duruş emri
almıyor, yani sıradaki konuşacak kimse yok. §47.0'ın Guard profili referans;
okçu daha genç ve daha az resmî.

```text
English male voice line for an archer in a grounded medieval frontier strategy game, acknowledging an order to stop and stand down.

Short, calm, slightly younger and less formal than a line infantry sergeant. Spoken at working distance, not shouted, not whispered.

Lines: "Holding here." / "Stopped." / "As you say."

Dry recording, no reverb, no music, no crowd, no accent affectation.
```

**İndiğinde:** klasöre koy → `npm run audio:manifest` → `events.json`'a
`voice.archer_stop` → `RTS_AUDIO`'ya `archerStop` + `RTS_UNIT_VOICE_LINES`'ın
archer bloğuna `stop:` alanı. `RtsApp.ts` açılmıyor.

### Bunlar dışında kalan üretim kalemi yok

Diskte çalmayan dokuz klip var ve hepsi bilinçli: `sfx_building_complete_01/02/04`
(§82.7 — tamamlanma tek imza sesi, diğerleri manifestte *seçenek*),
`sfx_ui_hover_02/03` (§82.6 — hover tek klip, varyant "altı farklı kontrol" diye
duyuluyor) ve `sfx_ui_panel_open/close_02/03` — sonuncular için yazılı bir karar
yoktu; **kural hover'ınkiyle aynı**: panel açılışı tekrar eden ve kısa aralıklı
bir kontrol sesi, varyant onu çeşitlilik değil tutarsızlık yapar. Seçenek olarak
duruyorlar.

**Tier 3'ün "yapı idle sesleri"** (§44) hiç bağlanmadı ve bir olayı yok
(`building.build_loop` şantiye, `structure.fire_loop` yangın — ikisi de idle
değil). Kapsam kararı verilmedi; verildiğinde §82.11'in yanına yazılır.
