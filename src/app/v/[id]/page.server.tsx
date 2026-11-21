import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { ReportView } from "@/components/report/ReportView";
import { loadReport, publicReport } from "@/lib/server/reports";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const report = await loadReport(id);
  if (!report) return { title: "Report not found" };
  const top = report.findings[0];
  const title = top?.title ?? "Verification report";
  const image = `/api/reports/${id}/card?format=og&v=${Date.parse(report.updatedAt)}`;
  return {
    title,
    description: top?.detail ?? "Provenance, geolocation, time and tampering checks for a viral video.",
    openGraph: { title, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, images: [image] },
    robots: report.sample ? undefined : { index: false },
  };
}

export default async function ReportPage({ params }: Props) {
  const { id } = await params;
  const report = await loadReport(id);
  if (!report) notFound();
  return (
    <>
      <SiteHeader />
      <main>
        <ReportView initial={publicReport(report)} />
      </main>
      <SiteFooter />
    </>
  );
}
