import assert from "node:assert/strict";
import { WpApiError, WpClient } from "./client";

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

type ElementorRequester = {
  requestElementor<T>(
    path: string,
    method: "GET" | "POST" | "PUT",
    username: string,
    appPassword: string,
    body?: Record<string, unknown>,
  ): Promise<T>;
};

async function expectComponentLicenseFailure(
  tier: "core" | "expired",
  expectedMessage: RegExp,
) {
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        code: "insufficient_permissions",
        message: "You do not have permission to perform this action.",
        data: { status: 403, meta: { action: "create", tier } },
      }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );

  const client = new WpClient(
    "https://example.test",
  ) as unknown as ElementorRequester;

  await assert.rejects(
    () =>
      client.requestElementor(
        "/components",
        "POST",
        "website-team",
        "application-password",
        { status: "publish", items: [] },
      ),
    (error: unknown) => {
      assert.ok(error instanceof WpApiError);
      assert.equal(error.code, "insufficient_permissions");
      assert.equal(error.meta?.tier, tier);
      assert.match(error.message, expectedMessage);
      return true;
    },
  );
}

async function main() {
  try {
    const legacySuccess = await checkWithResponses([
      { status: 200, body: { id: 1 } },
      { status: 200, body: { title: "Example" } },
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
        ["/wp-json/wp/v2/settings", "GET"],
        ["/wp-json/energize/v1/health", "POST"],
        ["/wp-json/energize/v1/flush-css", "POST"],
      ],
    );

    const currentSecretFailure = await checkWithResponses([
      { status: 200, body: { id: 1 } },
      { status: 200, body: { title: "Example" } },
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
    assert.equal(currentSecretFailure.calls.length, 3);

    const legacySecretFailure = await checkWithResponses([
      { status: 200, body: { id: 1 } },
      { status: 200, body: { title: "Example" } },
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

    const legacyMissingSecret = await checkWithResponses([
      { status: 200, body: { id: 1 } },
      { status: 200, body: { title: "Example" } },
      {
        status: 404,
        body: {
          code: "rest_no_route",
          message: "No route was found matching the URL and request method.",
        },
      },
      {
        status: 500,
        body: {
          code: "energize_secret_missing",
          message: "Server is not configured with ENERGIZE_BUILD_SECRET.",
        },
      },
    ]);
    assert.equal(legacyMissingSecret.result.ok, false);
    assert.match(legacyMissingSecret.result.detail, /v2\.2\.0 WPCode Bridge/);
    assert.match(legacyMissingSecret.result.detail, /Run Everywhere/);

    const currentMissingSecret = await checkWithResponses([
      { status: 200, body: { id: 1 } },
      { status: 200, body: { title: "Example" } },
      {
        status: 500,
        body: {
          code: "energize_secret_missing",
          message: "Server is not configured with ENERGIZE_BUILD_SECRET.",
        },
      },
    ]);
    assert.equal(currentMissingSecret.result.ok, false);
    assert.match(currentMissingSecret.result.detail, /v2\.2\.0 WPCode Bridge/);
    assert.match(currentMissingSecret.result.detail, /live configuration/);

    const administratorPermissionFailure = await checkWithResponses([
      { status: 200, body: { id: 1 } },
      {
        status: 403,
        body: {
          code: "rest_cannot_view",
          message: "Sorry, you are not allowed to manage options on this site.",
        },
      },
    ]);
    assert.equal(administratorPermissionFailure.result.ok, false);
    assert.match(
      administratorPermissionFailure.result.detail,
      /not granting its user the Administrator permission/,
    );
    assert.deepEqual(
      administratorPermissionFailure.calls.map(({ url, method }) => [
        new URL(url).pathname,
        method,
      ]),
      [
        ["/wp-json/wp/v2/users/me", "GET"],
        ["/wp-json/wp/v2/settings", "GET"],
      ],
    );

    await expectComponentLicenseFailure(
      "core",
      /does not see an active Pro license for this domain/,
    );
    await expectComponentLicenseFailure(
      "expired",
      /Elementor Pro license is expired/,
    );

    const blogCalls: Array<{ url: string; body?: Record<string, unknown> }> = [];
    globalThis.fetch = async (input, init) => {
      blogCalls.push({
        url: String(input),
        body:
          typeof init?.body === "string"
            ? (JSON.parse(init.body) as Record<string, unknown>)
            : undefined,
      });
      if (!init?.method) {
        return Response.json([
          {
            id: 55,
            slug: "healthy-habits",
            status: "draft",
            link: "https://example.test/?p=55",
          },
        ]);
      }
      return Response.json({
        id: 55,
        status: "draft",
        link: "https://example.test/?p=55",
      });
    };
    const reusedDraft = await new WpClient(
      "https://example.test",
    ).upsertBlogDraft(
      {
        title: "Healthy Habits",
        slug: "healthy-habits",
        content: "<!-- wp:paragraph --><p>Body</p><!-- /wp:paragraph -->",
        featuredMediaId: 42,
      },
      "website-team",
      "application-password",
    );
    assert.equal(reusedDraft.reused, true);
    assert.equal(reusedDraft.status, "draft");
    assert.match(blogCalls[0].url, /status=any/);
    assert.match(blogCalls[1].url, /\/posts\/55$/);
    assert.equal(blogCalls[1].body?.status, "draft");
    assert.equal(blogCalls[1].body?.featured_media, 42);

    let conflictCalls = 0;
    globalThis.fetch = async () => {
      conflictCalls += 1;
      return Response.json([
        {
          id: 56,
          slug: "published-post",
          status: "publish",
          link: "https://example.test/published-post/",
        },
      ]);
    };
    await assert.rejects(
      () =>
        new WpClient("https://example.test").upsertBlogDraft(
          {
            title: "Published post",
            slug: "published-post",
            content: "Content",
          },
          "website-team",
          "application-password",
        ),
      (error: unknown) => {
        assert.ok(error instanceof WpApiError);
        assert.equal(error.status, 409);
        assert.equal(error.code, "energize_blog_slug_conflict");
        return true;
      },
    );
    assert.equal(conflictCalls, 1, "a published post must never be overwritten");

    console.log("WordPress client connection checks passed");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

void main();
