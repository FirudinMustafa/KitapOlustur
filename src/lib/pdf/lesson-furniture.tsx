import { Text, View } from "@react-pdf/renderer";
import type { LessonSection, PageLesson } from "@/lib/lesson-furniture";
import { LESSON_TAB_HEIGHT, SECTION_HEAD_HEIGHT } from "@/lib/design/layouts";
import type { Look } from "./blocks";
import { NOTO_SANS } from "./fonts";

// Lesson furniture as a coursebook prints it (src/lib/lesson-furniture.ts),
// modelled on the hand-set i5 reference (scripts/reference/handcraft-i5-full.tsx):
// the lesson tab with its key-word box, the section heads, the footer
// pointers. Colours come from the source: the number badge's colour (the
// i5 red) for the marks, its accent for the word box.

const INK = "#1f2937";

export function lessonColor(look: Look): string {
  return look.furniture?.numberBadge?.color ?? look.palette.primary;
}

function mix(hex: string, t: number): string {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  if (c.some((v) => Number.isNaN(v))) return "#fff8d6";
  return `#${c.map((v) => Math.round(v + (255 - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

// The tab across the top of a lesson's first page: the code on a disc and
// the title beside it ("1a  A new room"), or - a lesson without a code -
// the title alone in the lesson colour ("Let's Start!"). The key-word box
// sits at the right of the same row. LESSON_TAB_HEIGHT is the room the fit
// estimate keeps for it (planZones, as for a unit heading).
// `width` (pt): set in a box of its own (a design spec's lessonTab), the
// title is sized down to keep to one line.
export function LessonTab({ lesson, look, width }: { lesson: PageLesson; look: Look; width?: number }) {
  const tab = lesson.tab;
  if (!tab) return null;
  const color = lessonColor(look);
  const d = 40;
  return (
    // Up into the running header's place: a lesson book prints none.
    <View style={{ flexDirection: "row", alignItems: "flex-start", height: LESSON_TAB_HEIGHT - 8, marginTop: -18, marginBottom: 8 }}>
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", minHeight: d }}>
        {tab.code ? (
          <View style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: color, alignItems: "center", justifyContent: "center", marginRight: 9 }}>
            <Text style={{ fontFamily: look.headingFont, fontWeight: 700, fontSize: 19, color: "#ffffff" }}>{tab.code}</Text>
          </View>
        ) : null}
        <Text style={{ flex: 1, fontFamily: look.headingFont, fontWeight: 700, fontSize: titleSize(tab, lesson, width), color: tab.code ? INK : color }}>{tab.title}</Text>
      </View>
      {lesson.words?.length ? <CheckWords words={lesson.words} look={look} /> : null}
    </View>
  );
}

// A bold heading character runs up to about 0.64 of its size.
const TITLE_CHAR = 0.64;
function titleSize(tab: NonNullable<PageLesson["tab"]>, lesson: PageLesson, width?: number): number {
  const size = tab.code ? 22 : 26;
  if (!width) return size;
  const room = width * (lesson.words?.length ? 0.56 : 1) - (tab.code ? 49 : 0);
  return Math.max(12, Math.min(size, room / (Math.max(1, tab.title.length) * TITLE_CHAR)));
}

function CheckWords({ words, look }: { words: string[]; look: Look }) {
  const color = lessonColor(look);
  return (
    <View style={{ width: "44%", marginTop: 6, backgroundColor: mix(look.palette.accent, 0.72), borderRadius: 6, paddingHorizontal: 7, paddingTop: 9, paddingBottom: 4 }}>
      <View style={{ position: "absolute", top: -6, left: 8, backgroundColor: color, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 1 }}>
        <Text style={{ fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 7.5, color: "#ffffff" }}>Check these words</Text>
      </View>
      <Text style={{ fontFamily: look.bodyFont, fontSize: 7.5, lineHeight: 1.3, color: INK }} hyphenationCallback={(w) => [w]}>
        {words.map((w) => `• ${w}`).join("   ")}
      </Text>
    </View>
  );
}

// A section head before an exercise group: a disc with the section's
// initial and its name, in the lesson colour.
export function SectionHead({ section, look }: { section: LessonSection; look: Look }) {
  const color = lessonColor(look);
  const d = 15;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", height: SECTION_HEAD_HEIGHT - 4, marginBottom: 4 }} minPresenceAhead={40}>
      <View style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: color, alignItems: "center", justifyContent: "center", marginRight: 5 }}>
        <Text style={{ fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 8.5, color: "#ffffff" }}>{section[0]}</Text>
      </View>
      <Text style={{ fontFamily: look.headingFont, fontWeight: 700, fontSize: Math.max(12, look.theme.bodySize * 1.3), color }}>{section}</Text>
    </View>
  );
}

// The footer's pointers to the lesson's other pages.
export function LessonPointers({ pointers, look }: { pointers: string[]; look: Look }) {
  const color = lessonColor(look);
  return (
    <View style={{ flexDirection: "row", gap: 5 }}>
      {pointers.map((p) => (
        <View key={p} style={{ flexDirection: "row", borderWidth: 0.8, borderColor: color, borderRadius: 7, paddingHorizontal: 5, paddingVertical: 1 }}>
          <Text style={{ fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 7, color }}>{"» "}</Text>
          <Text style={{ fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 7, color: INK }}>{p}</Text>
        </View>
      ))}
    </View>
  );
}
