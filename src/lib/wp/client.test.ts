import assert from "node:assert/strict";
import { WpClient } from "./client";

type StubResponse = {
  status: number;
  body: Record<string, unknown>;
};

const originalFetch = globalThis.fetch;
process.env.ENERGIZE_PLUGIN_SECRET = "unit-test-secret";

async function checkWithResponses(responses: StubResponse[]) {
  const calls: Array<{ url: string; method: string }> = [];
  const queue = [...responses];

  globalThis.fetch = async (input, init) => {
    const next = queue.shift();
    assert.ok(next, "Unexpected fetch call");
    calls.push({
      url: String(input),
      method: init?.method ?? "GET",
    });
    return new Response(JSON.stringify(next.body), {
      status: next.status,
      headers: { "Content-Type": "application/json" },
    });
  };

  const result = await new WpClient("https://example.test").checkConnection(
    "website-team",
    "application-password",
  );
  assert.equal(queue.length, 0, "Not all stub responses were used");
  return { calls, result };
}

async function main() {
  try {
    const legacySuccess = await checkWithResponses([
      { status: 200, body: { id: 1 } },
      {
        status: 404,
        body: {
          code: "rest_no_route",
          message: "No route was found matching the URL and request method.",
        },
      },
      { status: 200, body: { ok: true } },
    ]);
    assert.deepEqual(legacySuccess.result, {
      ok: true,
      detail: "Credentials valid. Legacy Energize bridge verified.",
    });
    assert.deepEqual(
      legacySuccess.calls.map(({ url, method }) => [
        new URL(url).pathname,
        method,
      ]),
      [
        ["/wp-json/wp/v2/users/me", "GET"],
        ["/wp-json/energize/v1/health", "POST"],
        ["/wp-json/energize/v1/flush-css", "POST"],
      ],
    );

    const currentSecretFailure = await checkWithResponses([
      { status: 200, body: { id: 1 } },
      {
        status: 401,
        body: {
          code: "energize_unauthorized",
          message: "Invalid or missing X-Energize-Secret header.",
        },
      },
    ]);
    assert.equal(currentSecretFailure.result.ok, false);
    assert.match(currentSecretFailure.result.detail, /health check failed/);
    assert.equal(currentSecretFailure.calls.length, 2);

    const legacySecretFailure = await checkWithResponses([
      { status: 200, body: { id: 1 } },
      {
        status: 404,
        body: {
          code: "rest_no_route",
          message: "No route was found matching the URL and request method.",
        },
      },
      {
        status: 401,
        body: {
          code: "energize_unauthorized",
          message: "Invalid or missing X-Energize-Secret header.",
        },
      },
    ]);
    assert.equal(legacySecretFailure.result.ok, false);
    assert.match(legacySecretFailure.result.detail, /legacy Energize bridge/);
    assert.match(legacySecretFailure.result.detail, /Invalid or missing/);

    console.log("WordPress client connection checks passed");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

void main();
