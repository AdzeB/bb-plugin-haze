# Haze

MonoCode's chat background and translucent window for BB. Your image appears as
a soft haze at the top of New thread and every conversation and fades into the
theme colour before it reaches the text. With window glass on, the same image,
blurred, sits behind the whole window the way the desktop shows through MonoCode.

Haze ports the look of [MonoCode](https://github.com/hardbeat920/monocode) to BB.
It was inspired by [Aura](https://github.com/MateoCerquetella/bb-plugins/tree/HEAD/plugins/aura)
and replaces it. It needs no account or network service: images stay in BB's
local plugin database.

Open **Settings → Haze** (images are resized on the client to 2560 px WebP):

- **Chat background:** image, **Effect** (None, Dither, ASCII, Halftone,
  Scanlines, Haze), **Show on** (all sessions or empty chats), and separate
  visibility for empty chats and sessions (5–65%, default 24%). These are
  MonoCode's names, ranges and defaults.
- **Window:** window glass, sidebar opacity (default 85%), blur radius (default
  24 px) and main pane glass (the workspace at 40%). Dark theme only, as in MonoCode.
- **Project backgrounds:** a project can have its own image and settings. Panes
  in the focused project use it; other projects use the chat background.
- **Reset to defaults.**

Turn Aura off while Haze is on (`bb plugin disable aura`). Both plugins draw on the same panels.

## How it works

- `app.tsx` mounts an app overlay that writes the focused project's background
  to `<html>` (`data-haze`, `data-haze-glass` and CSS variables), and renders
  the settings page.
- `lib/effects.ts` ports MonoCode's pixel effects to a Web Worker built from
  one function, cached per image, effect and theme.
- `app.css` draws with `::before`/`::after` on BB's `#root-compose-main-panel`
  and `#thread-detail-timeline-panel`, and on `body` for the window. The pane
  image is `background-attachment: fixed`, so split panes show slices of one
  picture lined up with the window glass. Masks come from MonoCode's `src/styles/index.css`.
- `server.ts` stores the global and per-project backgrounds in SQLite and serves
  images at `/api/v1/plugins/haze/http/image?t=<target>&v=<version>`.

The CSS depends on BB's DOM: those two panel ids, `[data-sidebar=…]`,
`[data-page-scroll-viewport]`, `[data-scroll-attached]`, `[data-scroll-footer]`
and the thread header. Recheck them after a BB upgrade.

## Install

```sh
bb plugin install https://github.com/AdzeB/bb-plugin-haze
```

From a checkout:

```sh
npm install --include=dev
npm run typecheck
bb plugin build . && bb plugin install . --yes
```

## License and credits

MIT, see [LICENSE](LICENSE). The pixel effects (`lib/effects.ts`), the fade
masks in `app.css`, and the effect names, ranges and defaults are adapted from
MonoCode (MIT, Copyright (c) 2026 Nick); its notice is in [NOTICE](NOTICE).
Haze is not affiliated with MonoCode.
