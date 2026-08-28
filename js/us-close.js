/* 美股焦點 (us-close). Browser and Node both load this file.
   Do not reuse 稅訊 brief-* class names or the tax-brief Worker. */
(function (root) {
  "use strict";

  var YMD = /^\d{4}-\d{2}-\d{2}$/;
  var TAIPEI_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/;
  var SOCIAL_HOSTS = [
    "twitter.com",
    "x.com",
    "facebook.com",
    "instagram.com",
    "threads.net",
    "tiktok.com",
    "youtube.com",
    "youtu.be",
    "reddit.com",
    "stocktwits.com",
    "seekingalpha.com",
    "medium.com",
    "linkedin.com",
    "truthsocial.com"
  ];

  function isHttpUrl(s) {
    try {
      var u = new URL(s);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch (e) {
      return false;
    }
  }

  function hostOf(url) {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch (e) {
      return "";
    }
  }

  function isOfficialOvernightUrl(url) {
    if (!isHttpUrl(url)) return false;
    try {
      var u = new URL(url);
    } catch (e) {
      return false;
    }
    if (u.protocol !== "https:") return false;
    var host = u.hostname.toLowerCase();
    var blocked = SOCIAL_HOSTS.some(function (h) {
      return host === h || host.slice(-("." + h).length) === "." + h;
    });
    if (blocked) return false;
    if (/\.gov$/.test(host) || host.slice(-7) === ".gov.tw") return true;
    if (host === "sec.gov" || host.slice(-8) === ".sec.gov") return true;
    if (/^(ir|investor|investors|newsroom|nvidianews)\./.test(host)) return true;
    if (host.slice(-11) === ".nvidia.com") return true;
    return false;
  }

  function filterOvernight(items) {
    if (!Array.isArray(items)) return [];
    return items
      .filter(function (it) {
        return it && String(it.title || "").trim() && isOfficialOvernightUrl(it.url);
      })
      .slice(0, 2);
  }

  function shouldShowOvernight(items) {
    return filterOvernight(items).length > 0;
  }

  var SECTION = {
    summary: "摘要",
    overnight: "Breaking News",
    names: "美股焦點",
    calendar: "本月與下月即將公布總經／財報"
  };

  function ymdParts(ymd) {
    var m = String(ymd || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
  }

  function compileYmd(data) {
    if (data && YMD.test(String(data.id || ""))) return String(data.id);
    var iso = data && data.compiled_taipei ? String(data.compiled_taipei) : "";
    var m = iso.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : "";
  }

  function calendarWindow(data) {
    var parts = ymdParts(compileYmd(data));
    if (!parts) return [];
    var nextM = parts.m === 12 ? 1 : parts.m + 1;
    var nextY = parts.m === 12 ? parts.y + 1 : parts.y;
    return [
      { year: parts.y, month: parts.m },
      { year: nextY, month: nextM }
    ];
  }

  function pad2(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function ymdKey(y, m, d) {
    return y + "-" + pad2(m) + "-" + pad2(d);
  }

  function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  function weekdaySunday0(year, month, day) {
    return new Date(year, month - 1, day).getDay();
  }

  function groupCalendarByEtDate(items) {
    var map = {};
    (items || []).forEach(function (row) {
      if (!row || !YMD.test(String(row.date_et || ""))) return;
      var key = row.date_et;
      if (!map[key]) map[key] = [];
      map[key].push(row);
    });
    return map;
  }

  function shortCalendarLabel(row) {
    var raw = String((row && row.item) || "").trim();
    raw = raw.replace(/（[^）]*）/g, "").replace(/\([^)]*\)/g, "").trim();
    if (raw.indexOf("初領") === 0) return "初領";
    if (raw.indexOf("ISM") === 0) return "ISM";
    if (raw.indexOf("博通") === 0) return "博通Q3";
    if (raw.indexOf("非農") === 0 || raw.indexOf("NFP") !== -1) return "NFP";
    if (raw.indexOf("PPI") === 0) return "PPI";
    if (raw.indexOf("CPI") === 0) return "CPI";
    if (raw.indexOf("零售") === 0) return "零售";
    if (raw.indexOf("FOMC") === 0) return "FOMC";
    if (raw.indexOf("GDP") === 0) return "GDP";
    if (raw.indexOf("PCE") === 0) return "PCE";
    if (raw.length > 6) return raw.slice(0, 6);
    return raw;
  }

  function monthGrid(year, month, byDate) {
    var dim = daysInMonth(year, month);
    var lead = weekdaySunday0(year, month, 1);
    var cells = [];
    var i;
    for (i = 0; i < lead; i++) cells.push({ empty: true });
    for (i = 1; i <= dim; i++) {
      var key = ymdKey(year, month, i);
      var rows = (byDate && byDate[key]) || [];
      cells.push({
        empty: false,
        day: i,
        date: key,
        items: rows,
        labels: rows.map(shortCalendarLabel).filter(Boolean)
      });
    }
    while (cells.length % 7 !== 0) cells.push({ empty: true });
    return { year: year, month: month, cells: cells };
  }

  function calendarMonths(data) {
    var windowMonths = calendarWindow(data);
    var byDate = groupCalendarByEtDate(data && data.calendar);
    return windowMonths.map(function (w) {
      return monthGrid(w.year, w.month, byDate);
    });
  }

  function latestIdFromIndex(indexData) {
    var items = indexData && Array.isArray(indexData.items) ? indexData.items : [];
    return items.length ? String(items[0].id || "") : "";
  }

  function resolveDateId(requested, indexData, latestPayload) {
    var latestId =
      (latestPayload && latestPayload.id) || latestIdFromIndex(indexData) || "";
    var id = String(requested || "").trim();
    if (!id || !YMD.test(id)) return latestId;
    var items = indexData && Array.isArray(indexData.items) ? indexData.items : [];
    var found = items.some(function (it) {
      return it && it.id === id;
    });
    return found ? id : latestId;
  }

  function isFiniteNumber(n) {
    return typeof n === "number" && isFinite(n);
  }

  function validatePayload(data) {
    var errors = [];
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return ["payload must be an object"];
    }
    if (data.schema_version !== 1) errors.push("schema_version");
    if (!YMD.test(String(data.id || ""))) errors.push("id");
    if (!TAIPEI_ISO.test(String(data.compiled_taipei || ""))) errors.push("compiled_taipei");
    if (!YMD.test(String(data.session_et_date || ""))) errors.push("session_et_date");
    if (data.after_hours_asof_et !== null && typeof data.after_hours_asof_et !== "string") {
      errors.push("after_hours_asof_et");
    }
    if (typeof data.headline !== "string" || !data.headline.trim()) errors.push("headline");
    if (!Array.isArray(data.conclusions)) errors.push("conclusions");
    if (!Array.isArray(data.overnight)) errors.push("overnight");
    if (Array.isArray(data.overnight) && data.overnight.length > 2) errors.push("overnight-length");
    if (Array.isArray(data.overnight)) {
      data.overnight.forEach(function (it, i) {
        if (!it || !it.title || !isOfficialOvernightUrl(it.url)) {
          errors.push("overnight-" + i);
        }
      });
    }
    if (!Array.isArray(data.names)) errors.push("names");
    if (Array.isArray(data.names)) {
      data.names.forEach(function (n, i) {
        if (
          !n ||
          !n.ticker ||
          !n.name_zh ||
          !isFiniteNumber(n.close) ||
          !isFiniteNumber(n.chg_pct) ||
          !(n.after === null || isFiniteNumber(n.after))
        ) {
          errors.push("names-" + i);
        }
      });
    }
    if (!Array.isArray(data.calendar)) errors.push("calendar");
    return errors;
  }

  function formatEtMd(ymd) {
    var m = String(ymd || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return "";
    return String(Number(m[2])) + "/" + String(Number(m[3]));
  }

  function formatHomepageLine(sessionEtDate, headline) {
    var md = formatEtMd(sessionEtDate);
    var line = String(headline || "").trim();
    if (!md || !line) return "";
    return "美東 " + md + "：" + line;
  }

  function formatEtClock(iso) {
    if (!iso) return "";
    var m = String(iso).match(/T(\d{2}):(\d{2})/);
    return m ? m[1] + ":" + m[2] + " ET" : "";
  }

  function formatTaipeiStamp(iso) {
    if (!iso) return "";
    var m = String(iso).match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
    return m ? m[1] + " " + m[2] : String(iso);
  }

  function formatPct(n) {
    if (n === null || n === undefined || !isFiniteNumber(n)) return "—";
    var sign = n > 0 ? "+" : "";
    return sign + n.toFixed(2) + "%";
  }

  function formatClose(n) {
    if (!isFiniteNumber(n)) return "—";
    return n.toFixed(2);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function companyLabels(names) {
    var labels = [];
    (names || []).forEach(function (n) {
      if (n && n.name_zh && labels.indexOf(n.name_zh) === -1) labels.push(n.name_zh);
    });
    labels.sort(function (a, b) {
      return b.length - a.length;
    });
    return labels;
  }

  function boldCompanyNames(text, names) {
    var escaped = escapeHtml(text);
    companyLabels(names).forEach(function (label) {
      var needle = escapeHtml(label);
      escaped = escaped.split(needle).join("<strong>" + needle + "</strong>");
    });
    return escaped;
  }

  var DATA_BASE = (function () {
    if (typeof document === "undefined") return "content/us-close/";
    var script = document.currentScript;
    if (script && script.src) {
      return script.src.replace(/js\/us-close\.js.*$/, "content/us-close/");
    }
    return "content/us-close/";
  })();

  function dataBase() {
    return DATA_BASE;
  }

  function fetchJson(url) {
    return fetch(url, { credentials: "omit" }).then(function (res) {
      if (!res.ok) throw new Error("http-" + res.status);
      return res.json();
    });
  }

  function requestedDateFromSearch(search) {
    try {
      var q = new URLSearchParams(search.charAt(0) === "?" ? search.slice(1) : search);
      return String(q.get("date") || "").trim();
    } catch (e) {
      return "";
    }
  }

  function fillHomepageCard() {
    var line = document.getElementById("us-close-card-line");
    if (!line) return;
    fetchJson(dataBase() + "latest.json")
      .then(function (data) {
        var text = formatHomepageLine(data.session_et_date, data.headline);
        if (text && text.indexOf("今日") === -1) line.textContent = text;
      })
      .catch(function () {});
  }

  function renderStamps(data) {
    var etMd = formatEtMd(data.session_et_date);
    var ah = data.after_hours_asof_et ? formatEtClock(data.after_hours_asof_et) : "—";
    var bits = [
      "美東 " + etMd + " 收盤",
      "盤後截至 " + ah,
      "台北整理 " + formatTaipeiStamp(data.compiled_taipei)
    ];
    return bits.join(" · ");
  }

  function renderOvernight(data) {
    var items = filterOvernight(data.overnight);
    var section = document.getElementById("close-overnight");
    if (!section) return;
    if (!items.length) {
      section.hidden = true;
      section.innerHTML = "";
      return;
    }
    section.hidden = false;
    section.innerHTML = "";
    var h = document.createElement("h2");
    h.className = "section-title";
    h.id = "close-overnight-title";
    h.textContent = SECTION.overnight;
    section.appendChild(h);
    items.forEach(function (it) {
      var art = document.createElement("article");
      art.className = "close-overnight-item";
      var a = document.createElement("a");
      a.href = it.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = it.title;
      art.appendChild(a);
      if (it.caveat) {
        var p = document.createElement("p");
        p.className = "close-caveat";
        p.textContent = it.caveat;
        art.appendChild(p);
      }
      section.appendChild(art);
    });
  }

  function renderNames(data) {
    var wrap = document.getElementById("close-table-wrap");
    if (!wrap) return;
    wrap.innerHTML = "";
    var note = document.createElement("p");
    note.className = "close-table-note";
    note.textContent = "收盤快照，非即時報價。";
    wrap.appendChild(note);

    var etMd = formatEtMd(data.session_et_date);
    var ah = data.after_hours_asof_et ? formatEtClock(data.after_hours_asof_et) : "—";
    var caption = document.createElement("p");
    caption.className = "close-table-asof";
    caption.textContent = "美東 " + etMd + " 收盤 · 盤後截至 " + ah;
    wrap.appendChild(caption);

    var table = document.createElement("table");
    table.className = "close-table";
    var thead = document.createElement("thead");
    thead.innerHTML =
      "<tr><th>代號</th><th>名稱</th><th class=\"num\">收盤</th><th class=\"num\">漲跌%</th><th class=\"num\">盤後%</th></tr>";
    table.appendChild(thead);
    var tbody = document.createElement("tbody");
    (data.names || []).forEach(function (n) {
      var tr = document.createElement("tr");
      function td(text, cls) {
        var cell = document.createElement("td");
        if (cls) cell.className = cls;
        cell.textContent = text;
        return cell;
      }
      tr.appendChild(td(n.ticker, "ticker"));
      tr.appendChild(td(n.name_zh));
      tr.appendChild(td(formatClose(n.close), "num"));
      var chg = td(formatPct(n.chg_pct), "num " + (n.chg_pct > 0 ? "up" : n.chg_pct < 0 ? "down" : ""));
      tr.appendChild(chg);
      var afterCls = "num";
      if (n.after !== null && n.after > 0) afterCls += " up";
      if (n.after !== null && n.after < 0) afterCls += " down";
      tr.appendChild(td(formatPct(n.after), afterCls));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
  }

  function renderList(el, htmlItems, emptyText) {
    el.innerHTML = "";
    if (!htmlItems.length) {
      var p = document.createElement("p");
      p.className = "close-empty";
      p.textContent = emptyText;
      el.appendChild(p);
      return;
    }
    var ul = document.createElement("ul");
    htmlItems.forEach(function (node) {
      ul.appendChild(node);
    });
    el.appendChild(ul);
  }

  function renderConclusions(data) {
    var el = document.getElementById("close-conclusions");
    if (!el) return;
    var items = (data.conclusions || []).map(function (line) {
      var li = document.createElement("li");
      li.innerHTML = boldCompanyNames(line, data.names);
      return li;
    });
    renderList(el, items, "這份沒有摘要列。");
  }

  function monthTitle(year, month) {
    return year + "年" + month + "月";
  }

  function renderMonthCard(grid) {
    var card = document.createElement("section");
    card.className = "close-cal-month";
    card.setAttribute("aria-label", monthTitle(grid.year, grid.month));

    var title = document.createElement("h3");
    title.className = "close-cal-month-title";
    title.textContent = monthTitle(grid.year, grid.month);
    card.appendChild(title);

    var week = document.createElement("div");
    week.className = "close-cal-weekdays";
    week.setAttribute("aria-hidden", "true");
    ["日", "一", "二", "三", "四", "五", "六"].forEach(function (w) {
      var cell = document.createElement("span");
      cell.textContent = w;
      week.appendChild(cell);
    });
    card.appendChild(week);

    var gridEl = document.createElement("div");
    gridEl.className = "close-cal-grid";
    grid.cells.forEach(function (cell) {
      var day = document.createElement("div");
      if (cell.empty) {
        day.className = "close-cal-day is-pad";
        day.setAttribute("aria-hidden", "true");
        gridEl.appendChild(day);
        return;
      }
      var marked = cell.labels.length > 0;
      day.className = "close-cal-day" + (marked ? " is-marked" : "");
      var num = document.createElement("span");
      num.className = "close-cal-num";
      num.textContent = String(cell.day);
      day.appendChild(num);
      if (marked) {
        var mark = document.createElement("span");
        mark.className = "close-cal-mark";
        mark.setAttribute("aria-hidden", "true");
        day.appendChild(mark);
        cell.labels.forEach(function (label) {
          var lab = document.createElement("span");
          lab.className = "close-cal-label";
          lab.textContent = label;
          day.appendChild(lab);
        });
        day.setAttribute("title", cell.items.map(function (row) {
          return [row.status, row.item].filter(Boolean).join(" ");
        }).join("；"));
      }
      gridEl.appendChild(day);
    });
    card.appendChild(gridEl);
    return card;
  }

  function renderCalendar(data) {
    var el = document.getElementById("close-calendar");
    if (!el) return;
    el.innerHTML = "";
    var wrap = document.createElement("div");
    wrap.className = "close-cal-pair";
    calendarMonths(data).forEach(function (grid) {
      wrap.appendChild(renderMonthCard(grid));
    });
    el.appendChild(wrap);
    if (data.calendar_note) {
      var note = document.createElement("p");
      note.className = "close-calendar-note";
      note.textContent = data.calendar_note;
      el.appendChild(note);
    }
  }

  function renderArchive(indexData, currentId) {
    var el = document.getElementById("close-archive");
    if (!el) return;
    el.innerHTML = "";
    var items = indexData && Array.isArray(indexData.items) ? indexData.items : [];
    if (!items.length) return;
    var ul = document.createElement("ul");
    items.forEach(function (it) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = "us-close.html?date=" + encodeURIComponent(it.id);
      var md = formatEtMd(it.session_et_date);
      a.textContent = it.id + "（美東 " + md + "：" + it.headline + "）";
      if (it.id === currentId) a.setAttribute("aria-current", "page");
      li.appendChild(a);
      ul.appendChild(li);
    });
    el.appendChild(ul);
  }

  function renderPage(data, indexData) {
    var stamps = document.getElementById("close-stamps");
    if (stamps) stamps.textContent = renderStamps(data);
    renderConclusions(data);
    renderOvernight(data);
    renderNames(data);
    renderCalendar(data);
    renderArchive(indexData, data.id);
  }

  function loadPage() {
    var root = document.getElementById("us-close-root");
    if (!root) return;
    var base = dataBase();
    var requested = requestedDateFromSearch(location.search || "");
    Promise.all([fetchJson(base + "latest.json"), fetchJson(base + "index.json")])
      .then(function (pair) {
        var latest = pair[0];
        var indexData = pair[1];
        var id = resolveDateId(requested, indexData, latest);
        if (!id || id === latest.id) {
          renderPage(latest, indexData);
          return;
        }
        return fetchJson(base + id + ".json")
          .then(function (day) {
            renderPage(day, indexData);
          })
          .catch(function () {
            renderPage(latest, indexData);
          });
      })
      .catch(function () {
        var stamps = document.getElementById("close-stamps");
        if (stamps) stamps.textContent = "目前讀不到收盤整理。請稍後再開。";
      });
  }

  function start() {
    fillHomepageCard();
    loadPage();
  }

  root.UsClose = {
    SECTION: SECTION,
    isOfficialOvernightUrl: isOfficialOvernightUrl,
    filterOvernight: filterOvernight,
    shouldShowOvernight: shouldShowOvernight,
    resolveDateId: resolveDateId,
    latestIdFromIndex: latestIdFromIndex,
    validatePayload: validatePayload,
    formatEtMd: formatEtMd,
    formatHomepageLine: formatHomepageLine,
    formatPct: formatPct,
    formatClose: formatClose,
    boldCompanyNames: boldCompanyNames,
    requestedDateFromSearch: requestedDateFromSearch,
    calendarWindow: calendarWindow,
    groupCalendarByEtDate: groupCalendarByEtDate,
    shortCalendarLabel: shortCalendarLabel,
    calendarMonths: calendarMonths
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start);
    } else {
      start();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
