import type { OsmElement } from "@/lib/geo/overpass";

// A bridge over a river, a church and a roundabout in Bewdley, plus a lone
// roundabout 20 km away that should not survive.
export const ELEMENTS: OsmElement[] = [
  { type: "way", id: 1, center: { lat: 52.3766, lon: -2.3176 }, tags: { bridge: "yes", highway: "primary", name: "Bewdley Bridge" } },
  { type: "way", id: 2, center: { lat: 52.3768, lon: -2.3180 }, tags: { waterway: "river", name: "River Severn" } },
  { type: "way", id: 3, center: { lat: 52.3759, lon: -2.3150 }, tags: { amenity: "place_of_worship", religion: "christian", name: "St Anne's Church" } },
  { type: "node", id: 4, lat: 52.3779, lon: -2.3160, tags: { junction: "roundabout" } },
  { type: "node", id: 5, lat: 52.52, lon: -2.5, tags: { junction: "roundabout" } },
  { type: "way", id: 6, center: { lat: 52.6, lon: -2.1 }, tags: { man_made: "bridge" } },
];
