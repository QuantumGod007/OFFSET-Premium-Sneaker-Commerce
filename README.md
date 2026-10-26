# OFFSET

A curated sneaker storefront built with Express, HTML, CSS and vanilla JavaScript. Real product photography, search and filters, size selection, a persistent browser bag, server-priced checkout and saved demo orders. No accounts or payments.

**Live:** https://offset-premium-sneaker-commerce.vercel.app

## Run and test

Requires Node.js 22.13 or newer.

```sh
npm install
npm start
# http://localhost:3001
npm test
```

`npm run dev` enables automatic restarts. `PORT` overrides port 3001. All 48 API checks cover valid orders, required fields, email, Indian phone numbers, addresses, unknown products, sizes, stock, tampered prices, concurrent orders, persistence and failed writes. Tests use temporary data.

For validation demonstrations, submit an empty checkout or invalid email. Inline messages come from Express. Valid details create a saved confirmation with an unpredictable reference. Prices, shipping and stock are always calculated on the server.

## Hosting and persistence

Vercel runs the root `app.js`; `vercel.json` configures Express in Mumbai. A free Turso database connected through Vercel provides `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` as encrypted environment variables. Database write transactions atomically validate stock and save orders across function instances. Redeploy with `vercel --prod` after linking your project and connecting its database. No credentials belong in Git.

Local `npm start` uses atomic JSON-file persistence at `data/store.json`, overridable with `DATA_PATH`. Run one local process with a persistent writable disk. A Dockerfile is included: `docker build -t offset .`, then `docker run -p 3001:3001 -v offset-data:/app/data offset`.

GET routes: `/api/products`, `/api/products/:id`, `/api/orders/:reference`, `/api/health`. POST routes: `/api/cart/quote`, `/api/checkout/validate`, `/api/orders`. Validation uses express-validator; submitted prices and unknown properties are rejected. Confirmation responses omit full customer contact details.

Product image credits: `public/assets/sources.json`. Font licenses: `public/assets/FONT-LICENSES.txt`. Brand names and images belong to their owners. This independent noncommercial academic demo uses simulated prices, inventory and delivery; no payment or shipment occurs.
