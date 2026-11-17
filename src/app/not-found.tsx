import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-32 text-center">
        <p className="eyebrow">404</p>
        <h1 className="mt-4 font-serif text-5xl">No report with that ID.</h1>
        <p className="mt-4 text-muted">Reports are deleted after a while, or the link may be mistyped.</p>
        <Link href="/" className="mt-8 inline-block rounded-full bg-text px-5 py-2.5 text-sm font-medium text-ink hover:bg-white">
          Run a new check
        </Link>
      </main>
    </>
  );
}
