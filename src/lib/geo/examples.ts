import { PRESETS, presetFeature } from "./presets";
import type { SceneQuery } from "./share";

const p = (id: string, fid: string) => presetFeature(PRESETS.find((x) => x.id === id)!, fid);

/** Starter hunts for the scene-search page. Each is small enough for public Overpass servers. */
export const EXAMPLES: SceneQuery[] = [
  {
    title: "A lighthouse within 300 m of a church",
    features: [p("lighthouse", "a"), p("church", "b")],
    relations: [{ from: "a", to: "b", maxDistanceM: 300 }],
    area: { kind: "country", value: "PT", label: "Portugal" },
  },
  {
    title: "A castle on a river, with a railway station nearby",
    features: [p("castle", "a"), p("river", "b"), p("station", "c")],
    relations: [
      { from: "a", to: "b", maxDistanceM: 150 },
      { from: "a", to: "c", maxDistanceM: 800 },
    ],
    area: { kind: "subdivision", value: "GB-WLS", label: "Wales" },
  },
  {
    title: "A Ferris wheel by the sea",
    features: [p("ferris_wheel", "a"), p("coastline", "b")],
    relations: [{ from: "a", to: "b", maxDistanceM: 250 }],
    area: { kind: "country", value: "FR", label: "France" },
  },
  {
    title: "A mosque beside a roundabout and a petrol station",
    features: [p("mosque", "a"), p("roundabout", "b"), p("fuel", "c")],
    relations: [
      { from: "a", to: "b", maxDistanceM: 150 },
      { from: "b", to: "c", maxDistanceM: 150 },
    ],
    area: { kind: "country", value: "BA", label: "Bosnia and Herzegovina" },
  },
];
