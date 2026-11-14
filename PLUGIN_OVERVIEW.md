## What you get

- A live backdrop behind the whole window, from the top of the conversation to under the composer. The first scene is Cloud Drift: ASCII clouds drifting across a bright sky while birds flap past. It can switch BB to light mode while it shows, has a reading veil for legibility, and can be held still.
- Your own image as a soft haze at the top of New thread and every conversation. It fades into the theme colour before it reaches the text.
- Six effects, taken from MonoCode: None, Dither, ASCII, Halftone, Scanlines and Haze. You choose whether the background shows in all sessions or only in empty chats, and set its visibility (5 to 65%) for each.
- Per-project backgrounds. A project can have its own image and settings; other projects use the global background.
- Window glass. The same image, blurred, sits behind the whole window, with a see-through sidebar and main pane. Sidebar opacity, blur radius and main pane glass are adjustable. Glass works in the dark theme only.

## How it works

Open **Settings → Haze** and pick a backdrop scene, or an image. The command palette (Mod+Shift+P) also has *Haze: Cloud Drift backdrop* and *Haze: Turn the backdrop off*. The page resizes it to 2560 px WebP before upload. The image and settings stay in a local SQLite database on your BB server. **Reset to defaults** restores the global settings, glass and image; remove a project background from its own section.

Haze draws with CSS on BB's own panels, so a BB update that renames those panels can break the layout until Haze is updated.

## Requirements

- Turn off Aura (`bb plugin disable aura`) while Haze is on; both draw on the same panels.
- No account, network service or extra install.
- Based on [MonoCode](https://github.com/hardbeat920/monocode) (MIT).
