# Art wanted

Everything below is a placeholder right now. Drop finished files in at the same path (or tell the dev the new filename).
Mood for the whole den: **an unassuming burrow outside, a psychedelic goblin & gnome workshop inside**. Think glowing mushrooms + acid rave, dark but funny, never actually scary (except The Fog).

| File | Where it shows | Size / format | Notes |
|---|---|---|---|
| `public/art/logo.svg` (+ `public/favicon.svg`) | Top bar, favicon | SVG, square-ish | Goblin wearing a gnome hat. Needs to read at 32px. |
| `public/art/hole.svg` | Home entrance, zoomed ~30× on scroll | SVG; it's zoomed as an image, so edges soften mid-zoom (fine) | Plain, earthy burrow mouth. **Centre must stay `#0d0b12`** so the zoom blends into the den. |
| Wooden signs (currently CSS) | Entrance: name sign, "ENTER ↓", Wishlist sign | SVG or PNG @2x, ~400×120 | Hand-carved, slightly crooked. |
| Burrow map (currently drawn in `src/pages/index.astro`) | Home, after entering | SVG preferred, 800×620 | Ant-farm cross-section. Rooms: Treasure Room, Crew Quarters, The Fog, Trust Me Bro, Front Door, Library (locked). |
| Room backdrops | Treasure Room, Crew Quarters, Front Door | WebP @2x, 2400×1400, dark, low detail behind text | Each room should feel like a different chamber of the same den. |
| Display-case interiors | Treasure Room exhibits | WebP @2x, 1200×900 (4:3) | One per game, in that game's own style (see below). |
| Crew avatars | `/crew` (set `avatar` in `src/data/crew.ts`) | PNG/WebP transparent, 280×280 | Each member as a psychedelic goblin or gnome. |
| Game key art | Game rooms (`/the-fog`, `/trust-me-bro`) | WebP @2x | From the game teams. |

## Game styles
- **The Fog**: 4-player co-op horror escape. Cold, desaturated blue-grey, thick drifting fog, flashlight glow.
- **Trust Me Bro**: multiplayer gambling/investing chaos. Casino neon, stock tickers, coins, unhinged energy.

## Game page assets
- Screenshots: placeholders in `public/art/games/<game>/shot-*.svg`. Replace them with real captures (WebP, 4:3) and update `screenshots` in `src/data/games.ts`. The captions are jokes in the game's voice.
- Trailer: set `trailer` (YouTube embed URL) in `src/data/games.ts`. It replaces the key-art placeholder.
- The Fog's hidden wall scrawls/handprints/figures are drawn in `src/pages/the-fog.astro`. An artist could redo them as SVGs.
