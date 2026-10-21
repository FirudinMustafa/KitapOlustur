# Yayınevi Kalitesinde Çıktı — Canlı Takip

> **Amaç:** İnternetten bulunan bir Workbook / Student Book PDF'ini sisteme yüklediğimizde, yayınevi kalitesinde **benzer** (birebir kopya değil, özgün) bir kitap almak.
> Bu dosya her çalışma adımında güncellenir. Son güncelleme: **2026-10-21**. Branch: `redesign/ui`.

---

## 0. Faz P — ücretli modlar, dinleme, CEFR (2026-10-21)

Plan: `~/.claude/plans/simdi-bu-projenin-vizyonu-sparkling-corbato.md`. Commit: `4174ae6`.

**Modeller (Gateway, fiyatlar canlı katalogdan):**

| Rol | Model |
|---|---|
| Yazar, kalite kontrol, görsel inceleme | `anthropic/claude-sonnet-5.5` (2 $ / 10 $ per M) |
| Taslak metin | `google/gemini-3.5-flash-lite` |
| Resim | `openai/gpt-image-2.5-flare` (iç sayfa medium, kapak high) |
| Ses | `openai/tts-1-hd` |

**Harcama sınırı:**
- Metin maliyeti de `cost_usage.text`'e yazılıyor.
- Resim maliyeti modelin bildirdiği token'dan hesaplanıyor.
- Toplam `RUN_COST_CAP_USD`'yi (varsayılan 6 $) geçince run durduruluyor.
- `scripts/gateway-spike.mts` her modeli birer çağrıyla deniyor.

**Kaynak analizi:**
- Sayfaların çoğunda üst/alt bantta tekrarlanan satırlar (filigran, sayfa başlığı) ölçüme ve kaynak metne girmiyor.
- Alıştırma başlığındaki ses parça numarası ("1 03 Listen and point") okunuyor; dinleme alıştırmaları sayılıyor.
- Resim üstündeki numaralar ve iki kez basılmış yazı artık alıştırma sayılmıyor.
- `i_5_team_2.pdf` ölçümü değişmedi.

**Dinleme:**
- Yazara sayfa başına dinleme alıştırması sayısı gidiyor.
- `fillMissingListeningScripts` eksik ses metinlerini yazıyor.
- Parçalar kitap boyunca numaralanıyor: alıştırmanın yanında kulaklık + "01" rozeti.
- Öğretmen kitabı ve çalışma kitabının sonunda "Audio Scripts" sayfası var.

**CEFR:**
- CEFR-J Wordlist 1.5 (Tono Lab, TUFS; ticari kullanım atıfla serbest), basit kök bulma ile kullanılıyor.
- Seviye incelemesi, seviye üstü kelime oranı kaynağın oranını +5 puandan fazla aşan üniteyi geri gönderiyor ve kelimeleri listeliyor.
- CEFR-J tabanlı dilbilgisi listesi yazara ve incelemeye gidiyor.
- Kaynakların seviye üstü kelime oranı: Super Minds Starter (A1) %6,9, Kid's Box 1 AB (A1) %15,9, i5 Team 2 (A2) %6,2.

**Doğrulama:**
- tsc temiz; vitest 71 dosya / 433 test geçti.
- KIYAS-11 yeniden dizimi: yapı %84, görünüm %56 (önce %83 / %56). Gerileme yok.
- Rozet ve "Audio Scripts" sayfası örnek metinle render edilip görüldü.

**Test kaynağı (KIYAS-13):** Cambridge *Super Minds Starter Student's Book* örnek ünitesi, 10 sayfa.
- Kaynak: https://assets.cambridge.org/97811089/25402/excerpt/9781108925402_excerpt.pdf
- Filigran bandı kırpıldı (CropBox 620×782 pt = kitabın gerçek sayfası): `.spike/super-minds-starter-sb-cropped.pdf`.
- Yedek test: Kid's Box Level 1 Activity Book, `.spike/kids-box-1-ab-cropped.pdf`.

**KIYAS-13 sonucu (2026-10-21, proje `d811a1e3`, run `d81dc571`, ücretli modeller, 2 ünite) — tamamlandı:**
- Maliyet **8,80 $**: metin 6,80 / görsel 1,79 / ses 0,21. Sınır bu run için `RUN_COST_CAP_USD="10"` yapıldı (`.env.local`).
- Metin maliyetinin çoğu görsel QA: 1,4 M token; yalnızca Ünite 0'da 80 yeniden deneme oldu.
- Yaklaşık 1,5 $ boşa gitti. Kapatılan konsol sunucuyu EPIPE ile bozdu, yeniden başlatmada Ünite 0 görsel adımı iki kez kuyruğa girdi ve paralel çalıştı.
- İçerik ve tutarlılık iyi: zorluk ilerlemesi 82, kelime tekrarı 80, gramer sıralaması 84, tema 88.
- Görseller: 34 görselden 19'u QA'dan geçemedi, 7'si OpenAI güvenlik filtresine takıldı.
  - Sebep: `imageCharacters` sayfa geneli doldurulup sayfanın her resmine gidiyordu (ör. s.1'de 6 karakterin hepsi).
  - Sonuç: "no people" ve nesne resimlerine bütün kadro çizildi.
  - **Düzeltildi:** her resim yalnızca kendi promptunda adı geçen karakterleri alıyor; liste yalnızca ana resimde ve prompt kimseyi adlandırmıyorsa kullanılıyor; "no people" diyen resme karakter gitmiyor. Canlı doğrulanmadı.
- Sanat yönetmeni puanı: Student Book 49, Workbook 46.
  - s.15 şarkı sayfası %75 boş.
  - s.7 sayı listesi iki kez basılmış.
  - 7 sayfa taşıyor.
- Fidelity (`fidelity.mts … sb.pdf 1 4 10`): yapı %40, görünüm %59 (aynı tasarım referansı %66).
  - İlk 5 sayfa yapı %53–78; s.9'daki taşmadan sonra eşleşme kayıyor.
  - **Asıl fark kelime sayısı:** kaynak sayfa 11–38 kelime, bizimki 72–201. Pre-A1 için yazar 5–10 kat fazla metin yazıyor; taşma ve küçük resimler buradan geliyor.

**Sıradaki:**
1. Yazara kaynağın sayfa başı kelime sayısını sert sınır olarak vermek; aşanı kısaltmak.
2. Görsel QA yeniden denemesine resim başına üst sınır koymak.
3. Düzeltilmiş karakter seçimiyle bozuk görselleri stüdyodan tek tek yeniden üretmek.

**Bekleyen (çözüldü):** `AI_GATEWAY_API_KEY` ve kredi eklendi, KIYAS-13 ücretli modellerle koştu.

**Yapılmadı:**
- Web okuyucuda parça rozeti.
- Resim üretilemeyince "look at the picture" atfının düzeltilmesi (ücretli resimde nadir olmalı).

---

## 1. Güncel durum (özet)

| Alan | Durum |
|---|---|
| Alıştırma türleri (resimli ızgara, eşleştirme, kelime kutusu, yazma satırı, çizim kutusu) | ✅ Var, canlı testte kullanıldı |
| Kodla çizilen diyagramlar (yer edatı sahneleri, kasaba haritası) | ✅ Var, canlı testte kullanıldı |
| Alıştırma resimleri (Twemoji ikonları, AI kotası gerektirmez) | ✅ Var, canlı testte basıldı |
| Cevap anahtarı (doğru, yalnızca kitabın sonunda, kompakt) | ✅ Var |
| Sayfa düzeni (boş/yarım sayfa yok, ölçerek dizme) | ✅ Var |
| Fontlar (gerçek kalın, Türkçe, çocuk teması fontları) | ✅ Var |
| **Sahne görselleri (kapak, karakter, ünite görselleri)** | ⏳ **Test edilemedi** — Cloudflare günlük ücretsiz kotası doldu |
| Kaynak kitapla canlı kıyas | 🟡 Yapı/düzen seviyesi ✅, görsel zenginlik ⏳ |
| **Kaynağın formatını yakalama** (yerleşim, alıştırma biçimleri, sayfa başına çoklu görsel) | 🟡 Kod tamam (Faz B, §4); canlı üretimle doğrulanmadı |

**Denetim sonrası düzeltilmiş cevap (2026-10-12):** Çıktı kaynağın formatında değil; sabit bir tasarım sistemi (9 şablon, 5 tema, sayfa başına tek görsel) kaynaktan alınan sayfa sırası/türü ve kaba ipuçlarıyla dolduruluyor. Gerçekçi "aynı format, farklı içerik" benzerliği: Workbook ≈ %30–40, Student Book ≈ %20–30. Boşluğun çoğu koddan; ücretli kota formatı değil, görsel/yazı kalitesini artırır.

**Önceki kısa cevap:** Alıştırma yapısı, sayfa düzeni ve cevap doğruluğu bakımından kaynağın profesyonel bir benzeri çıkıyor. Görsel zenginlik (sahne illüstrasyonları) görsel servis kotasına bağlı ve henüz görselli bir tam test yapılmadı.

---

## 1b. İkinci uçtan uca denetim (2026-10-18)

Üç ajan (önyüz, arka uç, üretim hattı) salt-okuma inceledi. Plan: `~/.claude/plans/pasted-content-id-febc-projeyi-bastan-fizzy-kahn.md`.

**Ana bulgu:** Sistem kaynağın *yapısını* ölçüyor ama *görünümünü* hiç ölçmüyor:
- Ölçülen yapı: sayfa sayısı, resim kutuları, sütunlar, alıştırma/madde sayısı.
- Ölçülmeyen görünüm: renk, font, kenar boşluğu, üst/alt bant, tonlu panel, resim boyutu/konumu/stili.

Görünüm 5 sabit temadan geliyor. Fidelity skoru da yalnızca sayıları ölçüyor ve 0'a karşı 0'ı tam puan sayıyor. Bu yüzden %78 gibi değerler "aynı görünüm" anlamına gelmiyor (bkz. KIYAS-7 `compare.png`).

**Gerçekçi tahmin:**

| Kitap | Yapı | Görünüm |
|---|---|---|
| Workbook | ≈%40–50 | ≈%15–20 |
| Student Book | ≈%30–40 | ≈%10–15 |
| Tamamlayıcı kitap | ≈%15–25 | — |

**Kaynak düzeni iki durumda kayboluyor:**
- Resim yoksa şablona düşüyor (`layouts.ts:429`).
- Taşmada düz akışa düşüyor (`render-fitted.tsx:42`).

**Faz S — maliyet/güvenlik (yapıldı, `787910d`):**
- Rerun ünite sınırı 1–30.
- İçerik değişikliği ünite başına tek giriş, en fazla 5 tur.
- Görsel incelemesi yalnızca işaretli görseller için.
- Karakter yeniden çizimi en fazla 5 tur.
- `isOwnBlobUrl` yalnızca kendi Blob store'unu kabul ediyor.
- Dizilim son bitmiş run'ı okuyor; üretim sürerken kayıt 409.
- Stüdyo hikâyesi ilk mesajdan adlandırılıyor.
- EPUB/LMS tüm resimleri aktarıyor; resim prompt'u artık altyazı değil, alt metin (EPUB/DOCX/LMS).
- `tsc` temiz, vitest 64 dosya / 373 test geçti.

**G5 ✅ (`e1f0844`) — yapı ve görünüm ayrı puanlanıyor:** `src/lib/page-look.ts`, `page-look-pdf.ts`, `fidelity.ts`, `scripts/fidelity.mts`.
- **Yapı:** madde ve kelime sayısı eklendi. 0'a karşı 0 artık "uygulanamaz" sayılıyor.
- **Görünüm:** düşük çözünürlüklü render'dan ölçülüyor:
  - basılı renk dağılımı (kâğıt hariç)
  - renklilik
  - mürekkep oranı ve mürekkep haritası
  - resim alanı örtüşmesi
  - punto/sayfa oranı
- **Referans satırı:** betik, kaynağın sayfalarını birbiriyle karşılaştırıp yazdırıyor (aynı tasarım, farklı içerik).

Yeni puanlar (kaynak s.6–11):

| Karşılaştırma | Yapı | Görünüm |
|---|---|---|
| KIYAS-6 | %43 | %53 |
| KIYAS-7 | %35 | %46 |
| KIYAS-9 | %36 | %41 |
| İlgisiz kitap (`ajan-ofisi-kiti.pdf`) | %22 | %30 |
| Kaynak kendi sayfalarına karşı | — | **%70** |

Görünüm ölçeği: ilgisiz kitap ≈%30, hedef ≈%70. Bizim çıktılar bu aralığın yaklaşık üçte birinde.

En zayıf alanlar:
- mürekkep oranı %20–35 (sayfalar çok beyaz)
- mürekkep haritası %26–40
- resim alanı %0–17

`typeSize` her kitapta ≈%100 çıkıyor, ayırt edici değil.

**G2 ✅ (`098ebab`) — kaynak düzeni resimsizken ve taşmada korunuyor:**
- Planı olan sayfa, resimleri eksik olsa da `source-zones` ile diziliyor. Resim yuvası düşüyor, metin kaynağın bant ve sütunlarında kalıyor.
- Taşan sayfa önce kendi düzeninde sıkılaştırılıyor: yazı %82'ye, resim %40'a kadar küçülüyor. Ancak hâlâ taşıyorsa düz akışa geçiyor. Önceden ilk adım düz akıştı.
- Resimler orantılı küçülüyor; şerit gibi kırpılmıyor (PDF + web).
- `source-zones` güvenlik payı 1.3 → 1.1.
- Yeni `scripts/relayout.mts`: kayıtlı bir run'ı yapay zekâ çağırmadan yeniden diziyor. `--zones-from <kaynak.pdf>` planları bugünkü ölçümle yeniden kuruyor.

  Kullanım: `npx tsx --env-file=.env.local scripts/relayout.mts <runId> .relayout/x.pdf --zones-from i_5_team_2.pdf`

Ölçüm (bugünkü planlarla yeniden dizim, kaynak s.6–11):

| Run | Yapı | Görünüm | Düz akışa düşen sayfa |
|---|---|---|---|
| KIYAS-7 (`508c2d94`, resimli) | %44 → **%68** | %49 → %52 | 5/6 → 1/6 |
| KIYAS-9 (`b731f771`, resimsiz) | %40 → %48 | %41 → %41 | — |

**Görülen, G2 dışı sorunlar:**
- Resim üretilemezse sayfanın yarısı boş kalıyor ve metin olmayan bir resme atıf yapıyor ("Look at the picture").
- Resimler kaynaktakinden küçük.
- Sayfalar beyaz.
- Alıştırma içeriği seyrek: cevabı gösteren tablolar, "Item 1" gibi yer tutucular (eski KIYAS-7 içeriği).

**G1 ✅ (`6c12fb7`) — kaynağın ölçülen renkleri ve yazısı:**
- Ölçüm sayfa başına gövde/başlık fontunu ve resim dışındaki renkleri kaydediyor (`designColors`).
- `src/lib/design/source-theme.ts` kitap düzeyinde şunları çıkarıyor:
  - en çok sayfada geçen marka rengi
  - ayrı tondaki vurgu rengi
  - en yaygın açık panel tonu
  - font rolleri (font adından)
  - punto/sayfa oranı
- Workflow modelin tek sayfadan yaptığı palet tahmini yerine bu ölçümü kullanıyor. PDF ve kapak kaynağın fontu ve puntosuyla basılıyor, yazarın sığma tahmini de bu puntoyla yapılıyor. Yeniden derleme stili sayfa haritasından yeniden çıkarıyor. Migration yok.
- `derivePaletteFromColors` kullanılabilir rengi olduğu gibi koruyor. Yalnızca beyaz yazı okunmazsa koyulaştırıyor; açık renkleri panel tonu olarak okuyor.
- `i_5_team_2.pdf` sonucu: `#cc181f` kırmızı, `#c1d72f` lime, `#f7e5ca` krem; sans gövde/başlık; 10 pt.

KIYAS-7 yeniden dizim:

| | Yapı | Görünüm | Mürekkep oranı | Mürekkep haritası |
|---|---|---|---|---|
| Önce | %68 | %52 | %30 | %36 |
| Sonra | %68 | **%56** | %44 | %45 |

Renk dağılımı %54 → %46'ya düştü: kaynağın renk dağılımına resimler hâkim, bizim kırmızı tablo başlıkları dağılımı kaydırıyor.

**Yapılmadı:**
- Kenar boşluğu ölçümü: `MARGIN_X` sabit; değiştirmek tüm tahminleri etkiler.
- Web okuyucuda font: yalnızca palet uygulanıyor.

**G3 ✅ (`a035808`) — resimler kaynaktaki yerde ve boyutta, yuvaya göre üretiliyor:**
- Plan resim satırının yatay konumunu ve genişliğini (`left`, `span`) taşıyor; PDF ve web oraya yerleştiriyor.
- **Hata düzeltmesi:** plandaki resim yükseklikleri sayfa kesri, ama içerik alanıyla çarpılıyordu. Bu yüzden her resim yaklaşık %20 küçük çıkıyordu.
- `renderBookFitted` her sayfanın altında gerçekte kalan boşluğu ölçüyor (`pageContentBottoms`) ve kaynak düzenindeki sayfaları bu boşlukla yeniden diziyor. Taşan sayfa önceki hâline dönüyor. Maliyeti 1–2 ek render.
- Resim yuvasının şekline göre üretiliyor (`pictureSlotAspects`):
  - Ücretli mod: 1536×1024, 1024×1536 veya 1024×1024.
  - Ücretsiz mod: flux boyut parametresi almıyor (belgeden doğrulandı); kompozisyon prompt'ta tarif ediliyor.
- Resim çerçevesi en fazla 1.6:1. Daha geniş yuvalarda kare resim şerit gibi kırpılıyordu (top ve sıra yarım).
- `relayout.mts`, yeni üretimdeki gibi cevap sızdıran tabloları atıyor (`dropLeakingTable`).

KIYAS-7 (yeni üretim kurallarıyla yeniden dizim): yapı %68 → **%73**, görünüm %56 → %57. Düz akışa düşen ya da sıkılaştırılan sayfa yok (önce 1 ve 5).

**Dürüst not:** yapıdaki artışın çoğu sızdıran tabloların atılmasından geliyor. G3'ün etkisi puandan çok doğrulukta:
- resimler artık kırpılmıyor ve kaynaktaki yerde duruyor
- s.6'da resim yüksekliği 0.13 → 0.35, s.4'te 0.25 → 0.32 (kaynakta 0.61 ve 0.32)

Resim alanı örtüşmesi %21–25'te kalıyor. Sınırlayan şey sayfadaki metin miktarı: kaynak 184 kelime + sayfanın üçte biri resim sığdırıyor, bizim alıştırma biçimlerimiz kelime başına daha fazla yer kaplıyor. Bu G4'ün işi.

**G4 ✅ (`fa1902b`) — ders kitabı yoğunluğu:**
- **Kaynak düzenindeki sayfalarda alıştırma dizimi:**
  - numara bir boy büyük ve kitabın renginde
  - başlık ile kısa yönerge tek satırda
  - kısa maddeler 2–3 sütunda
  - bloklar arası 8 pt

  Sığma tahmini aynısını ölçüyor; diğer şablonlar değişmedi.
- **Analizör düzeltmesi:** gövde punto hesabı numarayla başlayan kalın satırları saymıyor. mupdf satıra ilk karakterin fontunu verdiği için tek satırlık başlık+yönerge gövde sayılıyor ve tüm başlıkları gizliyordu. Üç kaynağın ölçümü değişmedi (önce/sonra karşılaştırıldı).
- **Yazar kuralları:**
  - Ölçülmüş sayfa 220–320 kelime bütçesine değil, kaynağın şekline uyuyor.
  - Alıştırma sayısının %80'i isteniyor (önce %60).
  - Ek alıştırma en fazla 6 (önce 4), kaynağın madde sayısıyla.
  - Ek madde en fazla 8 (önce 6).
- **Yer tutucu kontrolü:** "Picture of a ball", "Item 1" gibi maddeler yazara geri gönderiliyor (`placeholder-items.ts`).
- **Sayfa süsü:** kaynağı izleyen kitapta sayfa numarası, kitabın renginde bir sekmede basılıyor.

KIYAS-7: görünüm %57 → **%60**, yapı %72. Resimler her sayfada büyüdü; örneğin kaynak s.7'de 0.92×0.33, bizde 0.51×0.20 → 0.61×0.30.

### Faz G özeti (KIYAS-7 yeniden dizimi, kaynak s.6–11)

| Adım | Yapı | Görünüm |
|---|---|---|
| Denetimdeki PDF (eski ölçü %78) | %35 | %46 |
| G2 düzen korunuyor | %68 | %52 |
| G1 kaynak renk/yazı | %68 | %56 |
| G3 resim yeri/boyutu (+ sızdıran tablo kuralı) | %73 | %57 |
| G4 yoğunluk | %72 | **%60** |
| *Hedef: kaynağın kendi sayfaları* | — | *%70* |
| *İlgisiz kitap* | %22 | *%30* |

**Ne kadar gerçek?**
- Bunlar kayıtlı içeriğin yapay zekâ çağırmadan yeniden dizilmesi. Yazar kuralları (G1 punto, G3 yuva şekli, G4 yoğunluk ve yer tutucu) gerçek bir üretimle henüz doğrulanmadı.
- Görünüm aralığının yaklaşık %75'i kapandı ((60−30)/(70−30)).
- Kalan farkın kaynakları:
  - resimler hâlâ kaynaktan küçük
  - kaynağın tam sayfa renkli zeminleri ve kolajları yok
  - ücretsiz flux resimleri kaynağın çizim stilinde değil

**Sıradaki (öncelik sırasıyla):**
1. Gerçek üretimle doğrulama (KIYAS-11): `i_5_team_2.pdf`, aynı ayarlar, ardından `scripts/fidelity.mts`. Cloudflare kotası UTC gece yarısı yenileniyor.
2. Web okuyucunun kaynak düzenindeki sayfaları da yoğun dizilmeli (şimdilik yalnızca PDF).
3. Kenar boşluklarının kaynaktan ölçülmesi.
4. Resim üretilemediğinde sayfa yarı boş kalıyor; yedek görsel kaynağı ya da metnin resme atıf yapmaması.

### KIYAS-11 — Faz G'nin canlı doğrulaması (2026-10-18)

Proje `474302d3`, run `bd0b1a3a`. Ayarlar: `i_5_team_2.pdf`, Student Book, A2, klasik tema, boyut "kaynakla aynı", 1 ünite, ücretsiz mod. Uçtan uca tamamlandı (16:30 → 16:59).

**Çalışanlar:**
- Kaynak stili ölçüldü ve kitaba uygulandı: kırmızı/lime/krem, sans, 10 pt; numara rozetleri ve sayfa sekmesi kırmızı.
- Yazar 6 sayfanın hepsinde kaynağın alıştırma, madde ve resim sayısına birebir uydu. Yer tutucu madde yok. Kelime sayısı kaynağa yakın: 116–212, kaynak 123–244.
- Bütün onay kapıları çalıştı; "tekrar dene" koruması (409 → 200) doğru davrandı.

**Puan: yapı %62, görünüm %45.** Yeniden dizimde %72 / %60'tı.

Neden düştü:
1. **İçerik artık kaynak hacminde, bizim dizimimiz ise kelime başına daha çok yer kaplıyor.**
   - 6 sayfanın 4'ü sıkılaştırıldı ve resimler %30'a kadar küçüldü. Örneğin kaynakta 0.92×0.33 olan resim bizde 0.34×0.17; kaynakta 0.61×0.32 olan 0.16×0.10.
   - 1 sayfa (kaynak s.8) düz akışa düştü; tek bir alıştırma ayrı bir sayfaya taştı.
   - Yazarın kaynakta olmayan tablo ve bilgi kutusu eklemesi yeri daha da daraltıyor.
2. **Resimler "beyaz zemin üzerinde tek nesne"** (flux, flat-vector, ek resim prompt'ları "simple single subjects"). Çerçeve büyük olsa bile sayfa beyaz görünüyor; kaynakta ise tam sahne, kolaj ve fotoğraflar var.
3. **Kaynağın renkli sayfa zeminleri ve panelleri bizde yok.**

Karşılaştırma görüntüsü: `.relayout/KIYAS-11-kaynak-vs-uretim.png` (üst sıra kaynak s.6–11, alt sıra üretim). PDF: `.relayout/KIYAS-11-student-book.pdf`.

**Sıradaki iş (KIYAS-11'e göre):**
1. **Resim önceliği:** kaynak düzenindeki sayfada resim kaynağın boyutunun %70'inin altına küçülmesin. Yer önce yazı tarafından açılsın:
   - yoğun sayfada satır aralığı 1.45 → ~1.25
   - kompakt tablo
   - kaynakta olmayan tablo ve bilgi kutusunu yazara yazdırmama
2. **Resim yönü:** kaynakta sahne resmi olan yuvalara "tam kare, kenardan kenara, renkli sahne" prompt'u; "beyaz zemin üzerinde tek nesne" yalnızca küçük yuvalarda.
3. **Sayfa rengi:** kaynağın panel tonuyla alıştırma bölgelerine zemin; kaynakta renkli zemin varsa sayfaya da.

**KIYAS-11 sonrası düzeltmeler (`cb90747`):**
- **Yoğun satır aralığı:** kaynak düzenindeki sayfalarda 1.22, pt olarak veriliyor. Başlık/yönerge satırının kendi aralığı var; ilk denemede iki satıra bölünen başlıklar üst üste biniyordu.
- **Küçülme sırası:** önce yazı (en fazla %85'e), sonra resim. Resim %50'nin altına yalnızca taştığı ölçülen sayfada iniyor.
- **Panel:** her ikinci alıştırma kitabın panel tonunda (PDF + web).
- **Sütun genişliği:** metin sütunlarına sabit genişlik. Sabit genişlikli çizgiyle eşleştirme çizimi yandaki sütunu tek kelimelik şeride sıkıştırıyordu.
- **Düz akış:** düz akışa düşen kaynak sayfası da yoğun dizimde basılıyor; resmi kırpılmış ve ortalanmış.
- **`dropWriterLayouts`:** yazar bir bloğa kendiliğinden `layout {width: 10}` yazmıştı. Bu, sayfayı kaynak düzeninden çıkarıyor ve bloğu kelime kelime basıyordu; KIYAS-11'de düz akışa düşen sayfanın gerçek sebebi buydu.
- **Yazar:** ölçülmüş sayfada kaynakta olmayan tablo ve bilgi kutusu yazmıyor.
- **Resim çerçevesi (`pictureFraming`):** büyük yuvaya "kenardan kenara renkli sahne", küçük yuvaya "tonlu zeminde büyük tek nesne". Ücretsiz mod prompt'unda stil sınırı 420 → 600 karakter (ipucu kesiliyordu).

KIYAS-11, yeni üretim kurallarıyla yeniden dizim: yapı %62 → **%83**, görünüm %45 → **%56**. Sıkılaştırılan veya düz akışa düşen sayfa yok (önce 4 ve 1).

Görüntü: `.relayout/KIYAS-11-sonra.png`.

Yazar kuralları ve resim çerçeveleri ancak yeni bir canlı üretimde (KIYAS-12) görülebilir. Cloudflare kotası günde yaklaşık iki küçük kitaba yetiyor; bugün biri kullanıldı.

### KIYAS-12 — KIYAS-11 düzeltmelerinin canlı doğrulaması (2026-10-19)

Proje `689c4744`, run `43933441`. Ayarlar KIYAS-11 ile aynı. Uçtan uca tamamlandı (07:42 → 08:10 UTC).

**Cloudflare kotası doldu:** 4 karakter çizimi ve kapaktan sonra 8 sayfa resminin 8'i de üretilemedi. Bu yüzden resim çerçevelemesi (`pictureFraming`) test edilemedi. Kotanın UTC 00:00'da sıfırlandığı varsayımı doğru çıkmadı ya da kota çok çabuk tükeniyor; bir sonraki görselli test için kota durumu önceden doğrulanmalı.

**Yazar:**
- 6 sayfanın 5'inde alıştırma sayısı kaynakla aynı; resim promptu sayısı hepsinde aynı; yer tutucu yok.
- Tablo/bilgi kutusu kuralı kısmen tuttu (2 sayfada tablo kaldı).

**Puan (canlı, resimsiz):** yapı %55, görünüm %42.

**Yeni hata (`e3d2002` ile düzeltildi):** `topUpExercises`'in eklediği alıştırmalar yine `layout {width:100}` taşıyordu. Bu adım yazar temizliğinden sonra çalıştığı için 3 sayfa kaynak düzeninden çıktı ve metni kelime kelime basıldı. `appendExercises` artık konumu siliyor.

Düzeltilmiş yeniden dizim: yapı %59, görünüm %48.

Görüntü: `.relayout/KIYAS-12-kaynak-canli-duzeltilmis.png`. Satırlar: kaynak / canlı / düzeltilmiş.

**Faz G — görünümü yakalama (plan):**
- **G5 (önce):** fidelity skoru ikiye ayrılacak, yapı ve görünüm. Görünüm tarafında ölçülecekler:
  - resim kutusu örtüşmesi
  - renk histogramı
  - mürekkep yoğunluğu
  - kelime/madde oranı
  - düşük çözünürlüklü görüntü benzerliği

  0'a karşı 0 "uygulanamaz" sayılacak.
- **G1:** mupdf ile kaynaktan renk/font/kenar boşluğu çıkarımı ve bunlardan kaynaktan türeyen bir tema.
- **G2:** source-zones resim yokken de kullanılacak (yer tutucuyla); taşmada önce küçültme yapılacak.
- **G3:** resimler ölçülen x/y/w/h kutusuna, slotun en-boy oranında yerleşecek.
- **G4:** yazar kaynağın yoğunluğunda yazacak. Ölçülmüş sayfada 220–320 kelime kuralı yok, alıştırma sayısının %100'ü istenecek, sayfa mobilyası (ünite bandı, numara rozetleri, tonlu paneller) eklenecek.

**Açık kalan (ürünleşme):**
- Kota/faturalama yok.
- Tüm Blob dosyaları public ve silinmiyor.
- `assembleAndSaveBooks` tek adım (zaman aşımı + tekrar denemede yinelenen satır).
- Adım yazmaları idempotent değil.
- İptal edilen run canlı iş akışınca geri yazılabiliyor.
- Eşzamanlı rerun yarışı.
- Kaynak PDF'e sayfa sınırı yok.
- İndeks yok.
- İçerik/son onay ekranları yetersiz önizleme gösteriyor.
- Resimli kitapta ders kitabı etiketleri görünüyor.

---

## 2. Yapılanlar (commit sırasıyla)

| Commit | Ne yapıldı |
|---|---|
| `68b0fc3` | **Ölçerek dizme:** Kitap dizilir, taşan sayfalar ölçülür, düz akışla yeniden dizilir → boş sayfa yok. Kısa kutular bölünmez. Boş cevap anahtarı sayfası basılmaz. Eksik cevap anahtarlarını odaklı bir AI adımı tamamlar. Tasarım döngüsü şablon değiştirmeden önce sığma kontrolü yapar. |
| `412fba0` | **Workbook alıştırma türleri:** `picture_label`, `picture_match`, `word_bank`, `write_lines`, `draw_box` (`src/lib/activities.ts`). PDF + web + EPUB. Workbook/Test cevapları artık soruların altında değil, sadece kitap sonunda (Teacher's Book'ta altta). |
| `22c2bfc` | **Twemoji ikonları:** Yazar her resim için bir emoji seçer, PDF Twemoji 15.1.0'dan çizer (`src/lib/pdf/emoji-icons.ts`). Künye sayfasında CC-BY 4.0 atfı. |
| `c400d58` | **Kodla çizilen diyagramlar:** Yer edatı sahneleri (in/on/under/next to/behind/in front of/between/above/opposite) ve 3×4 kasaba haritası (`src/lib/diagrams.ts`). PDF + web + EPUB (satır içi SVG). |
| `cd9d072` | **Fontlar:** Kalın yazı hiç basılmıyordu (değişken font sorunu) → tüm fontlar ağırlık başına statik dosya. Yeni OFL fontlar: Baloo 2, Andika, Nunito (her biri Türkçe harf harf kontrol edildi; Fredoka ı/ş/ğ eksik olduğu için elendi). Kalıcı test: `src/lib/pdf/fonts.test.tsx`. |
| `79be43b` | **Canlı testten:** Resim seçilmeyen alıştırmalar için `fillMissingPictures` adımı; yer edatı maddeleri boşluk (`___`) içermek zorunda. |
| `3d7a539` | **Canlı testten (en ciddisi):** Tasarım döngüsünün sayfa yeniden yazımı alıştırmaları, resimleri ve tüm cevap anahtarını siliyordu → `mergePageRewrite` (`src/lib/design/merge-rewrite.ts`). Harita cevapları ızgaradan hesaplanıp düzeltiliyor (`src/lib/map-answers.ts`). |
| `4b8f13e` | **Canlı testten:** Yer edatı cevapları çizimden alınıyor; kelime kutusu ile cevap uyumlu hâle getiriliyor (`reconcileWordBank`); hâlâ taşan sayfa için sıkıştırılmış 3. dizme geçişi; cevap anahtarında satır sonu kısa çizgi sorunu giderildi. |

## 2b. Uçtan uca denetim (2026-10-12)

Üç ajan frontend, backend ve üretim hattını salt-okuma inceledi (plan: `~/.claude/plans/projeyi-bastan-sona-tum-wild-rose.md`).
- **Frontend:** tüm linkler/butonlar çalışıyor, onay kapıları API ile uyumlu.
- **Backend:** başka kullanıcının verisine erişim (IDOR) yok, şema↔migration uyumlu.
- **Üretim hattı:** kaynak PDF deterministik ayrıştırılmıyor (tümü LLM'e gidiyor). `schemas.ts`'te anılan `zone-layout.ts` hiç yazılmamış. Gerçek workbook alıştırmalarının çoğu yok (bulmaca, kelime avı, tick/cross, look-and-number, hikâye şeridi…). Tamamlayıcı kitap kaynaktan yapı almıyor. Büyük PDF'te sayfa haritası kesilir.

**Faz A — güven/stabilite düzeltmeleri (yapıldı):**
| Sorun | Düzeltme |
|---|---|
| Hook henüz kayıtlı değilken gelen onay çalışan run'ı "başarısız" yapıyordu | `src/lib/approval.ts`: gerçek iş akışı durumu (`getRun().status`) kontrol ediliyor; canlıysa "tekrar dene" |
| Onaydan sonra aynı kapı aktif butonlarla geri geliyordu, 2. karar sessizce kayboluyordu | İletilen karar `run_events` (kind `gate`) ile işaretleniyor; ikinci gönderim 409, sayfa "Kararın iletildi" gösteriyor |
| Varyant seçimi ünite no'sunu istemciden alıyordu | Tüm kapı token'ları sunucuda `currentGateToken(run)` ile üretiliyor |
| `start()` hatası run'ı sonsuza dek `pending` bırakıyordu; iptal yoktu | `src/lib/start-run.ts` (`launchRun`) + `POST /api/projects/[id]/cancel` + "Üretimi durdur" butonu |
| Yeni/başarısız run bitmiş kitapların indirmelerini gizliyordu | `deliveredBooks` + DOCX/LMS export son *tamamlanmış* run'dan |
| Ana hat onayında geçersiz ünite limiti "tüm üniteler" oluyordu | 1–30 doğrulaması, aksi 400 |
| Sıfırdan modunda ISBN gönderilmiyordu | Gönderiliyor + doğrulanıyor |
| Stüdyo boş girdiyle ücretli anlamsız görsel/ses üretiyordu; yeni sonuçlar sohbette görünmüyordu | Son hikâye metni kullanılıyor (yoksa 400); `messageId`/`prompt` dönüyor |
| PDF'te makine izleri | Kapakta "Generated with…" ve "PRACTICE" rozet yazısı kaldırıldı; sayfa no yalnızca "n" |
| Tamamlayıcı/öğretmen/test sayfaları görsel numarasıyla çakışabiliyordu | `renumberSidePages` (`src/lib/page-numbers.ts`) |

Doğrulama: `tsc` temiz, `vitest` 46 dosya / 293 test geçti (yeni: `approval.test.ts`, `page-numbers.test.ts`). Canlı onay-kapısı testi henüz yapılmadı (gerçek üretim gerektiriyor).

Daha önceki işler (6 fazlık yeniden tasarım, Süreç Günlüğü, onay kapısı düzeltmesi vb.) için: `git log`, `ROADMAP.md`.

---

## 3. Canlı kıyas testi — sonuçlar

**Kaynak:** British Council LearnEnglish Kids "Directions 1" (2 sayfa, scratchpad'de `worksheets-directions-1.pdf`; blob: `bc-directions-1-TH8vrtMoL1A4XNI0knK9Y65KkNOrrU.pdf`).
**Ayarlar:** Workbook, A1, tema `playful-kids`, sanat stili `flat-vector`, logo atlandı (başka kurumun logosu kullanılmaz).

| Deneme | Proje | Sonuç |
|---|---|---|
| KIYAS-2 | `0e1dfa26…` | ❌ Üretim sırasında iş akışı kodu değiştirildiği için bozuldu (bkz. Kural 1) |
| KIYAS-3 | `9fc67cbb…` | 🟡 İçerik iyi ama tasarım döngüsü alıştırmaları sildi → `3d7a539` ile düzeltildi |
| KIYAS-4 | `1ef1c96a…` | ✅ Resimli ızgara + yer edatı sahneleri + harita + doğru cevap anahtarı. Kalan hatalar `4b8f13e` ile düzeltildi ve gerçek içerik yeniden dizilerek doğrulandı |

Hiçbir denemede sahne görseli üretilemedi (Cloudflare kotası). Uyarılar Süreç Günlüğü'nde görünüyor.

### Gerçek Student Book ile canlı test (2026-10-12)

**Kaynak:** `i_5_team_2.pdf` (Express Publishing, 25 sayfa). **Ayarlar:** A2, klasik tema, sayfa boyutu "kaynakla aynı", ünite sınırı 1, ücretsiz mod (Gemini flash-lite + Cloudflare flux).

| Deneme | Proje | Sonuç |
|---|---|---|
| KIYAS-6 (1. çalıştırma) | `0823d36d…` | ❌ Ünite yazımında başarısız. Sebep: `zonePlan` alanı yazar modelin şemasına girmişti, Gemini reddetti (HTTP 400). Düzeltme `c014536`, ayrıca tüm model şemaları için kalıcı test eklendi |
| KIYAS-6 (yeniden çalıştırma) | `f15dab2c…` | ✅ Uçtan uca tamamlandı: 25/25 sayfa ölçüldü, boyut otomatik 220×280 seçildi, kitap adı koruması kaynak adını yakaladı ("Bright Sparks Explorer"), karakterler, kapak, görsel inceleme, tasarım denetimi, son onay, PDF/baskı PDF/EPUB. **Yapısal benzerlik ~%39**: yazar model ölçülmüş plana uymadı (5 alıştırma yerine 1–2, resim promptu yok) |
| KIYAS-7 | `08aff180…` | 🟡 Plana uyma kontrolü (`df6dffe`) ile tekrar. Varyant 2 kaynağa belirgin biçimde yakın (alıştırma 1/4/2/3/3/3, kaynak 2/5/3/3/3/3; resimli sayfalarda resim promptları tam). İçerik onayında bekliyor: geliştirme sunucusu düşük bellek yüzünden durduruldu. Sunucu yeniden başlayınca onaylayıp `scripts/fidelity.mts` ile puanlanacak |
| KIYAS-7 (yeniden dizim) | `08aff180…` | ✅ Tamamlandı. Kayıtlı içerik, cevap sızdıran tablo ve metin-sayfası kurallarıyla yeniden dizildi: **~%78**, 6 kaynak sayfa → 6 sayfa (önce 12) |
| KIYAS-9 | — | ✅ Temiz üretim (Cloudflare kotası doluydu, görsel yok): **~%54**, 6 sayfa → 6, alıştırma 19 kaynakta → 11 üretimde |
| KIYAS-10 | `edebe9b3…` | ❌ İçerik onayından sonra gece ağ kesildi; veritabanı yazmaları (hatayı kaydeden dahil) başarısız oldu, proje sonsuza dek "işleniyor" göründü. Düzeltme `9c5bd0f`: `reconcileLostRun` 2 dk ilerlemeyen üretimi gerçek iş akışı durumuyla karşılaştırıp "durdu" olarak kapatıyor (canlı doğrulandı). Aynı commit: alıştırma tamamlama artık cevap anahtarı eksik alıştırmaları atmıyor (anahtarı sonraki adım yazıyor) |

### 2026-10-14 — ölçümle bulunan üç yapısal hata
| Bulgu | Etki | Düzeltme |
|---|---|---|
| Resimler sayfa boyu tek bir arka plan görseline gömülü (çizgi roman kareleri, sınıf fotoğrafı) | `i_5_team_2.pdf`: 25 sayfanın 12'si böyle; 10'u **0 resim** ölçülüp resimsiz üretiliyordu | `252891c`: bu sayfalar render edilip metin dışındaki dokulu bölgeler XY-kesme ile resim kutusu olarak bulunuyor; 12 sayfanın hepsi artık resimli, düz renkli arka planlar 0 kalıyor |
| react-pdf, birimsiz `lineHeight`'ı yazının kendi puntosu yoksa 18 pt ile çarpıyor | Tüm alıştırma/paragraf metni 10 pt yazıda 25 pt aralıkla basılıyordu: sayfa yarı boş görünüp yine de taşıyordu | `974c050`: bu stiller fontun doğal aralığını kullanıyor. KIYAS-9 yeniden dizildi: taşan sayfa 2 → 0, toplam 10 → 9 sayfa |
| Alıştırmalar kaynaktan kısa (≈7 yerine 3 madde) | Sayfalar seyrek | `56a0185`: `sourceShape.items` + `topUpExercises` kısa alıştırmalara madde ekliyor (canlı: 3 → 7 madde, cevap anahtarıyla) |

Not: Analizör artık gömülü resimleri saydığı için benzerlik puanları daha katı. KIYAS-9 (görselsiz) yeni ölçüyle %38; eski satır aralığıyla aynı içerik %29. Görselli bir üretimde resim/yerleşim boyutları da puan alacak.

**Açık:** `TEMPLATE_SAFETY` payları (`src/lib/design/layouts.ts`) eski, şişkin satır aralığına göre kalibre edilmişti; artık fazla temkinli. Görselli tam kıyastan sonra gerçek render'a göre yeniden kalibre edilecek.

**Canlı testte bulunup düzeltilenler:**
- Gemini şema hatası (`zonePlan` → saklama şeması).
- Eşzamanlı onayların ikisinin de kabul edilmesi (atomik kapı, migration 0041).
- Kaynak kitap adının kopyalanması (`title-guard.ts`).
- Stüdyoda görselin hikâye yerine onay notundan üretilmesi ve yanlış sahne çizilmesi.
- "Kitaba dönüştür"ün onay notunu taşıması.
- Clerk butonunun hydration hatası (formdaki girdiyi siliyordu).
- Kapak görseline başlığın yanlış yazılması ("EXPLOPER").
- "1 units".
- mupdf'in iş akışı paketine girip geliştirme sunucusunu çökertmesi.

**Arayüzde tıklanarak doğrulananlar:**
- 102 sayfalık link taraması, hepsi 200.
- Tüm onay kapıları (yanlış durumda 409), "Kararın iletildi" kilidi, durdur + sil.
- ISBN ve ünite sınırı doğrulaması, "kaynakla aynı" boyut seçeneği.
- Okuyucu (liste / sayfa çevir / 3D), Dizilim (kaydet + yeniden derle), arama, tema, stüdyo.
- DOCX ve LMS dışa aktarma; yeniden derlenen PDF'te sayfa aralıklı içindekiler.

---

## 4. Kalanlar (öncelik sırasıyla)

**Faz B — kaynağın formatını yakalamak (2026-10-12, yapıldı, canlı üretimle henüz doğrulanmadı):**
| | Ne yapıldı | Commit |
|---|---|---|
| B1 ✅ | `src/lib/source-layout.ts`: her kaynak sayfa mupdf ile **ölçülüyor**. Ölçülenler: içerik görselleri (arka plan, şerit, ikon ve üst/alt bantlar ayıklanıyor), metin sütunları, kelime sayısı, numaralı alıştırma başlıkları ile madde numaralarının ayrımı, alıştırma yönergeleri, font boyutları, sayfa boyutu. Sayfa haritası 12'şer sayfalık parçalarla çıkarılıyor; uzun kitapta kesilme yok. Sayfa metni artık modelin yazdığı değil, PDF'in metin katmanı. Atlanan sayfa için taslak kayıt açılıyor. | `4867fad` |
| B2 ✅ | `src/lib/design/zones.ts`: ölçülen sayfadan **bölge planı** çıkıyor. Bant türleri: resim satırı, yanda resim + metin, metin, resimleri sütun içinde olan iki bağımsız sütun. Bu plana göre dizilen "source-zones" düzeni PDF ve web okuyucuda ortak; sığmazsa resimler %50'ye kadar küçülüyor, yine sığmazsa şablona düşüyor. Bu sayfalarda alıştırmalar çerçevesiz basılıyor, yayınevi gibi. Yazara ölçülen plan gidiyor: resim, alıştırma ve madde sayısı, sütun, kelime, alıştırma biçimleri. | `4867fad` |
| B3 ✅ | Sayfa başına birden çok görsel (`extraImagePrompts`, `extraImageKey`); üretim, yeniden üretim, PDF ve okuyucu destekliyor. Ana görsel en büyük yuvaya yerleşiyor. | `4867fad`, `b3fcd21` |
| B4 ✅ | 7 yeni alıştırma türü: crossword, wordsearch, unscramble, odd_one_out, tick_cross, ordering, match_lines. Izgaralar kodla ve deterministik üretiliyor. Doğrulama ve onarım adımları var. PDF, web ve EPUB destekli. ✓/✗ işaretleri Noto Sans Symbols 2 ile basılıyor. EPUB'da diyalog, tablo ve bilgi kutuları artık kaybolmuyor. | `73ade97` |
| B5 🟡 | İçindekilerde ünite sayfa aralıkları ("pp. 4-12") var; alıştırmalar sayfa içinde 1, 2, 3 diye numaralanıyor. **Kaynağın sayfa boyutu henüz uygulanmadı:** DB enum'una yeni değer (ör. 220×280 mm) eklemek için migrasyon gerekiyor, kullanıcı onayı bekleniyor. Beceri matrisi (Vocabulary/Grammar/Skills sütunları) yapılmadı. | `c8a9fb8` |
| B6 ✅ | Tamamlayıcı kitap ölçülen kaynak üniteden plan alıyor: sayfa sayısı, sayfa başına alıştırma ve madde, serinin alıştırma biçimleri, ders sırasına bağlılık. | `90b8ffc` |
| B7 ✅ | `scripts/fidelity.mts` + `src/lib/fidelity.ts`: üretilen PDF de aynı analizciyle ölçülüp kaynakla sayfa sayfa puanlanıyor (resim, alıştırma, sütun, yerleşim). Kaynak kendisine karşı %100. Örnek render'da (kaynak s.17 ve s.13 planıyla, kasıtlı az içerikle) %65 çıktı; aradaki farkı içerik yaratıyor (7'ye karşı 3 alıştırma). | `b3fcd21` |

**Sıradaki adım:** `i_5_team_2.pdf` ile canlı üretim (KIYAS-6), ardından `npx tsx scripts/fidelity.mts i_5_team_2.pdf <üretilen.pdf>` ile puanlama.

**Önceki liste:**

1. ⏳ **Görselli tam kıyas testi (KIYAS-5)** — Cloudflare kotası UTC gece yarısı yenilenince aynı ayarlarla yeniden çalıştır; kapak/karakter/ünite görselleri dahil sonucu kaynakla yan yana koy.
2. 🔍 **Son düzeltmelerin canlı doğrulaması** — `4b8f13e`'deki kesin kurallar (çizimden cevap, kelime kutusu uzlaştırma, sıkıştırılmış dizme) KIYAS-5'te gerçek üretimde gözlemlenmeli.
3. 🖼️ **Resim zenginliği** — Kaynakta özel çizilmiş renkli resimler var, bizde emoji. Alternatif: kota varken alıştırma resimlerini de AI ile üretmek (emoji yedek kalır) veya ücretli görsel model.
4. 🗺️ **"Map Activity" tutarlılığı** — Bazen bir alıştırma aynı sayfada olmayan bir haritaya atıf yapıyor. Kontrol eklenebilir: haritaya atıf yapan madde varsa sayfada harita olmalı.
5. 📄 **Sayfa yoğunluğu** — Kaynağın 2 sayfasına karşılık bizde içerik ~3 sayfa + sözlük + cevap anahtarı. Sözlüğün iki sayfaya bölünmesi iyileştirilebilir.

**Ertelendi (hedef için gerekli değil):**
- Dinleme parçaları için QR kod (yalnızca ses varsa anlamlı)
- Ünite açılışını sağ sayfaya denk getirme (basılı, çok üniteli kitaplar için)
- CMYK / PDF-X dönüşümü (matbaa yapabilir; gerekirse Ghostscript)

---

## 5. Bilinen sınırlar ve alternatifleri

| Sınır | Alternatif / durum |
|---|---|
| Ücretsiz AI Gateway katmanı engelli | `AI_PROVIDER_MODE=free` (Gemini flash-lite + Cloudflare flux) ile çalışılıyor |
| Cloudflare: günde 10.000 neuron, prompt ≤ 2048 karakter | Kısa prompt (`compactImagePrompt`); kota bitince uyarı + görselsiz devam |
| react-pdf değişken fontlarda kalınlığı yok sayıyor | Statik font dosyaları (çözüldü) |
| react-pdf CMYK üretemiyor | RGB çıktı; gerekirse Ghostscript ya da matbaa |
| Yapay zekâ kurallara her zaman uymuyor | Her kritik kural için kesin (deterministik) yedek: cevap anahtarı, resim seçimi, çizimden cevap, harita cevapları, kelime kutusu |

---

## 6. Çalışma kuralları

1. **Üretim sürerken `workflows/book-pipeline.tsx` (ve iş akışının kullandığı `src/lib` dosyaları) değiştirilmez.** Geliştirme sunucusu kodu canlı yükler, çalışan üretim "replay divergence" ile bozulur (KIYAS-2 böyle kaybedildi).
2. Her düzeltme önce birim testiyle, sonra mümkünse gerçek içerikle (rasterize edilmiş sayfa görüntüsüyle) doğrulanır.
3. Başka kurumların logosu/markası üretilen kitaba konmaz.
4. Commit mesajları `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` ile biter; `.q.mjs`, `.watch.mjs`, `.stats.mjs` commit'lenmez.

---

## 7. Kıyas testini yeniden çalıştırma

1. `npx next dev -p 3111`
2. Tarayıcıda (oturum açık) `/projects/new` sayfasında konsoldan `POST /api/projects` — gövde: `bookType: 'workbook'`, `level: 'A1'`, `designTheme: 'playful-kids'`, `artStyle: 'flat-vector'`, `blobUrl` (yukarıdaki kaynak), `filename: 'worksheets-directions-1.pdf'`.
3. Onaylar: dizelge → logo yok/atla → karakterler → içerik → son onay.
4. Durumu izle: `node .watch.mjs <runId> 590 <geçilen-durumlar>`
5. PDF: `generated_books.pdf_blob_url` → rasterize → kaynakla yan yana.
