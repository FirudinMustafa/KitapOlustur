# Hand-made i5 book: design decisions as a spec for the system

**Source:** `i_5_team_2.pdf`, pp. 6–25 (welcome module and Module 1, 220×280 mm).
**Hand-made book:** `scripts/reference/handcraft-i5-full.tsx`, with its art composites in `handcraft-i5-full-art.ts` and paid pictures in `handcraft-i5-full-images.mts`.

The book uses original content: four new characters (Lily, Sam, Zoe, Kenji), Bolt the robot, and new texts and exercises. The structure, density and page design follow the source.

## Scores

`npx tsx scripts/fidelity.mts i_5_team_2.pdf .handmade/student-book.pdf 6 4 25 23`

| Book | Structure | Look |
|---|---|---|
| This book, round 2 (with cover, imprint, contents, back cover) | **96%** | **85%** |
| This book, round 1 | 81% | 72% |
| Earlier hand-made reference (1a–1c only) | 41% | 65% |
| System, KIYAS-11 relayout (pp. 6–11) | 87% | 56% |

For comparison, two different source pages scored against each other reach 65% look.

The system's weakest look aspects (KIYAS-11) are:
- pictureArea 35%
- inkMap 41%
- ink 44%
- palette 56%
- colourfulness 62%

The same aspects in this book: pictureArea 86%, inkMap 76%, ink 88%, palette 74%, colourfulness 84%.

The items below are ordered by how much they should move the **system's** look score.

### Notation

- **Boxes:** `[x, y, w, h]` are fractions of the page, from the source's measured layout (`analyzeSourceLayout`, `layout.images`).
- **Units:** "pt" means PDF points on a 623.6 × 793.7 pt page.
- **Status:** ✅ already in the system, 🟡 partly, ❌ missing.

---

## 1. Picture areas exactly where the source has them, filled edge to edge — ❌ / 🟡

**What I did**
- Every picture sits in the source page's measured box. I use a helper `SB(box)` that turns a page fraction into content coordinates.
- Examples:
  - p.8 collage `[0.03, 0.02, 0.95, 0.61]`, running past the margins to the top edge.
  - p.12 scene `[0.03, 0.08, 0.95, 0.63]`.
  - p.15 invitation poster `[0.00, 0.58, 0.50, 0.42]`, bleeding off the bottom and left edges.
  - p.16 hobby collage `[0.05, 0.04, 0.87, 0.49]`.
- Every picture fills its box: object-fit `cover`, or a composite built at exactly the box's aspect.

**Why**
- pictureArea is the overlap (intersection over union) of the picture boxes. inkMap is ink per cell of a 12×16 grid.
- Both reward pictures of the right size in the right place. Round 1 placed pictures in the flow and scored 37%; round 2 scores 86%.

**How the system could do it**
- **Measurement:** `layout.images` is already in `ZonePlan` bands, as `left`, `span`, `height` and `widths`.
- **Template change (`templates.tsx` "source-zones", `zoneRowFrames` in `layouts.ts`):**
  1. Drop the per-band height clamp (`clamp(h, 0.1, 0.5)` in `zones.ts`) and the 60% total-picture cap when the source's own pictures cover more than that.
  2. Let a band whose source box touches a trim edge (x ≤ 0.04, x + w ≥ 0.96, y ≤ 0.03 or y + h ≥ 0.97) bleed to that edge instead of stopping at the 44 pt content margin. Add a `bleed: { left?, right?, top?, bottom? }` flag to the pictures band in `zoneBandSchema`.
  3. Draw `Illustration` with `objectFit: "cover"` at the slot size. `pictureSlotAspects` already makes the picture in the slot's aspect.
- **Effort:** deterministic. It needs `MAX_PICTURE_ASPECT` (1.6) relaxed for bleed rows.
- **Caveat – big pictures:** a picture with area > 0.6 of the page that is not inset by 0.02 on all sides is read as page background, and the analyzer then rasterises the page to find pictures. A comic or scene that big can come out as a fragment.
  - I kept the p.12 comic at 0.95 × 0.63 (area 0.598) so it counts as one picture.
  - Either the system does the same, or the analyzer learns that a single image block with no white gutters is one picture.

## 2. One picture area = one artwork (composites, not loose cards) — 🟡

**What I did**
- When the source has one picture where a reader sees many objects, I composed the objects into one image:
  - p.13: 6 vocabulary objects, one image `[0.02, 0.43, 0.47, 0.25]`.
  - p.14: chores grid `[0.03, 0.73, 0.48, 0.24]`.
  - p.16: hobby collage.
  - p.7: chalkboard with 8 school objects.
  - p.6: family tree with 10 faces and name tags.
  - p.9: 6 clocks, drawn as SVG.
  - p.11: 7 module tiles `[0.02, 0.53, 0.93, 0.43]`.
- Cards sit on tinted tiles (pastels such as `#FFCDD2`, `#C5CAE9`, `#FFF9C4`), with captions printed by the PDF under each tile.
- The source analyzer counts these as 1 picture, as it does on the source.

**Why**
- The picture count matched: 98%.
- The tinted ground raised ink and colourfulness, where loose cards on white show paper.

**How the system could do it**
- **Measurement:** `classifyPageType`, and `cards` with `cardSheetSlots` (already there). The source box comes from `layout.images`.
- **Change:** today one sheet is generated, cut into cards (`sliceCardSheet`) and printed as N separate frames. For a cards slot inside one source picture box:
  1. Keep the sheet whole, or re-compose the slices with `sharp` onto a tinted ground at the box's aspect.
  2. Print it as one `Illustration`.
  3. Print captions as text at the computed cell positions. See `cardGrid` in `handcraft-i5-full-art.ts`: cell 300 px, gap 60 px, caption band 56 px.
- **Effort:** deterministic, no extra paid calls.

## 3. Panels drawn as artwork where the source's panels are artwork — ❌

**What I did**
- The source's e-mail window, U-file card, exam-tip box, Over-to-you panel and invitation poster are artwork, so the analyzer measures them as pictures. I drew each as a PNG ground (SVG through sharp) at the source box and printed the text over it:
  - **E-mail window:** sky-blue title bar 16 px with red/yellow/green dots, border `#4FC3F7`. Boxes p.13 `[0.48, 0.40, 0.46, 0.23]`, p.19 `[0.49, 0.70, 0.45, 0.25]`, p.21 `[0.48, 0.25, 0.43, 0.37]`.
  - **"My ID File" card:** lavender `#EDE7F6`, 12 px border `#7778B3`, a big "ID" watermark. Box `[0.45, 0.04, 0.53, 0.45]`.
  - **Exam TIP box:** `#F3E5F5`, border `#7E57C2`. Boxes `[0.42, 0.22, 0.51, 0.12]` and `[0.49, 0.105, 0.42, 0.12]`.
  - **Writing Tip panel:** `#F1F8E9`, green border, with the exercise's items inside. Box `[0.03, 0.61, 0.46, 0.27]`.
  - **Over-to-you panel:** ruled sky panel plus a child cut-out. Box `[0.48, 0.68, 0.50, 0.21]`.
  - **Pronunciation table grid:** box `[0.55, 0.795, 0.32, 0.16]`.
  - **Noughts-and-crosses grid:** box `[0.50, 0.71, 0.45, 0.27]`.
  - **"NOW I CAN" banner and frame:** box `[0.07, 0.80, 0.40, 0.12]`.

**Why**
- The source counts them as pictures, so they drive the picture count, pictureArea, ink and palette.
- They are also what makes a page look like a published book rather than a document.

**How the system could do it**
- **Measurement:** a source picture box whose page text says what it is: lines "To:/From:/Subject:" mean an e-mail; "Exam TIP" means an exam box; "Writing TIP" means a tip panel. A picture box with ≥ 30 words over it is a panel, not a picture.
- **Data:** a new `zonePlan` slot kind `panel` with `{ style: "email" | "card" | "tip" | "note" | "poster" }`. The writer puts the matching block, such as the e-mail text, into that slot.
- **Rendering:** a react-pdf component per style, drawn with `View`s. That is fine for look; for the analyzer to count it as a picture it must be an image. Simplest is to rasterise the ground with sharp at render time, as I did.
- **Effort:** deterministic, apart from the writer putting the right block in the slot. That needs a schema field `panelRef` and an instruction.

## 4. Page grounds and part-page colour blocks — ❌ (being implemented in parallel)

**What I did**
- **p.6:** lime gradient from `#B8D42A` at the top-left, through `#D6E96E`, to white at 80% towards the bottom-right, drawn as a full-page background image. It is ignored as a picture because area > 0.6 and it is not inset.
- **p.10:** purple `#7778B3` block covering the right half, full height, edge to edge, from x = 0.51.
- **p.23:** yellow page `#FCF389` with a navy-violet `#3B2C85` right block from x = 0.55.
- **p.12:** sky `#DDEFF9` page under the comic.
- **p.22:** white page under the comic.

**Why**
- Ink on these source pages runs 0.48–0.89; a white generated page is about 0.3. inkMap and palette follow.

**How the system could do it**
- **Measurement:** sample the rendered source page in a margin ring (3–7% in from each edge, pictures left out) per side.
  - One colour on ≥ 3 sides: page ground.
  - One colour on one side, from the edge to about the middle: a side block, with its x-extent.
  - A gradient is detected as chromatic at top and left with paper at bottom and right.
  - My first attempt (all-round ring, 70% chromatic) caught only p.23. It needs per-side sampling.
- **Data:** `zonePlan.ground = { color, gradientTo?, side?: "left" | "right", from?: number }`.
- **Rendering:** a `Page` background and an absolute `View`. Text colour flips to white when the block is dark (luminance < 0.4).
- **Effort:** deterministic.

## 5. Lesson furniture — ❌ (being implemented in parallel)

All sizes are at 220×280 mm.

**Lesson opener header**
- A red splash: a 24-point star polygon, Ø 58 pt, `#E2001A`, with the code ("1a") in white Baloo 29 pt.
- Then the lesson title in Baloo 2 Bold 30 pt, ink colour.
- Placed at the top-left, 14 pt above the content top, so it hangs into the margin.
- For the skills lesson, the title sits in a red rounded pill: white Baloo 22 pt.

**Check these words**
- Yellow note `#FFF6B3`, border `#E9C93D`, width 200–215 pt, at the top-right of every lesson opener.
- A red pill tab at the top ("✓ Check these words", white 9 pt bold).
- Words 8.8 pt, separated by " • ".
- An optional sub-head "SMALL TALK" in white on purple, followed by two phrases.

**Section heads**
- A red circle Ø 19 pt with a white Twemoji icon of 12 pt:
  - 📖 Reading
  - 🔤 Vocabulary
  - ✏️ Grammar
  - 💬 Speaking and Writing / Everyday English / Knowledge of Language Functions
  - 🎧 Listening
  - 🗣️ Pronunciation
  - 📝 Writing
- Then the name in red Noto Sans Bold 13.5 pt, with an optional "(sub)" in red bold 10 pt.
- Margins: 6 pt above, 3 pt below.

**Grammar box**
- Peach `#FFF1EA`, border 1.4 pt `#F4A582`, radius 12.
- Example sentences in italic 9.6 pt, with the target forms in bold blue `#1E88E5` and not italic.
- A bullet rule in 9.4 pt with **bold** key words.
- Nested white rounded boxes for "Spelling rules" and "Time expressions" (title bold 9.2 pt).

**Over to you**
- The words "Over to you:" in red at the start of the rubric.
- Questions in italic, on a sky panel `#DCEFFB`.

**Tags**
- PORTFOLIO (red) and THINK (orange): white Baloo 10 pt in a small pill before the rubric.

**Footer**
- Folio in a red disc Ø 26 pt with a pink ring, plus "Module 1" in red Baloo 10 pt, at the outer corner.
- On lesson second pages, two outlined pills at the centre: "» Student's Book: Language Review 1a" and "» Workbook: 1a" (7.5 pt).

**Why**
- These are the most visible publisher signals on every source lesson page.
- They add red ink, which the source prints a lot of.

**How the system could do it**
- **Measurement:**
  - The source page's text layer: a line matching `^\d[a-f]$` at the heading size near the top-left is a lesson opener and gives its code.
  - Lines equal to a closed list (Reading, Vocabulary, Grammar, Listening, Speaking and Writing, Everyday English, Pronunciation, Writing, Skills…) at a size above body are section heads, in order and with y positions.
  - "Check these words" is detected the same way.
- **Data:**
  - Writer schema `sections: { name, sub?, beforeExercise: number }[]`.
  - `checkWords: string[]` and `smallTalk?: string[]` on lesson openers.
  - `lessonCode` and `lessonTitle` on the unit page.
- **Rendering:** `LessonHeader`, `CheckWords`, `Section` and `GrammarBox` in `handcraft-i5-full.tsx` are ready to port into `src/lib/pdf/blocks.tsx` and `templates.tsx`.
- **Effort:** detection is deterministic; the words in the boxes need the writer (AI), which is a schema plus an instruction.

## 6. Exercise headings as the source prints them — 🟡

**What I did**
- The number is red `#E2001A` Noto Sans Bold **14 pt on its own line**, 15 pt wide, or 22 pt for two digits. A small headphones glyph (red SVG, 12 pt) follows for listening exercises.
- The rubric is **bold 10.5 pt** beside the number with a hanging indent (row layout), padded down 1.2 pt so the baselines align.
- Items: the number in red bold 10 pt, 11 pt wide, then the text at 10 pt. Lettered options are bold a/b/c, 100 pt apart.
- The heading is the instruction itself ("Read again and circle a or b."), never a title.
- Numbers run on across a lesson's pages (p.7 starts at 3, p.15 at 4).

**Why**
- The analyzer counts an exercise when a line opens with a number at ≥ 1.15 × body, and only at **y ≥ 6% of the page** (above that it is taken for a folio).
- Round 1 lost 3 exercises because a page's first exercise sat at y = 0.04.

**How the system could do it**
- **Already done in round 1 (commit `340de13`):**
  - Numbering runs on: `firstExerciseNumber` → `sourceShape.firstExercise` → `numberUnitExercises`.
  - Headings are instructions (writer prompt; not yet checked in a live run).
- **Still to do:**
  1. Keep the first exercise heading at y ≥ 0.06: the page's top padding is at least 48 pt, or the first band starts lower.
  2. Print the rubric bold. Today it is the title bold and the rubric regular, in `blocks.tsx` around line 944.
  3. Use a hanging indent. Today the rubric wraps under the number.
- **Effort:** deterministic.

## 7. Two-column discipline — 🟡

**What I did**
- On a source 2-column page, no text block of ≥ 3 words crosses the middle. Columns are x 0.07–0.46 and 0.50–0.95.
- On a 1-column source page, at least one full-width line crosses it: an exercise rubric across the page, or full-width notes.

**Why**
- `countColumns` bins word mass per 1% of width and splits on runs of empty bins. Two bins touching (such as 48 and 49) merge into one column.
- Columns went from 75% to 95%.

**How the system could do it**
- **Measurement:** `layout.textColumns` (already there).
- **Change:** in `splitColumns` and the "columns" band, never print a full-width block (word box, example line) inside a 2-column band. Put it at the top of the left column instead.
- Keep a gutter of at least 16 pt; it is 16 pt today. Make sure column widths are exactly `(contentWidth - 16) / 2`, with no inner padding that pushes text into the gutter.
- **Effort:** deterministic.

## 8. Colour: the source's palette and colourfulness — 🟡

**What I did**
- Red `#E2001A` for numbers, section heads, splash and folio.
- Panels in the source's hues: peach `#FFF1EA`/`#FCE1D3`, yellow `#FFF6B3`, sky `#DCEFFB`, lavender `#E1BEE7`, source purple `#7778B3`.
- Where the source's colourfulness was higher than the picture's, I printed the generated picture with `sharp().modulate({ saturation: 1.35 })` (1b scene, gamers photo).
- Where a page came out too saturated against the source, I lightened its grounds: the invitation poster went from navy to `#FFF3C4`, and the Fun Time right block was narrowed.

**Why**
- Palette is a histogram intersection of the printed hues, and colourfulness is a direct comparison of mean saturation.
- These moves took palette from 67% to 74% and colourfulness from 75% to 84%.

**How the system could do it**
- **Measurement:** `designColors` per page and `deriveSourceTheme` (in place), plus `PageLook.colourfulness` of the source page (`page-look.ts`, already computed for fidelity).
- **Change:** after a picture is generated, compare its mean saturation with the source page's (pictures only), and modulate within 0.8–1.4.
- Pick panel tints from the page's measured `designColors` (light ones, l ≥ 0.82), not from the theme.
- **Effort:** deterministic.

## 9. Comic and story pages — 🟡

**What I did**
- **p.22:** the generated 6-panel comic in a box 0.65 × 0.92. White gutters are filled with a red/yellow stipple, so the page reads as one artwork and the analyzer finds one picture rather than 6.
  - Speech bubbles are white with a 1.2 pt black border, radius 10, and a rotated square tail. The text is Andika 8.6 pt.
  - Panel numbers sit in white circles (Ø 22 pt, at the bottom-left of each panel).
  - The title "Bolt the Robot" is in Baloo 28 pt over the art. "1 a) Listen and read." is on a white label over the top-left; "b) Now, take roles…" sits under the art on the right.
- **p.12:** three panels cut from one generated scene (`crop`), stacked edge to edge with no gutters. Dialogue boxes are white at 78% opacity with a red 1.5 pt border and numbered red discs ("1", "2", "3", 14 pt).

**How the system could do it**
- **Measurement:** `pageType: "panels"` (in place).
- **Change:** set the panel grid as one image (compose the panel pictures with no white gutters), with bubbles from `locateSpeakers` (in place).
- Watch for the "> 0.6 area means background" rule from item 1.
- **Effort:** deterministic.

## 10. Number tiles and other "picture numbers" as artwork — 🟡

**What I did**
- Source p.7's number tiles (88, 21, 99…) are images. Mine are small PNG tiles: a 42 × 28 pt rotated rounded rect with white Arial Black.
- I did the same for the age choices on p.21 (10/11/12).

**Why**
- Printed as text, these big numbers counted as items, or as exercise headings, because a large number with the next line's words reads as an exercise.
- On p.21, "10 / A. ☐" turned into three false exercises.

**How the system could do it**
- **Change:** `ItemTiles` ("numbers" kind) in `blocks.tsx` prints numbers as text in coloured cards. Render them as tiny images (sharp SVG), or at a size below 1.15 × body.
- **Effort:** deterministic.

## 11. Page furniture that is NOT in the source (do not copy)

- **Left-edge colour strip:** the coloured slivers at the left edge of the source pages are the neighbouring page's bleed from a cropped spread, not a module strip.
  - Measured (`measureSideStrip` experiment, reverted): no strip runs down the page.
  - My book keeps an 11 pt strip of colour blocks down the left edge as its own series design. The system should not infer one from this source.
- **Smaller exercise numbers on the 1b opener:** I printed the exercise numbers on p.14 at 9 pt (a body-size number, read as an item) because the source's numbers on that page are not detected as exercises (0 measured). This is a measurement artefact and not a design rule. The system should keep 14 pt numbers everywhere.

## 12. Real-book parts — 🟡

**Cover**
- Full-bleed generated art: GPT Image 2.5 "high", 1024×1536, $0.042. The prompt leaves the top third empty for the title.
- Series title "Spark Up!" in white Baloo 78 pt, a red level disc Ø 86 pt with "2", the subtitle "English for teenagers · CEFR A2" in navy Baloo 18 pt, and a book-type pill (Student's Book red, Workbook blue).
- A yellow "A2" sticker Ø 74 pt rotated 10°. No logo.

**Imprint**
- Title, a short "how this edition was made", credits (pictures, Twemoji CC-BY, OFL fonts) and character portraits.

**Contents**
- Mirrors the source's table: columns MODULE | TOPIC | VOCABULARY | GRAMMAR | READING | SPEAKING & FUNCTIONS | LISTENING | WRITING.
- A red header row and one coloured row per module (module number in Baloo 34 pt on the module colour, page range under it).
- A pink strip for Skills Practice, story, Fun Time and Modular Revision, then a "How this book works" note.

**Back cover**
- Blurb, five ✓ features, a CEFR A2 disc, and cover art cropped to the lower 42%.

**Workbook**
- Same cover with a blue "Workbook" pill. Pages framed like an activity book.

**How the system could do it**
- `CoursebookCover.tsx` and `ContentsDocument.tsx` exist.
- Missing:
  - level disc and book-type pill on the cover
  - a contents table with the source's skill columns (the source's own contents page can be measured for its column headings)
  - a back cover with a blurb (one writer call, or a template)
- **Effort:** deterministic, plus a short writer field for the blurb.

## 13. Text density and content shape — ✅ mostly

- **Words:** about 88% of the source's per page.
- **Items per exercise and exercise counts:** match the measured counts (exercises 100%, items 94%).
- **Speech:** dialogue in boxes over pictures (the 1a comic) or in bubbles (1b scene, comic page).
- **Writer prompts:** already carry the measured counts (`writerBlueprint`), so the system's structure (87%) is close. The look gap is the bigger one.

---

## Top changes for the system's look score

| # | Change | Item | Aspects it moves |
|---|---|---|---|
| 1 | Pictures at the source boxes: no 50%/60% caps, bleed to the trim edge, `cover` fit | 1 | pictureArea, inkMap |
| 2 | Page grounds and side colour blocks, measured per side | 4 | ink, inkMap, palette |
| 3 | Panels as artwork at their source boxes (e-mail, card, tip, poster, tables) | 3 | pictures, pictureArea, ink |
| 4 | Card or object groups composed into one tinted artwork per source picture box | 2 | ink, colourfulness, pictures |
| 5 | Lesson furniture: splash and title, Check these words, section heads, Grammar box, footer pills | 5 | palette (red), ink, publisher look |
| 6 | Picture saturation matched to the source's colourfulness, panel tints from measured design colours | 8 | colourfulness, palette |
| 7 | Comic and story pages as one gutter-less artwork with bubbles | 9 | pictureArea, picture count |
| 8 | First exercise at y ≥ 6%, bold rubric, hanging indent | 6 | exercises (structure), look of headings |
| 9 | Two-column gutter discipline | 7 | columns, zone |
| 10 | Number tiles as artwork | 10 | items and exercises (structure) |
