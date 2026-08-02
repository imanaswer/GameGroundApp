# Onboarding photography

`welcome.jpg` is the full-bleed background of the welcome screen (`app/onboarding.tsx`).

## What is currently shipped

A floodlit cricket ground at night, from Unsplash (free for commercial use, no attribution
required — credit is courteous, not mandatory).

| | |
|---|---|
| Photo ID | `photo-1540747913346-19e32dc3e97e` |
| Source | `https://unsplash.com/photos/1540747913346-19e32dc3e97e` |
| Delivered | `?w=1080&h=2340&fit=crop&crop=entropy&q=78&fm=jpg&bri=-30&con=6&sat=-8` |
| Size | 214 KB |

**The `bri=-30` is not a style choice — it is a contrast fix.** Ungraded, the floodlight sits
directly behind the white brand mark and measures **3.4:1**, below the WCAG AA minimum of 4.5.
Grading to `-30` lifts the worst case to **6.05:1**. (`-22` was the first passing value at 5.1;
`-30` was taken for headroom and because the darker grade suits the screen.)

## Replacing it

Keep the filename `welcome.jpg` and nothing else has to change.

| Spec | Value |
|---|---|
| Aspect | Portrait, ≥ 9:19.5 (cropped `cover` — the centre survives, edges may not) |
| Size | ~1080×2340; larger only grows the bundle |
| Exposure | **Dark.** White copy and a white mark sit over the lower half |
| Subject | Off-centre, upper two-thirds — the bottom third is under the scrim |

## Verify contrast after swapping — do not skip this

`gradient.welcomeScrim` darkens the bottom third, which makes almost any photo *look* fine at a
glance. It is not a substitute for measuring. The band that fails first is the one behind the
**brand mark** (~55–62% of screen height), because it sits highest, where the scrim is weakest.

Measure the brightest backdrop pixel under each text band and require ≥ 4.5:1 against white.
The body copy renders at 86% opacity, so its effective contrast is below the raw figure.
