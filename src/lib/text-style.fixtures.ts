import type { ContentBlock } from "@/lib/ai/schemas";

// One block per artefact style, written after i5 Team 2 pp.13-16 (Tom's
// email to Ben, Jane's note, Mike's party invitation, the "What kind of
// person are you?" quiz) - used by the detection tests and the render test.
export const ARTEFACT_FIXTURES: Record<"email" | "note" | "message" | "invitation" | "quiz" | "poster", ContentBlock> = {
  email: {
    kind: "practice",
    heading: "5 a) Complete the email.",
    body:
      "Hi, Ben!\nIt's the first day in our new house and things are not quite ready yet. Right now my mum 1) ________ up the curtains in the living room and my dad 2) ________ some boxes into the kitchen. My sisters 3) ________ some things out of the boxes. And as for me, I 4) ________ a short break!\nTalk to you soon.\nTom",
    items: ["Tom's mum ___ the curtains.", "Tom's dad ___ boxes.", "His sisters ___ things.", "Tom ___ a break."],
    answerKey: ["is putting up", "is carrying", "are taking", "am having"],
    activity: { type: "word_bank", words: ["put", "carry", "take", "have"] },
  },
  note: {
    kind: "narrative",
    heading: "2 Read Jane's note.",
    body: "Ricky,\nWe're having people for dinner tonight! There's a lot to do.\n– shopping\n– cooking\n– washing-up\nPlease come home early.\nJane X",
  },
  message: {
    kind: "narrative",
    heading: "3 Read Lily's message.",
    body: "Hi Mia! It's moving day! My dad is painting the hall. See you soon, Lily",
  },
  invitation: {
    kind: "practice",
    heading: "6 Mike is having a party. Read and circle the right words.",
    body:
      "Please come to my 1) Hollywood / Sports Theme Party on 2) 12th / 20th January at 3) 8:30 / 7:30. Lots of food and soft drinks for everyone! My house is at 4) 45 / 55 King Street.\nDon't forget to wear something sporty!\nMike Smith",
    items: ["Hollywood / Sports", "12th / 20th", "8:30 / 7:30", "45 / 55"],
    answerKey: ["Hollywood", "20th", "7:30", "45"],
  },
  quiz: {
    kind: "practice",
    heading: "2 What kind of person are you? Do the quiz and find out!",
    body: "The things you like doing say a lot about the kind of person you are. Try our quiz and see if we're right!",
    items: [
      "Which of these do you prefer to do? A collect comics B hang out with friends",
      "What do you usually do in the evenings? A watch DVDs B send text messages",
      "How do you get most of your information? A I surf the Net. B I read magazines.",
      "How do you spend your weekends? A I download music. B I play sports.",
    ],
  },
  poster: {
    kind: "narrative",
    heading: "4 Read the poster.",
    body: "SUMMER FUN DAY\nSaturday 14th June, 10 am - 4 pm\nCity Park: games, music, food and a big water slide! Free for everyone.",
    textStyle: "poster",
  },
};
