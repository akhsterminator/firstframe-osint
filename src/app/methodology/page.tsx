import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Methodology",
  description: "How FirstFrame finds the earliest copy of a video, where and when it was filmed, and what its tampering signals mean.",
};

const SECTIONS: { id: string; title: string; body: React.ReactNode }[] = [
  {
    id: "frames",
    title: "Keyframes",
    body: (
      <>
        <p>
          The video is downloaded with yt-dlp (or uploaded directly). ffmpeg finds scene cuts; we sample just after each
          cut plus a regular grid, drop black and near-duplicate frames using a 64-bit difference hash, and keep up to
          eight frames that are sharp and spread across the clip. The very first usable frame is always kept, because
          re-edited copies most often share the opening shot.
        </p>
        <p>
          Every frame goes through a face detector (UltraFace, 1 MB, MIT licence) and each face is replaced with an
          elliptical mosaic <em>before</em> the frame is written anywhere. The detector only returns boxes. If the model
          can't be loaded, the job stops instead of storing unblurred frames.
        </p>
      </>
    ),
  },
  {
    id: "provenance",
    title: "Earliest copy",
    body: (
      <>
        <p>
          The first frame, the hero frame and the sharpest remaining frames are sent to TinEye and, through SerpApi, to
          Google Lens, Bing and Yandex. Results are merged by URL, with platform URL variants collapsed to one post.
        </p>
        <p>Each copy is dated from the strongest evidence available:</p>
        <ul>
          <li>
            <strong>Post IDs.</strong> TikTok, X, Instagram, Threads, Bluesky and Mastodon IDs encode their creation
            time. Decoding them is instant, offline and can't be edited after posting.
          </li>
          <li>
            <strong>Page metadata.</strong> JSON-LD <code>datePublished</code>/<code>uploadDate</code>, Open Graph and
            article meta tags, <code>&lt;time&gt;</code> elements, and dates in the URL path.
          </li>
          <li>
            <strong>Crawl dates.</strong> When TinEye first saw the image on a page. This is a ceiling: the page can't be
            newer than the crawl.
          </li>
        </ul>
        <p>
          The earliest credible date wins. Independent evidence within two days raises confidence. Search-snippet and
          crawl-only dates are marked low confidence.
        </p>
      </>
    ),
  },
  {
    id: "geolocation",
    title: "Where it was filmed",
    body: (
      <>
        <p>
          A vision model (Claude) reads all frames together and returns a structured list: clues with the frame they
          came from, up to three region hypotheses with ISO codes, and two to six persistent physical features expressed
          as OpenStreetMap tags, linked by the maximum distance between them. The caption is passed in as a claim to
          test, never as evidence.
        </p>
        <p>
          FirstFrame compiles that graph into Overpass QL. The rarest feature becomes the anchor; every other feature is
          searched within its distance of its neighbour, then the search walks back up the tree so only places where
          the whole scene fits survive. If nothing does, a relaxed search ranks places that match some of the features.
          Searches run in the claimed place first (if given), then in each region hypothesis.
        </p>
        <p>
          Candidates are scored by how much of the scene they explain, weighted by rarity. The full query is shown with
          a link to Overpass Turbo so you can check, edit and re-run it. Coverage gaps in OpenStreetMap mean a missing
          candidate is not evidence against a place.
        </p>
      </>
    ),
  },
  {
    id: "chronolocation",
    title: "Time of day",
    body: (
      <p>
        If a vertical object and its full shadow are visible on flat ground, the ratio of shadow length to height gives
        the sun's altitude (arctan of height over shadow). An uncertainty band (±15–50% on the ratio, by confidence) is
        carried through. SunCalc gives the times on the tested date when the sun sits in that band at the candidate
        location, and the months in which it can climb that high at all. A sun that never gets high enough on the
        claimed date is flagged.
      </p>
    ),
  },
  {
    id: "weather",
    title: "Weather on the day",
    body: (
      <p>
        Hourly records from Open-Meteo (ERA5 reanalysis for older dates, the forecast archive for the last week) are
        compared with what the frames show: falling rain or snow, wet or snowy ground, cloud cover. Only moderate or
        strong disagreements count as inconsistent. Gridded data can miss a local shower, so a weak mismatch is reported
        as inconclusive rather than a red flag.
      </p>
    ),
  },
  {
    id: "integrity",
    title: "Tampering signals",
    body: (
      <>
        <p>
          We look for C2PA Content Credentials (and read them with c2patool when it's installed), file metadata such as
          encoders and device tags, scores from AI-image detectors (Hive, Sightengine) on several frames, and visual
          anomalies the vision model notices.
        </p>
        <p>
          Each one is shown as a signal with a direction and a strength. None of them is a verdict. Detectors are trained
          on clean images and misfire on recompressed social video. Platforms strip Content Credentials, so their absence
          means nothing. A signed manifest that declares an AI source is the only strong signal here, and it is rare.
        </p>
      </>
    ),
  },
  {
    id: "ethics",
    title: "What FirstFrame won't do",
    body: (
      <ul>
        <li>No face recognition, face matching or face search. Faces are blurred before storage, and the vision model never sees them.</li>
        <li>No people search. We link to posts, not accounts, and don't collect usernames or profile data.</li>
        <li>No licence-plate reading. The vision prompt tells the model not to read plate numbers.</li>
        <li>GPS from file metadata is rounded to about 100 m before it's shown.</li>
        <li>No verdicts. Every result is a signal with its evidence and its limits.</li>
      </ul>
    ),
  },
];

export default function Methodology() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 pt-16">
        <p className="eyebrow mb-4">Methodology</p>
        <h1 className="max-w-3xl font-serif text-6xl leading-[0.95] tracking-[-0.015em]">Every check, and how far to trust it.</h1>
        <div className="mt-16 grid gap-12 lg:grid-cols-[200px_1fr]">
          <nav className="hidden lg:block">
            <ol className="sticky top-24 space-y-2 text-sm text-muted">
              {SECTIONS.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="hover:text-text">
                    <span className="mr-2 font-mono text-xs text-faint">{String(i + 1).padStart(2, "0")}</span>
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <div className="max-w-2xl space-y-14">
            {SECTIONS.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-24">
                <h2 className="mb-4 flex items-baseline gap-3 font-serif text-3xl">
                  <span className="font-mono text-xs text-faint">{String(i + 1).padStart(2, "0")}</span>
                  {s.title}
                </h2>
                <div className="space-y-4 leading-relaxed text-muted [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-text [&_em]:text-text [&_li]:pl-1 [&_strong]:font-medium [&_strong]:text-text [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
                  {s.body}
                </div>
              </section>
            ))}
            <p className="text-sm text-faint">
              Found a case where FirstFrame got it wrong? <Link href="https://github.com/akhsterminator/firstframe-osint/issues" className="underline underline-offset-4 hover:text-text">Open an issue</Link> with the link. Failure cases make the best test fixtures.
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
