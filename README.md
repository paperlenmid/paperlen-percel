# Alen Asteris — Vercel Edition

Public Trust Page + Procedure page, plus a **completely separate**
password-protected staff Dashboard at `/dashboard`. Built to deploy
for free on Vercel. This is a serverless build: no server keeps
running in the background, no local disk to write to — data lives in
Redis and photos live in Vercel Blob, both free-tier services you
connect from the Vercel dashboard.

```
alen-asteris-vercel/
├── api/
│   └── [...all].js       # ONE serverless function handles every /api/* route
├── lib/
│   ├── app.js              # the actual Express app (routes mounted here)
│   ├── db.js                 # data layer: Redis in prod, local JSON file in dev
│   ├── storage.js             # photo layer: Vercel Blob in prod, local folder in dev
│   ├── auth.js                  # JWT login/logout/session (stateless — serverless-safe)
│   └── routes/
│       ├── deals.js
│       ├── staff.js
│       ├── testimonials.js    # photo + star-rating testimonial CMS
│       └── stats.js            # the editable hero stat numbers
├── index.html               # PUBLIC site: Trust Page + Procedure — no login anywhere on it
├── dashboard/
│   └── index.html            # ADMIN-ONLY page, served at /dashboard — has the login form
├── css/
├── js/
│   ├── starfield.js         # shared background animation, loaded by both pages
│   ├── public.js            # powers index.html — only calls public GET endpoints
│   └── dashboard.js         # powers dashboard/index.html — login + all admin actions
├── dev-server.js           # local-only — lets you run the app with `npm run dev`
├── vercel.json
└── .env.example
```

**The split is real, not just hidden with CSS:** `index.html` doesn't
contain a login form, a dashboard link, or the dashboard's JavaScript
at all — someone browsing the public site has no way to discover
`/dashboard` from the page itself. You (or your staff) just need to
know to go there directly, e.g. `https://yoursite.com/dashboard`.


## Why this looks different from a normal Node app

Vercel runs your `/api` code as **serverless functions**: each request
spins up a short-lived instance with no shared memory and no
persistent disk. That breaks three things a normal Express app
usually relies on, so this build swaps them out:

| Normal Node app | This build |
|---|---|
| Session stored in server memory | JWT signed into an httpOnly cookie — no server-side lookup needed |
| Data saved to a local JSON file | Data saved to Redis (Upstash, via Vercel's free Redis integration) |
| Uploaded photos saved to a local folder | Photos uploaded to Vercel Blob, which gives back a permanent public URL |

Locally (`npm run dev`), none of that cloud setup is required — it
automatically falls back to a local JSON file and a local `uploads/`
folder, so you can build and test everything on your own machine
first.

## 1. Run it locally first

```bash
npm install
cp .env.example .env
```

Open `.env` and set at minimum:
- `JWT_SECRET` — any long random string (the file tells you how to generate one)
- `ADMIN_DEFAULT_USERNAME` / `ADMIN_DEFAULT_PASSWORD` — your first admin login

Leave the Redis/Blob lines commented out — you don't need them yet.

```bash
npm run dev
```

Open **http://localhost:3000** for the public Trust Page. Then open
**http://localhost:3000/dashboard** in a new tab, log in with the
admin credentials from `.env`, and try adding a deal, uploading a
testimonial, and editing the homepage stats. Everything works locally
using the JSON-file/local-folder fallback.

## 2. Push the project to GitHub

Vercel deploys from a Git repository.

```bash
git init
git add .
git commit -m "Alen Asteris — initial commit"
```

Create a new repo on GitHub, then follow its instructions to push
(something like):
```bash
git remote add origin https://github.com/YOUR-USERNAME/alen-asteris.git
git push -u origin main
```

## 3. Create the Vercel project

1. Go to [vercel.com](https://vercel.com) and sign up/log in (free — GitHub login is easiest).
2. Click **Add New → Project**.
3. Import the GitHub repo you just pushed.
4. Framework Preset: leave it as **Other** (no build step needed —
   Vercel will detect `api/` automatically).
5. Don't click Deploy yet — first add the two storage integrations
   below, then come back and deploy (or deploy now and add them
   after; either order works, just redeploy once they're linked).

## 4. Add free Redis (for deals/staff/testimonials/stats data)

1. In your Vercel project, go to the **Storage** tab.
2. Click **Create Database** → choose **Redis** (this is Upstash's
   free-tier integration — no separate signup needed).
3. Once created, click **Connect Project** and select this project.
4. Vercel automatically adds `UPSTASH_REDIS_REST_URL` and
   `UPSTASH_REDIS_REST_TOKEN` to your project's environment variables
   — you don't type these in yourself.

## 5. Add free Blob storage (for testimonial photos)

1. Still in the **Storage** tab, click **Create Database** → choose
   **Blob**.
2. Click **Connect Project** and select this project.
3. Vercel automatically adds `BLOB_READ_WRITE_TOKEN` for you.

## 6. Set the remaining environment variables

In **Project Settings → Environment Variables**, add:

| Key | Value |
|---|---|
| `JWT_SECRET` | a long random string (generate locally with the command in `.env.example`) |
| `ADMIN_DEFAULT_USERNAME` | whatever you want your admin username to be |
| `ADMIN_DEFAULT_PASSWORD` | a strong password — this only matters the very first time the database is created |

(`NODE_ENV=production` is set by Vercel automatically — you don't need to add it.)

## 7. Deploy

Click **Deploy** (or, if you already deployed in step 3, go to the
**Deployments** tab and redeploy so the new environment variables take
effect). Vercel gives you a live URL like
`https://alen-asteris-yourname.vercel.app`.

Open your live URL for the public site, and
`https://alen-asteris-yourname.vercel.app/dashboard` for the admin
panel — log in with the admin username/password you set in step 6.
From there:
- **Change Password** immediately (top of the dashboard) — the
  `.env` password was only ever used to create the very first admin
  account.
- Add real deals, staff, and testimonials — they're now stored in
  Redis + Blob, which persist across deploys and restarts (unlike a
  serverless function's local disk).

## Custom domain (optional)

**Project Settings → Domains** → add your own domain and follow
Vercel's DNS instructions. HTTPS is handled automatically. The admin
panel will be at `https://yourdomain.com/dashboard`.

## Troubleshooting: can't log in on Vercel

This app is built so a misconfiguration shows up as a clear error
message on the login form itself — open the Network tab (or just read
the red text under the login button) and it will tell you exactly
what's missing. The two most common causes:

1. **`JWT_SECRET` isn't set.** Check Project Settings → Environment
   Variables. If you just added it, you need to **redeploy** — adding
   an env var alone doesn't update an already-running deployment.
2. **No Redis connected.** Check the Storage tab — if there's no
   Redis database linked to this project, every login attempt fails,
   because this app refuses to fall back to local file storage in
   production (that would silently break and lose all your data on
   the next deploy). Add Redis (step 4 above), connect it, redeploy.

If uploading a testimonial photo fails specifically (but login
works), it's almost always the same idea for Blob storage — check
that a Blob store is created *and* connected (step 5).

After changing any environment variable, you must trigger a new
deployment for it to take effect — go to the **Deployments** tab and
redeploy the latest one, or push a new commit.

## Where to edit things

| Want to change... | Look in... |
|---|---|
| Brand name, hero copy, Procedure text | `index.html` |
| Dashboard layout / panels | `dashboard/index.html` |
| Seed deals / staff / default stats (first run only) | `lib/db.js` |
| Colors / fonts | `css/base.css` (`:root` variables) |
| Homepage stat cards layout | `css/layout.css` (`.stats-cards` and related) |
| Testimonial card styling (public) | `css/trust-page.css` (`.testi-photo-card`, `.review-card`) |
| Dashboard / CMS panel styling | `css/dashboard.css`, `css/cms.css` |
| Public page behavior | `js/public.js` |
| Dashboard behavior (all admin actions) | `js/dashboard.js` |
| API behavior / validation | `lib/routes/*.js` |
| Login / token behavior | `lib/auth.js` |

## Security notes

- Passwords are hashed with bcrypt — never stored in plain text.
- Login uses a signed JWT in an httpOnly cookie; there's no
  client-readable access code anywhere in the page source.
- `JWT_SECRET` must be set explicitly (no auto-generated fallback) —
  with many serverless instances running at once, a randomly
  generated secret per-instance would make logins fail unpredictably.
- Uploaded files are renamed to a random string on save, and only
  image MIME types are accepted.
- There's a single shared admin account. If you need multiple staff
  logins with separate permissions later, that's a reasonable next
  step to build on top of `lib/auth.js` and `lib/db.js`.
- `/dashboard` isn't linked from anywhere on the public site, and its
  page has a `noindex` tag so search engines won't list it — but the
  URL itself isn't secret if someone guesses it or it leaks. The
  actual protection is the login form and the JWT it requires for
  every write action; don't rely on the URL being unknown as the only
  line of defense.

## Free tier limits worth knowing

- **Vercel Hobby plan**: generous for a small business site — free
  bandwidth/requests allowance, HTTPS, and custom domains included.
- **Upstash Redis (via Vercel)**: free tier covers a large number of
  monthly requests — more than enough for a site like this.
- **Vercel Blob**: free tier includes several GB of storage — plenty
  for testimonial screenshots.

If the shop ever grows well beyond what these free tiers cover,
each one has a paid tier you can upgrade to without changing any code.
