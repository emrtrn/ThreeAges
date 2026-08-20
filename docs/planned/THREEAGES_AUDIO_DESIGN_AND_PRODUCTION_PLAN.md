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
| **Faz 1** | Placeholder seslerle uçtan uca hat (starter-content klipleri, notify + notification kancaları) | 🔨 | Maçta ses duyuluyor; cooldown, instance limiti ve mesafe kesmesi çalışıyor |
| **Faz 2** | Package 1 üretimi (Firefly 12 SFX → Settlement müziği → Guard VO), §70/§71/§72 sırasıyla | ⬜ | Gate B (§45, §46) |
| **Faz 3** | Stil kilidi (§47) + üretim kaydı (§63) | ⬜ | 7 stil-kilidi maddesi onaylandı |
| **Faz 4** | Müzik durum makinesi + crossfade (§28, §35) | ⬜ | Durum geçişleri maçta duyuluyor, sinyal kaynağı tanımlı |
| **Faz 5** | Paket 2–4 (UI/notification/ekonomi → yapı/lojistik → birim/savaş) | ⬜ | Gate C (§67) |
| **Faz 6** | Paket 5 (ambience + müzik) | ⬜ | Gate C |
| **Faz 7** | Paket 6 polish + mix + erişilebilirlik slider'ları (§62) | ⬜ | Gate D |
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

Kazanç şu: Faz 2'de üretilen her varlık, üretildiği gün oyunda dinlenebilir. §46'nın
test senaryosu ve §47'nin stil kilidi ancak böyle gerçek bir gözlem olur.

### Progress Log

| Tarih | Ne yapıldı |
|---|---|
| 2026-08-09 | v1.0 — Audio Bible, envanterler, prompt sistemleri, paketler ve kabul kapıları yazıldı. |
| 2026-08-20 | Kod envanteri çıkarıldı (§79). Boşluğun ses varlıklarında değil **entegrasyon hattında** olduğu görüldü: engine'de bus, spatial subsystem ve SoundCue editörü hazır, RtsApp'te tek satır audio yok. |
| 2026-08-20 | v1.1 — §58 şeması runtime'a bağlandı, §59 bus kararı verildi, SoundCue/event tablosu iş bölümü (§80) yazıldı, dosya adı harf durumu ve lokalizasyon bağı eklendi, faz tablosu açıldı. |
| 2026-08-20 | Faz 0 uygulandı: `voice` + `notifications` bus'ları eklendi, `engine/audio/audioEventTable.ts` (şema + director) yazıldı, `public/game-data/audio/events.json` açıldı, RtsApp'e `AudioSubsystem` mount edildi (listener pozu + autoplay kilidi + notify/notification kancaları). |

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
| `SFX-WRK-004` | Worker pickaxe stone |
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
| `MUS-001` | `mus_menu_frontier_01.ogg` | Menü |
| `MUS-002` | `mus_gameplay_settlement_01.ogg` | Sakin ekonomi |
| `MUS-003` | `mus_gameplay_expansion_01.ogg` | Genişleme |
| `MUS-004` | `mus_gameplay_tension_01.ogg` | Tehdit |
| `MUS-005` | `mus_gameplay_battle_01.ogg` | Savaş |
| `STG-001` | `stg_age_up_01.ogg` | Çağ |
| `STG-002` | `stg_victory_01.ogg` | Zafer |
| `STG-003` | `stg_defeat_01.ogg` | Yenilgi |

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

## UI

- [ ] UI click ×3
- [ ] UI confirm ×2
- [ ] UI error ×2

## Building

- [ ] Building placement ×2
- [ ] Construction hammer ×3
- [ ] Building complete ×2

## Combat

- [ ] Sword swing ×3
- [ ] Sword hit ×4
- [ ] Bow release ×3
- [ ] Arrow impact ×3
- [ ] Cannon fire ×3
- [ ] Cannon stone impact ×3

## Logistics

- [ ] Logistics disconnected ×2
- [ ] Logistics restored ×2

## Ambience

- [ ] Frontier day ambience ×1 seamless loop

## Music

- [ ] Settlement gameplay track ×1

## Voice

- [ ] Guard selection ×3
- [ ] Guard move ×3
- [ ] Guard attack ×2

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

- [ ] Tüm UI ailesi
- [ ] Population full
- [ ] Resource depleted
- [ ] Logistics disconnected
- [ ] Logistics restored
- [ ] Outpost attack
- [ ] Center attack
- [ ] Age-up
- [ ] Enemy age-up
- [ ] Regional victory warning
- [ ] Market buy
- [ ] Market sell
- [ ] Stock full
- [ ] Basic production interactions

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
- [ ] pickaxe
- [ ] death
- [ ] voice

## Guard

- [ ] footsteps
- [ ] sword
- [ ] shield
- [ ] impacts
- [ ] death
- [ ] voice

## Archer

- [ ] footsteps
- [ ] draw
- [ ] release
- [ ] arrow flight
- [ ] impacts
- [ ] death
- [ ] voice

## Artillery

- [ ] wheel
- [ ] carriage
- [ ] fire
- [ ] recoil
- [ ] cannonball
- [ ] stone hit
- [ ] wood hit
- [ ] destroyed

---

# 51. Paket 5 — ambience ve müzik

- [ ] Menu
- [ ] Settlement
- [ ] Expansion
- [ ] Tension
- [ ] Battle
- [ ] Age-up stinger
- [ ] Victory
- [ ] Defeat
- [ ] World base ambience
- [ ] River zone
- [ ] Forest zone
- [ ] Settlement zone

---

# 52. Paket 6 — polish

- [ ] Random pitch/gain
- [ ] Concurrent instance limits
- [ ] Cooldowns
- [ ] Distance attenuation
- [ ] Music crossfade
- [ ] Critical notification ducking
- [ ] Voice ducking
- [ ] Final loudness pass
- [ ] Browser codec test
- [ ] Asset preload policy
- [ ] Low-performance fallback
- [ ] Mobile kapsam dışı kontrol
- [ ] Full-match audio fatigue test

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

### Kural

Kritik bilgi yalnızca sesle verilmemelidir.

Lojistik kesildi gibi olaylar:

```text
audio + notification card + visual state
```

birlikte kullanılmalıdır.

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

## Gate B — Package 1

- [ ] UI dili onaylandı
- [ ] Combat yoğunluğu onaylandı
- [ ] Cannon sesi onaylandı
- [ ] Logistics uyarısı onaylandı
- [ ] Ambience onaylandı
- [ ] Settlement music onaylandı
- [ ] Guard voice onaylandı

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
- [ ] Audio klasör yapısını oluştur (§7) — ilk gerçek varlıkla birlikte, Faz 2
- [ ] Master/runtime formatını kesinleştir (§8) — tarayıcı testiyle, Faz 2

## Package 1 Firefly

- [ ] UI click
- [ ] UI confirm
- [ ] UI error
- [ ] Building place
- [ ] Construction hammer
- [ ] Building complete
- [ ] Sword swing
- [ ] Sword hit
- [ ] Bow release
- [ ] Arrow impact
- [ ] Cannon fire
- [ ] Cannon stone impact
- [ ] Logistics disconnected
- [ ] Logistics restored
- [ ] Frontier ambience

## Package 1 Gemini

- [ ] Settlement music

## Package 1 Voice

- [ ] Guard selection
- [ ] Guard move
- [ ] Guard attack

## Entegrasyon

- [ ] Audio event mapping
- [ ] Random variant
- [ ] Cooldown
- [ ] Max instances
- [ ] Spatial attenuation
- [ ] Music crossfade
- [ ] Package 1 test map

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
