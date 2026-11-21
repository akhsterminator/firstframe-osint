"use client";

import { useEffect, useState } from "react";
import { VerifyForm } from "./VerifyForm";
import { IS_STATIC } from "@/lib/web/paths";

/** On a self-hosted server, offer the full link pipeline. On the static site, render nothing. */
export function ServerCheck() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (IS_STATIC) return;
    fetch("/api/health")
      .then((r) => setAvailable(r.ok))
      .catch(() => {});
  }, []);
  if (!available) return null;
  return (
    <section className="mx-auto max-w-6xl px-5 py-16">
      <p className="eyebrow mb-4">This server can fetch links</p>
      <h2 className="mb-6 font-serif text-4xl">Paste a link for the full automated check.</h2>
      <div className="max-w-3xl">
        <VerifyForm />
      </div>
    </section>
  );
}
