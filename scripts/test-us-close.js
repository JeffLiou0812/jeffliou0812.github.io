#!/usr/bin/env node
"use strict";

var fs = require("fs");
var path = require("path");

require("../js/us-close.js");
require("../js/home-focus.js");
var U = globalThis.UsClose;
var H = globalThis.HomeFocus;
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
assert("us-close uses 資訊分享 not 教育整理", html.indexOf("資訊分享，不是投資建議") !== -1 && html.indexOf("教育整理") === -1);
assert("html does not hardcode 結論 heading", html.indexOf(">結論<") === -1);
assert("html does not hardcode 16 檔", html.indexOf("16 檔收盤快照") === -1);

var indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert("hero 昨夜美股 links us-close", /hero-close-box"[^>]*href="us-close.html"/.test(indexHtml) && indexHtml.indexOf(">昨夜美股<") !== -1);
assert("hero 昨夜美股 has no 今日", (indexHtml.match(/hero-close-box[\s\S]*?<\/a>/) || [""])[0].indexOf("今日") === -1);
assert("tools card 美股焦點 kept", indexHtml.indexOf("tool-promo-close") !== -1 && indexHtml.indexOf(">打開美股焦點<") !== -1);
assert("ZH tools heading kept", indexHtml.indexOf(">互動工具<") !== -1);
assert("ZH tools lead sentence removed", indexHtml.indexOf("試算稅負，或掃今日官方發布") === -1);
assert("ZH homepage uses 資訊分享 not 教育整理", indexHtml.indexOf("資訊分享，不是稅務意見") !== -1 && indexHtml.indexOf("教育整理") === -1);
assert("ZH footer still says 教育性質", indexHtml.indexOf("教育性質與個人觀點分享") !== -1);

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
assert("EN nav Tax Brief then US Focus", /Tax Brief<\/a>\s*<a href="[^"]*us-close\.html[^"]*"[^>]*>US Focus<\/a>/.test(navBlock(enIndex).replace(/\s+/g, " ")));
assert("EN header has no Chinese nav labels", !/[稅訊首頁文章服務關於官方資源美股焦點]/.test(navBlock(enIndex)));
assert("EN hero Last night's US stocks", /hero-close-box"[^>]*href="\.\.\/us-close.html"/.test(enIndex) && enIndex.indexOf(">Last night's US stocks<") !== -1);
assert("EN tools heading kept", enIndex.indexOf(">Interactive Tools<") !== -1);
assert("EN tools lead sentence removed", enIndex.indexOf("Run a tax estimate, or scan today's official releases") === -1);
assert("EN keeps Educational compilation", enIndex.indexOf("Educational compilation, not tax advice") !== -1);

var articleNav = fs.readFileSync(path.join(root, "articles/apple-etr.html"), "utf8");
assert("article nav 稅訊 then 美股焦點", afterTaxBeforeClose(articleNav));
assert("article close href is ../us-close.html", navBlock(articleNav).indexOf('href="../us-close.html"') !== -1);

assert("focus formatCloseSession is 美東 M/D", H.formatCloseSession("2026-08-26") === "美東 8/26");
assert("focus formatCloseSession EN is ET M/D", H.formatCloseSession("2026-08-26", "en") === "ET 8/26");
assert("focus session never says 今日", H.formatCloseSession("2026-08-26").indexOf("今日") === -1);
assert("focus EN session never says Today", H.formatCloseSession("2026-08-26", "en").indexOf("Today") === -1);
assert("focus empty session is blank", H.formatCloseSession("") === "");
assert("focus pct plus", H.formatPct(3.82) === "+3.82%");
assert("focus pct minus", H.formatPct(-1.59) === "-1.59%");

var movers = H.closeCardModel(latest);
assert("focus close model session", movers.session === "美東 8/26");
assert("focus close model no 今日", JSON.stringify(movers).indexOf("今日") === -1);
assert("focus 漲最多 is 康寧", movers.up && movers.up.name_zh === "康寧" && movers.up.chg_pct === 3.82);
assert("focus 跌最重 is 輝達", movers.down && movers.down.name_zh === "輝達" && movers.down.chg_pct === -1.59);
assert("focus fixture shows Breaking News", H.shouldShowBreaking(latest.overnight) === true);
assert("focus empty overnight hides breaking", H.shouldShowBreaking([]) === false);
assert("focus null overnight hides breaking", H.shouldShowBreaking(null) === false);
assert("focus social overnight hides breaking", H.shouldShowBreaking([{ title: "nope", url: "https://x.com/foo" }]) === false);

var taxItems = [
  { title: "today A", url: "https://example.com/a", date: "2026-08-28" },
  { title: "today B", url: "https://example.com/b", date: "2026-08-28" },
  { title: "yest C", url: "https://example.com/c", date: "2026-08-27" },
  { title: "old D", url: "https://example.com/d", date: "2026-08-26" }
];
var taxCounts = H.countTaxByDay(taxItems, "2026-08-28", "2026-08-27");
assert("focus tax today count", taxCounts.today === 2);
assert("focus tax yesterday count", taxCounts.yesterday === 1);
var picked = H.pickTaxTitles(taxItems, "2026-08-28", "2026-08-27");
assert("focus tax titles max 2 today first", picked.length === 2 && picked[0].title === "today A" && picked[1].title === "today B");
assert("focus tax zero allowed", H.countTaxByDay([], "2026-08-28", "2026-08-27").today === 0);

var focusHtml = indexHtml;
var taxCard = (focusHtml.match(/id="home-focus-tax"[\s\S]*?<\/article>/) || [""])[0];
var closeCard = (focusHtml.match(/id="home-focus-close"[\s\S]*?<\/article>/) || [""])[0];
var focusSection = (focusHtml.match(/id="home-focus"[\s\S]*?<\/section>/) || [""])[0];
assert("homepage has 焦點儀表 strip", /id="home-focus"/.test(focusHtml) && focusHtml.indexOf("焦點儀表") !== -1);
assert("focus chrome has three pillars", focusSection.indexOf("稅務 · 美股 · AI") !== -1);
assert("focus workflow is 工作流", /href="ai-workflow-case.html">工作流</.test(focusSection));
assert("focus two cards only", (focusSection.match(/class="home-focus-card"/g) || []).length === 2);
assert("tax card title 當天稅訊", taxCard.indexOf("當天稅訊") !== -1);
assert("tax card links brief.html", /href="brief.html\?lang=zh"/.test(taxCard));
assert("tax card may say 今天", taxCard.indexOf("今天") !== -1);
assert("close card title 當天美股焦點", closeCard.indexOf("當天美股焦點") !== -1);
assert("close card links us-close", /href="us-close.html"/.test(closeCard));
assert("close card has no 今日", closeCard.indexOf("今日") === -1);
assert("close breaking starts hidden", /id="home-focus-breaking"[^>]*hidden/.test(closeCard));
assert("EN homepage has focus instrument", /id="home-focus"/.test(enIndex) && enIndex.indexOf("Focus instrument") !== -1);
assert("EN homepage has no 焦點儀表 label", enIndex.indexOf("焦點儀表") === -1);
assert("EN chrome is Tax · US stocks · AI", enIndex.indexOf("Tax · US stocks · AI") !== -1);
assert("EN tax card links lang=en", /href="\.\.\/brief.html\?lang=en"/.test(enIndex));
assert("EN close card has no Today", ((enIndex.match(/id="home-focus-close"[\s\S]*?<\/article>/) || [""])[0]).indexOf("Today") === -1);
assert("EN close card never says 今日", ((enIndex.match(/id="home-focus-close"[\s\S]*?<\/article>/) || [""])[0]).indexOf("今日") === -1);
assert("EN workflow links ai-workflow-case", /href="ai-workflow-case.html">Workflow</.test(enIndex));
assert("focus below hero above pillars", /<\/section>\s*<section class="home-focus"[\s\S]*<\/section>\s*<main>[\s\S]*三個面向/.test(focusHtml));
assert("EN focus below hero above pillars", /<\/section>\s*<section class="home-focus"[\s\S]*<\/section>\s*<main>[\s\S]*Three Pillars/.test(enIndex));

function skeletonBits(card) {
  return {
    head: card.indexOf("home-focus-card-head") !== -1,
    title: /<h2>/.test(card),
    metrics: (card.match(/class="home-focus-stat(?:\s|")/g) || []).length,
    body: card.indexOf("home-focus-body") !== -1,
    foot: card.indexOf("home-focus-foot") !== -1
  };
}
var taxSkel = skeletonBits(taxCard);
var closeSkel = skeletonBits(closeCard);
assert("tax skeleton head title metrics body foot", taxSkel.head && taxSkel.title && taxSkel.metrics === 2 && taxSkel.body && taxSkel.foot);
assert("close skeleton matches tax", closeSkel.head && closeSkel.title && closeSkel.metrics === 2 && closeSkel.body && closeSkel.foot);
assert("tax metrics are 今天 and 昨天", taxCard.indexOf(">今天<") !== -1 && taxCard.indexOf(">昨天<") !== -1);
assert("close metrics are 漲最多 and 跌最重", closeCard.indexOf(">漲最多<") !== -1 && closeCard.indexOf(">跌最重<") !== -1);
assert("close movers live in metric cells", closeCard.indexOf('id="home-focus-up"') !== -1 && closeCard.indexOf("home-focus-stat is-up") !== -1);
assert("close no leftover chip tiles", closeCard.indexOf("home-focus-chip is-up") === -1 && closeCard.indexOf("home-focus-movers") === -1);
assert("focus cards have no em dash", taxCard.indexOf("\u2014") === -1 && closeCard.indexOf("\u2014") === -1);

var focusCss = fs.readFileSync(path.join(root, "css/home-focus.css"), "utf8");
var cardRule = (focusCss.match(/\.home-focus-card\s*\{[\s\S]*?\}/) || [""])[0];
assert("one shared card frame rule", (focusCss.match(/\.home-focus-card\s*\{/g) || []).length === 1);
assert("cards share min-height", /min-height:\s*var\(--hf-card-min\)/.test(cardRule) && /--hf-card-min:\s*[\d.]+rem/.test(focusCss));
assert("cards share padding radius border", /padding:\s*var\(--hf-card-pad\)/.test(cardRule) && /border-radius:\s*8px/.test(cardRule) && /border:\s*var\(--frame-width\) solid var\(--frame\)/.test(cardRule));
assert("grid stretches twins", /align-items:\s*stretch/.test(focusCss));
assert("foot pinned to bottom", /margin-top:\s*auto/.test(focusCss));
assert("stat tiles use warm white and gold", /\.home-focus-stat\s*\{[\s\S]*background:\s*var\(--card\)/.test(focusCss) && /\.home-focus-stat\s*\{[\s\S]*border:\s*var\(--frame-width-sm\) solid var\(--frame\)/.test(focusCss));
assert("cta uses EN chip recipe", /\.home-focus-cta\s*\{[\s\S]*border:\s*var\(--frame-width-sm\) solid var\(--frame\)/.test(focusCss) && /\.home-focus-cta\s*\{[\s\S]*background:\s*var\(--card\)/.test(focusCss) && /\.home-focus-cta\s*\{[\s\S]*border-radius:\s*var\(--radius-pill\)/.test(focusCss));
assert("focus title is a real heading size", /\.home-focus-kicker\s*\{[\s\S]*font-size:\s*1\.(3[5-9]|4|5)/.test(focusCss) && /\.home-focus-kicker\s*\{[\s\S]*font-weight:\s*700/.test(focusCss));
assert("focus cards have no top rail", focusCss.indexOf(".home-focus-card::before") === -1 && firstRule(focusCss, ".home-focus-card").indexOf("border-top") === -1);
assert("focus strip has HUD hairline grid", focusCss.indexOf("repeating-linear-gradient") !== -1);

var styleCss = fs.readFileSync(path.join(root, "css/style.css"), "utf8");
assert("lang-switch still white gold pill", /\.lang-switch\s*\{[\s\S]*border:\s*1px solid var\(--gold\)/.test(styleCss) && /\.lang-switch\s*\{[\s\S]*background:\s*var\(--card\)/.test(styleCss) && /\.lang-switch\s*\{[\s\S]*border-radius:\s*999px/.test(styleCss));
assert("hero pair shares secondary pill chrome", /\.btn,\s*\n\.hero-close-box\s*\{[\s\S]*min-height:\s*2\.6rem/.test(styleCss) && /\.btn-secondary,\s*\n\.hero-close-box\s*\{[\s\S]*border-color:\s*var\(--frame\)/.test(styleCss));
assert("palette tokens locked", /--card:\s*#FFFCF7/.test(styleCss) && /--frame:\s*#C9955A/.test(styleCss) && /--navy:\s*#1A2B3D/.test(styleCss) && /--terra:\s*#D06A3A/.test(styleCss) && /--ink:\s*#2A241F/.test(styleCss) && /--bg:\s*#F4ECE8/.test(styleCss) && /--up:\s*#1F6B45/.test(styleCss) && /--red:\s*#B42318/.test(styleCss));
assert("no navy stacked promo bars", !/linear-gradient\(135deg,\s*var\(--navy\)/.test(styleCss) && !/linear-gradient\(135deg,\s*#3d5348/.test(styleCss));
assert("large cards share gold frame", /\.pillar\s*\{[\s\S]*border:\s*var\(--frame-width\) solid var\(--frame\)/.test(styleCss) && /\.card\s*\{[\s\S]*border:\s*var\(--frame-width\) solid var\(--frame\)/.test(styleCss) && /\.tool-promo\s*\{[\s\S]*border:\s*var\(--frame-width\) solid var\(--frame\)/.test(styleCss));
function firstRule(css, sel) {
  var re = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\{([\\s\\S]*?)\\}");
  var m = css.match(re);
  return m ? m[1] : "";
}
var chromeRule = firstRule(focusCss, ".home-focus-chrome");
var stripRule = firstRule(focusCss, ".home-focus");
assert("chrome has no gold/tan bottom bar", !/border-bottom/.test(chromeRule));
assert("strip has no gold top/bottom bars", !/border-top/.test(stripRule) && !/border-bottom/.test(stripRule) && stripRule.indexOf("gold") === -1);
var breakingRule = firstRule(focusCss, ".home-focus-breaking");
assert("breaking box has no gold top rule", breakingRule.indexOf("border-top") === -1 && breakingRule.indexOf("--frame") === -1 && breakingRule.indexOf("gold") === -1);
var primaryRule = firstRule(styleCss, ".btn-primary");
var promoBtnRule = firstRule(styleCss, ".tool-promo .btn");
assert("primary button is navy not gold fill", /background:\s*var\(--navy\)/.test(primaryRule) && !/background:\s*var\(--gold\)/.test(primaryRule) && /background:\s*var\(--navy\)/.test(promoBtnRule));

var focusJs = fs.readFileSync(path.join(root, "js/home-focus.js"), "utf8");
assert("tax feed url unchanged", focusJs.indexOf('TAX_FEED = "https://tax-brief.fengyen0812.workers.dev/feed?countries=tw,us"') !== -1);
assert("close json still latest.json", focusJs.indexOf("content/us-close/latest.json") !== -1);
assert("empty mover stays visible", focusJs.indexOf("el.hidden = true") === -1);

var closeCss = fs.readFileSync(path.join(root, "css/us-close.css"), "utf8");
assert("table wrap scrolls horizontally", /\.close-table-wrap\s*\{[\s\S]*overflow-x:\s*auto/.test(closeCss));
assert("table uses separate collapse", /\.close-table\s*\{[\s\S]*border-collapse:\s*separate/.test(closeCss));
var tableRule = firstRule(closeCss, ".close-table");
assert("table itself has no gold frame", tableRule.indexOf("--frame") === -1 && tableRule.indexOf("border-radius") === -1 && /border-collapse:\s*separate/.test(tableRule));
assert("calendar day is compact 6px 1px", /\.close-cal-day\s*\{[\s\S]*border-radius:\s*6px/.test(closeCss) && /\.close-cal-day\s*\{[\s\S]*border:\s*1px solid var\(--line\)/.test(closeCss));
assert("calendar stays 7 columns", /grid-template-columns:\s*repeat\(7,/.test(closeCss));
assert("calendar labels do not wrap cells", /\.close-cal-label\s*\{[\s\S]*white-space:\s*nowrap/.test(closeCss));

var zhPillars = (indexHtml.match(/<div class="pillars">[\s\S]*?<h2 class="section-title">互動工具/) || [""])[0];
assert("ZH pillar boxes are 稅務 美股 AI", zhPillars.indexOf(">稅務<") !== -1 && zhPillars.indexOf(">美股<") !== -1 && /class="pillar-icon"[^>]*>AI</.test(zhPillars));
assert("ZH pillars have no leftover h3 titles", zhPillars.indexOf("<h3>") === -1);
assert("ZH pillar body copy kept", zhPillars.indexOf("Apple 為什麼多年 ETR") !== -1 && zhPillars.indexOf("遺產稅 USD 60,000") !== -1 && zhPillars.indexOf("13F 追蹤") !== -1);

var enPillars = (enIndex.match(/<div class="pillars">[\s\S]*?<h2 class="section-title">Interactive Tools/) || [""])[0];
assert("EN pillar boxes are Tax US AI", enPillars.indexOf(">Tax<") !== -1 && enPillars.indexOf(">US<") !== -1 && /class="pillar-icon"[^>]*>AI</.test(enPillars));
assert("EN pillars have no leftover h3 titles", enPillars.indexOf("<h3>") === -1);
assert("EN pillar body copy kept", enPillars.indexOf("effective tax rate") !== -1 && enPillars.indexOf("USD 60,000") !== -1 && enPillars.indexOf("13F tracking") !== -1);

var aboutZh = fs.readFileSync(path.join(root, "about.html"), "utf8");
var aboutEn = fs.readFileSync(path.join(root, "en/about.html"), "utf8");
assert("ZH about heading updated", aboutZh.indexOf("稅務議題弄明白，美股報酬最大化") !== -1);
assert("ZH about dropped old heading", aboutZh.indexOf("這個網站寫什麼") === -1);
assert("ZH homepage has the same heading", indexHtml.indexOf("稅務議題弄明白，美股報酬最大化") !== -1);
assert("ZH homepage has five topic cards", (indexHtml.match(/class="topic-card"/g) || []).length === 5);
assert("ZH homepage keeps principles and YouTube", indexHtml.indexOf("寫作原則") !== -1 && indexHtml.indexOf("稅務 x 美股 x AI 傑夫哥") !== -1);
assert("ZH homepage heading is not the hero h1", /<h1>把稅務講清楚，讓美股報酬留在自己口袋<\/h1>/.test(indexHtml));
assert("EN homepage matching heading", enIndex.indexOf("Get the tax issues straight so more of the US-stock return stays yours") !== -1);
assert("EN about matching heading", aboutEn.indexOf("Get the tax issues straight so more of the US-stock return stays yours") !== -1);
assert("EN headings have no em dash", enIndex.indexOf("\u2014") === -1 && aboutEn.indexOf("\u2014") === -1);
assert("ZH about has five topic cards", (aboutZh.match(/class="topic-card"/g) || []).length === 5);
assert("ZH about keeps writing principles and YouTube", aboutZh.indexOf("寫作原則") !== -1 && aboutZh.indexOf("稅務 x 美股 x AI 傑夫哥") !== -1 && aboutZh.indexOf("youtube.com/@TaxCodeUSStocks") !== -1);
assert("EN about has five topic cards", (aboutEn.match(/class="topic-card"/g) || []).length === 5);
assert("EN about keeps principles and YouTube link", aboutEn.indexOf("Writing principles") !== -1 && /youtube.com\/@TaxCodeUSStocks[^>]*>YouTube channel</.test(aboutEn));
assert("topic cards use cream gold radius", /\.topic-card\s*\{[\s\S]*background:\s*var\(--card\)/.test(styleCss) && /\.topic-card\s*\{[\s\S]*border:\s*1px solid var\(--frame\)/.test(styleCss) && /\.topic-card\s*\{[\s\S]*border-radius:\s*var\(--radius\)/.test(styleCss));
assert("topic cards stack on mobile", /\.topic-cards\s*\{[\s\S]*grid-template-columns:\s*1fr;/.test(styleCss));

var siteJs = fs.readFileSync(path.join(root, "js/site.js"), "utf8");
assert("filter buttons get data-category", siteJs.indexOf('b.setAttribute("data-category", label)') !== -1);
assert("ZH AI x 稅務 tag has data-category", indexHtml.indexOf('class="tag" data-category="AI x 稅務"') !== -1);
assert("EN AI x Tax tag has data-category", enIndex.indexOf('class="tag" data-category="AI x Tax"') !== -1);
assert("tax-only pills use warm yellow", styleCss.indexOf('data-category="跨境稅務"') !== -1 && styleCss.indexOf("#FFF4CC") !== -1 && styleCss.indexOf("#D4A017") !== -1);
assert("AI-only pills use slate blue", styleCss.indexOf("#E8EEF6") !== -1 && styleCss.indexOf("#3D5A80") !== -1);
assert("AI x 稅務 is mixed yellow-blue", /data-category="AI x 稅務"[\s\S]*linear-gradient\(90deg, #FFF4CC/.test(styleCss));
assert("selected filter stays navy contrast", /\.filter-bar button\.active[\s\S]*background:\s*var\(--navy\)/.test(styleCss));
assert("Resources tag is not categorized", indexHtml.indexOf('class="tag">資源<') !== -1 && enIndex.indexOf('class="tag">Resources<') !== -1);
assert("about-strip paragraphs have room", /\.about-strip p[\s\S]*margin:\s*0 0 1\.(1|2|3|4)/.test(styleCss));
assert("about heading kept", indexHtml.indexOf(">關於傑夫哥<") !== -1);
assert("about 實作案例 stays on about page", aboutZh.indexOf("實作案例") !== -1 && aboutZh.indexOf("ai-workflow-case.html") !== -1);
assert("homepage keeps 實作案例 link", /href="ai-workflow-case.html">實作案例/.test(indexHtml));
assert("EN homepage keeps hands-on case link", /href="ai-workflow-case.html">Hands-on case/.test(enIndex));

if (failed) {
  console.error(failed + " failed");
  process.exit(1);
}
console.log("all ok");
