import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { BrowserVerify } from "@/components/verify/BrowserVerify";
import { pageMeta } from "@/lib/web/meta";

export const metadata = pageMeta({
  title: "Verify a video in your browser",
  description: "Drop a video: keyframes, face blurring, metadata, Content Credentials, map search, sun and weather checks, and a card to share. Nothing is uploaded.",
  og: "verify",
  path: "/verify/",
});

export default function VerifyPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 pt-14">
        <div className="mx-auto mb-10 max-w-3xl text-center">
          <p className="eyebrow mb-5 flex items-center justify-center gap-2">
            <span className="size-1.5 rounded-full bg-alert" /> Verify · runs in this tab
          </p>
          <h1 className="font-serif text-[clamp(2.6rem,6vw,4.5rem)] leading-[0.95] tracking-[-0.02em]">Is this video what they say it is?</h1>
          <p className="mt-5 text-lg leading-relaxed text-muted">
            Keyframes, faces blurred, metadata, Content Credentials, reverse-search shortcuts, and with a Claude key: where it was filmed,
            what time the sun says, and whether the weather matches.
          </p>
        </div>
        <BrowserVerify />
      </main>
      <SiteFooter />
    </>
  );
}
