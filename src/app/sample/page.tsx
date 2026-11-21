import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { ReportView } from "@/components/report/ReportView";
import { sampleReport } from "@/lib/sample";
import { pageMeta } from "@/lib/web/meta";

export const metadata = pageMeta({
  title: "Sample report",
  description: "A full FirstFrame report on an illustrative clip: earliest copy, map search, sun, weather and tampering signals.",
  og: "home",
  path: "/sample/",
});

export default function SamplePage() {
  const report = sampleReport();
  report.frames = report.frames.map((f) => ({ ...f, url: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/sample/hero.jpg` }));
  return (
    <>
      <SiteHeader />
      <main>
        <ReportView initial={report} staticCardBase="/sample/card" />
      </main>
      <SiteFooter />
    </>
  );
}
