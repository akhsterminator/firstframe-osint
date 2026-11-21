"use client";

import { useEffect, useRef } from "react";
import { BOOKMARKLET } from "@/lib/ingest/bookmarklet";

/** React strips javascript: hrefs, so the link is set on the DOM node directly. */
export function Bookmarklet() {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    ref.current?.setAttribute("href", BOOKMARKLET);
  }, []);
  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-line bg-panel/60 p-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium">Get it in one click, on any post</p>
        <p className="mt-1 max-w-lg text-sm text-muted">
          Drag the button to your bookmarks bar. On a TikTok, X, Instagram, Threads or Bluesky post, click it to see when the post was
          made. It runs on the page itself and sends nothing anywhere.
        </p>
      </div>
      <a
        ref={ref}
        onClick={(e) => {
          e.preventDefault();
          alert("Drag this button to your bookmarks bar, then click it on any post.");
        }}
        className="inline-flex shrink-0 cursor-grab items-center gap-2 self-start rounded-full border-2 border-dashed border-alert/60 px-5 py-2.5 text-sm font-medium text-alert sm:self-auto"
      >
        ⌖ When was this posted?
      </a>
    </div>
  );
}
