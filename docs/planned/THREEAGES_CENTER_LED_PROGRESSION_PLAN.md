# ThreeAges Merkez Odakli Alti Seviye Ilerleme Plani

Durum: Planlandi - uygulama bekliyor  
Tarih: 2026-07-23  
Kapsam: Bina-turu bazli Lv1 -> Lv2 -> Lv3 arastirmasini kaldirip, iki cag ve her cagin uc seviyesini Merkezden yonetilen tek bir krallik ilerlemesine donusturmek.

## 1. Karar

Her sahip icin tek ilerleme kaynagi Merkezdir. Aktif durum iki alandan olusur:

```ts
{ age: "settlement" | "town", level: 1 | 2 | 3 }
```

Bu durum, sahibin Merkezini ve tamamlanmis/insaat halindeki tum yapilarini yonetir. Bir binanin ayri bir arastirma seviyesi, ayri bir Lv2/Lv3 maliyeti veya ayri bir yukselme dugmesi olmaz.

| Asama | Baslatan | Kosullar | Tamamlaninca |
|---|---|---|---|
| Yerlesim Lv1 | Mac baslangici | Yok | Tum mevcut yapilar Y1'dir. |
| Yerlesim Lv1 -> Lv2 | Merkez | Yalnizca Lv2 merkez maliyeti ve suresi | Tum yapilar Y2 olur. |
| Yerlesim Lv2 -> Lv3 | Merkez | Yalnizca Lv3 merkez maliyeti ve suresi | Tum yapilar Y3 olur. |
| Yerlesim Lv3 -> Kasaba Lv1 | Merkez | Kasaba maliyeti, sure ve gerekli tamamlanmis yapilar | Tum yapilar K1 olur. |
| Kasaba Lv1 -> Lv2 | Merkez | Yalnizca Lv2 merkez maliyeti ve suresi | Tum yapilar K2 olur. |
| Kasaba Lv2 -> Lv3 | Merkez | Yalnizca Lv3 merkez maliyeti ve suresi | Tum yapilar K3 olur. |

"Yalnizca maliyet" bina veya teknoloji onkosulu olmadigi anlamindadir. Onceki karara uygun olarak yukselme suresi korunur: kaynak baslatilirken rezerve edilir, Merkezde ilerleme cubugu gorunur ve tamamlaninca etki atomik uygulanir. Bu, anlik ve risksiz bir buton yerine gorunur bir stratejik yatirim yaratir.

## 2. Oyuncu kurallari

- Oyuncu her mac Yerlesim Lv1 ile baslar.
- Yerlesim Lv2/Lv3, Kasaba Lv2/Lv3 icin tek eylem Merkez seciliyken gorunur.
- Kasaba Cagi eylemi mevcut maliyet + gerekli bina listesi + sure sozlesmesini korur. Eksik binanin adi ve eksik kaynak miktari dugmede gorunur.
- Cag veya seviye yukselirken ikinci bir Merkez ilerlemesi baslatilamaz.
- Yeni yapı, o sahibin aktif seviyesinde baslar. Ornek: oyuncu K2 iken biten yeni Depo, dogrudan K2 modeli ve K2 istatistikleri alir.
- Seviye/cag degisimi sirasinda insaatta olan bina, bitis anindaki aktif merkezi seviyesiyle tamamlanir.
- Sadece o sahibin yapilari etkilenir; dusmanin ilerlemesi bagimsizdir.

## 3. Veri sozlesmesi

`buildings.json` icindeki `progression.settlement` ve `progression.town` matrisleri korunur ve her yapinin calisan istatistik kaynagi olmaya devam eder. Alti kademe degerleri kaybolmaz:

```text
Yerlesim Lv1, Lv2, Lv3
Kasaba Lv1, Lv2, Lv3
```

Ancak bina kayitlarindaki `levels` alanlari artik bina bazli maliyet/sure veya oynanis kapisi tanimlamaz. Bunlar asamali olarak kaldirilir. Merkezin kendi Yerlesim ve Kasaba Lv2/Lv3 maliyet/sureleri tek bir ilerleme veri kaynaginda tasinir.

Onerilen veri bicimi:

```ts
progression: {
  settlement: { tiers: [/* Lv1, Lv2, Lv3 */], upgrades: [/* Lv1->2, Lv2->3 */] },
  town: { tiers: [/* Lv1, Lv2, Lv3 */], upgrades: [/* Lv1->2, Lv2->3 */] },
}
```

Tercih: cag gecisi ile ayni sahip-durumunu yonettigi icin bu maliyet/sureleri `ages.json` icinde tutmak; bina verisi yalnizca bir binanin aktif kademe istatistiklerini tasir.

### Birlik kapilari

`requiredBuildingLevel` artik "belirli bir Kislaya yatirim yapildi" demek olmaz. Yeni anlami global merkez seviyesidir ve alan adi acik bir `requiredProgression`/`requiredSettlementLevel` alanina tasinir:

- Muhafiz: Yerlesim Lv1.
- Okcu: Kasaba Lv1 ve tamamlanmis Okculuk Alani.
- Kocbasi: Kasaba Lv2 ve tamamlanmis Kisla.

## 4. Runtime mimarisi

### Yeni sahip-ilerleme sistemi

`AgeSystem` ve bugunku `StructureUpgradeSystem` sorumluluklari tek bir `KingdomProgressionSystem` arkasinda birlestirilir veya `AgeSystem` bu seviyeyi dogrudan sahiplenir. Sistem su islemleri sunar:

- `snapshot(owner)`: aktif cag, seviye, sonraki merkez eylemi, maliyet, sure ve eksik Kasaba onkosullari;
- `startLevelUpgrade(owner)`: sadece Merkez kaynakli Lv1->2 veya Lv2->3;
- `startTownUpgrade(owner)`: mevcut Kasaba maliyet/onkosul denetimi;
- `update(dt)`: rezervasyon, iptal/iade ve tamamlanma olaylari;
- `tierFor(owner)`: tum runtime tuketicilerinin tek aktif kademe sorgusu.

Merkez yikilinca devam eden merkez/cag ilerlemesi iptal edilir ve rezervasyon iade edilir. Birlik uretim kuyruklari, Merkez seviyesinin artmasi yuzunden durmaz; yalniz mevcut Kasaba gecisindeki Merkez kuyrugu duraklatma davranisi korunur.

### Toplu uygulama

Bir merkez eylemi tamamlandiginda sistem sahibin tum tamamlanmis yapilarina tek bir `applyProgressionTier(structure, tierFor(owner))` yolu uygular. Bu yol can, nufus, depo kapasitesi, ekonomi, karakol savunmasi, pazar komisyonu, uretim kuyruk kapasitesi, model, bolge yaricapi ve ilgili HUD/world yenilemelerini birlikte gunceller.

Yerlesim/Kasaba ayrikligi olan yapilar (or. Okculuk Alani) mevcut `requiredAge` kuralini korur; bina yalnizca acik oldugu cagda aktif global seviye ile dogar.

### Kaldirilacak eski yol

`StructureUpgradeSystem`in owner + building type anahtari, `levels`ten sonraki adimi bulmasi, `startForType`, `typeSnapshot` ve bina panelinden gelen `UPGRADE_ACTION` yolu kaldirilir. Bununla birlikte:

- bina basina dunya ilerleme cubuklari kalkar;
- secim panellerindeki "Lv2/Lv3 yukselmesi" eylemi kalkar;
- AI'nin `AiUpgradeManager` ile Kisla II arastirmasi kalkar;
- olusturma onizlemesi ve insaat tamamlanmasi, bina turu seviyesi yerine global `tierFor(owner).level` kullanir.

## 5. UI ve editor

### Oyun arayuzu

- Merkez paneli aktif seviyenin sonraki Lv yukselmesini veya Kasaba Cagina Gec eylemini gosterir.
- Buton hedefi, maliyeti, sureyi ve ana kazanimi tasir: `Yerlesim Lv2 - tum yapilar gelisir` gibi.
- Kasaba eylemi eksik yapilari aciklar; normal Lv eylemleri hicbir bina onkosulu gostermez.
- Her bina paneli eylem yerine salt-bilgi olarak `Yerlesim Lv2` / `Kasaba Lv3` ve o aktif tierin etkilerini gosterir.
- Dunya uzayindaki ilerleme cubugu yalniz Merkezde gorunur. Cag ve seviye ilerlemeleri ayni konumda, birbirini dislayan durumlar olur.
- Tamamlanma bildirimi, etkiyi "Tum yapilar Kasaba Lv1 oldu" gibi aciklar.

### Forge Veri tablosu

- Yapilar > `Yukseltme 2-3` grubu kaldirilir.
- Yapilar > Yerlesim Cagi ve Kasaba Cagi gruplari, alti seviye stat tablosu olarak kalir.
- Yeni Merkez ilerleme maliyetleri/sureleri Cag Dengesi veya ayri Ilerleme tablosunda duzenlenir.
- Yardim metinleri, aktif degerlerin Merkezdeki global cag/seviyeden geldigini soyler.
- Validator, her bina icin eksiksiz alti tieri; global ilerleme icin de her cagda Lv1->2 ve Lv2->3 maliyet/sure kaydini zorunlu kilar.

## 6. Uygulama fazlari

### Faz 0 - Veri ve denge karari

- [ ] Merkezin Y1->Y2, Y2->Y3, K1->K2 ve K2->K3 maliyet/surelerini onayla.
- [ ] Kasaba gecisi icin mevcut bina listesi ve maliyeti onayla.
- [ ] Birlik kapilarini global tierlere tasiyip isimlendirmesini onayla.
- [ ] `levels` alaninin veri migrasyonu ve eski kayit uyumluluk politikasini onayla.

### Faz 1 - Veri sozlesmesi ve dogrulama

- [ ] Global merkez ilerleme semasini `AgeBalance`/validator/varsayilan veriye ekle.
- [ ] `buildings.json`deki bina bazli `levels` tanimlarini kaldir; alti tier `progression` matrislerini koru.
- [ ] Editor katalog gruplarini, aciklamalarini ve kaydetme dogrulamasini yeni semaya tasiyip eski Yukseltme grubunu kaldir.
- [ ] Eski oyun verisi yukleniyorsa acik, tek seferlik migration veya kontrollu red kuralini test et.

### Faz 2 - Simulation ve gorseller

- [ ] Sahip-bazli tek ilerleme sistemini kur; kaynak rezervasyonu, sure, iptal/iade ve Kasaba onkosullarini kapsa.
- [ ] Tum aktif-tier tuketicilerini `tierFor(owner)` uzerinden cozumle.
- [ ] Merkez tamamlanmasinda tum bitmis yapilari atomik guncelle; insaat bitisi ve placement onizlemesinin aktif tieri devraldigini uygula.
- [ ] Eski `StructureUpgradeSystem`in bina-turu durumu ve eylem yolunu kaldir.

### Faz 3 - Birlikler, AI ve UI

- [ ] Birlik verisi/uretim reddi/UI metinlerini global tier kapilarina cevir.
- [ ] AI'nin bina Lv arastirmasi yerine Merkez seviyesine yatirim yapmasini; Kasaba onkosullarini tamamlamasini sagla.
- [ ] Merkez paneli, dunya ilerleme cubugu, bildirimler ve bina paneli bilgisini yeni modele uyarla.
- [ ] Editor tablosunda bina `Yukseltme` bolumunun gorunmedigini dogrula.

### Faz 4 - Regresyon ve denge

- [ ] Otomatik test: Y1->Y2/Y3 ve K1->K2/K3, her bina turunun birlikte guncellenmesi, yeni/insaat halindeki binanin tier devralmasi.
- [ ] Otomatik test: Kasaba gecisinde maliyet + eksik bina reddi; normal Lv gecisinde bina onkosulu olmamasi.
- [ ] Otomatik test: Okcu K1, Kocbasi K2 ve AI'nin ayni global kapilari kullanmasi.
- [ ] `npx tsc --noEmit`, `npm run test:engine`, `npm run build:verify` calistir.
- [ ] Browser smoke: Merkezden tum dort seviye eylemi, model/stat degisimi, yeni bina onizlemesi ve editor Veri tablosu.
- [ ] En az bes maclik denge olcumu: her seviyeye ulasma zamani, Kasaba zamani, ordu acilma zamani, kaynak stoklari ve kazanma/bitirme zamani.

## 7. Kabul olcutleri

1. Oyuncunun bina secim panelinden bireysel veya tur-bazli Lv arastirmasi baslatilamaz.
2. Bir sahibin aktif seviyesi tum yapilarinda, mevcut ve sonraki yapilarinda aynidir.
3. Yerlesim ve Kasaba icin alti kademe istatistigi kullanilir; K1 her binada Y3'ten zayif degildir.
4. Yalniz Kasaba gecisi bina onkosulu ister; normal Lv yukselmeleri istemez.
5. Tum model, ekonomi, nufus, depo, savunma, ticaret ve kuyruk etkileri ayni merkezi tamamlanma olayindan guncellenir.
6. Oyuncu, AI ve editor ayni global ilerleme verisini gorur ve kullanir.

## 8. Kapsam disi

- Yeni cag eklemek veya ucuncu cag (Krallik) tasarlamak.
- Bir bina turune ozel, merkezden bagimsiz teknoloji agaci eklemek.
- Cag gecisi sirasinda bina insasini durdurmak veya mevcut yapilari yok etmek.
- Alti tier sayilarini bu planla yeniden dengelemek; bu degerler sonraki olcumlerden sonra ayri bir denge gecisinde ayarlanir.
