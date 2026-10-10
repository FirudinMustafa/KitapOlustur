import sharp from "sharp";
import type { GeneratedUnit } from "@/lib/ai/schemas";
import type { CourseUnitSummary } from "../ContentsDocument";

// A hand-written unit that exercises every layout template, callout,
// dialogue and table - used by the template render tests and for eyeballing
// the design without spending AI credit (see BookDocument.templates.test.tsx).

export async function placeholderImage(label: string, hue: number, width = 1536, height = 1024): Promise<string> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue},70%,72%)"/><stop offset="1" stop-color="hsl(${(hue + 60) % 360},70%,55%)"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <circle cx="${width * 0.3}" cy="${height * 0.55}" r="${height * 0.18}" fill="#fff" opacity="0.35"/>
    <circle cx="${width * 0.7}" cy="${height * 0.45}" r="${height * 0.24}" fill="#fff" opacity="0.25"/>
    <text x="50%" y="52%" font-size="${height * 0.08}" font-family="sans-serif" text-anchor="middle" fill="#fff">${label}</text>
  </svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

export const sampleUnit: GeneratedUnit = {
  unitNumber: 1,
  title: "My Neighbourhood",
  glossary: [],
  workbookPages: [],
  studentBookPages: [
    {
      sourcePageNumber: 1,
      pageType: "unit_opener",
      unitNumber: 1,
      layoutTemplate: "unit-opener-hero",
      imagePrompt: "A sunny street with shops",
      blocks: [
        { kind: "narrative", heading: "Warm-up", body: "Look at the picture. What can you see? Which places do you visit every week?" },
        {
          kind: "reference",
          heading: "In this unit you will…",
          body: "",
          items: ["I can name places in a town.", "I can ask for and give directions.", "I can describe my neighbourhood."],
        },
      ],
    },
    {
      sourcePageNumber: 2,
      pageType: "content",
      unitNumber: 1,
      layoutTemplate: "vocab-cards",
      blocks: [
        {
          kind: "practice",
          heading: "Match the places",
          body: "Write the correct place for each sentence.",
          items: ["You buy bread here.", "You borrow books here.", "You see a doctor here."],
          answerKey: ["bakery", "library", "hospital"],
        },
      ],
      glossary: [
        { term: "bakery", definition: "A shop that sells bread and cakes.", example: "I buy fresh bread at the bakery." },
        { term: "library", definition: "A place where you can borrow books.", example: "The library is next to the park." },
        { term: "post office", definition: "A place to send letters and parcels." },
        { term: "pharmacy", definition: "A shop that sells medicine." },
        { term: "square", definition: "An open area in the centre of a town." },
        { term: "bridge", definition: "It goes over a river or a road." },
      ],
    },
    {
      sourcePageNumber: 3,
      pageType: "content",
      unitNumber: 1,
      layoutTemplate: "dialogue-strip",
      imagePrompt: "Two friends at a street corner",
      blocks: [
        {
          kind: "narrative",
          heading: "Excuse me, where is…?",
          body: "Listen and read. Where does Leo want to go?",
          dialogue: [
            { speaker: "Leo", line: "Excuse me, is there a library near here?" },
            { speaker: "Ayşe", line: "Yes, there is. Go straight on and turn left at the bakery." },
            { speaker: "Ayşe", line: "No, it's about five minutes. It's opposite the post office." },
            { speaker: "Leo", line: "Thank you very much!" },
          ],
        },
        {
          kind: "explanation",
          heading: "Asking for directions",
          body: "Use these phrases to ask for and give directions.",
          table: {
            headers: ["Ask", "Answer"],
            rows: [
              ["Is there a … near here?", "Yes, there is. / No, there isn't."],
              ["How do I get to …?", "Go straight on. Turn left/right."],
            ],
          },
        },
      ],
    },
    {
      sourcePageNumber: 4,
      pageType: "content",
      unitNumber: 1,
      layoutTemplate: "reading-with-sidebar",
      imagePrompt: "An old town square",
      blocks: [
        {
          kind: "narrative",
          heading: "A Town with a Story",
          body: "Ayvalık is a small town on the Aegean coast. Its narrow streets are full of old stone houses, colourful doors and small cafés. Every Thursday there is a big market in the main square, and people come from nearby villages to sell olives, cheese and fresh vegetables.\n\nThe town is famous for its olive oil and its 'tost'. In the evening, families walk along the sea front and watch the sunset from Şeytan Sofrası, a hill to the south of the town.",
        },
        { kind: "reference", heading: "Ayvalık", body: "There are more than 20 islands near Ayvalık. The biggest one is Cunda.", callout: "did_you_know" },
        {
          kind: "practice",
          heading: "Read and answer",
          body: "",
          items: ["When is the market?", "What is the town famous for?", "Where do families watch the sunset?"],
          answerKey: ["On Thursdays.", "Olive oil and 'tost'.", "From Şeytan Sofrası."],
        },
      ],
    },
    {
      sourcePageNumber: 5,
      pageType: "exercise",
      unitNumber: 1,
      layoutTemplate: "exercise-grid",
      blocks: [
        { kind: "explanation", heading: "Practice", body: "Complete the exercises. Use the words from the unit." },
        {
          kind: "practice",
          heading: "Complete the sentences",
          body: "Use: opposite, next to, between.",
          items: ["The bank is ___ the café.", "The park is ___ the school and the bridge.", "The pharmacy is ___ the hospital."],
          answerKey: ["next to", "between", "opposite"],
        },
        {
          kind: "practice",
          heading: "Choose the correct word",
          body: "",
          items: ["There is / are a cinema.", "There is / are two parks.", "Is / Are there a bakery?"],
          answerKey: ["is", "are", "Is"],
        },
        {
          kind: "assessment",
          heading: "Quick check",
          body: "",
          interactive: { type: "multiple_choice", question: "Where can you borrow books?", options: ["bakery", "library", "bank"], correctIndex: 1 },
        },
        {
          kind: "practice",
          heading: "Match",
          body: "",
          interactive: {
            type: "matching",
            pairs: [
              { left: "turn", right: "left" },
              { left: "go", right: "straight on" },
              { left: "next", right: "to" },
            ],
          },
        },
      ],
    },
    {
      sourcePageNumber: 6,
      pageType: "content",
      unitNumber: 1,
      layoutTemplate: "image-left-text-right",
      imagePrompt: "A map of a small town",
      blocks: [
        { kind: "narrative", heading: "Look at the map", body: "This is Leo's town. His house is in Green Street, next to the park. He walks to school every day. The school is between the library and the swimming pool." },
        {
          kind: "practice",
          heading: "True or false?",
          body: "",
          items: ["Leo's house is next to the park.", "The school is opposite the pool."],
          answerKey: ["True", "False"],
        },
        { kind: "reference", heading: "there is / there are", body: "Use 'there is' with one thing and 'there are' with two or more.", callout: "grammar" },
      ],
    },
    {
      sourcePageNumber: 7,
      pageType: "content",
      unitNumber: 1,
      layoutTemplate: "two-column",
      blocks: [
        { kind: "explanation", heading: "Prepositions of place", body: "We use prepositions to say where something is: in, on, under, next to, between, opposite, behind, in front of." },
        { kind: "example", heading: "Examples", body: "The cat is under the table. The bus stop is in front of the bank. The shop is behind the station." },
        { kind: "practice", heading: "Write", body: "Write three sentences about your street.", items: ["…", "…", "…"], answerKey: ["Students' own answers", "Students' own answers", "Students' own answers"] },
        { kind: "reference", heading: "Remember", body: "'Opposite' means on the other side, facing something.", callout: "remember" },
      ],
    },
    {
      sourcePageNumber: 8,
      pageType: "review",
      unitNumber: 1,
      layoutTemplate: "review-checklist",
      blocks: [
        {
          kind: "reference",
          heading: "Now I can…",
          body: "",
          items: ["I can name ten places in a town.", "I can ask for directions.", "I can use there is / there are."],
        },
        {
          kind: "practice",
          heading: "Unit review",
          body: "",
          items: ["Name two places where you can buy food.", "How do you ask for directions politely?"],
          answerKey: ["e.g. bakery, supermarket", "Excuse me, how do I get to …?"],
        },
      ],
    },
    {
      sourcePageNumber: 9,
      pageType: "content",
      unitNumber: 1,
      layoutTemplate: "full-bleed-illustration",
      imagePrompt: "Night over the town",
      blocks: [{ kind: "narrative", heading: "", body: "That night, Leo looked out of his window. The streets were quiet, and the lights of the bridge shone on the river like small stars." }],
    },
  ],
};

export const sampleContents: CourseUnitSummary[] = [
  { number: 1, title: "My Neighbourhood", topic: "Places in town", keyTerms: "bakery, library", objectives: "Give directions", level: "A2" },
];

export async function samplePageImages(): Promise<Record<number, string>> {
  const entries = await Promise.all(
    [1, 3, 4, 6, 9].map(async (n, i) => [n, await placeholderImage(`page ${n}`, i * 55)] as const),
  );
  return Object.fromEntries(entries);
}
