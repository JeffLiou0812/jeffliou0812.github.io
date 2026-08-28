/* Homepage 焦點儀表. Browser and Node both load this file.
   Do not reuse 稅訊 brief-* class names or import brief.js. */
(function (root) {
  "use strict";

  var TAX_FEED = "https://tax-brief.fengyen0812.workers.dev/feed?countries=tw,us";
  var CLOSE_JSON = "content/us-close/latest.json";

  function isHttpUrl(s) {
    try {
      var u = new URL(s);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch (e) {
      return false;
    }
  }

  function taipeiYmd(date) {
    var fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    var parts = {};
    fmt.formatToParts(date || new Date()).forEach(function (p) {
      parts[p.type] = p.value;
    });
    return parts.year + "-" + parts.month + "-" + parts.day;
  }

  function yesterdayTaipei(today) {
    var now = new Date();
    var day = today || taipeiYmd(now);
    var i;
    for (i = 1; i <= 48; i++) {
      var y = taipeiYmd(new Date(now.getTime() - i * 3600000));
      if (y !== day) return y;
    }
    return day;
  }

  function taxWindow(now) {
    var today = taipeiYmd(now || new Date());
    return { today: today, yesterday: yesterdayTaipei(today) };
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

  function normalizeTaxItem(raw) {
    if (!raw || typeof raw !== "object") return null;
    var title = String(raw.title || "").trim();
    var url = String(raw.url || raw.href || raw.link || "").trim();
    if (!title || !isHttpUrl(url)) return null;
    return { title: title, url: url, date: normalizeDate(raw.date) };
  }

  function normalizeTaxPayload(data) {
    if (!data || typeof data !== "object" || Array.isArray(data) || !Array.isArray(data.items)) {
      return { generatedAt: "", items: [] };
    }
    return {
      generatedAt: String(data.generatedAt || ""),
      items: data.items.map(normalizeTaxItem).filter(Boolean)
    };
  }

  function looksLikeHelloWorld(text) {
    return /hello\s*world/i.test(text) && !/\{/.test(text);
  }

  function countTaxByDay(items, today, yesterday) {
    var t = 0;
    var y = 0;
    (items || []).forEach(function (it) {
      if (it.date === today) t += 1;
      else if (it.date === yesterday) y += 1;
    });
    return { today: t, yesterday: y };
  }

  function pickTaxTitles(items, today, yesterday) {
    var list = (items || []).filter(function (it) {
      return it.date === today || it.date === yesterday;
    });
    list.sort(function (a, b) {
      var ar = a.date === today ? 0 : 1;
      var br = b.date === today ? 0 : 1;
      return ar - br;
    });
    return list.slice(0, 2);
  }

  function formatEtMd(ymd) {
    var m = String(ymd || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return "";
    return String(Number(m[2])) + "/" + String(Number(m[3]));
  }

  function formatCloseSession(sessionEtDate) {
    var md = formatEtMd(sessionEtDate);
    return md ? "美東 " + md : "";
  }

  function formatPct(n) {
    if (typeof n !== "number" || !isFinite(n)) return "";
    return (n > 0 ? "+" : "") + n.toFixed(2) + "%";
  }

  function topMover(names, dir) {
    var list = (names || []).filter(function (n) {
      return n && typeof n.chg_pct === "number" && isFinite(n.chg_pct);
    });
    if (!list.length) return null;
    list = list.slice().sort(function (a, b) {
      return dir === "up" ? b.chg_pct - a.chg_pct : a.chg_pct - b.chg_pct;
    });
    return list[0];
  }

  function officialOvernightUrl(url) {
    if (root.UsClose && typeof root.UsClose.isOfficialOvernightUrl === "function") {
      return root.UsClose.isOfficialOvernightUrl(url);
    }
    return isHttpUrl(url);
  }

  function breakingItem(overnight) {
    if (!Array.isArray(overnight) || !overnight.length) return null;
    var it = overnight[0];
    if (!it || !String(it.title || "").trim() || !officialOvernightUrl(it.url)) return null;
    return { title: String(it.title).trim(), url: String(it.url).trim() };
  }

  function shouldShowBreaking(overnight) {
    return !!breakingItem(overnight);
  }

  function formatTaipeiStamp(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) {
      var m = String(iso).match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
      return m ? m[1] + " " + m[2] : "";
    }
    return new Intl.DateTimeFormat("zh-Hant", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(d);
  }

  function closeCardModel(data) {
    if (!data || typeof data !== "object") return null;
    var session = formatCloseSession(data.session_et_date);
    if (!session || session.indexOf("今日") !== -1) return null;
    return {
      session: session,
      headline: String(data.headline || "").trim(),
      up: topMover(data.names, "up"),
      down: topMover(data.names, "down"),
      breaking: breakingItem(data.overnight),
      stamp: formatTaipeiStamp(data.compiled_taipei)
    };
  }

  function fetchText(url, ms) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, ms || 12000);
    return fetch(url, { credentials: "omit", signal: ctrl.signal })
      .then(function (res) {
        return res.text().then(function (text) {
          return { ok: res.ok, text: text };
        });
      })
      .finally(function () {
        clearTimeout(timer);
      });
  }

  function fetchTaxFeed() {
    return fetchText(TAX_FEED, 12000).then(function (pack) {
      var text = String(pack.text || "").trim();
      if (!pack.ok || !text || looksLikeHelloWorld(text)) throw new Error("tax-feed");
      var data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error("tax-json");
      }
      return normalizeTaxPayload(data);
    });
  }

  function fetchClose() {
    return fetch(CLOSE_JSON, { credentials: "omit" }).then(function (res) {
      if (!res.ok) throw new Error("close-http");
      return res.json();
    });
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setDot(id, ok) {
    var el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle("is-ok", !!ok);
    el.classList.toggle("is-off", !ok);
  }

  function renderTaxOk(payload) {
    var win = taxWindow(new Date());
    var counts = countTaxByDay(payload.items, win.today, win.yesterday);
    var titles = pickTaxTitles(payload.items, win.today, win.yesterday);
    setText("home-focus-tax-today", String(counts.today));
    setText("home-focus-tax-yesterday", String(counts.yesterday));
    setText("home-focus-tax-stamp", payload.generatedAt ? "資料時間 " + formatTaipeiStamp(payload.generatedAt) : "資料時間未取得");
    setDot("home-focus-tax-dot", true);
    var list = document.getElementById("home-focus-tax-titles");
    if (!list) return;
    list.innerHTML = "";
    if (!titles.length) {
      var empty = document.createElement("li");
      empty.className = "home-focus-empty";
      empty.textContent = "視窗內尚無新發布";
      list.appendChild(empty);
      return;
    }
    titles.forEach(function (it) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = it.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = it.title;
      li.appendChild(a);
      list.appendChild(li);
    });
  }

  function renderTaxFail() {
    setText("home-focus-tax-today", "0");
    setText("home-focus-tax-yesterday", "0");
    setText("home-focus-tax-stamp", "未取得");
    setDot("home-focus-tax-dot", false);
    var list = document.getElementById("home-focus-tax-titles");
    if (!list) return;
    list.innerHTML = "";
    var li = document.createElement("li");
    li.className = "home-focus-empty";
    li.textContent = "未取得";
    list.appendChild(li);
  }

  function fillMover(id, row) {
    var el = document.getElementById(id);
    if (!el) return;
    if (!row) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    var name = el.querySelector(".home-focus-mover-name");
    var pct = el.querySelector(".home-focus-mover-pct");
    if (name) name.textContent = row.name_zh || row.ticker || "";
    if (pct) pct.textContent = formatPct(row.chg_pct);
  }

  function renderCloseOk(data) {
    var model = closeCardModel(data);
    if (!model) {
      renderCloseFail();
      return;
    }
    setText("home-focus-close-session", model.session);
    setText("home-focus-close-headline", model.headline || "收盤整理");
    setText("home-focus-close-stamp", model.stamp ? "台北整理 " + model.stamp : "台北整理未取得");
    setDot("home-focus-close-dot", true);
    fillMover("home-focus-up", model.up);
    fillMover("home-focus-down", model.down);
    var br = document.getElementById("home-focus-breaking");
    if (br) {
      if (!model.breaking) {
        br.hidden = true;
        br.innerHTML = "";
      } else {
        br.hidden = false;
        br.innerHTML = "";
        var lab = document.createElement("span");
        lab.className = "home-focus-chip-kicker";
        lab.textContent = "Breaking News";
        var a = document.createElement("a");
        a.href = model.breaking.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = model.breaking.title;
        br.appendChild(lab);
        br.appendChild(a);
      }
    }
  }

  function renderCloseFail() {
    setText("home-focus-close-session", "美東收盤");
    setText("home-focus-close-headline", "未取得");
    setText("home-focus-close-stamp", "未取得");
    setDot("home-focus-close-dot", false);
    fillMover("home-focus-up", null);
    fillMover("home-focus-down", null);
    var br = document.getElementById("home-focus-breaking");
    if (br) {
      br.hidden = true;
      br.innerHTML = "";
    }
  }

  function syncPanelStamp() {
    var tax = document.getElementById("home-focus-tax-stamp");
    var close = document.getElementById("home-focus-close-stamp");
    var panel = document.getElementById("home-focus-stamp");
    if (!panel) return;
    var bits = [];
    if (tax && tax.textContent && tax.textContent !== "未取得") bits.push(tax.textContent);
    if (close && close.textContent && close.textContent !== "未取得") bits.push(close.textContent);
    panel.textContent = bits.length ? bits.join(" · ") : "整理時間未取得";
  }

  function start() {
    if (!document.getElementById("home-focus")) return;
    fetchTaxFeed().then(renderTaxOk).catch(renderTaxFail).then(syncPanelStamp);
    fetchClose().then(renderCloseOk).catch(renderCloseFail).then(syncPanelStamp);
  }

  root.HomeFocus = {
    taipeiYmd: taipeiYmd,
    taxWindow: taxWindow,
    countTaxByDay: countTaxByDay,
    pickTaxTitles: pickTaxTitles,
    normalizeTaxPayload: normalizeTaxPayload,
    formatCloseSession: formatCloseSession,
    formatPct: formatPct,
    topMover: topMover,
    breakingItem: breakingItem,
    shouldShowBreaking: shouldShowBreaking,
    closeCardModel: closeCardModel
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start);
    } else {
      start();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
