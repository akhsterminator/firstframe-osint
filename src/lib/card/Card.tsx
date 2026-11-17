import type { CSSProperties, ReactNode } from "react";
import type { CardModel, Fact, Tone } from "./model";

export type CardFormat = "portrait" | "story" | "og";

export const CARD_SIZES: Record<CardFormat, { width: number; height: number }> = {
  portrait: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
  og: { width: 1200, height: 630 },
};

const PAPER = "#F3F0E8";
const INK = "#141414";
const MUTED = "#6E6A62";
const RULE = "#D9D4C7";
const TONE: Record<Tone, string> = { alert: "#CF3A1E", caution: "#B5720B", ok: "#1E7A4C", neutral: INK };
const TONE_WORD: Record<Tone, string> = { alert: "Red flag", caution: "Worth checking", ok: "Checks out", neutral: "Finding" };

const SERIF = "Instrument Serif";
const SANS = "Geist";
const MONO = "Geist Mono";

export interface CardAssets {
  hero?: string;
  map?: string;
  host: string;
}

function Mark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <path d="M2 10V2h8M22 2h8v8M30 22v8h-8M10 30H2v-8" stroke={INK} strokeWidth="3" fill="none" />
      <circle cx="10" cy="10" r="3.5" fill={TONE.alert} />
    </svg>
  );
}

function Corners({ w, h, color = "#FFFFFF", len = 26, inset = 14 }: { w: number; h: number; color?: string; len?: number; inset?: number }) {
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", top: 0, left: 0 }}>
      <path
        d={[
          `M${inset} ${inset + len}V${inset}H${inset + len}`,
          `M${w - inset - len} ${inset}H${w - inset}V${inset + len}`,
          `M${w - inset} ${h - inset - len}V${h - inset}H${w - inset - len}`,
          `M${inset + len} ${h - inset}H${inset}V${h - inset - len}`,
        ].join(" ")}
        stroke={color}
        strokeWidth="3"
        fill="none"
      />
    </svg>
  );
}

function Mono({ children, size = 17, color = MUTED, style }: { children: ReactNode; size?: number; color?: string; style?: CSSProperties }) {
  return (
    <div style={{ display: "flex", fontFamily: MONO, fontSize: size, letterSpacing: size * 0.12, textTransform: "uppercase", color, ...style }}>
      {children}
    </div>
  );
}

function Header({ model, compact, width }: { model: CardModel; compact?: boolean; width: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Mark size={compact ? 26 : 30} />
        <div style={{ display: "flex", fontFamily: SANS, fontWeight: 600, fontSize: compact ? 25 : 29, letterSpacing: -0.5, color: INK }}>FirstFrame</div>
      </div>
      <Mono size={compact ? 14 : 16}>{model.sample ? "Sample · illustrative data" : `Verification · ${model.id}`}</Mono>
    </div>
  );
}

function Hero({ src, width, height, caption }: { src?: string; width: number; height: number; caption?: string }) {
  return (
    <div style={{ display: "flex", position: "relative", width, height, borderRadius: 6, overflow: "hidden", backgroundColor: "#1C1B19" }}>
      {src ? <img src={src} width={width} height={height} style={{ objectFit: "cover", width, height }} /> : null}
      <Corners w={width} h={height} />
      {caption ? (
        <div style={{ display: "flex", position: "absolute", left: 18, bottom: 18, padding: "7px 12px", backgroundColor: "rgba(10,10,10,0.72)", borderRadius: 3 }}>
          <Mono size={14} color="#F3F0E8">{caption}</Mono>
        </div>
      ) : null}
    </div>
  );
}

function Timeline({ points, width }: { points: { at: number; earliest: boolean; source: boolean }[]; width: number }) {
  if (points.length < 2) return null;
  const min = Math.min(...points.map((p) => p.at));
  const max = Math.max(...points.map((p) => p.at));
  const span = max - min || 1;
  return (
    <div style={{ display: "flex", position: "relative", width, height: 18, marginTop: 10 }}>
      <div style={{ display: "flex", position: "absolute", left: 0, top: 8, width, height: 2, backgroundColor: RULE }} />
      {points.map((p, i) => {
        const x = ((p.at - min) / span) * (width - 14);
        const color = p.earliest ? TONE.alert : p.source ? INK : MUTED;
        const size = p.earliest || p.source ? 14 : 8;
        return (
          <div
            key={i}
            style={{ display: "flex", position: "absolute", left: x + (14 - size) / 2, top: 9 - size / 2, width: size, height: size, borderRadius: size, backgroundColor: color }}
          />
        );
      })}
    </div>
  );
}

function FactCell({ fact, width, children, valueSize = 34 }: { fact?: Fact; width: number; children?: ReactNode; valueSize?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width, borderTop: `2px solid ${INK}`, paddingTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {fact && fact.tone !== "neutral" ? <div style={{ display: "flex", width: 10, height: 10, borderRadius: 10, backgroundColor: TONE[fact.tone] }} /> : null}
        <Mono size={15}>{fact?.label ?? "—"}</Mono>
      </div>
      <div style={{ display: "flex", fontFamily: SANS, fontWeight: 600, fontSize: valueSize, letterSpacing: -0.6, color: fact ? TONE[fact.tone] : RULE, marginTop: 6 }}>
        {fact?.value ?? "Not checked"}
      </div>
      {fact?.sub ? <Mono size={14} style={{ marginTop: 6, letterSpacing: 0.6 }}>{fact.sub}</Mono> : null}
      {children}
    </div>
  );
}

function Chip({ label, tone }: { label: string; tone: Tone }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 14px", border: `1.5px solid ${tone === "neutral" ? RULE : TONE[tone]}`, borderRadius: 40 }}>
      <div style={{ display: "flex", width: 9, height: 9, borderRadius: 9, backgroundColor: TONE[tone] }} />
      <div style={{ display: "flex", fontFamily: SANS, fontSize: 20, color: INK }}>{label}</div>
    </div>
  );
}

function Perforation({ width }: { width: number }) {
  const n = Math.floor(width / 16);
  return (
    <div style={{ display: "flex", width, justifyContent: "space-between" }}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} style={{ display: "flex", width: 6, height: 6, borderRadius: 6, backgroundColor: RULE }} />
      ))}
    </div>
  );
}

function Footer({ model, host, width }: { model: CardModel; host: string; width: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, width }}>
      <Perforation width={width} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width }}>
        <Mono size={14}>Signals, not verdicts · Faces blurred</Mono>
        <Mono size={14} color={INK} style={{ textTransform: "none", letterSpacing: 0.5 }}>{`${host}/v/${model.id}`}</Mono>
      </div>
    </div>
  );
}

function Headline({ model, size, showAlso = true }: { model: CardModel; size: number; showAlso?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", width: 12, height: 12, borderRadius: 12, backgroundColor: TONE[model.tone] }} />
        <Mono size={15} color={TONE[model.tone]}>{TONE_WORD[model.tone]}</Mono>
      </div>
      <div style={{ display: "flex", fontFamily: SERIF, fontSize: size, lineHeight: 0.98, letterSpacing: -size * 0.015, color: INK }}>{model.headline}</div>
      <div style={{ display: "flex", fontFamily: SANS, fontSize: Math.round(size * 0.32), lineHeight: 1.38, color: MUTED }}>{model.detail}</div>
      {showAlso && model.also.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
          {model.also.map((a, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ display: "flex", width: 22, height: 2, backgroundColor: TONE[a.tone] }} />
              <div style={{ display: "flex", fontFamily: SANS, fontWeight: 500, fontSize: Math.round(size * 0.3), color: INK }}>{a.title}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Grid({ model, assets, width, valueSize }: { model: CardModel; assets: CardAssets; width: number; valueSize: number }) {
  const gap = 40;
  const cell = (width - gap) / 2;
  const mapW = 150;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26, width }}>
      <div style={{ display: "flex", gap }}>
        <FactCell fact={model.firstSeen} width={cell} valueSize={valueSize}>
          {model.firstSeen ? <Timeline points={model.firstSeen.timeline} width={cell} /> : null}
        </FactCell>
        <div style={{ display: "flex", width: cell, gap: 16 }}>
          <FactCell fact={model.where} width={assets.map ? cell - mapW - 16 : cell} valueSize={valueSize} />
          {assets.map ? (
            <div style={{ display: "flex", position: "relative", width: mapW, height: 112, marginTop: 16, borderRadius: 4, overflow: "hidden" }}>
              <img src={assets.map} width={mapW} height={112} />
              <div style={{ display: "flex", position: "absolute", left: mapW / 2 - 8, top: 56 - 8, width: 16, height: 16, borderRadius: 16, backgroundColor: TONE.alert, border: "3px solid #FFFFFF" }} />
            </div>
          ) : null}
        </div>
      </div>
      <div style={{ display: "flex", gap }}>
        <FactCell fact={model.when} width={cell} valueSize={valueSize} />
        <FactCell fact={model.weather} width={cell} valueSize={valueSize} />
      </div>
    </div>
  );
}

function Signals({ model }: { model: CardModel }) {
  if (!model.signals.length) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
      <Mono size={15} style={{ marginRight: 6 }}>Tamper signals</Mono>
      {model.signals.map((s, i) => (
        <Chip key={i} label={s.label} tone={s.tone} />
      ))}
    </div>
  );
}

export function Card({ model, assets, format }: { model: CardModel; assets: CardAssets; format: CardFormat }) {
  const { width, height } = CARD_SIZES[format];

  if (format === "og") {
    const heroW = 500;
    const inner = width - heroW - 96;
    return (
      <div style={{ display: "flex", width, height, backgroundColor: PAPER }}>
        <Hero src={assets.hero} width={heroW} height={height} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: inner, height: height - 80, margin: "40px 48px" }}>
          <Header model={model} compact width={inner} />
          <Headline model={{ ...model, detail: model.detail.length > 110 ? `${model.detail.slice(0, 108)}…` : model.detail }} size={58} showAlso={false} />
          <div style={{ display: "flex", gap: 28, width: inner }}>
            <FactCell fact={model.firstSeen} width={(inner - 28) / 2} valueSize={26} />
            <FactCell fact={model.where} width={(inner - 28) / 2} valueSize={26} />
          </div>
          <Mono size={13} style={{ textTransform: "none", letterSpacing: 0.5 }}>{`${assets.host}/v/${model.id}`}</Mono>
        </div>
      </div>
    );
  }

  const pad = 60;
  const inner = width - pad * 2;
  const story = format === "story";
  return (
    <div style={{ display: "flex", width, height, backgroundColor: PAPER, alignItems: "center", justifyContent: "center" }}>
    <div style={{ display: "flex", flexDirection: "column", width: inner, height: height - pad * 2, justifyContent: "space-between" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: story ? 40 : 30 }}>
        <Header model={model} width={inner} />
        <Hero src={assets.hero} width={inner} height={story ? 900 : 470} caption={model.heroCaption} />
        <Headline model={model} size={story ? 88 : 74} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: story ? 40 : 26 }}>
        <Grid model={model} assets={assets} width={inner} valueSize={story ? 36 : 32} />
        <Signals model={model} />
        <Footer model={model} host={assets.host} width={inner} />
      </div>
    </div>
    </div>
  );
}
