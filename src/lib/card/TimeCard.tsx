import type { ReactNode } from "react";
import { INK, Mark, Mono, MUTED, PAPER, Perforation, RULE, SANS, SERIF, TONE } from "./Card";

export interface TimeEntry {
  platform: string;
  postId: string;
  at: number;
  bits?: string;
  timestamp?: [number, number];
}

const fmtDate = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "UTC" });

export function ago(ms: number, now = Date.now()): string {
  const s = Math.max(0, (now - ms) / 1000);
  const units: [number, string][] = [
    [365.25 * 86400, "year"],
    [30.44 * 86400, "month"],
    [86400, "day"],
    [3600, "hour"],
    [60, "minute"],
  ];
  const parts: string[] = [];
  let rest = s;
  for (const [size, name] of units) {
    const n = Math.floor(rest / size);
    if (n > 0) {
      parts.push(`${n} ${name}${n === 1 ? "" : "s"}`);
      rest -= n * size;
    }
    if (parts.length === 2) break;
  }
  return parts.length ? `${parts.join(", ")} ago` : "just now";
}

function Bits({ bits, range, width }: { bits: string; range: [number, number]; width: number }) {
  const cell = Math.floor(width / 32);
  const rows = [bits.slice(0, 32), bits.slice(32, 64)];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {rows.map((row, r) => (
        <div key={r} style={{ display: "flex", gap: 0 }}>
          {row.split("").map((b, i) => {
            const idx = r * 32 + i;
            const inTs = idx >= range[0] && idx < range[1];
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: cell - 3,
                  height: cell + 6,
                  marginRight: 3,
                  borderRadius: 3,
                  backgroundColor: inTs ? (b === "1" ? TONE.alert : "#F1C6BB") : b === "1" ? "#8D887D" : RULE,
                  color: inTs && b === "1" ? PAPER : INK,
                  fontFamily: "Geist Mono",
                  fontSize: 15,
                }}
              >
                {b}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Frame({ children, width, height, label }: { children: ReactNode; width: number; height: number; label: string }) {
  const pad = 64;
  const inner = width - pad * 2;
  return (
    <div style={{ display: "flex", width, height, backgroundColor: PAPER, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: inner, height: height - pad * 2 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: inner }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Mark size={30} />
            <div style={{ display: "flex", fontFamily: SANS, fontWeight: 600, fontSize: 29, letterSpacing: -0.5, color: INK }}>FirstFrame</div>
          </div>
          <Mono size={16}>{label}</Mono>
        </div>
        {children}
      </div>
    </div>
  );
}

function Footer({ width, host, text }: { width: number; host: string; text: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, width }}>
      <Perforation width={width} />
      <div style={{ display: "flex", justifyContent: "space-between", width }}>
        <Mono size={14}>{text}</Mono>
        <Mono size={14} color={INK} style={{ textTransform: "none", letterSpacing: 0.5 }}>{host}</Mono>
      </div>
    </div>
  );
}

/** Shareable card for the post-timestamp decoder: one post, or several ranked by age. */
export function TimeCard({ entries, host, now = Date.now() }: { entries: TimeEntry[]; host: string; now?: number }) {
  const width = 1080;
  const height = 1350;
  const inner = width - 128;
  const sorted = [...entries].sort((a, b) => a.at - b.at);

  if (sorted.length === 1) {
    const e = sorted[0]!;
    return (
      <Frame width={width} height={height} label="Post timestamp">
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Mono size={18} color={TONE.alert}>{`${e.platform} post · actually posted`}</Mono>
          <div style={{ display: "flex", fontFamily: SERIF, fontSize: 150, lineHeight: 0.92, letterSpacing: -3, color: INK }}>{fmtDate(e.at)}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
            <div style={{ display: "flex", fontFamily: SERIF, fontSize: 84, color: INK }}>{fmtTime(e.at)}</div>
            <div style={{ display: "flex", fontFamily: "Geist Mono", fontSize: 30, color: MUTED }}>UTC</div>
          </div>
          <div style={{ display: "flex", fontFamily: SANS, fontSize: 34, color: MUTED, marginTop: 8 }}>{`${ago(e.at, now)} (as of ${fmtDate(now)})`}</div>
        </div>
        {e.bits && e.timestamp ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Mono size={15}>{`Post ID ${e.postId.length > 24 ? `${e.postId.slice(0, 24)}…` : e.postId} · highlighted bits are the clock`}</Mono>
            <Bits bits={e.bits} range={e.timestamp} width={inner} />
          </div>
        ) : (
          <div style={{ display: "flex" }} />
        )}
        <Footer width={inner} host={host} text="Decoded from the post ID · no scraping, no API" />
      </Frame>
    );
  }

  const first = sorted[0]!;
  return (
    <Frame width={width} height={height} label="Which came first?">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Mono size={18} color={TONE.alert}>{`${sorted.length} posts, oldest first`}</Mono>
        <div style={{ display: "flex", fontFamily: SERIF, fontSize: 96, lineHeight: 0.95, letterSpacing: -2, color: INK }}>{`First posted ${fmtDate(first.at)}`}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", width: inner }}>
        {sorted.slice(0, 7).map((e, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `2px solid ${i === 0 ? TONE.alert : INK}`, padding: "16px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div style={{ display: "flex", fontFamily: "Geist Mono", fontSize: 22, color: i === 0 ? TONE.alert : MUTED, width: 40 }}>{String(i + 1).padStart(2, "0")}</div>
              <div style={{ display: "flex", fontFamily: SANS, fontWeight: 600, fontSize: 32, color: i === 0 ? TONE.alert : INK }}>{fmtDate(e.at)}</div>
              <div style={{ display: "flex", fontFamily: "Geist Mono", fontSize: 22, color: MUTED }}>{`${fmtTime(e.at)} UTC`}</div>
            </div>
            <div style={{ display: "flex", fontFamily: SANS, fontSize: 24, color: MUTED }}>{e.platform}</div>
          </div>
        ))}
      </div>
      <Footer width={inner} host={host} text="Decoded from post IDs · no scraping, no API" />
    </Frame>
  );
}

/** 1200×630 link previews for the site's pages. */
export function PageOg({ eyebrow, title, subtitle, visual }: { eyebrow: string; title: string; subtitle: string; visual?: ReactNode }) {
  return (
    <div style={{ display: "flex", width: 1200, height: 630, backgroundColor: "#0D0D0C", alignItems: "center", justifyContent: "center" }}>
     <div style={{ display: "flex", width: 1072, height: 502, justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: visual ? 600 : 1072, height: 502 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <svg width={30} height={30} viewBox="0 0 32 32">
            <path d="M2 10V2h8M22 2h8v8M30 22v8h-8M10 30H2v-8" stroke="#ECE9E1" strokeWidth="3" fill="none" />
            <circle cx="10" cy="10" r="3.5" fill="#FF5B3D" />
          </svg>
          <div style={{ display: "flex", fontFamily: SANS, fontWeight: 600, fontSize: 28, color: "#ECE9E1" }}>FirstFrame</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", fontFamily: "Geist Mono", fontSize: 18, letterSpacing: 2.4, textTransform: "uppercase", color: "#FF5B3D" }}>{eyebrow}</div>
          <div style={{ display: "flex", fontFamily: SERIF, fontSize: 80, lineHeight: 0.95, letterSpacing: -1.5, color: "#ECE9E1" }}>{title}</div>
          <div style={{ display: "flex", fontFamily: SANS, fontSize: 26, lineHeight: 1.35, color: "#8F8A80" }}>{subtitle}</div>
        </div>
        <div style={{ display: "flex", fontFamily: "Geist Mono", fontSize: 16, color: "#5D5A53" }}>Free · open source · runs in your browser</div>
      </div>
      {visual}
     </div>
    </div>
  );
}
