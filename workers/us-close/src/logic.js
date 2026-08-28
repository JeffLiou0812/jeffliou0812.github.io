/* Shared Worker logic. Node tests import this file. Do not invent last/chg. */

export const TTL_MS = 60 * 60 * 1000;
export const TZ = "America/New_York";
export const OPEN_MINUTES = 9 * 60 + 30;
export const CLOSE_MINUTES = 16 * 60;
export const QUOTE_SOURCE = "yahoo-chart";
export const QUOTE_SOURCE_DOC =
  "Yahoo Finance chart v8 (https://query1.finance.yahoo.com/v8/finance/chart/{SYMBOL}?interval=1d&range=5d). No API key. Delayed. Unofficial public HTTP. SPCX is SpaceX on this site, not the listed ETF of the same ticker, so that row is always 未取得.";

export const DEFAULT_SNAPSHOT =
  "https://taxcodeusstocks.com/content/us-close/latest.json";
export const FALLBACK_SNAPSHOT =
  "https://jeffliou0812.github.io/content/us-close/latest.json";

export const SKIP_TICKERS = {
  SPCX: "unlisted-spacex"
};

const WEEKEND = { Sat: true, Sun: true };

export function memoryKv() {
  var store = new Map();
  return {
    async get(key, type) {
      if (!store.has(key)) return null;
      var value = store.get(key);
      var mode = type && typeof type === "object" ? type.type : type;
      if (mode === "json") {
        try {
          return JSON.parse(value);
        } catch (e) {
          return null;
        }
      }
      return value;
    },
    async put(key, value) {
      store.set(key, typeof value === "string" ? value : JSON.stringify(value));
    },
    async delete(key) {
      store.delete(key);
    }
  };
}

export function etParts(now) {
  var date = now instanceof Date ? now : new Date(now);
  if (isNaN(date.getTime())) return null;
  var fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });
  var parts = {};
  fmt.formatToParts(date).forEach(function (p) {
    parts[p.type] = p.value;
  });
  var hour = Number(parts.hour);
  var minute = Number(parts.minute);
  return {
    weekday: parts.weekday,
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: hour,
    minute: minute,
    ymd: parts.year + "-" + parts.month + "-" + parts.day,
    hhmm: String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0")
  };
}

export function usRegularSession(now) {
  var p = etParts(now);
  if (!p) return { open: false, reason: "unknown" };
  var mins = p.hour * 60 + p.minute;
  if (WEEKEND[p.weekday]) {
    return { open: false, reason: "weekend", et: p };
  }
  if (mins < OPEN_MINUTES) {
    return { open: false, reason: "before_open", et: p };
  }
  if (mins >= CLOSE_MINUTES) {
    return { open: false, reason: "after_close", et: p };
  }
  return { open: true, reason: null, et: p };
}

export function readCache(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  var fetchedAt = Number(raw.fetched_at);
  if (!isFinite(fetchedAt)) return null;
  var names = Array.isArray(raw.names) ? raw.names : [];
  return {
    fetched_at: fetchedAt,
    session_open: raw.session_open === true,
    asof: raw.asof == null ? fetchedAt : Number(raw.asof) || fetchedAt,
    names: names.map(normalizeName).filter(Boolean)
  };
}

export function normalizeName(row) {
  if (!row || !row.ticker) return null;
  var ticker = String(row.ticker).trim().toUpperCase();
  if (!ticker) return null;
  var last = Number(row.last);
  var chg = Number(row.chg_pct);
  return {
    ticker: ticker,
    last: isFinite(last) ? round2(last) : null,
    chg_pct: isFinite(chg) ? round2(chg) : null,
    source: row.source ? String(row.source) : null
  };
}

export function decideFetch(nowMs, cache, session) {
  var fresh =
    cache &&
    isFinite(cache.fetched_at) &&
    nowMs - cache.fetched_at < TTL_MS &&
    nowMs - cache.fetched_at >= 0;
  if (fresh) {
    return { action: "cache", fetch: false, reason: "ttl" };
  }
  if (!session || !session.open) {
    return {
      action: cache ? "cache" : "empty",
      fetch: false,
      reason: (session && session.reason) || "closed"
    };
  }
  return { action: "fetch", fetch: true, reason: null };
}

export function tickersFromSnapshot(data) {
  if (!data || !Array.isArray(data.names)) return [];
  var out = [];
  data.names.forEach(function (n) {
    var t = n && String(n.ticker || "").trim().toUpperCase();
    if (t && out.indexOf(t) === -1) out.push(t);
  });
  return out;
}

export function tickersFromCache(cache) {
  if (!cache || !Array.isArray(cache.names)) return [];
  return cache.names.map(function (n) { return n.ticker; }).filter(Boolean);
}

export function missingRow(ticker) {
  return { ticker: String(ticker || "").toUpperCase(), last: null, chg_pct: null, source: null };
}

export function parseYahooChart(ticker, data) {
  var sym = String(ticker || "").toUpperCase();
  if (!sym) return missingRow("");
  if (SKIP_TICKERS[sym]) return missingRow(sym);
  var result =
    data &&
    data.chart &&
    Array.isArray(data.chart.result) &&
    data.chart.result[0]
      ? data.chart.result[0]
      : null;
  var meta = result && result.meta;
  if (!meta) return missingRow(sym);
  var last = Number(meta.regularMarketPrice);
  var prev = Number(meta.chartPreviousClose);
  if (!isFinite(last)) return missingRow(sym);
  var row = {
    ticker: sym,
    last: round2(last),
    chg_pct: null,
    source: QUOTE_SOURCE,
    asof: Number(meta.regularMarketTime) > 0 ? Number(meta.regularMarketTime) * 1000 : null
  };
  if (isFinite(prev) && prev !== 0) {
    row.chg_pct = round2(((last - prev) / prev) * 100);
  }
  return row;
}

export function bestAsof(names, fallbackMs) {
  var max = 0;
  (names || []).forEach(function (n) {
    var a = n && Number(n.asof);
    if (isFinite(a) && a > max) max = a;
  });
  return max || fallbackMs || null;
}

export function publicNames(names) {
  return (names || []).map(function (n) {
    return {
      ticker: n.ticker,
      last: n.last,
      chg_pct: n.chg_pct,
      source: n.source
    };
  });
}

export function toPayload(opts) {
  var session = opts.session || { open: false, reason: "closed" };
  var cache = opts.cache || null;
  var useCache = opts.cached && cache;
  return {
    ok: true,
    session_open: session.open === true,
    reason: session.open ? null : session.reason || "closed",
    cached: !!useCache,
    fetched: opts.fetched === true,
    fetched_at: useCache || opts.fetched ? (cache && cache.fetched_at) || null : null,
    asof: useCache || opts.fetched ? (cache && (cache.asof || cache.fetched_at)) || null : null,
    source: QUOTE_SOURCE,
    names: useCache || opts.fetched ? publicNames(cache && cache.names) : []
  };
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

export function yahooChartUrl(ticker) {
  return (
    "https://query1.finance.yahoo.com/v8/finance/chart/" +
    encodeURIComponent(ticker) +
    "?interval=1d&range=5d"
  );
}

export function isAllowedOrigin(origin) {
  if (!origin) return false;
  var allow = {
    "https://taxcodeusstocks.com": true,
    "https://www.taxcodeusstocks.com": true,
    "https://jeffliou0812.github.io": true
  };
  if (allow[origin]) return true;
  try {
    var u = new URL(origin);
    return (
      (u.protocol === "http:" || u.protocol === "https:") &&
      (u.hostname === "localhost" || u.hostname === "127.0.0.1")
    );
  } catch (e) {
    return false;
  }
}

export function corsHeaders(request, extra) {
  var origin = "";
  try {
    origin = request.headers.get("Origin") || "";
  } catch (e) {
    origin = "";
  }
  var headers = Object.assign(
    {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "Content-Type"
    },
    extra || {}
  );
  if (isAllowedOrigin(origin)) {
    headers["access-control-allow-origin"] = origin;
    headers.vary = "Origin";
  } else {
    headers["access-control-allow-origin"] = "https://taxcodeusstocks.com";
  }
  return headers;
}

export function createHandler(defaults) {
  defaults = defaults || {};
  return async function handleRequest(request, env) {
    env = env || {};
    var fetchFn = defaults.fetch || globalThis.fetch;
    var getNow = defaults.now || function () { return Date.now(); };
    var snapshotUrl = env.SNAPSHOT_URL || defaults.snapshotUrl || DEFAULT_SNAPSHOT;
    var kv = env.US_CLOSE || defaults.kv || null;
    var cors = corsHeaders(request);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "GET") {
      return new Response(JSON.stringify({ ok: false, error: "method" }), {
        status: 405,
        headers: cors
      });
    }

    var now = getNow();
    var session = usRegularSession(now);
    var cache = kv ? readCache(await kv.get("quotes", { type: "json" })) : null;
    var decision = decideFetch(now, cache, session);

    if (!decision.fetch) {
      return json(
        toPayload({
          cache: cache,
          session: session,
          fetched: false,
          cached: decision.action === "cache"
        }),
        200,
        cors
      );
    }

    if (!kv) {
      return json({ ok: false, session_open: true, reason: "no-kv", names: [] }, 503, cors);
    }

    var lock = await kv.get("lock");
    if (lock) {
      return json(
        toPayload({ cache: cache, session: session, fetched: false, cached: !!cache }),
        200,
        cors
      );
    }

    await kv.put("lock", "1", { expirationTtl: 45 });
    try {
      var tickers = await loadTickers(fetchFn, snapshotUrl, cache);
      var names = await fetchQuotes(fetchFn, tickers);
      var fresh = {
        fetched_at: now,
        session_open: true,
        asof: bestAsof(names, now),
        names: names
      };
      await kv.put("quotes", JSON.stringify(fresh));
      return json(
        toPayload({ cache: fresh, session: session, fetched: true, cached: false }),
        200,
        cors
      );
    } catch (e) {
      if (cache) {
        return json(
          toPayload({ cache: cache, session: session, fetched: false, cached: true }),
          200,
          cors
        );
      }
      return json(
        { ok: false, session_open: session.open, reason: session.reason, names: [] },
        502,
        cors
      );
    } finally {
      try {
        await kv.delete("lock");
      } catch (e2) {}
    }
  };
}

async function loadTickers(fetchFn, snapshotUrl, cache) {
  var urls = [snapshotUrl];
  if (snapshotUrl !== FALLBACK_SNAPSHOT) urls.push(FALLBACK_SNAPSHOT);
  var i;
  for (i = 0; i < urls.length; i++) {
    try {
      var res = await fetchFn(urls[i], {
        headers: { Accept: "application/json" }
      });
      if (!res || !res.ok) continue;
      var data = await res.json();
      var tickers = tickersFromSnapshot(data);
      if (tickers.length) return tickers;
    } catch (e) {}
  }
  var cached = tickersFromCache(cache);
  if (cached.length) return cached;
  throw new Error("no-tickers");
}

async function fetchQuotes(fetchFn, tickers) {
  return Promise.all(
    (tickers || []).map(function (ticker) {
      if (SKIP_TICKERS[ticker]) return Promise.resolve(missingRow(ticker));
      return fetchOneQuote(fetchFn, ticker);
    })
  );
}

async function fetchOneQuote(fetchFn, ticker) {
  try {
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (ctrl) ctrl.abort();
    }, 8000);
    var res = await fetchFn(yahooChartUrl(ticker), {
      signal: ctrl ? ctrl.signal : undefined,
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; taxcodeusstocks-us-close/1.0)"
      }
    });
    clearTimeout(timer);
    if (!res || !res.ok) return missingRow(ticker);
    var data = await res.json();
    return parseYahooChart(ticker, data);
  } catch (e) {
    return missingRow(ticker);
  }
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), { status: status || 200, headers: headers });
}
