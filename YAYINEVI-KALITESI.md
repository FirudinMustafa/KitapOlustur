# Yayınevi Kalitesinde Çıktı — Canlı Takip

> **Amaç:** İnternetten bulunan bir Workbook / Student Book PDF'ini sisteme yüklediğimizde, yayınevi kalitesinde **benzer** (birebir kopya değil, özgün) bir kitap almak.
> Bu dosya her çalışma adımında güncellenir. Son güncelleme: **2026-10-12**. Branch: `redesign/ui`.

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
