# Hollowmere Garden

Promo site for a woodland garden that is open all year. It is one page with no build step.

## What's on the page

- **Hero:** the background is a bare branch. When the cursor moves near it, moss creeps along the bark and wildflowers open around the cursor, then fade back to bare wood behind it. Light mode uses the day pictures and dark mode uses the night ones.
- **Sections:** Seasons (a month picker), The grounds (six areas with walking times), a full-screen interlude, Visit (hours and tickets), Membership and Journal, followed by the footer.
- **Navigation:** a fixed top bar with links to each section and a light/dark toggle. On phones it opens as a full-screen menu.
- **Motion:** headings drop in line by line, pictures grow into place as you scroll, and the interlude opens out to full screen. A ticker shows what's in flower this week. With reduced motion turned on, all of this becomes simple fades.
- **Scrolling:** the Daybook scroll engine. Mouse-wheel scrolling glides smoothly, nav links glide to their section, and the highlighted nav link and the address bar follow the section on screen.

All names, prices and copy are placeholders. Every image placeholder is labelled with the photo it needs and its aspect ratio.

## Files

- `index.html`: the markup and CSS.
- `assets/hero.js`: the WebGL2 moss reveal, with a 2D canvas fallback.
- `assets/site.js`: the theme toggle, menu, month picker, scroll motion and the scroll engine.
- `assets/bare.jpg`, `assets/mossy.jpg`, `assets/mask.png`: the day picture pair. In the mask, the red channel marks moss and the green channel marks flower heads.
- `assets/night-*.jpg`, `assets/night-mask.png`: the night picture pair.

## Run it locally

Open it through a local web server, not as a file. Browsers block WebGL from reading images loaded from `file://`.

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```
