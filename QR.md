# QR code implementation

`?qr=1` adds a **"Scan to apply"** QR code to each vacancy that has an application link; `?qr=0` removes it. Default: on in hero mode,
off elsewhere (the wall, carousel and kiosk show it when you ask for it).

## What the code contains

The vacancy's own application link as produced by `/api/jobs` (`job.url`), for example
`https://cooneensgroup1.talosats-careers.com/Apply/<token>?i=<token>`. Nothing else: no tracking address, no redirect service, no
third party sees a scan. The browser re-checks the link before using it: only `https://` on
`cooneensgroup1.talosats-careers.com`, no user name or password in it. A vacancy without a valid link simply shows no QR code.

## The encoder (`assets/js/qr.js`)

There is no QR library to download or trust: the display includes its own small encoder written from ISO/IEC 18004 (Model 2),
about 540 lines with no dependencies and no DOM access.

- **Byte mode** (UTF-8), versions 1–40, the smallest version that fits is chosen automatically
- **Error correction M** (about 15 % damage tolerated) – a good balance for a screen, where damage is rare but pixels are few
- Reed-Solomon over GF(256), block interleaving, all eight masks scored with the four penalty rules and the best one kept,
  BCH-protected format and version information
- Real vacancy links are 144–146 characters, which is **version 8** (49 × 49 modules)

`qrToPath()` turns the module matrix into **one SVG path** (a run of horizontal bars per row), so a code is a single small
element, scales perfectly to any screen and needs no image file, canvas or `innerHTML`.

Codes are cached per link (maximum 200) so rotating pages does not re-encode them.

## Appearance and size

- Always **black on white** with a **quiet zone of 4 modules** (the margin the standard requires), whatever the theme. A QR on a dark
  background with inverted colours is not read by every phone, so the code is a white tile even in the dark and high-contrast themes.
- `shape-rendering: crispEdges`, so modules stay sharp at every size.
- Sizes, in design pixels (see [LAYOUT.md](LAYOUT.md)): hero **360**, carousel label card **240** (230 in portrait), wall card **150 × card
  scale × fontscale**. On a 1080-pixel-high screen the hero code is a third of the screen height.
- **A code is never drawn too small to scan.** If a code would be below **2.4 device pixels per module** (counting the quiet zone),
  it is hidden instead of shown unreadable. On the wall the text is protected first (small cards lose the QR stub before the text gets
  tiny), and the hidden codes are counted in `?diag=1` (`qrHidden`).
- Each code has an accessible name ("Scan to apply: <title>") and a visible caption in the chosen language.

### Reading distance

A phone reads a code from about **ten times its width**. On a 55-inch screen the hero code is roughly 23 cm wide (about 2 m reading
distance) and a wall-card code roughly 10 cm (about 1 m). Use the hero, or a carousel with `qr=1`, for screens people view from further
back, and `fontscale` to make everything bigger.

## Verification

- **Unit test** (`tests/unit.mjs`): the real vacancy links encode, produce a well-formed path, and an over-long input is refused.
- **Decode test** (done in a real browser during development, not shipped): the code was rendered exactly as the display draws it
  (hero at 1080p, 720p, 4K, portrait, rotated 90°, and at device pixel ratio 2; carousel and wall in landscape and portrait; kiosk),
  each QR element was screenshotted, and the picture was decoded by an **independent decoder (OpenCV)**.
  **22 of 22 decoded to exactly the vacancy link** using OpenCV's ArUco-based detector; OpenCV's older default detector decoded 20 of 22
  (it is known to be weaker at locating higher-version codes; the same pictures decode with the other detector).
- **Not done:** scanning with real phones from real distances, and confirming that the Talos link opens the right vacancy. The link
  comes from the unchanged `buildVacancyUrl()` in `jobs.js`, which prefixes the site address to the route Talos supplies; the captured
  data does not show how Talos itself completes that link. **After deploying, scan one QR code (or click one vacancy in the widget) and
  confirm it opens the right vacancy.** If it does not, the fix is one line in `buildVacancyUrl()`; the QR code follows automatically.
