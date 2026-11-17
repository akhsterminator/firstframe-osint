import { describe, expect, it } from "vitest";
import { altitudeFromShadow, chronolocate, feasibleMonths, monthRange, sunAt } from "@/lib/chrono/sun";
import type { SkyReading } from "@/lib/types";

const sky: SkyReading = {
  sunVisible: true, shadowsVisible: true, shadowRatio: 0.8, shadowRatioConfidence: "medium", shadowNotes: null,
  precipitation: "none", ground: "dry", cloudCover: "clear", daylight: "day", foliage: "leafy",
};
const london = { lat: 51.5074, lon: -0.1278 };

describe("sun", () => {
  it("puts the June noon sun about 62° up in London", () => {
    const { altitude, azimuth } = sunAt(Date.parse("2024-06-21T12:02:00Z"), london.lat, london.lon);
    expect(altitude).toBeGreaterThan(61);
    expect(altitude).toBeLessThan(63);
    expect(azimuth).toBeGreaterThan(170);
    expect(azimuth).toBeLessThan(190);
  });

  it("turns shadow ratio into altitude with a band", () => {
    const est = altitudeFromShadow(1, "high");
    expect(est.value).toBeCloseTo(45, 5);
    expect(est.min).toBeLessThan(45);
    expect(est.max).toBeGreaterThan(45);
  });

  it("finds morning and afternoon windows", () => {
    const r = chronolocate({ ...london, date: "2024-06-21", dateBasis: "claim", timeZone: "Europe/London", sky });
    expect(r.verdict).toBe("consistent");
    expect(r.windows).toHaveLength(2);
    expect(r.feasibleMonths).toEqual([4, 5, 6, 7, 8]);
  });

  it("flags a sun that never gets high enough on the date", () => {
    const r = chronolocate({ ...london, date: "2024-12-21", dateBasis: "claim", timeZone: "Europe/London", sky });
    expect(r.verdict).toBe("inconsistent");
    expect(r.explanation).toContain("Apr–Aug");
  });

  it("stays inconclusive with no shadow", () => {
    const r = chronolocate({ ...london, date: "2024-06-21", dateBasis: "claim", timeZone: "Europe/London", sky: { ...sky, shadowRatio: null } });
    expect(r.verdict).toBe("inconclusive");
  });

  it("knows the southern hemisphere has summer in December", () => {
    expect(feasibleMonths(-33.87, 151.21, 70, 2024)).toEqual(expect.arrayContaining([12, 1]));
  });

  it("describes month ranges across the new year", () => {
    expect(monthRange([11, 12, 1, 2])).toBe("Nov–Feb");
    expect(monthRange([])).toBe("no month of the year");
  });
});
