import "server-only";
import { serverEnv } from "@/lib/env";
import type {
  KitColor,
  KitTypography,
} from "@/lib/wp/brand";

// Server-side WordPress client. Talks to the energize-build-tool mu-plugin
// endpoints (shared-secret auth) and, for a pre-flight connectivity check, to
// the standard WP REST API using Application Password Basic Auth (the same
// pattern as the push-blogs.py script referenced in the brief).

const DEFAULT_TIMEOUT_MS = 30_000;

export interface CreatePageInput {
  title: string;
  slug?: string;
  template?: string;
  elementorData: unknown[];
  elementorVersion?: string;
  status?: "draft";
}

export interface CreatePageResult {
  id: number;
  slug: string;
  status: string;
  editUrl: string;
  viewUrl: string;
}

function normalizeBaseUrl(siteUrl: string): string {
  return siteUrl.replace(/\/+$/, "");
}

export class WpApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "WpApiError";
  }
}

export class WpClient {
  private readonly base: string;

  constructor(siteUrl: string) {
    this.base = normalizeBaseUrl(siteUrl);
  }

  private pluginUrl(path: string): string {
    return `${this.base}/wp-json/energize/v1${path}`;
  }

  private async postPlugin<T>(
    path: string,
    body: Record<string, unknown>,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(this.pluginUrl(path), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Energize-Secret": serverEnv.pluginSecret,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
        cache: "no-store",
      });
      const text = await res.text();
      let json: unknown;
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        throw new WpApiError(
          `Non-JSON response from ${path} (status ${res.status})`,
          res.status,
        );
      }
      if (!res.ok) {
        const err = json as { message?: string; code?: string };
        throw new WpApiError(
          err.message ?? `Request to ${path} failed`,
          res.status,
          err.code,
        );
      }
      return json as T;
    } catch (e) {
      if (e instanceof WpApiError) throw e;
      if (e instanceof Error && e.name === "AbortError") {
        throw new WpApiError(`Request to ${path} timed out`, 408);
      }
      throw new WpApiError(
        e instanceof Error ? e.message : `Request to ${path} failed`,
        0,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  // Pre-flight: confirm the site URL and Application Password are valid before
  // a deploy. Uses standard WP REST Basic Auth.
  async checkConnection(
    username: string,
    appPassword: string,
  ): Promise<{ ok: boolean; detail: string }> {
    const auth = Buffer.from(`${username}:${appPassword}`).toString("base64");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const res = await fetch(`${this.base}/wp-json/wp/v2/users/me`, {
        headers: { Authorization: `Basic ${auth}` },
        signal: controller.signal,
        cache: "no-store",
      });
      if (res.status === 401 || res.status === 403) {
        return { ok: false, detail: "WordPress rejected the username or application password." };
      }
      if (!res.ok) {
        return { ok: false, detail: `WordPress returned status ${res.status}.` };
      }
      return { ok: true, detail: "Credentials valid." };
    } catch (e) {
      return {
        ok: false,
        detail: e instanceof Error ? e.message : "Could not reach the site.",
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async createPage(input: CreatePageInput): Promise<CreatePageResult> {
    const res = await this.postPlugin<{
      id: number;
      slug: string;
      status: string;
      edit_url: string;
      view_url: string;
    }>("/page", {
      title: input.title,
      slug: input.slug,
      template: input.template,
      elementor_data: JSON.stringify(input.elementorData),
      elementor_version: input.elementorVersion,
      status: input.status ?? "draft",
    });
    return {
      id: res.id,
      slug: res.slug,
      status: res.status,
      editUrl: res.edit_url,
      viewUrl: res.view_url,
    };
  }

  async setBrandColors(
    systemColors: KitColor[],
    customColors: KitColor[],
  ): Promise<void> {
    await this.postPlugin("/brand-colors", {
      system_colors: systemColors,
      custom_colors: customColors,
    });
  }

  async setBrandFonts(systemTypography: KitTypography[]): Promise<void> {
    await this.postPlugin("/brand-fonts", {
      system_typography: systemTypography,
    });
  }

  async setLogo(filename: string, dataBase64: string): Promise<void> {
    await this.postPlugin("/logo", { filename, file: dataBase64 });
  }

  async setFavicon(filename: string, dataBase64: string): Promise<void> {
    await this.postPlugin("/favicon", { filename, file: dataBase64 });
  }

  async flushCss(): Promise<void> {
    await this.postPlugin("/flush-css", {});
  }
}
