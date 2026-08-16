/* Shared 稅訊 country-to-source map. Browser and Node both load this file. */
(function (root) {
  "use strict";

  var APAC = ["hk", "sg", "jp", "kr", "cn"];

  /* Only list a source if that country actually owns it.
     US: IRS Newsroom + Federal Register.
     Taiwan: 函釋 / 草案 / 公報.
     APAC: local tax authority releases only. Never IRS or Federal Register. */
  var COUNTRY_SOURCES = {
    tw: [
      { key: "rulings", kinds: ["ruling"], labelKey: "rulings", sourceZh: "財政部賦稅署", sourceEn: "Taiwan MOF" },
      { key: "drafts", kinds: ["draft"], labelKey: "drafts", sourceZh: "主管機關法規草案", sourceEn: "Agency draft consultations" },
      { key: "gazette", kinds: ["gazette"], labelKey: "gazette", sourceZh: "行政院公報", sourceEn: "Executive Yuan Gazette", optional: true }
    ],
    us: [
      { key: "ir", kinds: ["ir"], labelKey: "ir", sourceZh: "IRS Newsroom", sourceEn: "IRS Newsroom" },
      { key: "fr", kinds: ["fr"], labelKey: "fr", sourceZh: "Federal Register", sourceEn: "Federal Register" }
    ],
    hk: [
      { key: "news", kinds: ["news", "ruling", "draft", "gazette"], labelKey: "news", sourceZh: "香港稅務局 IRD", sourceEn: "Hong Kong IRD" }
    ],
    sg: [
      { key: "news", kinds: ["news", "ruling", "draft"], labelKey: "news", sourceZh: "新加坡國內稅務局 IRAS", sourceEn: "IRAS" }
    ],
    jp: [
      { key: "news", kinds: ["news", "ruling", "draft"], labelKey: "news", sourceZh: "日本國稅廳", sourceEn: "National Tax Agency" }
    ],
    kr: [
      { key: "news", kinds: ["news", "ruling", "draft"], labelKey: "news", sourceZh: "韓國國稅廳", sourceEn: "National Tax Service" }
    ],
    cn: [
      { key: "news", kinds: ["news", "ruling", "draft"], labelKey: "news", sourceZh: "國家稅務總局", sourceEn: "State Taxation Administration" }
    ]
  };

  var US_ONLY_KEYS = { ir: true, fr: true };
  var US_ONLY_KINDS = { ir: true, fr: true };

  function unique(list) {
    var out = [];
    list.forEach(function (v) {
      if (out.indexOf(v) === -1) out.push(v);
    });
    return out;
  }

  function knownCountries() {
    return Object.keys(COUNTRY_SOURCES);
  }

  function sourcesForCountry(code) {
    return COUNTRY_SOURCES[code] ? COUNTRY_SOURCES[code].slice() : [];
  }

  function sourcesForCountries(codes) {
    var out = [];
    unique(codes || []).forEach(function (code) {
      sourcesForCountry(code).forEach(function (src) {
        out.push({ country: code, source: src });
      });
    });
    return out;
  }

  function filterItemsByCountries(items, codes) {
    var allow = {};
    unique(codes || []).forEach(function (c) { allow[c] = true; });
    return (items || []).filter(function (it) {
      if (!it || !it.country || !allow[it.country]) return false;
      if (US_ONLY_KINDS[it.kind] && it.country !== "us") return false;
      var owned = sourcesForCountry(it.country);
      if (!owned.length) return false;
      return owned.some(function (src) {
        return src.kinds.indexOf(it.kind) !== -1;
      });
    });
  }

  function sectionAllowed(sectionKey, codes) {
    if (US_ONLY_KEYS[sectionKey]) {
      return unique(codes || []).indexOf("us") !== -1;
    }
    return sourcesForCountries(codes).some(function (row) {
      return row.source.key === sectionKey;
    });
  }

  root.BriefSources = {
    APAC: APAC,
    COUNTRY_SOURCES: COUNTRY_SOURCES,
    US_ONLY_KEYS: US_ONLY_KEYS,
    knownCountries: knownCountries,
    sourcesForCountry: sourcesForCountry,
    sourcesForCountries: sourcesForCountries,
    filterItemsByCountries: filterItemsByCountries,
    sectionAllowed: sectionAllowed
  };
})(typeof window !== "undefined" ? window : globalThis);
