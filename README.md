# Hollowmere Garden

Promo site for a woodland garden that is open all year. It is one page with no build step.

## What's on the page

- **Intro:** a dark curtain with the wordmark lifts away, on a curve, once the hero pictures have loaded (shorter on repeat visits in the same session).
- **Hero:** the background is a bare branch. When the cursor moves near it, moss creeps along the bark and wildflowers open around the cursor, then fade back to bare wood behind it. Light mode uses the day pictures and dark mode uses the night ones. The headline stands up letter by letter. As you scroll, a pale reading sheet with rounded corners slides over the hero while it sinks and darkens.
- **Opening statement:** a large paragraph whose words light up as you scroll, with small photo pills set into the line.
- **Seasons:** twelve months in a list beside an arched photo. Picking a month wipes the new photo up from the bottom of the arch.
- **The grounds:** a drawn map of the six areas that sketches itself in. Picking an area in the list lights it up and walks a dot along the path from the gate.
- **Interlude:** a photo that opens from a small arched window to the full screen, with the quote lighting up word by word.
- **In flower this week:** a big moving line of plant names that speeds up and leans with your scroll.
- **Visit:** four figures linked by hairlines to an arched photo of the gate, then two panels: opening hours with a live open/closed status and a day timeline (UK time), and a ticket with a counter and running total.
- **Membership:** a dark band that rises with a domed top, a membership card that tilts toward the pointer, and a checklist that draws its ticks.
- **Journal:** a lead story with a "Read" tag that follows the pointer, and two smaller stories.
- **Footer:** on screens where it fits, the page lifts away to show it, and a full-width wordmark stands up letter by letter.
- **Section breaks:** hand-drawn stems with leaves that grow across the page as you scroll past.
- **Scrolling:** the Daybook scroll engine. Mouse-wheel scrolling glides smoothly, nav links glide to their section, and the highlighted nav link and the address bar follow the section on screen. The nav gathers into a floating capsule past the hero.
- **Reduced motion:** every reveal becomes a plain fade or shows at once, and nothing moves on scroll.

All names, prices and copy are placeholders.

## Photos

Every picture slot shows a stand-in cut from the hero photography (`assets/stand/`) until its real photo exists. Hover a picture to see which file it is waiting for, or add `?chips` to the address to see them all. The file names and how to switch a slot over are in `assets/photos/README.md`; the prompts for generating them are in the project's image prompt list.

## Files

- `index.html`: the markup and CSS.
- `assets/hero.js`: the WebGL2 moss reveal, with a 2D canvas fallback.
- `assets/site.js`: the intro, theme toggle, menu, text and photo reveals, month picker, map, stems, marquee, opening hours, ticket counter, member card, footer and the scroll engine. The `PHOTOS` list at the top says which real photos are in place.
- `assets/stand/`: stand-in pictures cut from the hero photography.
- `assets/photos/`: where the finished section photos go.
- `assets/bare.jpg`, `assets/mossy.jpg`, `assets/mask.png`: the day picture pair. In the mask, the red channel marks moss and the green channel marks flower heads.
- `assets/night-*.jpg`, `assets/night-mask.png`: the night picture pair.

## Run it locally

Open it through a local web server, not as a file. Browsers block WebGL from reading images loaded from `file://`.

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```
