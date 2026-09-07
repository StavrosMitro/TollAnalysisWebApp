# Third-party visual assets

Every externally sourced image bundled with the frontend, with its provenance
and licence. Assets generated from the app itself (product screenshots) are
listed separately at the end.

---

## Photographs

### `front-end/src/assets/motorway-egnatia-1600.webp` and `motorway-egnatia-800.webp`

| | |
|---|---|
| **Subject** | The Egnatia Odos (A2) motorway near Asprovalta, Greece — real toll-road infrastructure with lane markings, central barrier and traffic. |
| **Source** | Wikimedia Commons — <https://commons.wikimedia.org/wiki/File:Egnatia_Odos.JPG> |
| **Original file** | <https://upload.wikimedia.org/wikipedia/commons/0/09/Egnatia_Odos.JPG> (2048×1536, taken 2009-08-18) |
| **Author** | Wikimedia Commons user *Murderdoll1122* |
| **Licence** | **Public domain** — "released into the public domain by the copyright holder". No attribution legally required; credited here as good practice. |
| **Modifications** | Cropped (foreground guardrail removed), resized to 1600 px / 800 px, re-encoded to WebP, EXIF stripped. The 800 px file is served to small viewports via `srcset`. |
| **Checks** | Real photograph (not generated). No readable licence plates. No unrelated brand logos or signage. |
| **Used on** | Landing page hero and login page visual panel (behind a dark navy overlay). |

The photograph documents real Greek infrastructure only. Its use does not imply
an affiliation with, endorsement by, or operation by any motorway company.

---

## Not used (explicitly excluded)

| File | Reason |
|---|---|
| `tolll.webp`, `tollll.webp` (was in `src/assets/`) | Visibly AI-generated — malformed toll signage, repeated structures, implausible geometry, artificial vehicles. Deleted. |
| `troll.jpg` (was in `src/assets/`) | Provenance and licence unknown. Deleted. |

No image was taken from Google Images, a stock-photo site, or any source without an explicit reusable licence.

---

## Product screenshots (generated from TollAnalysis itself)

These are captures of this application's own UI — no third-party rights involved.

| File | Capture | Shown on |
|---|---|---|
| `front-end/src/assets/shot-map.webp` | The Toll Map page (Leaflet + OpenStreetMap tiles), 253 stations clustered. | Landing hero, login visual panel |
| `front-end/src/assets/shot-overview.webp` | The Overview page (network glyph + headline metrics). | Project page |
| `front-end/src/assets/shot-analytics.webp` | The Traffic Analytics page with a By-operator result. | Landing capabilities section |

All three were captured from the production Docker build of this branch at
1200×760 (demo session), resized to 1200 px wide and encoded to WebP.

Map tiles are © OpenStreetMap contributors (ODbL); attribution is shown on the
map control as required.
