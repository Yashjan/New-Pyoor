# Deploying to Cloudflare (free plan)

The site is a static export (`next build` → `out/`) served by **Cloudflare Pages**. The API
(`/api/*`) is **Pages Functions** (`functions/api/[[route]].ts` → `server/app.ts`, Hono), and its
data lives in **D1** (`migrations/`, seeded from `db/seed.sql`). Nothing is deployed yet; these are
the steps for when you do.

`wrangler` needs Node 20+. The remote commands below (`login`, `d1 create`, `deploy`) work
anywhere; the local runtime runs in Docker (next section).

## Local runtime (Docker)

`wrangler pages dev` needs glibc 2.35+, which Ubuntu 20.04 lacks, so it runs in a container
(`docker/cf.Dockerfile`, Node 22 on Debian bookworm; `compose.yaml` mounts the repo).

```sh
cp .dev.vars.example .dev.vars   # once; fill in only what you need
npm run dev:cf                   # builds out/ on the host, then http://localhost:8788
npm run dev:cf:down              # stop it
```

The site, the Functions and a local D1 (`.wrangler/state`, migrated and seeded on every start)
run as on Cloudflare. To run the browser suite against it (with the API tests):
`PW_BASE_URL=http://localhost:8788 npx playwright test --workers=1`.

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

`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `TURNSTILE_SECRET_KEY`,
`ADMIN_TOKEN`, `ADMIN_EMAIL`

And one build variable (not secret), so the checkout uses your Turnstile widget instead of the test
key: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. Until it is set, the build uses Cloudflare's always-passing
test key, which a real `TURNSTILE_SECRET_KEY` refuses: checkout fails closed, not open.

- **Turnstile**: dashboard → **Turnstile** → **Add widget**, domain `pyoorglobal.com` (and the
  `*.pages.dev` address), mode **Invisible**. It gives the site key and the secret.
- **Razorpay webhook**: Razorpay dashboard → **Webhooks** → **Add**: URL
  `https://www.pyoorglobal.com/api/webhooks/razorpay`, events `payment.captured` and
  `payment.failed`, and a secret you choose (= `RAZORPAY_WEBHOOK_SECRET`). It settles payments
  when the customer's browser closes before the confirmation.
- **Live mode**: switch the two Razorpay keys to the live ones only after a full test order.

Or: `npx wrangler pages secret put RAZORPAY_KEY_SECRET` (it asks for the value).
Locally they go in `.dev.vars` (gitignored; copy `.dev.vars.example`).

## 5. Protect /admin with Cloudflare Access

The admin page asks for `ADMIN_TOKEN`; in production it also sits behind Cloudflare Access
(free for up to 50 users):

1. Dashboard → **Zero Trust** → **Access** → **Applications** → **Add** → **Self-hosted**.
2. Application domain: `www.pyoorglobal.com`, path `admin`; add a second one for path
   `api/admin` (the page's API). Do the same for the `*.pages.dev` address.
3. Policy: **Allow**, include **Emails** → your address (`ADMIN_EMAIL`). Login method: one-time
   PIN by email.

Access then asks for an emailed code before either path loads; the token check stays as the second
lock.

## 6. Check it

```sh
curl https://<project>.pages.dev/api/health     # {"ok":true,"db":true}
curl https://<project>.pages.dev/api/products
```

## 7. Connect the domain (later)

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
