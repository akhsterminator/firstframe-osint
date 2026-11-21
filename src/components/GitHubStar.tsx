"use client";

import { useEffect, useState } from "react";

export const REPO = "akhsterminator/firstframe-osint";
export const REPO_URL = `https://github.com/${REPO}`;

export function GitHubStar({ className = "" }: { className?: string }) {
  const [stars, setStars] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    try {
      const cached = sessionStorage.getItem("ff.stars");
      if (cached) return setStars(Number(cached));
    } catch {}
    fetch(`https://api.github.com/repos/${REPO}`)
      .then((r) => (r.ok ? r.json() : undefined))
      .then((d: { stargazers_count?: number } | undefined) => {
        if (cancelled || typeof d?.stargazers_count !== "number") return;
        setStars(d.stargazers_count);
        try {
          sessionStorage.setItem("ff.stars", String(d.stargazers_count));
        } catch {}
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-2 rounded-full border border-line-strong px-3.5 py-1.5 text-sm text-text transition hover:border-muted ${className}`}
    >
      <svg viewBox="0 0 16 16" className="size-4 fill-current" aria-hidden>
        <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
      </svg>
      Star
      {stars !== null && stars > 0 && <span className="font-mono text-xs text-muted">{stars.toLocaleString()}</span>}
    </a>
  );
}
