const MAX_BODY_BYTES = 32 * 1024;
const TURNSTILE_TIMEOUT_MS = 5000;

function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

function logResult(siteId, result) {
  console.log(JSON.stringify({
    siteId: siteId || "not-configured",
    time: new Date().toISOString(),
    result,
  }));
}

function allowedHostnames(raw) {
  return String(raw || "")
    .split(",")
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);
}

async function readBodyWithLimit(request) {
  const declaredLength = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return { ok: false, reason: "too-large" };
  }

  if (!request.body) {
    return { ok: false, reason: "read-error" };
  }

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        try {
          await reader.cancel();
        } catch (_) {
          // Kroppen er allereie fastslått for stor. Cancel-feil endrar ikkje det.
        }
        return { ok: false, reason: "too-large" };
      }

      chunks.push(value);
    }
  } catch (_) {
    return { ok: false, reason: "read-error" };
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, body };
}

function formValue(formData, name) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function hasControlCharacters(value, allowLineBreaks = false) {
  const pattern = allowLineBreaks
    ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/
    : /[\u0000-\u001f\u007f]/;
  return pattern.test(value);
}

function validEmail(value) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateSubmission(submission) {
  if (!submission.name || !submission.email) {
    return false;
  }

  if (
    submission.name.length > 100 ||
    submission.email.length > 254 ||
    submission.phone.length > 30 ||
    submission.company.length > 100 ||
    submission.package.length > 40 ||
    submission.message.length > 3000
  ) {
    return false;
  }

  if (!validEmail(submission.email)) {
    return false;
  }

  if (
    hasControlCharacters(submission.name) ||
    hasControlCharacters(submission.email) ||
    hasControlCharacters(submission.phone) ||
    hasControlCharacters(submission.company) ||
    hasControlCharacters(submission.package) ||
    hasControlCharacters(submission.message, true)
  ) {
    return false;
  }

  return true;
}

async function verifyTurnstile(token, request, env, hostnames) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TURNSTILE_TIMEOUT_MS);

  try {
    const body = new URLSearchParams({
      secret: env.TURNSTILE_SECRET_KEY,
      response: token,
    });
    const ip = request.headers.get("CF-Connecting-IP");
    if (ip) {
      body.set("remoteip", ip);
    }

    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body,
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      return false;
    }

    const result = await response.json();
    const hostname = String(result.hostname || "").toLowerCase();
    return result.success === true && hostnames.includes(hostname);
  } catch (_) {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function rateLimit(request, env) {
  if (!env.RATE_LIMITER || typeof env.RATE_LIMITER.limit !== "function") {
    return true;
  }

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  try {
    const result = await env.RATE_LIMITER.limit({ key: `${env.SITE_ID}:${ip}` });
    return result && result.success !== false;
  } catch (_) {
    logResult(env.SITE_ID, "rate-limiter-unavailable");
    return true;
  }
}

export async function onRequest({ request, env }) {
  if (request.method !== "POST") {
    return json(405, { ok: false, error: "method-not-allowed" }, { Allow: "POST" });
  }

  const hostnames = allowedHostnames(env.ALLOWED_HOSTNAMES);
  if (
    !env.SITE_ID ||
    !env.TURNSTILE_SECRET_KEY ||
    !env.MAIL_WORKER ||
    hostnames.length === 0
  ) {
    logResult(env.SITE_ID, "not-configured");
    return json(500, { ok: false, error: "not-configured" });
  }

  if (!(await rateLimit(request, env))) {
    logResult(env.SITE_ID, "ratelimit");
    return json(429, { ok: false, error: "ratelimit" });
  }

  const contentType = request.headers.get("Content-Type") || "";
  if (
    !contentType.startsWith("multipart/form-data") &&
    !contentType.startsWith("application/x-www-form-urlencoded")
  ) {
    logResult(env.SITE_ID, "validation");
    return json(400, { ok: false, error: "validation" });
  }

  const bodyResult = await readBodyWithLimit(request);
  if (!bodyResult.ok) {
    const tooLarge = bodyResult.reason === "too-large";
    logResult(env.SITE_ID, tooLarge ? "payload-too-large" : "bad-request");
    return json(
      tooLarge ? 413 : 400,
      { ok: false, error: tooLarge ? "payload-too-large" : "validation" },
    );
  }

  let formData;
  try {
    formData = await new Response(bodyResult.body, {
      headers: { "Content-Type": contentType },
    }).formData();
  } catch (_) {
    logResult(env.SITE_ID, "validation");
    return json(400, { ok: false, error: "validation" });
  }

  const token = formValue(formData, "cf-turnstile-response");
  if (!token || !(await verifyTurnstile(token, request, env, hostnames))) {
    logResult(env.SITE_ID, "turnstile");
    return json(400, { ok: false, error: "turnstile" });
  }

  const submission = {
    siteId: env.SITE_ID,
    name: formValue(formData, "name"),
    email: formValue(formData, "email"),
    phone: formValue(formData, "phone"),
    company: formValue(formData, "company"),
    package: formValue(formData, "package"),
    message: formValue(formData, "message"),
  };

  if (!validateSubmission(submission)) {
    logResult(env.SITE_ID, "validation");
    return json(400, { ok: false, error: "validation" });
  }

  try {
    const upstream = await env.MAIL_WORKER.fetch("https://internal/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submission),
    });
    const result = await upstream.json().catch(() => ({}));

    if (!upstream.ok || result.ok !== true) {
      logResult(env.SITE_ID, "upstream");
      return json(502, { ok: false, error: "upstream" });
    }

    logResult(env.SITE_ID, "accepted");
    return json(200, { ok: true });
  } catch (_) {
    logResult(env.SITE_ID, "upstream");
    return json(502, { ok: false, error: "upstream" });
  }
}
