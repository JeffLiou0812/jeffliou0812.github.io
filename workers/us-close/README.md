# us-close Worker

Intraday quotes for 美股焦點 「更新」. Sibling of 稅訊 `https://tax-brief.fengyen0812.workers.dev`.

Intended URL after deploy: `https://us-close.fengyen0812.workers.dev`

The Pages site degrades if this Worker is missing: the table stays on static `content/us-close/latest.json`.

## What it does

- `GET /` and `GET /quotes` return JSON.
- Reads tickers from `content/us-close/latest.json` `names[]` at request time (fallback: last cached list).
- Site-wide **one quote fetch per 3600s** via one KV key (`quotes`) plus a short `lock` key. Not per visitor.
- Session clock: `America/New_York`, regular hours 09:30–16:00 ET, Monday–Friday. Outside that window: `session_open: false`, **do not fetch**, return last cache or empty names.
- Failed ticker (or SPCX / SpaceX): `last` and `chg_pct` are `null`. The page shows 未取得. Never invent a number.

## Quote source

Yahoo Finance chart v8, no paid key:

`https://query1.finance.yahoo.com/v8/finance/chart/{SYMBOL}?interval=1d&range=5d`

Uses `meta.regularMarketPrice` and `meta.chartPreviousClose` for `chg_pct`. Delayed, unofficial public HTTP. If Yahoo blocks the Worker IP, that row is 未取得.

SPCX on this site is SpaceX, not the listed ETF that also uses ticker SPCX. The Worker never copies that ETF quote.

## KV shape

```json
{
  "fetched_at": 1756400000000,
  "session_open": true,
  "asof": 1756400000000,
  "names": [{ "ticker": "AAPL", "last": 10, "chg_pct": 1.25, "source": "yahoo-chart" }]
}
```

`fetched_at` is when the Worker last hit Yahoo (the hourly lock). `asof` is the quote stamp when Yahoo sends `regularMarketTime`.

## CORS

Allows `https://taxcodeusstocks.com` and `https://jeffliou0812.github.io`. Localhost is also allowed for Pages-side checks.

## Jeff: click this once in Cloudflare

Wrangler is in this folder, but this repo does not store a Cloudflare token. Do not paste a password into chat.

If you already deploy 稅訊 from the same account:

1. Open [Cloudflare Dashboard](https://dash.cloudflare.com/) and sign in to the account that owns `tax-brief.fengyen0812.workers.dev`.
2. **Workers & Pages** → **KV** → **Create a namespace** named `US_CLOSE`. Copy the namespace id.
3. Open `workers/us-close/wrangler.toml` and replace `replace-after-wrangler-kv-namespace-create` with that id.
4. On your machine, in this folder:

```bash
npx wrangler login
npx wrangler deploy
```

5. Confirm the URL is `https://us-close.fengyen0812.workers.dev` (same `*.fengyen0812.workers.dev` subdomain as 稅訊).
6. **Workers & Pages** → `us-close` → **Settings** → **Bindings**: `US_CLOSE` should be the KV namespace. Variable `SNAPSHOT_URL` should point at `https://taxcodeusstocks.com/content/us-close/latest.json`.

Dashboard-only path (no laptop):

1. **Workers & Pages** → **Create** → **Create Worker** → name `us-close`.
2. Paste `src/index.js` and `src/logic.js` (or upload this folder).
3. **Settings** → **Bindings** → **Add** → **KV namespace** → variable name `US_CLOSE` → create or pick `US_CLOSE`.
4. **Settings** → **Variables** → `SNAPSHOT_URL` = `https://taxcodeusstocks.com/content/us-close/latest.json`.
5. **Deploy**.

`js/us-close.js` already calls `https://us-close.fengyen0812.workers.dev`. After deploy, 更新 starts overlaying quotes during the US regular session. After the close, on weekends, and before the open, the button only rereads the cache and shows 收盤後已停止更新.
