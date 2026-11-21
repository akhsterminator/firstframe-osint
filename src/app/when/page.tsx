import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { Bookmarklet } from "@/components/when/Bookmarklet";
import { Decoder } from "@/components/when/Decoder";
import { pageMeta } from "@/lib/web/meta";

export const metadata = pageMeta({
  title: "When was this really posted?",
  description: "Paste a TikTok, X, Instagram, Threads or Bluesky link and get the exact second it was posted, decoded from the post ID.",
  og: "when",
  path: "/when/",
});

const PLATFORMS = [
  ["TikTok", "first 32 bits, seconds"],
  ["X / Twitter", "41 bits, ms since 2010"],
  ["Instagram & Threads", "41 bits, ms since 2011"],
  ["Bluesky", "TID, microseconds"],
  ["Mastodon", "48 bits, ms since 1970"],
];

export default function WhenPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-5 pt-16">
        <p className="eyebrow mb-5 flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-alert" /> When · instant, no sign-up
        </p>
        <h1 className="font-serif text-[clamp(2.8rem,7vw,5.5rem)] leading-[0.92] tracking-[-0.02em]">
          Every post link hides the second it was posted.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
          &ldquo;Breaking&rdquo; clips are often years old. Paste a link and see when it really went up. Paste every repost you can
          find and see which came first. It all happens on this page; nothing is sent anywhere.
        </p>
        <div className="mt-10">
          <Decoder />
        </div>

        <div className="mt-20 grid gap-10 border-t border-line pt-10 sm:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="eyebrow mb-3">Works with</p>
            <ul className="space-y-2 text-sm">
              {PLATFORMS.map(([p, how]) => (
                <li key={p} className="flex justify-between gap-4 border-b border-line/60 pb-2">
                  <span>{p}</span>
                  <span className="font-mono text-xs text-faint">{how}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-faint">YouTube, Facebook, Reddit and Telegram IDs don&rsquo;t carry a time.</p>
          </div>
          <div>
            <p className="eyebrow mb-3">What this proves, and what it doesn&rsquo;t</p>
            <div className="space-y-3 text-sm leading-relaxed text-muted">
              <p>
                It proves when <em className="text-text">this post</em> was created. It can&rsquo;t be faked by editing the caption, and the
                platform can&rsquo;t quietly change it.
              </p>
              <p>
                It doesn&rsquo;t prove when the <em className="text-text">video</em> was filmed. A clip posted today can be ten years old.
                That&rsquo;s why the oldest copy matters: find reposts, paste them all, and the earliest one is your lead.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12">
          <Bookmarklet />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
