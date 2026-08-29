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
- `GET /logout` clears the cookie and redirects. Linked from `index.html` bottom-right
  (`.logout-link` — a normal right-aligned flow element at the end of `.wrap`, not
  `position:absolute`; absolute-relative-to-viewport placement doesn't reliably land at the
  bottom of a page taller than one screen).
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

Asset paths are plain relative (`img/...`) inside both `index.html` and `login.html`.
Deployed at `/brood` on a shared domain (see Deployment below), so `server.js` injects
`<base href="{BASE_PATH}/">` server-side into both pages (`<!--BASE_HREF-->` placeholder,
replaced on every request in `sendWithBaseHref()`) — `BASE_PATH` is empty locally, `/brood`
in Coolify. **`<base>` only fixes browser-resolved relative URLs inside the HTML/CSS/JS**
(`img src`, `link href`, relative `fetch()`). It does **nothing** for two other kinds of
literal path in this app, both of which bit us on first deploy and needed separate fixes:
- **Any HTML attribute that starts with `/`** — an absolute path is never relative-resolved,
  `<base>` or not. `public/login.html`'s form `action` and `public/index.html`'s logout link
  both had to change from `"/login"`/`"/logout"` to bare `"login"`/`"logout"` so they resolve
  *through* the `<base>` tag instead of hitting the domain root.
- **Every `res.redirect(...)` call in `server.js`** — an HTTP `Location` header, which
  `<base>` can't touch at all since it's resolved by the browser with no HTML document in
  play yet. All four redirects (`requireAuth`, both login outcomes, logout) are built as
  `` `${BASE_PATH}/...` `` for exactly this reason — a bare `res.redirect('/login')` sent a
  logged-out visitor to `bier-en-brood.nl/login` (404) instead of `bier-en-brood.nl/brood/login`
  the moment this went live at the subpath, since Traefik had already stripped `/brood` before
  the container ever saw the request, so the app had no way to know it wasn't mounted at the
  domain root unless told via `BASE_PATH`.

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

## Deployment

**Live** at `https://bier-en-brood.nl/brood`, deployed 2026-08-29 via Coolify's API (same
`/applications/public` + SSH pattern as SNOB2000/StrangeBrew, adapted for a Node app instead
of a static site — see the Coolify Hosting Playbook's "Remote access" and "Static-site
deployment" sections for the generic recipe this followed).

- `build_pack: nixpacks` (auto-detected `package.json`), **not** `static` — this is a
  **Traefik-proxied dynamic Application**, not an nginx-static resource, so the "Custom Nginx
  Configuration" subpath trick StrangeBrew/SNOB2000/Fietsen use isn't available here. Traefik
  strips the `/brood` prefix before the container sees anything (confirmed live, not just
  theoretical) — see the "Design" section above for what that broke and how it was fixed
  (`BASE_PATH` env var).
- Start command: `node server.js` (Coolify's Nixpacks guess was overridden, per the playbook's
  general "almost always needs this overridden" note).
- `ports_exposes` / Port field: `3000`.
- Public repo, so `/applications/public`'s auto-attached "Public GitHub" pseudo-source needed
  no GitHub App install — but that also means **auto-deploy-on-push is not wired up** (same
  gap as SNOB2000/StrangeBrew/Fietsen) until the manual-webhook fix from the playbook's
  "Static-site deployment" section step 7 is applied here too — not yet done as of first
  deploy, so pushes need a manual redeploy (`POST /applications/{uuid}/start`) until then.
- Runtime env vars (set directly in Coolify, never committed): `LOGIN_USERNAME=BroodMetClau`,
  `LOGIN_PASSWORD=LekkerBakken`, `SESSION_SECRET` (a fresh random value generated for
  production — deliberately *not* the local dev `.env`'s value), `BASE_PATH=/brood`,
  `PORT=3000`. Coolify also auto-added `NIXPACKS_NODE_VERSION=22` itself (harmless, consistent
  with the committed `.node-version` pin).
- Coolify IDs (stable, re-derive via the API if ever needed again): project uuid
  `vn3weiqnz526k6ta1890wkuj`, production environment uuid `fr4sq684tfhw156a6j8f35t5`,
  application uuid `onr4c8qpm0vos8n4gqp58lji`, server uuid `au56epv30lyah9047zzkurml`
  (shared `localhost` server), destination uuid `xrn38nwb70ge0t1oooipqvf3` (shared `coolify`
  docker network) — all the same shared server/destination every other project on this stack
  uses.
- No database, no persistent volume (auth is fully stateless — env vars + a signed cookie,
  nothing written to disk).
- Verified live: `/brood` and `/brood/` both correctly redirect to the login page, login with
  the real credentials works, logout works, video/photo assets load.
- **Not yet done**: the manual GitHub webhook (auto-deploy on push), and adding a tile for
  Brood on `../Home`'s `index.html`/`style.css` (same pattern as the existing De Sprong /
  1001 Albums / Fietsen / Strange Brew / Snob 2000 tiles) — needs a decision on tile artwork.

Full server/infra details (Coolify API access from a fresh session, nginx config templates,
webhook setup, general gotchas) live in `../Coolify Hosting Playbook.md` — check that file for
anything deploy- or server-related, not duplicated here. Consider adding a "Brood" entry to
that playbook's "Per-project specifics" section next time it's touched, matching how every
sibling project documents its own IDs/quirks there rather than only in its own `CLAUDE.md`.

## Repo

`https://github.com/edvannunen/brood`, branch `main`, public. No CI.
