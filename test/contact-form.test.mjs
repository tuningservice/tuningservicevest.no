import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../functions/api/contact.js", import.meta.url), "utf8");
const { onRequest } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

function environment(overrides = {}) {
  return {
    SITE_ID: "tuningservicevest-no",
    TURNSTILE_SECRET_KEY: "test-secret",
    ALLOWED_HOSTNAMES: "tuningservicevest.no,www.tuningservicevest.no",
    MAIL_WORKER: {
      async fetch() {
        return Response.json({ ok: true });
      },
    },
    ...overrides,
  };
}

function submission(overrides = {}) {
  const body = new FormData();
  body.set("name", "Testkunde");
  body.set("email", "kunde@example.com");
  body.set("phone", "99999999");
  body.set("company", "Test AS");
  body.set("message", "BMW E90 318d");
  body.set("cf-turnstile-response", "test-token");

  for (const [key, value] of Object.entries(overrides)) {
    body.set(key, value);
  }

  return new Request("https://tuningservicevest.no/api/contact", {
    method: "POST",
    body,
    headers: { "CF-Connecting-IP": "192.0.2.1" },
  });
}

async function withTurnstile(hostname, callback) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ success: true, hostname });

  try {
    return await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("GET is a harmless 405 health check", async () => {
  const response = await onRequest({
    request: new Request("https://tuningservicevest.no/api/contact"),
    env: environment(),
  });

  assert.equal(response.status, 405);
  assert.deepEqual(await response.json(), { ok: false, error: "method-not-allowed" });
});

test("missing configuration fails closed", async () => {
  const response = await onRequest({ request: submission(), env: {} });
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { ok: false, error: "not-configured" });
});

test("valid submission reaches the private worker", async () => {
  let forwarded;
  const env = environment({
    MAIL_WORKER: {
      async fetch(_url, init) {
        forwarded = JSON.parse(init.body);
        return Response.json({ ok: true });
      },
    },
  });

  const response = await withTurnstile("tuningservicevest.no", () =>
    onRequest({ request: submission(), env }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(forwarded.siteId, "tuningservicevest-no");
  assert.equal(forwarded.name, "Testkunde");
  assert.equal(forwarded.email, "kunde@example.com");
  assert.equal(forwarded.message, "BMW E90 318d");
});

test("Turnstile hostname must match exactly", async () => {
  const response = await withTurnstile("wrong.example", () =>
    onRequest({ request: submission(), env: environment() }),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { ok: false, error: "turnstile" });
});

test("invalid email is rejected after Turnstile", async () => {
  const response = await withTurnstile("tuningservicevest.no", () =>
    onRequest({ request: submission({ email: "not-an-email" }), env: environment() }),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { ok: false, error: "validation" });
});

test("body larger than 32 KB is rejected before verification", async () => {
  const response = await onRequest({
    request: new Request("https://tuningservicevest.no/api/contact", {
      method: "POST",
      body: `message=${"x".repeat(33 * 1024)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }),
    env: environment(),
  });

  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { ok: false, error: "payload-too-large" });
});

test("rate limiter can reject a burst", async () => {
  const response = await onRequest({
    request: submission(),
    env: environment({ RATE_LIMITER: { async limit() { return { success: false }; } } }),
  });

  assert.equal(response.status, 429);
  assert.deepEqual(await response.json(), { ok: false, error: "ratelimit" });
});

test("worker failure is not reported as sent", async () => {
  const env = environment({
    MAIL_WORKER: {
      async fetch() {
        return Response.json({ ok: false, error: "upstream" }, { status: 502 });
      },
    },
  });

  const response = await withTurnstile("tuningservicevest.no", () =>
    onRequest({ request: submission(), env }),
  );

  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { ok: false, error: "upstream" });
});
