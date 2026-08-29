# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Brood** — a small page showing a few home videos of baking bread plus a photo carousel of
bread from over the years, behind a fixed username/password login. Part of Ed's
`bier-en-brood.nl` personal-projects family (see `../Home` for the landing page that links
out to all of them).

**Node/Express app** (not a plain static site — it became one on 2026-08-29 specifically to
support server-side login, see "Auth" below):

```
server.js          # the whole backend: login/logout routes + auth-gated static file serving
package.json        # express, cookie-parser, dotenv
.env                 # gitignored — LOGIN_USERNAME, LOGIN_PASSWORD, SESSION_SECRET, PORT
.env.example         # committed template, no real secrets
.node-version         # pins the Nixpacks runtime (see Coolify Hosting Playbook gotchas)
public/                # everything express.static serves once authenticated
  index.html             # the page: logout link, banner, video grid, photo carousel
  login.html             # login form — same background/banner treatment, served unauthenticated
  style.css              # shared by both pages
  script.js               # carousel prev/next + auto-rotate (see "Carousel" below)
  img/
    banner.png              # main-page header banner
    login-banner.png         # smaller banner used on the login page (same height, 182px)
    background.png            # tiled/cover page background — served unauthenticated (needed
                               #   by login.html before the visitor is logged in)
    brood-favicon.png          # site favicon — also served unauthenticated
    brood/                      # the actual media (photos/videos/posters), auth-gated
      broodbakken1-3.mp4          # bread-baking videos, compressed (see below)
      broodbakken1-3-thumb.png     # <video poster> thumbnails
      *.jpg                        # bread photos, shown in the carousel
      bretzels1-3.mp4, bretzels4.jpg  # pretzel media — present but NOT referenced from
                                        # index.html (parked "for now" per Ed, 2026-08-29;
                                        # not yet compressed either — do that before re-adding)
    brood_banner-achtergrond-groot.png    # gitignored — larger source version, not served
    brood_banner-achtergrondmiddel.png    # gitignored — medium source version, not served
    banner-groot - kopie.png              # gitignored — backup copy of an earlier banner
```

Filenames under `public/img/brood/` were normalized to lowercase-kebab-case (no spaces) when
the repo was set up, since the originals (synced from Dropbox) had spaces and mixed case.

## Auth

Fixed single username/password, no user accounts/database. Added 2026-08-29 because the repo
is **public** on GitHub, so hardcoding credentials anywhere in `public/` would leak them —
credentials only ever live in env vars (`LOGIN_USERNAME`, `LOGIN_PASSWORD` — set in Coolify's
dashboard in production, matching every other project on this stack; `.env` locally, gitignored).

- `POST /login` checks `username` (case-insensitive) + `password` (case-sensitive, exact)
  against those env vars, then sets a signed, `httpOnly`, 30-day cookie (`SESSION_SECRET` env
  var signs it — also required, no hardcoded fallback used in production).
- `requireAuth` middleware gates everything under `public/` **except** the handful of assets
  `login.html` itself needs before the visitor is authenticated: `style.css`,
  `img/login-banner.png`, `img/background.png`, `img/brood-favicon.png`, and `/login` itself.
  Those are each served via their own explicit `app.get(...)` route in `server.js`, registered
  *before* the `requireAuth` catch-all — do not switch to a single `express.static(PUBLIC_DIR)`
  with no auth, that would serve every gated photo/video unauthenticated too.
- `GET /logout` clears the cookie and redirects to `/login`. Linked from `index.html` top-right
  (`.logout-link`, absolutely positioned — has its own background pill since it overlaps the
  banner image otherwise, low contrast without it).
- **Why `public/` exists at all**: `express.static` only serves files inside the directory it's
  pointed at. Pointing it at the repo root would let anyone request `/server.js`, `/.env`,
  `/package.json` etc. directly and read them. Keep anything that shouldn't be servable (the
  server code, node_modules, `.env`) *outside* `public/`.
- The 30-day "don't ask again" is just the cookie's `maxAge` — no separate mechanism, nothing
  to build or maintain.

## Design

Reuses `../Home`'s visual language directly (same CSS custom properties — `--cream`,
`--ink`, `--orange`, Fraunces/Work Sans fonts):

```css
body{
  overflow-x:hidden;
  background:var(--cream) url(img/background.png) center/cover no-repeat fixed;
}
```

Asset paths are plain relative (`img/...`) inside both `index.html` and `login.html` — no
`<base href>` needed since `server.js` mounts everything at the app root (unlike the old
static-nginx subpath setup this replaced).

Videos are shown as plain `<video controls preload="none" poster="...">` elements (no custom
player) — `preload="none"` matters since the videos are still sizeable even compressed. Each
video and each carousel photo sits in a `<figure>` with a `<figcaption>` title above/below it.
The video grid's `.video-figure` is a centered flex column (title, then video) specifically so
the caption centers relative to the video's actual (80%-width) rendered box, not the wider
grid column — a plain `text-align:center` on the figcaption alone didn't line up correctly
when the caption box was the full column width but the video inside it was narrower.

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

## Carousel

`public/script.js`. Auto-rotates every 3s, advancing by one slide via `track.scrollTo({left:
..., behavior:'smooth'})` with a manually computed offset (centers the target `<figure>` in
the track) — **not** `element.scrollIntoView()`, which was the original implementation and
had a real bug: `block:'nearest'` could still nudge the whole page's vertical scroll position
when the target slide wasn't fully in the viewport, which is very noticeable on an auto-timer
nobody asked to trigger. Scrolling the track's own `scrollLeft` directly can't touch page
scroll at all.

Pauses on `mouseenter`/`focusin` of `#carousel` (covers the arrow buttons too, since they're
inside it) and resumes on `mouseleave`/`focusout`; respects `prefers-reduced-motion` (skips
autoplay entirely). The prev/next arrow click handlers do **not** call `startAuto()` — they
used to, which re-armed the auto-rotate timer even while the mouse was still hovering over the
carousel (i.e. mid-interaction), so a manual click's effect would get silently overridden by
an auto-advance a few seconds later. Pause/resume is controlled *only* by hover/focus now.

## Local dev

```
npm install
cp .env.example .env   # edit if you want different local credentials
npm start                # or: node server.js
```

Then open `http://localhost:3000/` (redirects to `/login` if not authenticated). `PORT` env
var controls the port, default 3000.

## Deployment (planned, not yet live)

Not yet deployed to Coolify as of the auth rewrite (2026-08-29) — was originally planned as a
static-site deploy (see the Coolify Hosting Playbook's static-site recipe) but that no longer
applies now that this is a real Node app. Follow the **De Sprong**-style Node deploy pattern
instead:

- `build_pack: nixpacks` (auto-detected from `package.json`), not `static`.
- Start command: `node server.js` (or `npm start`) — Coolify will very likely need this set
  explicitly rather than relying on Nixpacks' guess, per the playbook's general gotchas.
- Runtime env vars (set in Coolify's dashboard, **not** a committed `.env` — see `.env.example`
  for the full list): `LOGIN_USERNAME`, `LOGIN_PASSWORD`, `SESSION_SECRET` (generate a real
  random value, don't reuse the local dev one), `PORT` (match whatever Coolify's Port field is
  set to).
- Target URL: `https://bier-en-brood.nl/brood` — as a subdomain or Traefik-proxied subpath;
  if subpath, this is a **Traefik-proxied dynamic Application now, not a static-nginx
  resource**, so the "Custom Nginx Configuration" trick used by StrangeBrew/SNOB2000/Fietsen
  for subpaths isn't available here — re-read the Coolify Hosting Playbook's "Subpath
  deployments" gotcha section (the Traefik-strips-the-prefix behavior, and the relative-asset
  trap) before wiring up the domain; a subdomain avoids all of that and is simpler.
- No database, no persistent volume needed (auth is fully stateless — env vars + a signed
  cookie, nothing written to disk).
- Once live, add a tile for Brood on `../Home`'s `index.html`/`style.css` (same pattern as
  the existing De Sprong / 1001 Albums / Fietsen / Strange Brew / Snob 2000 tiles) — not
  done yet, needs a decision on tile artwork.

Full server/infra details (Coolify IDs, nginx config templates, webhook setup, Node-specific
gotchas like the `ORIGIN`/`BODY_SIZE_LIMIT` env vars De Sprong needed) live in
`../Coolify Hosting Playbook.md` — check that file for anything deploy- or server-related,
not duplicated here.

## Repo

`https://github.com/edvannunen/brood`, branch `main`, public. No CI.
