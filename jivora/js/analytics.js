/*
 * Jivora — analytics & verification layer.
 * - Injects the Google Search Console verification meta tag when configured.
 * - Loads Google Analytics 4 ONLY when a real Measurement ID exists in js/config.js.
 * - Exposes window.JivoraAnalytics.track() which is a safe no-op otherwise.
 * - Never sends personally identifiable information. Events carry aggregate
 *   context only (tool slug, category, counts).
 */
(function () {
  "use strict";

  var cfg = window.JIVORA_CONFIG || {};

  /* ---- Google Search Console (HTML tag method) ---- */
  try {
    var verification = (cfg.searchConsoleVerification || "").trim();
    if (verification && !document.querySelector('meta[name="google-site-verification"]')) {
      var meta = document.createElement("meta");
      meta.setAttribute("name", "google-site-verification");
      meta.setAttribute("content", verification);
      document.head.appendChild(meta);
    }
  } catch (e) {
    /* ignore */
  }

  /* ---- Google Analytics 4 ---- */
  var enabled = false;
  var id = (cfg.ga4MeasurementId || "").trim();

  if (id && /^G-[A-Z0-9]{6,}$/i.test(id)) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", id, {
      anonymize_ip: true,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      transport_type: "beacon"
    });

    var script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
    document.head.appendChild(script);
    enabled = true;
  }

  /* ---- Public helper ---- */
  window.JivoraAnalytics = {
    enabled: enabled,
    track: function (eventName, params) {
      if (!enabled || typeof window.gtag !== "function") return;
      try {
        window.gtag("event", eventName, params || {});
      } catch (e) {
        /* never let analytics break the tool */
      }
    }
  };
})();
