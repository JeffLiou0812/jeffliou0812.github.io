#!/usr/bin/env node
"use strict";

require("../js/brief-sources.js");
var S = globalThis.BriefSources;
var failed = 0;

function assert(name, cond) {
  if (!cond) {
    failed += 1;
    console.error("FAIL " + name);
  } else {
    console.log("ok   " + name);
  }
}

assert("Singapore has IRAS, not IRS/FR", S.sourcesForCountry("sg").every(function (src) {
  return src.key !== "ir" && src.key !== "fr" && src.sourceEn === "IRAS";
}));

assert("US keeps IRS and Federal Register", S.sourcesForCountry("us").map(function (s) { return s.key; }).join(",") === "ir,fr");

assert("Taiwan has no IRS/FR", S.sourcesForCountry("tw").every(function (src) {
  return src.key !== "ir" && src.key !== "fr";
}));

assert("sectionAllowed ir for sg is false", S.sectionAllowed("ir", ["sg"]) === false);
assert("sectionAllowed fr for sg is false", S.sectionAllowed("fr", ["sg"]) === false);
assert("sectionAllowed ir for us is true", S.sectionAllowed("ir", ["us"]) === true);
assert("sectionAllowed fr for hk,sg is false", S.sectionAllowed("fr", ["hk", "sg"]) === false);

var mixed = [
  { country: "us", kind: "ir", title: "IRS note" },
  { country: "us", kind: "fr", title: "Federal Register" },
  { country: "sg", kind: "news", title: "IRAS note" },
  { country: "sg", kind: "ir", title: "mis-tagged IRS under SG" },
  { country: "hk", kind: "news", title: "IRD note" }
];

var sgOnly = S.filterItemsByCountries(mixed, ["sg"]);
assert("SG filter keeps IRAS only", sgOnly.length === 1 && sgOnly[0].title === "IRAS note");
assert("SG filter drops IRS/FR", sgOnly.every(function (it) { return it.kind !== "ir" && it.kind !== "fr"; }));

var usOnly = S.filterItemsByCountries(mixed, ["us"]);
assert("US filter keeps IRS and FR", usOnly.length === 2);
assert("US filter drops IRAS", usOnly.every(function (it) { return it.country === "us"; }));

S.APAC.forEach(function (code) {
  assert(code + " has a local source and no IRS/FR", S.sourcesForCountry(code).length > 0 && S.sourcesForCountry(code).every(function (src) {
    return src.key !== "ir" && src.key !== "fr";
  }));
});

if (failed) {
  console.error(failed + " failed");
  process.exit(1);
}
console.log("all passed");
