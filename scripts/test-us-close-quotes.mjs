#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import * as logic from "../workers/us-close/src/logic.js";

var require = createRequire(import.meta.url);
require("../js/us-close.js");
var U = globalThis.UsClose;
var root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

var failed = 0;
function assert(name, cond) {
  if (!cond) {
    failed += 1;
    console.error("FAIL " + name);
  } else {
    console.log("ok   " + name);
  }
}

var latest = JSON.parse(fs.readFileSync(path.join(root, "content/us-close/latest.json"), "utf8"));

assert("latest still has 16 names", latest.names.length === 16);
assert(
  "tickers come from latest.json",
  logic.tickersFromSnapshot(latest).join(",") ===
    "AAPL,MSFT,NVDA,AMZN,GOOGL,META,TSLA,SPCX,NET,MU,NOK,SNDK,TSM,GLW,CAT,AVGO"
);

var fri929 = Date.parse("2026-08-28T13:29:00.000Z");
var fri930 = Date.parse("2026-08-28T13:30:00.000Z");
var fri1559 = Date.parse("2026-08-28T19:59:00.000Z");
var fri1600 = Date.parse("2026-08-28T20:00:00.000Z");
var fri1945 = Date.parse("2026-08-28T23:45:00.000Z");
var sat1200 = Date.parse("2026-08-29T16:00:00.000Z");
var mon1000 = Date.parse("2026-08-24T14:00:00.000Z");

assert("Fri 09:29 ET is before_open", logic.usRegularSession(fri929).open === false && logic.usRegularSession(fri929).reason === "before_open");
assert("Fri 09:30 ET is open", logic.usRegularSession(fri930).open === true);
assert("Fri 15:59 ET is open", logic.usRegularSession(fri1559).open === true);
assert("Fri 16:00 ET is after_close", logic.usRegularSession(fri1600).open === false && logic.usRegularSession(fri1600).reason === "after_close");
assert("Sat noon ET is weekend", logic.usRegularSession(sat1200).open === false && logic.usRegularSession(sat1200).reason === "weekend");
assert("Mon 10:00 ET is open", logic.usRegularSession(mon1000).open === true);

var sessionOpen = { open: true, reason: null };
var sessionClosed = { open: false, reason: "after_close" };
var cacheFresh = { fetched_at: fri1559, names: [{ ticker: "FAKE", last: 10, chg_pct: 1, source: "yahoo-chart" }] };
var cacheStale = { fetched_at: fri1559 - (61 * 60 * 1000), names: cacheFresh.names };

assert("ttl cache wins while open", logic.decideFetch(fri1559, cacheFresh, sessionOpen).fetch === false && logic.decideFetch(fri1559, cacheFresh, sessionOpen).reason === "ttl");
assert("stale cache fetches while open", logic.decideFetch(fri1559, cacheStale, sessionOpen).fetch === true);
assert("stale cache does not fetch after close", logic.decideFetch(fri1600, cacheStale, sessionClosed).fetch === false && logic.decideFetch(fri1600, cacheStale, sessionClosed).action === "cache");
assert("no cache after close is empty", logic.decideFetch(fri1600, null, sessionClosed).fetch === false && logic.decideFetch(fri1600, null, sessionClosed).action === "empty");
assert("no cache while open fetches", logic.decideFetch(fri930, null, sessionOpen).fetch === true);

var yahooOk = {
  chart: {
    result: [{ meta: { regularMarketPrice: 10, chartPreviousClose: 8, regularMarketTime: 1000 } }]
  }
};
var parsed = logic.parseYahooChart("FAKE", yahooOk);
assert("parse uses source last and computed chg", parsed.last === 10 && parsed.chg_pct === 25 && parsed.source === "yahoo-chart");
assert("parse does not invent when meta missing", logic.parseYahooChart("FAKE", { chart: { result: [] } }).last === null && logic.parseYahooChart("FAKE", { chart: { result: [] } }).chg_pct === null);
assert(
  "SPCX is 未取得 even if Yahoo has an ETF last",
  logic.parseYahooChart("SPCX", yahooOk).last === null &&
    logic.parseYahooChart("SPCX", yahooOk).chg_pct === null &&
    logic.parseYahooChart("SPCX", yahooOk).source === null
);

var overlay = U.overlayNames(latest.names, [
  { ticker: "AAPL", last: 10, chg_pct: 1.5, source: "yahoo-chart" },
  { ticker: "SPCX", last: null, chg_pct: null, source: null }
]);
var aapl = overlay.filter(function (n) { return n.ticker === "AAPL"; })[0];
var spcx = overlay.filter(function (n) { return n.ticker === "SPCX"; })[0];
var msft = overlay.filter(function (n) { return n.ticker === "MSFT"; })[0];
assert("overlay keeps 蘋果", aapl.name_zh === "蘋果" && aapl.live === true && aapl.close === 10 && aapl.chg_pct === 1.5);
assert("overlay SPCX is 未取得", spcx.live === true && spcx.missingLast === true && U.formatLivePrice(spcx) === "未取得" && U.formatLivePct(spcx) === "未取得");
assert("overlay keeps snapshot after", aapl.after === -0.48 && spcx.after === 0.51);
assert("ticker not in worker keeps snapshot close", msft.live === false && msft.close === 496.37 && msft.name_zh === "微軟");
assert("formatLivePrice does not invent", U.formatLivePrice({ missingLast: true, close: 999 }) === "未取得");

var closedNoCache = U.quoteStatusLine({ session_open: false, fetched_at: null, names: [] }, false, fri1945);
assert("closed no cache copy", closedNoCache.text === "收盤後已停止更新" && closedNoCache.error === false);
var closedCache = U.quoteStatusLine({ session_open: false, fetched_at: Date.parse("2026-08-28T14:42:00.000Z"), asof: Date.parse("2026-08-28T14:42:00.000Z"), names: [] }, false, fri1945);
assert("closed cache copy has last stamp", closedCache.text === "收盤後已停止更新。最後更新至美東時間 10:42" && closedCache.error === false);
var openNow = U.quoteStatusLine({ session_open: true, fetched_at: Date.parse("2026-08-28T14:42:00.000Z"), asof: Date.parse("2026-08-28T14:42:00.000Z") }, false, fri1945);
assert("open success copy", openNow.text === "更新至美東時間 10:42" && openNow.error === false);
var openYesterday = U.quoteStatusLine({ session_open: true, fetched_at: Date.parse("2026-08-27T14:42:00.000Z") }, false, fri1945);
assert("open not-today includes date", openYesterday.text === "更新至美東時間 8/27 10:42");
var failLine = U.quoteStatusLine(null, true, fri1945);
assert("fail copy", failLine.text === "讀不到資料，請稍後再按更新" && failLine.error === true);
var openNoStamp = U.quoteStatusLine({ session_open: true, fetched_at: null }, false, fri1945);
assert("open without stamp does not invent HH:MM", openNoStamp.text === "更新至美東時間未取得" && openNoStamp.text.indexOf(":") === -1);

function memoryKv() {
  return logic.memoryKv();
}

function mockFetch(plan) {
  return async function (url) {
    plan.calls.push(String(url));
    var key = String(url);
    if (plan.byUrl[key]) return plan.byUrl[key]();
    var found = Object.keys(plan.byUrl).find(function (k) { return key.indexOf(k) !== -1; });
    if (found) return plan.byUrl[found]();
    return new Response("missing", { status: 404 });
  };
}

function snapshotResponse() {
  return new Response(JSON.stringify({ names: [{ ticker: "FAKE" }, { ticker: "SPCX" }] }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

function yahooResponse() {
  return new Response(JSON.stringify(yahooOk), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

var closedPlan = { calls: [], byUrl: { "latest.json": snapshotResponse, "chart/FAKE": yahooResponse, "chart/SPCX": yahooResponse } };
var closedHandle = logic.createHandler({
  kv: memoryKv(),
  fetch: mockFetch(closedPlan),
  now: function () { return fri1945; },
  snapshotUrl: "https://taxcodeusstocks.com/content/us-close/latest.json"
});
var closedRes = await closedHandle(new Request("https://us-close.example/quotes", { headers: { Origin: "https://taxcodeusstocks.com" } }));
var closedBody = await closedRes.json();
assert("after close does not hit Yahoo", closedPlan.calls.join(" ").indexOf("finance.yahoo") === -1);
assert("after close returns open false", closedRes.status === 200 && closedBody.ok === true && closedBody.session_open === false && closedBody.reason === "after_close");
assert("after close empty names without cache", Array.isArray(closedBody.names) && closedBody.names.length === 0);
assert("cors allows site origin", closedRes.headers.get("access-control-allow-origin") === "https://taxcodeusstocks.com");

var openKv = memoryKv();
var openPlan = { calls: [], byUrl: { "latest.json": snapshotResponse, "chart/FAKE": yahooResponse } };
var openHandle = logic.createHandler({
  kv: openKv,
  fetch: mockFetch(openPlan),
  now: function () { return fri930; },
  snapshotUrl: "https://taxcodeusstocks.com/content/us-close/latest.json"
});
var openRes = await openHandle(new Request("https://us-close.example/quotes"));
var openBody = await openRes.json();
assert("open fetches snapshot and yahoo", openPlan.calls.some(function (u) { return u.indexOf("latest.json") !== -1; }) && openPlan.calls.some(function (u) { return u.indexOf("finance.yahoo") !== -1; }));
assert("open payload has FAKE last from source", openBody.session_open === true && openBody.fetched === true && openBody.names[0].ticker === "FAKE" && openBody.names[0].last === 10 && openBody.names[0].chg_pct === 25);
assert("open payload SPCX is null", openBody.names[1].ticker === "SPCX" && openBody.names[1].last === null && openBody.names[1].chg_pct === null);

var secondPlan = { calls: [], byUrl: openPlan.byUrl };
var secondHandle = logic.createHandler({
  kv: openKv,
  fetch: mockFetch(secondPlan),
  now: function () { return fri930 + 10 * 60 * 1000; },
  snapshotUrl: "https://taxcodeusstocks.com/content/us-close/latest.json"
});
var secondBody = await (await secondHandle(new Request("https://us-close.example/quotes"))).json();
assert("hourly lock serves cache", secondBody.cached === true && secondBody.fetched === false && secondPlan.calls.length === 0);
assert("cached last is still the source number", secondBody.names[0].last === 10);

var afterKv = memoryKv();
await afterKv.put("quotes", JSON.stringify({
  fetched_at: fri1559,
  session_open: true,
  asof: fri1559,
  names: [{ ticker: "FAKE", last: 10, chg_pct: 25, source: "yahoo-chart" }]
}));
var afterPlan = { calls: [], byUrl: { "latest.json": snapshotResponse, "chart/FAKE": yahooResponse } };
var afterHandle = logic.createHandler({
  kv: afterKv,
  fetch: mockFetch(afterPlan),
  now: function () { return fri1945; },
  snapshotUrl: "https://taxcodeusstocks.com/content/us-close/latest.json"
});
var afterBody = await (await afterHandle(new Request("https://us-close.example/quotes"))).json();
assert("after close rereads cache and does not fetch", afterBody.session_open === false && afterBody.cached === true && afterBody.names[0].last === 10 && afterPlan.calls.length === 0);

var workerSrc = fs.readFileSync(path.join(root, "workers/us-close/src/logic.js"), "utf8");
var pageJs = fs.readFileSync(path.join(root, "js/us-close.js"), "utf8");
assert("worker documents yahoo-chart", workerSrc.indexOf("query1.finance.yahoo.com/v8/finance/chart") !== -1);
assert("page does not scrape yahoo", pageJs.indexOf("query1.finance.yahoo") === -1 && pageJs.indexOf("finance.google") === -1);
assert("page calls us-close worker", pageJs.indexOf("https://us-close.fengyen0812.workers.dev") !== -1);
assert("page has no alert", pageJs.indexOf("alert(") === -1);
assert("page has no 已是最新 as refresh copy", pageJs.indexOf("已是最新") === -1);
assert("page has locked status copy", pageJs.indexOf("更新至美東時間") !== -1 && pageJs.indexOf("收盤後已停止更新") !== -1);
assert("fixtures do not invent a live last", !latest.names.some(function (n) { return n.last != null; }));

if (failed) {
  console.error(failed + " failed");
  process.exit(1);
}
console.log("all ok");
