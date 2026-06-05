import "server-only";
import { serverEnv } from "@/lib/env";
import type {
  KitColor,
  KitTypography,
} from "@/lib/wp/brand";

// Server-side WordPress client. Talks to the Energize REST endpoints
// with shared-secret auth, and to the standard WP REST API with
// Application Password Basic Auth when core settings need updating.

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

  private wpUrl(path: string): string {
    return `${this.base}/wp-json/wp/v2${path}`;
  }

  private basicAuth(username: string, appPassword: string): string {
    return Buffer.from(`${username}:${appPassword}`).toString("base64");
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
      return await this.parseResponse<T>(res, path);
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

  private async postPluginForm<T>(
    path: string,
    body: FormData,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(this.pluginUrl(path), {
        method: "POST",
        headers: {
          "X-Energize-Secret": serverEnv.pluginSecret,
        },
        body,
        signal: controller.signal,
        cache: "no-store",
      });
      return await this.parseResponse<T>(res, path);
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

  private async parseResponse<T>(res: Response, path: string): Promise<T> {
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
  }

  private async postWp<T>(
    path: string,
    body: Record<string, unknown>,
    username: string,
    appPassword: string,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(this.wpUrl(path), {
        method: "POST",
        headers: {
          Authorization: `Basic ${this.basicAuth(username, appPassword)}`,
          "Content-Type": "application/json",
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
    const auth = this.basicAuth(username, appPassword);
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

  async setSiteName(
    username: string,
    appPassword: string,
    siteName: string,
  ): Promise<void> {
    const title = siteName.trim();
    if (!title) {
      throw new WpApiError("Site name is required.", 400);
    }
    await this.postWp("/settings", { title }, username, appPassword);
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
    await this.uploadAsset("/logo", filename, dataBase64);
  }

  async setFavicon(filename: string, dataBase64: string): Promise<void> {
    await this.uploadAsset("/favicon", filename, dataBase64);
  }

  async flushCss(): Promise<void> {
    await this.postPlugin("/flush-css", {});
  }

  private async uploadAsset(
    path: "/logo" | "/favicon",
    filename: string,
    dataBase64: string,
  ): Promise<void> {
    const cleanBase64 = stripDataUri(dataBase64);
    try {
      await this.postPlugin(path, assetJsonPayload(filename, cleanBase64));
    } catch (e) {
      if (!shouldRetryAssetAsMultipart(e)) throw e;
      await this.postPluginForm(path, assetFormPayload(filename, cleanBase64));
    }
  }
}

function assetJsonPayload(
  filename: string,
  dataBase64: string,
): Record<string, string> {
  return {
    filename,
    file: dataBase64,
    fileData: dataBase64,
    file_data: dataBase64,
    data: dataBase64,
    dataBase64,
    data_base64: dataBase64,
    base64: dataBase64,
    content: dataBase64,
  };
}

function assetFormPayload(filename: string, dataBase64: string): FormData {
  const form = new FormData();
  const buffer = Buffer.from(dataBase64, "base64");
  const blob = new Blob([buffer], { type: mimeFromFilename(filename) });

  form.append("filename", filename);
  form.append("file", blob, filename);
  form.append("fileData", dataBase64);
  form.append("file_data", dataBase64);
  form.append("data", dataBase64);
  form.append("dataBase64", dataBase64);
  form.append("data_base64", dataBase64);
  form.append("base64", dataBase64);
  form.append("content", dataBase64);

  return form;
}

function shouldRetryAssetAsMultipart(error: unknown): boolean {
  if (!(error instanceof WpApiError)) return false;
  if (error.status !== 400) return false;
  return /file data|file.*base64|base64.*required|missing.*file/i.test(
    error.message,
  );
}

function stripDataUri(value: string): string {
  return value.includes("base64,") ? value.slice(value.indexOf("base64,") + 7) : value;
}

function mimeFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "svg") return "image/svg+xml";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "ico") return "image/x-icon";
  return "image/png";
}
