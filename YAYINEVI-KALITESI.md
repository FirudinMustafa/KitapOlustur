# Yayınevi Kalitesinde Çıktı — Canlı Takip

> **Amaç:** İnternetten bulunan bir Workbook / Student Book PDF'ini sisteme yüklediğimizde, yayınevi kalitesinde **benzer** (birebir kopya değil, özgün) bir kitap almak.
> Bu dosya her çalışma adımında güncellenir. Son güncelleme: **2026-10-10**. Branch: `redesign/ui`.

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

**Kısa cevap:** Alıştırma yapısı, sayfa düzeni ve cevap doğruluğu bakımından kaynağın profesyonel bir benzeri çıkıyor. Görsel zenginlik (sahne illüstrasyonları) görsel servis kotasına bağlı ve henüz görselli bir tam test yapılmadı.

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
