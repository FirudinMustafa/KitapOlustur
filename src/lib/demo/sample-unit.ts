import type { GeneratedUnit } from "@/lib/ai/schemas";

export const SAMPLE_UNIT: GeneratedUnit = {
  unitNumber: 1,
  title: "My Room, My Time",
  glossary: [
    {
      term: "bunk bed",
      definition: "a bed with one part above another",
      example: "I sleep on the top bunk bed and my brother sleeps on the bottom one.",
    },
    {
      term: "hang out",
      definition: "to spend time relaxing with friends",
      example: "We usually hang out at the skate park after school.",
    },
  ],
  studentBookPages: [
    {
      sourcePageNumber: 5,
      pageType: "unit_opener",
      unitNumber: 1,
      blocks: [
        {
          kind: "narrative",
          heading: "Reading: A Room With a View",
          body: "Zara is helping her cousin Leo set up his new room after moving house. Read the dialogue and find out what they are doing.\n\nLeo: Thanks for helping me, Zara! This room looks so empty.\nZara: No problem! Let's start with the bunk bed.",
          items: ["Who is helping Leo set up his room?", "What is Leo's dad doing?"],
          answerKey: ["Zara, his cousin, is helping him.", "He is bringing the bunk bed up the stairs."],
        },
      ],
    },
    {
      sourcePageNumber: 6,
      pageType: "content",
      unitNumber: 1,
      blocks: [
        {
          kind: "explanation",
          heading: "Grammar: Present Continuous",
          body: "We use the Present Continuous for actions happening right now, or around the time of speaking.\n\nAffirmative: I am (I'm) reading.",
          items: ["Zara ___________ (help) Leo with his new room.", "Leo's dad ___________ (carry) the bunk bed up the stairs."],
          answerKey: ["is helping", "is carrying"],
        },
      ],
    },
  ],
  workbookPages: [
    {
      sourcePageNumber: 6,
      pageType: "exercise",
      unitNumber: 1,
      blocks: [
        {
          kind: "practice",
          heading: "Grammar Practice: Present Continuous",
          body: "Complete the sentences with the correct Present Continuous form of the verb in brackets.",
          items: ["My cousins ___________ (stay) with us this week.", "___________ (it/rain) outside right now?"],
          answerKey: ["are staying", "Is it raining"],
        },
      ],
    },
  ],
};
