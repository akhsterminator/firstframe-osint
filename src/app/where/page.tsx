import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { SceneBuilder } from "@/components/where/SceneBuilder";
import { pageMeta } from "@/lib/web/meta";

export const metadata = pageMeta({
  title: "Describe a scene. Find everywhere on Earth it fits.",
  description: "A church by a roundabout, a bridge over a river: pick what you can see and FirstFrame searches OpenStreetMap for every place where the whole scene fits.",
  og: "where",
  path: "/where/",
});

export default function WherePage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 pt-14">
        <p className="eyebrow mb-5 flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-alert" /> Where · no sign-up, no key
        </p>
        <h1 className="max-w-4xl font-serif text-[clamp(2.6rem,6.5vw,5rem)] leading-[0.94] tracking-[-0.02em]">
          Describe a scene. Find everywhere on Earth it fits.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
          Pick what&rsquo;s visible in the footage and how close together it is. FirstFrame turns that into an OpenStreetMap query and
          plots every match. Then check each one in Street View.
        </p>
        <div className="mt-12">
          <SceneBuilder />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
