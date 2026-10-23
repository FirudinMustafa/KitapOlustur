import { Text, View, Svg, Path, Rect, Circle } from "@react-pdf/renderer";
import type { ContentBlock } from "@/lib/ai/schemas";
import { ARTEFACT_BOX } from "@/lib/design/layouts";
import { artefactTitle, letterParts, quizParts, splitArtefact, type TextStyle } from "@/lib/text-style";
import { itemText } from "@/lib/item-text";
import { ANDIKA, NOTO_SANS, NUNITO } from "./fonts";
import type { Look } from "./blocks";

// Short texts set as designed artefacts (src/lib/text-style.ts): a note on
// a yellow sticky paper, an email in a mail window, a text message in a
// phone, a party invitation card, a magazine quiz box, a poster. The
// block's heading (number and rubric) prints above as usual and its items
// below, still numbered - only the body (and a quiz's items) change form.
// Sizes come from ARTEFACT_BOX, which estimateBlockHeight measures with.

const INK = "#1f2937";
const NOTE_PAPER = "#FFF4B0";
const NOTE_EDGE = "#E3C33B";
const INVITE_TITLE = "#FFE14D";

/** The lead-in before the artefact (if any), then the artefact itself. */
export function ArtefactBody({ style, block, look }: { style: TextStyle; block: ContentBlock; look: Look }) {
  const { lead, text } = splitArtefact(block.body ?? "");
  return (
    <>
      {lead ? <Text style={{ marginBottom: 4 }}>{lead}</Text> : null}
      {style === "quiz" ? (
        <QuizBox intro={text} items={block.items ?? []} look={look} />
      ) : style === "note" ? (
        <NoteCard text={text} look={look} />
      ) : style === "email" ? (
        <EmailWindow text={text} look={look} />
      ) : style === "message" ? (
        <PhoneMessage text={text} look={look} />
      ) : style === "invitation" ? (
        <InvitationCard text={text} look={look} />
      ) : (
        <PosterCard text={text} look={look} />
      )}
    </>
  );
}

function Letter({ text, font, size, color = INK, signOffAlign = "left" }: { text: string; font?: string; size: number; color?: string; signOffAlign?: "left" | "right" }) {
  const { greeting, body, signOff } = letterParts(text);
  const base = { fontSize: size, color, ...(font ? { fontFamily: font } : {}) };
  return (
    <>
      {greeting ? <Text style={{ ...base, fontWeight: 700, marginBottom: 2 }}>{greeting}</Text> : null}
      {body ? <Text style={base}>{body}</Text> : null}
      {signOff ? <Text style={{ ...base, marginTop: 3, textAlign: signOffAlign }}>{signOff}</Text> : null}
    </>
  );
}

function NoteCard({ text, look }: { text: string; look: Look }) {
  const box = ARTEFACT_BOX.note;
  return (
    <View
      wrap={false}
      style={{
        width: `${box.width * 100}%`,
        alignSelf: "center",
        marginTop: box.top,
        marginBottom: 6,
        backgroundColor: NOTE_PAPER,
        borderWidth: 0.75,
        borderColor: NOTE_EDGE,
        borderRadius: 2,
        padding: box.pad,
        transform: "rotate(-1.5deg)",
      }}
    >
      {/* a strip of tape holding the note */}
      <View style={{ position: "absolute", top: -6, left: "40%", width: 44, height: 12, backgroundColor: "#d8d2bf", opacity: 0.75, transform: "rotate(4deg)" }} />
      <Letter text={text} font={ANDIKA} size={look.theme.bodySize * box.font} signOffAlign="right" />
    </View>
  );
}

function EnvelopeIcon({ color }: { color: string }) {
  return (
    <Svg width={12} height={9} viewBox="0 0 24 18">
      <Rect x={1} y={1} width={22} height={16} rx={2} fill="none" stroke={color} strokeWidth={2} />
      <Path d="M2 2 L12 10 L22 2" fill="none" stroke={color} strokeWidth={2} />
    </Svg>
  );
}

function EmailWindow({ text, look }: { text: string; look: Look }) {
  const box = ARTEFACT_BOX.email;
  const { greeting, signOff } = letterParts(text);
  const to = /\b([A-Z][\p{L}-]+)\s*[,!]?$/u.exec(greeting)?.[1];
  const from = /([A-Z][\p{L}-]+(?:\s+[A-Z][\p{L}-]+)?)(?:\s*[xX]{1,3})?[.!]?\s*$/u.exec(signOff)?.[1];
  const label = { fontFamily: NOTO_SANS, fontWeight: 700 as const, fontSize: 7.5, color: "#6b7280" };
  const value = { fontFamily: NOTO_SANS, fontSize: 8, color: INK };
  return (
    <View wrap={false} style={{ marginTop: 2, marginBottom: 6, borderWidth: 1, borderColor: "#b8c2cc", borderRadius: 6, backgroundColor: "#ffffff" }}>
      <View
        style={{
          height: box.header,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 8,
          backgroundColor: look.palette.primaryLight,
          borderBottomWidth: 0.75,
          borderBottomColor: "#b8c2cc",
          borderTopLeftRadius: 6,
          borderTopRightRadius: 6,
        }}
      >
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <Svg key={c} width={7} height={7} viewBox="0 0 10 10" style={{ marginRight: 3 }}>
            <Circle cx={5} cy={5} r={5} fill={c} />
          </Svg>
        ))}
        <View style={{ marginLeft: 6, marginRight: 8 }}>
          <EnvelopeIcon color={look.palette.primary} />
        </View>
        {from ? (
          <Text style={{ marginRight: 12 }}>
            <Text style={label}>From: </Text>
            <Text style={value}>{from}</Text>
          </Text>
        ) : null}
        {to ? (
          <Text>
            <Text style={label}>To: </Text>
            <Text style={value}>{to}</Text>
          </Text>
        ) : null}
      </View>
      <View style={{ padding: box.pad }}>
        <Letter text={text} size={look.theme.bodySize} />
      </View>
    </View>
  );
}

function PhoneMessage({ text, look }: { text: string; look: Look }) {
  const box = ARTEFACT_BOX.message;
  const { signOff } = letterParts(text);
  const from = /([A-Z][\p{L}-]+)(?:\s*[xX]{1,3})?[.!]?\s*$/u.exec(signOff)?.[1];
  return (
    <View
      wrap={false}
      style={{
        width: `${box.width * 100}%`,
        alignSelf: "center",
        marginTop: 2,
        marginBottom: 6,
        borderWidth: 2.5,
        borderColor: "#374151",
        borderRadius: 14,
        backgroundColor: "#f3f4f6",
        padding: box.pad,
      }}
    >
      <View style={{ alignSelf: "center", width: 30, height: 3, borderRadius: 2, backgroundColor: "#9ca3af", marginBottom: 5 }} />
      {from ? <Text style={{ fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 7.5, color: look.palette.primaryDark, marginBottom: 2 }}>{from}</Text> : null}
      <View style={{ backgroundColor: "#ffffff", borderRadius: 10, borderTopLeftRadius: 2, paddingVertical: 5, paddingHorizontal: 8, borderWidth: 0.75, borderColor: "#d1d5db" }}>
        <Text style={{ fontSize: look.theme.bodySize, color: INK }}>{text}</Text>
      </View>
    </View>
  );
}

function InvitationCard({ text, look }: { text: string; look: Look }) {
  const box = ARTEFACT_BOX.invitation;
  const { title, rest } = artefactTitle(text);
  const { greeting, body, signOff } = letterParts(rest);
  const size = look.theme.bodySize;
  const line = { fontSize: size * 1.05, color: "#ffffff", lineHeight: 1.35 };
  return (
    <View wrap={false} style={{ marginTop: 2, marginBottom: 6, backgroundColor: look.palette.primaryDark, borderRadius: 10, padding: box.pad, paddingRight: box.pad + 22 }}>
      {/* balloons in the corner */}
      <Svg width={26} height={40} viewBox="0 0 26 40" style={{ position: "absolute", right: 6, top: 6 }}>
        <Path d="M8 17 C 9 24, 6 30, 9 40" fill="none" stroke="#ffffff" strokeWidth={0.7} />
        <Path d="M18 21 C 17 28, 20 33, 17 40" fill="none" stroke="#ffffff" strokeWidth={0.7} />
        <Circle cx={8} cy={9} r={7} fill="#ff7eb6" />
        <Circle cx={18} cy={13} r={7} fill={INVITE_TITLE} />
      </Svg>
      {title ? (
        <Text style={{ fontFamily: NUNITO, fontWeight: 700, fontSize: size * box.title, color: INVITE_TITLE, marginBottom: 4, lineHeight: 1.2 }}>{title}</Text>
      ) : null}
      {greeting ? <Text style={{ ...line, fontWeight: 700 }}>{greeting}</Text> : null}
      <Text style={line}>{body}</Text>
      {signOff ? <Text style={{ ...line, color: INVITE_TITLE, fontWeight: 700, textAlign: "right", marginTop: 3 }}>{signOff}</Text> : null}
    </View>
  );
}

function QuizBox({ intro, items, look }: { intro: string; items: string[]; look: Look }) {
  const box = ARTEFACT_BOX.quiz;
  const size = look.theme.bodySize;
  const color = look.palette.primary;
  return (
    <View style={{ marginTop: 2, marginBottom: 6, backgroundColor: look.palette.primaryLight, borderRadius: 10, padding: box.pad }}>
      {intro ? <Text style={{ fontSize: size * 0.95, color: "#4b5563", marginBottom: 5 }}>{intro}</Text> : null}
      {items.map((raw, k) => {
        const { question, options } = quizParts(itemText(raw));
        return (
          <View key={k} wrap={false} style={{ marginBottom: box.gap }}>
            <Text style={{ fontWeight: 700, fontSize: size, color: INK }}>
              <Text style={{ color }}>{k + 1} </Text>
              {question}
            </Text>
            {options.length ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", marginLeft: 10, marginTop: 1 }}>
                {options.map((o) => (
                  <View key={o.letter} style={{ flexDirection: "row", alignItems: "center", marginRight: 14 }}>
                    <View style={{ width: size * 1.25, height: size * 1.25, borderRadius: size, backgroundColor: color, alignItems: "center", justifyContent: "center", marginRight: 3 }}>
                      <Text style={{ fontFamily: NOTO_SANS, fontWeight: 700, fontSize: size * 0.8, color: "#ffffff", lineHeight: 1 }}>{o.letter}</Text>
                    </View>
                    <Text style={{ fontSize: size }}>{o.text}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function PosterCard({ text, look }: { text: string; look: Look }) {
  const box = ARTEFACT_BOX.poster;
  const { title, rest } = artefactTitle(text);
  const size = look.theme.bodySize;
  return (
    <View wrap={false} style={{ marginTop: 2, marginBottom: 6, borderWidth: 3, borderColor: look.palette.primary, borderRadius: 4, padding: 3 }}>
      <View style={{ borderWidth: 0.75, borderColor: look.palette.primary, borderStyle: "dashed", padding: box.pad, alignItems: "center", backgroundColor: "#ffffff" }}>
        {title ? (
          <Text style={{ fontFamily: look.headingFont, fontWeight: 700, fontSize: size * box.title, color: look.palette.primaryDark, textAlign: "center", marginBottom: 3, lineHeight: 1.2 }}>{title}</Text>
        ) : null}
        <Text style={{ fontSize: size, textAlign: "center", color: INK }}>{rest}</Text>
      </View>
    </View>
  );
}
