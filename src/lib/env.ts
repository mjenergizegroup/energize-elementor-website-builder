// Centralized, validated access to server-side environment variables.
// Never import this from client components. These values must stay on the server.

import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const serverEnv = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get clerkSecretKey() {
    return required("CLERK_SECRET_KEY");
  },
  get encryptionKey() {
    return required("ENCRYPTION_KEY");
  },
  get pluginSecret() {
    return required("ENERGIZE_PLUGIN_SECRET");
  },
};
