import { describe, expect, it } from "vitest";
import { hasLessonFurniture, inferSection, lessonShape, planLessons, sectionHeadOf, withSectionHeads, type LessonSection } from "./lesson-furniture";

const block = (heading: string, extra: Record<string, unknown> = {}) => ({ heading, body: "", items: ["a", "b"], ...extra });
const isExercise = (b: { items?: string[] }) => !!b.items?.length;

describe("sectionHeadOf / inferSection", () => {
  it("reads a section head whatever is printed around it", () => {
    expect(sectionHeadOf(" Pronunciation")).toBe("Pronunciation");
    expect(sectionHeadOf("Speaking and Writing")).toBe("Speaking and Writing");
    expect(sectionHeadOf("Reading the text")).toBeNull();
  });

  it("tells an exercise's section from its rubric", () => {
    expect(inferSection(block("Listen and repeat.", { items: ["bunk beds", "mat"] }))).toBe("Vocabulary");
    expect(inferSection(block("Read again and circle a or b."))).toBe("Reading");
    expect(inferSection(block("Complete the table.", { table: { headers: ["I"], rows: [["me"]] } }))).toBe("Grammar");
    expect(inferSection(block("Talk with your friend."))).toBe("Speaking and Writing");
    expect(inferSection(block("Write about your room."))).toBe("Speaking and Writing");
    expect(inferSection(block("Write the numbers."))).toBeNull();
    expect(inferSection(block("Listen and choose."))).toBe("Listening");
    expect(inferSection(block("Number them."))).toBeNull();
    expect(inferSection(block("Number them.", { section: "Grammar" }))).toBe("Grammar");
  });
});

describe("hasLessonFurniture", () => {
  it("is on for a book with lesson codes or section heads, off for page titles alone (Super Minds)", () => {
    expect(hasLessonFurniture([{ lessonHead: { coded: true } }, { sectionHeads: ["Reading"] }, { lessonHead: { coded: true } }])).toBe(true);
    expect(hasLessonFurniture([{ sectionHeads: ["Reading"] }, { sectionHeads: ["Grammar"] }])).toBe(true);
    expect(hasLessonFurniture([{ lessonHead: { coded: false } }, { lessonHead: { coded: false } }, null])).toBe(false);
  });
});

describe("planLessons", () => {
  const unit = { unitNumber: 1, title: "At home", glossary: [{ term: "shelves" }, { term: "curtains" }, { term: "carry" }, { term: "decorate" }] };
  const page = (lesson: ReturnType<typeof lessonShape>, extra: Record<string, unknown> = {}) => ({
    blocks: [block("Look at the shelves and the curtains. Carry the box.")],
    sourceShape: lesson ? { lesson } : undefined,
    ...extra,
  });

  it("codes a unit's lessons 1a, 1b..., takes their titles and words, and points to their pages", () => {
    const plan = planLessons(
      [
        page({ head: "coded", wordBox: true }, { sectionLabel: "A new room" }),
        page({ sections: 2, pointers: true }),
        page({ head: "coded" }, { lessonCode: "1b", lessonTitle: "Party time!" }),
      ],
      unit,
    );
    expect(plan[0].tab).toEqual({ code: "1a", title: "A new room" });
    expect(plan[0].words).toEqual(["shelves", "curtains", "carry"]);
    expect(plan[1]).toEqual({ pointers: ["Student's Book: Language Review 1a", "Workbook: 1a"] });
    expect(plan[2].tab).toEqual({ code: "1b", title: "Party time!" });
  });

  it("gives a starter module's lessons their title alone and no pointers", () => {
    const plan = planLessons([page({ head: "titled" }), page({ pointers: true })], { unitNumber: 0, title: "Welcome Module" });
    expect(plan).toEqual([{ tab: { title: "Welcome Module" } }, {}]);
  });
});

describe("withSectionHeads", () => {
  it("keeps a section only where a new one starts, and none on a page whose source prints none", () => {
    const blocks = [block("Read and answer."), block("Read again and circle."), block("Listen and repeat.", { items: ["mat", "lamp"] }), block("Intro", { items: [] })];
    expect(withSectionHeads<{ heading: string; body: string; items?: string[]; section?: LessonSection }>(blocks, 2, isExercise).map((b) => b.section)).toEqual(["Reading", undefined, "Vocabulary", undefined]);
    expect(withSectionHeads(blocks.map((b) => ({ ...b, section: "Grammar" as const })), undefined, isExercise).every((b) => !b.section)).toBe(true);
  });
});
