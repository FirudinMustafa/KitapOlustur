import { describe, expect, it } from "vitest";
import { frameTokens, mirroringIssue, sentences, structuralMirroring } from "./mirroring";

// i5 Team 2 p.11 (stored source text) and the hand-made copy's p.9 - the jury
// called it too close: the same dialogue items in the same order, names and
// places swapped.
const source = {
  text: "Read and choose. Then listen and check\n1 A: Hello, I’m Jenny Mills. B: a) This is Jenny. b) Hi, Jenny.\n2 A: How are you? B: a) Fine, thanks. b) I’m twelve.\n3 A: Nice to meet you. B: a) Nice to meet you, too. b) By car.\n4 A: See you tomorrow! B: a) It’s Monday. b) Bye!\n5 A: Where’s the Park Hotel? B: a) It’s a big hotel. b) It’s on Green Street.\n1 How old are you? 2 When is your birthday? 3 Where do you live? 4 Which is your lucky number? 7 What’s your favourite song? 8 What’s your favourite colour? 9 What’s your favourite sport?",
  rubrics: ["Read and choose. Then listen and check"],
};

const copy = {
  blocks: [
    {
      heading: "4 Read and choose. Then listen and check your answers.",
      body: "",
      items: ["A: Hi, I'm Max Green. B: a) Hello, Max. b) Hi, Green.", "A: How's it going? B: a) Not bad, thanks. b) I'm twelve.", "A: Nice to meet you. B: a) Nice to meet you, too. b) By bus.", "A: See you on Monday! B: a) It's Monday. b) Bye! See you!", "A: Where's the bus station? B: a) It's a big bus. b) It's on Hill Road."],
    },
    { heading: "5 My ID File", body: "Answer the questions about you.", items: ["When's your birthday?", "Where do you live?", "What's your lucky number?", "What's your favourite band?", "What's your favourite subject?", "Which sport do you like?"] },
  ],
};

// An original page on the same topic and formats.
const original = {
  blocks: [
    { heading: "4 Pick the best reply. Then listen.", body: "", items: ["Good morning, Mrs Ortiz! - Good morning, class.", "Can I borrow your ruler? - Sure, here you are.", "Sorry I'm late. - That's OK, sit down.", "Is there a café near the station? - Yes, next to the bank."] },
    { heading: "5 About me", body: "Write three facts about yourself.", items: ["My best friend is called...", "After school I usually...", "At the weekend I like to..."] },
  ],
};

describe("frameTokens", () => {
  it("keeps the grammar words and turns the rest into one slot", () => {
    expect(frameTokens("Where's the Park Hotel?")).toEqual(["where", "'s", "the", "_"]);
    expect(frameTokens("Where's the bus station?")).toEqual(["where", "'s", "the", "_"]);
    expect(frameTokens("Is Peter's birthday on the 19th?")).toEqual(["is", "_", "'s", "_", "on", "the", "#", "_"]);
  });
});

describe("sentences", () => {
  it("splits items into sentences without numbers, letters or speakers", () => {
    expect(sentences("1 A: Where's the hotel? B: a) It's big. b) It's on Hill Road.")).toEqual(["Where's the hotel?", "It's big.", "It's on Hill Road."]);
  });
});

describe("structuralMirroring", () => {
  it("flags the hand-made copy: the source's items in order with the nouns swapped", () => {
    const report = structuralMirroring(source, copy);
    expect(report.flagged).toBe(true);
    expect(report.mirroredItems).toBeGreaterThanOrEqual(4);
    expect(report.examples.length).toBeGreaterThan(0);
  });

  it("passes an original page on the same topic", () => {
    const report = structuralMirroring(source, original);
    expect(report.flagged).toBe(false);
    expect(report.sharedRubrics).toEqual([]);
  });

  it("flags the source's own instructions repeated, not the generic ones", () => {
    const src = { text: "2 Choose the right prepositions of movement.\n3 Put the words in the right category.\nListen and repeat." };
    const copied = { blocks: [{ heading: "2 Choose the right prepositions of movement", body: "" }, { heading: "3 Put the words in the right category", body: "" }] };
    const generic = { blocks: [{ heading: "1 Listen and repeat.", body: "" }, { heading: "2 Read and match.", body: "" }] };
    expect(structuralMirroring(src, copied).sharedRubrics).toHaveLength(2);
    expect(structuralMirroring(src, copied).flagged).toBe(true);
    expect(structuralMirroring(src, generic).flagged).toBe(false);
  });

  it("tells the writer what to change", () => {
    const issue = mirroringIssue(structuralMirroring(source, copy), "Student Book", 11);
    expect(issue).toContain("Student Book, page 11");
    expect(issue).toContain("different order");
    expect(mirroringIssue(structuralMirroring(source, original), "Student Book", 11)).toBeNull();
  });
});
