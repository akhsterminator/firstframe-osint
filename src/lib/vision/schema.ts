import { z } from "zod";

const confidence = z.enum(["low", "medium", "high"]);

export const SceneSchema = z.object({
  summary: z.string().describe("Two or three sentences on what the footage shows and where it was likely filmed."),
  clues: z.array(
    z.object({
      kind: z.enum(["text", "road", "architecture", "infrastructure", "vegetation", "terrain", "vehicle", "landmark", "other"]),
      description: z.string(),
      frameIndex: z.number().int(),
      confidence,
      text: z.string().nullable().describe("Exact legible text, if this clue is text."),
      script: z.string().nullable().describe("Writing system, e.g. Latin, Cyrillic, Arabic."),
      language: z.string().nullable(),
    }),
  ),
  regions: z.array(
    z.object({
      name: z.string(),
      countryCode: z.string().describe("ISO 3166-1 alpha-2, upper case."),
      subdivisionCode: z.string().nullable().describe("ISO 3166-2 code if you can narrow it, e.g. GB-ENG, US-CA, otherwise null."),
      reasoning: z.string(),
      confidence,
    }),
  ),
  features: z.array(
    z.object({
      id: z.string().describe("Short id such as a, b, c."),
      label: z.string(),
      tagSets: z.array(z.array(z.object({ key: z.string(), value: z.string().nullable() }))),
      name: z.string().nullable(),
      rarity: z.enum(["common", "uncommon", "rare"]),
    }),
  ),
  relations: z.array(z.object({ from: z.string(), to: z.string(), maxDistanceM: z.number() })),
  sky: z.object({
    sunVisible: z.boolean(),
    shadowsVisible: z.boolean(),
    shadowRatio: z.number().nullable(),
    shadowRatioConfidence: confidence,
    shadowNotes: z.string().nullable(),
    precipitation: z.enum(["none", "rain", "snow", "unknown"]),
    ground: z.enum(["dry", "wet", "snow", "unknown"]),
    cloudCover: z.enum(["clear", "partly", "overcast", "unknown"]),
    daylight: z.enum(["day", "twilight", "night", "unknown"]),
    foliage: z.enum(["leafy", "bare", "mixed", "unknown"]),
  }),
  anomalies: z.array(
    z.object({
      observation: z.string(),
      frameIndex: z.number().int(),
      severity: z.enum(["minor", "notable", "strong"]),
    }),
  ),
});

export type SceneOutput = z.infer<typeof SceneSchema>;
