#!/usr/bin/env node
"use strict";

require("../js/brief-sources.js");
require("../js/brief-filters.js");

var S = globalThis.BriefSources;
var F = globalThis.BriefFilters;
var failed = 0;

function assert(name, cond) {
  if (!cond) {
    failed += 1;
    console.error("FAIL " + name);
  } else {
    console.log("ok   " + name);
  }
}

var state = F.initialFilterState(S.APAC);
assert("default selection is Taiwan only", F.selectedCountries(state, S.APAC, S.sourcesForCountry).join(",") === "tw");
assert("default Taiwan chip on", state.groups.tw === true && state.groups.us === false && state.groups.apac === false);

F.selectMainGroup(state, "us", S.APAC, S.sourcesForCountry);
assert("selecting US turns Taiwan off", state.groups.tw === false && state.groups.us === true && state.groups.apac === false);
assert("US-only countries", F.selectedCountries(state, S.APAC, S.sourcesForCountry).join(",") === "us");

F.selectMainGroup(state, "us", S.APAC, S.sourcesForCountry);
assert("re-clicking US is a no-op stay-on", state.groups.us === true && state.groups.tw === false);

F.selectMainGroup(state, "apac", S.APAC, S.sourcesForCountry);
assert("selecting APAC turns US off", state.groups.us === false && state.groups.apac === true && state.groups.tw === false);
var first = F.firstApacCode(S.APAC, S.sourcesForCountry);
assert("APAC defaults to first sourced country (plan A)", first === "hk");
assert("only first APAC sub is on", state.apac.hk === true && state.apac.sg === false && state.apac.kr === false);
assert("selectedCountries returns first APAC only", F.selectedCountries(state, S.APAC, S.sourcesForCountry).join(",") === "hk");

F.selectApacCountry(state, "sg", S.APAC);
assert("APAC sub-select is exclusive", state.apac.sg === true && state.apac.hk === false && state.groups.apac === true);
assert("selectedCountries returns Singapore", F.selectedCountries(state, S.APAC, S.sourcesForCountry).join(",") === "sg");

F.selectMainGroup(state, "tw", S.APAC, S.sourcesForCountry);
assert("back to Taiwan clears APAC", state.groups.tw === true && state.groups.apac === false && state.apac.sg === false);

assert("sample title is dropped", F.shouldDropFeedItem({
  title: "【示意】국세청 보도자료 목록（비실시간）",
  url: "https://www.nts.go.kr/nts/na/ntt/selectNttList.do?bbsId=1028&mi=2201",
  sample: false
}) === true);

assert("sample flag is dropped", F.shouldDropFeedItem({
  title: "Anything",
  url: "https://example.com/a/real-article",
  sample: true
}) === true);

assert("Korea list URL is dropped even without 示意", F.isListPageUrl(
  "https://www.nts.go.kr/nts/na/ntt/selectNttList.do?bbsId=1028&mi=2201"
) === true);

assert("Korea detail URL with nttId is kept", F.isListPageUrl(
  "https://www.nts.go.kr/nts/na/ntt/selectNttInfo.do?nttId=123&bbsId=1028&mi=2201"
) === false);

assert("Taiwan etax article path is kept", F.isListPageUrl(
  "https://www.etax.nat.gov.tw/etwmain/announcement/news/OxJAxQJ"
) === false);

assert("Federal Register document is kept", F.isListPageUrl(
  "https://www.federalregister.gov/documents/2026/08/17/2026-16717/agency-information-collection-activities"
) === false);

assert("real item is kept", F.shouldDropFeedItem({
  title: "IRS note",
  url: "https://www.irs.gov/newsroom/some-release"
}) === false);

assert("?lang=en wins over referrer and storage", F.resolveInitialLang({
  search: "?lang=en",
  referrer: "https://taxcodeusstocks.com/index.html",
  origin: "https://taxcodeusstocks.com",
  saved: "zh"
}) === "en");

assert("EN referrer selects English", F.resolveInitialLang({
  search: "",
  referrer: "https://taxcodeusstocks.com/en/about.html",
  origin: "https://taxcodeusstocks.com",
  saved: "zh"
}) === "en");

assert("ZH referrer selects Chinese even if storage is en", F.resolveInitialLang({
  search: "",
  referrer: "https://taxcodeusstocks.com/articles/apple-etr.html",
  origin: "https://taxcodeusstocks.com",
  saved: "en"
}) === "zh");

assert("no referrer falls back to localStorage", F.resolveInitialLang({
  search: "",
  referrer: "",
  origin: "https://taxcodeusstocks.com",
  saved: "en"
}) === "en");

assert("EN nav home points under /en/", F.navHrefForLang("en", "navHome") === "en/index.html");
assert("ZH nav home stays at root", F.navHrefForLang("zh", "navHome") === "index.html");
assert("EN services stays in EN tree", F.navHrefForLang("en", "navServices") === "en/services.html");

if (failed) {
  console.error(failed + " failed");
  process.exit(1);
}
console.log("all passed");
