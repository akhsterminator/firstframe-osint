import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { VerifyForm } from "@/components/VerifyForm";
import { getStore } from "@/lib/store";
import { PLATFORM_LABEL } from "@/lib/card/model";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    n: "01",
    title: "Find the first upload",
    body: "Keyframes go through Google Lens, Bing, Yandex and TinEye. Every copy is dated from post IDs, page metadata and crawl records, then lined up oldest first.",
  },
  {
    n: "02",
    title: "Search the map",
    body: "A vision model lists what it can see: a church by a roundabout, a river, a fuel brand. FirstFrame compiles that into an OpenStreetMap query and plots every place where the whole scene fits.",
  },
  {
    n: "03",
    title: "Read the sun",
    body: "Shadow length gives the sun's height. SunCalc turns that into the times of day, and the months of the year, when the shot was possible at that spot.",
  },
  {
    n: "04",
    title: "Check the weather",
    body: "Historical records from Open-Meteo are compared with the sky in the frame. Sunny footage from a day of heavy rain is a quick tell.",
  },
  {
    n: "05",
    title: "Look for tampering",
    body: "Content Credentials, file metadata and AI-detector scores, shown as signals with their strength. Detectors are often wrong, and the report says so.",
  },
  {
    n: "06",
    title: "Share one card",
    body: "Everything lands on a single card sized for feeds and stories, with faces blurred and a link back to the full evidence.",
  },
];

const PRINCIPLES = [
  ["No face recognition", "Faces are detected only to be blurred, before any frame is stored or shown. Nothing is matched or identified."],
  ["No people search", "FirstFrame links to posts, not profiles. It doesn't collect account details or look anyone up."],
  ["Signals, not verdicts", "Every check shows its evidence and confidence. You make the call, with the working on screen."],
  ["Show the query", "Every map search is shown as raw Overpass QL with a one-click link to re-run and edit it."],
];

export default async function Home() {
  const recent = await getStore()
    .listRecent(6)
    .catch(() => []);

  return (
    <>
      <SiteHeader cta={false} />
      <main>
        <section className="grain relative overflow-hidden border-b border-line">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,91,61,0.10),transparent_55%)]" />
          <div className="relative mx-auto max-w-6xl px-5 pt-20 pb-24 sm:pt-28">
            <p className="eyebrow mb-6 flex items-center gap-2">
              <span className="inline-block size-1.5 rounded-full bg-alert" /> Open-source video verification
            </p>
            <h1 className="max-w-4xl font-serif text-[clamp(3rem,8vw,6.5rem)] leading-[0.92] tracking-[-0.02em]">
              Where did this video <em className="text-alert">really</em> come from?
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-muted">
              Paste a link. FirstFrame finds the earliest copy online, searches the map for where it was filmed, reads the
              sun and the weather, and checks for signs of tampering. One card, in about a minute.
            </p>
            <div className="mt-10 max-w-3xl">
              <VerifyForm autoFocus />
            </div>
            <p className="mt-4 text-sm text-faint">
              Want to see the output first?{" "}
              <Link href="/v/sample" className="text-muted underline decoration-line-strong underline-offset-4 hover:text-text">
                Open the sample report
              </Link>
              .
            </p>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-14 px-5 py-24 lg:grid-cols-[1fr_420px] lg:items-center">
          <div>
            <p className="eyebrow mb-4">The card</p>
            <h2 className="font-serif text-5xl leading-[1] tracking-[-0.01em]">The reveal, ready to post.</h2>
            <p className="mt-5 max-w-xl text-muted leading-relaxed">
              Each check gets its own line, so viewers can see what holds up and what doesn't. Download it as a feed post,
              a story or a link preview. Every card links back to the full report with sources, queries and raw evidence.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 text-sm">
              <Link href="/v/sample" className="rounded-full bg-text px-5 py-2.5 font-medium text-ink hover:bg-white">
                Explore the sample report
              </Link>
              <Link href="/methodology" className="rounded-full border border-line-strong px-5 py-2.5 hover:border-muted">
                How each check works
              </Link>
            </div>
          </div>
          <Link href="/v/sample" className="group block rotate-[1.5deg] transition duration-500 hover:rotate-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/api/reports/sample/card?format=portrait"
              alt="Sample FirstFrame verification card"
              width={1080}
              height={1350}
              className="w-full rounded-lg shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)] ring-1 ring-white/5"
            />
          </Link>
        </section>

        <section className="border-y border-line bg-panel/40">
          <div className="mx-auto max-w-6xl px-5 py-24">
            <p className="eyebrow mb-4">How it works</p>
            <h2 className="max-w-3xl font-serif text-5xl leading-[1] tracking-[-0.01em]">
              Five to ten tools, chained into one pass.
            </h2>
            <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
              {STEPS.map((s) => (
                <div key={s.n} className="bg-ink p-7">
                  <span className="font-mono text-xs text-alert">{s.n}</span>
                  <h3 className="mt-3 text-lg font-medium">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-24">
          <div className="grid gap-12 lg:grid-cols-[380px_1fr]">
            <div>
              <p className="eyebrow mb-4">Principles</p>
              <h2 className="font-serif text-5xl leading-[1] tracking-[-0.01em]">Verifies events, not individuals.</h2>
              <p className="mt-5 text-muted leading-relaxed">
                Most OSINT tools that go viral are built for tracking people. This one is built for checking footage, and
                it's designed so it can't easily be turned into anything else.
              </p>
            </div>
            <dl className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
              {PRINCIPLES.map(([t, d]) => (
                <div key={t} className="bg-ink p-7">
                  <dt className="font-medium">{t}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-muted">{d}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {recent.length > 0 && (
          <section className="mx-auto max-w-6xl px-5 pb-8">
            <p className="eyebrow mb-6">Recent checks</p>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {recent.map((r) => (
                <Link key={r.id} href={`/v/${r.id}`} className="group overflow-hidden rounded-xl border border-line bg-panel transition hover:border-line-strong">
                  <div className="aspect-video overflow-hidden bg-raised">
                    {r.heroUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.heroUrl} alt="" className="size-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                    )}
                  </div>
                  <div className="p-4">
                    <p className="eyebrow">{PLATFORM_LABEL[r.platform]}</p>
                    <p className="mt-1.5 line-clamp-2 text-sm">{r.headline ?? r.title ?? "Verification report"}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
