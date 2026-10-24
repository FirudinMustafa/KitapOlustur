import { describe, expect, it } from "vitest";
import { extractSourceNames, renameInText, renameSourceNames, sourceNameIssues, sourceNameReplacements, sourceNamesPrompt, usedNames } from "./source-names";

// Excerpts of the stored page maps of KIYAS-14 (Super Minds Starter) and
// KIYAS-11 (i5 Team 2).
const superMinds = [
  { pageNumber: 1, pageType: "other", sourceText: "Singing for Pleasure\n1 01 Listen and sing.\n4\nSay Hello!", summary: "Starter-unit song page 'Say Hello!'." },
  { pageNumber: 2, pageType: "content", sourceText: "2 Ask and answer.\nHello! What’s your name?\nI’m (Misty).\n1 03 Listen and point. Say the names.", summary: "Greetings and names." },
  { pageNumber: 5, pageType: "content", sourceText: "Story and Value\n1 06 Watch and listen to the story.\nFriends", summary: "Story page titled 'Friends', labeled 'Story and Value'." },
  { pageNumber: 7, pageType: "unit_opener", sourceText: "Classroom Objects\nWhat’s in my classroom?\nchair book pencil\nBIG\nQUESTION\nMy Classroom", summary: "Opener for Unit 1 'My Classroom'." },
  { pageNumber: 9, pageType: "content", sourceText: "Singing for Pleasure\n1 11 Listen and sing.", summary: "Song page." },
];

const i5 = [
  { pageNumber: 1, pageType: "cover", sourceText: "The INCREDIBLE 5 team Student’s Book 2 Jenny Dooley - Virginia Evans" },
  { pageNumber: 6, pageType: "unit_opener", sourceText: "Sue:\nHi! I’m Sue. 1) ____?\nLucy:\nMy name’s Lucy.\nSue:\nI’m from Manchester.\nLook at Kate’s family tree.\nBob\nHelen\nBeth\nFrank\nKate\nEmma" },
  { pageNumber: 12, pageType: "content", sourceText: "Emma, Lee and Harry are helping Mona decorate her room.\nEmma: Your room looks fantastic, Mona!\nMona: Thanks.\nHarry: Lee! What are you doing?\nLee:\nDon’t press that…oops!\nELF:\nGreetings, players!\nFrank:\nAh!\nStudent’s Book: Language Review 1a" },
  { pageNumber: 13, pageType: "content", sourceText: "a) Read again and circle a or b.\n4 Lee is ______ Mona’s computer.\nHarry: Look!\nLee: Wow!\nFrank:\nHi, Emma!\nELF:\nWelcome back!" },
  { pageNumber: 17, pageType: "content", sourceText: "How often does Frank go to the cinema? Mark the sentences T or F.\nStudent’s Book: Language Review 1c" },
  { pageNumber: 21, pageType: "assessment", sourceText: "Knowledge of Language Means\nRead the text.", summary: "Includes 'Knowledge of Language Functions' and a 'Knowledge of Language Means' cloze test." },
  { pageNumber: 23, pageType: "content", sourceText: "FunTime\nPresent Continuous\nSMALL TALK", summary: "'FunTime' page." },
  { pageNumber: 24, pageType: "review", sourceText: "Modular Revision 1\nPresent Continuous", summary: "'Modular Revision 1' review page." },
];

describe("extractSourceNames", () => {
  it("finds the source's mascot from its example answer (KIYAS-14 'Misty')", () => {
    const names = extractSourceNames(superMinds);
    expect(names.characters).toEqual(["Misty"]);
    expect(names.features).toEqual(expect.arrayContaining(["Singing for Pleasure", "Story and Value", "BIG QUESTION"]));
    // A page's topic is not a series feature.
    expect(names.features).not.toContain("My Classroom");
    expect(names.features).not.toContain("Friends");
  });

  it("finds i5's speakers, family tree and feature names, not its places, grammar or authors", () => {
    const names = extractSourceNames(i5);
    expect(names.characters).toEqual(expect.arrayContaining(["Sue", "Lucy", "Emma", "Lee", "Harry", "Mona", "Frank", "ELF"]));
    expect(names.names).toEqual(expect.arrayContaining(["Kate", "Bob", "Helen", "Beth"]));
    for (const not of ["Manchester", "Mark", "Book", "Jenny", "Dooley", "Student"]) expect(names.names).not.toContain(not);
    expect(names.features).toEqual(expect.arrayContaining(["Knowledge of Language Means", "FunTime", "SMALL TALK", "Modular Revision"]));
    expect(names.features).not.toContain("Present Continuous");
    expect(names.features).not.toContain("Jenny Dooley");
  });

  it("finds nothing in a book without people", () => {
    expect(extractSourceNames([{ pageNumber: 1, sourceText: "Fractions\n1 Add the fractions. 2 Write the answer." }])).toEqual({ characters: [], names: [], features: [] });
  });
});

describe("sourceNameIssues", () => {
  const names = extractSourceNames(superMinds);
  it("sends back the KIYAS-14 story page that kept Misty", () => {
    const page = {
      sourcePageNumber: 5,
      imagePrompt: "A small orange kitten (Misty) under a tree.",
      blocks: [{ heading: "1 Watch and listen to the story", body: "Point to Misty. Point to Leo.", items: ["Meow! I'm Misty."] }],
    };
    const issues = sourceNameIssues(page, names, "Student Book");
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('"Misty"');
  });

  it("sends back a heading with the series' feature name, not a plain word in a sentence", () => {
    const page = { sourcePageNumber: 5, blocks: [{ heading: "Story and Value", body: "A misty morning in the park." }] };
    const issues = sourceNameIssues(page, names, "Student Book");
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('"Story and Value"');
  });

  it("passes a page with the book's own cast", () => {
    expect(sourceNameIssues({ sourcePageNumber: 2, blocks: [{ heading: "Listen and point", body: "Hello! I'm Pip.", items: ["Leo", "Amina"] }] }, names, "Student Book")).toEqual([]);
  });
});

describe("renaming", () => {
  it("gives each source name one new name, never one already in the book", () => {
    const names = extractSourceNames(i5);
    const map = sourceNameReplacements(names, ["Pip"]);
    expect(new Set(Object.values(map)).size).toBe(Object.keys(map).length);
    expect(Object.values(map)).not.toContain("Pip");
    for (const n of names.names) expect(map[n]).toBeDefined();
  });

  it("replaces a name everywhere it is a name, but not the plain word", () => {
    const map = { Misty: "Pip", Frank: "Rafi", Mark: "Nell" };
    expect(renameInText("I'm (Misty). 'Misty says' game. Misty's box.", map)).toBe("I'm (Pip). 'Pip says' game. Pip's box.");
    expect(renameInText("Frank is Kate's uncle. Ask Frank.", map)).toBe("Rafi is Kate's uncle. Ask Rafi.");
    expect(renameInText("Mark the sentences. A misty day.", map)).toBe("Mark the sentences. A misty day.");
    expect(usedNames("Mark the sentences T or F.", ["Mark"])).toEqual([]);
  });

  it("renames an outline, plan or unit but leaves ids and links alone", () => {
    const unit = { studentBookPages: [{ imagePrompt: "Misty waves.", imageCharacters: ["Misty"], blocks: [{ heading: "Misty's game", body: "" }] }], listeningAudio: [{ script: "I'm Misty.", audioUrl: "https://x/Misty.mp3" }] };
    expect(renameSourceNames(unit, { Misty: "Pip" })).toEqual({
      studentBookPages: [{ imagePrompt: "Pip waves.", imageCharacters: ["Misty"], blocks: [{ heading: "Pip's game", body: "" }] }],
      listeningAudio: [{ script: "I'm Pip.", audioUrl: "https://x/Misty.mp3" }],
    });
  });
});

describe("sourceNamesPrompt", () => {
  it("lists the names and features for the writer", () => {
    const text = sourceNamesPrompt(extractSourceNames(superMinds));
    expect(text).toContain("Misty");
    expect(text).toContain('"Singing for Pleasure"');
    expect(sourceNamesPrompt({ characters: [], names: [], features: [] })).toBe("");
  });
});
