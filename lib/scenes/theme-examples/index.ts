import { SVG_SCENES, type SvgSceneId } from "../../scene-catalog";
import type { SceneDefinition } from "../types";
import { auroraSvg, deepWaterSvg, emberSvg } from './classic'
import { blueprintSvg } from './blueprint'
import { brailleStarsSvg } from './braille-stars'
import { departureBoardSvg } from './departure-board'
import { ditherDunesSvg, ditherDunesNightSvg } from './dither-dunes'
import { halftoneDawnSvg, halftoneDuskSvg } from './halftone-dawn'
import { honuLagoonSvg } from './honu-lagoon'
import { koiMosaicSvg } from './koi-mosaic'
import { nightReefSvg } from './night-reef'
import { paperGardenSvg, paperGardenKraftSvg } from './paper-garden'
import { plotterTideSvg, plotterTideNightSvg } from './plotter-tide'
import { snowPinesSvg } from './snow-pines'
import { teletextCloudsSvg } from './teletext-clouds'
import { vectorRangeSvg } from './vector-range'

const sources = {
  "honu-lagoon": honuLagoonSvg,
  "koi-mosaic": koiMosaicSvg,
  "halftone-dawn": halftoneDawnSvg,
  "halftone-dusk": halftoneDuskSvg,
  "plotter-tide": plotterTideSvg,
  "plotter-tide-night": plotterTideNightSvg,
  "dither-dunes": ditherDunesSvg,
  "dither-dunes-night": ditherDunesNightSvg,
  "paper-garden": paperGardenSvg,
  "paper-garden-kraft": paperGardenKraftSvg,
  "night-reef": nightReefSvg,
  "snow-pines": snowPinesSvg,
  "braille-stars": brailleStarsSvg,
  "teletext-clouds": teletextCloudsSvg,
  "vector-range": vectorRangeSvg,
  "departure-board": departureBoardSvg,
  "blueprint": blueprintSvg,
  "deep-water": deepWaterSvg,
  "aurora": auroraSvg,
  "ember": emberSvg,
} satisfies Record<SvgSceneId, () => string>;

export const themeExamples: SceneDefinition[] = SVG_SCENES.map((scene) => ({
  kind: "svg",
  id: scene.id,
  label: scene.label,
  description: { light: scene.description, dark: scene.description },
  base: { light: scene.base, dark: scene.base },
  scheme: scene.scheme,
  twin: scene.twin,
  source: sources[scene.id],
}));
