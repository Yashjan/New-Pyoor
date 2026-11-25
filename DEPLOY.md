# Deploying to Cloudflare (free plan)

The site is a static export (`next build` → `out/`) served by **Cloudflare Pages**. The API
(`/api/*`) is **Pages Functions** (`functions/api/[[route]].ts` → `server/app.ts`, Hono), and its
data lives in **D1** (`migrations/`, seeded from `db/seed.sql`). Nothing is deployed yet; these are
the steps for when you do.

`wrangler` needs Node 20+ and, to run anything locally, Linux with glibc 2.35+ (Ubuntu 22.04+) or
macOS. The remote commands below (`login`, `d1 create`, `deploy`) work anywhere.

## 1. Log in

```sh
npx wrangler login
```

## 2. Create the database

```sh
npx wrangler d1 create pyoor
```

It prints a `database_id`. Put it in `wrangler.toml` (replacing the zeros), then create the tables
and the products:

```sh
npx wrangler d1 migrations apply pyoor --remote
npm run db:seed:gen
npx wrangler d1 execute pyoor --remote --file=db/seed.sql
```

After a price change in `lib/commerce/pricing.ts`: run the last two lines again (the seed is an
upsert).

## 3. Create the Pages project

Either from the dashboard (recommended: deploys on every push):

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**, pick
   the repo.
2. Build settings: framework preset **None**, build command `npm run build`, output directory
   `out`. Environment variable `NODE_VERSION` = `22`.
3. **Save and Deploy**. The first build gives you a `*.pages.dev` address.
4. **Settings → Bindings → Add → D1 database**: variable name `DB`, database `pyoor`. Do this for
   Production (and Preview if you want previews to have a database). Redeploy.

Or from your machine, without Git:

```sh
npx wrangler pages project create pyoor --production-branch main
npm run build
npx wrangler pages deploy out
```

(The D1 binding comes from `wrangler.toml` in this case.)

## 4. Secrets (for Step B: payments)

Never put these in the repo. Dashboard → the Pages project → **Settings → Variables and Secrets** →
add each as an encrypted **Secret** for Production:

`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `ADMIN_EMAIL`

Or: `npx wrangler pages secret put RAZORPAY_KEY_SECRET` (it asks for the value).
Locally they go in `.dev.vars` (gitignored; copy `.dev.vars.example`).

## 5. Check it

```sh
curl https://<project>.pages.dev/api/health     # {"ok":true,"db":true}
curl https://<project>.pages.dev/api/products
```

## 6. Connect the domain (later)

1. Add `pyoorglobal.com` to Cloudflare (**Add a site**, free plan) and change the nameservers at
   your registrar to the two Cloudflare gives you. Wait until the zone shows **Active**.
2. The Pages project → **Custom domains** → **Set up a domain** → `www.pyoorglobal.com`. Add
   `pyoorglobal.com` too.
3. Send the bare domain to `www`: **Rules → Redirect Rules** → from `pyoorglobal.com/*` to
   `https://www.pyoorglobal.com/${1}`, 301.
4. `.env.production` already has `NEXT_PUBLIC_SITE_URL=https://www.pyoorglobal.com` (canonical
   URLs, OG images, sitemap): keep it matching the domain.

## Limits on the free plan

- Functions: 100,000 requests a day, 10 ms CPU per request (waiting on D1 doesn't count). Static
  files are free and unlimited.
- D1: 5 GB, 5 million rows read and 100,000 written a day.
- Pages: 500 builds a month, 20,000 files, 25 MiB per file.
