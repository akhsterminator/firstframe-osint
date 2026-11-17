import Link from "next/link";
import { Logo } from "./Logo";

const REPO = "https://github.com/akhsterminator/firstframe-osint";

export function SiteHeader({ cta = true }: { cta?: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-ink/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
        <Link href="/" aria-label="FirstFrame home">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1 text-sm text-muted">
          <Link href="/methodology" className="rounded-md px-3 py-1.5 transition hover:text-text">
            Methodology
          </Link>
          <a href={REPO} className="rounded-md px-3 py-1.5 transition hover:text-text" target="_blank" rel="noreferrer">
            GitHub
          </a>
          {cta && (
            <Link href="/" className="ml-2 rounded-full bg-text px-4 py-1.5 font-medium text-ink transition hover:bg-white">
              New check
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          FirstFrame verifies events, not individuals. Open source under the MIT licence.
        </p>
        <div className="flex gap-5">
          <Link href="/methodology" className="hover:text-text">Methodology</Link>
          <Link href="/v/sample" className="hover:text-text">Sample report</Link>
          <a href={REPO} className="hover:text-text" target="_blank" rel="noreferrer">Source</a>
        </div>
      </div>
    </footer>
  );
}
