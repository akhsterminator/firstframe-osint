"use client";

import { useEffect, useRef } from "react";
import type { GeoCandidate } from "@/lib/types";

const STYLE = process.env.NEXT_PUBLIC_MAP_STYLE ?? "https://tiles.openfreemap.org/styles/positron";

export default function GeoMap({ candidates, selected, onSelect }: { candidates: GeoCandidate[]; selected?: string; onSelect: (id: string) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<import("maplibre-gl").Map | null>(null);
  const markers = useRef<Map<string, import("maplibre-gl").Marker>>(new Map());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const maplibre = await import("maplibre-gl");
      if (cancelled || !el.current) return;
      maplibre.setWorkerUrl("/vendor/maplibre-gl-worker.mjs");
      const m = new maplibre.Map({
        container: el.current,
        style: STYLE,
        center: candidates[0] ? [candidates[0].lon, candidates[0].lat] : [0, 20],
        zoom: candidates[0] ? 13 : 1.5,
        attributionControl: { compact: true },
      });
      m.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
      map.current = m;

      candidates.forEach((c, i) => {
        const node = document.createElement("button");
        node.type = "button";
        node.className =
          "flex size-7 items-center justify-center rounded-full border-2 border-white font-mono text-[11px] font-medium text-white shadow-lg transition";
        node.style.background = i === 0 ? "#ff5b3d" : "#2a2925";
        node.textContent = String(i + 1);
        node.setAttribute("aria-label", c.label);
        node.addEventListener("click", () => onSelect(c.id));
        markers.current.set(c.id, new maplibre.Marker({ element: node }).setLngLat([c.lon, c.lat]).addTo(m));
      });

      if (candidates.length > 1) {
        const b = new maplibre.LngLatBounds();
        candidates.forEach((c) => b.extend([c.lon, c.lat]));
        m.fitBounds(b, { padding: 60, maxZoom: 14, duration: 0 });
      }
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      markers.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates]);

  useEffect(() => {
    const c = candidates.find((x) => x.id === selected);
    if (c && map.current) map.current.flyTo({ center: [c.lon, c.lat], zoom: 16, duration: 900 });
    for (const [id, mk] of markers.current) {
      const n = mk.getElement();
      n.style.transform = `${n.style.transform.replace(/ scale\([^)]*\)/, "")}${id === selected ? " scale(1.25)" : ""}`;
    }
  }, [selected, candidates]);

  return <div ref={el} className="h-full w-full [&_.maplibregl-canvas]:[filter:invert(0.92)_hue-rotate(180deg)_saturate(0.6)]" />;
}
