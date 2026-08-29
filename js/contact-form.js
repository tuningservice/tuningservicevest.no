(function () {
  "use strict";

  var form = document.getElementById("kontaktskjema");
  var status = document.getElementById("kontaktskjema-status");

  if (!form || !status) {
    return;
  }

  var text = {
    missing: "Fyll ut namn og e-post før du sender.",
    invalidEmail: "Skriv inn ei gyldig e-postadresse.",
    sending: "Sender…",
    checking: "Stadfestar at du ikkje er ein robot…",
    sent: "Takk! Henvendinga er sendt. Vi tek kontakt så snart vi kan.",
    turnstile: "Kunne ikkje stadfeste at du ikkje er ein robot. Prøv igjen, eller ring 948 09 710.",
    rateLimit: "For mange forsøk på kort tid. Vent litt og prøv igjen, eller ring 948 09 710.",
    validation: "Sjekk at namn og e-post er fylt ut rett, og prøv igjen.",
    unknown: "Noko gjekk gale, og meldinga blei ikkje sendt. Prøv igjen, eller ring 948 09 710."
  };

  var turnstileStarted = false;

  function show(message, isError) {
    status.textContent = message;
    status.classList.toggle("error", Boolean(isError));
    status.hidden = false;
  }

  function startTurnstile() {
    if (turnstileStarted) {
      return;
    }

    turnstileStarted = true;

    var script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }

  function turnstileToken() {
    var field = form.querySelector('[name="cf-turnstile-response"]');
    return field && field.value ? field.value : "";
  }

  function waitForTurnstile(maxMs) {
    return new Promise(function (resolve, reject) {
      if (turnstileToken()) {
        resolve();
        return;
      }

      var startedAt = Date.now();
      var interval = setInterval(function () {
        if (turnstileToken()) {
          clearInterval(interval);
          resolve();
        } else if (Date.now() - startedAt > maxMs) {
          clearInterval(interval);
          reject(new Error("turnstile"));
        }
      }, 100);
    });
  }

  var interactionEvents = ["focusin", "pointerdown", "input", "change"];

  function onFirstInteraction() {
    interactionEvents.forEach(function (eventName) {
      form.removeEventListener(eventName, onFirstInteraction);
    });
    startTurnstile();
  }

  interactionEvents.forEach(function (eventName) {
    form.addEventListener(eventName, onFirstInteraction, { passive: true });
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var name = document.getElementById("navn");
    var email = document.getElementById("epost");
    var button = form.querySelector('[type="submit"]');
    var originalButtonText = button ? button.textContent : "";
    var missing = false;

    [name, email].forEach(function (field) {
      if (!field) {
        return;
      }
      var empty = field.value.trim() === "";
      field.setAttribute("aria-invalid", empty ? "true" : "false");
      if (empty) {
        missing = true;
      }
    });

    if (missing) {
      show(text.missing, true);
      if (name && name.value.trim() === "") {
        name.focus();
      } else if (email) {
        email.focus();
      }
      return;
    }

    if (email && !email.validity.valid) {
      email.setAttribute("aria-invalid", "true");
      show(text.invalidEmail, true);
      email.focus();
      return;
    }

    if (button) {
      button.disabled = true;
      button.textContent = text.sending;
    }

    startTurnstile();
    show(turnstileToken() ? text.sending : text.checking, false);

    waitForTurnstile(20000)
      .then(function () {
        show(text.sending, false);
        return fetch(form.action, {
          method: "POST",
          body: new FormData(form),
          headers: { "Accept": "application/json" }
        });
      })
      .then(function (response) {
        return response.json()
          .catch(function () { return {}; })
          .then(function (data) {
            if (!response.ok || !data || data.ok !== true) {
              throw new Error(data && data.error ? data.error : "unknown");
            }
          });
      })
      .then(function () {
        form.reset();
        [name, email].forEach(function (field) {
          if (field) {
            field.removeAttribute("aria-invalid");
          }
        });

        if (typeof turnstile !== "undefined" && turnstile.reset) {
          turnstile.reset();
        }

        if (typeof gtag === "function") {
          gtag("event", "conversion_event_contact", { contact_method: "form" });
        }

        show(text.sent, false);
      })
      .catch(function (error) {
        var message = text.unknown;

        if (error && error.message === "turnstile") {
          message = text.turnstile;
        } else if (error && error.message === "ratelimit") {
          message = text.rateLimit;
        } else if (error && (error.message === "validation" || error.message === "payload-too-large")) {
          message = text.validation;
        }

        if (typeof turnstile !== "undefined" && turnstile.reset) {
          turnstile.reset();
        }

        show(message, true);
      })
      .finally(function () {
        if (button) {
          button.disabled = false;
          button.textContent = originalButtonText;
        }
      });
  });
})();
