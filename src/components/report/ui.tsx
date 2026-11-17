import type { ReactNode } from "react";
import type { FindingTone, StageStatus } from "@/lib/types";

export const TONE_TEXT: Record<FindingTone, string> = {
  alert: "text-alert",
  caution: "text-caution",
  ok: "text-ok",
  neutral: "text-text",
};

export const TONE_BG: Record<FindingTone, string> = {
  alert: "bg-alert",
  caution: "bg-caution",
  ok: "bg-ok",
  neutral: "bg-muted",
};

export function Section({
  id,
  n,
  title,
  status,
  aside,
  children,
}: {
  id: string;
  n: string;
  title: string;
  status?: StageStatus;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-line pt-8">
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-4">
          <span className="font-mono text-xs text-faint">{n}</span>
          <h2 className="font-serif text-[2rem] leading-none tracking-[-0.01em]">{title}</h2>
          {status === "running" && <span className="size-1.5 animate-pulse-dot rounded-full bg-info" />}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line px-5 py-6 text-sm text-muted">{children}</p>;
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: FindingTone | "info" }) {
  const ring =
    tone === "alert" ? "border-alert/40 text-alert" :
    tone === "caution" ? "border-caution/40 text-caution" :
    tone === "ok" ? "border-ok/40 text-ok" :
    tone === "info" ? "border-info/40 text-info" :
    "border-line-strong text-muted";
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[11px] ${ring}`}>{children}</span>;
}

export function KV({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex justify-between gap-6 border-b border-line/60 py-2 text-sm last:border-0">
      <span className="text-muted">{k}</span>
      <span className="text-right font-mono text-[13px] break-all">{v}</span>
    </div>
  );
}
