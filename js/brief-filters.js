/* Pure helpers for 稅訊 country filters + feed URL guards.
   Shared by the browser page and Node tests. */
(function (root) {
  "use strict";

  function firstApacCode(apacCodes, sourcesForCountry) {
    var list = apacCodes || [];
    for (var i = 0; i < list.length; i++) {
      var code = list[i];
      if (sourcesForCountry(code) && sourcesForCountry(code).length) return code;
    }
    return null;
  }

  function clearApac(state, apacCodes) {
    (apacCodes || []).forEach(function (code) {
      state.apac[code] = false;
    });
  }

  /* Strict single-select on the main row. Clicking the active chip is a no-op. */
  function selectMainGroup(state, key, apacCodes, sourcesForCountry) {
    if (!state || !state.groups || !state.groups.hasOwnProperty(key)) return state;
    if (state.groups[key]) return state;
    state.groups.tw = false;
    state.groups.us = false;
    state.groups.apac = false;
    clearApac(state, apacCodes);
    state.groups[key] = true;
    if (key === "apac") {
      var first = firstApacCode(apacCodes, sourcesForCountry);
      if (first) state.apac[first] = true;
    }
    return state;
  }

  /* Strict single-select among APAC sub-countries. */
  function selectApacCountry(state, code, apacCodes) {
    if (!state || !state.apac || (apacCodes || []).indexOf(code) === -1) return state;
    if (state.apac[code]) return state;
    state.groups.tw = false;
    state.groups.us = false;
    state.groups.apac = true;
    clearApac(state, apacCodes);
    state.apac[code] = true;
    return state;
  }

  function selectedCountries(state, apacCodes, sourcesForCountry) {
    var out = [];
    if (state.groups.tw) out.push("tw");
    if (state.groups.us) out.push("us");
    if (state.groups.apac) {
      (apacCodes || []).forEach(function (code) {
        if (state.apac[code]) out.push(code);
      });
    }
    out = out.filter(function (code) {
      return sourcesForCountry(code) && sourcesForCountry(code).length > 0;
    });
    if (!out.length) {
      state.groups.tw = true;
      state.groups.us = false;
      state.groups.apac = false;
      clearApac(state, apacCodes);
      out.push("tw");
    }
    return out;
  }

  function isSampleItem(raw) {
    if (!raw || typeof raw !== "object") return false;
    var title = String(raw.title || "");
    return raw.sample === true || /示意/.test(title);
  }

  /* Drop board/list landing pages that are not a specific release. */
  function isListPageUrl(url) {
    var s = String(url || "").trim();
    var u;
    try {
      u = new URL(s);
    } catch (e) {
      return false;
    }
    var path = u.pathname || "";
    var search = u.search || "";
    if (/selectNttList\.do$/i.test(path) && !/[?&]nttId=/i.test(search)) return true;
    if (/\/list\.(do|aspx|html?)$/i.test(path)) return true;
    if (/\/(press|news|notice|notices|announcements?)\/?$/i.test(path)) return true;
    return false;
  }

  function shouldDropFeedItem(raw) {
    if (!raw || typeof raw !== "object") return true;
    if (isSampleItem(raw)) return true;
    var url = String(raw.url || raw.href || raw.link || "").trim();
    if (isListPageUrl(url)) return true;
    return false;
  }

  function initialFilterState(apacCodes) {
    var apac = {};
    (apacCodes || []).forEach(function (code) {
      apac[code] = false;
    });
    return {
      groups: { tw: true, us: false, apac: false },
      apac: apac
    };
  }

  /* Entry language: ?lang= > same-origin referrer (/en/ vs zh) > localStorage > zh */
  function resolveInitialLang(options) {
    var opts = options || {};
    var search = opts.search != null ? String(opts.search) : "";
    var referrer = opts.referrer != null ? String(opts.referrer) : "";
    var origin = opts.origin != null ? String(opts.origin) : "";
    var saved = opts.saved;
    try {
      var params = new URLSearchParams(search.charAt(0) === "?" ? search.slice(1) : search);
      var q = params.get("lang");
      if (q === "en" || q === "zh") return q;
    } catch (e) {}
    try {
      if (referrer && origin) {
        var u = new URL(referrer);
        if (u.origin === origin) {
          return /\/en(\/|$)/.test(u.pathname || "") ? "en" : "zh";
        }
      }
    } catch (e2) {}
    if (saved === "en" || saved === "zh") return saved;
    return "zh";
  }

  function navHrefForLang(lang, key) {
    var en = lang === "en";
    var map = {
      brand: en ? "en/index.html" : "index.html",
      navHome: en ? "en/index.html" : "index.html",
      navArticles: en ? "en/index.html#articles" : "index.html#articles",
      navServices: en ? "en/services.html" : "services.html",
      navAbout: en ? "en/about.html" : "about.html",
      navResources: en ? "en/resources.html" : "resources.html",
      navBrief: en ? "brief.html?lang=en" : "brief.html",
      footerDisclaimer: en ? "en/disclaimer.html" : "disclaimer.html"
    };
    return map[key] || null;
  }

  root.BriefFilters = {
    firstApacCode: firstApacCode,
    selectMainGroup: selectMainGroup,
    selectApacCountry: selectApacCountry,
    selectedCountries: selectedCountries,
    isSampleItem: isSampleItem,
    isListPageUrl: isListPageUrl,
    shouldDropFeedItem: shouldDropFeedItem,
    initialFilterState: initialFilterState,
    resolveInitialLang: resolveInitialLang,
    navHrefForLang: navHrefForLang
  };
})(typeof window !== "undefined" ? window : globalThis);
