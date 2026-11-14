// Scene metadata adapted from Anthropic theme-examples (Apache-2.0).
// Artwork and the upstream license live in scenes/theme-examples/.
export const SVG_SCENES = [
  {
    "id": "honu-lagoon",
    "label": "Honu Lagoon",
    "description": "A live ASCII lagoon from above: a tile turtle swims by a sand island",
    "scheme": "light",
    "base": "#e6fbff",
    "twin": null
  },
  {
    "id": "koi-mosaic",
    "label": "Koi Mosaic",
    "description": "A tiled koi pond from above: two koi, lily pads, slow ripples.",
    "scheme": "light",
    "base": "#eef8f1",
    "twin": null
  },
  {
    "id": "halftone-dawn",
    "label": "Halftone Dawn",
    "description": "A two-ink riso sunrise: halftone dots that breathe outward.",
    "scheme": "light",
    "base": "#f6ead9",
    "twin": "halftone-dusk"
  },
  {
    "id": "halftone-dusk",
    "label": "Halftone Dusk",
    "description": "The riso sunrise on night-blue stock: an ember sun in breathing dots.",
    "scheme": "dark",
    "base": "#1f2336",
    "twin": "halftone-dawn"
  },
  {
    "id": "plotter-tide",
    "label": "Plotter Tide",
    "description": "Pen-plotter tide lines drawing themselves on warm paper.",
    "scheme": "light",
    "base": "#f4efe4",
    "twin": "plotter-tide-night"
  },
  {
    "id": "plotter-tide-night",
    "label": "Plotter Tide, Night",
    "description": "The plotter's tide chart in pale ink on blue-black night paper.",
    "scheme": "dark",
    "base": "#141a27",
    "twin": "plotter-tide"
  },
  {
    "id": "dither-dunes",
    "label": "Dither Dunes",
    "description": "One-bit dunes on sand paper, shaded in dots, under a terracotta sun",
    "scheme": "light",
    "base": "#f1e8d6",
    "twin": "dither-dunes-night"
  },
  {
    "id": "dither-dunes-night",
    "label": "Dither Dunes Night",
    "description": "The same dunes after dark: pale dots on umber, an ember sun",
    "scheme": "dark",
    "base": "#1c1712",
    "twin": "dither-dunes"
  },
  {
    "id": "paper-garden",
    "label": "Paper Garden",
    "description": "Cut-paper leaves at the edges of a warm white sheet, one coral bloom.",
    "scheme": "light",
    "base": "#fbf6ec",
    "twin": "paper-garden-kraft"
  },
  {
    "id": "paper-garden-kraft",
    "label": "Paper Garden, Kraft",
    "description": "Cut-paper leaves at the edges of dark kraft paper, one coral bloom.",
    "scheme": "dark",
    "base": "#35312a",
    "twin": "paper-garden"
  },
  {
    "id": "night-reef",
    "label": "Night Reef",
    "description": "The lagoon after dark: a turtle and a ray that glow as they swim",
    "scheme": "dark",
    "base": "#0a1430",
    "twin": null
  },
  {
    "id": "snow-pines",
    "label": "Snow Pines",
    "description": "An ASCII pine forest at dusk, snow drifting down through the trees.",
    "scheme": "dark",
    "base": "#14143a",
    "twin": null
  },
  {
    "id": "braille-stars",
    "label": "Braille Stars",
    "description": "A slow night sky drawn dot by dot on a braille grid.",
    "scheme": "dark",
    "base": "#0a1430",
    "twin": null
  },
  {
    "id": "teletext-clouds",
    "label": "Block Clouds",
    "description": "Night clouds built from blocks on a teletext grid, drifting in",
    "scheme": "dark",
    "base": "#0d173f",
    "twin": null
  },
  {
    "id": "vector-range",
    "label": "Vector Range",
    "description": "Phosphor mountains on black; an amber beam keeps retracing them.",
    "scheme": "dark",
    "base": "#0e2f27",
    "twin": null
  },
  {
    "id": "departure-board",
    "label": "Departure Board",
    "description": "An amber LED board re-lettering itself, row by row.",
    "scheme": "dark",
    "base": "#1a120b",
    "twin": null
  },
  {
    "id": "blueprint",
    "label": "Blueprint",
    "description": "A cyanotype sheet; a comet goes round its plotted orbit in the corner.",
    "scheme": "dark",
    "base": "#0c2444",
    "twin": null
  },
  {
    "id": "deep-water",
    "label": "Deep Water",
    "description": "Light falling through deep water, and one quiet turtle",
    "scheme": "dark",
    "base": "#062c3a",
    "twin": null
  },
  {
    "id": "aurora",
    "label": "Aurora",
    "description": "Northern lights swaying over a dark ridge",
    "scheme": "dark",
    "base": "#14123a",
    "twin": null
  },
  {
    "id": "ember",
    "label": "Ember",
    "description": "A warm glow in the corners and a few embers rising",
    "scheme": "dark",
    "base": "#2a0d12",
    "twin": null
  }
] as const;

export type SvgSceneId = (typeof SVG_SCENES)[number]["id"];
