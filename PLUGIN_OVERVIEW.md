## What you get

- A live backdrop behind the whole window, from the top of the conversation to under the composer. Choose from 21 scenes, including Honu Lagoon, Koi Mosaic, Paper Garden, Aurora and Cloud Drift. Cloud Drift has ASCII clouds drifting across a bright sky while birds flap past, or across a starry night under a crescent moon. Scenes start in their intended light or dark mode. Pick Light, Dark or Match BB; paired scenes switch artwork with the mode. Use a reading veil to keep text legible, or turn Motion off for a still image.
- Create your own backdrops from a starter template, an SVG upload or pasted SVG artwork. Preview and save the scene, then download or remove it from the gallery. CSS and SVG animations respect the Motion control and reduced motion.
- Your own image as a soft haze at the top of New thread and every conversation that fades into the theme colour before the text, or full screen behind the whole window.
- Six effects, taken from MonoCode: None, Dither, ASCII, Halftone, Scanlines and Haze. You choose whether the background shows in all sessions or only in empty chats, and set its visibility (5 to 65%) for each.
- Per-project backgrounds. A project can have its own image and settings; other projects use the global background.
- Window glass. The same image, blurred, sits behind the whole window, with a see-through sidebar and main pane. Sidebar opacity, blur radius and main pane glass are adjustable. Glass works in the dark theme only.

## How it works

Open **Settings → Haze** and pick a backdrop scene, or an image. The command palette (Mod+Shift+P) also has a command for every built-in scene and *Haze: Turn the backdrop off*. The page resizes chosen images to 2560 px WebP before upload. The image and settings stay in a local SQLite database on your BB server. **Reset to defaults** restores the global settings, glass and image; remove a project background from its own section.

Save up to 24 custom backdrops, each up to 1 MiB. Keep images and fonts embedded in the SVG. Scripts, embedded HTML and external assets are not supported. Custom backdrops stay after Reset to defaults.

Haze draws with CSS on BB's own panels, so a BB update that renames those panels can break the layout until Haze is updated.

## Requirements

- Turn off Aura (`bb plugin disable aura`) while Haze is on; both draw on the same panels.
- No account, network service or extra install.
- Based on [MonoCode](https://github.com/hardbeat920/monocode) (MIT).
- The 20 additional scenes come from Anthropic's [theme-examples](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/theme-examples), under Apache License 2.0.
