# Ev Ustası — 02 Mechanics

> Durum: taslak | Versiyon: 0.1 | Tarih: 2026-06-12 | Bağımlı: 01-core-loop.md, 03-economy.md, 04-content.md, balance/parameters.md

Her mekanik bağımsız test edilebilir bir sistem sınırıdır (00-overview, ders L11). Format: tetik → kural → geri bildirim → edge case'ler. Tüm sayısal değerler `balance/parameters.md`'de belirlenecek (systems-balancer); burada yalnız biçim ve kural yazılır.

## M1 — "Job Board" ve müşteri kartı

- **Tetik:** Oyun açılışı (yarım iş yoksa) ve her teslim sonrası; oyuncu board'dan iş kartına dokunur.
- **Kural:** Board'da sınırlı sayıda iş kartı (sayı → `balance/parameters.md`). Kart içeriği: ev küçük resmi, müşteri portresi + adı, **görünür zevkler** (stil etiketi + renk etiketi veya quirk; 04-content), **"?" gizli dilek** yuvası, taban ödeme, yıldız hedefi. İşler toplam yıldızla kademelenir (mahalle kilitleri — M8). Kart seçilince ev sahnesi yüklenir (GLB lazy-load — tech-architect), iş CLEAN fazında başlar.
- **Geri bildirim:** Kart dokununca büyür + müşteri selamlama balonu ("Make it cozy, please!" — metinler 04-content). Yüklenirken board kapanmaz; sahne hazır olunca yumuşak geçiş.
- **Edge case'ler:**
  - Board asla boş kalamaz: her an oyuncunun mevcut katalogla 3 yıldız alabileceği en az bir iş bulunur (üretim kuralı → `balance/parameters.md`).
  - Aynı işi tekrar oynama ("Redecorate"): yıldız iyileştirme serbest; ödeme tekrarında kısıntı (formül 03-economy) — para farm'ı kapalı, yıldız avı açık.
  - Yarım kalan iş varken board'a dönüş: iş kartı "Continue" rozetiyle en üstte; oda durumu korunur (M9).
  - Kart içerikleri deterministik üretilir (arketip + ev tipi eşleşme havuzu, 04-content); saçma kombinasyon (mutfak işinde "yatak ister" quirk'i) havuz kurallarıyla engellenir.

## M2 — Temizlik (sürt-sil + çöp)

- **Tetik:** CLEAN fazı; oyuncu parmağını kir decal'i üzerinde sürter veya çöp nesnesine dokunur.
- **Kural:** Her kir decal'inin bir sürtme bütçesi vardır (parmak altında geçen mesafe/süre; değer → `balance/parameters.md`); bütçe dolunca decal tamamen silinir. Çöp nesneleri tek dokunuşla toplanır. Faz ilerlemesi = temizlenen / toplam; %100'de PAINT'e geçiş önerilir. Temizlik, puanın "Cleanliness" bileşenini doldurur (M5) — bu yüzden atlanamaz. Alet upgrade'leri (M7) sürtme bütçesini düşürür / fırça yarıçapını büyütür.
- **Geri bildirim:** Kir, parmağın altında **gerçek zamanlı** (≤ 100 ms) silinir (maske/decal tekniği — tech-architect); köpük + parıltı partikülü, pitch varyasyonlu "squeak" sesi. Çöp: pop + kavisli uçuş + çöp kutusu "thunk". Her decal bitişinde mini parıltı patlaması; faz bitişinde "Sparkling!" flaşı + oda aydınlanması (ışık sıcaklığı artar — 06-juice).
- **Edge case'ler:**
  - Piksel avı yasak (L12): kalan kir sayacı HUD'da; son 1–2 kir kaldığında dokunulmamış decal'e yönlendiren yumuşak ok/parıltı.
  - Kir asla mobilyanın arkasına saklanamaz: CLEAN fazında oda yerleştirilebilir mobilyasızdır (yalnız sabit demirbaş); tüm decal'ler mevcut kamera açılarından erişilebilir yerleşir (içerik kuralı, 04-content).
  - Kir olmayan yüzeyde sürtme zararsızdır (yanlış negatif yok); iki decal'i tek harekette sürtmek ikisini de işler.
  - Çok hızlı sürtmede frame atlaması decal'de delik bırakmamalı (sürekli çizgi örnekleme — tech-architect notu).

## M3 — Boyama ve yüzeyler

- **Tetik:** PAINT fazı; oyuncu tepsiden swatch (renk/doku) seçer, sonra duvar yüzeyine veya zemine dokunur.
- **Kural:** Yüzeyler bölge bazlıdır (duvar yüzü, zemin; tek tek karo değil — casual sadelik). Dokunulan bölge seçili swatch ile anında dolar. İş içinde yeniden boyama **sınırsız ve bedava** (deneme teşviki). Sahip olunan swatch'lar kullanılır; yenileri katalogdan açılır (M7). Renk, puanın "Color match" bileşenine girer (M5); müşterinin renk etiketiyle eşleşme/çatışma anında tepki üretir.
- **Geri bildirim:** Rulo süpürme animasyonu yüzey boyunca akar + boya damlası partikülü + "roll" sesi; bitince yüzey hafif parlama. Renk eşleşirse müşteri tepkisi + "Color +X" etiketi; çatışırsa surat + "-X" (kaldırılabilir/değiştirilebilir, ceza kalıcı değil).
- **Edge case'ler:**
  - Aynı rengi tekrar uygulamak no-op'tur (tepki/ses spam'i yok).
  - Renk körlüğü desteği: swatch'larda renk adı etiketi ("Sage Green") — eşleşme adla da okunur.
  - Gizli dilek renk olabilir; doğru renk uygulanınca "Hidden Wish" açılır (M5).
  - Boyanamaz yüzey yok kafa karışıklığı yok: PAINT fazında boyanabilir bölgeler hafif kontur taşır (L12).

## M4 — Mobilya yerleştirme (grid-snap hayalet)

> UX kararı (mobile-first gerekçeli): **serbest yerleştirme değil, kaba grid + çapa snap'i.** Küçük ekranda piksel hassasiyeti ve serbest rotasyon kullanıcıyı yorar; House Flipper'ın PC kontrolü buraya taşınamaz. Snap, "her bırakış düzgün durur" garantisi verir — beceri testi değil zevk testi oynatıyoruz. Alternatifler (tam serbest, yalnız slot tabanlı) açık sorularda gerekçesiyle reddedildi.

- **Tetik:** FURNISH fazı; oyuncu alt tepsiden (kategori karuseli) bir eşyaya dokunur.
- **Kural:**
  - Dokunulan eşyanın **hayaleti** oda merkezinde belirir, zemine grid-snap'li (hücre boyutu → tech-architect + `balance/parameters.md`). Tek parmak sürükleme hayaleti taşır; bırakınca geçerliyse yerleşir.
  - Üç çapa tipi: **zemin grid'i** (mobilya), **duvar çapaları** (raf/tablo — duvar boyunca kayar, yükseklik sabit), **yüzey çapaları** (masa/tezgâh üstü küçük eşya — Food Kit propları).
  - Geçerlilik: ayak izi hücreleri boş + kapı/pencere bloke bölgeleri dışında. Geçerli = yeşil hayalet, geçersiz = kırmızı; geçersizde bırakma **iptal etmez**, hayalet ayarlamaya açık kalır.
  - Döndürme: hayalet seçiliyken ekran butonu, 90° adımlar; duvar kenarına snap'lenen eşya otomatik duvara döner (akıllı varsayılan).
  - Yerleşmiş eşyaya dokunma = seç: taşı / döndür / "Store" (tepsiye geri — eşyalar tüketilmez, sahiplik kalıcıdır M7).
- **Geri bildirim:** Yerleşme: squash-stretch pop + toz halkası + "thud" sesi + ≤ 0,5 sn içinde müşteri tepkisi ve puan etiketi (M5). Geçersiz konumda kırmızı hayalet + engel hücreleri kısa vurgu. "Store": eşya tepsiye küçülerek uçar.
- **Edge case'ler:**
  - Cömert mıknatıs: bırakış geçerli hücreye yakınsa oraya çekilir (eşik → tech-architect); "az kaldı" hayal kırıklığı yok.
  - Oda başına eşya üst sınırı (performans + clutter; değer → `balance/parameters.md`); sınırda tepsi bunu söyler ("Room is full — store something first").
  - Sürükleme sahne kenarına gelirse kamera kaymaz (tek oda hep kadrajda — kamera kuralları 05-ux-ui); oda dışına bırakma son geçerli konuma döner.
  - Hayalet açıkken faz sekmesi değişirse hayalet sessizce tepsiye döner (kayıp yok).
  - Çift dokunma tek seçim sayılır (debounce).

## M5 — Zevk puanı ve canlı müşteri tepkisi (TWIST çekirdeği)

- **Tetik:** Oda durumunu değiştiren her eylem: kir bitişi, boya uygulaması, eşya yerleşimi/kaldırılışı.
- **Kural:**
  - İş puanı, **oda durumundan** yeniden hesaplanır (olay geçmişinden değil): `puan = Cleanliness + Comfort (temel eşyalar) + Style match + Color match + Quirk + Hidden Wish bonus − Clutter cezası`. Ağırlıklar ve formül biçimi 03-economy; değerler → `balance/parameters.md`.
  - Eşyalar stil/renk etiketleri taşır (04-content). Müşterinin sevdiği etiket eşleşmesi artı, nefret ettiği eksi yazar. Eksi yazan eşya kaldırılınca ceza **tamamen** silinir (Lens #30 Fairness).
  - **Canlı müşteri:** Müşteri karakteri FURNISH boyunca sahnededir (kapı eşiği/kenar); her puanlı eylemde tepki verir: kalp (sevdi), onay (nötr-olumlu), surat asma (sevmedi). Ara sıra sevdiği eşyaya yürüyüp bakar (doku animasyonu; kesilebilir — 08).
  - **"Hidden Wish":** Kartta "?" olan tek tercih; oyuncu eşleşen eşyayı/rengi koyunca açılır: "?" kalbe döner + bonus. Açılmadan teslim edilirse ceza yok, yalnız bonus alınmaz; teslim ekranı "A hidden wish was left undiscovered…" der (merak → "Redecorate" daveti, Lens #4 Curiosity). Rewarded ipucu: R3 (07-monetization).
- **Geri bildirim:** Her puan değişimi **nedeniyle birlikte** uçar: "Cozy +12", "Bookshelf! +20", "Clutter -8" — sayı asla çıplak gelmez (L9). HUD'daki **Taste Meter** kategori renkli segmentlerle dolar; segment dokununca kategori dökümü açılır. Müşteri tepkisi eşyanın üstünde belirir (kaynak-tepki eşleşmesi gözle kurulur). "Hidden Wish" açılışı küçük kutlama (parıltı + özel ses).
- **Edge case'ler:**
  - Koy-kaldır farm'ı imkânsız: durum bazlı hesap; aynı odaya aynı eşya = aynı puan.
  - Aynı eşyadan çok sayıda koymak azalan getiri taşır (tekrar katsayısı → `balance/parameters.md`); "5 saksı = 5× puan" sömürüsü kapalı.
  - Nefret tepkisi mizahi tonda kalır (dramatik ceza hissi yok — müşteri kırıcı değil "huysuz"); ceza büyüklüğü artıların ölçeğinden küçük (balance kuralı).
  - Tepki kuyruğu: hızlı ardışık yerleşimlerde tepkiler üst üste binmez, sıraya alınır; puan etiketleri ise anlıktır (gecikmeli sayı yasak — neden-sonuç anlıktır).
  - Müşteri karakteri yol bulamazsa (eşya kapıyı kapattı) ilerleme bloklanmaz: karakter olduğu yerden tepki vermeye devam eder; kapı bloke bölgesi zaten yerleşime kapalıdır (M4).

## M6 — Teslim ve ödeme

- **Tetik:** Asgari koşullar (Cleanliness %100 + odanın temel eşya listesi yerleşik — liste 04-content) sağlanınca aktifleşen "Deliver" butonuna dokunma.
- **Kural:** Teslim sekansı: kamera yavaş oda turu → önce/sonra karşılaştırma kaydırıcısı → puan dökümü panelinde kategoriler tek tek sayar → yıldız (1–3; eşikler → `balance/parameters.md`) → `ödeme = tabanÖdeme × (1 + puanBonusu)` (+ 3 yıldızda "tip" — formüller 03-economy). Ardından "Double Pay" rewarded teklifi (R2). Panel kapanıp board'a dönerken `commercialBreak` adayı tek an budur (07-monetization). Yıldızlar işin en iyi sonucu olarak saklanır; toplam yıldız ilerleme kapısıdır (M8).
- **Geri bildirim:** Konfeti + coin yağmuru + müşteri kalp patlaması; 3 yıldızda "Dream Home!" bandı + özel ses. Önce/sonra kaydırıcısı oyuncunun parmağıyla oynanabilir (tatmin anı uzatılabilir ama sekans atlanabilir — "Skip" hep var).
- **Edge case'ler:**
  - Nefret edilen eşya yerindeyken teslim engellenmez (Taste Meter zaten gösteriyor — bilgilendirilmiş karar, Lens #32 Meaningful Choices).
  - 1 yıldız bile pozitif ödeme verir (sıfır/negatif ödeme yok; en kötü iş bile ilerletir).
  - "Double Pay" reklamı yüklenemezse buton görünmez; ödeme normal akar.
  - Teslim sekansı sırasında girdi kilitli değildir: "Skip" ve panel butonları dışında dokunuşlar yutulur (yanlış dokunma sekansı bozmaz).

## M7 — Katalog, sahiplik ve aletler

- **Tetik:** Board ekranındaki "Catalog" butonu veya FURNISH tepsisindeki kilitli eşyaya dokunma.
- **Kural:** Eşyalar/swatch'lar coins ile **bir kez** satın alınır, kalıcıdır, tüm işlerde sınırsız kullanılır (House Flipper'ın iş-başına satın alma modeli bilinçli reddedildi: casual oturumda envanter muhasebesi istemiyoruz). Eşya kartı stil/renk etiketlerini gösterir (bilgilendirilmiş alım — Lens #32). Set paketleri ("Cozy Set") tekil toplamından ucuz. Aletler ayrı sink: "Big Sponge" (fırça yarıçapı), "Pro Roller" (boyama animasyon hızı), "Vacuum" (çöp toplu toplama) — temizlik eforunu düşürür (formüller 03-economy). Kategoriler "Design Rank" ile açılır (M8).
- **Geri bildirim:** Satın alma: eşya podyumda döner + parıltı + "purchase" sesi; tepside "New!" rozeti. Kilitli eşya dokununca fiyat + hangi rank'te açılacağı söylenir (sessiz kilit yok).
- **Edge case'ler:**
  - Softlock imkânsız: başlangıç seti ("Starter Set") her odanın temel eşya listesini karşılar ve asla satılamaz; her işte 3 yıldız, premium eşyasız da matematiksel olarak ulaşılabilir olmalı (**balance hedefi**, simülasyonla kanıtlanacak).
  - Kilitli premium eşyalar tepside görünür (özlem/hedef) ama yerleştirilemez; R1 "rent" rewarded'ı tek işlik deneme açar (07).
  - Para iadesi yok ama pişmanlık da yok: eşyalar tükenmez, yanlış alım bile kalıcı koleksiyona yazar.

## M8 — İlerleme: yıldızlar ve "Design Rank"

- **Tetik:** Her teslimde yıldız kazanımı; toplam yıldız eşiklerinde rank atlama.
- **Kural:** `Design Rank = f(toplam yıldız)` — tek ilerleme sayısı, ayrı XP yok (sadelik). Rank eşikleri (değerler → `balance/parameters.md`) sırayla açar: yeni mobilya kategorileri, yeni müşteri arketipleri, yeni mahalle/ev kademesi (04-content). Board'daki işler mevcut rank'e göre üretilir.
- **Geri bildirim:** Rank atlama: tam ekran kısa kutlama + rozet ("Interior Stylist!") + açılan içeriğin önizlemesi ("New: Lighting category!"). Board üstünde kalıcı rank rozeti + sonraki eşiğe ilerleme çubuğu.
- **Edge case'ler:**
  - Eski işleri "Redecorate" ile iyileştirmek rank'e sayılır (yalnız yıldız farkı eklenir — çifte sayım yok).
  - Rank hiçbir şeyi geri kilitlemez; tek yönlüdür.
  - Son rank'e ulaşan oyuncu için board iş üretmeye devam eder (sonsuz hafif içerik: arketip × ev tipi kombinasyonları) — MVP'de "bitti" duvarı yok, sadece yavaşlayan açılım.

## M9 — Kayıt sistemi (tasarım düzeyi)

- **Tetik:** Periyodik otomatik kayıt + her kritik olayda (faz geçişi, yerleşim, satın alma, teslim, çıkış/visibility değişimi).
- **Kural:** localStorage'da sürümlenmiş JSON; şema sürümü artınca migration zorunlu, sessiz silme yasak. İçerik: coins, toplam yıldız + iş başına en iyi yıldız, katalog sahiplikleri, alet seviyeleri, rank, board durumu, **yarım işin tam oda durumu** (silinen kir maskeleri, boyalar, yerleşik eşyalar, açılmış "Hidden Wish"), FTUE bayrakları, ses tercihi.
- **Geri bildirim:** Kayıt sessizdir. Bozuk/uyumsuz kayıt: oyun çökmez; kurtarılamıyorsa nazik "fresh start" ile FTUE'ye döner.
- **Edge case'ler:**
  - Yarım iş ortasında kayıt kaybı: oyuncu board'a temiz başlar; iş kaybı tek işle sınırlıdır (2–4 dk — kabul edilebilir yara).
  - Kir maskesi ham bitmap olarak saklanmaz (boyut); decal başına ilerleme yüzdesi yeter (görsel yeniden üretim — tech-architect).
  - localStorage erişilemez (gizli mod): bellek-içi devam, bir kez nazik bildirim.

## Açık sorular

- Grid hücre boyutu ile eşya ayak izlerinin uyumu (Kenney modellerinin gerçek boyutları) prototipte kalibre edilecek → tech-architect + `balance/parameters.md`.
- Müşteri karakterinin FURNISH dışındaki fazlarda sahnede olup olmayacağı (CLEAN'de izlemesi sevimli mi, dikkat dağıtıcı mı?) — dikey dilim playtest'i.
- "Hidden Wish" işin zorunlu tek "?"i mi, bazı işlerde 2 gizli yuva mı (geç oyun derinliği)? v0.1: her işte tam 1; design-critic'te tartışılacak.
- Tekrar katsayısı (aynı eşyadan çok koyma) ile "Minimalist" arketipinin clutter cezası çakışıyor mu — simülasyonla netleşecek.
- Reddedilen alternatiflerin kaydı (design-critic için): tam serbest yerleştirme (mobil hassasiyet + çarpışma öngörülemezliği), yalnız slot tabanlı (Redecor'laşma — yerleştirme hazzı ve twist'in "nereye koydun" boyutu ölür). Grid-snap orta yol; gate'te sorgulanabilir.
