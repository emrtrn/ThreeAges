# 01 — Core Gameplay Loop

> **Çalışma adı:** Üç Çağ: Sınır Krallıkları  
> **Doküman türü:** Game Design Document — Temel Oynanış Döngüsü  
> **Sürüm:** 0.1  
> **Durum:** İlk taslak  
> **Bağlı ana doküman:** `00_GAME_VISION_AND_PILLARS.md`

---

## 1. Dokümanın Amacı

Bu doküman, oyuncunun maç boyunca tekrar tekrar gerçekleştirdiği eylemleri, bu eylemlerin birbirine nasıl bağlandığını ve oyunun erken, orta ve geç aşamalarında oyuncudan hangi kararların beklendiğini tanımlar.

Bu dosya özellikle şu sorulara cevap verir:

- Oyuncu saniyeden saniyeye ne yapar?
- Oyuncunun kısa, orta ve uzun vadeli hedefleri nelerdir?
- Ekonomi, bölge kontrolü, lojistik ve savaş birbirine nasıl bağlanır?
- Maç ilerledikçe oynanış nasıl değişir?
- Oyuncu kötü bir başlangıçtan nasıl geri dönebilir?
- AI rakip, oyuncunun döngüsünü nasıl baskı altında tutar?
- Oyuncuya hangi geri bildirimler verilmelidir?
- Vertical slice içinde hangi döngüler mutlaka çalışmalıdır?

Bu belge sayısal denge değerlerini kesinleştirmez. Kaynak maliyetleri, üretim süreleri ve birim değerleri daha sonra `12_BALANCE_AND_GAME_DATA.md` içinde tanımlanacaktır.

---

## 2. Temel Oynanış Özeti

Oyuncu küçük bir sınır yerleşimiyle başlar. Yakındaki kaynakları keşfeder, işçileri üretime yönlendirir, yol ve depo bağlantıları kurar, karakollarla kontrol alanını genişletir, yeni gelişim seviyelerine ulaşır ve AI rakibin ekonomik ya da askerî baskısına karşılık verir.

Ana döngü:

```text
Keşfet
→ Kaynakları değerlendir
→ İşçileri görevlendir
→ Yapı ve yol kur
→ Üretimi lojistik ağa bağla
→ Kontrol alanını genişlet
→ Yeni teknoloji ve birlikler aç
→ AI hamlelerine tepki ver
→ Stratejik üstünlük kur
→ Zafer koşulunu tamamla
```

Bu döngü tek yönlü değildir. Oyuncu maç boyunca önceki aşamalara sürekli geri döner.

Örnek:

```text
Yeni bölge keşfet
→ Karakol kur
→ Yol çek
→ Depo kur
→ Kaynak üretimini başlat
→ Düşman baskınına uğra
→ Savunma birliği gönder
→ Yol bağlantısını onar
→ Üretimi yeniden çalıştır
```

---

## 3. Oyuncunun Temel Fiilleri

Oyuncunun oyunda doğrudan gerçekleştireceği ana eylemler aşağıdadır.

### 3.1 Seçmek

Oyuncu:

- tek bir birimi,
- bir grup birimi,
- bir yapıyı,
- bir kaynak noktasını,
- bir karakolu,
- bir yol segmentini,
- bir stratejik bölgeyi

seçebilir.

Seçim sistemi, tüm diğer komutların temelidir.

### 3.2 Hareket Ettirmek

Oyuncu asker ve işçileri seçilen konuma gönderir.

Hareket komutu şu amaçlarla kullanılır:

- keşif,
- kaynak alanına ulaşma,
- saldırı hazırlığı,
- savunma,
- geri çekilme,
- karakol veya yapı inşası,
- yeni bir bölgeye genişleme.

### 3.3 Görevlendirmek

İşçiler:

- yiyecek toplama,
- odun toplama,
- taş çıkarma,
- altın çıkarma,
- yapı inşa etme,
- onarım,
- karakol kurma,
- yol yapma

gibi görevlere atanabilir.

### 3.4 İnşa Etmek

Oyuncu kontrol ettiği bölge içinde:

- üretim yapıları,
- nüfus yapıları,
- askerî yapılar,
- depo,
- karakol,
- savunma yapıları,
- yol segmentleri

inşa eder.

### 3.5 Yükseltmek

Oyuncu:

- merkez binasını,
- belirli yapıları,
- askerî üretim kapasitesini,
- ekonomik verimliliği,
- savunma kapasitesini

geliştirir.

### 3.6 Üretmek

Oyuncu yapılarda:

- işçi,
- yakın dövüş birimi,
- menzilli birim,
- ilerleyen aşamalarda süvari veya kuşatma birimi

üretir.

### 3.7 Saldırmak

Oyuncu birliklere:

- düşman birimine saldırma,
- düşman yapısına saldırma,
- karakol yok etme,
- kaynak hattına baskın yapma,
- belirli alanı temizleme

komutları verir.

### 3.8 Savunmak

Oyuncu:

- birlikleri savunma pozisyonuna yerleştirir,
- karakol veya kaynak alanını korur,
- düşman baskınına cevap verir,
- hasarlı birlikleri geri çeker,
- yol ve üretim hattını yeniden işler hale getirir.

### 3.9 Gözlemlemek

Oyuncu yalnızca emir vermez. Sürekli olarak:

- kaynak akışını,
- nüfus durumunu,
- yol bağlantılarını,
- kontrol alanını,
- AI genişlemesini,
- düşman ordu hareketlerini,
- stratejik bölgeleri,
- çağ ilerlemesini

takip eder.

Bu nedenle bilgi sunumu, oynanışın ayrılmaz bir parçasıdır.

---

## 4. Çekirdek Döngünün Katmanları

Oynanış döngüsü üç zaman katmanında çalışır:

- anlık kararlar,
- taktik kararlar,
- stratejik kararlar.

---

## 5. Anlık Döngü

Anlık döngü yaklaşık 1–30 saniye aralığında gerçekleşir.

Oyuncunun bu seviyedeki eylemleri:

- birim seçme,
- hareket komutu verme,
- işçiyi göreve atama,
- bina yerleştirme,
- üretim kuyruğu oluşturma,
- saldırı hedefi seçme,
- birlikleri geri çekme,
- uyarıya tepki verme,
- bağlantısı kopan yapıyı kontrol etme.

Anlık döngünün amacı, oyuncuya sürekli fakat aşırı olmayan etkileşim sağlamaktır.

### 5.1 Hedef tempo

Oyuncu her saniye komut vermek zorunda kalmamalıdır.

İdeal durumda:

- ekonomi belli ölçüde otomatik işler,
- işçiler görevlerini sürdürür,
- üretim yapıları kuyruklarını tamamlar,
- birlikler temel tehditlere otomatik cevap verir,
- oyuncu önemli karar noktalarında müdahale eder.

### 5.2 Mikro yönetim sınırı

İlk vertical slice için kaçınılması gereken mikro yönetim:

- her kaynak teslimatının ayrı ayrı yönetilmesi,
- her asker saldırısının tek tek zamanlanması,
- karmaşık formasyon ayarları,
- her yol segmentinin bakım takibi,
- her yapıya ayrı işçi atama zorunluluğu.

---

## 6. Taktik Döngü

Taktik döngü yaklaşık 30 saniye–5 dakika aralığında gerçekleşir.

Bu seviyedeki kararlar:

- yeni kaynak alanına genişleme,
- hangi karakolun savunulacağı,
- ordunun hangi rotadan ilerleyeceği,
- hangi düşman yapısının hedefleneceği,
- baskının ne zaman durdurulacağı,
- yeni üretim binasının nereye kurulacağı,
- yol ağının güvenli mi kısa mı olacağı,
- ikinci bir ekonomik merkez kurulup kurulmayacağı.

Taktik döngü, oyuncuya “şimdi ne yapmalıyım?” sorusunu yöneltir.

### 6.1 Taktik karar örneği

```text
Düşman kuzeydeki taş ocağına yaklaşıyor.
Oyuncunun seçenekleri:

A) Asker gönder ve taş ocağını savun.
B) İşçileri geri çek, kaynağı geçici olarak kaybet.
C) Düşmanın ana üssüne karşı baskın yap.
D) Yol bağlantısını değiştir ve alternatif kaynağa geç.
```

İyi bir taktik kararın tek doğru cevabı olmamalıdır.

---

## 7. Stratejik Döngü

Stratejik döngü maçın 5–30 dakikalık bölümünü kapsar.

Oyuncu şu uzun vadeli kararları verir:

- ekonomi mi ordu mu öncelikli olacak?
- ne zaman çağ atlanacak?
- merkez mi güçlendirilecek, sınır mı genişletilecek?
- güvenli düşük gelir mi, riskli yüksek gelir mi tercih edilecek?
- askerî zafer mi, bölgesel zafer mi takip edilecek?
- AI’ın hangi ekonomik kolu baskı altına alınacak?
- kaynaklar erken üstünlük için mi harcanacak, geç oyun için mi biriktirilecek?

Stratejik döngü, oyuncuya “bu maçı nasıl kazanacağım?” sorusunu yöneltir.

---

## 8. Maçın Aşamaları

Maç üç ana gelişim seviyesi ve bunları birbirine bağlayan geçiş dönemlerinden oluşur.

---

## 9. Erken Oyun — Yerleşim Kurma

### 9.1 Süre hedefi

Yaklaşık ilk 0–8 dakika.

### 9.2 Oyuncunun durumu

Oyuncu:

- küçük bir merkez binasına,
- sınırlı işçi sayısına,
- yakın kaynaklara,
- düşük nüfus kapasitesine,
- az veya hiç askerî güce

sahiptir.

### 9.3 Ana hedefler

- başlangıç kaynaklarını keşfetmek,
- ilk işçi dağılımını yapmak,
- yiyecek ve odun üretimini kurmak,
- ilk evleri yapmak,
- ilk depo veya yol bağlantısını oluşturmak,
- çevreyi keşfetmek,
- AI’ın muhtemel yönünü belirlemek,
- ilk savunma birimlerini hazırlamak.

### 9.4 Oyuncuya sorulan temel soru

> Ekonomimi hızlı mı büyütmeliyim, yoksa erken saldırı ihtimaline karşı güvenli mi oynamalıyım?

### 9.5 Erken oyun baskısı

AI şu yollarla baskı kurabilir:

- keşif birimi göndermek,
- merkezi kaynak bölgesine yaklaşmak,
- erken karakol kurmak,
- küçük bir baskın hazırlamak,
- oyuncuyu savunmaya kaynak ayırmaya zorlamak.

### 9.6 Erken oyun başarısı

Oyuncu erken oyunu başarılı geçiriyorsa:

- en az iki kaynak düzenli üretilir,
- nüfus sınırı darboğaz oluşturmaz,
- ilk yol ağı kurulmuştur,
- ilk askerî üretim mümkündür,
- bir sonraki gelişim aşamasına geçiş planı vardır.

---

## 10. Orta Oyun — Kasaba ve Sınır Mücadelesi

### 10.1 Süre hedefi

Yaklaşık 8–20 dakika.

### 10.2 Oyuncunun durumu

Oyuncu:

- ikinci gelişim seviyesine ulaşmıştır,
- daha fazla yapı türüne erişir,
- düzenli asker üretebilir,
- ilk uzak kaynak alanlarına ihtiyaç duyar,
- AI ile doğrudan bölge rekabetine girer.

### 10.3 Ana hedefler

- yeni karakollar kurmak,
- yol ağını genişletmek,
- taş ve altın üretimini artırmak,
- askerî üretim kapasitesi oluşturmak,
- stratejik bölgeleri kontrol etmek,
- düşmanın genişlemesini izlemek,
- baskın ve savunma arasında denge kurmak.

### 10.4 Oyuncuya sorulan temel soru

> Harita kontrolünü ele geçirmek için ekonomimi ne kadar riske atabilirim?

### 10.5 Orta oyunun ana çatışması

Orta oyun, oyunun en yoğun karar aşaması olmalıdır.

Bu aşamada:

- kaynak alanları artık sınırlı hale gelir,
- oyuncu ve AI aynı bölgelere yönelir,
- karakollar saldırı hedefi olur,
- yollar ve depolar stratejik önem kazanır,
- ordular küçük çatışmalardan büyük çatışmalara geçer.

### 10.6 Orta oyun başarısı

Oyuncu orta oyunu başarılı geçiriyorsa:

- en az bir ileri karakola sahiptir,
- güvenli bir ana ekonomi ve en az bir riskli dış ekonomi kurmuştur,
- düzenli asker üretir,
- AI’ın bir genişleme hattını durdurabilir,
- üçüncü gelişim seviyesine geçiş planı vardır.

---

## 11. Geç Oyun — Krallık ve Zafer

### 11.1 Süre hedefi

Yaklaşık 20–30+ dakika.

### 11.2 Oyuncunun durumu

Oyuncu:

- üçüncü gelişim seviyesine ulaşmıştır,
- gelişmiş yapılar ve birlikler kullanabilir,
- yüksek kaynak tüketimiyle karşılaşır,
- büyük alanları savunmak zorundadır,
- zafer koşulunu tamamlamak için harekete geçmelidir.

### 11.3 Ana hedefler

- son askerî üretim kapasitesini kurmak,
- kritik yol ve kaynak bağlantılarını güvence altına almak,
- AI’ın ana ekonomisini zayıflatmak,
- stratejik bölgeleri kalıcı biçimde kontrol etmek,
- düşman merkezine saldırmak,
- bölgesel zafer sürecini başlatmak.

### 11.4 Oyuncuya sorulan temel soru

> Kurduğum üstünlüğü, düşmana toparlanma fırsatı vermeden nasıl zafere dönüştürürüm?

### 11.5 Geç oyun çıkmazlarını önleme

Geç oyunun sonsuza uzamaması için:

- kaynakların bir kısmı tükenebilir,
- stratejik bölgeler daha yüksek önem kazanabilir,
- merkez yapıları daha görünür hedef haline gelebilir,
- bölgesel zafer sayacı devreye girebilir,
- tam savunmaya kapanmak ekonomik dezavantaj yaratabilir.

---

## 12. Kaynak Döngüsü

Ekonomik döngü şu şekilde çalışır:

```text
Kaynak alanını keşfet
→ İşçi gönder
→ Kontrol alanını doğrula
→ Yol ve depo bağlantısı kur
→ Kaynağı üret
→ Kaynağı yapı, birim veya yükseltmeye harca
→ Yeni üretim ihtiyacı oluştur
```

### 12.1 Kaynakların oynanış rolleri

#### Yiyecek

Temel kullanım:

- işçi üretimi,
- temel asker üretimi,
- nüfus büyümesi,
- bazı gelişim gereksinimleri.

Yiyecek erken ve orta oyunda kritik olmalıdır.

#### Odun

Temel kullanım:

- temel yapılar,
- yollar,
- evler,
- üretim binaları,
- bazı askerî birimler.

Odun, genişlemenin ana kaynağıdır.

#### Taş

Temel kullanım:

- gelişmiş yapılar,
- savunma yapıları,
- karakol yükseltmeleri,
- üçüncü seviye yapılar.

Taş, bölgesel güvenliğin ana kaynağıdır.

#### Altın

Temel kullanım:

- çağ atlama,
- gelişmiş birlikler,
- teknoloji,
- geç oyun yükseltmeleri.

Altın, stratejik gelişimin ana kaynağıdır.

### 12.2 Kaynak darboğazları

Oyuncu aynı anda her şeyi yapamamalıdır.

Örnek darboğazlar:

- yeterli yiyecek fakat az odun,
- güçlü ekonomi fakat düşük nüfus kapasitesi,
- çok taş fakat yetersiz altın,
- yüksek üretim fakat zayıf yol bağlantısı,
- uzak kaynak fakat güvenli olmayan bölge.

---

## 13. Yapı Kurma Döngüsü

```text
İhtiyacı belirle
→ Yapıyı seç
→ Geçerli konum bul
→ Kontrol alanını doğrula
→ Gerekliyse yol bağlantısı planla
→ İşçi gönder
→ İnşaatı tamamla
→ Yapıyı üretim ağına bağla
→ Yapının çıktısını kullan
```

### 13.1 Yapı kararları

Her yapı şu sorulardan en az birine cevap vermelidir:

- Daha fazla kaynak mı üretir?
- Daha fazla nüfus mu sağlar?
- Yeni birim mi açar?
- Bölgeyi mi genişletir?
- Ekonomiyi mi korur?
- Düşmanı mı yavaşlatır?
- Zafer hedefini mi destekler?

### 13.2 Yapı konumu

Konum kararları önemli olmalıdır.

Oyuncu şu seçenekler arasında kalabilir:

- kaynağa yakın fakat savunmasız,
- merkeze yakın fakat verimsiz,
- kısa yol fakat düşmana açık,
- uzun yol fakat güvenli,
- ileri karakola yakın fakat ana üs desteğinden uzak.

---

## 14. Yol ve Lojistik Döngüsü

```text
Üretim alanı belirle
→ Depo veya merkez bağlantısı seç
→ Yol rotası oluştur
→ Bağlantıyı aktif hale getir
→ Verimliliği takip et
→ Tehdit oluşursa savun veya alternatif rota kur
```

### 14.1 Yolun işlevi

Yol sistemi:

- üretim verimliliğini artırır,
- yapıların aktif bağlantısını belirler,
- işçi veya taşıma sürelerini azaltabilir,
- genişlemenin yönünü görsel olarak gösterir,
- düşman için hedef oluşturur.

### 14.2 Oyuncu geri bildirimi

Bir yapının lojistik durumu açıkça gösterilmelidir.

Önerilen durumlar:

- **Bağlı:** Tam verim
- **Zayıf bağlı:** Düşük verim
- **Bağlantısız:** Üretim cezası veya durma
- **Tehdit altında:** Yol üzerinde düşman var
- **Kesildi:** Depo veya karakol bağlantısı yok

### 14.3 Lojistik karmaşıklık sınırı

İlk vertical slice için önerilen yaklaşım:

- bağlantı grafiği tabanlı sistem,
- yolun fiziksel varlığı önemli,
- gerçek zamanlı bireysel taşıma simülasyonu zorunlu değil,
- verimlilik mesafe ve bağlantı durumuyla hesaplanabilir.

---

## 15. Bölge Kontrolü Döngüsü

```text
Yeni bölgeyi keşfet
→ Bölgenin değerini değerlendir
→ Asker veya işçi gönder
→ Karakol kur
→ Kontrol alanını genişlet
→ Yol bağlantısı oluştur
→ Kaynak veya savunma yapısı kur
→ Bölgeyi koru
```

### 15.1 Bölge değerleri

Bir bölge şu nedenlerle değerli olabilir:

- zengin kaynak,
- nehir geçidi,
- kısa saldırı rotası,
- yüksek görüş alanı,
- iki yolun kesişimi,
- stratejik zafer noktası,
- rakip genişlemesini engelleme.

### 15.2 Kontrol alanı amacı

Kontrol alanı sistemi:

- yapı spamini sınırlar,
- harita genişlemesini okunabilir hale getirir,
- karakolları stratejik hedef yapar,
- saldırı ve savunma hatlarını belirler,
- yol sistemine anlam kazandırır.

---

## 16. Askerî Döngü

```text
Tehdidi veya fırsatı belirle
→ Birlik üret
→ Birlikleri topla
→ Hedef seç
→ Rota planla
→ Saldır
→ Sonucu değerlendir
→ Devam et, geri çekil veya savunmaya geç
```

### 16.1 Askerî hedef öncelikleri

Olası hedefler:

1. Düşman saldırı birimleri
2. Savunmasız işçiler
3. Uzak kaynak yapıları
4. Karakollar
5. Yol bağlantıları
6. Askerî üretim yapıları
7. Merkez binası

### 16.2 Savaşın ekonomiyle ilişkisi

Bir saldırı şu sonuçlardan en az birini üretmelidir:

- kaynak kaybı,
- üretim gecikmesi,
- bölge kaybı,
- yol bağlantısının kesilmesi,
- çağ atlamanın ertelenmesi,
- savunmaya ek kaynak ayrılması.

### 16.3 Geri çekilme

Geri çekilme geçerli bir karar olmalıdır.

Oyuncu şu durumlarda geri çekilebilir:

- sayı üstünlüğü düşmandaysa,
- takviye gelmiyorsa,
- hedef artık değerli değilse,
- başka bölge tehdit altındaysa,
- düşman savunması beklenenden güçlüyse.

---

## 17. Çağ Atlama Döngüsü

```text
Gerekli kaynakları üret
→ Gerekli yapıları tamamla
→ Bölgesel veya ekonomik koşulları karşıla
→ Merkez binasında çağ atlama başlat
→ Geçiş süresince savun
→ Yeni yapı ve birlikleri aç
→ Ekonomiyi yeni seviyeye uyumla
```

### 17.1 Çağ atlamanın maliyeti

Çağ atlamak:

- yüksek kaynak maliyeti,
- geçici üretim fırsat maliyeti,
- savunma zayıflığı,
- yeni yatırım ihtiyacı

yaratmalıdır.

### 17.2 Çağ atlama kararı

Oyuncu şu ikilemle karşılaşmalıdır:

- şimdi çağ atlayıp gelecekte güçlenmek,
- mevcut seviyede ordu üretip kısa vadeli baskı kurmak.

### 17.3 Geçiş dönemi

Çağ atlama anında tüm yapılar otomatik olarak gelişmiş hale gelmemelidir.

Önerilen yapı:

- merkez bina çağ seviyesini açar,
- bazı yapılar yeni seviye yükseltmesine uygun hale gelir,
- yeni yapılar kullanılabilir olur,
- oyuncu hangi yapıları önce geliştireceğine karar verir.

---

## 18. Zafer Döngüsü

### 18.1 Askerî zafer

```text
Düşman ekonomisini zayıflat
→ Savunmasını aş
→ Merkez bölgeye ilerle
→ Ana merkezi yok et
→ Zafer
```

### 18.2 Bölgesel zafer

```text
Stratejik noktaları keşfet
→ Noktaları ele geçir
→ Gerekli sayıda noktayı aynı anda kontrol et
→ Zafer sayacını başlat
→ Bölgeleri süre boyunca savun
→ Zafer
```

### 18.3 Zafer baskısı

Oyuncu zafer koşuluna yaklaştığında:

- AI daha saldırgan hale gelebilir,
- harita üzerindeki hedef daha görünür olur,
- oyuncuya savunma odaklı son bir görev sunulur,
- maçın bitişi belirsiz kalmaz.

---

## 19. Yenilgi Döngüsü

Olası yenilgi koşulları:

- ana merkez binasının yok edilmesi,
- yeniden merkez kurma kapasitesinin tamamen kaybedilmesi,
- kritik süre boyunca hiç işçi veya üretim yapısına sahip olmama,
- AI’ın bölgesel zafer sayacını tamamlaması.

### 19.1 Anlık yenilgi yerine toparlanma

Her büyük kayıp doğrudan maç sonu olmamalıdır.

Oyuncu şu durumlarda toparlanabilmelidir:

- bir dış kaynak alanını kaybetme,
- bir karakolun yıkılması,
- ordunun büyük bölümünü kaybetme,
- yol ağının kesilmesi,
- çağ atlamanın gecikmesi.

### 19.2 Geri dönüş araçları

Olası geri dönüş araçları:

- merkeze yakın güvenli düşük verimli kaynaklar,
- ucuz temel savunma birimleri,
- hasarlı karakolu yeniden kurma,
- alternatif yol rotası,
- düşman ordusu uzaktayken karşı baskın,
- kısa süreli savunma bonusu,
- kaynak kaybından sonra düşük maliyetli işçi üretimi.

### 19.3 Kaçınılması gereken durum

Oyuncu fiilen kaybettiği halde 10 dakika daha oynamak zorunda kalmamalıdır.

Bunu önlemek için:

- güç farkı görünür olmalı,
- teslim ol seçeneği bulunabilir,
- AI bitirici saldırı yapabilmeli,
- zafer koşulları maçı doğal biçimde kapatmalıdır.

---

## 20. AI ile Etkileşim Döngüsü

AI, oyuncunun çekirdek döngüsünü bozan ve yeniden şekillendiren aktif bir rakip olmalıdır.

### 20.1 AI baskı türleri

AI:

- aynı kaynağa genişleyebilir,
- stratejik noktayı ele geçirebilir,
- yol hattına baskın yapabilir,
- savunmasız işçileri hedefleyebilir,
- sahte saldırı yapabilir,
- ana orduyu başka yöne çekebilir,
- oyuncu çağ atlarken saldırabilir.

### 20.2 AI okunabilirliği

Oyuncuya doğrudan tüm AI planı gösterilmemelidir.

Ancak şu ipuçları verilebilir:

- gözcü tarafından görülen yeni karakol,
- sınırda birlik yoğunluğu,
- düşmanın çağ atlama duyurusu,
- saldırı yönüne dair minimap uyarısı,
- kesilen yol bağlantısı bildirimi.

### 20.3 AI davranışının amacı

AI’ın görevi yalnızca oyuncuyu yenmek değildir.

Aynı zamanda:

- oyuncuyu karar vermeye zorlamak,
- sistemlerin anlamını göstermek,
- harita kontrolünü değerli kılmak,
- maç temposunu korumak,
- oyuncunun stratejisini sınamak

olmalıdır.

---

## 21. Oyuncu Bilgi Döngüsü

RTS oyununda bilgi toplamak başlı başına bir oynanış döngüsüdür.

```text
Keşfet
→ Bilgi edin
→ Tehdidi veya fırsatı yorumla
→ Karar ver
→ Sonucu gözlemle
→ Yeni bilgi edin
```

### 21.1 Oyuncunun bilmesi gerekenler

Oyuncu her an şu bilgileri okuyabilmelidir:

- mevcut kaynaklar,
- kaynak gelir hızı,
- nüfus ve nüfus sınırı,
- çağ seviyesi,
- aktif üretim kuyrukları,
- bağlantısız yapılar,
- tehdit altındaki bölgeler,
- stratejik bölge kontrolü,
- seçili birim veya yapının durumu,
- görünür düşman hareketleri.

### 21.2 Bilgi yoğunluğu sınırı

Aynı anda çok fazla uyarı gösterilmemelidir.

Uyarılar önem seviyesine göre ayrılmalıdır:

- kritik,
- önemli,
- bilgi.

Örnek kritik uyarılar:

- ana merkez saldırı altında,
- tüm yiyecek üretimi durmuş,
- bölgesel zafer sayacı düşman lehine çalışıyor.

---

## 22. Oyuncu Geri Bildirimleri

Her önemli eylemin görsel veya işitsel karşılığı olmalıdır.

### 22.1 Seçim geri bildirimi

- seçim halkası,
- sağlık çubuğu,
- birim adı ve rolü,
- mevcut görev,
- yol veya hedef çizgisi.

### 22.2 Yapı geri bildirimi

- geçerli/geçersiz yerleştirme rengi,
- kontrol alanı sınırı,
- yol bağlantısı önizlemesi,
- inşaat ilerlemesi,
- seviye göstergesi,
- üretim durumu.

### 22.3 Kaynak geri bildirimi

- işçi animasyonu,
- kaynak üzerinde azalma,
- depo veya kaynak göstergesi,
- gelir değişimi,
- yetersiz kaynak uyarısı.

### 22.4 Savaş geri bildirimi

- saldırı animasyonu,
- hasar göstergesi,
- sağlık değişimi,
- hedef vurgusu,
- birim yenilme tepkisi,
- tehdit uyarısı.

### 22.5 Bölge geri bildirimi

- kontrol alanı sınırı,
- karakol etkisi,
- bölge sahipliği rengi,
- ele geçirme ilerlemesi,
- bağlantı kopması göstergesi.

---

## 23. Oyuncu Karar Matrisi

Aşağıdaki kararlar oyunun merkezinde yer almalıdır.

| Durum | Seçenek A | Seçenek B | Seçenek C |
|---|---|---|---|
| Kaynak yetersiz | Yeni alana genişle | Mevcut verimi artır | Harcamayı azalt |
| Düşman baskını | Savun | Geri çekil | Karşı saldır |
| Çağ atlama hazır | Hemen çağ atla | Ordu üret | Karakol kur |
| Yeni bölge bulundu | Kaynak için al | Savunma için al | Düşmana bırak |
| Yol tehdit altında | Birlik gönder | Alternatif yol kur | Bölgeyi terk et |
| Nüfus sınırı dolu | Ev kur | Birim kaybını bekle | Yükseltme yap |
| AI güçleniyor | Erken saldır | Ekonomiyi büyüt | Stratejik noktaları tut |

Bu tabloda tek bir seçenek her zaman doğru olmamalıdır.

---

## 24. Sistemler Arası Bağlantılar

### 24.1 Ekonomi → Gelişim

Kaynak üretimi çağ atlamayı ve yapı yükseltmeyi mümkün kılar.

### 24.2 Gelişim → Savaş

Yeni gelişim seviyesi yeni askerî seçenekler açar.

### 24.3 Savaş → Ekonomi

Baskınlar üretim ve yol bağlantılarını bozar.

### 24.4 Bölge → Ekonomi

Yeni bölgeler yeni kaynaklara erişim sağlar.

### 24.5 Lojistik → Verim

Yol ve depo ağı üretimin etkinliğini belirler.

### 24.6 AI → Tempo

AI baskısı, oyuncunun sadece ekonomik büyümeye odaklanmasını engeller.

### 24.7 Fog of War → Risk

Eksik bilgi, keşif ve savunma kararlarını önemli hale getirir.

---

## 25. Oyuncu Akışı — İlk 10 Dakika Örneği

Aşağıdaki akış hedeflenen deneyimi örnekler.

### Dakika 0–2

- Oyuncu merkez binasını ve başlangıç işçilerini görür.
- Yakındaki yiyecek ve odun kaynaklarını tanır.
- İşçileri iki ana kaynağa dağıtır.
- İlk ev veya depo için kaynak biriktirir.

### Dakika 2–4

- İlk ev kurulur.
- İlk yol segmentleri yerleştirilir.
- Bir işçi çevreyi keşfetmeye gönderilir.
- AI’ın olası yönüne dair ilk bilgi alınır.

### Dakika 4–6

- Askerî üretim binası kurulur.
- İlk savunma birimi üretilir.
- Yakında yeni bir taş veya altın alanı keşfedilir.
- Oyuncu ilk karakol için hazırlık yapar.

### Dakika 6–8

- İlk ileri karakol kurulur.
- Yol ağı karakola bağlanır.
- AI’ın keşif veya baskın birimi görülür.
- Oyuncu işçi üretimi ile asker üretimi arasında karar verir.

### Dakika 8–10

- İkinci gelişim seviyesi için koşullar yaklaşır.
- AI haritanın başka bir bölgesine genişler.
- Oyuncu çağ atlama, saldırı veya ikinci karakol arasında seçim yapar.

---

## 26. Tempo ve Yoğunluk Eğrisi

Maç boyunca yoğunluk düz bir çizgi izlememelidir.

Önerilen akış:

```text
Düşük yoğunluk
→ İlk keşif
→ Küçük ekonomik kararlar
→ İlk tehdit
→ Orta seviye çatışma
→ Kısa sakinleşme
→ Genişleme yarışı
→ Büyük çatışma
→ Çağ atlama
→ Son baskı
→ Zafer veya yenilgi
```

### 26.1 Sakin dönemler

Oyuncuya şu işler için zaman verilmelidir:

- ekonomiyi yeniden düzenleme,
- yol ağını onarma,
- yeni yapı planlama,
- bir sonraki hedefi seçme.

### 26.2 Baskı dönemleri

Baskı dönemlerinde:

- AI saldırısı,
- stratejik bölge mücadelesi,
- kaynak tükenmesi,
- çağ atlama yarışı,
- zafer sayacı

oyuncuyu harekete geçirmelidir.

---

## 27. Vertical Slice İçin Minimum Çekirdek Döngü

İlk tam vertical slice aşağıdaki döngüyü eksiksiz çalıştırmalıdır:

```text
İşçi üret
→ Kaynak topla
→ Ev ve üretim yapısı kur
→ Yol bağlantısı oluştur
→ Karakol kur
→ Yeni alana genişle
→ Asker üret
→ AI ile çatış
→ İkinci ve üçüncü seviyeye ilerle
→ Zafer koşulunu tamamla
```

Aşağıdaki özellikler eksikse vertical slice tamamlanmış sayılmamalıdır:

- kaynak toplama,
- yapı kurma,
- yol bağlantısı,
- kontrol alanı,
- en az iki gelişim geçişi,
- AI ekonomi kurma,
- AI saldırısı,
- geçerli zafer ve yenilgi.

---

## 28. İlk Teknik Prototip Döngüsü

İlk teknik prototip için daha küçük döngü:

```text
İşçi seç
→ Kaynağa gönder
→ Kaynak kazan
→ Bina kur
→ Asker üret
→ Basit AI hedefini yok et
```

Bu prototipte:

- tek kaynak,
- tek işçi,
- tek asker,
- tek düşman hedefi,
- tek harita alanı

yeterlidir.

Amaç tasarımı temsil etmek değil, teknik omurgayı doğrulamaktır.

---

## 29. Edge Case'ler

### 29.1 Tüm işçilerin kaybedilmesi

Çözüm seçenekleri:

- merkez binası düşük maliyetle işçi üretebilir,
- son işçi kaybında acil üretim indirimi uygulanabilir,
- oyuncu tamamen kilitlenmemelidir.

### 29.2 Yol bağlantısının tamamen kesilmesi

- üretim tamamen durabilir veya ağır ceza alabilir,
- oyuncuya hangi segmentin soruna yol açtığı gösterilmelidir,
- alternatif rota kurmak mümkün olmalıdır.

### 29.3 Karakol yıkılırken bağlı yapılar

Olası yaklaşım:

- yapılar hemen yok olmaz,
- kontrol dışı duruma geçer,
- üretim verimi düşer,
- yeniden kontrol kurulana kadar yeni yükseltme yapılamaz.

### 29.4 Aynı anda çok sayıda uyarı

- benzer uyarılar gruplanmalıdır,
- kritik uyarılar öncelikli gösterilmelidir,
- tekrar eden düşük önemli uyarılar bastırılmalıdır.

### 29.5 Birimlerin sıkışması

- pathfinding yeniden rota hesaplamalı,
- dar alanlarda birim sayısı sınırlandırılmalı,
- birimler geçici olarak birbirine yol verebilmelidir.

### 29.6 AI’ın ekonomik olarak çökmesi

- AI yeniden işçi ve temel yapı üretmeye çalışmalıdır,
- sürekli saldırı yerine toparlanma durumuna geçmelidir,
- tamamen etkisiz kaldığında maçı gereksiz uzatmamalıdır.

---

## 30. Telemetri ve Test Ölçümleri

Vertical slice testlerinde aşağıdaki veriler izlenmelidir:

- ilk yapı kurma süresi,
- ilk asker üretme süresi,
- ikinci seviyeye geçiş süresi,
- üçüncü seviyeye geçiş süresi,
- ilk çatışma zamanı,
- ilk karakol zamanı,
- ortalama işçi sayısı,
- ortalama asker sayısı,
- yol bağlantısı kesilme sayısı,
- oyuncunun kaynak darboğazları,
- maç süresi,
- kullanılan zafer koşulu,
- oyuncunun yenilgi nedeni,
- AI’ın kaç kez genişlediği,
- AI’ın kaç saldırı yaptığı.

Bu veriler denge ve tempo çalışmalarında kullanılmalıdır.

---

## 31. Açık Tasarım Soruları

### 31.1 Kaynak toplama

- İşçiler kaynağı fiziksel olarak depoya taşıyacak mı?
- Bir kaynak noktasında kaç işçi çalışabilir?
- Kaynaklar tamamen tükenebilir mi?
- İşçi otomatik olarak yakın kaynağa geçebilir mi?

### 31.2 Yol sistemi

- Yol bağlantısı olmadan üretim tamamen duracak mı?
- Yol verim bonusu sabit mi, mesafeye bağlı mı olacak?
- Düşman yol segmentini doğrudan yok edebilecek mi?
- Yollar birim hareket hızını artıracak mı?

### 31.3 Kontrol alanı

- Kontrol alanı sürekli şekil mi, grid hücreleri mi kullanacak?
- Çakışan alanlarda sahiplik nasıl belirlenecek?
- Karakollar ele geçirilebilir mi?
- Kontrol dışı kalan yapılar ne kadar süre çalışacak?

### 31.4 Savaş

- Birimler otomatik hedef seçecek mi?
- Saldırı-hareket komutu olacak mı?
- Birimler birbirinin içinden geçebilecek mi?
- Bina çevresinde minimum savaş mesafesi gerekecek mi?

### 31.5 Tempo

- İlk AI baskını hangi zaman aralığında gelmeli?
- Oyuncuya tamamen güvenli bir erken oyun süresi verilmeli mi?
- Geç oyunu kapatmak için kaynak tükenmesi gerekli mi?
- Bölgesel zafer sayacı ne kadar sürmeli?

---

## 32. Şimdilik Alınmış Kararlar

- Oynanış üç zaman katmanında değerlendirilecektir: anlık, taktik ve stratejik.
- Oyuncu her saniye yoğun mikro yönetim yapmak zorunda kalmayacaktır.
- Ekonomi, yol bağlantısı ve bölge kontrolü aynı döngünün parçaları olacaktır.
- Yol sistemi yalnızca dekoratif olmayacaktır.
- Karakollar yeni bölgeye genişlemenin ana aracı olacaktır.
- Çağ atlamak yeni yapı ve birim seçenekleri açacaktır.
- Yapılar çağ atlandığında otomatik olarak tamamen yükselmeyecektir.
- Savaş ekonomik sonuçlar üretmelidir.
- Geri çekilme geçerli bir askerî karar olacaktır.
- AI oyuncuyu karar vermeye zorlayan aktif bir rakip olacaktır.
- İlk vertical slice askerî ve bölgesel zafer koşullarını destekleyecektir.
- Oyuncunun büyük kayıplardan sonra sınırlı toparlanma imkânı olacaktır.
- Maçın ideal süresi 20–30 dakika olacaktır.
- İlk teknik prototip, tam tasarımdan daha küçük kapsamlı olacaktır.

---

## 33. Diğer Dokümanlarla Bağlantılar

Bu dosyadaki sistemler aşağıdaki GDD belgelerinde ayrıntılandırılacaktır:

- `02_MATCH_FLOW_AND_PROGRESSION.md`
  - çağ geçişleri,
  - erken/orta/geç oyun yapısı,
  - açılan içerikler.

- `03_ECONOMY_AND_RESOURCES.md`
  - kaynak üretimi,
  - işçi sistemi,
  - depo ve verimlilik.

- `04_BUILDINGS_AND_SETTLEMENT.md`
  - yapı işlevleri,
  - inşaat,
  - yükseltme,
  - yerleşim kuralları.

- `05_TERRITORY_LOGISTICS_AND_ROADS.md`
  - kontrol alanı,
  - karakollar,
  - yollar,
  - bağlantı ağı.

- `06_UNITS_AND_COMBAT.md`
  - birim rolleri,
  - hedef seçimi,
  - savaş döngüsü.

- `07_ENEMY_AI_DESIGN.md`
  - AI ekonomi,
  - saldırı,
  - genişleme,
  - toparlanma.

- `09_VICTORY_DEFEAT_AND_DIFFICULTY.md`
  - zafer,
  - yenilgi,
  - geri dönüş,
  - zorluk seviyeleri.

---

## 34. Kabul Kriterleri

Bu doküman aşağıdaki koşullar karşılandığında onaylanmış kabul edilir:

- [ ] Temel oynanış döngüsü oyun vizyonuyla uyumludur.
- [ ] Oyuncunun temel fiilleri eksiksiz tanımlanmıştır.
- [ ] Anlık, taktik ve stratejik döngüler onaylanmıştır.
- [ ] Erken, orta ve geç oyun hedefleri kabul edilmiştir.
- [ ] Kaynak, yapı, yol, bölge ve savaş döngüleri birbirine bağlıdır.
- [ ] Çağ atlama döngüsü anlaşılırdır.
- [ ] AI’ın oyuncu döngüsündeki rolü nettir.
- [ ] Oyuncu geri bildirim ihtiyaçları tanımlanmıştır.
- [ ] Geri dönüş ve yenilgi yaklaşımı kabul edilmiştir.
- [ ] Vertical slice minimum döngüsü onaylanmıştır.
- [ ] İlk teknik prototip kapsamı gerçekçi bulunmuştur.
- [ ] Açık sorular sonraki belgelerde çözülmek üzere kaydedilmiştir.

---

## 35. Kontrol Listesi

### Çekirdek oynanış

- [ ] İşçi seçme ve görevlendirme tanımlandı.
- [ ] Kaynak toplama döngüsü tanımlandı.
- [ ] Yapı kurma döngüsü tanımlandı.
- [ ] Yol bağlantısı döngüsü tanımlandı.
- [ ] Bölge genişleme döngüsü tanımlandı.
- [ ] Birlik üretim döngüsü tanımlandı.
- [ ] Savaş döngüsü tanımlandı.
- [ ] Çağ atlama döngüsü tanımlandı.
- [ ] Zafer döngüsü tanımlandı.
- [ ] Yenilgi döngüsü tanımlandı.

### Maç yapısı

- [ ] Erken oyun hedefleri tanımlandı.
- [ ] Orta oyun hedefleri tanımlandı.
- [ ] Geç oyun hedefleri tanımlandı.
- [ ] Tempo eğrisi tanımlandı.
- [ ] İlk 10 dakika örnek akışı oluşturuldu.
- [ ] Maç süresi hedefi korundu.

### Oyuncu deneyimi

- [ ] Mikro yönetim sınırları belirlendi.
- [ ] Bilgi döngüsü tanımlandı.
- [ ] Uyarı öncelikleri tanımlandı.
- [ ] Temel geri bildirim ihtiyaçları listelendi.
- [ ] Toparlanma seçenekleri belirlendi.
- [ ] Oyuncunun kilitlenebileceği durumlar incelendi.

### AI ve teknik test

- [ ] AI baskı türleri tanımlandı.
- [ ] AI toparlanma davranışı hesaba katıldı.
- [ ] Teknik prototip döngüsü tanımlandı.
- [ ] Edge case'ler listelendi.
- [ ] Telemetri ölçümleri tanımlandı.

---

## 36. Revizyon Notları

### Sürüm 0.1

- Temel oynanış döngüsü oluşturuldu.
- Oyuncunun ana fiilleri tanımlandı.
- Anlık, taktik ve stratejik karar katmanları ayrıldı.
- Erken, orta ve geç oyun yapısı oluşturuldu.
- Kaynak, yapı, lojistik, bölge ve savaş döngüleri tanımlandı.
- Geri dönüş, yenilgi ve AI baskı yaklaşımı eklendi.
- Vertical slice ve teknik prototip döngüleri ayrıştırıldı.
