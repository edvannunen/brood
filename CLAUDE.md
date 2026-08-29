# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Brood** — a small page showing a few home videos of baking bread plus a photo carousel of
bread from over the years. Part of Ed's `bier-en-brood.nl` personal-projects family (see
`../Home` for the landing page that links out to all of them). Plain static site, no
framework, no build step:

```
index.html      # the page: banner, video grid, photo carousel
style.css       # layout — background/banner treatment matches ../Home's style.css
script.js       # carousel prev/next buttons (scrollIntoView-style smooth scroll, no library)
img/
  banner.png          # header banner (currently 1086x182 — Ed is actively tuning this asset,
                       #   check actual dimensions before assuming this is current)
  background.png       # tiled/cover page background
  brood-favicon.png    # site favicon (512x512), used via <link rel="icon">
  brood/                # the actual media
    broodbakken1-3.mp4    # bread-baking videos — shown on the page, compressed (see below)
    *.jpg                 # bread photos, shown in the carousel
    bretzels1-3.mp4, bretzels4.jpg   # pretzel media — present in the repo but NOT referenced
                                      # from index.html (parked "for now" per Ed, 2026-08-29;
                                      # not yet compressed either — do that before re-adding)
  brood_banner-achtergrond-groot.png    # gitignored — larger source version, not served
  brood_banner-achtergrondmiddel.png    # gitignored — medium source version, not served
  banner-groot - kopie.png              # gitignored — backup copy of an earlier banner, not served
```

Filenames under `img/brood/` were normalized to lowercase-kebab-case (no spaces) when the
repo was set up, since the originals (synced from Dropbox) had spaces and mixed case.

## Design

Reuses `../Home`'s visual language directly (same CSS custom properties — `--cream`,
`--ink`, `--orange`, Fraunces/Work Sans fonts):

```css
body{
  overflow-x:hidden;
  background:var(--cream) url(img/background.png) center/cover no-repeat fixed;
}
```

No `<base href>` tag — asset paths are plain relative (`img/...`, matching SNOB2000/
StrangeBrew, not Fietsen's `<base>` workaround). This relies on the nginx bare-path
redirect described below; without it, visiting `/brood` with no trailing slash will break
relative asset resolution (see the Coolify Hosting Playbook's "relative-asset-path trap").

Videos are shown as plain `<video controls preload="none">` elements (no custom player) —
`preload="none"` matters since the videos are still sizeable even compressed. The carousel
is a horizontal scroll-snap track with two arrow buttons that scroll by one image width;
no carousel library.

**Video compression**: the phone-shot originals were 720×1600 h264 @ ~2Mbps (one clip at
60fps, the other two at 30fps), 22–39MB each, ~90MB total for the three bread-baking videos.
Re-encoded with ffmpeg to cut size while staying visually equivalent at the size these actually
render on the page:

```
ffmpeg -i in.mp4 -vf "fps=30,scale=540:-2" -c:v libx264 -crf 28 -preset medium \
  -c:a aac -b:a 96k -movflags +faststart out.mp4
```

540px width (down from 720) plus CRF 28 (quality-targeted, not a fixed bitrate) got ~28%
total size reduction (90MB → 65MB) with no visible quality loss at a spot-checked frame —
a naive CRF-only re-encode at the original 720px resolution actually came out *larger* than
the source (the phone's own encoder was already efficient at that resolution), so the size
win here is specifically from downscaling to match the on-page display size, not from
re-encoding alone. Reuse this exact recipe for the bretzel videos if/when they get added back.
`ffmpeg`/`ffprobe` were installed via `winget install Gyan.FFmpeg` — not on this machine by
default.

## Local dev

Any static file server works, e.g.:

```
python -m http.server 8123
```

then open `http://localhost:8123/`. No build step, no env vars, no `<base>`-tag caveat to
work around locally (unlike Fietsen) since paths are plain-relative and the site is served
from the root either way.

## Deployment (planned, not yet live)

Not yet deployed to Coolify as of repo creation (2026-08-29). Plan: follow the Coolify
Hosting Playbook's **"Static-site deployment via Coolify's API"** recipe exactly — same
shape as StrangeBrew/SNOB2000/Fietsen:

- `build_pack: static`, base/publish directory `/` (repo root — no `src/` subfolder).
- Target URL: `https://bier-en-brood.nl/brood`.
- Custom Nginx config: the standard `location /brood/ { alias ...; }` + bare-path
  `location = /brood { return 301 /brood/; }` redirect block, subpath substituted.
- Remove the auto-populated `stripprefix` Traefik middleware from `custom_labels` (easy to
  miss — see the playbook's static-site recipe, step 4).
- Auto-deploy on push needs the **manual GitHub webhook** set up separately — `/applications/public`
  always attaches the "Public GitHub" pseudo-source, not a real GitHub App install, so push-to-deploy
  does *not* work out of the box even though the repo looks connected. Same recipe as
  StrangeBrew/SNOB2000/Fietsen.
- No database, no persistent volume, no env vars needed.
- Once live, add a tile for Brood on `../Home`'s `index.html`/`style.css` (same pattern as
  the existing De Sprong / 1001 Albums / Fietsen / Strange Brew / Snob 2000 tiles) — not
  done yet, needs a decision on tile artwork.

Full server/infra details (Coolify IDs, nginx config template, webhook setup, gotchas) live
in `../Coolify Hosting Playbook.md` — check that file for anything deploy- or server-related,
not duplicated here.

## Repo

`https://github.com/edvannunen/brood`, branch `main`, public. No CI.
