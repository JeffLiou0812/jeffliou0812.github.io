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
      '<span aria-hidden="true">☕</span>' +
      '<span class="coffee-label">Buy me a coffee</span>';
    if (DONATE_URL) {
      a.target = "_blank";
      a.rel = "noopener";
    }
    a.addEventListener("click", function () {
      if (typeof gtag === "function") {
        gtag("event", "coffee_click", { link_url: href });
      }
    });
    document.body.appendChild(a);
    followCoffeeOnScroll(a);
  }

  /* Keep the cup on the right edge and ease it toward the lower viewport
     as the page scrolls, so it visibly rides up and down with the reader. */
  function followCoffeeOnScroll(el) {
    if (!el || !window.requestAnimationFrame) return;
    var y = null;
    var reduced = false;

    function readReduced() {
      reduced = !!(
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      );
    }

    function edge() {
      return (window.innerWidth || 800) <= 640 ? 14 : 18;
    }

    function targetTop() {
      var viewH = window.innerHeight || 800;
      var docH = Math.max(
        (document.documentElement && document.documentElement.scrollHeight) || 0,
        (document.body && document.body.scrollHeight) || 0,
        viewH
      );
      var size = el.offsetHeight || 52;
      var pad = edge();
      var scrollY = window.pageYOffset || 0;
      /* Sit in the lower-right, but ease through document space so a
         scroll visibly tows the cup up or down before it catches up. */
      var desired = scrollY + viewH - size - pad;
      var max = Math.max(pad, docH - size - pad);
      return Math.max(pad, Math.min(max, desired));
    }

    function place(docTop) {
      var viewH = window.innerHeight || 800;
      var size = el.offsetHeight || 52;
      var pad = edge();
      var scrollY = window.pageYOffset || 0;
      var viewY = docTop - scrollY;
      var minView = pad;
      var maxView = Math.max(minView, viewH - size - pad);
      if (viewY < minView) viewY = minView;
      if (viewY > maxView) viewY = maxView;
      el.style.position = "fixed";
      el.style.top = "0px";
      el.style.bottom = "auto";
      el.style.right = pad + "px";
      el.style.transform = "translateY(" + Math.round(viewY) + "px)";
    }

    function tick() {
      var t = targetTop();
      if (y == null || reduced) y = t;
      else y += (t - y) * 0.05;
      place(y);
      window.requestAnimationFrame(tick);
    }

    readReduced();
    if (window.matchMedia) {
      var mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      if (mq.addEventListener) mq.addEventListener("change", readReduced);
      else if (mq.addListener) mq.addListener(readReduced);
    }
    window.requestAnimationFrame(tick);
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
