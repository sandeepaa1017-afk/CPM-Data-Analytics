import assert from "node:assert/strict";
import test from "node:test";
import {
  getEmployees,
  normalizeApiBaseUrl,
  setAccessToken,
} from "./api.js";

test("API service hostname gets the shared API path", () => {
  assert.equal(
    normalizeApiBaseUrl("https://cpm-api.onrender.com/"),
    "https://cpm-api.onrender.com/api",
  );
});

test("production API configuration must use HTTPS", () => {
  assert.throws(
    () => normalizeApiBaseUrl("http://localhost:8000", true),
    /HTTPS production API URL/,
  );
});

test("employee list is loaded from the live API without a demo fallback", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return new Response("[]", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    assert.deepEqual(await getEmployees(), []);
    assert.equal(requestedUrl, "http://localhost:8000/api/employees");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("backend failures are surfaced instead of returning demo content", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({ detail: "Service unavailable." }),
    {
      status: 503,
      headers: { "Content-Type": "application/json" },
    },
  );
  setAccessToken(null);

  try {
    await assert.rejects(getEmployees(), /Service unavailable\./);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
