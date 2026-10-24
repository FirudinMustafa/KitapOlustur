import { describe, expect, it } from "vitest";
import { alignPictureWithExercise, itemSubjects, pictureExercise } from "./exercise-picture";

// KIYAS-11 (i5) pages as the system wrote them.
const room = {
  imagePrompt: "A bright bedroom with a bed, desk, and clock on the wall.",
  blocks: [
    { kind: "practice" as const, heading: "1 Make the words plural", body: "Write the plural form of these school items.", items: ["pencil", "book"], answerKey: ["pencils", "books"] },
    { kind: "practice" as const, heading: "2 What is in the room?", body: "Identify seven items in the illustration below.", items: ["Bed", "Desk", "Chair", "Lamp", "Computer", "Poster", "Rug"], answerKey: ["bed", "desk", "chair", "lamp", "computer", "poster", "rug"] },
  ],
};

const familyTree = {
  imagePrompt: "Leo standing next to a large, colourful family tree poster on a classroom wall, pointing at the branches.",
  blocks: [{ kind: "practice" as const, heading: "1 Our Explorer Families", body: "Complete the sentences about Leo's family tree using the word bank.", items: ["Helen is Leo's ___.", "Bob is Leo's ___.", "Jane is Leo's ___."], answerKey: ["grandmother", "grandfather", "aunt"] }],
};

describe("itemSubjects", () => {
  it("reads the thing an item asks the picture to show", () => {
    expect(itemSubjects("Chair")).toEqual(["Chair"]);
    expect(itemSubjects("A globe and a world map")).toEqual(["globe", "world map"]);
    expect(itemSubjects("It is half past four.")).toEqual(["a clock showing half past four"]);
    expect(itemSubjects("She is going into the park.", "", "Maya")).toEqual(["Maya going into the park"]);
    expect(itemSubjects("A tool for cutting paper", "scissors")).toEqual(["scissors"]);
  });

  it("finds nothing to draw in numbers, answers and speech lines", () => {
    expect(itemSubjects("7")).toEqual([]);
    expect(itemSubjects("Yes, it is.")).toEqual([]);
    expect(itemSubjects("Hello! I'm Leo.")).toEqual([]);
    expect(itemSubjects("What's your name?")).toEqual([]);
  });
});

describe("alignPictureWithExercise", () => {
  it("makes the room show every object the exercise asks about", () => {
    const after = alignPictureWithExercise(room);
    expect(after.imagePrompt).toContain(room.imagePrompt.replace(/\.$/, ""));
    expect(after.imagePrompt).toContain('exercise "What is in the room?"');
    for (const thing of ["Chair", "Lamp", "Computer", "Poster", "Rug"]) expect(after.imagePrompt).toContain(thing);
  });

  it("puts the people the family tree names into the picture", () => {
    expect(alignPictureWithExercise(familyTree).imagePrompt).toContain("a family tree of Helen, Leo, Bob, Jane");
  });

  it("counts what a counting exercise asks for", () => {
    const page = {
      imagePrompt: "A sunny classroom.",
      blocks: [{ kind: "practice" as const, heading: "2 Count and write", body: "How many can you see?", items: ["How many chairs?", "How many books?"], answerKey: ["4", "3"] }],
    };
    const after = alignPictureWithExercise(page).imagePrompt;
    expect(after).toContain("4 chairs; 3 books");
    expect(after).toContain("easy to count");
  });

  it("leaves a prompt that already shows the exercise's things", () => {
    const page = { ...room, imagePrompt: "A bedroom with a bed, a desk, a chair, a lamp, a computer, a poster and a rug." };
    expect(alignPictureWithExercise(page)).toBe(page);
  });

  it("leaves pages whose exercise does not work from the picture, and card and panel pages", () => {
    const quiz = { imagePrompt: "A globe.", blocks: [{ kind: "practice" as const, heading: "1 Geography Quiz", body: "Answer these questions.", items: ["Which country is the Eiffel Tower in?", "What is the capital of Japan?"] }] };
    expect(alignPictureWithExercise(quiz)).toBe(quiz);
    expect(pictureExercise({ ...room, sourceShape: { pageType: "cards" } })).toBeNull();
    const wordsearch = { imagePrompt: "A grid.", blocks: [{ kind: "practice" as const, heading: "Room Search", body: "Find the six words in the grid.", items: ["bed", "desk", "lamp"] }] };
    expect(alignPictureWithExercise(wordsearch)).toBe(wordsearch);
  });
});
