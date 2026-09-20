# KitapOlustur — Detaylı Ürün & Mimari Yol Haritası

## Uygulama Durumu (canlı takip — her faz tamamlandığında güncellenir)

| Faz | Durum | Not |
|---|---|---|
| G1 — `recordUsage` concurrency düzeltmesi | ✅ Tamamlandı (2026-09-19) | Aşağıda "G1 — Tamamlanma Notu" |
| Faz D — Görsel/Grafik QA Ajanı | ✅ Tamamlandı (2026-09-19) | Aşağıda "Faz D — Tamamlanma Notu" |
| Faz E — Kitap-geneli tutarlılık/pedagoji denetçisi | ✅ Tamamlandı (2026-09-19) | Aşağıda "Faz E — Tamamlanma Notu" |
| Faz F — Yasal/orijinallik kontrolü | ✅ F1 + F2 tamamlandı (2026-09-20) | Aşağıda "Faz F — Tamamlanma Notu" ve "Faz F2 — Tamamlanma Notu" |
| G2 — Test kapsamı | 🟡 Başlangıç kapsamı tamamlandı (2026-09-19) | Aşağıda "G2 — Tamamlanma Notu" |
| G3 — Admin/yetkilendirme | ✅ Kod + provizyon tamamlandı (2026-09-19) | Aşağıda "G3 — Tamamlanma Notu" |
| G4 — Retry/backoff standardizasyonu | ✅ Tamamlandı — ama planlanandan farklı (2026-09-19) | Aşağıda "G4 — Tamamlanma Notu", **roadmap'in orijinal varsayımını düzeltiyor** |
| G5 — Maliyet/kullanım dashboard'u | ✅ Tamamlandı (2026-09-19) | Aşağıda "G5 — Tamamlanma Notu" |
| G6 — Gözlemlenebilirlik | 🟡 Kısmen tamamlandı — daraltılmış kapsam (2026-09-19) | Aşağıda "G6 — Tamamlanma Notu" |
| Faz H — Genişleme fikirleri | ✅ H1, H2 (Faz 1+2+3), H3, H4, H5, H6 tamamlandı (2026-09-20) | Aşağıda ilgili "Tamamlanma Notu" bölümleri |
| Hikaye Stüdyosu — serbest, chat-tabanlı içerik paneli | 🟡 Kod tamamlandı, canlı test bir hesap kısıtlamasıyla bloke (2026-09-19) | Aşağıda "Hikaye Stüdyosu — Tamamlanma Notu" |
| Genel değerlendirme sonrası ek işler (görsel açıklama, çok-sesli diyalog, EPUB, LMS, F2, okunabilirlik QA, H2) | ✅ Tamamlandı (2026-09-20) | Aşağıda ilgili bölümler, ROADMAP sonunda |

**✅ Migration + seed durumu (2026-09-19 güncellendi):** Tüm 5 migration (`0007`-`0011`) `npm run db:migrate` ile canlı veritabanına uygulandı; `npm run db:seed` ile 10 nice-to-have item + 3 stil profili yüklendi. Artık bekleyen migration yok.

**✅ Production deploy + canlı test — Tamamlandı (2026-09-19):** Kod push edildi, gerçek üretim engeli bulundu ve çözüldü (aşağıda G3 notunda ayrıntı), site canlıda: **https://kitap-olustur.vercel.app**. Chrome üzerinden gerçek bir uçtan uca test yapıldı: Google OAuth ile giriş (`firudinmustafayev@stu.topkapi.edu.tr`), ana sayfa/proje listesi/yeni proje formu (Hedef dil, Stil profili, Üretim kalitesi alanları dahil — hepsi DB'den doğru veriyle render oluyor) doğrulandı. Gerçek bir PDF yükleyip tam AI pipeline'ını tetiklemedik (maliyet/süre gerektirir). Bu test sırasında oluşan gerçek Clerk user ID'si (`user_3JYB9Ys2vsaQ1iRi7mLjpCouGSq`) ile **"Firudin WorkBook" projesi artık bu kullanıcıya atanmış durumda** — aşağıdaki uyarı artık çözüldü.

**Bilinen, henüz çözülmemiş tek sorun:** Clerk **development** anahtarlarıyla (`sk_test_`/`pk_test_`) çalışıyor. Giriş yapmamış bir ziyaretçi doğrudan `/` gibi korumalı bir sayfaya girerse 404 alıyor (`X-Clerk-Auth-Reason: protect-rewrite, dev-browser-missing`) — ama `/sign-in`'den gerçekten giriş yapan bir kullanıcı için her şey doğru çalışıyor (test edildi, doğrulandı). Kalıcı çözüm: Clerk'i **Production instance**'a yükseltmek (`pk_live_`/`sk_live_` anahtarları) — bu, Clerk dashboard'undan (veya Vercel'in Clerk entegrasyon kaynağı sayfasından) yapılması gereken bir adım, kullanıcının kendisinin tamamlaması gerekiyor.

**Eski "Kritik uyarı" — çözüldü (2026-09-19):** "Firudin WorkBook" (id: `ce7b1681-cd6d-4b03-8519-effe3d1f3b99`) artık canlı testte oluşan gerçek Clerk user ID'sine (`user_3JYB9Ys2vsaQ1iRi7mLjpCouGSq`, `firudinmustafayev@stu.topkapi.edu.tr`) atanmış durumda — `/projects` sayfasında görünüyor olmalı. Geriye kalan 5 proje ("Faz0 Bugfix Test", "Prod Test 2", "Sample Coursebook Test" vb.) hâlâ `owner_id = null` ile duruyor ama bunlar test/demo verisi gibi göründüğü için düşük öncelikli bırakıldı — istenirse aynı yöntemle (Clerk Backend API'den user ID çekip `UPDATE projects SET owner_id = ...`) claim edilebilirler.


> Bu doküman, `simdi-senle-bir-brainstorming-harmonic-wall.md` plan dosyasındaki özet roadmap'in
> ince-iş detaylarıyla genişletilmiş halidir. Her faz için: amaç, veri modeli değişiklikleri,
> pipeline entegrasyon noktası, prompt/algoritma tasarımı, UI etkisi, başarısızlık modları ve
> bağımlılıklar verilmiştir. Kod değişikliği içermez — implementasyon öncesi referans dokümandır.

## 0. Mevcut Sistemin Zemin Haritası (referans)

Aşağıdaki fazların hepsi bu somut yapı üzerine inşa edilecek:

**Veritabanı (`src/db/schema.ts`, Drizzle/Postgres):**
- `projects(id, name, level, createdAt)`
- `sourceUploads(id, projectId, blobUrl, filename, bookType[student_book|workbook], createdAt)`
- `niceToHaveItems(id, key, label, description, sortOrder, isDefaultSelected)`
- `generationRuns(id, projectId, workflowRunId, status, currentStage, selectedNiceToHaveIds[], customNotes, unitLimit, requestedBookTypes[], variantCount, modelVersion, tokenUsage, coverImageUrl, pageImageUrls, pendingVariants, errorMessage, createdAt, updatedAt)`
  - `status` enum: `pending → mapping_pages → extracting → analyzing → awaiting_outline_approval → (generating ⇄ awaiting_variant_selection) → reviewing → generating_images → assembling → done | failed`
- `extractedOutlines(id, runId, outline jsonb, createdAt)`
- `sourcePageMaps(id, runId, totalPages, pages jsonb, createdAt)`
- `unitReviews(id, runId, unitNumber, reviewType[structure|language], passed, issues[], createdAt)`
- `generatedBooks(id, runId, bookType[student_book|workbook|teacher_book|test_booklet], content jsonb, markdown, pdfBlobUrl, createdAt)`

**Orkestrasyon (`workflows/book-pipeline.tsx`, Vercel Workflow `"use workflow"`/`"use step"`):**
Sıra: `extractPageMap → extractOutline → analyzeImprovements → [awaiting_outline_approval hook] → buildStyleBible → generateCoverImage → (her ünite için: generateMirroredSide → generateComplementarySide → [generateTeacherBookSide ‖ generateTestBookletSide ‖ generateListeningAudio] → reviewUnit ‖ reviewLanguageAccuracy → [varyant modunda: awaiting_variant_selection hook] → generateUnitImages) → assembleAndSaveBooks`

**Modeller (`src/lib/ai/model.ts`):** `BOOK_PIPELINE_MODEL = anthropic/claude-sonnet-5`, `BOOK_PIPELINE_IMAGE_MODEL = google/imagen-4.0-generate-001`, `BOOK_PIPELINE_SPEECH_MODEL = openai/tts-1-hd`.

**Human-in-the-loop deseni:** `createHook<T>({ token })` ile workflow duraklatılıyor, API route (`/api/projects/[id]/approve-outline`, `/select-variant`) hook'u resolve ediyor. Bu desen yeni fazlarda **yeniden kullanılacak** ana mekanizma.

---

## FAZ D — Görsel/Grafik QA Ajanı

### Amaç
`generateUnitImages` ve `generateCoverImage` çıktısını otomatik değerlendirip, sayfa içeriğiyle uyuşmayan/kalitesiz görselleri insan müdahalesi olmadan (veya gerektiğinde insan onayıyla) elemek.

### Veri modeli değişiklikleri
- Yeni tablo `imageReviews`:
  ```
  imageReviews(id, runId, unitNumber, pageNumber, imageUrl, prompt,
    passed boolean, issues text[], attempt integer, createdAt)
  ```
- `generationRuns`'a yeni durum eklenmez (mevcut `generating_images` durumu yeniden kullanılır), ama `currentStage` metni "görsel QA" aşamasını yansıtacak şekilde güncellenir.
- `imageReviews.attempt` alanı, retry sayısını sınırlamak için (max 2-3 deneme, sonsuz döngü riskine karşı).

### Pipeline entegrasyonu
Yeni step: `reviewImage(runId, unitNumber, pageNumber, imageUrl, prompt, pageContext): Promise<{passed: boolean; issues: string[]}>`.

`generateUnitImages` içindeki her görsel üretiminden hemen sonra çağrılır:
```
generateUnitImages(unit) 
  → for each page image: generateImage(prompt) → reviewImage(...) 
    → passed? kullan : yeni prompt ile generateImage tekrar dene (max 2 retry)
    → hâlâ geçmiyorsa: en iyi varyantı işaretleyip devam et + imageReviews'a issue kaydet (üretimi bloklamaz, ama proje sayfasında "görsel manuel incelemesi önerilir" rozeti göster)
```
`generateCoverImage` için de aynı desen — kapak görseli reddedilirse retry, 2 denemeden sonra en son üretileni kullan ve UI'da uyarı göster.

**Neden hard-block değil "soft warn"?** Görsel üretim modelleri (Imagen) deterministik değil; bloklayıcı bir onay adımı workflow'u sık sık `awaiting_*` durumuna düşürüp UX'i yavaşlatır. Bunun yerine varsayılan davranış "otomatik retry + soft warn", kullanıcı isterse (proje ayarında bir toggle ile) "her görseli manuel onayla" moduna geçebilir — bu ikinci mod mevcut `awaiting_variant_selection` hook desenini kullanır (`awaiting_image_approval:${runId}:${unitNumber}:${pageNumber}`).

### Prompt/model tasarımı
`reviewImage` fonksiyonu Claude Sonnet 5'in vision yeteneğini kullanır (`generateObject` + `type: "file"`/`image` content block), girdi:
- Üretilen görsel (base64 veya blob URL)
- Orijinal image prompt
- Sayfa bağlamı (o sayfadaki metin içeriği — hangi aktivite, hangi ünite teması)
- Hedef yaş grubu / seviye (outline'dan `targetAudience`)

Çıktı şeması (zod):
```
{ passed: boolean, issues: string[], suggestedPromptFix?: string }
```
Kontrol kriterleri: (1) içerik-görsel uyumu, (2) yaş grubuna uygunluk (şiddet/uygunsuz içerik yok), (3) metin okunabilirliği (görsel içinde yanlış/bozuk yazı olmaması — Imagen'in bilinen zayıf noktası), (4) stil tutarlılığı (kitap boyunca aynı illüstrasyon stili).

### UI etkisi
- Proje detay sayfasında (`RunStatusView.tsx`) her sayfa görselinin yanında küçük bir "QA: geçti / manuel incelemeye alındı" rozeti.
- Reddedilen/retry edilen görseller için önce/sonra karşılaştırması (opsiyonel, ileri faz).

### Başarısızlık modları & riskler
- Sonsuz retry döngüsü → attempt limiti ile önlenir.
- Vision-model false positive (iyi görseli reddetme) → issues loglanır, kullanıcı override edebilir (manuel "yine de kullan" butonu).
- Maliyet artışı: her görsel için +1 LLM çağrısı (vision) + olası +1 image-gen retry. Faz G'deki maliyet dashboard'u ile izlenmeli.

### Bağımlılıklar
Yok — mevcut `generateUnitImages`/`generateCoverImage` adımlarına doğrudan eklenebilir, diğer fazlardan bağımsız. **Önerilen ilk faz.**

### Faz D — Tamamlanma Notu (2026-09-19)
Planlanan tasarımla birebir uygulandı, "soft warn" modu ile (bloklayıcı değil):
- `src/lib/ai/schemas.ts`: `imageReviewSchema`/`ImageReview` eklendi.
- `src/db/schema.ts`: `imageReviews` tablosu eklendi (`unitNumber`/`pageNumber` nullable — kapak görseli için `null`).
- `drizzle/0007_wealthy_human_torch.sql`: migration üretildi ve **uygulandı** (2026-09-19).
- `workflows/book-pipeline.tsx`:
  - `reviewImage(...)` yeni step — Claude Sonnet 5'in vision girişini (`type: "image"`) kullanarak üretilen görseli prompt + sayfa bağlamına karşı denetliyor, `imageReviews` tablosuna her denemeyi kaydediyor.
  - `generateReviewedImage(...)` yardımcı fonksiyon — generate→review→(gerekirse `suggestedPromptFix` ile) retry döngüsü, `MAX_IMAGE_ATTEMPTS = 3`. Hem `generateUnitImages` hem `generateCoverImage` artık bunu kullanıyor (kod tekrarı yok).
  - Son denemede geçmese bile üretim **bloklanmıyor**, en son üretilen görsel kullanılıyor ve `imageReviews`'a `passed: false` olarak işaretleniyor.
- API (`/api/projects/[id]`) ve sayfa (`src/app/projects/[id]/page.tsx`), her (ünite, sayfa) çifti için **son deneme** kaydına bakıp geçemeyen görsel sayısını (`flaggedImageCount`) hesaplıyor; bu iki yer aynı mantığı bağımsız kopyalıyor (mevcut kod tabanının zaten sürdürdüğü desen — API route ile server component ayrı ayrı sorgu yapıyor).
- UI (`RunStatusView.tsx`): pipeline durum kartında, en az bir görsel bayraklandıysa "N görsel otomatik kalite kontrolünden geçemedi — manuel incelemesi önerilir." uyarısı.
- Doğrulama: `npx tsc --noEmit`, `npx eslint` (ilgili dosyalar) ve `npx next build` üçü de temiz geçti (24 workflow step derlendi, öncekinden +1: `reviewImage`).
- **Yapılmadı / bilinçli olarak ertelendi:** per-image tek tek QA rozeti (görselleri tek tek gösteren bir galeri UI'ı yok, sadece toplam sayaç var) — mevcut UI hiç görsel göstermiyordu (sadece PDF içinde gömülü), bu yüzden kapsam dışında tutuldu. "Her görseli manuel onayla" modu (hook-tabanlı, açık uçlu onay) da eklenmedi — sadece otomatik retry + soft-warn var. İkisi de ayrı bir alt-görev olarak Faz H'ye benzer şekilde backlog'da kalmalı.

---

## FAZ E — Kitap-Geneli Tutarlılık / Pedagoji Denetçisi ("Baş Editör")

### Amaç
`reviewUnit`/`reviewLanguageAccuracy` sadece tek üniteye bakıyor. Kitabın tamamını (tüm üniteler tamamlandıktan sonra) pedagojik açıdan değerlendiren bir "baş editör" rolü ekleniyor.

### Veri modeli değişiklikleri
- Yeni tablo `bookCoherenceReviews`:
  ```
  bookCoherenceReviews(id, runId, passed boolean,
    difficultyProgressionScore integer, -- 0-100
    vocabularyRepetitionScore integer,
    grammarSequencingScore integer,
    thematicConsistencyScore integer,
    issues jsonb, -- [{unitNumber, category, description, severity}]
    createdAt)
  ```
- `runStatusEnum`'a yeni durum: `"reviewing_coherence"` (assembling'den önce).

### Pipeline entegrasyonu
Yeni step: `reviewBookCoherence(runId, outline, units: GeneratedUnit[]): Promise<CoherenceReport>`, tüm üniteler üretildikten sonra, `assembleAndSaveBooks`'tan önce çalışır:

```
... (units döngüsü biter) →
setRunStatus("reviewing_coherence") →
reviewBookCoherence(runId, outline, units) →
  report.passed ? assembleAndSaveBooks(...) 
                : (kritik sorun varsa) awaiting_coherence_approval hook 
                  → kullanıcı "yine de devam et" / "belirli üniteleri yeniden üret" seçer
```
"Belirli üniteleri yeniden üret" seçeneği, mevcut per-unit `buildUnit(feedback)` fonksiyonunu coherence-report'tan gelen feedback ile tekrar çağırır — **kod tekrarı yok, aynı retry mekanizması yeniden kullanılıyor.**

### Prompt/algoritma tasarımı
Girdi: tüm ünitelerin outline'ı + her ünitenin kelime listesi/glossary + gramer odak noktaları (outline'da zaten var olan alanlar) — **tam ünite metinlerini değil, özetlerini** vermek token maliyetini kontrol altında tutar (bir kitap 8-12 ünite olabilir, tam metin vermek context'i şişirir).

Çıktı şeması:
```
{
  passed: boolean,
  difficultyProgressionScore: number,
  vocabularyRepetitionScore: number, // yeni kelimelerin önceki ünitelerde tekrar edip etmediği
  grammarSequencingScore: number,    // gramer konularının mantıklı sırayla verilip verilmediği
  thematicConsistencyScore: number,
  issues: [{ unitNumber, category: "difficulty"|"vocabulary"|"grammar"|"theme", description, severity: "low"|"medium"|"high" }]
}
```
Eşik: herhangi bir skor < 60 veya `severity: "high"` bir issue varsa `passed: false`.

### UI etkisi
- Proje sayfasında yeni bir "Kitap Tutarlılık Raporu" kartı (4 skor + issue listesi).
- "high" severity varsa, ilgili ünitelerin yanında kırmızı rozet + "yeniden üret" butonu.

### Başarısızlık modları & riskler
- Skorlama sübjektif olabilir (LLM'in kendi kalibrasyonu) → ilk sürümde bloklayıcı değil, sadece raporlayıcı (informational) olarak başlatılması önerilir; eşik-tabanlı bloklama ancak birkaç gerçek proje ile kalibre edildikten sonra açılmalı.
- Büyük kitaplarda (12+ ünite) context boyutu — özet-tabanlı girdi ile hafifletiliyor.

### Bağımlılıklar
Yok, ama Faz F (orijinallik kontrolü) ile aynı "kitap-geneli son kontrol" katmanında birleştirilebilir (bkz. Faz F'nin sonunda entegrasyon notu).

### Faz E — Tamamlanma Notu (2026-09-19)
Planlandığı gibi **bilgilendirici (non-blocking)** olarak uygulandı — roadmap'in "Açık Sorular #2" maddesindeki öneriye uyularak bloklayıcı hook eklenmedi:
- `src/lib/ai/schemas.ts`: `coherenceIssueSchema`/`bookCoherenceReviewSchema` (`CoherenceIssue`/`BookCoherenceReview`) eklendi.
- `src/db/schema.ts`: `bookCoherenceReviews` tablosu + `runStatusEnum`'a `reviewing_coherence` değeri (`generating_images` ile `assembling` arasında) eklendi.
- `drizzle/0008_striped_valkyrie.sql`: migration üretildi ve **uygulandı** (2026-09-19).
- `workflows/book-pipeline.tsx`: `reviewBookCoherence(runId, outline, units)` yeni step — tüm ünitelerin outline+glossary **özetini** (tam sayfa metni değil, token maliyeti sınırlı kalsın diye) modele verip 4 skor + issue listesi alıyor, `bookCoherenceReviews`'a kaydediyor. Ana workflow'da ünite döngüsü bitince, `assembleAndSaveBooks`'tan hemen önce çağrılıyor (`scope.mode === "assemble"` — yani sadece yeniden-derleme — yolunda çalışmıyor, çünkü o yol zaten üretilmiş içeriği tekrar kullanıyor).
- `src/lib/run-status.ts`: `reviewing_coherence` için Türkçe etiket eklendi.
- API (`/api/projects/[id]`) ve sayfa (`page.tsx`): run'ın en son coherence raporunu döndürüyor/geçiriyor.
- UI (`RunStatusView.tsx`): "Kitap Tutarlılık Raporu" kartı — 4 skor (0-100) + severity renkli issue listesi. Kart sadece rapor varsa görünüyor, `passed=false` olması hiçbir butonu/akışı bloklamıyor (bilinçli tasarım kararı).
- Doğrulama: `tsc --noEmit`, `eslint`, `next build` temiz (`next build` workflow step sayısı 24 → 25, yeni `reviewBookCoherence` step'i onaylandı).
- **Yapılmadı / bilinçli olarak ertelendi:** eşik-tabanlı bloklama (roadmap'in kendi önerisine göre, gerçek projelerle kalibre edilmeden eklenmemeli), "belirli üniteleri yeniden üret" aksiyonu (raporda issue'lar unit numarasına bağlı olsa da, UI'da henüz "bu üniteyi yeniden üret" butonu yok — mevcut `buildUnit(feedback)` mekanizması teorik olarak buna uygun ama bu run'ın döngüsü tamamlandıktan sonra tek bir üniteyi tekrar tetikleyecek bir API endpoint'i yok, bu ayrı bir alt-görev).

---

## FAZ F — Yasal / Orijinallik Kontrolü

### Amaç
Kaynak kitaba "yapısal olarak benzer ama içerik olarak farklı" üretimin telif riskini ölçmek ve raporlamak. **Not: Bu bir hukuki garanti değil, risk-azaltıcı bir sinyal katmanıdır** — nihai hukuki değerlendirme insan tarafından yapılmalı.

### İki bileşen

**F1 — Deterministik metin-benzerlik skoru (LLM'siz, ucuz, hızlı):**
- Kaynak sayfa metni (PDF'den page-map aşamasında zaten çıkarılan/OCR benzeri veri) vs üretilen sayfa metni arasında n-gram overlap (örn. 5-gram Jaccard benzerliği) veya embedding-cosine-similarity (`text-embedding-3-small` gibi ucuz bir embedding modeli ile).
- Bu adım LLM çağrısı gerektirmediği için pipeline'a **ek maliyet olmadan** her sayfa üretiminden hemen sonra eklenebilir.
- Eşik: embedding-cosine > 0.85 veya 5-gram overlap > %15 → "yüksek benzerlik" bayrağı.

**F2 — LLM-destekli "yapısal mesafe" değerlendirmesi (daha pahalı, opsiyonel/ikinci kademe):**
- Sadece F1'de bayrak alan sayfalar için çalışır (maliyet optimizasyonu).
- LLM'e kaynak sayfa + üretilen sayfa verilir, "bu iki metin arasındaki benzerlik sadece format/aktivite-tipi düzeyinde mi (kabul edilebilir), yoksa cümle/ifade düzeyinde mi (riskli)?" sorusu sorulur.

### Veri modeli değişiklikleri
- Yeni tablo `originalityChecks`:
  ```
  originalityChecks(id, runId, unitNumber, pageNumber,
    ngramOverlapScore real, embeddingSimilarityScore real,
    flagged boolean, llmAssessment jsonb, createdAt)
  ```

### Pipeline entegrasyonu
`generateMirroredSide`/`generateComplementarySide` sonrası, sayfa bazında:
```
checkOriginality(runId, unitNumber, sourcePageText, generatedPageText) 
  → F1 hesapla → flagged ise F2 çalıştır → sonucu kaydet
  → severity yüksekse (F2: "riskli" derse) reviewUnit'in issues listesine eklenir 
    (mevcut retry mekanizmasını tetikler — yeni bir hook gerekmez)
```
Kitap tamamlandığında, Faz E'nin coherence raporuna benzer şekilde bir "Orijinallik Özet Raporu" (`assembleAndSaveBooks`'tan önce) — kaç sayfa flagged, hangi üniteler risk taşıyor.

### UI etkisi
- Proje sayfasında "Orijinallik Raporu" kartı — genel bir risk skoru (düşük/orta/yüksek) + flagged sayfa listesi + her biri için "kaynakla karşılaştır" görünümü (yan yana diff).

### Başarısızlık modları & riskler
- Yanlış pozitif: yaygın İngilizce öğretim kalıpları (örn. "What is your name?") doğal olarak yüksek n-gram overlap üretir → eşikler kalibre edilirken yaygın kalıplar için bir "stopword/kalıp listesi" ile filtrelenmeli.
- Bu katman **hukuki tavsiye değildir** — dokümantasyonda ve UI'da bu netçe belirtilmeli.

### Bağımlılıklar
F1, bağımsız ve ucuz — hemen eklenebilir. F2, Faz E ile birlikte "kitap-geneli son kontrol" aşamasına entegre edilebilir (ikisi de `assembleAndSaveBooks`'tan hemen önce çalışan raporlama adımları).

### Faz F — Tamamlanma Notu (2026-09-19, sadece F1)
**Önemli bir mimari eksiklik keşfedildi ve düzeltildi:** roadmap F1'i yazarken "kaynak sayfa metni (PDF'den page-map aşamasında zaten çıkarılan veri)" zaten var sanılmıştı — ama kod tabanına bakıldığında `extractPageMap`'in ürettiği `sourcePageSchema` sadece bir LLM **özeti** (`summary`) tutuyordu, sayfanın gerçek metnini değil. Bir özetle üretilen metni karşılaştırmak anlamlı bir "kelime kelime benzerlik" sinyali vermez. Bu yüzden önce şemaya gerçek bir alan eklendi:
- `src/lib/ai/schemas.ts`: `sourcePageSchema`'ya opsiyonel `sourceText` alanı eklendi (sayfanın olabildiğince birebir transkripsiyonu).
- `workflows/book-pipeline.tsx` → `extractPageMap` prompt'u, PDF'i zaten tek seferde okuduğu için (ek bir çağrı gerekmeden) bu alanı da doldurmasını istiyor.

F1'in geri kalanı planlandığı gibi:
- `src/lib/originality.ts`: yeni, saf JS — `ngramJaccardSimilarity(sourceText, generatedText, n=5)`. Harici bağımlılık yok, LLM çağrısı yok.
- `src/db/schema.ts`: `originalityChecks` tablosu — `llmAssessment` sütunu şimdiden ayrılmış durumda (F2 ileride şema değişikliği gerektirmeden doldurulabilsin diye), ama şu an hep `null`.
- `workflows/book-pipeline.tsx` → `checkOriginality(...)` yeni step, `ORIGINALITY_NGRAM_THRESHOLD = 0.15` (roadmap'in F1 için önerdiği eşikle aynı). **Sadece mirrored side** kontrol ediliyor (`buildUnit` içinde `generateMirroredSide`'dan hemen sonra çağrılıyor) — çünkü kopyalama riski taşıyan, kaynağı sayfa sayfa yansıtan taraf o; complementary side zaten tanım gereği bağımsız yeni içerik.
- `drizzle/0009_tranquil_sharon_carter.sql`: migration üretildi ve **uygulandı** (2026-09-19).
- API/sayfa/UI: `flaggedOriginalityCount` — mevcut `flaggedImageCount` deseniyle birebir aynı şekilde eklendi, run status kartında "bu bir hukuki değerlendirme değildir" ibaresiyle birlikte gösteriliyor.
- Doğrulama: `tsc`/`eslint`/`next build` temiz (workflow step sayısı 25 → 26, `checkOriginality` onaylandı).

**Bilinçli olarak yapılmayanlar:**
- **Embedding-tabanlı benzerlik skoru** (roadmap'in F1 tanımının bir parçasıydı, n-gram'la "VEYA" bağlacıyla) eklenmedi — bunun için ayrı bir embedding modeli/gateway entegrasyonu gerekir, bu da F1'i "LLM'siz, sıfır ek altyapı" tutma hedefiyle çelişirdi. Sadece n-gram kısmı uygulandı.
- **Yaygın kalıp filtresi** ("What is your name?" gibi doğal olarak yüksek overlap üreten standart İngilizce öğretim kalıpları için istisna listesi, roadmap'in "Başarısızlık modları" bölümünde önerilmişti) eklenmedi — gerçek verilerle kaç yanlış-pozitif üretildiği görülmeden bir istisna listesi yazmak keyfi olurdu; bu, gerçek proje çalıştırmalarından sonra kalibre edilmeli.
- **Sayfa bazlı karşılaştırma UI'ı** ("kaynakla karşılaştır" yan yana diff görünümü) eklenmedi — F2 ile birlikte artık bir "Orijinallik Raporu" bölümü var (aşağıya bakınız), ama bu tam bir yan-yana diff değil, LLM'in metinsel değerlendirmesi.

### Faz F2 — Tamamlanma Notu (2026-09-20)

Genel proje değerlendirmesinde ("orkestranın neresine geldik") en kritik boşluk olarak işaretlenen F2, kullanıcı onayıyla uygulandı.

- `src/lib/ai/schemas.ts`: `originalityLlmAssessmentSchema` — `similarityLevel` (`low`/`medium`/`high`), `rationale`, `concerningPhrases` (kaynak metinden neredeyse birebir alınmış spesifik ifadeler).
- `workflows/book-pipeline.tsx`: `checkOriginality` genişletildi — F1'in n-gram skoru bir sayfayı `flagged=true` yaptığında, **sadece o sayfalar için** `assessOriginalityWithLlm` çağrılıyor (`BOOK_PIPELINE_MODEL`/Sonnet 5, her zaman tam kalite — review/QA adımları taslak modda bile düşürülmüyor kuralıyla tutarlı). İşaretlenmemiş sayfalar için LLM hiç çağrılmıyor — F1'in "sıfıra yakın maliyet" felsefesini bozmadan, gerçek riski olan sayfalara odaklanıyor.
- `src/db/schema.ts`: `originalityChecks.llmAssessment` artık `OriginalityLlmAssessment` tipiyle tiplendirildi (sütun zaten F1'den beri vardı, sadece `null` dolduruluyordu — **migration gerekmedi**).
- API/UI: `/api/projects/[id]/route.ts` ve `src/app/projects/[id]/page.tsx` artık işaretlenmiş satırların tamamını (`llmAssessment` dahil) döndürüyor; `RunStatusView.tsx`'e yeni bir "Orijinallik Raporu" bölümü eklendi — her işaretli sayfa için n-gram yüzdesi + F2'nin similarity-level rozeti + gerekçe + varsa şüpheli ifadeler listeleniyor. "Bu bir hukuki değerlendirme değildir" ibaresi korundu.
- Doğrulama: `tsc`/`eslint`/`vitest` (44 test)/`next build` temiz. Migration gerekmedi.

**Bilinçli olarak yapılmayanlar (F2 kapsamında):** İnsan "hukuki onay" adımı (bir editörün F2 sonucunu görüp resmi olarak onaylaması/reddetmesi) eklenmedi — şu an sadece bilgilendirici gösterim var, workflow'u durduran/bekleten bir onay kapısı değil. Kaynak kitabın telif/lisans bilgisinin kayıt altına alınması (genel değerlendirmede ayrı bir madde olarak işaretlenmişti) F2'nin kapsamı dışında, çözülmedi.

---

## FAZ G — Kalite / Güvenilirlik Altyapısı

Bu faz "yeni bir AI rolü" değil, sistemin production'a hazır olması için gereken mühendislik işleri. Alt-parçalar bağımsız olarak sıraya konabilir.

### G1 — `recordUsage` concurrency düzeltmesi
Mevcut kod yorumunda kabul edilen bilinen sorun: paralel adımlar (`Promise.all` ile çağrılan `reviewUnit`/`reviewLanguageAccuracy`, `generateTeacherBookSide`/`generateTestBookletSide`/`generateListeningAudio`) aynı anda `generationRuns.tokenUsage` JSONB alanını okuyup-yazdığında son yazan kazanır (lost update). Çözüm: Postgres'te atomik JSONB merge (`tokenUsage = tokenUsage || $1::jsonb` şeklinde `UPDATE ... SET` ile) veya ayrı bir `usageEvents` tablosuna append-only kayıt + toplamı view/aggregate ile hesaplama. İkincisi tercih edilir (audit-trail de sağlar).

### G2 — Test kapsamı
Şu an hiç test yok. Öncelik sırası: (1) Zod şemaları için fixture-tabanlı validasyon testleri (`src/lib/ai/schemas.ts`), (2) pipeline step fonksiyonlarının saf mantık kısımları (örn. `buildContentsUnits`) için unit test, (3) `withObjectDiagnostics` gibi hata-yakalama sarmalayıcıları için hata senaryosu testleri. Workflow'un tamamını (LLM çağrıları dahil) test etmek pahalı/kararsız olacağından, LLM çağrıları mock'lanarak entegrasyon testleri yazılmalı.

### G3 — Admin / yetkilendirme katmanı
Şu an proje bazlı erişim kontrolü yok (herhangi bir kullanıcı herhangi bir projeye erişebiliyor gibi görünüyor). Eklenecek: `projects` tablosuna `ownerId`/`teamId`, auth middleware (Next.js middleware katmanında), API route'larda yetki kontrolü. Bu, sistemin tek-kullanıcılı demo'dan çok-kullanıcılı ürüne geçişinin ön koşulu.

### G4 — Retry/backoff standardizasyonu
Şu an sadece TTS üretiminde fallback var. Tüm LLM/image/speech çağrıları için ortak bir `withRetry(fn, { maxAttempts, backoffMs })` sarmalayıcısı (mevcut `withObjectDiagnostics` deseniyle birleştirilebilir) — 429/5xx hatalarında üstel geri çekilme.

### G5 — Maliyet/kullanım dashboard'u
`tokenUsage` verisi zaten toplanıyor (G1 düzeltmesiyle güvenilir hale gelecek). Eklenecek: proje/run bazlı maliyet dökümü (adım bazında: outline çıkarma, ünite üretimi, görsel, TTS, QA katmanları — Faz D/E/F eklendikçe bunlar da ayrı satırlar olarak eklenmeli), basit bir `/api/projects/[id]/usage` endpoint + UI grafiği.

### G6 — Gözlemlenebilirlik (observability)
Workflow adımlarının süresi, hata oranı, retry sayısı gibi metriklerin loglanması (Vercel Workflow'un kendi run trace'i zaten var — buna ek olarak yapısal loglama/hata izleme (örn. Sentry benzeri) entegrasyonu, özellikle `awaiting_*` hook'larının ne kadar süre "askıda" kaldığını izlemek için, çünkü bu kullanıcı deneyiminin kritik bir parçası).

### Bağımlılıklar
G1 ve G4 diğer tüm fazlardan bağımsız, hemen yapılabilir ve Faz D/E/F'nin güvenilirliğini de artırır (öneri: **Faz D'den önce G1'i yapmak**, çünkü yeni paralel adımlar eklendikçe race condition riski büyüyecek). G3 (auth), sistemi gerçek kullanıcılara açmadan önce zorunlu.

### G4 — Tamamlanma Notu (2026-09-19) — roadmap'in orijinal varsayımını düzeltiyor
Roadmap G4'ü yazarken "sadece TTS üretiminde fallback var, diğer her yerde sistematik retry yok" varsayımıyla genel bir `withRetry(fn, {maxAttempts, backoffMs})` sarmalayıcısı öneriyordu. Uygulamaya geçmeden önce `node_modules/workflow` ve `node_modules/@workflow/errors`'ın tip tanımları incelendi ve bu varsayımın **yanlış** olduğu ortaya çıktı:
- `@workflow/errors`'ta `FatalError` şu şekilde belgelenmiş: *"A fatal error is an error that cannot be retried. It will cause the step to fail..."* — yani **her `"use step"` fonksiyonunda `FatalError` DIŞINDA fırlatılan her hata, platform tarafından otomatik olarak retry ediliyor.** Ayrıca retry gecikmesini özelleştirmek için `RetryableError`/`RetryableErrorOptions` (`retryAfter`) da mevcut.
- Bu, `generateObject`/`generateImage`/`generateSpeech` çağrılarının (hiçbiri `FatalError` fırlatmıyor, hata olduğunda sadece propagate ediyor) **zaten platform tarafından otomatik retry edildiği** anlamına geliyor. Genel bir custom retry sarmalayıcısı eklemek, platformun kendi mekanizmasını gölgeleyip iki katmanlı/çakışan bir retry davranışına yol açardı — bu yüzden **eklenmedi**.
- Tek gerçek istisna bulundu: `generateListeningAudio` içindeki per-entry `try/catch`, hatayı yutup platformun retry mekanizmasının hiç devreye girmesine izin vermiyordu (ilk denemede pes edip sessizce audio'suz devam ediyordu). Bu **bilinçli bir tasarım** olarak korundu (tek bir bozuk ses script'i yüzünden tüm ünitenin/step'in bloke olmasını istemiyoruz) ama artık pes etmeden önce `MAX_AUDIO_ATTEMPTS = 3` deneme + kademeli gecikme (`500ms * attempt`) yapıyor.
- **Sonuç:** G4 "yapıldı" ama planlanan şekilde değil — asıl iş bir altyapı inşa etmek değil, mevcut altyapının zaten bunu hallettiğini doğrulamak ve platformun retry'ını fiilen bastıran tek yeri düzeltmek oldu. Bu bulgu ROADMAP'in "Sonraki Adım" bölümündeki genel derse örnek: kod tabanına dair varsayımlar implementasyondan önce doğrulanmalı (Faz F'deki `sourceText` eksikliği keşfiyle aynı desen).
- Doğrulama: `tsc`/`eslint`/`next build` temiz, workflow step sayısı değişmedi (26 — mevcut bir step'in içeriği değişti, yeni step eklenmedi).

### G2 — Tamamlanma Notu (2026-09-19, başlangıç kapsamı)
Roadmap'in G2 önceliklerinden (1) ve kısmen (2) uygulandı; (3) (`withObjectDiagnostics` hata senaryoları) ertelendi:
- `vitest` dev dependency olarak eklendi (proje daha önce **hiç** test framework'ü içermiyordu), `vitest.config.ts` (`@/*`, `@workflows/*` path alias'larını tsconfig ile eşleştiriyor), `package.json`'a `test`/`test:watch` script'leri eklendi.
- `src/lib/ai/schemas.test.ts`: kritik zod şemaları (`pageMapSchema`, `bookOutlineSchema`, `generatedUnitSchema`, ve Faz D/E'de eklenen `imageReviewSchema`/`bookCoherenceReviewSchema`) için fixture-tabanlı geçerli/geçersiz senaryo testleri.
- `src/lib/originality.test.ts`: Faz F1'in `ngramJaccardSimilarity` fonksiyonu için (özdeş metin, alakasız metin, kısmi kelime-kelime tekrar, bağımsız-yazılmış-aynı-konu, büyük/küçük harf duyarsızlığı, çok kısa girdi) senaryoları.
- `src/lib/markdown.test.ts`: `unitsToMarkdown` için (başlık, madde numaralandırma, workbook/teacher_book'ta answer key gösterimi ama student_book'ta gizlenmesi, çoklu ünite ayracı, olmayan varyant için boş sayfa listesi) senaryoları.
- `workflows/book-pipeline.test.ts`: `buildContentsUnits` artık `export` edildi (saf fonksiyon, DB/AI çağrısı yok) ve test edildi.
- 4 test dosyası, 26 test, hepsi geçiyor (`npm run test`).
- **Yapılmadı / bilinçli olarak ertelendi:** `withObjectDiagnostics`'in hata senaryoları (roadmap G2'nin 3. maddesi) — bu, `generateObject`'i mock'lamayı gerektiriyor (AI SDK'nın `NoObjectGeneratedError`'ını simüle etmek), ayrı bir alt-görev olarak bırakıldı. Ayrıca hiçbir pipeline step'i (`generateObject`/`db` çağrısı içerenler) mock'lanarak test edilmedi — sadece yan etkisiz/saf fonksiyonlar test edildi; gerçek entegrasyon testleri (roadmap'in bahsettiği "LLM çağrıları mock'lanarak") hâlâ backlog'da.

### G3 — Tamamlanma Notu (2026-09-19, kod hazır — provizyon edilmedi)
Kullanıcı Clerk'i seçti, sadece kodun hazırlanmasını (gerçek Vercel entegrasyonu/env var kurulumu olmadan) istedi. `vercel:auth` skill'i üzerinden yüklenen rehbere göre uygulandı, ama uygulama sırasında **iki ayrı framework-versiyon tuzağına** çarpıldı — ikisi de önceden koda geçmeden doğrulama yapmanın neden önemli olduğunu bir kez daha gösterdi:
1. **`@clerk/nextjs` 7.9.4 (Core 3, Mart 2026) `<SignedIn>`/`<SignedOut>`/`<Protect>` bileşenlerini kaldırmış** — bunun yerine `<Show when="signed-in">`/`<Show when="signed-out">` kullanılıyor. Bunu skill dökümanı değil, paketin kendi `.d.ts` dosyasındaki (`removedControlComponents.d.ts`) açık hata mesajı üzerinden buldum (`next build` sırasında hata verdi).
2. **Next.js 16, `middleware.ts` dosya kuralını `proxy.ts` olarak yeniden adlandırmış** (`node_modules/next/dist/docs/.../file-conventions/proxy.md`) — `middleware.ts` hâlâ çalışıyor ama deprecated uyarısı veriyor. AGENTS.md'nin "bu Next.js sürümü farklı, kod yazmadan önce docs'a bak" uyarısı tam burada haklı çıktı.

**Yapılanlar:**
- `npm install @clerk/nextjs` (7.9.4).
- `src/db/schema.ts`: `projects.ownerId` (nullable text, Clerk user id). Nullable seçildi çünkü mevcut satırlar (auth öncesi oluşturulmuş projeler) için NOT NULL bir migration otomatik akışta imkansız; **null ownerId, "herkese açık" değil "kimseye ait değil" (erişilemez) olarak yorumlanıyor** — bu bilinçli bir karar, aşağıda not edildi.
- `src/lib/auth.ts`: `requireProjectOwner(projectId)` — tüm proje-bazlı API route'larının çağırdığı ortak yetki kontrolü. Var olmayan proje ile "var ama senin değil" durumunu ayırt etmeden ikisinde de 404 dönüyor (proje id'sinin başkasına ait olduğunu doğrulamamak için).
- `src/proxy.ts` (middleware.ts değil — yukarıdaki bulgu #2): `clerkMiddleware` ile tüm route'lar korunuyor, `/sign-in`, `/sign-up` ve **`/.well-known/workflow/*` hariç** — bu son grup Vercel Workflow platformunun kendi step/webhook callback'leri, bir tarayıcı/Clerk oturumu üzerinden gelmiyor, korumaya alınırsa tüm pipeline kırılır.
- `src/app/layout.tsx`: `ClerkProvider` + `<Show when="signed-in">`/`<Show when="signed-out">` ile basit bir header (`UserButton`/`SignInButton`).
- `src/app/sign-in/[[...sign-in]]/page.tsx`, `src/app/sign-up/[[...sign-up]]/page.tsx`.
- Yetki kontrolü eklenen yerler: `POST /api/projects` (ownerId atanıyor) + `GET /api/projects` (sadece kendi projeleri), `GET /api/projects/[id]`, `POST .../approve-outline`, `.../rerun`, `.../select-variant` (hepsi `requireProjectOwner` çağırıyor), `POST /api/blob/upload` (sadece giriş yapmış olma şartı — proje henüz yok, sahiplik kontrolü mümkün değil), `src/app/projects/page.tsx` (liste, ownerId filtreli), `src/app/projects/[id]/page.tsx` (sahiplik uyuşmazsa `notFound()`).
- `drizzle/0010_unknown_sprite.sql`: migration üretildi ve **uygulandı** (2026-09-19).
- Doğrulama: `tsc`/`eslint`/`vitest` (31 test)/`next build` temiz. **Not:** `next build` öncesi Clerk anahtarları (`CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`) `.env.local`'da yok — build yine de geçti (Clerk, anahtar yokken build-time'da hata vermiyor, sadece prerender edilen sayfa sayısı azaldı: önceki `next build`'lerde `○ (Static)` olan `/` ve `/projects/new` artık `ƒ (Dynamic)` çıkıyor, çünkü `ClerkProvider` sayfayı dinamik hale getiriyor) — ama **runtime'da bu anahtarlar olmadan uygulama gerçekten çalışmaz**, Clerk `auth()`/`clerkMiddleware()` çağrıları anahtar bulamadığında hata fırlatır.

**Provizyon — Tamamlandı (2026-09-19):**
1. ✅ Vercel CLI kuruldu (`npm i -g vercel`), zaten `firudinmustafayev-2074` olarak giriş yapılmış durumdaydı (global config'te önceden kayıtlı).
2. **Gerçek bir bulgu:** `.vercel/project.json`'daki proje bağlantısı (`prj_gPvUlICX6cbkbxjVc4bhdDpHJihF`, `kitap-orkestra`) **artık geçerli değildi** — hem Vercel MCP plugin'i hem CLI bu projeyi "not found" olarak döndürdü (proje muhtemelen silinmiş/yeniden adlandırılmış). `vercel project ls` ile hesaptaki gerçek projeler listelendi, git remote'un (`FirudinMustafa/KitapOlustur`) eşleştiği **`kitap-olustur`** projesi bulundu ve `vercel link --yes --project kitap-olustur` ile yeniden bağlandı. **Bu, deploy geçmişinde bir yerde proje adının değiştiğini/yeniden oluşturulduğunu gösteriyor** — gelecekte benzer bir "linked project not found" hatasıyla karşılaşılırsa aynı teşhis (proje adı listeden aranmalı) uygulanmalı.
3. `vercel integration add clerk --non-interactive` çalıştırıldı — Vercel Marketplace kuralları gereği önce bir tarayıcı adımı (Clerk'in kullanım şartlarını kabul etme) gerekti, kullanıcı bunu tamamladıktan sonra komut tekrar çalıştırılıp başarıyla tamamlandı: `clerk-teal-jacket` kaynağı oluşturuldu, `kitap-olustur` projesine bağlandı, `CLERK_SECRET_KEY`/`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` otomatik olarak `.env.local`'a indirildi (mevcut `DATABASE_URL`/`BLOB_READ_WRITE_TOKEN` gibi diğer değişkenler korundu).
4. `npx next build` gerçek Clerk anahtarlarıyla temiz geçti (26 step, tüm route'lar).
5. `npm run db:migrate` + `npm run db:seed` ile tüm migration'lar ve seed verisi zaten uygulanmıştı (bkz. üstteki durum tablosu).
6. ✅ **Tamamlandı:** "Firudin WorkBook" projesi, canlı testte oluşan gerçek Clerk user ID'sine (`user_3JYB9Ys2vsaQ1iRi7mLjpCouGSq`) Clerk Backend API + doğrudan SQL update ile atandı.

**Production deploy'u bloke eden asıl sorun — çözüldü (2026-09-19), önemli bir bulgu:**
İlk production deploy denemeleri `"message": "Not authorized"` hatasıyla (dashboard'da "firudin085 is not a member of your team" olarak görünüyordu) başarısız oldu, veya hiç build'e girmeden sessizce takıldı. Uzun bir teşhis sürecinden sonra (Vercel Team üyeliği kontrol edildi — `firudin085` zaten DEVELOPER olarak üyeydi; Git bağlantısı `vercel git disconnect`/`vercel git connect` ile sıfırlandı — değişmedi) **asıl sebep bulundu:**
- Yerel `git config user.name`/`user.email`, repo'nun gerçek GitHub sahibinden (`FirudinMustafa`, `firudinmustafayev@stu.topkapi.edu.tr`) **farklı bir kimlikti**: `Firudin085 <firudinmustafayev00@gmail.com>`.
- Vercel'in deploy-yetkilendirme kontrolü, en son commit'in **yazar kimliğini** kontrol ediyor ve bu kimlik (`firudin085`) ile eşleşen bir GitHub hesabının repo/organizasyon erişimi teyit edilemediği için deploy'u reddediyordu — Vercel Team üyeliği (Vercel'in kendi üye listesi) bununla **ayrı bir kontrol katmanı**, ikisi birbirini garanti etmiyor.
- **Çözüm:** `git config user.name "FirudinMustafa"` + `git config user.email "firudinmustafayev@stu.topkapi.edu.tr"` (bu repo'ya özel, global değil), ardından `git commit --allow-empty` ile doğru kimlik altında yeni bir HEAD commit'i oluşturup push edildi. Bir sonraki `vercel --prod` denemesi **sorunsuz build oldu ve `READY` durumuna ulaştı** (38 saniyede).
- **Ders:** "X kullanıcısı takımın üyesi değil" tarzı bir Vercel deploy hatası görülürse, önce Vercel Team üyelik listesine değil, **son commit'in git yazar kimliğine** (`git log -1 --format="%an <%ae>"`) bakılmalı — bunlar farklı kontrol noktaları.
- **Ek not (yanlış teşhis riski):** Bu süreçte, arka planda çalışan deploy komutları sistem belleği kritik seviyeye düştüğü için harness tarafından sonlandırıldı ve bu, geçici olarak "Vercel'de gerçek bir platform sorunu var" şeklinde yanlış bir teşhise yol açtı. Gerçek neden anlaşılana kadar (sistem bildirimi ile) bu ihtimal ekarte edilmedi — ileride benzer "sessizce takılan deploy" durumlarında önce yerel sistem kaynaklarının (bellek, arka plan process'leri) kontrol edilmesi gerekiyor.

**Ayrıca çözülen ikincil sorun — Clerk development-instance 404'ü:**
Deploy başarılı olduktan sonra, Chrome ile canlı sitede uçtan uca test yapıldı (`https://kitap-olustur.vercel.app`). Giriş yapmamış bir ziyaretçi için `/` gibi korumalı sayfalar 404 veriyordu (`X-Clerk-Auth-Reason: protect-rewrite, dev-browser-missing`). Kök neden: Clerk Marketplace entegrasyonu otomatik olarak **development** anahtarları (`sk_test_`/`pk_test_`) sağlıyor, ve bir development instance'ın "dev browser" handshake mekanizması gerçek bir production domain'de (`kitap-olustur.vercel.app`) düzgün çözülmüyor. **Ama gerçek bir kullanıcı `/sign-in` üzerinden gerçekten giriş yaptığında (Google OAuth ile test edildi) her şey doğru çalışıyor** — ana sayfa, proje listesi, yeni proje formu (Hedef dil/Stil profili/Üretim kalitesi alanları dahil) hepsi doğrulandı. Kalıcı çözüm (henüz yapılmadı, kullanıcı kararı/dashboard adımı gerektiriyor): Clerk'i Production instance'a yükseltmek (`pk_live_`/`sk_live_`).

### G6 — Tamamlanma Notu (2026-09-19, daraltılmış kapsam)
Uygulamaya geçmeden önce `node_modules/workflow/dist/observability.d.ts` incelendi: platform zaten `getWorld()`/`world.steps.get(runId, stepId, ...)` ile her step'in I/O'sunu ve (G4'te doğrulanan otomatik-retry mekanizmasıyla birlikte) çalışma geçmişini kendi "world" depolamasında tutuyor — Vercel'in kendi Workflow gözlemlenebilirlik arayüzü muhtemelen bunu zaten gösteriyor. Roadmap'in orijinal G6 tanımı ("adım süresi, hata oranı, retry sayısı") bu yüzden **platformun zaten sağladığı bir şeyi tekrar inşa etmek olurdu** — G4'teki bulgunun aynısı.
- Bunun yerine, platformun sağlamadığı ve gerçekten eksik olan tek şeye odaklanıldı: **bu uygulamanın kendi kullanıcılarının** (proje sahiplerinin) bir run'ın ne kadar süredir bir `awaiting_*` (insan onayı bekleyen) durumda takılı kaldığını, Vercel'in kendi dashboard'una gitmeden, doğrudan bu panelde görebilmesi.
- `src/lib/run-status.ts`: `AWAITING_STATUSES` seti + `formatElapsedTurkish(from, now)` saf fonksiyonu (dakika/saat/gün formatlama, gelecek zaman damgalarına karşı korumalı).
- `src/app/projects/page.tsx`: proje listesinde, `awaiting_*` durumundaki bir run için durum rozetinin altına "N saattir bekliyor" etiketi + rozet rengi amber'e dönüyor — kullanıcı proje listesine girer girmez hangi projelerin dikkat beklediğini görebiliyor.
- `src/app/projects/[id]/RunStatusView.tsx`: aynı bilgi, outline-approval ve variant-selection onay kartlarının başlığında.
- `src/lib/run-status.test.ts`: `formatElapsedTurkish` için 5 test (dakika/saat/gün sınırları, "az önce" durumu, negatif süreye karşı clamp).
- Doğrulama: `tsc`/`eslint`/`vitest`(31 test, 5 dosya)/`next build` temiz. Migration gerekmedi (yeni kolon/tablo yok, mevcut `updatedAt` kullanıldı).
- **Bilinçli olarak yapılmadı:** adım-bazlı süre/hata-oranı/retry-sayısı metrikleri (roadmap'in orijinal G6'sı) — bunlar zaten platformda var, tekrar inşa etmek istenmedi. Harici bir gözlemlenebilirlik servisi (Sentry vb.) entegrasyonu da eklenmedi — bu, `marketplace` skill akışından geçmesi gereken yeni bir üçüncü parti servis kararı, kullanıcı onayı olmadan seçilmemeli.

### G5 — Tamamlanma Notu (2026-09-19)
Yeni migration/tablo gerekmedi — mevcut `generationRuns.tokenUsage`/`pageImageUrls`/`coverImageUrl` kolonları zaten toplanıyordu, eksik olan sadece UI'da göstermekti:
- `src/app/projects/[id]/RunStatusView.tsx`: yeni "Maliyet ve Kullanım" kartı — step-bazlı token dökümü (Türkçe etiketlerle, `STEP_LABELS`), toplam görsel/ses klibi sayısı.
- `src/app/projects/[id]/page.tsx`: SSR ilk yüklemede `coverImageUrl`/`pageImageUrls` artık `RunStatusView`'e geçiriliyor (önceden hiç geçirilmiyordu, sadece polling'de dolaylı olarak API'den gelebilirdi ama tip tanımında yoktu).
- **Maliyet tahmini konusunda bilinçli bir dürüstlük kararı:** Claude Sonnet 5'in güncel fiyatlandırmasını (`claude-api` skill'i üzerinden canlı doğrulandı, training-data'dan hatırlanmadı) kullanarak **tek bir sahte-kesin $ rakamı yerine bir aralık** gösteriliyor ($2/1M girdi – $10/1M çıktı arası) — çünkü `recordUsage` (G1) girdi/çıktı token'larını ayrı tutmuyor, sadece toplamı tutuyor; ayrı tutmaya geçmek G1'in atomik SQL güncellemesini yeniden yazmayı gerektirirdi, bu turda kapsam dışı bırakıldı.
- **Imagen (görsel) ve OpenAI TTS (ses) maliyeti dolar olarak hesaplanmadı, sadece adet gösteriliyor.** Bunlar Anthropic ürünleri olmadığı için elimde güncelliği doğrulanmış bir fiyatlandırma kaynağı yoktu (training data'daki rakamlar güncel olmayabilirdi) — yanlış/eski bir $ rakamı göstermektense hiç göstermemeyi tercih ettim.
- Doğrulama: `tsc`/`eslint`/`vitest`/`next build` temiz.
- **Yapılmadı / bilinçli olarak ertelendi:** ayrı bir `/api/projects/[id]/usage` endpoint'i (roadmap'te önerilmişti) — mevcut `/api/projects/[id]` zaten tüm `run` nesnesini (dolayısıyla `tokenUsage`'ı) döndürdüğü için gereksiz bulundu, ayrı endpoint eklemek veri tekrarı olurdu. Proje-bazlı (tüm run'lar toplamı) bir görünüm de yok — sadece en son run gösteriliyor, roadmap'in "hangi projede... ne kadar harcandı" ifadesi tek-run bazlı yorumlandı.

### G1 — Tamamlanma Notu (2026-09-19)
Roadmap'te önerilen iki seçenekten ("append-only `usageEvents` tablosu" vs "atomik JSONB update") **daha az invaziv olan atomik tek-statement JSONB update** seçildi — migration/yeni tablo gerektirmiyor ve mevcut `tokenUsage` okuma yerini (`run.tokenUsage.total`, `RunStatusView.tsx`) bozmuyor:
- `workflows/book-pipeline.tsx` → `recordUsage(...)`: artık JS tarafında read-then-write yapmıyor; tek bir `UPDATE ... SET token_usage = jsonb_set(jsonb_set(...))` çalıştırıyor, hem `[key]` hem `total` alanını aynı atomik ifadede DB'nin **o anki** satır değerinden hesaplıyor. Postgres'te tek satırlık tek UPDATE atomik olduğu için, `Promise.all` ile aynı anda çağrılan `reviewUnit`/`reviewLanguageAccuracy` gibi paralel adımlar artık birbirinin yazdığını kaybetmiyor.
- Parametreler drizzle'ın `sql` template'i ile bind edildi (`${key}`, `${tokens}`) — ham string interpolasyonu yok, SQL injection riski taşımıyor (zaten `key` değerleri hep sabit literal'lerdi, ama yine de parametrize edildi).
- Doğrulama: `npx tsc --noEmit` temiz. Gerçek eşzamanlı yük altında (örn. 2 review'ın gerçekten aynı anda `recordUsage` çağırması) davranışı doğrulayan bir entegrasyon testi **yazılmadı** — bu Faz G2 (test kapsamı) kapsamına bırakıldı.
- **Not:** `usageEvents` append-only tablosu (audit-trail sağlayan alternatif) hâlâ değerli olabilir — G5 (maliyet dashboard'u) adım-bazlı döküm istediğinde (örn. "bu run'da hangi ünite ne kadar harcadı") mevcut `tokenUsage` (sadece step-key bazlı toplam) yetersiz kalacak, o noktada append-only tabloya geçiş gerekebilir.

---

## FAZ H — Genişleme Fikirleri (öncelik dışı, gelecek vizyonu)

### H1 — Çoklu dil / lokalizasyon
Mevcut şema zaten `outline.contentLanguage` alanı ile dil-agnostik tasarlanmış (İngilizce'ye özel hardcode yok gibi görünüyor). Genişletme: UI'da hedef dil seçimi, `buildStyleBible`'a dil-spesifik pedagojik kurallar (örn. Almanca için cinsiyet/hâl sistemi notları) eklenmesi. Mimari değişiklik küçük; asıl iş prompt mühendisliği ve dil-spesifik QA kriterleri.

#### H1 — Tamamlanma Notu (2026-09-19)
Roadmap'in orijinal H1 tanımı ("hedef dil seçimi... UI/prompt tarafı eksik") tam olarak uygulandı — bir **çeviri** değil, "kaynak PDF hangi dilde olursa olsun, çıktıyı belirtilen dilde yeniden yaz" özelliği:
- `src/db/schema.ts`: `generationRuns.targetLanguage` (nullable text, serbest metin — "Almanca", "German", "de" hepsi kabul, model kendi BCP-47 koduna çeviriyor). `null` = mevcut davranış (kaynağın kendi dili tespit edilip kullanılıyor).
- `workflows/book-pipeline.tsx` → `extractOutline(runId, pdfUrl, pageMap, targetLanguage?)`: `targetLanguage` verilmişse, modele "bookTitle/tone/targetAudience ve her ünitenin title/learningObjectives/keyTerms'ini bu dilde yaz, contentLanguage'ı bu dilin doğru BCP-47 koduna ayarla" talimatı ekleniyor; verilmemişse eski davranış (kaynağın dilini tespit et) korunuyor. **Bundan sonraki hiçbir adım değişmedi** — çünkü `unitGenerationPromptHeader` zaten `outline.contentLanguage`'ı okuyup "tüm içeriği bu dilde yaz" diyordu; hedef dil sadece bu alana yazılan değeri değiştiriyor, downstream'de yeni bir kod yolu gerekmedi.
- `src/app/api/projects/route.ts` + `.../rerun/route.ts`: `targetLanguage` kabul ediliyor/taşınıyor (diğer opsiyonel alanlarla aynı desen).
- `src/app/projects/new/page.tsx`: "Hedef dil (opsiyonel)" serbest metin alanı, boşsa mevcut davranış.
- `drizzle/0013_shiny_black_panther.sql`: migration üretildi ve **uygulandı** (2026-09-19).
- Doğrulama: `tsc`/`eslint`/`vitest` (31 test)/`next build` temiz (26 step değişmedi — mevcut `extractOutline` step'inin imzası genişledi, yeni step eklenmedi).
- **Yapılmadı / bilinçli olarak ertelendi:** dil-spesifik pedagojik kurallar (roadmap'in "örn. Almanca için cinsiyet/hâl sistemi notları" önerisi) eklenmedi — bu, her dil için ayrı ayrı araştırma/prompt mühendisliği gerektiren, tek seferde "genel" olarak yapılamayacak bir iş; şu anki haliyle model kendi dil bilgisine güveniyor. Gerçek kullanımdan (hangi dillerin denendiği, hangi hatalar çıktığı) sonra kalibre edilmesi daha sağlıklı olur.

### H2 — Etkileşimli/Dijital Format Çıktısı — Detaylı Uygulama Planı

**Neden mümkün, temel zemin:** `assembleAndSaveBooks` (workflows/book-pipeline.tsx:~875-900) her kitap tipi için `generatedBooks` tablosuna **tam yapılandırılmış veriyi** (`content: units` — `GeneratedUnit[]`, PDF'e render edilmeden önceki halin ta kendisi) zaten kaydediyor. Yani PDF, bu veriden üretilen **iki çıktıdan biri** olacak şekilde tasarlanabilir; PDF üretimini bozmadan ikinci bir web-render yolu eklemek mümkün. `generatedPageSchema`/`contentBlockSchema` (src/lib/ai/schemas.ts) zaten tipli (`kind`: explanation/example/practice/assessment/reference/narrative; `items`, `answerKey`, `glossary`, `imagePrompt`) — bir React bileşen ağacına birebir eşlenebilir, yeni bir şema tasarımı gerekmiyor.

**Faz 1 — Statik interaktif görüntüleyici (asıl değerin çoğu, en düşük risk):**
- Yeni route: `src/app/projects/[id]/read/[bookType]/page.tsx` — `generatedBooks.content`'i (zaten DB'de duran veri) okuyup PDF yerine React bileşenleriyle render eder. Yeni bir AI çağrısı veya pipeline değişikliği **gerekmez** — salt bir okuyucu/renderer.
- Yeni dosya: `src/lib/web-renderer/` — `unitsToMarkdown` (src/lib/markdown.ts) ile aynı girdiyi (`GeneratedUnit[]`, `Variant`) alan ama Markdown yerine React JSX üreten bir kardeş fonksiyon/bileşen seti. `renderPages`/`pagesForVariant` deseni (markdown.ts'teki) doğrudan referans alınabilir — aynı switch/map mantığı, farklı çıktı.
- İlk etkileşimlilik: `contentBlockSchema.items` (alıştırma soruları) için tıklanabilir "cevabı göster/gizle" (`answerKey` zaten var, PDF'te `<details>` ile yapılıyor — markdown.ts:32-37 — web'de gerçek bir toggle React state'i olur), `listeningAudio[].audioUrl` için gömülü `<audio>` oynatıcı (RunStatusView.tsx zaten bunu yapıyor, aynı desen).
- Bu faz **hiçbir schema/migration değişikliği gerektirmez** — sadece yeni bir okuma route'u ve render bileşenleri.

**Faz 2 — Sesli okuma ile senkron metin vurgulama (karaoke-style):**
- Şu anki `generateListeningAudio` (workflows/book-pipeline.tsx) sadece `entry.script`'i TTS'e verip tam bir ses dosyası üretiyor — kelime/cümle bazlı zaman damgası yok.
- Gerekli: TTS çağrısından sonra (veya ayrı bir adım olarak) forced-alignment — ya OpenAI'nin kendi transkripsiyon/alignment API'si (TTS ile aynı sağlayıcı, script zaten bilindiği için "alignment" yeterli, "transcription" gerekmez) ya da ayrı bir Whisper-tabanlı word-timestamp servisi.
- Yeni şema alanı: `listeningAudioSchema`'ya (src/lib/ai/schemas.ts) opsiyonel `wordTimestamps: {word: string, startMs: number, endMs: number}[]` eklenir.
- Yeni pipeline adımı: `alignListeningAudio(runId, unitNumber, audioUrl, script)` — `generateListeningAudio`'dan hemen sonra çağrılır, "use step" fonksiyonu, sonucu `listeningAudio` objesine ekler.
- Web renderer'da (Faz 1'in üzerine): `<audio>` elementinin `timeupdate` event'i ile mevcut kelimeyi vurgulayan bir React bileşeni.
- **Bu faz Faz 1'den bağımsız olarak ertelenebilir** — kendi başına bir alt-görev, ayrı onaylanabilir.

**Faz 3 — Gerçek etkileşimli aktiviteler (drag-drop, boşluk doldurma vb.):**
- Şu anki `contentBlockSchema` sadece düz metin + `items` (string listesi) tutuyor — "boşluk doldur" veya "eşleştir" gibi yapılandırılmış aktivite tipleri için şemaya yeni alanlar gerekir (örn. `interactiveType: "fill_blank" | "matching" | "multiple_choice"`, `interactiveData: <tipe özel yapı>`).
- Bu, mevcut üretim prompt'larının (`generateMirroredSide` vb.) da güncellenmesini gerektirir — model bu yeni yapıyı doldurmalı.
- **En büyük ve en riskli alt-faz** — mevcut tüm ünitelerin yeniden üretilmesi gerekir (geriye dönük uyumluluk yok), ayrı bir proje kapsamı olarak değerlendirilmeli.

**Bağımlılıklar:** Faz 1 bağımsız, hemen başlanabilir. Faz 2, Faz 1'in üzerine oturur ama paralel geliştirilebilir. Faz 3, şema kırılımı içerdiği için en son ve en dikkatli ele alınmalı.

**Tahmini kapsam:** Faz 1 tek başına orta ölçekli bir iş (yeni route + render katmanı, migration yok). Faz 2 küçük-orta (yeni migration + yeni step + yeni UI parçası). Faz 3 büyük ölçekli (şema kırılımı + prompt yeniden yazımı + geriye dönük uyumsuzluk yönetimi).

### H3 — LMS Entegrasyonu — Detaylı Uygulama Planı

**Neden mümkün, temel zemin:** `generatedBooks.content` (jsonb, `GeneratedUnit[]`) zaten LMS export'un ihtiyaç duyacağı tüm yapılandırılmış veriyi (ünite başlıkları, sayfalar, alıştırmalar, cevap anahtarları, glossary) içeriyor. H2 Faz 1'deki web-renderer tamamlanırsa, LMS export'un "içerik" kısmı (SCORM/Common Cartridge paketinin gösterdiği HTML) o renderer'ın çıktısını yeniden kullanabilir — **bu yüzden H3, H2 Faz 1'den sonra yapılırsa daha ucuz olur.**

**Format seçimi (önce karar verilmeli — bu bir kullanıcı kararı, kod yazmadan önce netleştirilmeli):**
- **Common Cartridge (IMS CC):** Modern LMS'lerin çoğu (Canvas, Moodle, Google Classroom'un bir kısmı) destekliyor; bir ZIP içinde `imsmanifest.xml` + HTML içerik dosyaları. Daha basit, XML şeması nispeten küçük.
- **SCORM (1.2 / 2004):** Daha eski ama hâlâ yaygın (kurumsal LMS'ler); ilerleme takibi (tamamlanma, puan) gerektiren JavaScript API'si (`SCORM API wrapper`) içerir — sadece statik içerik göstermekten daha karmaşık.
- Roadmap'in orijinal notu "Google Classroom/Moodle" diyordu ama **Google Classroom'un kendi native import formatı yok** (Drive dosyası paylaşımı üzerinden çalışıyor) — bu yüzden hedef gerçekte "Moodle + Canvas için Common Cartridge" olarak daraltılmalı.

**Önerilen kapsam (Common Cartridge, statik içerik — ilerleme takibi olmadan):**
- Yeni dosya: `src/lib/lms-export/common-cartridge.ts` — `GeneratedUnit[]` alıp bir ZIP buffer'ı (`imsmanifest.xml` + her ünite için bir HTML dosyası + varsa görseller) üreten saf fonksiyon. H2 Faz 1'in web-renderer'ı varsa, HTML üretimi için onu yeniden kullanır (React'i sunucu tarafında statik HTML'e render ederek — `react-dom/server`'ın `renderToStaticMarkup`'ı, zaten `@react-pdf/renderer` gibi bir sunucu-tarafı render deseni bu projede mevcut).
- Yeni API route: `src/app/api/projects/[id]/export/common-cartridge/route.ts` — `requireProjectOwner` ile korunur, ilgili `generatedBooks` satırını okur, ZIP üretir, `@vercel/blob`'a yükler (mevcut `put()` deseni), indirme linki döner.
- UI: `RunStatusView.tsx`'teki "Üretilen kitaplar" listesine, mevcut "PDF indir" butonunun yanına "LMS paketi indir (Common Cartridge)" butonu.
- **Migration gerekmez** — yeni bir tablo/kolon gerektirmiyor, salt export-zamanlı dönüşüm.

**Bağımsız risk:** IMS Common Cartridge XML şeması gerçek bir LMS'de (Canvas veya Moodle'ın kendisinde) test edilmeden "doğru" olduğuna güvenilmemeli — bir format uzmanı/gerçek LMS test ortamı olmadan üretilen paketin gerçekten import edilebildiği doğrulanamaz. Bu, kodu yazmadan önce değil, yazıldıktan sonra bir gerçek LMS'e yükleyip doğrulanması gereken bir adım.

**Bağımlılıklar:** H2 Faz 1 tamamlanmışsa HTML üretimi tekrar kullanılabilir (önerilen sıra). H2 hiç yapılmazsa, `unitsToMarkdown`'ın çıktısı bir Markdown-to-HTML dönüştürücüden geçirilerek de başlanabilir (daha düşük kaliteli ama bağımsız bir başlangıç noktası).

### H4 — Öğretmen geri bildirim döngüsü
Gerçek kullanım geri bildirimini `buildStyleBible`'a besleme. Teknik olarak: yeni bir `teacherFeedback` tablosu + geçmiş onaylanmış/reddedilmiş varyantları (`pendingVariants` zaten saklanıyor ama seçim sonrası silinmiyor mu kontrol edilmeli — şu an `clearPendingVariants` ile temizleniyor, bu da geçmiş veri kaybı demek) örnek olarak style bible prompt'una few-shot examples şeklinde eklemek. **Not:** bunun için `clearPendingVariants`'ın davranışı gözden geçirilmeli — seçilmeyen varyantları tamamen silmek yerine ayrı bir `variantHistory` tablosuna arşivlemek, gelecekteki öğrenme döngüsü için gerekli ham veriyi korur.

#### H4 — Tamamlanma Notu (2026-09-19)
Roadmap'in H4 notunda, H5'i uygularken bulunan **gerçek bir veri kaybı riski** ("`clearPendingVariants`'ın seçilmeyen varyantları tamamen sildiği") ayrıca işaretlenmişti. Bu turda önce o kök sorunu düzelttim, sonra roadmap'in asıl H4 önerisinin (öğretmen geri bildirimi) **sadece toplama tarafını** ekledim — style bible'a geri besleme (öğrenme döngüsünün kendisi) hiç uygulanmadı, çünkü bunu anlamlı yapacak gerçek kullanım verisi henüz yok:
- `src/db/schema.ts`: `variantHistory` tablosu — artık **seçilmeyen varyantlar da** (`unit` jsonb snapshot'ı + `issues` + `passed` + `selected` flag'iyle) kalıcı olarak saklanıyor, silinmiyor. `teacherFeedback` tablosu — bir run için serbest metin yorum + opsiyonel 1-5 puan.
- `workflows/book-pipeline.tsx`: `clearPendingVariants` kaldırıldı, yerine `archiveVariants(runId, unitNumber, variants, selectedIndex)` geldi — tüm varyantları `variantHistory`'ye yazıp *sonra* `pendingVariants` kolonunu temizliyor (tek step, atomik sıralama; önce yaz sonra temizle, tersi olsaydı bir hata durumunda veri kaybı riski olurdu).
- `src/app/api/projects/[id]/feedback/route.ts`: yeni `POST` endpoint'i, `requireProjectOwner` ile korunuyor, run'ın en son çalışmasına feedback ekliyor.
- `src/app/api/projects/[id]/route.ts` + `page.tsx`: run'ın feedback geçmişini de döndürüyor/geçiriyor.
- `src/app/projects/[id]/RunStatusView.tsx`: run `done` olduğunda "Öğretmen geri bildirimi" kartı — puan (1-5, opsiyonel) + yorum + geçmiş feedback listesi. UI'da açıkça "şu an sadece kaydediliyor, gelecekte kullanılacak" notu var — yanlış beklenti oluşturmamak için.
- `drizzle/0014_orange_micromax.sql`: migration üretildi ve **uygulandı** (2026-09-19).
- Doğrulama: `tsc`/`eslint`/`vitest` (31 test)/`next build` temiz (26 step değişmedi — `archiveVariants` mevcut `clearPendingVariants`'ın yerini aldı, net step sayısı aynı kaldı; yeni `/api/projects/[id]/feedback` route'u build çıktısında görünüyor).
- **Yapılmadı / bilinçli olarak ertelendi (roadmap'in asıl H4 vizyonunun büyük kısmı budur):** feedback'in veya `variantHistory`'nin `buildStyleBible`'a few-shot örnek olarak beslenmesi — bu, gerçek kullanım verisi (hangi varyantlar seçiliyor, hangi geri bildirimler geliyor) birikmeden anlamlı şekilde tasarlanamaz; şimdiden yapılırsa keyfi/varsayımsal bir prompt mühendisliği olurdu. Feedback formunda hangi run'a ait olduğunu gösteren bir seçici yok (her zaman "en son run"a ekleniyor) — birden fazla tamamlanmış run varsa bu bir kısıtlama.

### H5 — Yayınevi "stil profili" kütüphanesi
`buildStyleBible`'ın parametrik hale getirilmesi — önceden tanımlı stil şablonları (örn. "Cambridge-tarzı: görev-bazlı, minimal metin"; "Oxford-tarzı: bağlam-zengin, hikaye-tabanlı") arasında seçim. Yeni tablo `styleProfiles(id, name, description, promptTemplate)`, proje oluşturma formunda seçim alanı.

#### H5 — Tamamlanma Notu (2026-09-19)
Kullanıcı H5'i seçti (Cambridge/Oxford tarzı önceden tanımlı stil şablonları). Mevcut `niceToHaveItems` deseni (tablo → seed-data → `db:seed` → GET API → form checkbox listesi) birebir taklit edildi, sadece checkbox yerine radio (tek seçim) kullanıldı:
- `src/db/schema.ts`: `styleProfiles` tablosu (`key`, `name`, `description`, `promptGuidance`, `sortOrder`, `isDefault`) + `generationRuns.styleProfileId` (nullable FK, `onDelete: "set null"` — bir profil silinirse geçmiş run'lar kırılmasın diye).
- `src/db/seed-data.ts`: `STYLE_PROFILE_DEFAULTS` — 3 profil: `neutral` (varsayılan, mevcut nötr davranışın aynısı), `cambridge_style` (görev-bazlı/minimal metin), `oxford_style` (bağlam-zengin/anlatı-tabanlı). `promptGuidance` alanları doğrudan `buildStyleBible` prompt'una ekleniyor, pazarlama metni değil doğrudan editöre talimat şeklinde yazıldı.
- `src/db/seed.ts`: `style_profiles` için de upsert eklendi (mevcut `niceToHaveItems` upsert bloğunun yanına).
- `src/app/api/style-profiles/route.ts`: yeni GET endpoint (nice-to-have route'unun birebir aynısı).
- `src/app/api/projects/route.ts`: `POST` artık `styleProfileId`'yi kabul edip `generationRuns`'a yazıyor.
- `src/app/api/projects/[id]/rerun/route.ts`: hem "assemble-only" hem normal rerun yolunda, önceki run'ın `styleProfileId`'si korunuyor (kullanıcıya rerun sırasında stil değiştirme UI'ı yok, mevcut `customNotes`/`variantCount` gibi diğer alanların taşınma deseniyle tutarlı).
- `workflows/book-pipeline.tsx`: `fetchRunContext` artık run'ın profilini (yoksa `isDefault=true` olanı) çekiyor; `buildStyleBible(runId, outline, styleProfileGuidance?)` bu metni prompt'a ekliyor.
- `src/app/projects/new/page.tsx`: yeni "Stil profili" fieldset'i (radio butonlar), varsayılan olarak `isDefault` profil seçili geliyor.
- `.env.example`'a Clerk env var'ları için not eklendi (G3'ten kalan bir eksiklik, bu geçişte fark edilip tamamlandı).
- `drizzle/0011_stiff_black_bird.sql`: migration üretildi ve **uygulandı** (2026-09-19); `npm run db:seed` de aynı gün çalıştırıldı (10 nice-to-have item + 3 stil profili yüklü).
- Doğrulama: `tsc`/`eslint`/`vitest` (31 test)/`next build` temiz (26 step — mevcut `buildStyleBible` step'i genişletildi, yeni step eklenmedi; yeni `/api/style-profiles` route'u build çıktısında görünüyor).
- **Yapılmadı / bilinçli olarak ertelendi:** Proje sayfasında seçilen stil profilinin adını gösteren bir UI eklenmedi (sadece proje oluşturma formunda seçiliyor, sonradan görüntülenmiyor) — küçük bir eksik, istenirse kolayca eklenir.

### H6 — Maliyet-kalite trade-off modu
Kullanıcının "taslak" (ucuz/hızlı model) vs "final" (Sonnet 5) modları arasında geçiş yapabilmesi. `BOOK_PIPELINE_MODEL` sabitinin proje/run bazlı override edilebilir hale getirilmesi (`generationRuns.modelVersion` alanı zaten var, şu an kullanılıyor mu kontrol edilmeli — yoksa bu alanı fiilen kullanmaya başlamak ilk adım).

#### H6 — Tamamlanma Notu (2026-09-19)
Kullanıcı H6'yı seçti (maliyet/kalite modu). Roadmap'in kendi önerisinden **bilinçli olarak daha dar bir kapsamda** uygulandı — gerekçesi aşağıda:
- `src/lib/ai/model.ts`: `BOOK_PIPELINE_MODEL_DRAFT = "anthropic/claude-haiku-4-5"` + `resolveTextModel(qualityMode)`. **Sadece ünite-bazlı yazım adımlarına** (mirrored/complementary side, teacher's book, test booklet) uygulanıyor — sayfa haritalama, dizelge çıkarma, iyileştirme planı ve style bible her zaman Sonnet 5'te kalıyor. Gerekçe: bu son dört adım kitap başına **bir kez** çalışıyor, ünite yazım adımları ise **ünite × varyant sayısı kadar** çalışıyor (G5'in maliyet dashboard'unda da görüldüğü gibi `unitGeneration` en büyük maliyet kalemi) — yani asıl tasarruf zaten oradan geliyor, ve zayıf bir modelle sayfa haritası/dizelge çıkarmak, sonrasında her şeyin dayandığı yapısal veriyi (Faz F1'in orijinallik kontrolü dahil) bozma riski taşırdı. Review/QA adımları (reviewUnit, reviewLanguageAccuracy, reviewImage, reviewBookCoherence) da her zaman Sonnet 5'te kalıyor, taslak modda bile kalite kontrolü zayıflamasın diye.
- `src/db/schema.ts`: `qualityModeEnum` (`draft`|`final`) + `generationRuns.qualityMode` (varsayılan `final` — mevcut davranışla birebir aynı).
- `workflows/book-pipeline.tsx`: `fetchRunContext` artık `resolveTextModel(run.qualityMode)` ile gerçek model seçimini yapıyor ve **`modelVersion` kolonunu bu gerçek değerle dolduruyor** (önceden hep sabit `BOOK_PIPELINE_MODEL` yazılıyordu — G5 notunda "bu alan var ama kullanılmıyor" diye işaretlenmişti, artık gerçekten kullanılıyor). `UnitGenerationContext`'e `textModel` eklendi, 4 yazım fonksiyonu `input.textModel` kullanıyor.
- `src/app/api/projects/route.ts` + `.../rerun/route.ts`: `qualityMode` kabul ediliyor/taşınıyor (styleProfileId ile aynı desen).
- `src/app/projects/new/page.tsx`: "Üretim kalitesi" fieldset'i (Final/Taslak radio, varsayılan Final).
- **Maliyet dashboard'u (G5) düzeltildi:** `RunStatusView.tsx`'teki sabit Sonnet-5 fiyatlandırması artık `run.modelVersion`'a göre model bazlı seçiliyor (`MODEL_PRICING_PER_MILLION` haritası, Haiku 4.5: $1/$5 per 1M — aynı oturumda `claude-api` skill'i üzerinden canlı doğrulanan tablo). Yine de yaklaşık: taslak modda bile review/extraction adımları Sonnet 5 üzerinden faturalandığı için gerçek maliyet iki fiyatın arasında bir yerde — bu UI'da açıkça not edildi.
- `drizzle/0012_fair_stingray.sql`: migration üretildi ve **uygulandı** (2026-09-19, `npm run db:migrate`).
- Doğrulama: `tsc`/`eslint`/`vitest` (31 test)/`next build` temiz (26 step değişmedi — mevcut step'lerin imzası değişti, yeni step eklenmedi).
- **Yapılmadı / bilinçli olarak ertelendi:** görsel (Imagen) ve ses (TTS) için ayrı bir ucuz/kaliteli mod yok — sadece metin modeli değişiyor; roadmap'in "hızlı/ucuz taslak vs yüksek kalite final" ifadesi burada sadece metin üretimini kapsayacak şekilde daraltıldı. Proje sayfasında seçilen quality mode'u gösteren bir UI etiketi yok (sadece oluşturma formunda seçiliyor).

#### H6 genişletmesi — görsel modeli de tiering'e katıldı (2026-09-19)
Kullanıcı isteği: "birden fazla model seçme şansımız olmalı — daha büyük/kaliteli bir iş için en iyi modeli, daha bütçeli bir alternatif için daha ucuz modeli seçebilmeliyiz." H6'nın "yapılmadı" notundaki boşluğun bir kısmı kapatıldı:
- `src/lib/ai/model.ts`: `resolveImageModel(qualityMode)` eklendi. `final` (varsayılan) → `google/gemini-3-pro-image` (**Nano Banana Pro** / Gemini 3 Pro Image — Google'ın Vercel AI Gateway üzerinden doğrudan erişilebilen, ek hesap gerektirmeyen en üst düzey görsel modeli). `draft` → pipeline'ın H6 öncesinde zaten tek başına kullandığı `google/imagen-4.0-generate-001` (Imagen 4) — yani draft modun görsel maliyeti/davranışı değişmedi, sadece final mod artık daha iyi bir modele yükseltildi.
- `workflows/book-pipeline.tsx`: `generateReviewedImage`/`generateUnitImages`/`generateCoverImage` artık `qualityMode` parametresi alıyor ve `resolveImageModel(qualityMode)` çağırıyor (önceden sabit `BOOK_PIPELINE_IMAGE_MODEL`). `bookPipelineWorkflow` bunu `ctx.run.qualityMode`'dan geçiriyor. Not: `final` zaten varsayılan mod olduğu için, bu değişiklik **mevcut varsayılan davranışı** (her zaman Imagen 4) **değiştiriyor** — yeni varsayılan davranış Nano Banana Pro. Bilinçli bir yükseltme, kullanıcının açık isteği doğrultusunda.
- `src/app/projects/new/page.tsx`: "Üretim kalitesi" radio etiketleri model isimlerini yansıtacak şekilde güncellendi ("Final (Sonnet 5 + Nano Banana Pro)" / "Taslak (Haiku 4.5 + Imagen 4, daha ucuz)").
- **Ses (TTS) için tiering YAPILMADI — araştırıldı, gerçek bir sürüm uyumsuzluğu bulundu:** ElevenLabs için resmi `@ai-sdk/elevenlabs` paketi kuruldu ve denendi, ancak paketin tüm `3.0.x` sürümleri `@ai-sdk/provider` v4 (yani `ai` v7 hattının protokol sürümü) gerektiriyor; bu proje `ai@6.0.230` üzerinde (`@ai-sdk/provider` v3). `tsc` bunu somut bir tip hatasıyla doğruladı: `SpeechModelV4`, `ai@6`'nın `generateSpeech` fonksiyonunun beklediği `SpeechModel` (v2/v3) tipine atanamıyor — bu kozmetik bir tip uyarısı değil, gerçek bir protokol uyumsuzluğu (spec sürümleri arasında runtime davranışı farklı). ElevenLabs'i gerçekten etkinleştirmek için önce `ai` (ve `@ai-sdk/gateway`) paketlerini v7 hattına yükseltmek gerekiyor — bu, `workflows/book-pipeline.tsx`'teki her `generateObject`/`generateImage`/`generateSpeech` çağrısını etkileyebilecek, bu model-tiering işinden çok daha büyük ve riskli, ayrı bir migration. Paket kaldırıldı (`npm uninstall @ai-sdk/elevenlabs`); `resolveSpeechModel(qualityMode)` eklendi ama şimdilik her iki modda da `BOOK_PIPELINE_SPEECH_MODEL` (OpenAI tts-1-hd) döndürüyor — ileride `ai` v7'ye geçilirse tek değişiklik noktası burası olacak.
- Migration/şema değişikliği yok (mevcut `qualityMode` kolonu yeniden kullanıldı).
- Doğrulama: `tsc --noEmit` / `eslint .` (0 hata, önceden var olan 3 uyarı) / `vitest run` (44 test, 6 dosya) / `next build` (Turbopack, temiz) — hepsi geçti.
- **Yapılmadı / bilinçli olarak ertelendi:** Ses (TTS) tiering'i, `ai` v6→v7 upgrade kararı kullanıcıya bırakıldı (büyük, ayrı bir iş). Higgsfield video entegrasyonu (Faz 2, aşağıda) hâlâ kullanıcının kendi hesabı/API key'ini bekliyor.

---

## FAZ "Panel/Çizelge" — Pipeline Görselleştirmesi + Higgsfield Video (2026-09-19)

Kullanıcı, mevcut pipeline'ın (içerik→görsel→ses→alıştırma) panelde çok daha kullanışlı görselleştirilmesini ve gerçek bir video-üretim aşaması (Higgsfield entegrasyonu) eklenmesini istedi. Detaylı plan `C:\Users\DELL\.claude\plans\wobbly-questing-nest.md` dosyasında — burada sadece özet ve tamamlanma notu var.

**Karar:** Faz 1 (panel görselleştirmesi) önce yapıldı — dış bağımlılığı yok. Faz 2 (Higgsfield video) kullanıcının kendi hesabı/API key'i + tam endpoint şeması olmadan **başlanmadı** (araştırıldı: Higgsfield'ın interaktif MCP sunucusu var ama bizim otomatik backend'imiz için gereken şey ayrı bir server-to-server REST API, `api.higgsfield.ai`, API key ile — kullanıcının henüz hesabı yok).

### Faz 1 — Tamamlanma Notu (2026-09-19)
- **shadcn/ui kuruldu** (`npx shadcn@latest init -d`, Base UI primitifleriyle — bu CLI sürümünde varsayılan Radix değil Base UI çıktı) + `Badge`/`Progress`/`Tooltip`/`Collapsible` bileşenleri eklendi. `TooltipProvider` `src/app/layout.tsx`'e sarmalandı.
  - **Gerçek bir bulgu:** shadcn init, `globals.css`'teki `--font-sans` değişkenini `var(--font-sans)` (kendine referans veren, çözülmeyen) olarak yeniden yazdı. Bu proje `next/font/google` kullandığı için (npm'deki `geist` paketi değil), gerçek font sadece `--font-geist-sans` runtime CSS değişkeni üzerinden erişilebilir — literal `"Geist"` font-family adı diye bir şey yok. Düzeltme: `--font-sans: var(--font-geist-sans);` (eski, çalışan davranışa geri döndürüldü, shadcn'in genel "literal isim kullan" tavsiyesi bu projenin font kurulumuna uymuyor).
- `src/lib/run-status.ts`: `PIPELINE_STAGES` (6 aşamalı üst rayı) + `getPipelineStageIndex`/`getPipelineNodeStates`. Ünite döngüsü içinde tekrar eden durumlar (`generating`/`reviewing`/`generating_images`/`awaiting_variant_selection`) bilinçli olarak tek bir "Ünite üretimi" mega-aşamasına toplandı — ayrı ayrı üst-ray node'ları olsaydı her ünitede ileri-geri zıplardı; ince-taneli içerik/görsel/ses/inceleme ayrımı üst rayda değil ünite-bazlı chip grid'inde.
- `src/lib/unit-progress.ts` (yeni): `computeUnitProgress` — ünite-bazlı ilerlemeyi mevcut `unitReviews`/`imageReviews` satırlarından yeniden inşa ediyor. **Önemli bir kısıtlama, açıkça belgelendi:** `generatedBooks` (gerçek içerik) sadece run'ın en sonunda (assembly) yazılıyor, yani aktif bir run sırasında ünite-bazlı gerçek bir sinyal yok — `unitReviews` satırı varlığı "içerik+ses tamam" için proxy olarak kullanılıyor (kod pipeline sırasına göre doğrulandı: `generateListeningAudio` her zaman `reviewUnit`'ten önce tamamlanıyor). Ses için ayrı bir gerçek sinyal yok, içerikle birlikte raporlanıyor — bu bir yaklaşıklama, gizlenmeden yorum satırında belirtildi.
- `src/app/api/projects/[id]/route.ts` + `src/app/projects/[id]/page.tsx`: `unitProgress` hesaplanıp response'a eklendi (mevcut ikili-sorgu deseniyle tutarlı).
- `src/app/projects/[id]/PipelineStageTracker.tsx` (yeni): üst aşama rayı + ünite-bazlı chip grid'i (Badge+Tooltip). `RunStatusView.tsx`'teki eski tek-rozet kartının yerini aldı (maliyet/flag mesajları korunarak).
- Dizelge onayı görünümü (`RunStatusView.tsx`): düz `<ol>` yerine, her ünite için başlık/seviye + pasif (hepsi "beklemede") önizleme chip'leri gösteren kart grid'i.
- **Gerçek veriyle doğrulandı (Chrome, yerel dev server):** "Firudin WorkBook" projesi (gerçek, durdurulmuş bir run, `unitLimit=4`, 8 ünitelik dizelge) açılıp incelendi — üst ray tüm aşamaları doğru gri gösterdi (failed durumda pozisyon uydurmuyor, tasarlandığı gibi), ünite 1'in İçerik+Ses chip'leri doğru şekilde mavi "active" çıktı (currentStage metninden doğru parse edildi), Tooltip hover'da doğru metni gösterdi, konsol hatasız.
- Doğrulama: `tsc`/`eslint`/`vitest` (44 test, 6 dosya)/`next build` temiz. Migration gerekmedi (sadece mevcut veriden hesaplama).
- **Yapılmadı / bilinçli olarak ertelendi:** Faz 2 (Higgsfield video) — kullanıcının Higgsfield hesabı/API key'i yok, tam image-to-video şeması doğrulanmadı; detaylar plan dosyasında.

---

## İleride yapılacak: Çoklu-kullanıcı/organizasyon (ertelendi, 2026-09-20)

Genel proje değerlendirmesinde (2026-09-20) işaretlenen bir boşluk. Kullanıcıyla netleştirildi ve **şimdilik yapılmamasına karar verildi** — bugün bekleyen gerçek bir ortak/öğretmen kullanıcı yok, ileriye dönük bir ihtiyaç. Sonra gündeme gelirse:

- **Kapsam netleşti:** Tam çoklu-kiracılı SaaS değil, "ekip/takım paylaşımı" — birkaç tanıdık/öğretmenin aynı projelere erişmesi. Hem `/projects` (PDF pipeline) hem `/studio` (Hikaye Stüdyosu) için.
- **Tercih edilen altyapı:** Clerk'in kendi Organizations özelliği (davet akışı, rol yönetimi, `<OrganizationSwitcher>` UI'ı hazır geliyor) — kendi `organizations`/`members` tablomuzu sıfırdan yazmaktan çok daha az iş.
- **Önceden kontrol edilmesi gerekenler (kod yazmadan önce):** Clerk Organizations özelliğinin mevcut Clerk instance/plan'da etkin olup olmadığı doğrulanmalı. `projects.ownerId`/`storyProjects.ownerId` (Clerk user id) → `organizationId`'ye taşınması gerekir; nullable tutulup mevcut projelerin "kişisel" kalması geriye dönük kırılmayı önler. Her mevcut yetkilendirme kontrol noktası (`requireProjectOwner`, `requireStoryProjectOwner`, ve ilgili server component'lerdeki inline `ownerId !== userId` kontrolleri) değiştirilmeli.
- **Daha hafif bir alternatif** (eğer tam org/switcher UI'ı gereksiz görülürse): organizasyon kavramı olmadan, sadece "bu projeyi şu email'e paylaş" düzeyinde basit bir `projectMembers` tablosu — Clerk Organizations'ın verdiği değerin çoğunu çok daha küçük bir yüzeyle sağlar.

## Bağımlılık ve Sıralama Özeti

```
G1 (usage-fix) ──┐
                 ├──> Faz D (Görsel QA) ──┐
G4 (retry/backoff)┘                       │
                                           ├──> Faz E + Faz F (kitap-geneli son kontroller, birlikte entegre edilebilir)
                                           │
G3 (auth) ─────────────────(paralel, gerçek kullanıcı açılışından önce zorunlu)
                                           │
                                           └──> G5 (maliyet dashboard — D/E/F'nin ürettiği yeni maliyet kalemlerini de kapsamalı)
                                           
H1–H6: G/D/E/F'den bağımsız, ürün vizyonuna göre istenildiği zaman başlanabilir
```

## Açık Sorular (implementasyon öncesi netleştirilmeli) — hepsi çözüldü, tarihsel kayıt olarak tutuluyor
1. ~~Görsel QA (Faz D) varsayılan olarak "soft warn" mı yoksa "hard block + onay" mı olmalı?~~ → **Çözüldü:** soft warn (Faz D Tamamlanma Notu).
2. ~~Faz E/F bloklayıcı mı, bilgilendirici mi başlamalı?~~ → **Çözüldü:** ikisi de bilgilendirici (Faz E/F Tamamlanma Notları).
3. ~~Orijinallik kontrolü (Faz F) için hukuki bir uzmana danışılacak mı?~~ → **Çözülmedi, kullanıcı kararı bekliyor** — F1 "bu bir hukuki değerlendirme değildir" notuyla birlikte teslim edildi, hukuki danışmanlık yapılmadı.
4. ~~Çok-kullanıcılı hale geçiş (G3) zaman çizelgesi~~ → **Kısmen çözüldü:** G3'ün kodu hazır ama Clerk provizyonu (gerçek env var kurulumu) henüz yapılmadı — bkz. G3 Tamamlanma Notu.

---

## İkinci Geçiş — Gözden Geçirme Notları (eksiklik taraması)

Bu doküman yazıldıktan sonra yeniden okunup şu eksiklikler tespit edilip yukarıya işlendi/eklendi:
- **G6 (gözlemlenebilirlik)** ilk taslakta yoktu, G1-G5 içine eklendi — çünkü `awaiting_*` hook'larının askıda kalma süresi UX açısından kritik ve şu an hiçbir yerde izlenmiyor.
- **H4'teki veri kaybı riski** (`clearPendingVariants`'ın seçilmeyen varyantları sildiği) ilk taslakta belirtilmemişti; gelecekteki öğrenme döngüsü fikriyle doğrudan çelişiyor, bu yüzden not olarak eklendi.
- **Faz F'nin hukuki sınırlaması** ("bu bir hukuki garanti değildir") ilk yazımda zımniydi, açıkça yazıya döküldü — yanlış güven riskini azaltmak için.
- **Maliyet artışı uyarısı** Faz D ve F1/F2 için ayrı ayrı belirtildi; her yeni QA katmanı ek LLM çağrısı demek, bu G5'in kapsamını neden genişletmesi gerektiğinin gerekçesi.
- **Bağımlılık grafiği** ilk taslakta yalnızca düz liste olarak vardı, okunabilirlik için ASCII diyagrama çevrildi.

Eksik kalan ve kasıtlı olarak dışarıda bırakılan konular (kapsam dışı, ayrı bir tartışma gerektirir): fiyatlandırma/iş modeli, spesifik LMS/SCORM format detayları, spesifik auth sağlayıcısı seçimi (Clerk/Auth0/vb.), içerik moderasyonu için üçüncü parti bir servis kullanılıp kullanılmayacağı.

---

## Hikaye Stüdyosu — Serbest, Chat-Tabanlı İçerik Üretim Paneli (2026-09-19)

Mevcut PDF-tabanlı kitap üretim sihirbazından tamamen ayrı, yeni bir özellik: ChatGPT benzeri bir panelde kullanıcı serbestçe hikaye/metin yazdırır, sohbetten görsel ve sesli anlatım isteyebilir (tek başına da, hikayeyle birlikte de) — birden fazla hikaye projesi tutan bir kütüphane ile. Detaylı brainstorming ve mimari kararlar `C:\Users\DELL\.claude\plans\wobbly-questing-nest.md` dosyasında.

### Tamamlanma Notu (2026-09-19)

- **Şema:** `storyProjects`/`storyMessages`/`storyArtifacts` (3 yeni tablo, `src/db/schema.ts`) — mevcut "bir üst + FK'li çocuk tablolar" deseniyle, ama `generationRuns`'ın sabit aşama enum'undan tamamen bağımsız. `storyArtifacts.type` şimdiden `video`'yu enum'da barındırıyor (Higgsfield geldiğinde migration gerekmesin diye) ama hiç doldurulmuyor. Migration `drizzle/0015_tranquil_puma.sql` — kullanıcı onayıyla uygulandı.
- **Backend:** `src/lib/ai/studio-generation.ts` (yeni) — `generateStoryImage`/`generateStoryAudio`, `workflows/book-pipeline.tsx`'teki Blob `put()` deseniyle ama QA retry döngüsü olmadan (kullanıcı-yönlendirmeli serbest içerik, ders kitabı gibi sabit kalite garantisi gerekmiyor). `src/app/api/studio/projects/**` altında 3 route: liste/oluştur, proje+geçmiş detay, ve asıl sohbet turu (`messages/route.ts`) — bu sonuncusu `generateText` + AI SDK v6'nın native `tool()` mekanizmasıyla modelin kendi kararıyla `generateImage`/`generateAudio` araçlarını çağırmasını sağlıyor (`stopWhen: stepCountIs(5)` ile tool-call sonrası modelin son bir metin cevabı üretmesine izin veriliyor). UI'daki "Bunun görselini/sesini üret" butonları aynı route'a bir `action` alanıyla gelip tool-calling'i atlayıp doğrudan `studio-generation.ts` fonksiyonlarını çağırıyor — iki yol da aynı koda çıkıyor, mantık tekrarlanmıyor. Vercel Workflow (`"use workflow"/"use step"`) kullanılmadı — bir sohbet turu tek kısa istek, normal Fluid Compute route handler'a yetiyor.
- **Frontend:** `/studio` (kütüphane listesi, `src/app/projects/page.tsx` ile aynı desen) + `/studio/[id]` (sohbet + galeri çalışma alanı: mesaj balonları, hızlı tür/yaş/ton/dil kontrolleri, hem inline hem yan panelde artifact galerisi). `src/app/layout.tsx` header'ına "Hikaye Stüdyosu" nav linki eklendi.
- **Bilinçli olarak MVP dışı bırakıldı:** Video üretimi (Higgsfield hesabı/API key'i hâlâ yok — bkz. "FAZ Panel/Çizelge" Faz 2 notu). Gerçek token-by-token chat streaming — `@ai-sdk/react`'in (useChat hook'u) **yayınlanmış her sürümünün** (4.0.0'dan 4.0.110'a) `ai@^7.x` gerektirdiği npm üzerinden doğrulandı; kurulu `ai@6.0.230` ile uyumsuz, ElevenLabs'i bloke eden aynı v6→v7 sınırı. Kullanıcı zaten gerçek streaming'i öncelik olarak belirtmedi, bu yüzden MVP'de her sohbet turu tek istek/cevap (mevcut kod tabanındaki her AI çağrısı zaten böyle).
- **Doğrulama:** `tsc`/`eslint`/`vitest` (44 test)/`next build` temiz. Migration uygulandı.
- **Canlı test (Chrome, yerel dev server) — gerçek bir hesap kısıtlamasıyla karşılaşıldı:** `/studio` → "Yeni Hikaye" → sohbet kutusuna kısa bir hikaye isteği yazıldı → **Vercel AI Gateway 403 döndürdü: "Free tier users do not have access to this model"**. Bağımsız bir script ile hem `anthropic/claude-sonnet-5` hem `anthropic/claude-haiku-4-5` doğrudan test edildi, ikisi de aynı hatayı verdi — yani bu Hikaye Stüdyosu'na özgü bir kod hatası değil, **hesabın Vercel AI Gateway erişiminin şu an "free tier" kısıtlamasına takıldığını gösteren bir bulgu**. Aynı `BOOK_PIPELINE_MODEL` sabiti mevcut PDF pipeline'ında da kullanıldığı için, bu kısıtlama muhtemelen o pipeline'ı da etkiliyor olabilir (doğrudan test edilmedi). Bu arada `messages/route.ts`'teki hata yönetimi de düzeltildi: `generateText` hatası öncesinde yakalanmadığı için Next.js'in genel HTML hata sayfası dönüyordu ve frontend bunu ayrıştıramayınca kullanıcıya yanıltıcı bir "ağ hatası" gösteriyordu — artık `try/catch` ile temiz bir JSON hata mesajı dönüyor. **Gerçek düzeltme (Vercel hesabına AI Gateway ödemeli erişim/kredi eklenmesi) kullanıcı aksiyonu gerektiriyor**, kapsam dışı bırakıldı.
- Test sırasında oluşan geçici "Yeni Hikaye" projesi ve mesajları temizlendi (DB'de kalıcı test verisi bırakılmadı).

**Yapılmadı / bilinçli olarak ertelendi:** Sohbet içi kalite modu değiştirme (şu an sadece proje oluşturulurken sabitleniyor, `qualityMode` proje bazlı). Gerçek token-streaming chat (yukarıda gerekçelendirildi, ai v6→v7 sınırı).

### Video altyapısı + gerçek bir görsel-model bug'ının bulunup düzeltilmesi (2026-09-20)

Kullanıcı isteği: "video altyapısı hazır olmalı, API'yi verince direkt çalışmalı." Higgsfield'ın gerçek server-to-server API'si araştırıldı (docs.higgsfield.ai + openapi.json, tahmin edilmedi) ve tam olarak kuruldu; bu sırada canlı testte **iki ayrı, gerçek sorun** bulundu ve ikisi de düzeltildi/belgelendi.

**1) Higgsfield video altyapısı (async submit+poll):**
- `src/lib/ai/higgsfield.ts` (yeni): `submitImageToVideo`/`pollHiggsfieldStatus` — base URL, `Authorization: Key {ID}:{SECRET}` formatı, `/kling-video/v2.5-turbo/standard/image-to-video` endpoint'i (Higgsfield'ın kendi OpenAPI spec'inden confirmed, prose-only doküman örneklerinden değil) ve async `request_id` + `GET /requests/{id}/status` polling deseni hepsi gerçek dokümandan alındı, tahmin edilmedi.
- Higgsfield'ın API'si **senkron değil** — submit hemen `request_id` döner, video dakikalar sürebilir. Bu yüzden `storyArtifacts.status` enum'una `"pending"` eklendi (migration `drizzle/0016_chief_boomerang.sql`, additive: yeni enum değeri + nullable `provider_request_id` kolonu) ve yeni bir poll route eklendi: `src/app/api/studio/projects/[id]/artifacts/[artifactId]/route.ts` — frontend bunu "pending" video artifact'ları için 5 saniyede bir çağırıyor (`StudioWorkspace.tsx`'teki `useEffect`), terminal duruma ulaşınca Higgsfield'ın video URL'ini kendi Blob storage'ımıza indirip kalıcı hale getiriyor (Higgsfield çıktıları sadece "en az 7 gün" garantili).
- `HF_API_KEY_ID`/`HF_API_KEY_SECRET` env var'ları `.env.example`'a eklendi. Anahtarlar eklenene kadar `generateStoryVideo("higgsfield", ...)` her zaman açıklayıcı bir "API key henüz eklenmedi" hatasıyla `failed` dönüyor — başka hiçbir kod değişikliği gerekmeyecek.

**2) Beklenmedik bulgu: Google Veo, Higgsfield'a alternatif olarak aynı Gateway'de mevcut** — canlı `gateway.getAvailableModels()` sorgusuyla keşfedildi: `google/veo-3.1-generate-001`/`veo-3.1-fast-generate-001` bu projenin zaten kullandığı Vercel AI Gateway'de `modelType: "video"` olarak listeleniyor, ayrı hesap/API key gerekmiyor, ve kurulu `ai@6.0.230` paketi `experimental_generateVideo`'yu zaten export ediyor (Higgsfield'ın aksine **senkron** - SDK provider-taraflı polling'i içeride hallediyor). Kullanıcı kararı: **ikisi de tutulsun, seçilebilir olsun.**
- `src/lib/ai/veo.ts` (yeni): `generateVeoVideoFromImage` — `frameImages: [{image, frameType: "first_frame"}]` ile image-to-video.
- `src/lib/ai/model.ts`: `resolveVeoModel(qualityMode)` eklendi (final: `veo-3.1-generate-001`, draft: `veo-3.1-fast-generate-001`).
- `src/lib/ai/studio-generation.ts`: `generateStoryVideo(provider, ...)` artık `"veo"|"higgsfield"` parametresi alıyor, ikisini de aynı `StudioVideoResult` tipine (`pending`/`done`/`failed`) çeviriyor.
- `messages/route.ts`'teki `generateVideo` tool'u ve UI'daki "Bunun videosunu üret" butonunun yanına bir sağlayıcı seçici (`<select>`, varsayılan "Veo") eklendi.
- **Canlı test:** Veo gerçekten çağrıldı (kredi olmadığı için tamamlanamadı ama) net bir hata döndürdü: *"Video generation requires a minimum balance of $10"* — yani Higgsfield gibi ayrı bir entegrasyon derdi olmadan, sadece Vercel hesabına kredi yüklenince çalışacak durumda.

**3) Gerçek bug bulundu ve düzeltildi: görsel modelleri geçersizdi.** Görsel üretimini canlı test ederken (`Bunun görselini üret`), H6 genişletmesinde (2026-09-19) seçilen `google/gemini-3-pro-image` (final) ve `google/imagen-4.0-generate-001` (draft) modellerinin **ikisi de `generateImage()` ile çalışmıyor** olduğu bulundu:
- `google/gemini-3-pro-image` → Gateway hatası: *"is a language model, not an image model. Use the language generation API instead."*
- `google/imagen-4.0-generate-001` → *"Model not found."*
- Kanıt, tahmin değil: `gateway.getAvailableModels()` canlı sorgulandı - Google'ın TÜM Gemini görsel varyantları (`gemini-3-pro-image`, `gemini-3.1-flash-image` vb.) bu Gateway'de `modelType: "language"` olarak kataloglanmış (Nano Banana bir sohbet modeli, görsel parçaları chat çıktısı olarak üretiyor - `generateImage()`'ın beklediği ayrı bir görsel-üretim modeli değil), Imagen ise katalogda hiç yok. `modelType: "image"` olarak listelenen 33 modelin arasından **OpenAI'nin GPT Image ailesi** seçildi: final için `openai/gpt-image-2`, draft için `openai/gpt-image-1-mini`. Düzeltme `src/lib/ai/model.ts`'te - bu sabitler hem PDF pipeline'ı hem Hikaye Stüdyosu'nu besliyor, yani düzeltme her ikisini de kapsıyor.
- **Canlı doğrulama:** düzeltmeden sonra "Bunun görselini üret" tekrar denendi, hata artık "language model, not image model" değil, metin modelleriyle aynı temiz "Free tier users do not have access to this model" - yani model ID'si artık doğru, kalan tek engel hesabın kredi durumu.

Doğrulama: `tsc`/`eslint`/`vitest` (44 test)/`next build` temiz. Migration `0016` kullanıcı onayıyla uygulandı. Test sırasında oluşan geçici veriler temizlendi.

**Yapılmadı / bilinçli olarak ertelendi:** Higgsfield'ın webhook alternatifi (imzasız, public URL gerektiriyor) kurulmadı - polling deseni tercih edildi, yerel geliştirmede de çalışır ve daha az altyapı gerektirir. Nano Banana (Gemini) ailesinin gerçek entegrasyonu (chat-tabanlı görsel üretimi, `generateImage()` değil `generateText()` üzerinden) araştırılmadı/yapılmadı - GPT Image 2/1-mini yeterli bir çözüm olarak seçildi.

---

## Genel değerlendirme sonrası hızlı iyileştirmeler (2026-09-20)

Kullanıcının "orkestranın neresine geldik" değerlendirmesinde önerilen "hemen, düşük efor" maddelerinden biri: görsellere alt-text.

### Görsel açıklama metni (alt-text yerine geçen çözüm)
**Önemli düzeltme:** İlk varsayım ("görsellere alt-text eklemek ucuz bir kazanım") yanlış çıktı — `@react-pdf/renderer`'ın `Image` bileşeninin `alt` prop'u **hiç yok** (kütüphanenin kendi tip tanımlarından doğrulandı: `ImageProps` sadece `src`/`source`/`srcSet`/`sizes`/`cache`/`debug` alıyor). PDF/UA tagged accessibility bu kütüphanede desteklenmiyor.
- Gerçekçi kazanım olarak: her ünite sayfası görselinin altına, o görseli üretmek için kullanılan `page.imagePrompt`'tan türetilen küçük, italik bir açıklama metni eklendi (`src/lib/pdf/BookDocument.tsx`, `pageIllustrationCaption` stili). Kapak görseli için karşılık gelen bir prompt saklanmadığından kapak görseline açıklama eklenmedi.
- Eslint'in `jsx-a11y/alt-text` uyarısı (react-pdf'in `Image`'ını HTML `<img>` sanıyor, false-positive) her iki görsel için de açıklayıcı bir yorumla `eslint-disable-next-line` edildi.
- Gerçek erişilebilirlik (ekran-okuyucu uyumlu format) için hâlâ EPUB/HTML export gerekiyor — bu düzeltme sadece PDF içinde okunabilir bir açıklama ekliyor, tam bir çözüm değil.
- Doğrulama: `tsc`/`eslint` (BookDocument.tsx'teki 2 uyarı da temizlendi)/`vitest` (44 test)/`next build` temiz.

### Çok-sesli diyalog desteği (2026-09-20)

Genel değerlendirmede işaretlenen "dinleme parçaları tek sesli" eksikliğine karşı: `generateListeningAudio` artık diyalogları birden fazla sesle sentezleyebiliyor.

- `src/lib/ai/schemas.ts`: `listeningAudioSchema`'ya opsiyonel `dialogueLines` (`{speaker, line}[]`) eklendi. Yazar prompt'u (`workflows/book-pipeline.tsx`, mirrored side) artık iki+ konuşmacılı bir diyalog tespit ederse bunu doldurmasını istiyor; tek anlatıcılı pasajlarda boş kalıyor (eski davranış aynen korunuyor).
- `workflows/book-pipeline.tsx` → `generateListeningAudio`: 2+ farklı konuşmacı varsa, her konuşmacıya OpenAI'nin 6 standart TTS sesinden (`alloy`/`echo`/`fable`/`onyx`/`nova`/`shimmer` — **canlı test edildi, hepsi çalışıyor**, tahmin edilmedi) sabit bir ses atanıyor (ilk-görünme sırasına göre round-robin), her satır ayrı ayrı sentezleniyor, sonra MP3 buffer'ları art arda eklenerek (concat) tek dosya oluşturuluyor. Herhangi bir satırın sentezi başarısız olursa (retry'lardan sonra bile), yarım/bozuk bir diyalog dosyası göndermek yerine **tamamen eski tek-sesli tüm-script sentezine geri dönülüyor**.
- **Dürüstlük notu:** MP3 concat yöntemi (ffmpeg gibi bir audio-muxing kütüphanesi olmadan) standart bir teknik ve bu ortamda ffprobe/ffmpeg olmadığı için nihai oynatmayı doğrulayamadım — MP3'ün frame-tabanlı, container-index gerektirmeyen yapısı sayesinde tarayıcıların `<audio>` elemanında genelde sorunsuz çalışması beklenir, ama bu "genelde çalışır" bir varsayım, %100 doğrulanmış değil.
- Doğrulama: `tsc`/`eslint`/`vitest` (44 test)/`next build` temiz. Migration gerekmedi (yeni jsonb alanı `generatedBooks.content` içinde saklanıyor, ayrı kolon değil).

**Yapılmadı:** Sesin gerçekten diyalog mu monolog mu olduğunu QA aşamasında doğrulayan bir kontrol yok (yazar modelinin doğru doldurduğuna güveniliyor). ElevenLabs gibi daha zengin/karakter-spesifik seslere geçiş hâlâ `ai` v6→v7 sınırında bloke (H6 notuna bakınız).

### Okunabilirlik/seviye QA (2026-09-20)

Genel değerlendirmede işaretlenen "üretilen metnin gerçekten hedeflenen seviyede olduğunu doğrulayan bir QA yok" eksikliğine karşı. Kullanıcıya klasik Flesch-Kincaid mi yoksa LLM-tabanlı bir değerlendirme mi sorulduğunda **LLM-tabanlı** tercih edildi — gerekçe: bu pipeline her konuda/her dilde çalışıyor (Faz H1), hece-sayma formülleri sadece İngilizce'de anlamlı, diğerlerinde ya yanlış sonuç verir ya da koşullu olarak atlanması gerekirdi.

- `src/db/schema.ts`: `reviewTypeEnum`'a üçüncü değer eklendi: `"level"` (mevcut `"structure"`/`"language"` yanına). Migration `drizzle/0017_sad_brood.sql` — tek satır, additive `ALTER TYPE ... ADD VALUE`.
- `workflows/book-pipeline.tsx`: yeni `reviewReadingLevel(runId, unitNumber, targetLevel, contentLanguage, generated)` — `reviewUnit`/`reviewLanguageAccuracy` ile birebir aynı desende (`BOOK_PIPELINE_MODEL`, `unitReviewSchema` şemasını yeniden kullanıyor, ayrı bir şema gerekmedi), kitabın hedef seviyesine (`outline.level`, örn. "CEFR A2" veya "Grade 7") göre üretilen metnin zorluk derecesinin uygun olup olmadığını değerlendiriyor — ne çok ileri ne çok basit. Hem tekli-varyant hem çoklu-varyant üretim yollarındaki mevcut `Promise.all([reviewUnit, reviewLanguageAccuracy])` çağrılarına üçüncü bir paralel çağrı olarak eklendi; `passed` ve `issues` diğer ikisiyle aynı şekilde birleştiriliyor (varsa geri bildirimle yeniden üretim tetikleniyor).
- Doğrulama: `tsc`/`eslint`/`vitest` (44 test)/`next build` temiz (workflow step sayısı 26 → 27, `reviewReadingLevel` onaylandı). Migration üretildi, henüz uygulanmadı.

**Yapılmadı:** Ayrı bir UI göstergesi eklenmedi — mevcut "review" maliyet kalemine ve geri bildirim/retry akışına sessizce katıldı, `reviewLanguageAccuracy` eklendiğinde de bespoke bir UI gerekmemişti, aynı gerekçe geçerli.

### EPUB export (2026-09-20)

Genel değerlendirmede en yüksek değerli boşluk olarak işaretlenen "tek çıktı formatı PDF" sınırlamasına karşı ilk adım: her kitap tipi artık PDF'in yanında bir EPUB3 dosyası da üretiyor.

- `src/lib/epub/BookEpub.ts` (yeni): `jszip` ile elle inşa edilmiş, gerçek bir EPUB üretim kütüphanesi kullanılmadı — EPUB3'ün kendisi zaten iyi tanımlı, sınırlı bir zip yapısı (mimetype + META-INF/container.xml + OEBPS paket dokümanı + nav.xhtml + XHTML içerik), bu yüzden bilinmeyen kalitede/bakım durumunda üçüncü parti bir kütüphane yerine tam kontrol tercih edildi. `BookDocument.tsx`'in `pagesForVariant`/`showAnswerKey` mantığını birebir kopyalıyor — iki format da aynı içeriği gösteriyor, sadece farklı render ediliyor.
- Görsel ve ses dosyaları **EPUB paketinin içine gömülüyor** (build sırasında Blob URL'lerinden fetch edilip zip'e ekleniyor) — harici referans değil, e-okuyucu uyumluluğu ve kaynak blob silinirse kırılmama için.
- **Bonus:** çok-sesli diyalog desteğiyle (bugün eklendi) üretilen ses klipleri EPUB'a gömülü `<audio controls>` etiketleriyle çalınabilir halde geliyor — PDF'te bu mümkün değildi (statik format).
- **Gerçek erişilebilirlik kazanımı:** `BookDocument.tsx`'in aksine (react-pdf'in `Image`'ı hiç `alt` desteklemiyor, bugün ayrı not edildi), EPUB'daki metin gerçek, taranabilir/okunabilir HTML — ekran okuyucular bunu düzgün okuyabilir. Görsellere yine `alt=""` (dekoratif, boş) verildi ama görsel altındaki `<figcaption>` açıklaması (aynı `imagePrompt`'tan) gerçek, erişilebilir bir alternatif metin sağlıyor.
- `src/db/schema.ts`: `generatedBooks.epubBlobUrl` (nullable text). Migration `drizzle/0018_sturdy_wiccan.sql` — additive, henüz uygulanmadı.
- `workflows/book-pipeline.tsx` → `assembleAndSaveBooks`: PDF'ten hemen sonra, best-effort (try/catch) EPUB üretimi — bir görsel/ses fetch'i geçici olarak başarısız olursa PDF'in kendisi yine de kaybolmasın diye.
- UI: `RunStatusView.tsx`'e "EPUB indir" butonu, mevcut "PDF indir" butonunun yanına eklendi.
- **Test:** `src/lib/epub/BookEpub.test.ts` (yeni, 4 test) — zip yapısının doğruluğu, XML escaping, varyant-bazlı answer-key/sayfa filtreleme. Ağ çağrısı gerektiren görsel/ses gömme yolu test edilmedi (mock'lanmadı) — sadece metin/yapı testleri.
- Doğrulama: `tsc`/`eslint`/`vitest` (48 test, 44→48)/`next build` temiz. Workflow step sayısı değişmedi (27) — EPUB üretimi yeni bir step değil, mevcut `assembleAndSaveBooks` step'inin içinde.

**Yapılmadı/bilinçli olarak ertelendi:** EPUB'un gerçek bir e-okuyucuda (Apple Books, Kindle vb.) canlı açılıp doğrulanması yapılmadı — sadece yapısal (zip içeriği, XML) doğrulama var. DOCX export ayrı, yapılmadı. EPUB/UA (tam erişilebilirlik sertifikasyonu) seviyesinde bir doğrulama (ör. `epubcheck` aracı) çalıştırılmadı.

### H2 Faz 1 — Statik İnteraktif Web Görüntüleyici (2026-09-20)

Kullanıcı üç büyük işten (H2, H3, çoklu-kullanıcı) H2 ile başlamayı seçti. ROADMAP'in kendi önceden yazılmış H2 planındaki Faz 1'i (en düşük risk, migration gerektirmeyen kısım) birebir uygulandı.

- Yeni route: `src/app/projects/[id]/read/[bookType]/page.tsx` (server component, `requireProjectOwner` ile aynı 404-not-403 deseni) + `BookReader.tsx` (client component). `generatedBooks.content`'i (zaten DB'de duran `GeneratedUnit[]` — PDF/EPUB'un render ettiği aynı veri) okuyup yeni bir AI çağrısı veya pipeline değişikliği olmadan React ile render ediyor. `BookDocument.tsx`/`BookEpub.ts` ile aynı `pagesForVariant`/`showAnswerKey` mantığı üçüncü kez tekrarlandı (aynı desen, farklı render hedefi).
- Etkileşimlilik: cevap anahtarı gerçek bir React state toggle'ı ("Cevap anahtarını göster/gizle") — PDF'teki statik gösterim veya EPUB'daki `<details>`'in aksine gerçekten tıklanabilir. Ünite navigasyonu sol panelde, dinleme sesi gömülü `<audio>` ile.
- `RunStatusView.tsx`'e "Etkileşimli oku" linki, "PDF indir"/"EPUB indir" butonlarının yanına eklendi.
- **Canlı testte gerçek bir bug bulundu ve düzeltildi:** İlk implementasyon, bir run'ın generatedBooks satırları arasından **sadece en son oluşturulanı** seçiyordu (`bookType` filtresi olmadan) — birden fazla kitap tipi olan bir run'da yanlış kitap gösterilebiliyordu (örn. "student_book" istenince "workbook" gösteriliyordu). Sorgu `and(eq(runId), eq(bookType))` ile düzeltildi.
- **Canlı testte ikinci bir gerçek bug bulundu ve düzeltildi:** Gerçek, eski (2026-07-17 tarihli) bir test verisiyle denendiğinde sayfa çöktü — o kayıt `studentBookPages`/`workbookPages` alanlarını hiç içermiyordu (mevcut şemadan önceki bir pipeline sürümünden kalma). `generatedBooks.content` tipsiz bir jsonb kolonu olduğu için TypeScript bunu "güvenli" sanıyor ama çalışma zamanında garanti yok — `pagesForVariant`'a her dalda `?? []` savunması eklendi.
- Test verisi: sahipsiz "Sample Coursebook Test 2" projesi geçici olarak kullanıcının hesabına atanıp gerçekçi bir içerikle (kullanıcı onayıyla) canlı test edildi — bloklar, glossary, ünite navigasyonu, dinleme bölümü doğru render edildi, konsol hatasız. Test sonrası hem orijinal `content` hem `owner_id` (NULL) eski haline geri yüklendi — kalıcı test verisi bırakılmadı.
- Doğrulama: `tsc`/`eslint`/`vitest` (48 test)/`next build` temiz. Migration yok (roadmap'in Faz 1 vaadi doğrulandı: gerçekten şema değişikliği gerekmedi).

**Yapılmadı / bilinçli olarak ertelendi:** H2 Faz 2 (sesli okuma ile senkron kelime vurgulama — forced-alignment gerektiriyor, ayrı bir iş) ve Faz 3 (gerçek etkileşimli aktivite tipleri — boşluk doldurma/eşleştirme, şema kırılımı içeriyor, mevcut tüm ünitelerin yeniden üretilmesini gerektirir) roadmap'in kendi notunda da "ayrı, dikkatli ele alınmalı" diye işaretlenmişti — bu turda yapılmadı.

### H3 — IMS Common Cartridge (LMS) Export (2026-09-20)

Kullanıcı H3 ile devam etmeyi seçti. Roadmap'in kendi önerisi (Common Cartridge, statik içerik, ilerleme takibi olmadan — SCORM'un gerektirdiği JS API wrapper'ı olmadan) birebir uygulandı.

- **Refactor önce:** `src/lib/epub/BookEpub.ts`'teki HTML-render yardımcıları (`escapeXml`, `paragraphs`, `pagesForVariant`, `renderBlock`, `renderGlossary`, `fetchAsset`, `extensionForMediaType`) `src/lib/content-html.ts`'e taşındı — Common Cartridge de aynı "ContentBlock'u gerçek HTML'e çevir" işini yapıyor, kod tekrarı yerine paylaşılan modül tercih edildi. `BookEpub.ts` bu modülü import edecek şekilde güncellendi, davranışı değişmedi (4 mevcut EPUB testi hâlâ geçiyor).
- Yeni `src/lib/lms-export/CommonCartridge.ts`: `buildCommonCartridge` — `imsmanifest.xml` (IMS CC 1.1 şeması) + ünite başına bir HTML dosyası + gömülü görseller, `jszip` ile paketleniyor. Roadmap'in kendi notu doğrultusunda hedef **Moodle + Canvas** olarak daraltıldı (Google Classroom'un native import formatı yok).
- Yeni API route `src/app/api/projects/[id]/export/common-cartridge/route.ts` (GET, `?bookType=`) — PDF/EPUB'un aksine **istek anında** üretiliyor (pipeline assembly zamanında değil) — LMS export'un daha az kullanılan bir aksiyon olması bekleniyor, her run'da bu paketleme maliyetini/görsel fetch'lerini ödemenin gerekçesi yok. Blob'a yükleyip doğrudan oraya redirect ediyor — mevcut "PDF indir" linkiyle aynı UX (ekstra client-side JS gerekmiyor).
- UI: "LMS paketi indir" linki, "PDF indir"/"EPUB indir"/"Etkileşimli oku"nun yanına eklendi.
- **Canlı testte gerçek bir bug bulundu ve düzeltildi:** Aynı kitap tipi için export route'u iki kez çağrıldığında (örn. kullanıcı butona iki kez tıklarsa, ya da benim testimde olduğu gibi arka arkaya iki istek), ikinci istek Vercel Blob'un "bu blob zaten var" hatasıyla 500 döndü — çünkü sabit bir path'e (`addRandomSuffix: false`) yazıyor ama `allowOverwrite` belirtilmemişti (PDF/EPUB'da bu sorun yok çünkü onlar run başına sadece bir kez, assembly sırasında yazılıyor). `allowOverwrite: true` eklendi — her istek güncel içerikle üzerine yazıyor, sabit/öngörülebilir bir path koruyor.
- **Canlı doğrulama:** gerçek, authenticated route üzerinden (Chrome'da JS ile `fetch`) çağrıldı, dönen bayt dizisinin gerçek bir ZIP olduğu (PK\x03\x04 magic number) doğrulandı, iki ardışık istek de 200/307 ile temiz sonuçlandı (overwrite düzeltmesi doğrulandı).
- Test: `src/lib/lms-export/CommonCartridge.test.ts` (yeni, 4 test) — zip/manifest yapısı, XML escaping, varyant-bazlı answer-key/sayfa filtreleme.
- Doğrulama: `tsc`/`eslint`/`vitest` (52 test, 48→52)/`next build` temiz. Migration yok.

**Dürüstlük notu (roadmap'in kendi riskiyle aynı):** Bu manifest IMS Common Cartridge 1.1 XSD yapısına göre yazıldı ama gerçek bir Moodle/Canvas ortamına yüklenip "gerçekten içe aktarılabiliyor" diye doğrulanmadı — ne bu oturumda ne daha önce böyle bir ortam mevcuttu. "Şemaya yapısal olarak uyuyor" ile "gerçek bir LMS'e temiz import ediliyor" aynı şey değil; ikincisi gerçek bir LMS test ortamı gerektiriyor.

**Yapılmadı / bilinçli olarak kapsam dışı:** SCORM (1.2/2004) — ilerleme/puan takibi gerektiren JS API wrapper'ı, ayrı ve daha büyük bir iş. Gerçek bir LMS'de import testi (yukarıdaki dürüstlük notu).

### H2 Faz 2 — Sesli Okuma ile Senkron Kelime Vurgulama (2026-09-20)

Kullanıcı H2 Faz 2 ile devam etti. Roadmap'in kendi planı (forced-alignment + karaoke-style web vurgulama) birebir uygulandı — teknik varsayım kodu yazmadan önce **canlı test edildi**.

- **Önce doğrulama:** `openai/tts-1-hd` ile üretilen bir ses, `openai/whisper-1`'e `providerOptions.openai.timestampGranularities: ["word"]` ile verildi — gerçekten kelime-bazlı segment'ler (her biri gerçek `startSecond`/`endSecond` ile) döndüğü canlı test edildi, sağlayıcı dokümantasyonuna güvenilmedi.
- `src/lib/ai/schemas.ts`: `wordTimestampSchema` (`word`/`startMs`/`endMs`) + `listeningAudioSchema.wordTimestamps` (opsiyonel). **Migration gerekmedi** — bu veri `generatedBooks.content` jsonb'sinin içinde yaşıyor, ayrı bir DB kolonu değil.
- `workflows/book-pipeline.tsx`: yeni `alignListeningAudio(runId, unitNumber, listeningAudio)` step'i — `generateListeningAudio`'dan **ayrı** bir step (aynı step'e gömülmedi): hizalama başarısız olup retry edilirse TTS'i tekrar üretmesin diye, mevcut `reviewUnit`/`reviewLanguageAccuracy`/`reviewReadingLevel` ayrı-step deseniyle tutarlı. Best-effort — hizalama başarısız olursa entry `wordTimestamps` olmadan kalıyor, okuyucu düz `<audio>`'ya geri dönüyor.
- `src/app/projects/[id]/read/[bookType]/BookReader.tsx`: yeni `KaraokeAudio` bileşeni — `<audio>`'nun native `timeupdate` event'i (birkaç kez/saniye tetikleniyor, manuel `requestAnimationFrame` döngüsü gerekmiyor) ile mevcut kelimeyi `wordTimestamps` içinde arayıp vurguluyor. `wordTimestamps` yoksa (eski içerik veya hizalama başarısız oldu) sessizce eski düz `<audio>` davranışına düşüyor.
- **Canlı uçtan uca doğrulama (Chrome):** Gerçek bir TTS+alignment çifti üretilip geçici test verisine enjekte edildi, tarayıcıda audio elementinin `currentTime`'ı 500ms'ye ayarlandı, doğru kelimenin ("brown", 440-700ms aralığında) gerçekten vurgulandığı DOM'dan doğrulandı — konsol hatasız. Test verisi ve blob temizlendi.
- Doğrulama: `tsc`/`eslint`/`vitest` (52 test)/`next build` temiz. Workflow step sayısı 27 → 28 (`alignListeningAudio` onaylandı). Migration yok.

**Yapılmadı / bilinçli olarak kapsam dışı:** Çok-sesli diyalog + hizalama birlikte test edilmedi (her ikisi de kendi içinde çalışıyor ama concat edilmiş MP3'ün hizalaması, tek-sesli senaryodan daha karmaşık bir edge case olabilir — ayrı bir doğrulama gerektirir). EPUB/Common Cartridge çıktılarına karaoke vurgulaması eklenmedi (statik formatlar, `timeupdate` event'i olmayan bir ortamda anlamsız — sadece web okuyucuya özgü bir özellik).

### H2 Faz 3 — Gerçek Etkileşimli Aktiviteler (2026-09-20)

Kullanıcı H2 Faz 3 ile devam etti — roadmap'in kendisinde "en büyük ve en riskli, şema kırılımı içeriyor, mevcut ünitelerin yeniden üretilmesi gerekir" diye işaretlenen faz. **Bu değerlendirme, gerçek tasarımla düzeltildi:** şema kırılımı yerine tamamen **eklemeli (additive)** bir yaklaşım kullanıldı — `dialogueLines`/`wordTimestamps` ile aynı desen. Sonuç: **hiçbir mevcut ünitenin yeniden üretilmesi gerekmiyor**, eski içerik hiç bozulmadan tıpkı önceden olduğu gibi (statik `items` listesi olarak) render edilmeye devam ediyor.

- `src/lib/ai/schemas.ts`: `contentBlockSchema`'ya tek yeni opsiyonel alan: `interactive` (`multiple_choice` | `fill_blank` | `matching` — zod `discriminatedUnion`). Mevcut `items`/`answerKey`/vb. hiç dokunulmadı, sadece **ek** bir alan. Yazar prompt'u (`unitGenerationPromptHeader`, mirrored/complementary/teacher/test-booklet'in hepsi tarafından paylaşılıyor) tek bir yerden güncellendi: bir practice/assessment bloğu bu üç şekilden birine gerçekten uyuyorsa `interactive`'i de doldurmasını istiyor.
- **Dört format da destekleniyor, tutarlı görünürlük kuralıyla** (mevcut `answerKey` kuralıyla aynı — doğru cevaplar sadece `showAnswerKey=true` olan workbook/teacher_book'ta görünür, matching'in sağ sütunu student_book/test_booklet'te deterministik olarak karıştırılıyor ki gerçek bir alıştırma kalsın):
  - `src/lib/content-html.ts` (EPUB + Common Cartridge ortak): `renderInteractiveHtml` — statik, basılabilir gösterim + `seededShuffle` (dışa aktarıldı, üçüncü kez kopyalanmadı).
  - `src/lib/pdf/BookDocument.tsx`: `InteractiveExerciseView` — react-pdf primitifleriyle aynı statik gösterim, `content-html.ts`'in `seededShuffle`'ını yeniden kullanıyor.
  - `src/app/projects/[id]/read/[bookType]/BookReader.tsx`: **gerçek, tıklanabilir** üç bileşen — `MultipleChoiceExercise` (seç, anında doğru/yanlış geri bildirim), `FillBlankExercise` (her boşluk için input, "Kontrol et" butonu, büyük/küçük harf ve boşluk toleranslı karşılaştırma), `MatchingExercise` (sola tıkla, sağa tıkla, doğruysa kilitlenir/yeşil, yanlışsa kısa kırmızı yanıp söner, tekrar denenebilir). Hepsi tamamen client-side, backend'e hiçbir puan/ilerleme kaydı gitmiyor (mevcut "ilerleme takibi yok" felsefesiyle tutarlı).
- **Canlı uçtan uca doğrulama (Chrome):** Üç egzersiz tipi de gerçekçi test verisiyle enjekte edilip tarayıcıda bizzat kullanıldı: doğru MC şıkkı seçilip yeşil/"Tekrar dene" geri bildirimi doğrulandı; fill-blank'e bilerek bir yanlış bir doğru cevap girilip "Kontrol et" sonrası kırmızı/yeşil ayrımı doğrulandı; matching'de doğru bir çift seçilip her iki tarafın da yeşile kilitlendiği doğrulandı — konsol hatasız. Test verisi temizlendi.
- Test: `src/lib/content-html.test.ts` (yeni, 7 test — statik render + `seededShuffle`), `src/lib/ai/schemas.test.ts`'e 7 yeni test (`interactiveExerciseSchema` geçerlilik/geçersizlik, `contentBlockSchema` geriye-dönük-uyumluluk dahil).
- Doğrulama: `tsc`/`eslint`/`vitest` (66 test, 52→66)/`next build` temiz. **Migration yok** — yeni alan `generatedBooks.content` jsonb'sinin içinde, ayrı DB kolonu değil. Workflow step sayısı değişmedi (28) — yeni bir pipeline adımı değil, sadece şema+render değişikliği.

**Yapılmadı / bilinçli olarak kapsam dışı:** Sürükle-bırak (drag-and-drop) matching yerine tıkla-eşleştir kullanıldı — harici bir sürükleme kütüphanesi gerektirmeden dokunmatik ekranlarda da eşit derecede iyi çalışıyor. Sunucu-taraflı doğrulama/puan kaydı yok (tamamen client-side, formative/pratik amaçlı — LMS export'un "ilerleme takibi yok" kararıyla tutarlı). Mevcut ünitelerin yeni interaktif alanları doldurması için geriye dönük bir "zenginleştirme" adımı (var olan `items`'ları interaktif tipe dönüştürme) yapılmadı — sadece yeni üretilen içerik bu alanı dolduracak.

---

**H2'nin tamamı (Faz 1 + 2 + 3) artık tamamlandı.** Kalan büyük iş yok — sadece kullanıcı-aksiyonlu iki engel bekleniyor: Vercel AI Gateway kredisi ve (istenirse) çoklu-kullanıcı/organizasyon (yukarıda "İleride yapılacak" olarak not edildi).
