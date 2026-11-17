"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

const EXAMPLES = ["tiktok.com/@…/video/…", "x.com/…/status/…", "instagram.com/reel/…"];

export function VerifyForm({ autoFocus = false }: { autoFocus?: boolean }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [showClaim, setShowClaim] = useState(false);
  const [claimPlace, setClaimPlace] = useState("");
  const [claimDate, setClaimDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!url.trim() && !file) {
      setError("Paste a link or drop in a video file.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let res: Response;
      if (file) {
        const fd = new FormData();
        fd.set("file", file);
        if (claimPlace) fd.set("claimPlace", claimPlace);
        if (claimDate) fd.set("claimDate", claimDate);
        res = await fetch("/api/verify", { method: "POST", body: fd });
      } else {
        res = await fetch("/api/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url, claimPlace: claimPlace || undefined, claimDate: claimDate || undefined }),
        });
      }
      const body = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !body.id) throw new Error(body.error ?? "Something went wrong. Try again.");
      router.push(`/v/${body.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) {
      setFile(f);
      setUrl("");
    }
  }

  return (
    <form
      onSubmit={submit}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`relative rounded-2xl border bg-panel/80 p-2 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)] transition ${
        dragging ? "border-info" : "border-line-strong"
      }`}
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Video link</span>
          {file ? (
            <div className="flex h-14 items-center justify-between rounded-xl bg-raised px-4">
              <span className="truncate font-mono text-sm">{file.name}</span>
              <button type="button" onClick={() => setFile(null)} className="ml-3 text-xs text-muted hover:text-text">
                Remove
              </button>
            </div>
          ) : (
            <input
              autoFocus={autoFocus}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="Paste a TikTok, X or Instagram link"
              className="h-14 w-full rounded-xl bg-raised px-4 text-[15px] placeholder:text-faint focus:outline-none"
            />
          )}
        </label>
        <button
          type="submit"
          disabled={busy}
          className="group relative h-14 overflow-hidden rounded-xl bg-text px-6 font-medium text-ink transition hover:bg-white disabled:cursor-wait disabled:opacity-80"
        >
          {busy ? "Starting…" : "Verify"}
          <span className="ml-2 inline-block transition group-hover:translate-x-0.5">→</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-2 pt-2 pb-1 text-xs text-muted">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setShowClaim((s) => !s)} className="hover:text-text">
            {showClaim ? "− Hide claim" : "+ Add a claim to test"}
          </button>
          <span className="text-line-strong">·</span>
          <button type="button" onClick={() => fileInput.current?.click()} className="hover:text-text">
            Upload a file
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setFile(f);
                setUrl("");
              }
            }}
          />
        </div>
        <span className="hidden font-mono text-faint sm:inline">{EXAMPLES.join("  ·  ")}</span>
      </div>

      {showClaim && (
        <div className="grid gap-2 px-2 pt-2 pb-2 sm:grid-cols-2">
          <label className="block">
            <span className="eyebrow mb-1.5 block">Claimed place</span>
            <input
              value={claimPlace}
              onChange={(e) => setClaimPlace(e.target.value)}
              placeholder="e.g. Valencia, Spain"
              className="h-11 w-full rounded-lg bg-raised px-3 text-sm placeholder:text-faint focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="eyebrow mb-1.5 block">Claimed date</span>
            <input
              type="date"
              value={claimDate}
              onChange={(e) => setClaimDate(e.target.value)}
              className="h-11 w-full rounded-lg bg-raised px-3 text-sm focus:outline-none"
            />
          </label>
        </div>
      )}

      {error && <p className="px-3 pt-1 pb-2 text-sm text-alert">{error}</p>}
    </form>
  );
}
