#!/usr/bin/env node
"use strict";

var fs = require("fs");
var path = require("path");

var failed = 0;
var root = path.join(__dirname, "..");

function assert(name, cond) {
  if (!cond) {
    failed += 1;
    console.error("FAIL " + name);
  } else {
    console.log("ok   " + name);
  }
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function hrefsFor(html, className) {
  var re = new RegExp(
    '<a class="' + className + '" href="([^"]+)">',
    "g"
  );
  var out = [];
  var m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

function resolveTarget(pageRel, href) {
  return path.normalize(path.join(root, path.dirname(pageRel), href));
}

function assertMapped(pageRel, className, expected) {
  var html = read(pageRel);
  var found = hrefsFor(html, className);
  assert(pageRel + " " + className + " count", found.length === expected.length);
  expected.forEach(function (href, i) {
    assert(pageRel + " " + className + " " + (i + 1) + " href", found[i] === href);
    assert(
      pageRel + " " + className + " " + (i + 1) + " file exists",
      fs.existsSync(resolveTarget(pageRel, href))
    );
  });
}

var zhTopics = [
  "articles/apple-etr.html",
  "articles/us-estate-tax-60k.html",
  "articles/irish-etf-pillar-two.html",
  "articles/diy-13f-tracker.html",
  "articles/ai-research-workflow.html"
];
var zhChips = [
  "articles/irish-etf-pillar-two.html",
  "articles/us-estate-tax-60k.html",
  "articles/diy-13f-tracker.html"
];
var zhPillars = [
  "articles/apple-etr.html",
  "articles/us-estate-tax-60k.html",
  "articles/ai-research-workflow.html"
];

["about.html", "en/about.html"].forEach(function (page) {
  assertMapped(page, "topic-card", zhTopics);
});

["index.html", "en/index.html"].forEach(function (page) {
  var html = read(page);
  assert(page + " dropped topic-card boxes", html.indexOf("topic-card") === -1);
  assert(page + " dropped topic-cards list", html.indexOf("topic-cards") === -1);
  assertMapped(page, "chip", zhChips);
  assertMapped(page, "pillar", zhPillars);
  assert(page + " no leftover span.chip", html.indexOf('<span class="chip">') === -1);
  assert(page + " no leftover div.pillar", html.indexOf('<div class="pillar">') === -1);
});

var zhHome = read("index.html");
assert("ZH homepage dropped slogan heading", zhHome.indexOf("稅務議題弄明白，美股報酬最大化") === -1);
assert("ZH homepage has one About heading", (zhHome.match(/關於傑夫哥/g) || []).length >= 1 && (zhHome.match(/<h2 class="section-title">關於傑夫哥<\/h2>/g) || []).length === 1);
assert("ZH writing principles sit in About", zhHome.indexOf("每一個數字標注來源與日期") !== -1);
assert("ZH YouTube sentence sits in About", zhHome.indexOf("稅務 x 美股 x AI 傑夫哥") !== -1 && zhHome.indexOf("about-strip") !== -1);
assert("ZH homepage About comes after latest articles", zhHome.indexOf('id="articles"') < zhHome.indexOf('<h2 class="section-title">關於傑夫哥</h2>'));

var enHome = read("en/index.html");
assert("EN homepage dropped slogan heading", enHome.indexOf("Get the tax issues straight so more of the US-stock return stays yours") === -1);
assert("EN homepage has one About heading", (enHome.match(/<h2 class="section-title">About Jeff<\/h2>/g) || []).length === 1);
assert("EN writing principles sit in About", enHome.indexOf("Every number carries a source and a date") !== -1);
assert("EN YouTube sentence sits in About", enHome.indexOf("YouTube channel") !== -1);

var siteJs = read("js/site.js");
assert("filter bar still injected in place", siteJs.indexOf('bar.className = "filter-bar"') !== -1);
assert("filter buttons stay buttons", siteJs.indexOf('document.createElement("button")') !== -1);

var styleCss = read("css/style.css");
assert("chip keeps gold frame", /\.chip \{[\s\S]*?border:\s*var\(--frame-width-sm\) solid var\(--frame\)/.test(styleCss));
assert("pillar keeps gold frame", /\.pillar \{[\s\S]*?border:\s*var\(--frame-width\) solid var\(--frame\)/.test(styleCss));
assert("linked cards use pointer", /\.chip \{[\s\S]*?cursor:\s*pointer/.test(styleCss) && /\.pillar \{[\s\S]*?cursor:\s*pointer/.test(styleCss));
assert("pillar stamp uses AI x 稅務 gradient", styleCss.indexOf("linear-gradient(90deg, #FFF4CC 0%, #E8EEF6 100%)") !== -1);
assert("pillar stamp uses navy border and inset gold", styleCss.indexOf("border: var(--frame-width-sm) solid #3D5A80") !== -1 && styleCss.indexOf("box-shadow: inset 3px 0 0 #D4A017") !== -1);
assert("pillar stamp is scoped under .pillars", styleCss.indexOf(".pillars .pillar-icon") !== -1);

assert("ZH tax pillar short copy", zhHome.indexOf("Apple 多年 ETR 12-16%。10-K 拆稅務結構。") !== -1);
assert("ZH US pillar short copy", zhHome.indexOf("遺產稅 USD 60k、ADR 股利扣繳、ETF 稅後報酬。") !== -1);
assert("ZH AI pillar short copy", zhHome.indexOf("流程我設計，程式 AI 寫（Python / SEC EDGAR）。") !== -1);
assert("ZH dropped essay questions", zhHome.indexOf("Apple 為什麼多年 ETR") === -1);
assert("EN tax pillar short copy", enHome.indexOf("Apple ETR sat at 12-16% for years. 10-K tax-structure read.") !== -1);
assert("EN US pillar short copy", enHome.indexOf("USD 60k estate tax, ADR withholding, after-tax ETF returns.") !== -1);
assert("EN AI pillar short copy", enHome.indexOf("I design the workflow. AI writes the code (Python / SEC EDGAR).") !== -1);
assert("EN dropped essay questions", enHome.indexOf("Why did Apple's effective tax rate") === -1);

assert("footer YouTube icon stays official red", styleCss.indexOf("a.footer-yt") !== -1);
assert("ZH footer YouTube is the play-button mark", zhHome.indexOf('aria-label="YouTube"') !== -1 && zhHome.indexOf('fill="#FF0000"') !== -1 && zhHome.indexOf(">YouTube<") === -1);
assert("EN footer YouTube is the play-button mark", enHome.indexOf('aria-label="YouTube"') !== -1 && enHome.indexOf('fill="#FF0000"') !== -1 && enHome.indexOf(">YouTube<") === -1);

function walkHtml(dir, acc) {
  fs.readdirSync(dir).forEach(function (name) {
    if (name === ".git" || name === "node_modules") return;
    var full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walkHtml(full, acc);
    else if (name.endsWith(".html")) acc.push(full);
  });
  return acc;
}

var htmlFiles = walkHtml(root, []);
var footerIcon = 'class="footer-yt" href="https://www.youtube.com/@TaxCodeUSStocks"';
htmlFiles.forEach(function (full) {
  var html = fs.readFileSync(full, "utf8");
  if (html.indexOf("site-footer") === -1) return;
  if (html.indexOf("youtube.com/@TaxCodeUSStocks") === -1 && html.indexOf("footer-yt") === -1) return;
  var rel = path.relative(root, full);
  assert(rel + " footer uses red YT icon", html.indexOf(footerIcon) !== -1 && html.indexOf('fill="#FF0000"') !== -1);
  assert(rel + " footer has no YouTube text link", html.indexOf(">YouTube</a>") === -1);
});

if (failed) {
  console.error("\n" + failed + " failed");
  process.exit(1);
}
console.log("\nall passed");
