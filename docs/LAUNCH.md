# Launch kit

Code doesn't spread on its own. This is the plan for getting FirstFrame in front of the people who'll use it and share it.

## 1. Before anyone sees it (30 minutes)

These matter more than any feature. A visitor decides in about five seconds.

- [ ] **Make `main` the default branch.** Create `main` from the current branch, set it as default under Settings → Branches, and delete the old branch. Visitors shouldn't land on a branch called anything else.
- [ ] **Turn on the live site.** Settings → Pages → Source: **GitHub Actions**. The `Deploy site` workflow publishes on every push to `main`. Check https://akhsterminator.github.io/firstframe-osint/ loads.
- [ ] **Repo sidebar.** Description: `Everyone shared it. Nobody checked. Check any viral video in your browser: when it was posted, where it was filmed, whether the sun and weather match.` Website: the Pages URL.
- [ ] **Topics:** `osint` `verification` `fact-checking` `disinformation` `misinformation` `geolocation` `openstreetmap` `overpass` `journalism` `tiktok` `video-forensics` `c2pa` `nextjs` `claude`
- [ ] **Social preview.** Settings → General → Social preview → upload `docs/img/social-preview.png`. This is the image people see when the repo link is shared.
- [ ] **Pin the repo** on your profile and add a profile README line: "Building FirstFrame, open-source video verification."
- [ ] **One real case.** Pick a recycled clip that was debunked publicly (by Full Fact, AFP Fact Check, Reuters or BBC Verify). Run it through FirstFrame, check every finding against the published debunk, and record your screen. Never present a finding you haven't confirmed yourself.

## 2. The formula

Every post follows the same shape, because it's a satisfying reveal:

> **Everyone shared this video. I put it through my tool…** → reveal → how the tool knew → link.

The best moment is when a fake is trending *right now*. Keep the Pages link handy; `/when/?u=<the viral post's link>` is a ready-made reply.

Rules that keep it credible (and keep you hireable):

- Show the evidence on screen, not just the verdict. The card is designed for this.
- Say what the tool *can't* tell you. "Posted in 2019" is not "filmed in 2019".
- Never target a person. Blur stays on, and you're debunking a claim, not a poster.
- Link the original fact-check if one exists, and credit it.

## 3. Short video (TikTok, Reels, Shorts), 30–40 seconds

**Hook (0–3s), face to camera or the viral clip playing:**
"This video has 4 million views and everyone says it's from last night. Watch."

**Beat 1 (3–12s), screen recording of When:**
Paste the link. The date lands. "Every TikTok link secretly contains the second it was posted. This one? June 2022."

**Beat 2 (12–25s), Verify or Where:**
"And it wasn't even filmed in [claimed place]. The tool read the signs and road markings, searched the map, and found the bridge… here." Cut to Street View.

**Payoff (25–35s), the card:**
"Weather records say it was pouring that day. The video is sunny. It's free, it's open source, link in bio."

Series idea: one feature per video ("the TikTok link trick", "finding a place from a church and a roundabout", "the sun doesn't lie", "the weather doesn't lie").

## 4. X / Bluesky / Threads thread

1. Every TikTok, X and Instagram link contains the exact second it was posted. Editing the caption can't change it. I built a free tool that reads it: [link to /when] 🧵
2. Paste a link, get the time. Paste every repost you can find and they line up oldest first. That's how you trace a "breaking" clip back to 2019. [GIF]
3. Then the fun part: describe what's visible in the video (a church, a roundabout, a river within 200 m) and it finds every place on Earth where that scene fits, using OpenStreetMap. [screen recording]
4. Drop the video itself and it blurs faces, reads the metadata, checks the sun angle against the claimed date and the weather against historical records. Everything runs in your browser; nothing is uploaded.
5. It's built to verify events, not people: no face recognition, no people search, and it shows signals, not verdicts. Open source: [repo]

## 5. Hacker News (Show HN)

**Title:** `Show HN: FirstFrame – check when and where a viral video was really filmed`

**First comment:**

> I kept seeing "breaking news" clips that turned out to be years old or from another country. Newsroom verification desks catch these by hand, moving frames through five or ten tools. FirstFrame chains the steps, and runs in the browser.
>
> The bit I find most fun: TikTok, X, Instagram, Bluesky and Mastodon IDs all embed a timestamp, so a link alone tells you when it was posted, to the second. The /when page decodes them and shows which bits are the clock.
>
> The other piece is the map search. You (or Claude, with your own key) list visible features as OpenStreetMap tags with distances between them, and it compiles an Overpass query that walks back up the feature graph, so only places where the whole scene fits survive. The query is shown with a link to Overpass Turbo.
>
> Deliberate limits: no face recognition (faces are detected only to be blurred, on-device), no people search, and findings are signals with confidence, not verdicts. Happy to talk about the Overpass compilation, the post-ID formats, or where it gets things wrong.

Post on a weekday morning US Eastern time. Reply to every comment for the first few hours.

## 6. Communities

Read each community's self-promotion rules first, and lead with what's useful, not with the repo.

| Where | Angle |
|---|---|
| r/OSINT | The Overpass compiler and the post-ID decoder, as tools for their workflow |
| r/geoguessr | "Describe a scene, find everywhere it fits". Share a hunt link as a challenge |
| r/journalism, r/Journalism | Free verification for small newsrooms; the limits section |
| r/webdev, r/nextjs | Same TypeScript pipeline in Node and the browser; ONNX face detection in the browser; Satori cards |
| Bellingcat community Discord (tool-sharing channel) | Ask for failure cases |
| OSINT newsletters (e.g. Sector035's *Week in OSINT*) | Short submission with the GIF |
| Product Hunt | After HN, with the card images |
| Lobsters (`osint`, `privacy` tags) | Technical write-up of the post-ID formats |

## 7. A write-up that keeps working

A blog post titled **"Every TikTok link contains the second it was posted"** explaining the ID formats (with the bit diagrams) is the kind of thing that gets linked for years and sends steady traffic to the tool. Put it on your site and cross-post to dev.to.

## 8. After launch

- Turn every "it got this wrong" report into a test and say thanks publicly.
- Post a short changelog clip each time a feature ships ("now it reads the sun").
- Track what people actually paste into /when and /where (the site has no analytics; add a privacy-respecting one like Plausible if you want numbers).
