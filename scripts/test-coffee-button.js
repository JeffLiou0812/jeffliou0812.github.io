#!/usr/bin/env node
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var failed = 0;

function assert(name, cond) {
  if (!cond) {
    failed += 1;
    console.error("FAIL " + name);
  } else {
    console.log("ok   " + name);
  }
}

function runSiteJs(options) {
  var appended = [];
  var created = [];

  function element(tag) {
    var el = {
      tagName: String(tag).toUpperCase(),
      className: "",
      href: "",
      innerHTML: "",
      target: "",
      rel: "",
      textContent: "",
      style: {},
      children: [],
      attributes: {},
      setAttribute: function (k, v) {
        this.attributes[k] = String(v);
      },
      getAttribute: function (k) {
        return this.attributes[k] || null;
      },
      addEventListener: function () {},
      querySelector: function () {
        return null;
      },
      querySelectorAll: function () {
        return [];
      },
      appendChild: function (child) {
        this.children.push(child);
        return child;
      },
      closest: function () {
        return null;
      }
    };
    created.push(el);
    return el;
  }

  var body = element("body");
  body.appendChild = function (child) {
    appended.push(child);
    this.children.push(child);
    return child;
  };

  var document = {
    documentElement: { lang: options.lang || "zh-Hant" },
    currentScript: { src: options.scriptSrc || "https://taxcodeusstocks.com/js/site.js" },
    readyState: "complete",
    body: body,
    head: element("head"),
    createElement: element,
    querySelector: function () {
      return null;
    },
    querySelectorAll: function () {
      return [];
    },
    addEventListener: function () {}
  };

  var window = {
    document: document,
    dataLayer: [],
    location: { pathname: options.pathname || "/" },
    addEventListener: function () {},
    requestAnimationFrame: undefined,
    pageYOffset: 0,
    innerHeight: 800,
    innerWidth: 1280
  };

  var ctx = {
    document: document,
    window: window,
    location: window.location,
    console: console,
    setTimeout: function () {}
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../js/site.js"), "utf8"), ctx);
  return { appended: appended };
}

/* Drop every @media block so a rule can be checked as unconditional. */
function stripMediaBlocks(css) {
  var out = "";
  var i = 0;
  while (i < css.length) {
    var at = css.indexOf("@media", i);
    if (at === -1) {
      out += css.slice(i);
      break;
    }
    out += css.slice(i, at);
    var open = css.indexOf("{", at);
    if (open === -1) break;
    var depth = 1;
    var j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === "{") depth += 1;
      else if (css[j] === "}") depth -= 1;
      j += 1;
    }
    i = j;
  }
  return out;
}

function ruleBody(css, selector) {
  var needle = selector + " {";
  var at = css.lastIndexOf(needle);
  if (at === -1) {
    needle = selector + "{";
    at = css.lastIndexOf(needle);
  }
  if (at === -1) return null;
  var open = css.indexOf("{", at);
  var close = css.indexOf("}", open);
  if (open === -1 || close === -1) return null;
  return css.slice(open + 1, close);
}

var css = fs.readFileSync(path.join(__dirname, "../css/style.css"), "utf8");
var cssNoMedia = stripMediaBlocks(css);
var btnRule = ruleBody(cssNoMedia, ".coffee-btn") || "";

var zh = runSiteJs({ lang: "zh-Hant", scriptSrc: "https://taxcodeusstocks.com/js/site.js" });
var zhBtn = zh.appended.filter(function (el) { return el.className === "coffee-btn"; })[0];

assert("ZH page injects floating coffee button", !!zhBtn);
assert("ZH coffee button links to services #support", zhBtn && zhBtn.href === "https://taxcodeusstocks.com/services.html#support");
assert("ZH coffee button shows a steaming cup", zhBtn && zhBtn.innerHTML.indexOf("coffee-cup") !== -1 && zhBtn.innerHTML.indexOf("coffee-steam") !== -1);
assert("ZH coffee button shows 喝杯咖啡", zhBtn && zhBtn.innerHTML.indexOf("喝杯咖啡") !== -1);
assert("ZH coffee button has accessible name", zhBtn && zhBtn.attributes["aria-label"] === "喝杯咖啡");
assert("ZH placeholder does not open a new tab", zhBtn && !zhBtn.target);

var en = runSiteJs({
  lang: "en",
  scriptSrc: "https://taxcodeusstocks.com/js/site.js",
  pathname: "/en/"
});
var enBtn = en.appended.filter(function (el) { return el.className === "coffee-btn"; })[0];

assert("EN page injects floating coffee button", !!enBtn);
assert("EN coffee button links to EN services #support", enBtn && enBtn.href === "https://taxcodeusstocks.com/en/services.html#support");
assert("EN coffee button has accessible name", enBtn && enBtn.attributes["aria-label"] === "Coffee");
assert("EN coffee button shows Coffee, not 喝杯咖啡", enBtn && enBtn.innerHTML.indexOf(">Coffee<") !== -1 && enBtn.innerHTML.indexOf("喝杯咖啡") === -1);

/* Visual contract: cute steaming cup, label on wide screens, follows scroll. */
assert("CSS styles .coffee-btn outside any media query", !!ruleBody(cssNoMedia, ".coffee-btn"));
assert("Coffee button floats with the viewport", /position:\s*fixed/.test(btnRule));
var markRule = ruleBody(cssNoMedia, ".coffee-mark") || "";
assert("Cup mark is a small circle", /width:\s*56px/.test(markRule) && /height:\s*56px/.test(markRule) && /border-radius:\s*50%/.test(markRule));
assert("Coffee button keeps Warm Expert colors", /var\(--navy\)/.test(markRule) && /var\(--gold\)/.test(markRule));
assert("Desktop keeps the nearby label visible", /display:\s*none/.test(ruleBody(cssNoMedia, ".coffee-text") || "") === false);

assert("Narrow screens hide the label", /@media \(max-width: 640px\)[\s\S]*\.coffee-text \{ display: none; \}/.test(css));
assert("Steam animation is defined", /@keyframes coffee-steam/.test(css));

var siteJs = fs.readFileSync(path.join(__dirname, "../js/site.js"), "utf8");
assert("Cup eases toward the viewport as the page scrolls", siteJs.indexOf("followCoffeeOnScroll") !== -1 && siteJs.indexOf("pageYOffset") !== -1);
assert("Return ease is slower than the previous 0.03 step", /\* 0\.015/.test(siteJs));

if (failed) {
  console.error(failed + " failed");
  process.exit(1);
}
console.log("all passed");
