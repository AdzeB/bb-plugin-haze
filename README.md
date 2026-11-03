# Haze

MonoCode's chat background for BB. Your image appears as a soft haze at the top
of New thread and every conversation and fades into the theme colour before it
reaches the text. Messages never sit on top of the picture, so the plugin needs
no opaque reading column.

Open **Settings → Haze** to choose an image (resized on the client to 2560 px
WebP) and set:

- **Effect:** Haze (MonoCode's gradient blur and scanlines) or Plain (the faded image only)
- **Show on:** Everywhere, or New thread only
- **Strength:** separate opacity for New thread and conversations (MonoCode's default is 24%)

Turn Aura off while Haze is on (`bb plugin disable aura`). Both plugins draw on the same panels.

## How it works

- `app.tsx` mounts an app overlay that writes the saved background to `<html>`:
  `data-haze` plus three CSS variables. It also renders the settings page.
- `app.css` draws everything with `::before`/`::after` on BB's
  `#root-compose-main-panel` and `#thread-detail-timeline-panel`. It adds no DOM
  nodes, observers or canvases. The masks come from MonoCode's `src/styles/index.css`.
- `server.ts` stores the settings and one image in the plugin's SQLite database
  and serves the image at `/api/v1/plugins/haze/http/image?v=<version>`.

The CSS depends on BB's DOM: those two panel ids, plus `[data-page-scroll-viewport]`,
`[data-scroll-attached]` and the thread header. Recheck them after a BB upgrade.

```sh
npm install --include=dev
bb plugin build . && bb plugin install . --yes
```
