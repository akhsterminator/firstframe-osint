import Link from "next/link";
import { GitHubStar, REPO_URL } from "@/components/GitHubStar";
import { ServerCheck } from "@/components/ServerCheck";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { Decoder } from "@/components/when/Decoder";
import { asset } from "@/lib/web/paths";
import { pageMeta } from "@/lib/web/meta";

export const metadata = pageMeta({
  title: "FirstFrame: everyone shared it, nobody checked",
  description:
    "Check a viral video in a minute: when it was really posted, where it was filmed, whether the sun and the weather match, and signs of tampering. Free, open source, in your browser.",
  og: "home",
  path: "/",
});

const TOOLS = [
  {
    href: "/when",
    n: "01",
    title: "When was it posted?",
    body: "Every TikTok, X and Instagram link hides the second it went up. Paste reposts to see which came first.",
    tag: "instant · no key",
  },
  {
    href: "/where",
    n: "02",
    title: "Where was it filmed?",
    body: "Pick what you can see: a church, a roundabout, a river. Get every place on Earth where the whole scene fits.",
    tag: "OpenStreetMap · no key",
  },
  {
    href: "/verify",
    n: "03",
    title: "Is it what they say?",
    body: "Drop the video. Frames, faces blurred, metadata, Content Credentials, sun, weather, and a card ready to post.",
    tag: "in your browser",
  },
];

const STEPS = [
  ["Find the first upload", "Post IDs date every copy to the second. Reverse search finds the copies; FirstFrame lines them up oldest first."],
  ["Search the map", "Visible features become an OpenStreetMap query. Every place where the whole scene fits is plotted, with Street View links."],
  ["Read the sun", "Shadow length gives the sun's height. SunCalc turns that into times of day, and months of the year, when the shot was possible."],
  ["Check the weather", "Historical records from Open-Meteo against the sky in the frame. Sunny footage from a day of heavy rain is a quick tell."],
  ["Look for tampering", "Content Credentials, file metadata and visual anomalies, each shown as a signal with its strength. Never as a verdict."],
  ["Share one card", "Feed, story and link sizes, faces blurred, with the working on show. On a phone it goes straight to the share sheet."],
];

const PRINCIPLES = [
  ["No face recognition", "Faces are found only to be blurred, before anything is shown, shared or sent to a model. Nothing is matched or identified."],
  ["No people search", "FirstFrame links to posts, not profiles. It never looks anyone up."],
  ["Nothing uploaded", "On this site, videos are processed in your browser tab. There's no server to send them to."],
  ["Signals, not verdicts", "Every check shows its evidence and how much weight it can bear. You make the call."],
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="grain relative overflow-hidden border-b border-line">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,91,61,0.12),transparent_55%)]" />
          <div className="relative mx-auto max-w-6xl px-5 pt-16 pb-20 sm:pt-24">
            <p className="eyebrow mb-6 flex items-center gap-2">
              <span className="inline-block size-1.5 rounded-full bg-alert" /> Free · open source · runs in your browser
            </p>
            <h1 className="max-w-4xl font-serif text-[clamp(3rem,8.5vw,7rem)] leading-[0.9] tracking-[-0.025em]">
              Everyone shared it. <em className="text-alert">Nobody checked.</em>
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-muted">
              FirstFrame checks viral videos the way newsroom verification desks do: when it was really posted, where it was filmed, whether
              the sun and the weather match, and whether it&rsquo;s been tampered with. Start with a link.
            </p>
            <div className="mt-10 max-w-3xl">
              <Decoder autoFocus={false} compact />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20">
          <div className="grid gap-4 md:grid-cols-3">
            {TOOLS.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className="group flex flex-col justify-between rounded-2xl border border-line bg-panel/60 p-7 transition hover:-translate-y-0.5 hover:border-line-strong hover:bg-panel"
              >
                <div>
                  <span className="font-mono text-xs text-alert">{t.n}</span>
                  <h2 className="mt-4 font-serif text-3xl leading-tight">{t.title}</h2>
                  <p className="mt-3 text-sm leading-relaxed text-muted">{t.body}</p>
                </div>
                <div className="mt-8 flex items-center justify-between text-sm">
                  <span className="font-mono text-[11px] text-faint">{t.tag}</span>
                  <span className="transition group-hover:translate-x-1">Open →</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-14 px-5 pb-24 lg:grid-cols-[1fr_420px] lg:items-center">
          <div>
            <p className="eyebrow mb-4">The card</p>
            <h2 className="font-serif text-5xl leading-[1] tracking-[-0.01em]">The reveal, ready to post.</h2>
            <p className="mt-5 max-w-xl leading-relaxed text-muted">
              &ldquo;Everyone shared this video. I put it through FirstFrame.&rdquo; Each check gets its own line, so viewers see what holds up
              and what doesn&rsquo;t. Feed, story and link sizes; faces blurred automatically.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 text-sm">
              <Link href="/verify" className="rounded-full bg-text px-5 py-2.5 font-medium text-ink hover:bg-white">
                Check a video
              </Link>
              <Link href="/sample" className="rounded-full border border-line-strong px-5 py-2.5 hover:border-muted">
                See a full sample report
              </Link>
            </div>
          </div>
          <Link href="/sample" className="block rotate-[1.5deg] transition duration-500 hover:rotate-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={asset("/sample/card-portrait.png")}
              alt="Sample FirstFrame card: online since 9 Oct 2021, scene fits Bewdley not Hereford, weather doesn't match"
              width={1080}
              height={1350}
              className="w-full rounded-lg shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)] ring-1 ring-white/5"
            />
          </Link>
        </section>

        <section className="border-y border-line bg-panel/40">
          <div className="mx-auto max-w-6xl px-5 py-24">
            <p className="eyebrow mb-4">How it works</p>
            <h2 className="max-w-3xl font-serif text-5xl leading-[1] tracking-[-0.01em]">Five to ten tools, chained into one pass.</h2>
            <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
              {STEPS.map(([title, body], i) => (
                <div key={title} className="bg-ink p-7">
                  <span className="font-mono text-xs text-alert">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="mt-3 text-lg font-medium">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm text-faint">
              Want to know how far to trust each step? <Link href="/methodology" className="underline underline-offset-4 hover:text-text">Read the methodology</Link>.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-24">
          <div className="grid gap-12 lg:grid-cols-[380px_1fr]">
            <div>
              <p className="eyebrow mb-4">Principles</p>
              <h2 className="font-serif text-5xl leading-[1] tracking-[-0.01em]">Verifies events, not individuals.</h2>
              <p className="mt-5 leading-relaxed text-muted">
                Most OSINT tools that go viral are built for tracking people. This one is built for checking footage, and designed so it
                can&rsquo;t easily be turned into anything else.
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

        <ServerCheck />

        <section className="mx-auto max-w-6xl px-5">
          <div className="flex flex-col items-start justify-between gap-6 rounded-2xl border border-line bg-panel/60 p-8 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-serif text-3xl">Open source, and yours to run.</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
                Self-host it to paste links directly, automate reverse search and get a JSON API and a command-line tool. MIT licensed.
              </p>
            </div>
            <div className="flex gap-2">
              <GitHubStar />
              <a href={REPO_URL} target="_blank" rel="noreferrer" className="rounded-full bg-text px-4 py-1.5 text-sm font-medium text-ink hover:bg-white">
                View the code
              </a>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
