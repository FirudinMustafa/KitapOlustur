// Content of "Paper Kite 5", Unit 2 "Our Classroom" (Student's Book +
// Workbook), written for Year 5 in Türkiye from the Maarif English
// curriculum targets of Theme 2 "Classroom Life" (outcomes, vocabulary,
// grammar incl. object pronouns, skills, lesson sequence). Every text, item,
// name and story here is new. Pages (handcraft-meb5.tsx) and the answer key
// read the same data, so an item and its key can never disagree;
// checkContent() solves the derivable items again from the facts
// (timetable, clocks, counts) and throws on any mismatch.
//
// Times: digital times are 24-hour ("13:55"); analogue clocks show the
// 12-hour face of the same time.

// --- the class -------------------------------------------------------------------------------
export const SCHOOL = "Yeşiltepe Lower Secondary School";
export const CLASS = "5/C";
export const CAST = [
  { key: "defne", name: "Defne", line: "loves Art. She is the tidy-up helper.", look: "girl, long dark-brown hair in one braid, yellow cardigan over a white T-shirt, blue jeans, red trainers" },
  { key: "kerem", name: "Kerem", line: "loves Science. He is the book helper.", look: "boy in a red wheelchair, short black hair, round glasses, blue jumper, grey trousers" },
  { key: "zehra", name: "Zehra", line: "loves Maths. She is the plant helper.", look: "girl, white headscarf, lilac long-sleeved top, long navy skirt, purple backpack" },
  { key: "arda", name: "Arda", line: "loves P.E. He is the board helper.", look: "boy, curly light-brown hair, freckles, green T-shirt, dark blue tracksuit trousers, white trainers" },
  { key: "can", name: "Can", line: "is new in 5/C. He is the window helper.", look: "boy, short straight black hair, orange hoodie, carrying a new blue school bag" },
  { key: "aksoy", name: "Ms Aksoy", line: "is the class teacher of 5/C.", look: "woman teacher in her thirties, shoulder-length black hair, warm smile, teal blazer, white blouse, grey trousers" },
] as const;
export type CastKey = (typeof CAST)[number]["key"];

// --- the timetable of 5/C ------------------------------------------------------------------------
// A single-shift school: 40-minute lessons, 15-minute breaks (20 minutes
// after the 2nd lesson), lunch 12:10-13:00 (50 minutes), school 08:40-15:30.
export const PERIODS = ["08:40", "09:35", "10:35", "11:30", "13:00", "13:55", "14:50"] as const;
export const LESSON_MIN = 40;
export const BREAKS = [15, 20, 15, 50, 15, 15]; // minutes after lessons 1-6 (the 4th is lunch)
export const SCHOOL_END = "15:30";
export const DAYS5 = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
export type Day5 = (typeof DAYS5)[number];
export const TIMETABLE: Record<Day5, string[]> = {
  Monday: ["Turkish", "Turkish", "English", "Maths", "Science", "Guidance", "Elective"],
  Tuesday: ["Maths", "Maths", "Social Studies", "Social Studies", "Music", "Art", "Elective"],
  Wednesday: ["Science", "Science", "Turkish", "English", "Religion and Morals", "Religion and Morals", "Elective"],
  Thursday: ["Turkish", "Maths", "IT", "IT", "P.E.", "P.E.", "Elective"],
  Friday: ["Turkish", "Turkish", "Maths", "English", "Science", "Social Studies", "Elective"],
};
/** The cells Ex 6 leaves empty (day, period index), first one done as the example; short subjects only (they are handwritten). */
export const TT_GAPS: [Day5, number][] = [
  ["Tuesday", 4],
  ["Tuesday", 5],
  ["Monday", 5],
  ["Thursday", 2],
  ["Thursday", 4],
  ["Friday", 3],
];

// --- time words -----------------------------------------------------------------------------------
const NUM_WORDS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const MIN_WORDS: Record<number, string> = { 5: "five", 10: "ten", 15: "quarter", 20: "twenty", 25: "twenty-five", 30: "half" };
/** "08:40" -> "twenty to nine"; with dayPart, "in the morning/afternoon". */
export function timeWords(hhmm: string, dayPart = false): string {
  const [h24, m] = hhmm.split(":").map(Number);
  const h12 = ((h24 + 11) % 12) + 1;
  const next = (h12 % 12) + 1;
  let s: string;
  if (m === 0) s = `${NUM_WORDS[h12]} o'clock`;
  else if (m <= 30) s = `${MIN_WORDS[m]} past ${NUM_WORDS[h12]}`;
  else s = `${MIN_WORDS[60 - m]} to ${NUM_WORDS[next]}`;
  if (!dayPart) return s;
  return `${s} in the ${h24 < 12 ? "morning" : "afternoon"}`;
}
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
export function numberWords(n: number): string {
  if (n === 100) return "a hundred";
  const t = Math.floor(n / 10);
  const u = n % 10;
  return u ? `${TENS[t]}-${NUM_WORDS[u]}` : TENS[t];
}
export const addMin = (hhmm: string, min: number) => {
  const [h, m] = hhmm.split(":").map(Number);
  const t = h * 60 + m + min;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

// --- SB pp. 4-5: Get ready (a new classmate on Monday morning) ------------------------------------
export const SCENE_TIME = "08:30";
export const SCENE_BUBBLES: { who: CastKey; text: string }[] = [
  { who: "aksoy", text: "Good morning, everyone! This is Can. He's our new classmate." },
  { who: "arda", text: "Hi, Can! Our class rules are on the wall. Rule number one: don't shout!" },
  { who: "defne", text: "Welcome to 5/C! You can hang your coat here." },
  { who: "can", text: "Thank you! What's the first lesson today?" },
  { who: "zehra", text: "It's Turkish. It starts at twenty to nine." },
  { who: "arda", text: "And P.E. is on Thursdays. It's a double lesson!" },
  { who: "aksoy", text: "Can, please take a seat next to Kerem." },
  { who: "kerem", text: "Hi, Can! Hold on a minute. Here's a timetable for you." },
];
/** The numbered objects in the scene (Ex 15): the number tags are placed on the picture. */
export const SCENE_OBJECTS = ["smart board", "clock", "flag", "notice board", "bookshelf", "coat hooks", "school bag", "pencil case"] as const;
export const EX1 = {
  example: { q: "Which class is it?", a: "It's 5/C." },
  items: [
    { q: "What day is it today?", a: "It's Monday." },
    { q: "What time is it on the clock?", a: `It's ${timeWords(SCENE_TIME)}.` },
    { q: "Who is the new student?", a: "Can." },
    { q: "What has Kerem got for Can?", a: "A timetable." },
  ],
};
export const EX2 = {
  example: { parts: ["Can is a new ", ["teacher", "student"], "."] as const, a: 1 },
  items: [
    { parts: ["Rule number one: Don't ", ["shout", "run"], "!"] as const, a: 0 },
    { parts: ["The first lesson is ", ["Turkish", "English"], "."] as const, a: 0 },
    { parts: ["It starts at ", ["twenty to nine", "half past eight"], "."] as const, a: 0 },
    { parts: ["P.E. is on ", ["Mondays", "Thursdays"], "."] as const, a: 1 },
  ],
};

// --- SB pp. 6-7: Listen and look ---------------------------------------------------------------------
export const EX3_TOPICS: [string, boolean][] = [
  ["school subjects", true],
  ["animals", false],
  ["time", true],
  ["classroom objects", true],
  ["food", false],
  ["days of the week", true],
  ["classroom rules", true],
  ["the weather", false],
  ["timetables", true],
];
/** Ex 4: the sentences in order; the clocks a-f in their printed order. */
export const EX4_TIMES = ["08:40", "09:35", "11:30", "13:00", "13:55", "14:50"];
export const EX4_CLOCKS = ["11:30", "14:50", "08:40", "13:00", "09:35", "13:55"];
export const EX5 = { example: "13:55", items: ["10:35", "12:10", "15:30", "07:50"] };
export const EX6_SCRIPT =
  "Ms Aksoy: Here is our timetable, Can. Let's write the missing lessons together. A lesson is forty minutes. On Tuesdays, we have Music at one o'clock and Art at five to two. On Mondays, there is a Guidance lesson at five to two. On Thursdays, we have IT at twenty-five to eleven. It's a double lesson. And P.E. is at one o'clock. On Fridays, English starts at half past eleven.";
export const EX7_MODEL = [
  { who: "defne" as CastKey, text: "What time does the Art lesson start on Tuesdays?" },
  { who: "can" as CastKey, text: "It starts at five to two." },
  { who: "zehra" as CastKey, text: "Is there an English lesson on Thursdays?" },
  { who: "kerem" as CastKey, text: "No, there isn't." },
];

// --- SB p. 8: Say it right + school subjects ------------------------------------------------------
export const EX9 = ["I don't know the answer.", "There aren't any chairs in the hall.", "Defne isn't late today."];
export const EX10 = {
  example: "Kerem doesn't have a red pen.",
  items: ["There isn't a clock in the library.", "We aren't in the garden.", "Arda doesn't like Music.", "I don't have a ruler."],
};
export const NEGATIVES = ["isn't", "aren't", "don't", "doesn't"];
export const SUBJECTS = ["Maths", "Science", "Turkish", "Social Studies", "English", "P.E.", "Art", "Music", "IT", "Religion and Morals"] as const;
/** Ex 11: the picture tiles in printed order (1 is the example). */
export const EX11_TILES = ["Science", "Maths", "Turkish", "Social Studies", "English", "P.E.", "Art", "Music", "IT", "Religion and Morals"] as const;
export const EX11_SCRIPT = "Listen, point and say. Science. Maths. Turkish. Social Studies. English – our Foreign Language. Physical Education – P.E. Art. Music. Information Technology – IT. Religion and Morals.";

// --- SB p. 9: days and numbers --------------------------------------------------------------------
export const DAYS7 = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export const EX12_CHIPS = ["Thursday", "Monday", "Sunday", "Tuesday", "Saturday", "Friday", "Wednesday"];
export const EX13 = { numbers: [56, 69, 74, 85, 93, 100], words: [93, 69, 100, 56, 85, 74] };
export const EX14 = {
  script: "Ms Aksoy: Listen, everyone! Here are some numbers about our school. There are eighty-four chairs in the school hall. The library has sixty-six dictionaries. There are seventy-three trees in the school garden. And there are ninety-two students in Year 5!",
  example: { label: "chairs in the hall", pair: [84, 74], a: 84 },
  items: [
    { label: "dictionaries in the library", pair: [56, 66], a: 66 },
    { label: "trees in the garden", pair: [73, 83], a: 73 },
    { label: "Year 5 students", pair: [62, 92], a: 92 },
  ],
};

// --- SB p. 10: classroom objects + riddles ----------------------------------------------------
export const EX15_SCRIPT = "Listen and say. One – smart board. Two – clock. Three – flag. Four – notice board. Five – bookshelf. Six – coat hooks. Seven – school bag. Eight – pencil case.";
export const EX16 = {
  cards: ["scissors", "notebook", "ruler", "crayons", "school bag", "glue", "calculator", "pencil case"] as const,
  defs: [
    ["a", "I cut paper. Be careful with me!", "scissors"],
    ["b", "I'm sticky. Put me on paper.", "glue"],
    ["c", "I'm long and straight. Draw lines with me.", "ruler"],
    ["d", "Your pens and pencils sleep in me.", "pencil case"],
    ["e", "You carry me to school on your back.", "school bag"],
    ["f", "You write your homework in me.", "notebook"],
    ["g", "I'm red, blue and green. Colour pictures with me.", "crayons"],
    ["h", "I've got numbers on me. I help you in Maths.", "calculator"],
  ] as [string, string, string][],
};
export const EX17_LESSONS = ["Art", "Maths", "Science", "P.E."];

// --- SB pp. 11-12: grammar (pattern tables + noticing, no rules) ---------------------------------------
/** The class corner drawn for Ex 18 (handcraft-meb5-art.ts classCorner draws exactly these). */
export const CORNER = { clocks: 1, posters: 3, bookcases: 1, windows: 2, chairs: 2, computers: 0, plants: 0 };
export const EX18 = {
  example: { parts: ["There ", ["is", "are"], " a clock on the wall."] as const, a: 0 },
  items: [
    { parts: ["There ", ["is", "are"], " three posters."] as const, a: 1 },
    { parts: ["There ", ["is", "are"], " a bookcase."] as const, a: 0 },
    { parts: ["There ", ["is", "are"], " two windows."] as const, a: 1 },
    { parts: ["There ", ["isn't", "aren't"], " a computer."] as const, a: 0 },
    { parts: ["", ["Is", "Are"], " there any plants? No, there aren't."] as const, a: 1 },
  ],
};
export const NOTICE_THERE = { q: "Look at the coloured words. Which word goes with one thing? Which word goes with two or more things?", a: "is (one thing) / are (two or more things)" };
export const NOTICE_PRON = { q: "Find the words for Can, Ms Aksoy, the posters, we and I.", a: "him, her, them, us, me" };
export const NOTICE_HAVE = { q: "Look: We have ... and Kerem has ... What is different?", a: "Kerem / he / she: has, uses, doesn't (an -s at the end)" };
export const EX_PRON = {
  example: { parts: ["Ms Aksoy is our class teacher. We love ", ["her", "him"], "."] as const, a: 0 },
  items: [
    { parts: ["Arda has got the ball. Throw it to ", ["he", "him"], "!"] as const, a: 1 },
    { parts: ["Kerem, can you lend ", ["I", "me"], " your ruler?"] as const, a: 1 },
    { parts: ["The dictionaries are on the floor. Put ", ["it", "them"], " on the bookshelf."] as const, a: 1 },
    { parts: ["We're late! Please wait for ", ["us", "we"], "!"] as const, a: 0 },
    { parts: ["Zehra is good at Maths. Ask ", ["she", "her"], " for help."] as const, a: 1 },
  ],
};
export const EX19 = {
  example: { subject: "Maths", day: "Wednesday" },
  items: [
    { subject: "English", day: "Friday" },
    { subject: "P.E.", day: "Monday" },
    { subject: "IT", day: "Thursday" },
    { subject: "Music", day: "Friday" },
  ],
};
export const EX_3RD = {
  example: { who: "Kerem", verb: "use", rest: "a ruler in Science.", a: "uses" },
  items: [
    { who: "Zehra", verb: "water", rest: "the plants.", a: "waters" },
    { who: "Arda", verb: "clean", rest: "the board.", a: "cleans" },
    { who: "Can", verb: "open", rest: "the windows.", a: "opens" },
    { who: "Defne", verb: "like", rest: "Art.", a: "likes" },
  ],
};
export const EX_DOES = {
  example: { q: "Does Kerem have Music on Tuesdays?", a: "Yes, he does." },
  items: [
    { q: "Does Kerem have English on Thursdays?", a: "No, he doesn't." },
    { q: "Does Zehra have Maths on Fridays?", a: "Yes, she does." },
    { q: "Does Arda have P.E. on Mondays?", a: "No, he doesn't." },
    { q: "Do you and your friends in 5/C have IT on Thursdays?", a: "Yes, we do." },
  ],
};
export const EX20 = {
  example: { subject: "Art", day: "Tuesday" },
  items: [
    { subject: "Science", day: "Monday" },
    { subject: "English", day: "Monday" },
    { subject: "Maths", day: "Thursday" },
  ],
};

// --- SB p. 13: board game -----------------------------------------------------------------------
export const BOARD: { t: string; kind?: "start" | "end" | "fwd" | "back" | "help" }[] = [
  { t: "START", kind: "start" },
  { t: "What time is it? 09:35" },
  { t: "Name three school subjects." },
  { t: "Count from 50 to 100 in tens." },
  { t: "Help a friend! Go forward 1.", kind: "help" },
  { t: "What do you use in Art?" },
  { t: "Spell: Wednesday" },
  { t: "Is there a flag in your classroom?" },
  { t: "What time is it? 13:55" },
  { t: "No homework! Go back 2.", kind: "back" },
  { t: "What day comes after Thursday?" },
  { t: "Say a class rule." },
  { t: "Zehra is my friend. I like ..." },
  { t: "Say the number: 87" },
  { t: "You tidy up your desk. Go forward 2.", kind: "fwd" },
  { t: "How many minutes is one lesson?" },
  { t: "What time is it? 08:15" },
  { t: "Name four classroom objects." },
  { t: "When is your English lesson?" },
  { t: "FINISH", kind: "end" },
];
export const BOARD_RULES = [
  "Play in groups of two or three. You need a dice and a coin for every player.",
  "Throw the dice and move your coin.",
  "Read the square and answer. Right answer – stay. Wrong answer – go back 1.",
  "Say \"Well done!\" when a friend answers correctly. The first player at FINISH wins.",
];

// --- SB p. 14: read: Can's class blog -------------------------------------------------------------
export const CAN_BLOG_TITLE = "My first week in 5/C";
export const CAN_BLOG = [
  "Hello! I'm Can. I'm new at Yeşiltepe Lower Secondary School. My class is 5/C. There are twenty-four students in my class, and our class teacher is Ms Aksoy. She always smiles!",
  "School starts at twenty to nine. There are seven lessons every day, and a lesson is forty minutes. My favourite day is Thursday because we have IT and a double P.E. lesson.",
  "We walk slowly in the school, we speak quietly and we raise our hands. Every student has a job, too. On 29 October, it's Republic Day, and our class makes flags for the classroom.",
];
export const HELPERS: [string, string, string][] = [
  ["Arda", "board helper", "cleans the board after every lesson."],
  ["Zehra", "plant helper", "waters the plants on Mondays and Thursdays."],
  ["Kerem", "book helper", "brings the dictionaries on Fridays."],
  ["Defne", "tidy-up helper", "tidies up the classroom at the end of the day."],
  ["Can", "window helper", "opens the windows at every break."],
];
export const RULES = ["Raise your hand and wait.", "Walk slowly. Don't run.", "Speak quietly. Don't shout.", "Keep your desk tidy.", "Say \"please\" and \"thank you\"."];
export const EX23 = { q: "Read quickly. Who writes the blog? What is his job?", a: "Can. He is the window helper." };
export const EX24 = {
  example: { s: "Can is in class 5/C.", a: true },
  items: [
    { s: "Ms Aksoy always smiles.", a: true },
    { s: "A lesson is fifty minutes.", a: false },
    { s: "Can's favourite day is Thursday.", a: true },
    { s: "Zehra waters the plants on Tuesdays.", a: false },
    { s: "Kerem brings the dictionaries on Fridays.", a: true },
    { s: "Can closes the windows at every break.", a: false },
  ],
};

// --- SB p. 15: write: what time do you ...? -----------------------------------------------------
export const SURVEY_ROWS = ["get up", "go to school", "have lunch", "do homework", "go to bed"];
/** The ★ table: Defne's answers given, the times to choose from in a box. */
export const SURVEY_DEFNE = ["07:00", "08:10", "12:10", "17:30", "21:30"];
export const SURVEY_BOX = ["06:45", "07:15", "08:00", "12:10", "16:30", "21:00"];
export const ROUTINE_TEXT = [
  "I get up at seven o'clock. I go to school at ten past eight, and school starts at twenty to nine. We have lunch at ten past twelve.",
  "My friend Zehra gets up at quarter to seven. She walks to school with her brother. She does her homework at half past four, and she goes to bed at nine o'clock.",
];
export const WRITE_CHECK = ["capital letters and full stops", "four times", "-s for your friend: gets, goes, has", "one sentence about school"];

// --- SB p. 16: around the world -------------------------------------------------------------------
export const CLIL: { k: string; country: string; text: string }[] = [
  { k: "A", country: "South Korea", text: "In South Korea, the school year starts in March. Many students have lunch together at school. After lessons, some students go to clubs. Science and IT clubs are very popular." },
  { k: "B", country: "Brazil", text: "In Brazil, many schools have two groups of students. One group has lessons in the morning. The other group has lessons in the afternoon. In P.E. lessons, children love football." },
  { k: "C", country: "Kazakhstan", text: "In Kazakhstan, the school year starts on 1st September. The first school day has a special name: Knowledge Day. Students learn three languages at school: Kazakh, Russian and English." },
  { k: "D", country: "Australia", text: "In Australia, some children live on big farms. There isn't a school near their home. They have lessons on a computer at home, and their teacher is in a different town." },
];
/** Ex 29: the pictures 1-5 in printed order: the text each shows ("-" = the extra one). */
export const CLIL_PICS: { k: string; desc: string }[] = [
  { k: "D", desc: "a girl on a farm has a lesson on a laptop, her teacher on the screen" },
  { k: "-", desc: "children ski to a small school in the snow" },
  { k: "B", desc: "children play football in a school P.E. lesson" },
  { k: "A", desc: "students eat lunch together at long tables in a school dining hall" },
  { k: "C", desc: "children with flowers and balloons on the first school day" },
];
export const EX31 = {
  example: { s: "Students learn three languages.", a: "C" },
  items: [
    { s: "Some students have lessons at home on a computer.", a: "D" },
    { s: "The school year starts in March.", a: "A" },
    { s: "Some students have lessons in the afternoon.", a: "B" },
    { s: "The first school day has a special name.", a: "C" },
    { s: "There isn't a school near some homes.", a: "D" },
  ],
};

// --- SB pp. 17-18: story ----------------------------------------------------------------------------
export const STORY_TITLE = "The Tidy Robot";
export const STORY: { scene: string; bubbles: { who: CastKey; text: string }[] }[] = [
  { scene: "Tuesday morning in the classroom: Kerem shows a drawing of a small cardboard robot to Defne and Zehra.", bubbles: [{ who: "kerem", text: "Look! This is my robot for the Science Fair. It picks up rubbish." }, { who: "defne", text: "Cool! When is the fair?" }, { who: "kerem", text: "On Friday at quarter to four." }] },
  { scene: "Kerem points at a pile of empty boxes and bottle tops; Zehra smiles, Defne talks to Arda.", bubbles: [{ who: "kerem", text: "It's a big job. Can you give me a hand?" }, { who: "zehra", text: "Sure!" }, { who: "defne", text: "Let's make a robot team. Do you want to join us, Arda?" }, { who: "arda", text: "I'd love to!" }] },
  { scene: "Lunch break in the classroom: the friends build the robot from boxes with glue, scissors and a ruler; Defne paints it.", bubbles: [{ who: "zehra", text: "There are two boxes and four bottle tops. We need one more box." }, { who: "defne", text: "Pass me the glue, please." }] },
  { scene: "Arda sits down, holding his head; Ms Aksoy gives him a glass of water.", bubbles: [{ who: "arda", text: "I don't feel all right. My head hurts." }, { who: "aksoy", text: "Drink some water, Arda, and go and see the school nurse." }] },
  { scene: "The classroom clock shows five to one; Defne points at the half-painted robot, Zehra shakes her head.", bubbles: [{ who: "defne", text: "It's five to one and the robot isn't ready! Let's work in the Music lesson, too." }, { who: "zehra", text: "No! Please don't skip the lesson, Defne. We can finish after school." }] },
  { scene: "Friday, the Science Fair in the school hall: the robot picks up paper; the friends and Ms Aksoy smile for a photo.", bubbles: [{ who: "aksoy", text: "Well done, team! Your robot makes the grade. Smile for the photo!" }, { who: "kerem", text: "Thank you, friends! We did it together." }, { who: "arda", text: "And my head is fine now, Ms Aksoy!" }] },
];
export const EX33 = { q: "Look at the pictures quickly. What is Kerem's project?", a: "A robot for the Science Fair." };
export const EX35 = {
  example: { q: "What does the robot do?", a: "It picks up rubbish." },
  items: [
    { q: "Which lesson starts at one o'clock on Tuesdays?", a: "Music." },
    { q: "Who says \"I'd love to!\"?", a: "Arda." },
    { q: "Why does Arda go to the school nurse?", a: "Because his head hurts." },
    { q: "When is the Science Fair?", a: "On Friday at quarter to four." },
    { q: "Where are the friends in picture 3?", a: "In the classroom." },
  ],
};

// --- SB p. 18: project: a class guide for a new student ---------------------------------------------
export const PROJECT_STEPS = [
  "Write three class rules.",
  "Draw a map of your classroom. Write five words on it.",
  "Write the class helpers and their jobs.",
  "Write your timetable for one day.",
  "Show your guide to the class and talk about it.",
];
export const PROJECT_FRAME = ["Welcome to our classroom!", "There is a ... / There are ...", "We have ... on ... at ...", "Please ... / Don't ..."];
export const PROJECT_EXAMPLE_DAY: Day5 = "Thursday";
export const PROJECT_SCALE = ["The guide has rules, a map, helpers and a timetable.", "The words and times are correct.", "The guide is tidy and easy to read.", "I speak clearly when I show it."];

// --- SB p. 19: check yourself -----------------------------------------------------------------------
export const CHECK = {
  times: ["09:45", "12:20", "15:35", "10:55"],
  circle: [
    { parts: ["There ", ["is", "are"], " a ruler on my desk."] as const, a: 0 },
    { parts: ["There ", ["isn't", "aren't"], " any computers."] as const, a: 1 },
    { parts: ["This is Arda. Do you know ", ["he", "him"], "?"] as const, a: 1 },
    { parts: ["Can you help ", ["us", "we"], ", please?"] as const, a: 0 },
  ],
  subjects: ["Science", "Music", "P.E.", "Maths"] as const,
  timetableQs: [
    { q: "Is there an English lesson on Thursdays?", a: "No, there isn't." },
    { q: "When does P.E. start on Thursdays?", a: "At one o'clock." },
    { q: "Does Defne have Art on Tuesdays?", a: "Yes, she does." },
    { q: "When is the Art lesson?", a: "On Tuesdays (at five to two)." },
  ],
  numbers: [65, 76, 81, 100],
};
export const CAN_DO = [
  "I can name ten school subjects.",
  "I can tell the time.",
  "I can ask: What time does the Maths lesson start?",
  "I can say: There is ... / There are ...",
  "I can talk about routines: Kerem has Science ...",
  "I can use me, you, him, her, us and them.",
  "I can count from 50 to 100.",
  "I can write about my day.",
];
export const REFLECT = ["What did I like most in this unit?", "What was difficult for me?"];

// --- SB p. 20: word list ------------------------------------------------------------------------
export const WORDS: { topic: string; words: [string, string, number][] }[] = [
  { topic: "School subjects", words: [["Art", "Görsel sanatlar", 8], ["English", "İngilizce", 8], ["Foreign Language", "Yabancı dil", 8], ["Guidance", "Rehberlik", 7], ["IT", "Bilişim teknolojileri", 8], ["Maths", "Matematik", 8], ["Music", "Müzik", 8], ["P.E.", "Beden eğitimi", 8], ["Religion and Morals", "Din kültürü ve ahlak b.", 8], ["Science", "Fen bilimleri", 8], ["Social Studies", "Sosyal bilgiler", 8], ["Turkish", "Türkçe", 8], ["elective lesson", "seçmeli ders", 7]] },
  { topic: "Timetable", words: [["timetable", "ders programı", 7], ["lesson", "ders", 7], ["double lesson", "iki saatlik ders", 5], ["break", "teneffüs", 7], ["lunch break", "öğle arası", 7], ["minute", "dakika", 7], ["noon", "öğle (12:00)", 6], ["start", "başlamak", 12], ["finish", "bitmek", 14], ["weekday", "hafta içi günü", 9], ["weekend", "hafta sonu", 9]] },
  { topic: "Days of the week", words: [["Monday", "Pazartesi", 9], ["Tuesday", "Salı", 9], ["Wednesday", "Çarşamba", 9], ["Thursday", "Perşembe", 9], ["Friday", "Cuma", 9], ["Saturday", "Cumartesi", 9], ["Sunday", "Pazar", 9]] },
  { topic: "Time", words: [["o'clock", "saat tam", 6], ["five / ten past", "beş / on geçiyor", 6], ["quarter past", "çeyrek geçiyor", 6], ["twenty(-five) past", "yirmi (beş) geçiyor", 6], ["half past", "buçuk", 6], ["twenty(-five) to", "yirmi (beş) var", 6], ["quarter to", "çeyrek var", 6], ["five / ten to", "beş / on var", 6], ["in the morning", "sabah", 6], ["in the afternoon", "öğleden sonra", 6]] },
  { topic: "Numbers 50-100", words: [["fifty", "elli", 9], ["sixty", "altmış", 9], ["seventy", "yetmiş", 9], ["eighty", "seksen", 9], ["ninety", "doksan", 9], ["a hundred", "yüz", 9]] },
  { topic: "Classroom objects", words: [["bookcase", "kitaplık", 11], ["bookshelf", "kitap rafı", 10], ["calculator", "hesap makinesi", 10], ["chair / seat", "sandalye / oturacak yer", 11], ["clock", "saat", 10], ["coat hook", "askı", 10], ["crayons", "pastel boya", 10], ["desk", "sıra", 11], ["dictionary", "sözlük", 14], ["flag", "bayrak", 10], ["glue", "yapıştırıcı", 10], ["notebook", "defter", 10], ["notice board", "duyuru panosu", 10], ["pencil case", "kalem kutusu", 10], ["poster", "afiş", 11], ["ruler", "cetvel", 10], ["school bag", "okul çantası", 10], ["school material", "okul malzemesi", 10], ["scissors", "makas", 10], ["smart board", "akıllı tahta", 10]] },
  { topic: "Classroom life", words: [["bring", "getirmek", 14], ["careful", "dikkatli", 10], ["hang (a coat)", "asmak", 5], ["Hold on a minute.", "Bir dakika.", 5], ["helper", "görevli", 14], ["leave", "ayrılmak, bırakmak", 15], ["quietly / loudly", "sessizce / yüksek sesle", 14], ["raise your hand", "parmak kaldır", 14], ["shout", "bağırmak", 4], ["slowly", "yavaşça", 14], ["smile", "gülümsemek", 14], ["tidy / tidy up", "düzenli / toplamak", 14], ["plant", "bitki", 14], ["team", "takım", 17], ["popular", "sevilen", 16], ["Knowledge Day", "Bilgi Günü", 16], ["Science Fair", "bilim şenliği", 17], ["robot", "robot", 17], ["school nurse", "okul hemşiresi", 17]] },
  { topic: "Useful expressions", words: [["make the grade", "beklentiyi karşılamak", 17], ["give someone a hand", "birine yardım etmek", 17], ["skip a lesson", "dersi asmak", 17], ["I'd love to!", "Çok isterim!", 17], ["not feel all right", "kendini iyi hissetmemek", 17]] },
];

// --- Workbook ---------------------------------------------------------------------------------
export const WB_DRAW = { example: "08:30", items: ["09:15", "11:50", "15:20"] };
export const WB_READ_CLOCKS = { example: "07:00", items: ["10:30", "13:15", "16:40"] };
export const WB_WORDS = { example: "13:00", items: ["08:10", "12:45", "14:20", "09:55"] };
export const WB_TT_SENTENCES: { s: [string, string]; subject?: string; day?: Day5; end?: boolean }[] = [
  { s: ["On Mondays, the Science lesson starts at ", "."], subject: "Science", day: "Monday" },
  { s: ["On Thursdays, the P.E. lesson starts at ", "."], subject: "P.E.", day: "Thursday" },
  { s: ["On Thursdays, the IT lesson starts at ", "."], subject: "IT", day: "Thursday" },
  { s: ["School finishes at ", "."], end: true },
];
/** The subjects crossword: [word, row, col, down]. */
export const CROSS: { word: string; r: number; c: number; down: boolean }[] = [
  { word: "MATHS", r: 0, c: 0, down: false },
  { word: "MUSIC", r: 0, c: 0, down: true },
  { word: "SCIENCE", r: 2, c: 0, down: false },
  { word: "ENGLISH", r: 2, c: 6, down: true },
  { word: "ART", r: 4, c: 2, down: true },
  { word: "TURKISH", r: 6, c: 2, down: false },
];
export const WB_DAYS_GAPS = ["T_esd_y", "W_dn_sd_y", "Th_rsd_y", "Fr_d_y", "S_t_rd_y", "S_nd_y"];
export const WB_DAY_RIDDLES = [
  { q: "It's after Tuesday and before Thursday.", a: "Wednesday" },
  { q: "It's the first day of the weekend.", a: "Saturday" },
  { q: "It's the day after Thursday.", a: "Friday" },
];
export const WB_NUMBERS = { example: 57, items: [68, 79, 83, 94, 100] };
export const WB_PATTERNS: { seq: (number | null)[]; a: number[] }[] = [
  { seq: [50, 55, 60, null, null, 75], a: [65, 70] },
  { seq: [100, 90, 80, null, null, 50], a: [70, 60] },
  { seq: [51, 61, 71, null, null], a: [81, 91] },
];
export const WB_SUMS = [
  { s: "fifty + twenty", a: 70, x: [50, 20] },
  { s: "sixty + thirty", a: 90, x: [60, 30] },
  { s: "forty + forty", a: 80, x: [40, 40] },
  { s: "fifty-five + five", a: 60, x: [55, 5] },
  { s: "seventy + thirty", a: 100, x: [70, 30] },
  { s: "eighty + twelve", a: 92, x: [80, 12] },
];
export const WB_SEARCH_WORDS = ["CLOCK", "RULER", "GLUE", "DESK", "POSTER", "CRAYON", "SCISSORS", "CHAIR"];
export const WB_RIDDLES = [
  { q: "I'm on the wall. I've got two hands, but I can't clap!", a: "a clock" },
  { q: "Put your books on me and sit at me. I've got four legs.", a: "a desk" },
  { q: "Your teacher shows videos on me.", a: "a smart board" },
  { q: "You hang your coat on me.", a: "a coat hook" },
  { q: "I'm red and white. I'm in every classroom in Türkiye.", a: "a flag" },
];
export const WB_DIALOGUE = {
  box: ["borrow", "Here you are", "Thank you", "please", "lend"],
  lines: [
    { who: "Can", parts: ["Kerem, can I ", 0, " your ruler, ", 3, "?"] },
    { who: "Kerem", parts: ["Yes, of course. ", 1, "."] },
    { who: "Can", parts: [2, "! Can you ", 4, " me a pencil, too?"] },
    { who: "Kerem", parts: ["Sorry, I've only got one. Ask Zehra!"] },
  ] as { who: string; parts: (string | number)[] }[],
};
/** The Art cupboard (drawn by artCupboard in handcraft-meb5-art.ts): exactly these things. */
export const CUPBOARD = { aprons: 1, brushes: 5, paintPots: 3, glueSticks: 2, computers: 0, balls: 0 };
export const WB_CUP_CIRCLE = [
  { parts: ["There ", ["is", "are"], " an apron in the cupboard."] as const, a: 0 },
  { parts: ["There ", ["is", "are"], " five brushes."] as const, a: 1 },
  { parts: ["There ", ["is", "are"], " three paint pots."] as const, a: 1 },
  { parts: ["There ", ["isn't", "aren't"], " a computer."] as const, a: 0 },
  { parts: ["There ", ["isn't", "aren't"], " any balls."] as const, a: 1 },
];
export const WB_CUP_COUNT = [
  { q: "How many brushes are there?", a: "There are five brushes." },
  { q: "How many paint pots are there?", a: "There are three paint pots." },
  { q: "How many glue sticks are there?", a: "There are two glue sticks." },
];
export const WB_PRON = {
  example: { s: ["Zehra helps ", "Kerem", "."], a: "him" },
  items: [
    { s: ["Arda likes ", "Ms Aksoy", "."], a: "her" },
    { s: ["Can you help ", "Defne and me", "?"], a: "us" },
    { s: ["I use ", "the glue sticks", " in Art."], a: "them" },
    { s: ["We clean ", "the board", " every day."], a: "it" },
  ],
};
export const CLUBS: [string, string, string][] = [
  ["Chess Club", "Monday", "15:45"],
  ["Drama Club", "Tuesday", "16:00"],
  ["Football Club", "Wednesday", "15:45"],
  ["Art Club", "Thursday", "16:15"],
  ["Science Club", "Friday", "16:00"],
];
export const WB_CLUB_3RD = {
  example: { s: "Arda / go / Football Club / Wednesday", a: "Arda goes to Football Club on Wednesdays." },
  items: [
    { s: "Defne / go / Art Club / Thursday", a: "Defne goes to Art Club on Thursdays." },
    { s: "Kerem / go / Science Club / Friday", a: "Kerem goes to Science Club on Fridays." },
  ],
};
export const WB_CLUB_DOES = [
  { q: "Does Arda go to Football Club on Wednesdays?", a: "Yes, he does." },
  { q: "Does Defne go to Art Club on Mondays?", a: "No, she doesn't." },
  { q: "Does Kerem go to Science Club on Fridays?", a: "Yes, he does." },
];
export const WB_CLUB_MATCH = {
  qs: ["What time does Drama Club start?", "When is Science Club?", "What time does Art Club start?", "Is there a Chess Club on Mondays?"],
  as: ["It's on Fridays.", "Yes, there is.", "It starts at four o'clock.", "It starts at quarter past four."],
  key: [2, 0, 3, 1],
};
export const DEFNE_EMAIL = [
  "Hi Selin,",
  "How are you? I'm in class 5/C at Yeşiltepe Lower Secondary School. There are twenty-four students in my class. Our class teacher is Ms Aksoy. She is very kind.",
  "There are seven lessons every day. School starts at twenty to nine, and we leave at half past three. My favourite day is Tuesday because we have Art. I'm the tidy-up helper in our class!",
  "What about you? What is your favourite day?",
  "Love,\nDefne",
];
export const WB_EMAIL_TF = [
  { s: "Defne is in class 5/C.", a: true },
  { s: "There are forty-two students in her class.", a: false },
  { s: "School starts at twenty to nine.", a: true },
  { s: "Defne's favourite day is Monday.", a: false },
  { s: "Defne is the tidy-up helper.", a: true },
];
export const WB_EMAIL_QS = [
  { q: "Who is Defne's class teacher?", a: "Ms Aksoy." },
  { q: "How many lessons are there every day?", a: "Seven." },
  { q: "What time do they leave school?", a: "At half past three." },
];
/** Rules match (from the class rules on SB p. 14). */
export const WB_RULES_MATCH = {
  example: { s: "Arda wants to say something.", a: 1 },
  items: [
    { s: "Kerem's friends are very noisy.", a: 3 },
    { s: "Defne is late. She runs in the school.", a: 2 },
    { s: "There are papers all over Zehra's desk.", a: 4 },
    { s: "Can asks for Kerem's ruler. What does he say?", a: 5 },
  ],
};
export const WB_CLIL = [
  { s: "the school year starts in March.", a: "South Korea" },
  { s: "some children have lessons on a computer at home.", a: "Australia" },
  { s: "the first school day is Knowledge Day.", a: "Kazakhstan" },
];
export const WB_WHO = [
  { s: "This is my robot for the Science Fair.", a: "Kerem" },
  { s: "I'd love to!", a: "Arda" },
  { s: "Drink some water, Arda.", a: "Ms Aksoy" },
  { s: "Let's work in the Music lesson, too.", a: "Defne" },
];
export const WB_EXPRESSIONS = {
  left: ["Oh, I don't feel all right.", "Can you give me a hand, please?", "Do you want to join our team?", "Please don't skip the Music lesson!"],
  right: ["I'd love to!", "OK, I'm coming to class.", "Oh no! Go and see the school nurse.", "Sure! I can help you."],
  key: [2, 3, 0, 1],
};
export const WB_REVIEW = {
  times: ["06:30", "11:45", "14:10"],
  subjects: [
    { clue: "We sing songs in this lesson.", a: "Music" },
    { clue: "We use computers in this lesson.", a: "IT" },
    { clue: "We play football and run in this lesson.", a: "P.E." },
  ],
  circle: [
    { parts: ["There ", ["is", "are"], " two clocks in the hall."] as const, a: 1 },
    { parts: ["Our teacher is kind. We like ", ["her", "she"], "."] as const, a: 0 },
    { parts: ["Zehra ", ["have", "has"], " Maths on Fridays."] as const, a: 1 },
  ],
  numbers: [{ w: "seventy-two", a: 72 }, { w: "ninety-eight", a: 98 }, { w: "sixty-one", a: 61 }],
  write: "Write three sentences about your school day.",
};

// --- checks: every derivable answer recomputed from the facts --------------------------------------
export function crossGrid() {
  const cells = new Map<string, string>();
  let rows = 0;
  let cols = 0;
  for (const w of CROSS) {
    [...w.word].forEach((ch, i) => {
      const r = w.r + (w.down ? i : 0);
      const c = w.c + (w.down ? 0 : i);
      const k = `${r},${c}`;
      const was = cells.get(k);
      if (was && was !== ch) throw new Error(`crossword clash at ${k}: ${was} vs ${ch} (${w.word})`);
      cells.set(k, ch);
      rows = Math.max(rows, r + 1);
      cols = Math.max(cols, c + 1);
    });
  }
  return { cells, rows, cols };
}

/** A deterministic word search: words across or down, filler from a seeded generator. */
export function wordSearch(size = 10) {
  const grid: (string | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));
  const placed: { word: string; r: number; c: number; down: boolean }[] = [];
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (const word of WB_SEARCH_WORDS) {
    let ok = false;
    for (let tries = 0; tries < 400 && !ok; tries++) {
      const down = WB_SEARCH_WORDS.indexOf(word) % 2 === 1;
      const r = Math.floor(rnd() * (down ? size - word.length + 1 : size));
      const c = Math.floor(rnd() * (down ? size : size - word.length + 1));
      if (
        [...word].every((ch, i) => {
          const g = grid[r + (down ? i : 0)][c + (down ? 0 : i)];
          return g === null || g === ch;
        })
      ) {
        [...word].forEach((ch, i) => (grid[r + (down ? i : 0)][c + (down ? 0 : i)] = ch));
        placed.push({ word, r, c, down });
        ok = true;
      }
    }
    if (!ok) throw new Error(`word search: no room for ${word}`);
  }
  const A = "ABDEFGHIKMNOPTUVWY";
  const letters = grid.map((row) => row.map((ch) => ch ?? A[Math.floor(rnd() * A.length)]));
  // each word must occur exactly once (across or down) so the key is unique
  const lines = [...letters.map((r) => r.join("")), ...letters[0].map((_, c) => letters.map((r) => r[c]).join(""))];
  for (const w of WB_SEARCH_WORDS) {
    const n = lines.reduce((s, l) => s + (l.split(w).length - 1), 0);
    if (n !== 1) throw new Error(`word search: ${w} occurs ${n} times`);
  }
  return { letters, placed };
}

export const has = (subject: string, day: string) => (TIMETABLE[day as Day5] ?? []).includes(subject);
export const startOf = (subject: string, day: string) => PERIODS[TIMETABLE[day as Day5].indexOf(subject)];
export const wbTtAnswer = (it: (typeof WB_TT_SENTENCES)[number]) => (it.end ? timeWords(SCHOOL_END) : timeWords(startOf(it.subject!, it.day!)));
export const clubHave = (club: string, day: string) => CLUBS.some(([c, d]) => c === club && d === day);
/** Times used on analogue clocks: 24-hour, any time of day. */
const isTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

export function checkContent() {
  const errs: string[] = [];
  // the school day (single shift: breaks >= 15 min, one >= 20, lunch 30-90)
  for (let i = 0; i < PERIODS.length - 1; i++) if (addMin(addMin(PERIODS[i], LESSON_MIN), BREAKS[i]) !== PERIODS[i + 1]) errs.push(`period ${i + 2} does not follow`);
  if (addMin(PERIODS[6], LESSON_MIN) !== SCHOOL_END) errs.push("school end");
  const shortBreaks = BREAKS.filter((_, i) => i !== 3);
  if (shortBreaks.some((b) => b < 15) || !shortBreaks.some((b) => b >= 20) || BREAKS[3] < 30 || BREAKS[3] > 90) errs.push("break lengths");
  // weekly counts: the 2026-27 Year 5 chart (35 lessons)
  const all = Object.values(TIMETABLE).flat();
  if (all.length !== 35) errs.push(`timetable has ${all.length} lessons`);
  const count = (s: string) => all.filter((x) => x === s).length;
  const want: Record<string, number> = { Turkish: 6, Maths: 5, Science: 4, "Social Studies": 3, English: 3, "Religion and Morals": 2, IT: 2, "P.E.": 2, Art: 1, Music: 1, Guidance: 1, Elective: 5 };
  for (const [s, n] of Object.entries(want)) if (count(s) !== n) errs.push(`${s}: ${count(s)} lessons, want ${n}`);
  // the scene (Monday, 08:30)
  if (TIMETABLE.Monday[0] !== "Turkish" || timeWords(PERIODS[0]) !== "twenty to nine" || SCENE_TIME >= PERIODS[0]) errs.push("first lesson bubble");
  if (TIMETABLE.Thursday.filter((x) => x === "P.E.").length !== 2 || DAYS5.filter((d) => has("P.E.", d)).join() !== "Thursday") errs.push("P.E. bubble");
  // Ex 4 / 5: every time has a clock; times well-formed
  EX4_TIMES.forEach((t) => {
    if (!EX4_CLOCKS.includes(t)) errs.push(`Ex4 ${t} has no clock`);
  });
  for (const t of [...EX4_TIMES, EX5.example, ...EX5.items, ...CHECK.times, WB_DRAW.example, ...WB_DRAW.items, WB_READ_CLOCKS.example, ...WB_READ_CLOCKS.items, ...WB_REVIEW.times, ...SURVEY_DEFNE, ...SURVEY_BOX]) if (!isTime(t)) errs.push(`bad time ${t}`);
  // Ex 6 script names every gap; gaps are short subjects
  for (const [d, p] of TT_GAPS) {
    const s = TIMETABLE[d][p];
    if (!EX6_SCRIPT.includes(`${d}s`) || !EX6_SCRIPT.includes(s) || !EX6_SCRIPT.includes(timeWords(PERIODS[p]))) errs.push(`Ex6 script misses ${d} ${s} ${PERIODS[p]}`);
    if (s.length > 9) errs.push(`Ex6 gap ${s} too long to handwrite`);
  }
  if (TIMETABLE.Thursday[2] !== TIMETABLE.Thursday[3]) errs.push("Ex6 double lesson");
  // Ex 7 model
  if (startOf("Art", "Tuesday") !== "13:55" || has("English", "Thursday")) errs.push("Ex7 model");
  // grammar items against the timetable
  if (has("Maths", "Wednesday")) errs.push("Ex19 example");
  if (!has("English", "Friday") || has("P.E.", "Monday") || !has("IT", "Thursday") || has("Music", "Friday")) errs.push("Ex19 items");
  if (!has("Music", "Tuesday") || has("English", "Thursday") || !has("Maths", "Friday") || has("P.E.", "Monday") || !has("IT", "Thursday")) errs.push("does-questions");
  for (const it of [EX20.example, ...EX20.items]) if (!has(it.subject, it.day)) errs.push(`Ex20 ${it.subject} ${it.day}`);
  // Can's blog
  if (timeWords(PERIODS[0]) !== "twenty to nine" || LESSON_MIN !== 40 || PERIODS.length !== 7 || !has("IT", "Thursday") || TIMETABLE.Thursday.filter((x) => x === "P.E.").length !== 2) errs.push("Can's blog");
  // the routine text and survey
  if (timeWords(PERIODS[3] === "11:30" ? addMin(PERIODS[3], LESSON_MIN) : "") !== "ten past twelve") errs.push("lunch time in the routine text");
  // story: Tuesday lunch ends, Music at one; fair after school
  if (startOf("Music", "Tuesday") !== "13:00" || FAIR_TIME <= SCHOOL_END || timeWords(FAIR_TIME) !== "quarter to four") errs.push("story timing");
  // check page
  if (has("English", "Thursday") || startOf("P.E.", "Thursday") !== "13:00" || DAYS5.filter((d) => has("Art", d)).join() !== "Tuesday") errs.push("check page timetable questions");
  // the e-mail
  if (timeWords(SCHOOL_END) !== "half past three" || !has("Art", "Tuesday")) errs.push("e-mail facts");
  // project example: Zehra's Thursday
  if (TIMETABLE.Thursday.slice(0, 5).join() !== "Turkish,Maths,IT,IT,P.E.") errs.push("project example day");
  // numbers (none from the source unit except 100)
  const SOURCE_NUMBERS = [54, 58, 63, 78, 82, 91, 97];
  for (const n of [...EX13.numbers, ...EX14.items.flatMap((i) => i.pair), ...EX14.example.pair, ...CHECK.numbers, WB_NUMBERS.example, ...WB_NUMBERS.items]) if (SOURCE_NUMBERS.includes(n)) errs.push(`number ${n} is the source's`);
  for (const q of WB_SUMS) {
    if (q.x[0] + q.x[1] !== q.a || q.s !== `${numberWords(q.x[0]).replace("forty", "forty")} + ${q.x[1] < 13 ? ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"][q.x[1]] : numberWords(q.x[1])}`) errs.push(`WB sum ${q.s}`);
    if (SOURCE_NUMBERS.includes(q.a)) errs.push(`WB sum ${q.a} is the source's`);
  }
  EX13.numbers.forEach((n) => {
    if (!EX13.words.includes(n)) errs.push(`Ex13 ${n}`);
  });
  const script14 = EX14.script.toLowerCase();
  for (const it of [EX14.example, ...EX14.items]) if (!script14.includes(numberWords(it.a))) errs.push(`Ex14 ${it.a} not in script`);
  for (const it of [EX14.example, ...EX14.items]) {
    const other = it.pair.find((x) => x !== it.a)!;
    if (script14.includes(numberWords(other))) errs.push(`Ex14 distractor ${other} is in the script`);
  }
  // Ex 16: every card has exactly one riddle; no card from the source's memory game
  const SOURCE_CARDS = ["dictionary", "rubbish bin", "seat", "rubber", "bookshelf", "pencil", "sheet", "board marker"];
  for (const c of EX16.cards) {
    if (EX16.defs.filter((d) => d[2] === c).length !== 1) errs.push(`Ex16 ${c}`);
    if (SOURCE_CARDS.includes(c)) errs.push(`Ex16 card ${c} is the source's`);
  }
  // Ex 18 against the drawn corner
  const corner = [CORNER.clocks === 1, CORNER.posters === 3, CORNER.bookcases === 1, CORNER.windows === 2, CORNER.computers === 0, CORNER.plants === 0];
  if (corner.some((x) => !x)) errs.push("Ex18 corner");
  // Ex 31 against the texts
  const kw: Record<string, string> = { "three languages": "C", "on a computer": "D", March: "A", afternoon: "B", "special name": "C", "isn't a school": "D" };
  for (const [k, v] of Object.entries(kw)) {
    const t = CLIL.find((x) => x.text.includes(k));
    if (t?.k !== v) errs.push(`CLIL keyword ${k}`);
  }
  // Workbook
  if (CUPBOARD.aprons !== 1 || CUPBOARD.brushes !== 5 || CUPBOARD.paintPots !== 3 || CUPBOARD.glueSticks !== 2 || CUPBOARD.computers || CUPBOARD.balls) errs.push("cupboard");
  const clubAt = (c: string) => CLUBS.find((x) => x[0] === c)!;
  if (timeWords(clubAt("Drama Club")[2]) !== "four o'clock" || clubAt("Science Club")[1] !== "Friday" || timeWords(clubAt("Art Club")[2]) !== "quarter past four" || clubAt("Chess Club")[1] !== "Monday") errs.push("club answers");
  if (CLUBS.some(([, , t]) => t <= SCHOOL_END)) errs.push("clubs must be after school");
  if (!clubHave("Football Club", "Wednesday") || clubHave("Art Club", "Monday") || !clubHave("Science Club", "Friday")) errs.push("club does-questions");
  if (wbTtAnswer(WB_TT_SENTENCES[0]) !== "one o'clock") errs.push("WB timetable example");
  crossGrid();
  wordSearch();
  if (errs.length) throw new Error(`content check failed:\n - ${errs.join("\n - ")}`);
}
export const FAIR_TIME = "15:45";
