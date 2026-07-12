/* 稅務 x 美股 x AI — site-wide enhancements
   1) Floating "buy me a coffee" button (placeholder link until a donation platform is chosen)
   2) Category filter for article card grids (pages with .card[data-category])          */
(function () {
  "use strict";

  /* Set DONATE_URL once the donation platform is decided (Portaly / BMC / Ko-fi ...).
     While null, the button links to the #support section on the services page. */
  var DONATE_URL = null;

  var SITE_ROOT = (function () {
    var src = document.currentScript && document.currentScript.src;
    return src ? src.replace(/js\/site\.js.*$/, "") : "/";
  })();
  var IS_EN = (document.documentElement.lang || "").toLowerCase().indexOf("en") === 0;

  function initCoffeeButton() {
    if (!DONATE_URL) return; /* placeholder hidden until a donation platform is set */
    var href = DONATE_URL || SITE_ROOT + (IS_EN ? "en/" : "") + "services.html#support";
    var a = document.createElement("a");
    a.className = "coffee-btn";
    a.href = href;
    a.setAttribute("aria-label", "Buy me a coffee");
    a.innerHTML = '<span aria-hidden="true">☕</span><span class="coffee-label">Buy me a coffee</span>';
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
  }

  function initCategoryFilter() {
    var cards = Array.prototype.slice.call(document.querySelectorAll(".card[data-category]"));
    if (!cards.length) return;
    var grid = cards[0].closest(".card-grid");
    if (!grid) return;

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
    grid.parentNode.insertBefore(bar, grid);
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

  function init() {
    initCoffeeButton();
    initCategoryFilter();
    initNavToggle();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
