# Contributing

Thanks for helping. A few things make contributions easy to accept.

## The most useful contribution: a failure case

If FirstFrame got a video wrong, [open a "wrong result" issue](https://github.com/akhsterminator/firstframe-osint/issues/new?template=wrong-result.yml) with the link and what's actually true. Failure cases become regression tests, and they're how the checks get better.

## Setup

```bash
pnpm install
cp .env.example .env.local
pnpm doctor
pnpm dev
```

You need Node 22, ffmpeg and (for links) yt-dlp. Nothing else is required to run the tests:

```bash
pnpm lint
pnpm test
pnpm build:static
```

Tests never call external services. Each stage takes its dependencies as arguments, so tests pass in stubs (see `tests/pipeline.test.ts`).

## Where things live

| Path | What |
| --- | --- |
| `src/lib/pipeline/run.ts` | Orchestrates the stages |
| `src/lib/ingest` | URL parsing, post-ID timestamps, yt-dlp |
| `src/lib/media` | Keyframes, hashing, face blurring |
| `src/lib/provenance` | Reverse search providers, page dating, timeline |
| `src/lib/vision` | The scene-reading prompt and schema |
| `src/lib/geo` | Overpass compiler, ranking, Nominatim |
| `src/lib/chrono`, `src/lib/weather` | Sun position, weather comparison |
| `src/lib/integrity` | C2PA, metadata, detector signals |
| `src/lib/card` | The shareable cards (Satori), used by server and browser |
| `src/lib/web` | Browser-only code: frames from a video element, ONNX Runtime Web face blur, MP4 metadata, BYOK Claude |
| `src/components/{when,where,verify}` | The three tools on the static site |
| `src/app/**/*.server.ts(x)` | Server-only routes, left out of the static build |

There are two builds. `pnpm build` is the self-hosted server. `pnpm build:static` is the browser-only site in `out/`; it ignores `*.server.*` files, so anything in a page or component must work without Node. Shared code in `src/lib` must not import Node built-ins unless it's server-only.

## Adding a reverse-search provider

Implement `Provider` from `src/lib/provenance/hits.ts` and add it to `defaultProviders()`. Return every hit with whatever date the service gives you; dating and merging happen downstream.

## Ground rules

FirstFrame verifies events, not individuals. Pull requests that add face recognition, face or person search, account profiling, licence-plate reading or anything else that identifies or tracks people will be closed, however they're framed.

Findings are signals with confidence, never verdicts. New checks should say how strong their evidence is and what would make them wrong.
