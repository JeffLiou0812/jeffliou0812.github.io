(function () {
  "use strict";

  var WORKER_BASE = "https://tax-brief.fengyen0812.workers.dev";
  var Sources = window.BriefSources;
  var Filters = window.BriefFilters;
  var APAC = Sources.APAC.filter(function (code) {
    return Sources.sourcesForCountry(code).length > 0;
  });
  var ALL_COUNTRIES = Sources.knownCountries();

  var I18N = {
    zh: {
      brand: "稅務 x 美股 x AI",
      navHome: "首頁",
      navArticles: "文章",
      navServices: "服務項目",
      navAbout: "關於傑夫哥",
      navResources: "官方資源",
      navBrief: "稅訊",
      pageTitle: "稅訊",
      hint: "點標題開官方原文",
      refresh: "更新",
      liveTitle: "即時更新",
      liveEmpty: "這次沒有新發布",
      liveCount: "這次抓到 {n} 筆",
      snapshot: "當日重點快照",
      rulings: "新頒函釋",
      drafts: "法規草案",
      ir: "IRS 新聞",
      fr: "聯邦公報",
      gazette: "公報",
      news: "官方發布",
      today: "今天",
      yesterday: "昨天",
      empty: "今日尚無新發布",
      emptyHint: "視窗是今天與昨天。有新件時會出現在這裡。",
      loading: "讀取中",
      errorTitle: "資料來源還沒準備好",
      errorBody: "目前讀不到稅訊來源。請稍後再按更新。本頁不會自行編造函釋字號。",
      updated: "資料時間",
      windowLabel: "視窗",
      tw: "台灣",
      us: "美國",
      apac: "亞太區",
      hk: "香港",
      sg: "新加坡",
      jp: "日本",
      kr: "韓國",
      cn: "中國",
      typeRuling: "函釋",
      typeDraft: "草案",
      typeGazette: "公報",
      typeNews: "發布",
      typeIr: "IR",
      typeFr: "FR",
      typeSample: "示意",
      close: "關閉",
      footerDisclaimer: "免責聲明",
      sourceLabel: "來源"
    },
    en: {
      brand: "TaxCode x US Stocks x AI",
      navHome: "Home",
      navArticles: "Articles",
      navServices: "Services",
      navAbout: "About",
      navResources: "Resources",
      navBrief: "Tax Brief",
      pageTitle: "Tax Brief",
      hint: "Open the official page",
      refresh: "Refresh",
      liveTitle: "Live update",
      liveEmpty: "Nothing new in this pull",
      liveCount: "{n} new in this pull",
      snapshot: "Today's snapshot",
      rulings: "New rulings",
      drafts: "Draft regulations",
      ir: "IRS Newsroom",
      fr: "Federal Register",
      gazette: "Gazette",
      news: "Official releases",
      today: "Today",
      yesterday: "Yesterday",
      empty: "No new releases today",
      emptyHint: "The window is today and yesterday. New items will show up here.",
      loading: "Loading",
      errorTitle: "The feed is not ready yet",
      errorBody: "The tax brief source could not be read. Try Refresh later. This page will not invent ruling numbers.",
      updated: "Updated",
      windowLabel: "Window",
      tw: "Taiwan",
      us: "United States",
      apac: "Asia Pacific",
      hk: "Hong Kong",
      sg: "Singapore",
      jp: "Japan",
      kr: "Korea",
      cn: "China",
      typeRuling: "Ruling",
      typeDraft: "Draft",
      typeGazette: "Gazette",
      typeNews: "News",
      typeIr: "IR",
      typeFr: "FR",
      typeSample: "Sample",
      close: "Close",
      footerDisclaimer: "Disclaimer",
      sourceLabel: "Source"
    }
  };

  var filterSeed = Filters.initialFilterState(APAC);
  var state = {
    lang: "zh",
    groups: filterSeed.groups,
    apac: filterSeed.apac,
    payload: null,
    livePayload: null,
    error: false,
    loading: true,
    liveOpen: false
  };

  function t(key) {
    return (I18N[state.lang] && I18N[state.lang][key]) || I18N.zh[key] || key;
  }

  function selectedCountries() {
    return Filters.selectedCountries(state, APAC, Sources.sourcesForCountry);
  }

  function persistLang(lang) {
    try {
      localStorage.setItem("brief-lang", lang);
    } catch (e) {}
  }

  function applyNavHrefs() {
    var brand = document.querySelector(".site-header .brand");
    if (brand) {
      brand.href = Filters.navHrefForLang(state.lang, "brand");
      brand.innerHTML =
        state.lang === "en"
          ? 'TaxCode <span class="x">x</span> US Stocks <span class="x">x</span> AI'
          : '稅務 <span class="x">x</span> 美股 <span class="x">x</span> AI';
    }
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      var href = Filters.navHrefForLang(state.lang, key);
      if (href && el.tagName === "A") el.setAttribute("href", href);
    });
    var footerBrand = document.querySelector(".site-footer strong");
    if (footerBrand) footerBrand.textContent = t("brand");
  }

  function visibleItems(rawItems) {
    return Sources.filterItemsByCountries(rawItems || [], selectedCountries());
  }

  function taipeiYmd(date) {
    var fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    var parts = {};
    fmt.formatToParts(date).forEach(function (p) {
      parts[p.type] = p.value;
    });
    return parts.year + "-" + parts.month + "-" + parts.day;
  }

  function yesterdayTaipei(today) {
    var now = new Date();
    for (var i = 1; i <= 48; i++) {
      var y = taipeiYmd(new Date(now.getTime() - i * 3600000));
      if (y !== today) return y;
    }
    return today;
  }

  function formatHeaderDate(date) {
    return new Intl.DateTimeFormat(state.lang === "en" ? "en-GB" : "zh-Hant", {
      timeZone: "Asia/Taipei",
      weekday: "long",
      year: "numeric",
      month: state.lang === "en" ? "short" : "long",
      day: "numeric"
    }).format(date);
  }

  function formatStamp(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return new Intl.DateTimeFormat(state.lang === "en" ? "en-GB" : "zh-Hant", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(d);
  }

  function isHttpUrl(s) {
    try {
      var u = new URL(s);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch (e) {
      return false;
    }
  }

  function normalizeDate(v) {
    if (!v) return "";
    var s = String(v).trim();
    var m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    var d = new Date(s);
    if (!isNaN(d.getTime())) return taipeiYmd(d);
    return "";
  }

  function normalizeCountry(v) {
    var s = String(v || "").trim().toLowerCase();
    if (/^(tw|taiwan|台灣|臺灣|台湾)$/.test(s)) return "tw";
    if (/^(us|usa|united states|美國|美国)$/.test(s)) return "us";
    if (/^(hk|hong ?kong|香港)$/.test(s)) return "hk";
    if (/^(sg|singapore|新加坡)$/.test(s)) return "sg";
    if (/^(jp|japan|日本)$/.test(s)) return "jp";
    if (/^(kr|korea|韓國|韩国|南韓|南韩)$/.test(s)) return "kr";
    if (/^(cn|china|中國|中国|prc)$/.test(s)) return "cn";
    return "";
  }

  function normalizeKind(v) {
    var s = String(v || "").trim().toLowerCase();
    if (s === "ruling" || /函釋|函释/.test(s)) return "ruling";
    if (s === "draft" || /草案/.test(s)) return "draft";
    if (s === "gazette" || /公報|公报/.test(s)) return "gazette";
    if (s === "ir" || s === "irs") return "ir";
    if (s === "fr" || /federal register|聯邦公報|联邦公报/.test(s)) return "fr";
    if (s === "news" || /發布|发布/.test(s)) return "news";
    return "news";
  }

  function normalizeItem(raw) {
    if (!raw || typeof raw !== "object") return null;
    if (Filters.shouldDropFeedItem(raw)) return null;
    var title = String(raw.title || "").trim();
    var url = String(raw.url || raw.href || raw.link || "").trim();
    if (!title || !isHttpUrl(url)) return null;
    return {
      title: title,
      source: String(raw.source || "").trim(),
      date: normalizeDate(raw.date),
      url: url,
      country: normalizeCountry(raw.country),
      kind: normalizeKind(raw.kind),
      sample: false
    };
  }

  function normalizePayload(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return { generatedAt: "", window: null, items: [] };
    }
    var items = Array.isArray(data.items)
      ? data.items.map(normalizeItem).filter(Boolean)
      : [];
    var win = data.window && typeof data.window === "object" ? data.window : null;
    return {
      generatedAt: String(data.generatedAt || ""),
      window: win,
      items: items
    };
  }

  function looksLikeHelloWorld(text) {
    return /hello\s*world/i.test(text) && !/\{/.test(text);
  }

  function fetchFeed(countries) {
    var codes = (countries && countries.length ? countries : selectedCountries())
      .filter(function (c) { return ALL_COUNTRIES.indexOf(c) !== -1; });
    if (!codes.length) codes = ["tw"];
    var url = WORKER_BASE.replace(/\/+$/, "") + "/feed?countries=" + encodeURIComponent(codes.join(","));
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 12000);
    return fetch(url, { credentials: "omit", signal: ctrl.signal })
      .then(function (res) {
        return res.text().then(function (text) {
          return { ok: res.ok, status: res.status, text: text };
        });
      })
      .finally(function () {
        clearTimeout(timer);
      })
      .then(function (pack) {
        var text = String(pack.text || "").trim();
        if (!text || looksLikeHelloWorld(text)) {
          throw new Error("not-ready");
        }
        var data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          throw new Error("not-json");
        }
        if (!data || typeof data !== "object" || Array.isArray(data) || !Array.isArray(data.items)) {
          throw new Error("bad-shape");
        }
        return normalizePayload(data);
      });
  }

  function applyChrome() {
    document.documentElement.lang = state.lang === "en" ? "en" : "zh-Hant";
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      if (key) el.textContent = t(key);
    });
    applyNavHrefs();
    var zhBtn = document.getElementById("lang-zh");
    var enBtn = document.getElementById("lang-en");
    zhBtn.classList.toggle("active", state.lang === "zh");
    enBtn.classList.toggle("active", state.lang === "en");
    zhBtn.setAttribute("aria-pressed", state.lang === "zh" ? "true" : "false");
    enBtn.setAttribute("aria-pressed", state.lang === "en" ? "true" : "false");
    document.getElementById("brief-date").textContent = formatHeaderDate(new Date());
    renderFilters();
    renderMain();
    if (state.liveOpen) renderLive(state.livePayload, { reopen: false });
  }

  function renderFilters() {
    var main = document.getElementById("country-filters");
    var apac = document.getElementById("apac-filters");
    main.innerHTML = "";
    [["tw", t("tw")], ["us", t("us")], ["apac", t("apac")]].forEach(function (pair) {
      var key = pair[0];
      var b = document.createElement("button");
      b.type = "button";
      b.className = "brief-chip" + (state.groups[key] ? " active" : "");
      b.textContent = pair[1];
      b.setAttribute("aria-pressed", state.groups[key] ? "true" : "false");
      b.addEventListener("click", function () {
        Filters.selectMainGroup(state, key, APAC, Sources.sourcesForCountry);
        renderFilters();
        loadFeed(false);
      });
      main.appendChild(b);
    });

    var showApac = state.groups.apac;
    apac.hidden = !showApac;
    apac.innerHTML = "";
    if (showApac) {
      APAC.forEach(function (code) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "brief-chip sub" + (state.apac[code] ? " active" : "");
        b.textContent = t(code);
        b.setAttribute("aria-pressed", state.apac[code] ? "true" : "false");
        b.addEventListener("click", function () {
          Filters.selectApacCountry(state, code, APAC);
          renderFilters();
          loadFeed(false);
        });
        apac.appendChild(b);
      });
    }
  }

  function kindLabel(item) {
    if (item.sample) return t("typeSample");
    if (item.kind === "ruling") return t("typeRuling");
    if (item.kind === "draft") return t("typeDraft");
    if (item.kind === "gazette") return t("typeGazette");
    if (item.kind === "ir") return t("typeIr");
    if (item.kind === "fr") return t("typeFr");
    if (item.kind === "news") return t("typeNews");
    return t("typeNews");
  }

  function kindClass(item) {
    if (item.sample) return "sample";
    return item.kind || "other";
  }

  function rowClass(item) {
    return "kind-" + (item.sample ? "news" : item.kind || "news");
  }

  function renderRow(item, asSnap) {
    var a = document.createElement("a");
    a.className = (asSnap ? "brief-snap-card " : "brief-row ") + rowClass(item);
    a.href = item.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";

    var chip = document.createElement("span");
    chip.className = "brief-kind " + kindClass(item);
    chip.textContent = kindLabel(item);

    var body = document.createElement("div");
    var title = document.createElement("div");
    title.className = "title";
    title.textContent = item.title;
    var meta = document.createElement("div");
    meta.className = "brief-meta";
    meta.textContent = [item.source, item.date].filter(Boolean).join(" · ");
    body.appendChild(title);
    body.appendChild(meta);

    var arrow = document.createElement("span");
    arrow.className = "brief-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "→";

    a.appendChild(chip);
    a.appendChild(body);
    a.appendChild(arrow);
    return a;
  }

  function emptyCard(titleKey, hintKey) {
    var box = document.createElement("div");
    box.className = "brief-empty";
    var mark = document.createElement("div");
    mark.className = "brief-empty-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = "○";
    var strong = document.createElement("strong");
    strong.textContent = t(titleKey);
    var p = document.createElement("p");
    p.textContent = t(hintKey);
    box.appendChild(mark);
    box.appendChild(strong);
    box.appendChild(p);
    return box;
  }

  function fillList(el, items, asSnap) {
    el.innerHTML = "";
    if (state.loading && !state.liveOpen) {
      var load = emptyCard("loading", "hint");
      el.appendChild(load);
      return;
    }
    if (!items.length) {
      el.appendChild(emptyCard("empty", "emptyHint"));
      return;
    }
    items.forEach(function (item) {
      el.appendChild(renderRow(item, asSnap));
    });
  }

  function fillDay(el, items) {
    el.innerHTML = "";
    if (state.loading) {
      el.appendChild(emptyCard("loading", "hint"));
      return;
    }
    if (!items.length) {
      el.appendChild(emptyCard("empty", "emptyHint"));
      return;
    }
    items.forEach(function (item) {
      el.appendChild(renderRow(item, false));
    });
  }

  function snapScore(item) {
    if (item.kind === "ruling") return 0;
    if (item.kind === "draft" || item.kind === "ir" || item.kind === "gazette") return 1;
    return 2;
  }

  function pickSnapshot(items, today, yesterday) {
    var ranked = items.slice().sort(function (a, b) {
      var ad = a.date === today ? 0 : a.date === yesterday ? 1 : 2;
      var bd = b.date === today ? 0 : b.date === yesterday ? 1 : 2;
      if (ad !== bd) return ad - bd;
      return snapScore(a) - snapScore(b);
    });
    return ranked.slice(0, 3);
  }

  function byKind(items, kinds) {
    return items.filter(function (it) {
      return kinds.indexOf(it.kind) !== -1;
    });
  }

  function byDay(items, day) {
    return items.filter(function (it) { return it.date === day; });
  }

  function sourceName(src) {
    return state.lang === "en" ? src.sourceEn : src.sourceZh;
  }

  function makeDayBlock(labelKey) {
    var day = document.createElement("div");
    day.className = "brief-day";
    var label = document.createElement("div");
    label.className = "brief-day-label";
    label.textContent = t(labelKey);
    var list = document.createElement("div");
    list.className = "brief-list";
    day.appendChild(label);
    day.appendChild(list);
    return { wrap: day, list: list };
  }

  function renderCountryFeeds(items, today, yesterday) {
    var root = document.getElementById("country-feeds");
    root.innerHTML = "";
    selectedCountries().forEach(function (code) {
      var countryItems = items.filter(function (it) { return it.country === code; });
      var sources = Sources.sourcesForCountry(code);
      if (!sources.length) return;

      var group = document.createElement("section");
      group.className = "brief-country";
      group.setAttribute("data-country", code);

      var head = document.createElement("h2");
      head.className = "brief-country-title";
      head.textContent = t(code);
      group.appendChild(head);

      sources.forEach(function (src) {
        var srcItems = byKind(countryItems, src.kinds);
        if (src.optional && !srcItems.length && !state.loading) return;

        var block = document.createElement("section");
        block.className = "brief-block";
        block.setAttribute("data-source-key", src.key);
        block.setAttribute("data-country", code);

        var title = document.createElement("h3");
        title.textContent = t(src.labelKey);
        var note = document.createElement("p");
        note.className = "brief-source";
        note.textContent = t("sourceLabel") + "：" + sourceName(src);

        var todayBox = makeDayBlock("today");
        var yestBox = makeDayBlock("yesterday");
        fillDay(todayBox.list, byDay(srcItems, today));
        fillDay(yestBox.list, byDay(srcItems, yesterday));

        block.appendChild(title);
        block.appendChild(note);
        block.appendChild(todayBox.wrap);
        block.appendChild(yestBox.wrap);
        group.appendChild(block);
      });

      if (group.querySelector(".brief-block")) root.appendChild(group);
    });
  }

  function renderMain() {
    var banner = document.getElementById("brief-banner");
    var status = document.getElementById("brief-status");
    var items = visibleItems(state.payload ? state.payload.items : []);
    var today = taipeiYmd(new Date());
    var yesterday = yesterdayTaipei(today);

    if (state.error) {
      banner.hidden = false;
      banner.innerHTML = "";
      var h = document.createElement("h2");
      h.textContent = t("errorTitle");
      var p = document.createElement("p");
      p.textContent = t("errorBody");
      banner.appendChild(h);
      banner.appendChild(p);
      banner.className = "brief-banner error";
    } else {
      banner.hidden = true;
      banner.innerHTML = "";
    }

    var win = state.payload && state.payload.window;
    var bits = [];
    if (state.payload && state.payload.generatedAt) {
      bits.push(t("updated") + " " + formatStamp(state.payload.generatedAt));
    }
    if (win && win.from && win.to) {
      bits.push(t("windowLabel") + " " + win.from + " 到 " + win.to);
    }
    status.textContent = bits.join(" · ");

    fillList(document.getElementById("snap-list"), pickSnapshot(items, today, yesterday), true);
    renderCountryFeeds(items, today, yesterday);
  }

  function openLive() {
    var panel = document.getElementById("live-panel");
    var overlay = document.getElementById("live-overlay");
    var btn = document.getElementById("refresh-btn");
    panel.classList.add("open");
    overlay.hidden = false;
    state.liveOpen = true;
    btn.setAttribute("aria-expanded", "true");
    document.getElementById("live-close").focus();
  }

  function closeLive() {
    var panel = document.getElementById("live-panel");
    var overlay = document.getElementById("live-overlay");
    var btn = document.getElementById("refresh-btn");
    panel.classList.remove("open");
    overlay.hidden = true;
    state.liveOpen = false;
    btn.setAttribute("aria-expanded", "false");
  }

  function renderLive(payload, opts) {
    var meta = document.getElementById("live-meta");
    var grid = document.getElementById("live-cols");
    if (!opts || opts.reopen !== false) openLive();

    var items = visibleItems(payload && payload.items ? payload.items : []);
    if (!items.length) {
      meta.textContent = formatStamp(payload && payload.generatedAt) + " · " + t("liveEmpty");
    } else {
      meta.textContent = formatStamp(payload && payload.generatedAt) + " · " + t("liveCount").replace("{n}", String(items.length));
    }

    grid.innerHTML = "";
    selectedCountries().forEach(function (code) {
      var countryItems = items.filter(function (it) { return it.country === code; });
      Sources.sourcesForCountry(code).forEach(function (src) {
        var col = document.createElement("div");
        col.className = "brief-live-col";
        col.setAttribute("data-country", code);
        col.setAttribute("data-source-key", src.key);
        var h3 = document.createElement("h3");
        h3.textContent = t(code) + " · " + t(src.labelKey);
        var note = document.createElement("p");
        note.className = "brief-source";
        note.textContent = t("sourceLabel") + "：" + sourceName(src);
        var list = document.createElement("div");
        list.className = "brief-list";
        var srcItems = byKind(countryItems, src.kinds);
        if (!srcItems.length) {
          list.appendChild(emptyCard("liveEmpty", "hint"));
        } else {
          srcItems.forEach(function (item) {
            list.appendChild(renderRow(item, false));
          });
        }
        col.appendChild(h3);
        col.appendChild(note);
        col.appendChild(list);
        grid.appendChild(col);
      });
    });
  }

  function setBusy(on) {
    var btn = document.getElementById("refresh-btn");
    btn.setAttribute("aria-busy", on ? "true" : "false");
    btn.disabled = !!on;
  }

  function loadFeed(asLive) {
    state.loading = !asLive;
    if (!asLive) renderMain();
    setBusy(true);
    return fetchFeed(selectedCountries())
      .then(function (payload) {
        state.loading = false;
        state.error = false;
        state.payload = payload;
        if (asLive) {
          state.livePayload = payload;
          renderLive(payload);
        }
        renderMain();
      })
      .catch(function () {
        state.loading = false;
        state.error = true;
        if (!state.payload) state.payload = { generatedAt: "", window: null, items: [] };
        if (asLive) {
          state.livePayload = { generatedAt: "", window: null, items: [] };
          renderLive(state.livePayload);
        }
        renderMain();
      })
      .finally(function () {
        setBusy(false);
      });
  }

  function bind() {
    document.getElementById("lang-zh").addEventListener("click", function () {
      state.lang = "zh";
      persistLang("zh");
      applyChrome();
    });
    document.getElementById("lang-en").addEventListener("click", function () {
      state.lang = "en";
      persistLang("en");
      applyChrome();
    });
    var refresh = document.getElementById("refresh-btn");
    refresh.addEventListener("click", function () {
      openLive();
      document.getElementById("live-meta").textContent = t("loading");
      document.getElementById("live-cols").innerHTML = "";
      loadFeed(true);
    });
    document.getElementById("live-close").addEventListener("click", closeLive);
    document.getElementById("live-overlay").addEventListener("click", closeLive);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && state.liveOpen) closeLive();
    });
  }

  function start() {
    var saved = null;
    try {
      saved = localStorage.getItem("brief-lang");
    } catch (e) {}
    state.lang = Filters.resolveInitialLang({
      search: location.search || "",
      referrer: document.referrer || "",
      origin: location.origin || "",
      saved: saved
    });
    persistLang(state.lang);
    bind();
    applyChrome();
    loadFeed(false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
