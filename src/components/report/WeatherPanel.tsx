import type { WeatherResult } from "@/lib/types";
import { Empty, Pill } from "./ui";

export function WeatherPanel({ data }: { data?: WeatherResult }) {
  if (!data) return <Empty>Needs a location and a date to look up historical weather.</Empty>;
  const day = data.hourly.filter((h) => h.t.slice(0, 10) >= data.date.slice(0, 10)).slice(-24);
  const maxP = Math.max(1, ...day.map((h) => h.precipitation));

  return (
    <div>
      <p className="mb-5 max-w-2xl text-[15px] leading-relaxed">{data.headline}</p>
      {day.length > 0 && (
        <div className="rounded-xl border border-line bg-panel p-4">
          <div className="flex h-24 items-end gap-[3px]">
            {day.map((h) => (
              <div key={h.t} className="relative flex h-full flex-1 flex-col justify-end" title={`${h.t.slice(11, 16)} UTC · ${h.precipitation} mm · ${h.cloud}% cloud`}>
                <div className="absolute inset-x-0 top-0 rounded-sm bg-muted" style={{ height: 6, opacity: Math.max(0.08, h.cloud / 100) }} />
                <div className="rounded-sm bg-info" style={{ height: `${(h.precipitation / maxP) * 80}%`, minHeight: h.precipitation > 0 ? 2 : 0 }} />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between font-mono text-[10px] text-faint">
            <span>00 UTC</span>
            <span>cloud cover ▪ · precipitation ▮</span>
            <span>23 UTC</span>
          </div>
        </div>
      )}
      {data.checks.length > 0 && (
        <table className="mt-5 w-full text-sm">
          <thead>
            <tr className="eyebrow text-left">
              <th className="pb-2 font-normal">Check</th>
              <th className="pb-2 font-normal">In the frames</th>
              <th className="pb-2 font-normal">On record</th>
              <th className="pb-2 text-right font-normal">Result</th>
            </tr>
          </thead>
          <tbody>
            {data.checks.map((c, i) => (
              <tr key={i} className="border-t border-line/70 align-top">
                <td className="py-2.5 pr-3 capitalize">{c.aspect}</td>
                <td className="py-2.5 pr-3 text-muted">{c.observed}</td>
                <td className="py-2.5 pr-3 text-muted">{c.recorded}</td>
                <td className="py-2.5 text-right">
                  <Pill tone={c.result === "inconsistent" ? "alert" : c.result === "consistent" ? "ok" : "neutral"}>{c.result}</Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-4 font-mono text-[11px] text-faint">Source: {data.source}. Gridded data at roughly 10 km resolution; local showers can be missed.</p>
    </div>
  );
}
