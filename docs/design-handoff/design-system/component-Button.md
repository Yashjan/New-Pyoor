# Button

Pill-shaped actions in three weights: primary, secondary and text link.

- **Primary** (`py-btn py-btn--primary`): `button-bg` / `button-ink`, so navy on ivory and gold on navy. One per screen: "Add to bag", "Shop the salts", "Checkout".
- **Secondary** (`py-btn py-btn--secondary`): transparent with a `hairline-strong` outline.
- **Text link** (`py-link`): Manrope 500 with a 1px `accent-line` underline that withdraws on hover.
- **Unavailable**: when a product has no price yet, show a disabled button labelled "Price coming soon", never a primary button that does nothing.

Rules: at least 48px tall (44px for links), sentence-case labels of 1 to 3 words, no icons except an arrow on outbound links, and a 2px `accent-line` focus ring offset 3px. Use real `<a>` for navigation and `<button>` for actions.
