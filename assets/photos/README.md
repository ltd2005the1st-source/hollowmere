# Photos

The finished section photos, generated from the project's image prompt list on 2026-11-27. Each one is here twice: an AVIF, which most browsers load, and a WebP for browsers that cannot read AVIF. The page asks for both through `<picture>`, so each visitor downloads only one.

`tools/make-photos.py` builds them from the original PNGs: it crops off the generator's sparkle mark in the bottom-right corner, cuts each photo to its slot's shape, and sizes it to what a sharp (2x) screen needs for that slot. To replace a photo, put the new original in a folder, point the script at it (`python3 tools/make-photos.py <folder> month-05`) and keep the slot name. All 20 slots are listed in `PHOTOS` in `assets/site.js`.

| Slot | Where it shows | Size |
|---|---|---|
| `month-01` … `month-12` | Seasons, the arched picture beside the month list | 1080×1350 |
| `grounds-map` | The grounds map. Area labels and the walking routes are drawn over it in the browser; their positions are in `index.html` (`.pin` and `data-pd`) | 1600×1280 |
| `north-wall` | The full-screen interlude | 2400 wide |
| `visit-gate` | Visit, the arched picture between the four figures | 1080×1350 |
| `member-meadow` | Membership, the tall arched picture | 1080×1350 |
| `member-card` | Membership, the small square | 640×640 |
| `journal-hands-moss` | Journal, the lead story | 1800×1200 |
| `journal-snowdrops`, `journal-ice-lilies` | Journal, the two smaller stories | 480×480 |

A slot whose name is not in `PHOTOS` falls back to a stand-in from `assets/stand/`.

The arched slots (months, gate, meadow) cut off the top corners, so keep the subject in the middle and lower part of the frame.
