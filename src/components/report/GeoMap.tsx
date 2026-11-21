"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoCandidate } from "@/lib/types";
import { asset } from "@/lib/web/paths";

const STYLE = process.env.NEXT_PUBLIC_MAP_STYLE ?? "https://tiles.openfreemap.org/styles/positron";
// Optional imagery layer, e.g. your own or a licensed provider's XYZ tiles. Off unless configured.
const SATELLITE = process.env.NEXT_PUBLIC_SATELLITE_TILES;
const SATELLITE_ATTRIBUTION = process.env.NEXT_PUBLIC_SATELLITE_ATTRIBUTION ?? "Imagery";

export interface Bounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export default function GeoMap({
  candidates,
  selected,
  onSelect,
  onBounds,
  initialView,
}: {
  candidates: GeoCandidate[];
  selected?: string;
  onSelect: (id: string) => void;
  onBounds?: (b: Bounds, zoom: number) => void;
  initialView?: { lat: number; lon: number; zoom: number };
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<import("maplibre-gl").Map | null>(null);
  const lib = useRef<typeof import("maplibre-gl") | null>(null);
  const markers = useRef<Map<string, import("maplibre-gl").Marker>>(new Map());
  const [ready, setReady] = useState(false);
  const [satellite, setSatellite] = useState(false);
  const boundsCb = useRef(onBounds);
  boundsCb.current = onBounds;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const maplibre = await import("maplibre-gl");
      if (cancelled || !el.current) return;
      maplibre.setWorkerUrl(asset("/vendor/maplibre-gl-worker.mjs"));
      lib.current = maplibre;
      const m = new maplibre.Map({
        container: el.current,
        style: STYLE,
        center: initialView ? [initialView.lon, initialView.lat] : [10, 30],
        zoom: initialView?.zoom ?? 1.4,
        attributionControl: { compact: true },
      });
      m.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
      const report = () => {
        const b = m.getBounds();
        boundsCb.current?.({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() }, m.getZoom());
      };
      m.on("moveend", report);
      m.on("load", () => {
        if (SATELLITE) {
          m.addSource("satellite", { type: "raster", tiles: [SATELLITE], tileSize: 256, attribution: SATELLITE_ATTRIBUTION });
          m.addLayer({ id: "satellite", type: "raster", source: "satellite", layout: { visibility: "none" } });
        }
        report();
        setReady(true);
      });
      map.current = m;
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      markers.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !m.getLayer("satellite")) return;
    m.setLayoutProperty("satellite", "visibility", satellite ? "visible" : "none");
  }, [satellite, ready]);

  useEffect(() => {
    const m = map.current;
    const maplibre = lib.current;
    if (!m || !maplibre || !ready) return;
    for (const mk of markers.current.values()) mk.remove();
    markers.current.clear();
    candidates.forEach((c, i) => {
      const node = document.createElement("button");
      node.type = "button";
      node.className = "flex size-7 items-center justify-center rounded-full border-2 border-white font-mono text-[11px] font-medium text-white shadow-lg";
      node.style.background = i === 0 ? "#ff5b3d" : "#2a2925";
      node.textContent = String(i + 1);
      node.setAttribute("aria-label", c.label);
      node.addEventListener("click", () => onSelect(c.id));
      markers.current.set(c.id, new maplibre.Marker({ element: node }).setLngLat([c.lon, c.lat]).addTo(m));
    });
    if (candidates.length === 1) m.flyTo({ center: [candidates[0]!.lon, candidates[0]!.lat], zoom: 14, duration: 800 });
    else if (candidates.length > 1) {
      const b = new maplibre.LngLatBounds();
      candidates.forEach((c) => b.extend([c.lon, c.lat]));
      m.fitBounds(b, { padding: 60, maxZoom: 14, duration: 800 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, ready]);

  useEffect(() => {
    const c = candidates.find((x) => x.id === selected);
    if (c && map.current) map.current.flyTo({ center: [c.lon, c.lat], zoom: 17, duration: 900 });
  }, [selected, candidates]);

  return (
    <div className="relative h-full w-full">
      <div
        ref={el}
        className={`h-full w-full ${satellite ? "" : "[&_.maplibregl-canvas]:[filter:invert(0.92)_hue-rotate(180deg)_saturate(0.6)]"}`}
      />
      {SATELLITE && (
      <button
        type="button"
        onClick={() => setSatellite((s) => !s)}
        className="absolute bottom-3 left-3 rounded-full border border-white/20 bg-ink/80 px-3 py-1.5 text-xs text-text backdrop-blur hover:bg-ink"
      >
        {satellite ? "Map" : "Satellite"}
      </button>
      )}
    </div>
  );
}
