/* 稅務 x 美股 x AI — site-wide enhancements
   1) Small floating coffee-cup icon (links to #support until a donation platform is chosen)
   2) Category filter for article card grids (pages with .card[data-category])
   3) Idle-deferred GA + AdSense so first paint is not competing with third parties */
(function () {
  "use strict";

  /* Set DONATE_URL once the donation platform is decided (Portaly / BMC / Ko-fi ...).
     While null, the button links to the #support section on the services page. */
  var DONATE_URL = null;
  var GA_ID = "G-TRNEWFX3G6";
  var ADSENSE_CLIENT = "ca-pub-4182088023942573";

  var SITE_ROOT = (function () {
    var src = document.currentScript && document.currentScript.src;
    return src ? src.replace(/js\/site\.js.*$/, "") : "/";
  })();
  var IS_EN = (document.documentElement.lang || "").toLowerCase().indexOf("en") === 0;

  function initCoffeeButton() {
    var href = DONATE_URL || SITE_ROOT + (IS_EN ? "en/" : "") + "services.html#support";
    var a = document.createElement("a");
    a.className = "coffee-btn";
    a.href = href;
    a.setAttribute("aria-label", IS_EN ? "Support this site" : "支持這個網站");
    a.innerHTML =
      '<svg class="coffee-cup" viewBox="0 0 64 64" aria-hidden="true" focusable="false">' +
        '<g class="coffee-steam" fill="none" stroke="#C9955A" stroke-width="2.4" stroke-linecap="round">' +
          '<path d="M23 20c2-4-3-5 0-9"/>' +
          '<path d="M32 18c2-4-3-5 0-9"/>' +
          '<path d="M41 20c2-4-3-5 0-9"/>' +
        "</g>" +
        '<ellipse cx="30" cy="27" rx="15" ry="4" fill="#243B55"/>' +
        '<path fill="#243B55" d="M16 28h28l-2.4 17.4A12 12 0 0 1 30 57h-2A12 12 0 0 1 18.4 45.4L16 28z"/>' +
        '<ellipse cx="30" cy="28.2" rx="12.2" ry="3.1" fill="#6B4A2B"/>' +
        '<path d="M44.5 32c8.4 1.2 9.6 15.2.4 17.6" fill="none" stroke="#243B55" stroke-width="3.4" stroke-linecap="round"/>' +
        '<path fill="#243B55" d="M14.5 55h31c2.4 1.8-2 4.4-15.5 4.4S12.1 56.8 14.5 55z"/>' +
      "</svg>";
    if (DONATE_URL) {
      a.target = "_blank";
      a.rel = "noopener";
    }
    a.addEventListener("click", function (e) {
      if (!DONATE_URL) {
        var el = document.getElementById("support");
        if (el) {
          e.preventDefault();
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          if (history.replaceState) history.replaceState(null, "", "#support");
        }
      }
      if (typeof gtag === "function") {
        gtag("event", "coffee_click", { link_url: href });
      }
    });
    document.body.appendChild(a);
  }

  function initCategoryFilter() {
    var cards = Array.prototype.slice.call(document.querySelectorAll(".card[data-category]"));
    if (!cards.length) return;
    /* Prefer the featured grid when present so the bar sits above flagship posts. */
    var anchor =
      document.querySelector(".featured-grid") ||
      cards[0].closest(".card-grid") ||
      cards[0];
    if (!anchor || !anchor.parentNode) return;

    var cats = [];
    cards.forEach(function (c) {
      var v = c.getAttribute("data-category");
      if (v && cats.indexOf(v) === -1) cats.push(v);
    });
    if (cats.length < 2) return;

    var bar = document.createElement("div");
    bar.className = "filter-bar";
    var labels = [IS_EN ? "All" : "全部"].concat(cats);
    labels.forEach(function (label, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      if (i === 0) b.className = "active";
      b.setAttribute("aria-pressed", i === 0 ? "true" : "false");
      b.addEventListener("click", function () {
        Array.prototype.forEach.call(bar.querySelectorAll("button"), function (x) {
          x.classList.remove("active");
          x.setAttribute("aria-pressed", "false");
        });
        b.classList.add("active");
        b.setAttribute("aria-pressed", "true");
        cards.forEach(function (c) {
          var show = i === 0 || c.getAttribute("data-category") === label;
          c.style.display = show ? "" : "none";
        });
      });
      bar.appendChild(b);
    });
    anchor.parentNode.insertBefore(bar, anchor);
  }

  function initBriefNavLink() {
    var nav = document.querySelector("nav.main-nav");
    if (!nav || nav.querySelector('a[data-nav="brief"], a[href*="brief.html"]')) return;
    var a = document.createElement("a");
    a.href = SITE_ROOT + "brief.html";
    a.setAttribute("data-nav", "brief");
    a.textContent = IS_EN ? "Tax Brief" : "稅訊";
    var path = (location.pathname || "").replace(/\/+$/, "");
    if (/(^|\/)brief(\.html)?$/.test(path)) a.className = "active";
    nav.appendChild(a);
  }

  function initNavToggle() {
    var btn = document.querySelector(".nav-toggle");
    var nav = document.querySelector("nav.main-nav");
    if (!btn || !nav) return;
    function close() {
      nav.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
      btn.textContent = "☰"; /* ☰ */
    }
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = nav.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.textContent = open ? "✕" : "☰"; /* ✕ : ☰ */
    });
    nav.addEventListener("click", function (e) {
      if (e.target.tagName === "A") close();
    });
    document.addEventListener("click", function (e) {
      if (nav.classList.contains("open") && !nav.contains(e.target) && e.target !== btn) close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("open")) close();
    });
  }

  function loadScript(src, attrs) {
    var s = document.createElement("script");
    s.async = true;
    s.src = src;
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        s.setAttribute(k, attrs[k]);
      });
    }
    document.head.appendChild(s);
  }

  function initAnalyticsStub() {
    window.dataLayer = window.dataLayer || [];
    window.gtag =
      window.gtag ||
      function () {
        window.dataLayer.push(arguments);
      };
    window.gtag("js", new Date());
    window.gtag("config", GA_ID);
  }

  function loadThirdParty() {
    loadScript("https://www.googletagmanager.com/gtag/js?id=" + GA_ID);
    var noAds = document.body && document.body.getAttribute("data-no-ads") === "true";
    if (!noAds) {
      loadScript(
        "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + ADSENSE_CLIENT,
        { crossorigin: "anonymous" }
      );
    }
  }

  function scheduleThirdParty() {
    initAnalyticsStub();
    var run = function () {
      loadThirdParty();
    };
    if ("requestIdleCallback" in window) {
      requestIdleCallback(run, { timeout: 2500 });
    } else if (document.readyState === "complete") {
      setTimeout(run, 1);
    } else {
      window.addEventListener("load", function () {
        setTimeout(run, 1);
      });
    }
  }

  function init() {
    initCoffeeButton();
    initCategoryFilter();
    initBriefNavLink();
    initNavToggle();
  }

  scheduleThirdParty();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
