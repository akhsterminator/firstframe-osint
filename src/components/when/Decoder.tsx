"use client";

import { createElement, useEffect, useMemo, useState } from "react";
import { PLATFORM_LABEL } from "@/lib/card/model";
import { ago, TimeCard, type TimeEntry } from "@/lib/card/TimeCard";
import { idAnatomy } from "@/lib/ingest/post-id";
import { parseSourceUrl } from "@/lib/ingest/url";
import type { Platform } from "@/lib/types";
import { renderElement, shareOrDownload } from "@/lib/web/card";

interface Decoded {
  input: string;
  platform?: Platform;
  postId?: string;
  at?: number;
  reason?: string;
}

const NO_TIME: Partial<Record<Platform, string>> = {
  youtube: "YouTube video IDs are random, so they don't carry a time.",
  facebook: "Facebook IDs don't encode a usable time.",
  reddit: "Reddit IDs are sequential counters, not timestamps.",
  telegram: "Telegram message numbers count up per channel; they don't hold a date.",
};

const EXAMPLES = [
  "https://x.com/someone/status/1585841080431321088",
  "https://www.tiktok.com/@someone/video/7106594312292453675",
  "https://www.instagram.com/p/BsOGulcndj-/",
];

export function decodeLine(line: string): Decoded | undefined {
  const input = line.trim();
  if (!input) return undefined;
  const p = parseSourceUrl(input);
  if (!p) return { input, reason: "That doesn't look like a link." };
  if (p.needsResolve) return { input, platform: p.platform, reason: "Short links hide the post ID. Open it in a browser and paste the full address." };
  if (p.idTime) return { input, platform: p.platform, postId: p.postId, at: p.idTime };
  return { input, platform: p.platform, reason: NO_TIME[p.platform] ?? "No post ID with a timestamp in this link. Paste a link to a single post." };
}

const fmt = (ms: number, tz?: string) =>
  new Date(ms).toLocaleString("en-GB", { dateStyle: "full", timeStyle: "medium", timeZone: tz, hour12: false });

function Bits({ entry }: { entry: Decoded }) {
  const a = entry.platform && entry.postId ? idAnatomy(entry.platform, entry.postId) : undefined;
  if (!a) return null;
  return (
    <div className="mt-10">
      <p className="eyebrow mb-3">How we know</p>
      <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-1 font-mono text-[11px] sm:grid-cols-[repeat(32,minmax(0,1fr))]">
        {a.bits.split("").map((b, i) => {
          const ts = i >= a.timestamp[0] && i < a.timestamp[1];
          return (
            <span
              key={i}
              style={{ animationDelay: `${i * 12}ms` }}
              className={`flex h-7 animate-[bit-in_400ms_ease-out_both] items-center justify-center rounded ${
                ts ? (b === "1" ? "bg-alert text-ink" : "bg-alert/20 text-alert") : b === "1" ? "bg-line-strong text-text" : "bg-raised text-faint"
              }`}
            >
              {b}
            </span>
          );
        })}
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        <span className="text-alert">Red bits are a clock.</span> {a.recipe} Platforms build IDs this way so they sort by time; it also means
        every link records when it was posted, and editing the caption can't change it.
      </p>
    </div>
  );
}

export function Decoder({ autoFocus = true, compact = false }: { autoFocus?: boolean; compact?: boolean }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tz, setTz] = useState<string | undefined>();

  useEffect(() => {
    setTz(Intl.DateTimeFormat().resolvedOptions().timeZone);
    const params = new URLSearchParams(window.location.search);
    const u = params.getAll("u");
    if (u.length) setText(u.join("\n"));
  }, []);

  const results = useMemo(() => text.split(/[\s,]+/).map(decodeLine).filter((d): d is Decoded => !!d).slice(0, 50), [text]);
  const dated = results.filter((r) => r.at).sort((a, b) => a.at! - b.at!);
  const single = results.length === 1 ? results[0] : undefined;

  function shareUrl() {
    const u = new URL(window.location.href);
    u.pathname = u.pathname.replace(/\/?$/, "/").replace(/\/[^/]*\/$/, "/when/");
    u.search = "";
    for (const r of results.slice(0, 10)) u.searchParams.append("u", r.input);
    return u.toString();
  }

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  async function card() {
    setBusy(true);
    try {
      const entries: TimeEntry[] = dated.map((d) => {
        const a = idAnatomy(d.platform!, d.postId!);
        return { platform: PLATFORM_LABEL[d.platform!], postId: d.postId!, at: d.at!, bits: a?.bits, timestamp: a?.timestamp };
      });
      const png = await renderElement(createElement(TimeCard, { entries, host: window.location.host + "/when" }), 1080, 1350);
      await shareOrDownload(png, "firstframe-when.png", "Decoded with FirstFrame");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="rounded-2xl border border-line-strong bg-panel/80 p-2 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]">
        <textarea
          autoFocus={autoFocus}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={Math.min(6, Math.max(1, text.split("\n").length))}
          spellCheck={false}
          placeholder="Paste a TikTok, X, Instagram, Threads or Bluesky link (or several, one per line)"
          className="block min-h-14 w-full resize-none rounded-xl bg-raised px-4 py-4 text-[15px] leading-6 placeholder:text-faint focus:outline-none"
        />
        {!text && (
          <div className="flex flex-wrap items-center gap-2 px-2 pt-2 pb-1 text-xs text-muted">
            <span>Try:</span>
            {EXAMPLES.map((e) => (
              <button key={e} onClick={() => setText(e)} className="rounded-full border border-line px-2.5 py-1 font-mono text-[11px] hover:border-line-strong hover:text-text">
                {e.replace(/^https:\/\/(www\.)?/, "").slice(0, 34)}…
              </button>
            ))}
          </div>
        )}
      </div>

      {single?.at && (
        <div className="mt-10">
          <p className="eyebrow flex items-center gap-2 text-alert">
            <span className="size-1.5 rounded-full bg-alert" /> {PLATFORM_LABEL[single.platform!]} post · actually posted
          </p>
          <p className={`mt-4 font-serif leading-[0.9] tracking-[-0.02em] ${compact ? "text-5xl sm:text-6xl" : "text-[clamp(3rem,9vw,7rem)]"}`}>
            {new Date(single.at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}
          </p>
          <p className="mt-3 font-mono text-xl text-text/90 sm:text-2xl">
            {new Date(single.at).toISOString().slice(11, 19)} <span className="text-muted">UTC</span>
            <span className="ml-4 text-base text-muted">· {ago(single.at)}</span>
          </p>
          {tz && <p className="mt-2 text-sm text-muted">Your time ({tz}): {fmt(single.at, tz)}</p>}
          {!compact && <Bits entry={single} />}
        </div>
      )}

      {single && !single.at && <p className="mt-6 rounded-xl border border-dashed border-line px-5 py-4 text-sm text-muted">{single.reason}</p>}

      {results.length > 1 && (
        <div className="mt-10">
          <p className="eyebrow mb-3">{dated.length > 1 ? `Which came first? ${dated.length} posts, oldest first` : "Results"}</p>
          <ol className="divide-y divide-line/70 overflow-hidden rounded-xl border border-line">
            {[...dated, ...results.filter((r) => !r.at)].map((r, i) => (
              <li key={`${r.input}-${i}`} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3">
                <span className={`w-6 font-mono text-xs ${i === 0 && r.at ? "text-alert" : "text-faint"}`}>{r.at ? String(i + 1).padStart(2, "0") : "–"}</span>
                <span className={`font-mono text-sm ${i === 0 && r.at ? "text-alert" : ""}`}>{r.at ? new Date(r.at).toISOString().replace("T", " ").slice(0, 19) : "no timestamp"}</span>
                <span className="text-xs text-muted">{r.platform ? PLATFORM_LABEL[r.platform] : ""}</span>
                <a href={r.input} target="_blank" rel="noreferrer noopener" className="min-w-0 flex-1 truncate text-right font-mono text-xs text-faint hover:text-text">
                  {r.input.replace(/^https?:\/\/(www\.)?/, "")}
                </a>
              </li>
            ))}
          </ol>
          {dated.length > 1 && (
            <p className="mt-3 text-sm text-muted">
              The first post is {ago(dated[0]!.at!, dated[dated.length - 1]!.at!).replace(" ago", "")} older than the newest. Paste every repost you can find to trace a clip back to its first upload.
            </p>
          )}
        </div>
      )}

      {dated.length > 0 && (
        <div className="mt-8 flex flex-wrap gap-2">
          <button onClick={card} disabled={busy} className="rounded-full bg-text px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-white disabled:opacity-70">
            {busy ? "Making card…" : "Get the card"}
          </button>
          <button onClick={copyLink} className="rounded-full border border-line-strong px-5 py-2.5 text-sm transition hover:border-muted">
            {copied ? "Link copied" : "Copy link to this result"}
          </button>
        </div>
      )}
    </div>
  );
}
