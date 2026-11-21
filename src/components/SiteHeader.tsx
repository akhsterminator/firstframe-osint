import Link from "next/link";
import { GitHubStar, REPO_URL } from "./GitHubStar";
import { Logo } from "./Logo";

const NAV = [
  { href: "/when", label: "When" },
  { href: "/where", label: "Where" },
  { href: "/verify", label: "Verify" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-ink/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-5">
        <Link href="/" aria-label="FirstFrame home" className="shrink-0">
          <Logo />
        </Link>
        <nav className="flex items-center gap-0.5 text-sm text-muted">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-md px-2.5 py-1.5 transition hover:text-text sm:px-3">
              {n.label}
            </Link>
          ))}
          <Link href="/methodology" className="hidden rounded-md px-3 py-1.5 transition hover:text-text md:block">
            Methodology
          </Link>
          <span className="ml-2 hidden sm:block">
            <GitHubStar />
          </span>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>FirstFrame verifies events, not individuals. Free and open source (MIT).</p>
        <div className="flex flex-wrap gap-5">
          <Link href="/methodology" className="hover:text-text">Methodology</Link>
          <Link href="/sample" className="hover:text-text">Sample report</Link>
          <a href={REPO_URL} className="hover:text-text" target="_blank" rel="noreferrer">Source</a>
        </div>
      </div>
    </footer>
  );
}
