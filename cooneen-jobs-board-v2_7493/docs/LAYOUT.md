# Layout engine and responsive strategy

The display is designed to be read from 2–10 m on screens from a 1280 × 720 TV to a 4K wall, in landscape or portrait, and also to
sit inside a 360 px SharePoint web part. It does this with **one scale unit and a small amount of arithmetic**, not with a
pile of breakpoints.

## 1. One scale unit: the design pixel

Everything in `app.css` is sized in **design pixels**, written `calc(var(--d) * N)`. `stage.js` sets `--d` (one design pixel as a real
length) from the space the display actually has:

| Mode | 1 design px = | Intended canvas |
|---|---|---|
| wall, kiosk, carousel, hero | `min(width, height) / 1080` | a 1080-px-high screen, in either orientation |
| widget | `max(0.72, min(width / 460, height / 520))` | a ~460 × 520 panel |
| ticker | `min(height / 120, width / 1000)` | a 120-px-high strip |

(`--d` is kept between 0.2 and 6.) So a 4K screen and a 1080p screen of the same shape look identical, just sharper, and a
portrait screen scales from its **shorter** side, so text is never tiny because the screen is tall.

`fontscale` multiplies the text on top of this (`--fs`). Measured sizes at the defaults (real data):

| Display | Vacancy title | Facts (location, department …) |
|---|---|---|
| Wall / kiosk, 1920 × 1080 | 52 px (4.9 % of the screen height) | 25 px |
| Wall / kiosk, 1080 × 1920 portrait | 53 px (4.9 % of the screen *width*) | 25 px |
| Wall / kiosk, 3840 × 2160 | 105 px (same proportions) | 50 px |
| Carousel, 1920 × 1080 | up to 104 px (114 px in kiosk mode) | 32 px |
| Hero, 1920 × 1080 | up to 132 px | 40 px |
| Widget, 420 × 560 | 35 px heading | 23 px vacancy names, 17 px details |

These are maximums: a very long title is shrunk to fit (see section 4). **Check the real screen from the real viewing distance** and
adjust with `fontscale` (`?fontscale=1.3`) – the right size depends on the screen's physical size, which no web page can know.

## 2. Orientation and rotation

- `orientation=auto` compares the stage's width and height: wider than tall = landscape. `landscape` / `portrait` force it.
  `data-orientation` on the stage drives the portrait variants in the CSS (a stacked header, a stacked feature slide …).
- `rotate=90|180|270` turns the whole stage with a CSS transform about its corner and slides it back into view. The stage swaps its
  own width and height first, so a landscape screen with `rotate=90` is laid out as a portrait display of the right size. Everything
  downstream (layout, QR sizing) simply sees the swapped dimensions.
- `resize` and `orientationchange` are debounced (120 ms) and the mode re-lays itself out. A screen that is rotated while running
  recovers on its own.

## 3. The wall layout engine (`layout.js`)

`computeWallLayout({ n, areaW, areaH, gap, orientation, columns, rows, cardsize, qr, fontscale })` is pure arithmetic and is unit-tested.

**Choosing the grid**

| | small | medium (default) | large |
|---|---|---|---|
| Landscape (cols × rows) | 4 × 3 | 3 × 2 | 2 × 1 |
| Portrait | 3 × 4 | 2 × 3 | 1 × 2 |
| Landscape with QR | 3 × 2 | 2 × 2 | 2 × 1 |
| Portrait with QR | 2 × 4 | 1 × 3 | 1 × 2 |

- `columns` and/or `rows` override the table. With only `columns`, the rows are chosen so cards keep a sensible shape
  (aspect ≈ 1.45 landscape / 1.0 portrait; ≈ 2.2 / 1.9 with QR).
- With `fontscale` above 1.2 the **automatic** grid is divided by `fontscale` (fewer, bigger cards), so larger text has room. If you
  set `columns` yourself, you keep your grid and the text is shrunk just enough to fit.
- With QR on, each card gets a QR stub beside its text, so the automatic grids are wider and shorter.

**Pages**

- If there are more vacancies than `cols × rows`, they are shown on several pages, split **as evenly as possible**
  (13 vacancies over 3 pages is 5 + 4 + 4, never 6 + 6 + 1).
- Every card on every page has the same size, so nothing jumps when pages change.
- Few vacancies get fewer, bigger cards, capped at 1.45 × the nominal size, and centred, so one vacancy does not become a giant card.
- The card scale `c` = the smaller of `cardW / 520` and `cardH / 380` (the card is designed in a 520 × 380 box, 700 × 380 with QR).
  All text inside the card is sized from `c`.

`main.js` re-runs the engine whenever the data, the window or the font changes, and **rebuilds the page only when something visible
changed**.

## 4. Fitting text into cards (`components.js`)

CSS alone cannot know how long a vacancy title is, so after the DOM is built the display measures it:

1. **Title** – a title that does not fit its three lines is shrunk on **its own card only** (down to 60 %), so an unusually long title
   does not make the whole board small. A title that still needs more than three lines at 60 % (an 80-character title in a four-column wall, for example) is
   cut with an ellipsis; the screen-reader list, the carousel and the hero always carry the full title.
2. **Card** – if the content of any card runs past its content area (into the padding where the dashed border is), the text on **all** cards
   of the page shrinks by the same factor (down to 40 %), so cards stay consistent with each other.
3. **QR stub** – if text still cannot fit, the QR stubs are dropped (readable text matters more) and step 2 repeats.

The feature slide (carousel, hero) fits the same way: the label card first, then the title; the QR code is hidden only when it
would no longer be scannable (below 2.4 device pixels per module).

Refitting is repeated once the web font arrives (`document.fonts` `loadingdone`), because Nunito is slightly wider than the fallback.

## 5. Mode by mode

| Mode | Structure | Behaviour |
|---|---|---|
| wall / kiosk | header · grid of cards · footer (paging bar, status, optional buttons) | pages through the grid every `rotation` s |
| carousel | header · one vacancy as a large title with a label card (facts, timing, optional QR) · footer | next vacancy every `rotation` s, cross-fade |
| hero | "NOW HIRING" kicker and brand · very large title · facts · QR | one vacancy, automatic or `?job=` |
| widget | heading · count / New / Closing soon / Featured chips · compact list of `rows` vacancies · footer | links to the vacancy page; shows "+N more" |
| ticker | label · continuous scrolling strip | constant speed whatever the number of vacancies (`speed`) |

The footer has a **fixed height** and the kiosk footer is a thin paging bar, so the room above it never changes when a status
message appears.

## 6. Responsive strategy in short

- **One codebase, no breakpoints.** There are no `@media` width rules. A scale unit plus the layout engine adapts to every size.
- **Space decides the layout, not the device name.** The same page serves a 3840 × 2160 TV, a 1080 × 1920 portrait screen, a
  420 × 560 intranet panel and a 1920 × 120 strip.
- **Fixed footprint, flexible content.** Headers and footers have fixed heights; the middle takes what is left, is measured, and
  text shrinks to fit rather than overflowing.
- **Predictable extremes.** Very small widgets reduce the list and drop the chips (`rows` that fit are shown, then "+N more");
  very long titles shrink individually; extreme settings (for example `columns=5` on a portrait screen) produce small text *by
  design* – the display does what the address says.
- **Verified sweep.** The layout was exercised in a real browser across 26 mode × screen-size combinations (1920 × 1080, 1080 × 1920,
  1280 × 720, 3840 × 2160, 800 × 1280, widgets from 300 × 400 to 800 × 300, tickers from 3840 × 200 to 600 × 80) with 1, 5, 13 and 24
  vacancies, plus option variants (QR on, large and small `fontscale`, fixed columns, compact density …), every theme × language
  and every rotation. The automated check fails on any console error, any element outside the screen, clipped or overflowing text, a
  title that does not fit, or text under 9 px. See [SIGNAGE.md](SIGNAGE.md) for what was and was not verified.
