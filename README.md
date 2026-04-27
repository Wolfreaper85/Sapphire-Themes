# Sapphire Themes

Visual theme manager for [Sapphire AI](https://github.com/Wolfreaper85) with bundled animated themes, a one-click visual picker, per-theme settings, and auto-detection of external theme plugins.

## Bundled themes

Eight themes ship in the box, each with a custom CSS palette plus a Canvas 2D animated background:

| Theme | Vibe |
|-------|------|
| 🟢 **Matrix** | Classic green digital rain. The original. |
| 🔵 **JARVIS** | Iron Man HUD holographics, blue circuitry, scanline overlays |
| 🔴 **Iron Man** | Helmet HUD with combat system overlays in red and gold |
| 🌌 **Cosmos** | Solar system in motion — orbital paths, planetary glow |
| 🗺️ **Marauder** | Marauder's Map ink-on-parchment, footprints crossing the screen |
| 🕸️ **Nexus** | Network nodes pulsing connections across the background |
| 🌈 **Prism** | Refracted light rain, color spectrum splash |
| 🎨 **Custom** | Blank canvas to roll your own |

Each theme has its own settings (animation speed, intensity, color tweaks) accessible from the picker.

## Features

- **Visual picker** — preview-driven theme selection from one place
- **Animated backgrounds** — Canvas 2D rendering, GPU-friendly when idle, pauses when window unfocused
- **Per-theme settings** — tune intensity, speed, color overlays without editing CSS
- **Custom SVG nav icons** per theme (matching art direction across the UI)
- **Auto-detection of external themes** — install a theme plugin like Sapphire-Lattice, and the picker discovers it automatically
- **Lightweight** — themes load on demand; only the active one runs animations

## Installation

Drop the `sapphire-themes` folder into your Sapphire `plugins/` directory and restart Sapphire. The theme picker becomes available in Settings → Appearance → Themes.

## Requirements

- [Sapphire AI](https://github.com/Wolfreaper85)
- A modern browser running Sapphire's web UI (Canvas 2D + ES6 modules)

## How it works

```
Sapphire UI loads
        │
        ▼
   sapphire-themes/main.js
        │
        ├─ Registers BUNDLED_THEMES (matrix, jarvis, ironman, ...)
        ├─ Queries /api/webui/plugins for external theme plugins
        │     └─ Any plugin with `themes` capability gets added to the picker
        ├─ Reads user's saved theme preference
        └─ Applies CSS + spawns Canvas 2D background script
        ▼
   USER picks a different theme via picker
        │
        ├─ Tear down previous theme (CSS unload, Canvas script cleanup)
        ├─ Apply new theme's CSS + spawn its background script
        └─ Persist choice to user settings
```

## Adding your own theme as a separate plugin

The plugin auto-detects any other plugin that exposes themes through Sapphire's plugin metadata. Minimum shape for an external theme plugin:

```
my-theme-plugin/
├── plugin.json         (declare a "themes" capability)
└── web/
    ├── my-theme.css
    └── my-theme-bg.js  (Canvas 2D background script)
```

When loaded, your theme appears alongside the bundled ones in the picker. No fork of `sapphire-themes` needed.

The reference implementation for an external theme is [Sapphire-Lattice](https://github.com/Wolfreaper85) — it bundles a single theme using the same architecture and ships separately so users only install what they want.

## Theme structure (bundled)

Each bundled theme lives in `web/themes/<name>/`:

```
themes/matrix/
├── matrix.css           Color palette, font styling
└── matrix-rain.js       Canvas 2D animation script
```

The CSS sets the page's color scheme; the JS draws the animated background to a `<canvas>` layer behind the UI.

## Performance notes

- **Animations pause when the window loses focus** (no wasted GPU on background tabs)
- **Canvas 2D, not WebGL** — broader compatibility, low memory, predictable performance even on integrated graphics
- **Themes load lazily** — switching themes only loads the new theme's assets; previous theme is fully unloaded
- **Custom theme is a near-zero-cost option** if you want minimal animation overhead

## License

AGPL-3.0 (matches Sapphire core; bundled themes inherit)

## Author

Built by [Sapphire Community](https://github.com/Wolfreaper85) with contributions from Wolfreaper85 and Claude.
