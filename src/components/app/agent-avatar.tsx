import type { ComponentType, SVGProps } from "react";
import {
  BellRingIcon,
  BriefcaseIcon,
  CheckIcon,
  ClipboardCheckIcon,
  FileSearchIcon,
  GaugeIcon,
  PaintbrushIcon,
  PaletteIcon,
  PenLineIcon,
  PrinterIcon,
  ScaleIcon,
  ShieldCheckIcon,
  SpellCheckIcon,
  UserRoundIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AGENT_COLORS, type OfficeAgentState } from "@/lib/agent-office";
import type { LogActor } from "@/lib/process-log";

// Illustrated avatar for a pipeline agent: a softly lit "3D" ball in the
// agent's colour with a face whose expression follows its state, a role
// badge, and a live ring (spinning while working, pulsing while waiting
// for you). Pure SVG + CSS - no WebGL, so it's free to render dozens.

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

const ROLE_ICON: Record<LogActor, Icon> = {
  kaynak_analisti: FileSearchIcon,
  yayin_muduru: BriefcaseIcon,
  sanat_yonetmeni: PaletteIcon,
  icerik_uretici: PenLineIcon,
  dil_denetcisi: SpellCheckIcon,
  seviye_uzmani: GaugeIcon,
  icerik_guvenligi: ShieldCheckIcon,
  beceri_dengesi_uzmani: ScaleIcon,
  gorsel_tasarimci: PaintbrushIcon,
  bas_editor: ClipboardCheckIcon,
  produksiyon: PrinterIcon,
  sen: UserRoundIcon,
};

export function actorColor(actor: LogActor): string {
  return actor === "sen" ? "#475569" : (AGENT_COLORS[actor] ?? "#64748b");
}

// Readable on every agent colour: eyes are white with dark pupils; the
// mouth and brows switch between dark and light ink by the colour's
// brightness.
function inkFor(hex: string): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#1c1917" : "#ffffff";
}

function Eye({ cx, cy, look = 0 }: { cx: number; cy: number; look?: number }) {
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={3.6} ry={4.1} fill="#ffffff" />
      <circle cx={cx} cy={cy + 0.6 + look} r={2.1} fill="#1c1917" />
      <circle cx={cx + 0.8} cy={cy - 0.4 + look} r={0.7} fill="#ffffff" />
    </g>
  );
}

function Face({ state, color }: { state: OfficeAgentState | "neutral"; color: string }) {
  const ink = inkFor(color);
  if (state === "done") {
    // content, eyes closed in a smile
    return (
      <g fill="none" stroke={ink} strokeWidth={2.4} strokeLinecap="round">
        <path d="M16.5 26 q3.5 -3.5 7 0" />
        <path d="M26.5 26 q3.5 -3.5 7 0" />
        <path d="M19 33 q6 5.5 12 0" />
      </g>
    );
  }
  if (state === "waiting_human") {
    // raised brows, small open mouth - "a question for you"
    return (
      <g>
        <g fill="none" stroke={ink} strokeWidth={1.8} strokeLinecap="round">
          <path d="M16 18.5 q4 -3 7 -1" />
          <path d="M27 17.5 q3 -2 7 1" />
        </g>
        <Eye cx={20} cy={25} look={-0.6} />
        <Eye cx={30} cy={25} look={-0.6} />
        <ellipse cx="25" cy="34" rx="2.4" ry="2.1" fill={ink} />
      </g>
    );
  }
  if (state === "working") {
    // focused: looking down at the work
    return (
      <g>
        <Eye cx={20} cy={25.5} look={1} />
        <Eye cx={30} cy={25.5} look={1} />
        <path d="M21.5 34 h7" stroke={ink} strokeWidth={2.2} strokeLinecap="round" />
      </g>
    );
  }
  return (
    <g>
      <Eye cx={20} cy={25} />
      <Eye cx={30} cy={25} />
      <path d="M21 32.5 q4 2.5 8 0" fill="none" stroke={ink} strokeWidth={2} strokeLinecap="round" />
    </g>
  );
}

export function AgentAvatar({
  actor,
  state = "neutral",
  size = 44,
  className,
}: {
  actor: LogActor;
  state?: OfficeAgentState | "neutral";
  size?: number;
  className?: string;
}) {
  const color = actorColor(actor);
  const Role = ROLE_ICON[actor] ?? UserRoundIcon;
  const id = `av-${actor}`;
  const badge = Math.max(14, Math.round(size * 0.38));
  const dim = state === "idle";

  return (
    <span className={cn("relative inline-flex shrink-0", className)} style={{ width: size, height: size }}>
      {state === "working" && (
        <span
          aria-hidden
          className="absolute -inset-1 animate-spin rounded-full [animation-duration:2.4s]"
          style={{ background: `conic-gradient(from 0deg, ${color}, transparent 65%, ${color})` }}
        />
      )}
      {state === "waiting_human" && (
        <span aria-hidden className="absolute -inset-1 animate-ping rounded-full bg-warning/40 [animation-duration:1.8s]" />
      )}
      <svg
        viewBox="0 0 50 50"
        width={size}
        height={size}
        className={cn("relative rounded-full drop-shadow-sm transition-[filter]", dim && "grayscale-[0.55] opacity-80")}
        aria-hidden
      >
        <defs>
          {/* key light top-left, falloff bottom-right: reads as a sphere */}
          <radialGradient id={`${id}-g`} cx="30%" cy="22%" r="80%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.7} />
            <stop offset="14%" stopColor={color} stopOpacity={0.7} />
            <stop offset="60%" stopColor={color} />
            <stop offset="100%" stopColor={color} stopOpacity={0.75} />
          </radialGradient>
          <radialGradient id={`${id}-s`} cx="50%" cy="100%" r="60%">
            <stop offset="0%" stopColor="#000000" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#000000" stopOpacity={0} />
          </radialGradient>
        </defs>
        <circle cx="25" cy="25" r="24" fill={`url(#${id}-g)`} />
        <circle cx="25" cy="25" r="24" fill={`url(#${id}-s)`} />
        <circle cx="25" cy="25" r="23.25" fill="none" stroke="#ffffff" strokeOpacity={0.5} strokeWidth={1.5} />
        {/* cheeks */}
        <circle cx="15" cy="31" r="3" fill="#ffffff" opacity={0.18} />
        <circle cx="35" cy="31" r="3" fill="#ffffff" opacity={0.18} />
        <Face state={state} color={color} />
      </svg>
      <span
        className="absolute -right-1 -bottom-1 flex items-center justify-center rounded-full bg-card shadow-md ring-1 ring-border"
        style={{ width: badge, height: badge }}
      >
        {state === "done" ? (
          <CheckIcon className="text-success" style={{ width: badge * 0.6, height: badge * 0.6 }} />
        ) : state === "waiting_human" ? (
          <BellRingIcon className="text-warning" style={{ width: badge * 0.6, height: badge * 0.6 }} />
        ) : (
          <Role style={{ width: badge * 0.6, height: badge * 0.6, color }} />
        )}
      </span>
    </span>
  );
}
