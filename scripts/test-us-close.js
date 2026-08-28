#!/usr/bin/env node
"use strict";

var fs = require("fs");
var path = require("path");

require("../js/us-close.js");
var U = globalThis.UsClose;
var failed = 0;

function assert(name, cond) {
  if (!cond) {
    failed += 1;
    console.error("FAIL " + name);
  } else {
    console.log("ok   " + name);
  }
}

var root = path.join(__dirname, "..");
var latest = JSON.parse(fs.readFileSync(path.join(root, "content/us-close/latest.json"), "utf8"));
var day = JSON.parse(fs.readFileSync(path.join(root, "content/us-close/2026-08-27.json"), "utf8"));
var indexData = JSON.parse(fs.readFileSync(path.join(root, "content/us-close/index.json"), "utf8"));

assert("latest equals dated fixture", JSON.stringify(latest) === JSON.stringify(day));
assert("schema errors empty", U.validatePayload(latest).join(",") === "");
assert("schema_version is 1", latest.schema_version === 1);
assert("id is Taipei compile date", latest.id === "2026-08-27");
assert("compiled_taipei exact", latest.compiled_taipei === "2026-08-27T07:00:00+08:00");
assert("session_et_date exact", latest.session_et_date === "2026-08-26");
assert("after_hours_asof_et exact", latest.after_hours_asof_et === "2026-08-26T19:10:00-04:00");
assert("headline has no date prefix", latest.headline === "多數上漲");
assert("16 names", latest.names.length === 16);

var expected = [
  ["AAPL", "蘋果", 313.45, 1.15, -0.48],
  ["MSFT", "微軟", 496.37, 0.95, -0.04],
  ["NVDA", "輝達", 209.66, -1.59, 3.91],
  ["AMZN", "亞馬遜", 260.28, -0.3, 0.56],
  ["GOOGL", "谷歌", 342.0, -1.43, 0.24],
  ["META", "Meta", 576.14, 1.07, 0.51],
  ["TSLA", "特斯拉", 345.82, -1.26, 0.46],
  ["SPCX", "SpaceX", 139.63, 1.22, 0.51],
  ["NET", "Cloudflare", 284.89, 2.63, 2.5],
  ["MU", "美光", 938.4, 0.58, 3.5],
  ["NOK", "諾基亞", 10.41, 0.58, 3.27],
  ["SNDK", "SanDisk", 1499.37, 1.26, 3.53],
  ["TSM", "台積電", 417.69, 0.07, 1.44],
  ["GLW", "康寧", 152.78, 3.82, 2.42],
  ["CAT", "卡特彼勒", 821.93, 1.31, 0.75],
  ["AVGO", "博通", 355.59, -0.32, 0.84]
];
expected.forEach(function (row, i) {
  var n = latest.names[i];
  assert(
    "name " + row[0],
    n.ticker === row[0] &&
      n.name_zh === row[1] &&
      n.close === row[2] &&
      n.chg_pct === row[3] &&
      n.after === row[4]
  );
});

assert(
  "NVIDIA IR url is official",
  U.isOfficialOvernightUrl(
    "https://nvidianews.nvidia.com/news/nvidia-announces-financial-results-for-second-quarter-fiscal-2027"
  )
);
assert("twitter is not official", U.isOfficialOvernightUrl("https://twitter.com/nvidia/status/1") === false);
assert("x.com is not official", U.isOfficialOvernightUrl("https://x.com/nvidia") === false);
assert("http social-looking company blog rejected if social host", U.isOfficialOvernightUrl("https://facebook.com/nvidia") === false);
assert("overnight count is 1", latest.overnight.length === 1);
assert("fixture overnight visible", U.shouldShowOvernight(latest.overnight) === true);
assert("empty overnight hides section", U.shouldShowOvernight([]) === false);
assert("null overnight hides section", U.shouldShowOvernight(null) === false);
assert(
  "social-only overnight hides section",
  U.shouldShowOvernight([{ title: "nope", url: "https://x.com/foo" }]) === false
);

assert("missing date falls back to latest", U.resolveDateId("", indexData, latest) === "2026-08-27");
assert("unknown date falls back to latest", U.resolveDateId("1999-01-01", indexData, latest) === "2026-08-27");
assert("known date kept", U.resolveDateId("2026-08-27", indexData, latest) === "2026-08-27");
assert("index lists fixture", indexData.items[0].id === "2026-08-27" && indexData.items[0].headline === "多數上漲");

assert("homepage line uses ET session date", U.formatHomepageLine("2026-08-26", "多數上漲") === "美東 8/26：多數上漲");
assert("homepage line never says 今日", U.formatHomepageLine("2026-08-26", "多數上漲").indexOf("今日") === -1);
assert("null after renders dash", U.formatPct(null) === "—");
assert("positive pct has plus", U.formatPct(1.15) === "+1.15%");

var bolded = U.boldCompanyNames("上漲：康寧 +3.82%、Cloudflare +2.63%、卡特彼勒 +1.31%", latest.names);
assert("bold 康寧", bolded.indexOf("<strong>康寧</strong>") !== -1);
assert("bold Cloudflare", bolded.indexOf("<strong>Cloudflare</strong>") !== -1);
assert("bold 卡特彼勒", bolded.indexOf("<strong>卡特彼勒</strong>") !== -1);

assert("caveat present", latest.overnight[0].caveat.indexOf("中國資料中心運算收入") !== -1);
assert("calendar has 10 confirmed items", latest.calendar.length === 10);
assert("calendar first is 初領", latest.calendar[0].item === "初領失業金" && latest.calendar[0].date_et === "2026-08-27");
assert("calendar FOMC taipei next day", latest.calendar[7].date_taipei === "2026-09-17");

assert("section 摘要", U.SECTION.summary === "摘要");
assert("section Breaking News", U.SECTION.overnight === "Breaking News");
assert("section table heading 美股焦點", U.SECTION.names === "美股焦點");
assert("overnight heading is not 隔夜", U.SECTION.overnight !== "隔夜");

var win = U.calendarWindow(latest);
assert("window is Aug then Sep 2026", win.length === 2 && win[0].year === 2026 && win[0].month === 8 && win[1].year === 2026 && win[1].month === 9);

var emptyCal = {
  id: "2026-08-27",
  compiled_taipei: latest.compiled_taipei,
  calendar: []
};
var emptyMonths = U.calendarMonths(emptyCal);
assert("empty calendar still two months", emptyMonths.length === 2);
assert("empty Aug has no marks", emptyMonths[0].cells.every(function (c) { return !c.labels || c.labels.length === 0; }));
assert("empty Sep has no marks", emptyMonths[1].cells.every(function (c) { return !c.labels || c.labels.length === 0; }));

var months = U.calendarMonths(latest);
var byEt = U.groupCalendarByEtDate(latest.calendar);
assert("groups still use date_et", byEt["2026-08-27"][0].item === "初領失業金");
assert("9/16 has two ET items", byEt["2026-09-16"].length === 2);
assert("short 初領", U.shortCalendarLabel(latest.calendar[0]) === "初領");
assert("short FOMC", U.shortCalendarLabel(latest.calendar[7]) === "FOMC");

function labelsOn(monthGrid, day) {
  var cell = monthGrid.cells.filter(function (c) { return !c.empty && c.day === day; })[0];
  return cell ? cell.labels.join(",") : "";
}
assert("Aug 27 marked 初領", labelsOn(months[0], 27) === "初領");
assert("Sep 1 marked ISM", labelsOn(months[1], 1) === "ISM");
assert("Sep 2 marked 博通Q3", labelsOn(months[1], 2) === "博通Q3");
assert("Sep 16 has 零售 and FOMC", labelsOn(months[1], 16) === "零售,FOMC");
assert("Sep 30 has GDP and PCE", labelsOn(months[1], 30) === "GDP,PCE");
assert("Aug 1 unmarked", labelsOn(months[0], 1) === "");

var html = fs.readFileSync(path.join(root, "us-close.html"), "utf8");
assert("html h1 stays 美股焦點", /<h1>美股焦點<\/h1>/.test(html));
assert("html heading 摘要", html.indexOf(">摘要<") !== -1);
assert("html heading 美股焦點 table", html.indexOf("id=\"close-names-title\">美股焦點<") !== -1);
assert("html keeps 本月與下月", html.indexOf("本月與下月即將公布總經／財報") !== -1);
assert("html has no 今日", html.indexOf("今日") === -1);
assert("html does not hardcode 結論 heading", html.indexOf(">結論<") === -1);
assert("html does not hardcode 16 檔", html.indexOf("16 檔收盤快照") === -1);

var indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert("hero 昨夜美股 links us-close", /hero-close-box"[^>]*href="us-close.html"/.test(indexHtml) && indexHtml.indexOf(">昨夜美股<") !== -1);
assert("hero 昨夜美股 has no 今日", (indexHtml.match(/hero-close-box[\s\S]*?<\/a>/) || [""])[0].indexOf("今日") === -1);
assert("tools card 美股焦點 kept", indexHtml.indexOf("tool-promo-close") !== -1 && indexHtml.indexOf(">打開美股焦點<") !== -1);

function navBlock(html) {
  var m = html.match(/<nav class="main-nav"[^>]*>([\s\S]*?)<\/nav>/);
  return m ? m[1] : "";
}
function afterTaxBeforeClose(html) {
  var nav = navBlock(html).replace(/\s+/g, " ");
  return /稅訊<\/a>\s*<a href="[^"]*us-close\.html[^"]*"[^>]*>美股焦點<\/a>/.test(nav);
}
assert("index nav 稅訊 then 美股焦點", afterTaxBeforeClose(indexHtml));
assert("us-close nav active 美股焦點", /us-close\.html" class="active"[^>]*>美股焦點</.test(navBlock(html)));
assert("us-close nav has no extra 今日", navBlock(html).indexOf("今日") === -1);

var enIndex = fs.readFileSync(path.join(root, "en/index.html"), "utf8");
assert("EN header has no 美股焦點", navBlock(enIndex).indexOf("美股焦點") === -1);
assert("EN header still has Tax Brief", navBlock(enIndex).indexOf("Tax Brief") !== -1);

var articleNav = fs.readFileSync(path.join(root, "articles/apple-etr.html"), "utf8");
assert("article nav 稅訊 then 美股焦點", afterTaxBeforeClose(articleNav));
assert("article close href is ../us-close.html", navBlock(articleNav).indexOf('href="../us-close.html"') !== -1);

if (failed) {
  console.error(failed + " failed");
  process.exit(1);
}
console.log("all ok");
