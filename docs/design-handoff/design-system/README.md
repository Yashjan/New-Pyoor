# Pyoor

Salt from Sambhar Lake, Rajasthan, presented like a premium international food brand. This is the design system for the Pyoor website: the rules every page, component and agent follows.

> **The idea in one line:** an ivory page, navy ink, a single gold thread, and the jar as the hero object. Calm, factual, unhurried. The green logo is the only green on the page.

## 1. Brand foundations

**Who we are.** Pyoor Global Enterprises packs edible salt on the shores of Sambhar Lake, India's largest inland salt lake. Launch products: **Herbal Black Salt** (काला नमक) and **Natural Lake Salt** (सफ़ेद नमक), in 1 kg clear PET jars. Himalayan Pink Salt stays hidden until its sourcing is confirmed.

**What premium means for Pyoor.**
- **One idea per screen.** Every screen makes one point and leaves room around it. If a screen needs two headings, it is two screens.
- **The product is an object.** The jar is shown floating, lit and alone, never in a grid of tiles with badges.
- **Origin over adjectives.** We name the place, the process and the ingredients. We never say "pure", "best" or "100%".
- **Quiet selling.** Price and "Add to bag" are always easy to find, never loud: no countdowns, discount banners, "best value" tags or stacks of trust badges.

## 2. Voice and content rules

- Short, factual sentences in plain English. Name things people recognise: chaat, nimbu pani, dal, raita.
- **No health, medicinal or nutritional claims.** Banned anywhere on the site, in alt text and in metadata: "aids digestion", "detox", "boosts immunity", "balances pH", "84 minerals", "100% natural", "chemical free", "pure" used as a claim.
- Taste and use are welcome: *"Sulphurous and tangy, with the distinct aroma of kala namak. Made for chaat, raita, fruit, chaas and nimbu pani."*
- Every page footer carries the FSSAI line: **"“Pyoor” is only a brand name and does not represent the true nature of the product."** plus FSSAI Lic. No. 12224999000443.
- Never invent reviews, ratings, stats or awards. Use marked placeholders such as `[PRICE]` until real values exist.
- **Hindi:** product names appear in Devanagari beside the English (काला नमक, सफ़ेद नमक). Use Devanagari for names and the odd single word, never for whole paragraphs mixed into English text.
- UI copy is sentence case: "Add to bag", "View bag", "Our story". Eyebrows and navigation are uppercase.

## 3. Colour

The palette comes from the jar label: ivory crest, navy band, gold rules. Green belongs to the logo alone.

| Role | Token | Ivory section | Navy section |
|---|---|---|---|
| Page ground | `surface` | ivory-100 `#f5f1e8` | navy-800 `#18214a` |
| Product band, drawer | `surface-alt` | ivory-200 `#ece5d6` | navy-900 `#121a3b` |
| Headlines, prices | `ink` | navy-800 | ivory-100 |
| Body text | `text` | slate-600 `#4f5670` | mist-300 `#b3b8cc` |
| Captions | `text-muted` | slate-500 `#5a6077` | `#9aa0b8` |
| Gold thread (lines, large text) | `accent-line` | gold-500 `#a8823f` | gold-300 `#cda75e` |
| Small gold text | `accent-text` | gold-700 `#7a5c26` | gold-300 |
| Primary button | `button-bg` / `button-ink` | navy / ivory | gold / navy |

**Rules**
- **Ivory is the default.** Use navy sections sparingly: the footer, the origin story, one immersive moment. Set `data-theme="navy"` on the section and every token flips.
- **Gold is a thread, not a fill.** Use it for 1px lines, the horizon rule, focus rings, underlines and text 24px or larger. Small gold text uses `accent-text` (gold-700 on ivory), because gold-500 is only 3.1:1 on ivory.
- **Green never appears outside the logo.** Not for buttons, success states, leaves or backgrounds. Confirmations use `success`, which is a working colour, not a brand colour.
- One primary (filled) button per screen. Everything else is a text link or an outline button.

## 4. Typography

| Family | Use | Never |
|---|---|---|
| **Cormorant Garamond** 500 (`--font-display`) | Headlines, section titles, product names | Below 28px; prices; buttons; body text |
| **Manrope** 400/500/600 (`--font-sans`) | Body, navigation, buttons, prices, forms, everything under 28px | Big headlines |
| **Tiro Devanagari Hindi** (`--font-deva`) | Hindi product names | Paragraphs |

- Load from Google Fonts: `Cormorant Garamond` (500, 500 italic), `Manrope` (400, 500, 600), `Tiro Devanagari Hindi` (400). With Next.js use `next/font/google`.
- Scale: display-xl 96 → display-l 64 → display-m 44 → display-s 32 (desktop). On phones (≤ 640px) step each down one level: the hero uses display-l (64px), section titles display-m (44px).
- Headlines are sentence case in Cormorant with `text-wrap: balance`. Uppercase only for eyebrows and navigation (Manrope, letter-spaced).
- Prices are always Manrope 600 with `font-variant-numeric: tabular-nums`.
- Running text stays within 62 characters per line (`measure`).

## 5. The gold thread

Pyoor's signature graphic device is one **1px gold horizon line**: the line where the white salt pans of Sambhar Lake meet the sky.
- It sits under the hero, runs across section breaks and underlines active navigation.
- Only ever one line at a time on screen, full-bleed or container-wide, `accent-line` at 70–100% opacity.
- It can draw itself in from left to right (duration-slow, ease-settle) the first time it enters the screen.
- Never a double line, a gradient line or a decorative flourish.

## 6. Logo

- Use the supplied artwork exactly: `assets/Logos/pyoor-logo.svg` (master) or `pyoor-logo.png`. **Never recolour, outline, gradient-map or add effects.**
- The logo always sits on ivory. On an ivory header, place it directly. On a navy header, place it on the **ivory crest**: a tab in `crest` colour with `radius-crest` on its bottom corners, padding space-2 vertical and space-4 horizontal, echoing the crest on the jar label.
- Minimum height: 32px on screen. Clear space: at least the height of the "P" on every side.
- Header: centred, 40–48px tall on desktop, 32–36px on phones.

## 7. Layout and space

- Container max 1280px; gutters 20px on phones and 48px on desktop.
- Section padding: space-8 (64px) on phones, space-10 (128px) on desktop. Before a signature moment, pause with space-12 (192px).
- Images and panels have square corners (`radius-none`). Buttons are pills. Inputs use `radius-s`.
- Prefer 1px `hairline` rules to boxes. No drop shadows except the cart drawer (`shadow-drawer`).
- Asymmetric two-column layouts (text 5 columns, object 7) feel more editorial than centred blocks; centre only the hero headline and section openers.

## 8. Imagery

- **The jar:** 3D renders from the Pyoor jar models, or studio photography on ivory or navy with soft side light. Always upright or deliberately tilted, never cropped through the label.
- **The place:** wide, quiet photographs and film of Sambhar Lake (salt pans at dawn and dusk, harvesting, hands). Warm, natural grading and real people at work. No stock photography.
- **The salt:** macro shots of crystals catching light.
- **Food:** simple Indian dishes (chaat, nimbu pani, dal, fruit) shot top-down or at 45° on stone, brass or linen. No props that tell a different story.
- Until photography exists, show a labelled placeholder ("Photo to shoot: …") in `surface-sunk`, never a stock image.

## 9. Motion

Slow, settled and purposeful. Nothing bounces, spins or flashes.
- Durations: `duration-fast` 180ms (hover), `duration-base` 450ms (drawers, text), `duration-slow` 900ms (reveals). Easing: `ease-settle` by default; `ease-inout` for scroll-scrubbed camera moves.
- Text reveals line by line (mask and rise 12–16px). Images settle with a slight scale from 1.04 to 1.
- Smooth scrolling (Lenis) on desktop. One orchestrated scroll moment per page, the jar on the home page, never several.
- `prefers-reduced-motion`: no scroll-scrubbing, no smooth scroll, fades only.

## 10. Components

| Component | What it is |
|---|---|
| **Button** | Pill. Primary (navy fill on ivory, gold fill on navy), secondary (outline), text link with a gold underline. |
| **Eyebrow** | Uppercase Manrope label in accent-text above a headline. |
| **Horizon** | The gold thread: a 1px full-width rule. |
| **ProductFeature** | The product as an object: jar render on one side, Hindi name, Cormorant name, one line of taste and use, price and "Add to bag" on the other. Used instead of grid cards. |
| **SiteHeader** | Navigation left, logo centred (on its crest on navy), search and bag right. |
| **Placeholder** | Labelled box for photography still to be shot. |

Build these with the tokens in this system. Class names in `components/bundle.css` are prefixed `py-`.

## 11. Accessibility

- Body and UI text at least 4.5:1 against its ground in both themes (checked: navy on ivory 13.8:1, slate 6.4:1, muted 5.5:1, gold-700 5.5:1; mist on navy 7.9:1, gold-300 on navy 6.9:1).
- Gold-500 on ivory is 3.1:1: lines and 24px+ text only.
- Every interactive element is a real `<a>` or `<button>`, at least 44px tall, with a visible 2px `accent-line` focus ring offset 3px.
- The logo's green measures 4.1:1 on ivory, which is fine for a logo; never set text in it.
