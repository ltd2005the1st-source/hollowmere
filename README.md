# Hollowmere Garden

Promo site for a garden that is open all year. So far it has the hero section only.

## The hero

The background is a bare branch. When the cursor moves near it, moss creeps along the bark and wildflowers open around the cursor. The growth follows the cursor and fades back to bare wood behind it.

- `index.html`: the whole hero (HTML, CSS, and a small WebGL2 shader, with no build step).
- `assets/bare.jpg`, `assets/mossy.jpg`: the two pictures, with the same framing.
- `assets/mask.png`: shows where the two pictures differ. The red channel marks moss and the green channel marks flower heads. The shader uses it so moss takes hold first and flowers open last.

On touch screens the growth drifts along the branch by itself, and visitors can drag a finger to move it. With reduced motion turned on, the page shows one still patch of moss. Browsers without WebGL2 get a simple soft reveal instead.

All names and copy (Hollowmere, est. 1911, 40 acres, opening hours) are placeholders.

## Run it locally

Open it through a local web server, not as a file. Browsers block WebGL from reading images loaded from `file://`.

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```
