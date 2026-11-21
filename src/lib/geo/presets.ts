import type { MapFeature, OsmTag } from "../types";

export interface Preset {
  id: string;
  label: string;
  group: "Faith" | "Roads" | "Water" | "Rail & air" | "Landmarks" | "Brands" | "Everyday";
  tagSets: OsmTag[][];
  rarity: MapFeature["rarity"];
}

const t = (key: string, value: string | null = null): OsmTag => ({ key, value });

/**
 * Things people can actually see in footage, tagged the way OpenStreetMap
 * mappers usually tag them. Alternatives cover common tagging variations.
 */
export const PRESETS: Preset[] = [
  { id: "church", label: "Church", group: "Faith", rarity: "uncommon", tagSets: [[t("amenity", "place_of_worship"), t("religion", "christian")], [t("building", "church")]] },
  { id: "mosque", label: "Mosque", group: "Faith", rarity: "uncommon", tagSets: [[t("amenity", "place_of_worship"), t("religion", "muslim")], [t("building", "mosque")]] },
  { id: "temple", label: "Hindu or Buddhist temple", group: "Faith", rarity: "uncommon", tagSets: [[t("amenity", "place_of_worship"), t("religion", "hindu")], [t("amenity", "place_of_worship"), t("religion", "buddhist")]] },
  { id: "synagogue", label: "Synagogue", group: "Faith", rarity: "rare", tagSets: [[t("amenity", "place_of_worship"), t("religion", "jewish")]] },
  { id: "roundabout", label: "Roundabout", group: "Roads", rarity: "common", tagSets: [[t("junction", "roundabout")]] },
  { id: "motorway", label: "Motorway", group: "Roads", rarity: "common", tagSets: [[t("highway", "motorway")]] },
  { id: "traffic_signals", label: "Traffic lights", group: "Roads", rarity: "common", tagSets: [[t("highway", "traffic_signals")]] },
  { id: "pedestrian_bridge", label: "Footbridge", group: "Roads", rarity: "uncommon", tagSets: [[t("bridge", null), t("highway", "footway")], [t("man_made", "bridge"), t("highway", "footway")]] },
  { id: "road_bridge", label: "Road bridge", group: "Roads", rarity: "uncommon", tagSets: [[t("bridge", null), t("highway", null)]] },
  { id: "tunnel", label: "Road tunnel", group: "Roads", rarity: "uncommon", tagSets: [[t("tunnel", "yes"), t("highway", null)]] },
  { id: "fuel", label: "Petrol station", group: "Roads", rarity: "common", tagSets: [[t("amenity", "fuel")]] },
  { id: "river", label: "River", group: "Water", rarity: "uncommon", tagSets: [[t("waterway", "river")]] },
  { id: "canal", label: "Canal", group: "Water", rarity: "uncommon", tagSets: [[t("waterway", "canal")]] },
  { id: "coastline", label: "Coastline", group: "Water", rarity: "uncommon", tagSets: [[t("natural", "coastline")]] },
  { id: "beach", label: "Beach", group: "Water", rarity: "uncommon", tagSets: [[t("natural", "beach")]] },
  { id: "harbour", label: "Harbour or marina", group: "Water", rarity: "uncommon", tagSets: [[t("leisure", "marina")], [t("harbour", "yes")], [t("landuse", "harbour")]] },
  { id: "pier", label: "Pier", group: "Water", rarity: "rare", tagSets: [[t("man_made", "pier")]] },
  { id: "lighthouse", label: "Lighthouse", group: "Water", rarity: "rare", tagSets: [[t("man_made", "lighthouse")]] },
  { id: "rail", label: "Railway line", group: "Rail & air", rarity: "common", tagSets: [[t("railway", "rail")]] },
  { id: "station", label: "Railway station", group: "Rail & air", rarity: "uncommon", tagSets: [[t("railway", "station")], [t("public_transport", "station"), t("train", "yes")]] },
  { id: "tram", label: "Tram tracks", group: "Rail & air", rarity: "uncommon", tagSets: [[t("railway", "tram")]] },
  { id: "level_crossing", label: "Level crossing", group: "Rail & air", rarity: "uncommon", tagSets: [[t("railway", "level_crossing")]] },
  { id: "runway", label: "Airport runway", group: "Rail & air", rarity: "rare", tagSets: [[t("aeroway", "runway")]] },
  { id: "castle", label: "Castle or fort", group: "Landmarks", rarity: "rare", tagSets: [[t("historic", "castle")], [t("historic", "fort")]] },
  { id: "stadium", label: "Stadium", group: "Landmarks", rarity: "rare", tagSets: [[t("leisure", "stadium")], [t("building", "stadium")]] },
  { id: "tower", label: "Tall tower or mast", group: "Landmarks", rarity: "uncommon", tagSets: [[t("man_made", "tower")], [t("man_made", "mast")]] },
  { id: "water_tower", label: "Water tower", group: "Landmarks", rarity: "rare", tagSets: [[t("man_made", "water_tower")]] },
  { id: "wind_turbine", label: "Wind turbine", group: "Landmarks", rarity: "uncommon", tagSets: [[t("power", "generator"), t("generator:source", "wind")]] },
  { id: "pylon", label: "Power pylon", group: "Landmarks", rarity: "common", tagSets: [[t("power", "tower")]] },
  { id: "statue", label: "Statue or monument", group: "Landmarks", rarity: "uncommon", tagSets: [[t("historic", "monument")], [t("memorial", "statue")], [t("historic", "memorial")]] },
  { id: "fountain", label: "Fountain", group: "Landmarks", rarity: "uncommon", tagSets: [[t("amenity", "fountain")]] },
  { id: "ferris_wheel", label: "Ferris wheel", group: "Landmarks", rarity: "rare", tagSets: [[t("attraction", "big_wheel")]] },
  { id: "mcdonalds", label: "McDonald's", group: "Brands", rarity: "uncommon", tagSets: [[t("brand", "McDonald's")], [t("name", "McDonald's")]] },
  { id: "starbucks", label: "Starbucks", group: "Brands", rarity: "uncommon", tagSets: [[t("brand", "Starbucks")]] },
  { id: "shell", label: "Shell station", group: "Brands", rarity: "uncommon", tagSets: [[t("amenity", "fuel"), t("brand", "Shell")]] },
  { id: "lidl", label: "Lidl", group: "Brands", rarity: "uncommon", tagSets: [[t("brand", "Lidl")]] },
  { id: "ikea", label: "IKEA", group: "Brands", rarity: "rare", tagSets: [[t("brand", "IKEA")]] },
  { id: "supermarket", label: "Supermarket", group: "Everyday", rarity: "common", tagSets: [[t("shop", "supermarket")]] },
  { id: "hospital", label: "Hospital", group: "Everyday", rarity: "uncommon", tagSets: [[t("amenity", "hospital")]] },
  { id: "school", label: "School", group: "Everyday", rarity: "common", tagSets: [[t("amenity", "school")]] },
  { id: "park", label: "Park", group: "Everyday", rarity: "common", tagSets: [[t("leisure", "park")]] },
  { id: "pitch", label: "Sports pitch", group: "Everyday", rarity: "common", tagSets: [[t("leisure", "pitch")]] },
  { id: "parking", label: "Car park", group: "Everyday", rarity: "common", tagSets: [[t("amenity", "parking")]] },
];

export function presetFeature(p: Preset, id: string): MapFeature {
  return { id, label: p.label, tagSets: p.tagSets, name: null, rarity: p.rarity };
}

export function namedFeature(name: string, id: string): MapFeature {
  return { id, label: `“${name}”`, tagSets: [], name, rarity: "rare" };
}
