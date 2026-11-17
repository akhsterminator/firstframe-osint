"use client";

import { useState } from "react";
import type { Report } from "@/lib/types";

const FORMATS = [
  { id: "portrait", label: "Post", size: "1080×1350" },
  { id: "story", label: "Story", size: "1080×1920" },
  { id: "og", label: "Link", size: "1200×630" },
] as const;

export function CardPanel({ report }: { report: Report }) {
  const [copied, setCopied] = useState(false);
  const done = report.status === "done";
  const v = Date.parse(report.updatedAt);
  const src = `/api/reports/${report.id}/card?format=portrait&v=${v}`;

  async function share() {
    const url = `${window.location.origin}/v/${report.id}`;
    try {
      if (navigator.share) await navigator.share({ url, title: "FirstFrame verification" });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }
    } catch {}
  }

  return (
    <div>
      <div className="relative overflow-hidden rounded-lg ring-1 ring-white/5">
        {done || report.status === "failed" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="Verification card" width={1080} height={1350} className="w-full" />
        ) : (
          <div className="relative aspect-[4/5] w-full overflow-hidden bg-raised">
            <div className="absolute inset-x-0 top-0 h-1/3 animate-scan bg-gradient-to-b from-transparent via-info/10 to-transparent" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
              <span className="eyebrow">Building the card</span>
              <span className="text-sm text-faint">It appears here when every check is in.</span>
            </div>
          </div>
        )}
      </div>
      {done && (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {FORMATS.map((f) => (
            <a
              key={f.id}
              href={`/api/reports/${report.id}/card?format=${f.id}&download=1`}
              className="rounded-lg border border-line px-2 py-2 text-center text-xs transition hover:border-line-strong hover:bg-raised"
              title={`Download ${f.size} PNG`}
            >
              <span className="block font-medium">{f.label}</span>
              <span className="block font-mono text-[10px] text-faint">{f.size}</span>
            </a>
          ))}
          <button onClick={share} className="rounded-lg bg-text px-2 py-2 text-xs font-medium text-ink transition hover:bg-white">
            {copied ? "Copied" : "Share"}
          </button>
        </div>
      )}
    </div>
  );
}
