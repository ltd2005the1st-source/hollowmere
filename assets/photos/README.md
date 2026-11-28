# Photos

The finished section photos, generated from the project's image prompt list on 2026-11-27. Each was cropped to drop the generator's sparkle mark in the bottom-right corner, then sized for the web (portraits 1080×1350, squares 1200, the lead story 1800×1200, the interlude 2400 wide, the map 1600×1280). All 20 are listed in `PHOTOS` in `assets/site.js`.

To replace one, keep its file name.

| File | Where it shows | Ratio |
|---|---|---|
| `month-01.jpg` … `month-12.jpg` | Seasons, the arched picture beside the month list | 4:5 |
| `grounds-map.jpg` | The grounds map. Area labels and the walking routes are drawn over it in the browser; their positions are in `index.html` (`.pin` and `data-pd`) | 5:4 |
| `north-wall.jpg` | The full-screen interlude | about 2:1 |
| `visit-gate.jpg` | Visit, the arched picture between the four figures | 4:5 |
| `member-meadow.jpg` | Membership, the tall arched picture | 4:5 |
| `member-card.jpg` | Membership, the small square | 1:1 |
| `journal-hands-moss.jpg` | Journal, the lead story | 3:2 |
| `journal-snowdrops.jpg`, `journal-ice-lilies.jpg` | Journal, the two smaller stories | 1:1 |

A slot whose name is not in `PHOTOS` falls back to a stand-in from `assets/stand/`.

The arched slots (months, gate, meadow) cut off the top corners, so keep the subject in the middle and lower part of the frame.

To see every slot's label at once, open the page with `?chips` at the end of the address.
