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

["index.html", "about.html", "en/index.html", "en/about.html"].forEach(function (page) {
  assertMapped(page, "topic-card", zhTopics);
  var html = read(page);
  assert(page + " no leftover unlinked topic-card li", html.indexOf('<li class="topic-card">') === -1);
});

["index.html", "en/index.html"].forEach(function (page) {
  assertMapped(page, "chip", zhChips);
  assertMapped(page, "pillar", zhPillars);
  var html = read(page);
  assert(page + " no leftover span.chip", html.indexOf('<span class="chip">') === -1);
  assert(page + " no leftover div.pillar", html.indexOf('<div class="pillar">') === -1);
});

var siteJs = read("js/site.js");
assert("filter bar still injected in place", siteJs.indexOf('bar.className = "filter-bar"') !== -1);
assert("filter buttons stay buttons", siteJs.indexOf('document.createElement("button")') !== -1);

var styleCss = read("css/style.css");
assert("chip keeps gold frame", /\.chip \{[\s\S]*?border:\s*var\(--frame-width-sm\) solid var\(--frame\)/.test(styleCss));
assert("pillar keeps gold frame", /\.pillar \{[\s\S]*?border:\s*var\(--frame-width\) solid var\(--frame\)/.test(styleCss));
assert("topic-card keeps gold frame", /\.topic-card \{[\s\S]*?border:\s*1px solid var\(--frame\)/.test(styleCss));
assert("linked cards use pointer", /\.chip \{[\s\S]*?cursor:\s*pointer/.test(styleCss) && /\.pillar \{[\s\S]*?cursor:\s*pointer/.test(styleCss) && /\.topic-card \{[\s\S]*?cursor:\s*pointer/.test(styleCss));
assert("last topic card still spans two columns", styleCss.indexOf(".topic-cards > li:last-child { grid-column: 1 / -1; }") !== -1);

if (failed) {
  console.error("\n" + failed + " failed");
  process.exit(1);
}
console.log("\nall passed");
