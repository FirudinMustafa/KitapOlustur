import { describe, expect, it } from "vitest";
import { ARTEFACT_FIXTURES } from "./text-style.fixtures";
import { inferTextStyle, letterParts, quizParts, resolveTextStyle, splitArtefact } from "./text-style";

const block = (body: string, extra: Record<string, unknown> = {}) => ({ kind: "practice", heading: "1 Read.", body, ...extra });

describe("inferTextStyle", () => {
  it("recognises the i5 artefacts", () => {
    expect(inferTextStyle(ARTEFACT_FIXTURES.email)).toBe("email");
    expect(inferTextStyle(ARTEFACT_FIXTURES.note)).toBe("note");
    expect(inferTextStyle(ARTEFACT_FIXTURES.message)).toBe("message");
    expect(inferTextStyle(ARTEFACT_FIXTURES.invitation)).toBe("invitation");
    expect(inferTextStyle(ARTEFACT_FIXTURES.quiz)).toBe("quiz");
  });

  it("counts an email with gaps as an email even when short", () => {
    expect(inferTextStyle(block("Hi Mia! Right now my mum 1) ________ pictures. See you soon, Lily"))).toBe("email");
  });

  it("finds the email after a lead-in sentence", () => {
    const b = block("Complete Tom's email with the verbs. Hi, Ben! Right now my dad is painting the kitchen and my sisters are unpacking. Talk to you soon. Tom");
    expect(inferTextStyle(b)).toBe("email");
    expect(splitArtefact(b.body).lead).toBe("Complete Tom's email with the verbs.");
  });

  it("recognises 'You're invited' with a date", () => {
    expect(inferTextStyle(block("You're invited! Come to my Space Party on Saturday 14th May at 6 pm. Sam"))).toBe("invitation");
  });

  it("leaves normal exercises, dialogues and readings alone", () => {
    const plain = [
      "Answer these geography questions.",
      "Hello! What's your name? I'm Misty.",
      "Wave! Hello, Pip! What's in the bag?",
      "Write an email to a friend about your weekend. Use the words in the box.",
      "Hello, Tom! Nice to meet you. I'm Ben.",
      "A: Hi Kenji! Are you free on Saturday? B: Sure. Count me in! A: Great. See you, Kenji",
      "Write the invitation for your theme party.",
      "Lily lives in a small flat in London with her mum and her dog Max. Every morning she walks to school with her friend Sophie.",
      "Read the note and the speech bubbles. Which chores is each person doing? Listen, read and find out.",
      "Please come to my party!",
    ];
    for (const body of plain) expect(inferTextStyle(block(body)), body).toBeNull();
  });

  it("does not call every quiz-titled or a/b exercise a quiz", () => {
    expect(
      inferTextStyle(block("Answer these geography questions.", { heading: "1 Geography Quiz", items: ["Which country is the Eiffel Tower in?", "What is the capital of Japan?", "Which ocean is the largest?"] })),
    ).toBeNull();
    expect(
      inferTextStyle(
        block("Read again and circle a or b.", {
          heading: "2 a) Read again and circle a or b.",
          items: ["Mona's dad is ___ new shelves. a) painting b) making", "Mona is painting her ___ red. a) chest b) shelves", "The ___ bed is for Missy. a) top b) bottom"],
        }),
      ),
    ).toBeNull();
  });

  it("gives way to callouts, dialogue and tables, but honours the writer's style", () => {
    expect(resolveTextStyle({ ...ARTEFACT_FIXTURES.email, callout: "tip" })).toBeNull();
    expect(resolveTextStyle({ ...ARTEFACT_FIXTURES.note, dialogue: [{ speaker: "A", line: "Hi" }] })).toBeNull();
    expect(resolveTextStyle(ARTEFACT_FIXTURES.poster)).toBe("poster");
    expect(resolveTextStyle(block("Short.", { textStyle: "note" }))).toBe("note");
  });
});

describe("letterParts", () => {
  it("splits greeting, text and sign-off", () => {
    expect(letterParts(ARTEFACT_FIXTURES.email.body)).toEqual({
      greeting: "Hi, Ben!",
      body: expect.stringMatching(/^It.s the first day[^]*short break!$/),
      signOff: "Talk to you soon.\nTom",
    });
    expect(letterParts(ARTEFACT_FIXTURES.note.body)).toMatchObject({ greeting: "Ricky,", signOff: "Jane X" });
    expect(letterParts(ARTEFACT_FIXTURES.message.body)).toMatchObject({ greeting: "Hi Mia!", signOff: "See you soon, Lily" });
  });

  it("keeps text without a letter shape whole", () => {
    expect(letterParts("SUMMER FUN DAY\nCity park, free for everyone.")).toEqual({ greeting: "", body: "SUMMER FUN DAY\nCity park, free for everyone.", signOff: "" });
  });
});

describe("quizParts", () => {
  it("splits a question from its options", () => {
    expect(quizParts("How do you get most of your information? A I surf the Net. B I read magazines.")).toEqual({
      question: "How do you get most of your information?",
      options: [
        { letter: "A", text: "I surf the Net." },
        { letter: "B", text: "I read magazines." },
      ],
    });
    expect(quizParts("A friend calls. You A answer B ignore it").options.map((o) => o.text)).toEqual(["answer", "ignore it"]);
    expect(quizParts("What is your name?")).toEqual({ question: "What is your name?", options: [] });
  });
});
