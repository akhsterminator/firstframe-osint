import type { ChronolocationResult } from "@/lib/types";
import { localTime } from "@/lib/util/tz";
import { Empty } from "./ui";

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

export function SunChart({ data }: { data?: ChronolocationResult }) {
  if (!data) return <Empty>Needs a location and a date. Add a claimed date to test one.</Empty>;
  const W = 720;
  const H = 220;
  const pad = { l: 34, r: 12, t: 12, b: 26 };
  const pts = data.curve;
  const t0 = Date.parse(pts[0]?.t ?? data.date);
  const t1 = Date.parse(pts[pts.length - 1]?.t ?? data.date);
  const maxAlt = Math.max(30, Math.ceil((Math.max(...pts.map((p) => p.altitude), data.estimatedAltitude?.max ?? 0) + 5) / 10) * 10);
  const minAlt = -10;
  const x = (t: number) => pad.l + ((t - t0) / (t1 - t0 || 1)) * (W - pad.l - pad.r);
  const y = (a: number) => pad.t + ((maxAlt - a) / (maxAlt - minAlt)) * (H - pad.t - pad.b);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${x(Date.parse(p.t)).toFixed(1)},${y(p.altitude).toFixed(1)}`).join("");
  // The curve starts at local midnight, so three-hour steps land on whole hours.
  const hours = Array.from({ length: 9 }, (_, i) => t0 + i * 3 * 3_600_000).filter((t) => t <= t1 + 60_000);
  const est = data.estimatedAltitude;

  return (
    <div>
      <p className="mb-5 max-w-2xl text-[15px] leading-relaxed">{data.explanation}</p>
      <div className="overflow-x-auto rounded-xl border border-line bg-panel p-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[520px]" role="img" aria-label="Sun altitude over the day">
          {[0, 20, 40, 60, 80].filter((a) => a <= maxAlt).map((a) => (
            <g key={a}>
              <line x1={pad.l} x2={W - pad.r} y1={y(a)} y2={y(a)} stroke="var(--color-line)" strokeDasharray={a === 0 ? undefined : "2 4"} />
              <text x={pad.l - 8} y={y(a) + 3} textAnchor="end" className="fill-faint font-mono text-[10px]">{a}°</text>
            </g>
          ))}
          {est && (
            <rect x={pad.l} width={W - pad.l - pad.r} y={y(est.max)} height={Math.max(1, y(est.min) - y(est.max))} fill="var(--color-info)" opacity={0.12} />
          )}
          {data.windows.map((w, i) => (
            <rect key={i} x={x(Date.parse(w.start))} width={Math.max(2, x(Date.parse(w.end)) - x(Date.parse(w.start)))} y={pad.t} height={H - pad.t - pad.b} fill="var(--color-info)" opacity={0.18} />
          ))}
          <defs>
            <clipPath id="sun-plot">
              <rect x={pad.l} y={pad.t} width={W - pad.l - pad.r} height={H - pad.t - pad.b} />
            </clipPath>
          </defs>
          <path d={path} fill="none" stroke="var(--color-caution)" strokeWidth={2} clipPath="url(#sun-plot)" />
          {hours.map((t, i) => (
            <text key={i} x={x(t)} y={H - 8} textAnchor="middle" className="fill-faint font-mono text-[10px]">
              {localTime(t, data.timezone)}
            </text>
          ))}
        </svg>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 text-xs text-muted">
        <span className="font-mono">
          {data.date} · {data.timezone} · date from {data.dateBasis.replace("-", " ")}
          {data.sunrise && data.sunset && ` · sunrise ${localTime(data.sunrise, data.timezone)}, sunset ${localTime(data.sunset, data.timezone)}`}
        </span>
        {data.feasibleMonths.length > 0 && (
          <span className="flex items-center gap-1" title="Months when the sun can reach this height here">
            <span className="mr-2">Possible months</span>
            {MONTHS.map((m, i) => (
              <span key={i} className={`flex size-5 items-center justify-center rounded font-mono text-[10px] ${data.feasibleMonths.includes(i + 1) ? "bg-info/20 text-info" : "bg-raised text-faint"}`}>
                {m}
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
