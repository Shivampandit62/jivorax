/*
 * Jivora — contact page.
 * The site has no backend, so the form composes a mailto: URL that opens
 * the visitor's own email app. Nothing is transmitted by this website.
 */
(function () {
  "use strict";

  var form = document.getElementById("contact-form");
  if (!form) return;

  var cfg = window.JIVORA_CONFIG || {};
  var email = (cfg.contactEmail || "shivampandey30791@gmail.com").trim();

  var nameEl = document.getElementById("c-name");
  var topicEl = document.getElementById("c-topic");
  var messageEl = document.getElementById("c-message");
  var errorEl = document.getElementById("c-error");
  var errorText = errorEl.querySelector("span");

  /* keep every mailto link in sync with the owner config */
  var links = document.querySelectorAll('a[href^="mailto:"]');
  for (var i = 0; i < links.length; i++) {
    links[i].setAttribute("href", "mailto:" + email);
  }

  function showError(msg) {
    errorText.textContent = msg;
    errorEl.classList.add("is-shown");
    messageEl.setAttribute("aria-invalid", "true");
  }

  function hideError() {
    errorEl.classList.remove("is-shown");
    messageEl.removeAttribute("aria-invalid");
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    hideError();

    var message = (messageEl.value || "").trim();
    if (!message) {
      showError("Write a short message first — then we can open your email app.");
      messageEl.focus();
      return;
    }

    var topic = topicEl.value || "Message";
    var name = (nameEl.value || "").trim();
    var subject = "[Jivora] " + topic + (name ? " — " + name : "");
    var body = message + (name ? "\n\n— " + name : "");

    var href =
      "mailto:" + email +
      "?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(body);

    window.JivoraUI.track("tool_action", { tool: "contact", action: "compose" });
    window.location.href = href;
  });

  form.addEventListener("input", hideError);
})();
