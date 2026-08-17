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
    addEventListener: function () {}
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

var zh = runSiteJs({ lang: "zh-Hant", scriptSrc: "https://taxcodeusstocks.com/js/site.js" });
var zhBtn = zh.appended.filter(function (el) { return el.className === "coffee-btn"; })[0];

assert("ZH page injects floating coffee cup", !!zhBtn);
assert("ZH coffee cup links to services #support", zhBtn && zhBtn.href === "https://taxcodeusstocks.com/services.html#support");
assert("ZH coffee cup is an icon, not a text pill", zhBtn && zhBtn.innerHTML.indexOf("coffee-cup") !== -1 && zhBtn.innerHTML.indexOf("Buy me a coffee") === -1);
assert("ZH coffee cup has accessible name", zhBtn && zhBtn.attributes["aria-label"] === "支持這個網站");
assert("ZH placeholder does not open a new tab", zhBtn && !zhBtn.target);

var en = runSiteJs({
  lang: "en",
  scriptSrc: "https://taxcodeusstocks.com/js/site.js",
  pathname: "/en/"
});
var enBtn = en.appended.filter(function (el) { return el.className === "coffee-btn"; })[0];

assert("EN page injects floating coffee cup", !!enBtn);
assert("EN coffee cup links to EN services #support", enBtn && enBtn.href === "https://taxcodeusstocks.com/en/services.html#support");
assert("EN coffee cup has accessible name", enBtn && enBtn.attributes["aria-label"] === "Support this site");

if (failed) {
  console.error(failed + " failed");
  process.exit(1);
}
console.log("all passed");
