import type { ContentBlock } from "@/lib/ai/schemas";
import { itemText } from "@/lib/item-text";
import { artefactTitle, letterParts, quizParts, splitArtefact, type TextStyle } from "@/lib/text-style";

// The web reader's artefacts - a note, an email, a text message, an
// invitation, a quiz box, a poster - the simple CSS twin of
// src/lib/pdf/artefacts.tsx. The block's heading and items render around
// it as usual (a quiz's items render inside it).

type Palette = { primary: string; primaryDark: string; primaryLight: string };

function Letter({ text, signOffRight }: { text: string; signOffRight?: boolean }) {
  const { greeting, body, signOff } = letterParts(text);
  return (
    <>
      {greeting && <p className="font-bold">{greeting}</p>}
      {body.split(/\n+/).map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      {signOff && <p className={`mt-1 whitespace-pre-line ${signOffRight ? "text-right" : ""}`}>{signOff}</p>}
    </>
  );
}

export function ArtefactView({ style, block, palette }: { style: TextStyle; block: ContentBlock; palette: Palette }) {
  const { lead, text } = splitArtefact(block.body ?? "");
  return (
    <>
      {lead && <p className="mt-1 leading-relaxed">{lead}</p>}
      <div className="mt-2 mb-2">{artefact(style, text, block, palette)}</div>
    </>
  );
}

function artefact(style: TextStyle, text: string, block: ContentBlock, palette: Palette) {
  switch (style) {
    case "note":
      return (
        <div
          className="relative mx-auto w-[72%] rotate-[-1.5deg] rounded-sm border px-3 pt-4 pb-3 shadow-sm"
          style={{ background: "#FFF4B0", borderColor: "#E3C33B", fontFamily: "Andika, var(--font-reading, sans-serif)" }}
        >
          <span className="absolute -top-1.5 left-[40%] h-3 w-11 rotate-[4deg] opacity-75" style={{ background: "#d8d2bf" }} />
          <Letter text={text} signOffRight />
        </div>
      );
    case "email": {
      const { greeting, signOff } = letterParts(text);
      const to = /\b([A-Z][\p{L}-]+)\s*[,!]?$/u.exec(greeting)?.[1];
      const from = /([A-Z][\p{L}-]+(?:\s+[A-Z][\p{L}-]+)?)(?:\s*[xX]{1,3})?[.!]?\s*$/u.exec(signOff)?.[1];
      return (
        <div className="overflow-hidden rounded-md border border-slate-300 bg-white">
          <div className="flex items-center gap-1 border-b border-slate-300 px-2 py-1 text-[11px]" style={{ background: palette.primaryLight }}>
            {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
              <span key={c} className="inline-block h-2 w-2 rounded-full" style={{ background: c }} />
            ))}
            <span className="ml-2" style={{ color: palette.primary }}>
              ✉
            </span>
            {from && (
              <span className="ml-2">
                <b className="text-slate-500">From:</b> {from}
              </span>
            )}
            {to && (
              <span className="ml-3">
                <b className="text-slate-500">To:</b> {to}
              </span>
            )}
          </div>
          <div className="p-2">
            <Letter text={text} />
          </div>
        </div>
      );
    }
    case "message": {
      const from = /([A-Z][\p{L}-]+)(?:\s*[xX]{1,3})?[.!]?\s*$/u.exec(letterParts(text).signOff)?.[1];
      return (
        <div className="mx-auto w-[70%] rounded-2xl border-[3px] border-gray-700 bg-gray-100 p-2">
          <div className="mx-auto mb-1.5 h-1 w-8 rounded bg-gray-400" />
          {from && (
            <p className="text-[11px] font-bold" style={{ color: palette.primaryDark }}>
              {from}
            </p>
          )}
          <p className="rounded-xl rounded-tl-sm border border-gray-300 bg-white px-2 py-1">{text}</p>
        </div>
      );
    }
    case "invitation": {
      const { title, rest } = artefactTitle(text);
      const { greeting, body, signOff } = letterParts(rest);
      return (
        <div className="relative rounded-xl p-3 pr-9 text-white" style={{ background: palette.primaryDark }}>
          <span className="absolute top-2 right-2 text-xl" aria-hidden>
            🎈
          </span>
          {title && <p className="mb-1 text-2xl font-bold text-[#FFE14D]">{title}</p>}
          {greeting && <p className="font-bold">{greeting}</p>}
          <p className="whitespace-pre-line">{body}</p>
          {signOff && <p className="mt-1 text-right font-bold text-[#FFE14D]">{signOff}</p>}
        </div>
      );
    }
    case "quiz":
      return (
        <div className="rounded-xl p-3" style={{ background: palette.primaryLight }}>
          {text && <p className="mb-2 text-sm text-gray-600">{text}</p>}
          <ol>
            {(block.items ?? []).map((raw, k) => {
              const { question, options } = quizParts(itemText(raw));
              return (
                <li key={k} className="mb-1.5">
                  <p className="font-bold">
                    <span style={{ color: palette.primary }}>{k + 1} </span>
                    {question}
                  </p>
                  {!!options.length && (
                    <p className="ml-3 flex flex-wrap gap-x-4">
                      {options.map((o) => (
                        <span key={o.letter} className="inline-flex items-center gap-1">
                          <span
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white"
                            style={{ background: palette.primary }}
                          >
                            {o.letter}
                          </span>
                          {o.text}
                        </span>
                      ))}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      );
    case "poster": {
      const { title, rest } = artefactTitle(text);
      return (
        <div className="rounded border-4 p-1" style={{ borderColor: palette.primary }}>
          <div className="border border-dashed bg-white p-3 text-center" style={{ borderColor: palette.primary }}>
            {title && (
              <p className="mb-1 text-xl font-bold" style={{ color: palette.primaryDark }}>
                {title}
              </p>
            )}
            <p className="whitespace-pre-line">{rest}</p>
          </div>
        </div>
      );
    }
  }
}
