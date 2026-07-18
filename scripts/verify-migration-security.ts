import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routeFiles = [
  "src/app/api/migrations/route.ts",
  "src/app/api/migrations/[projectId]/route.ts",
  "src/app/api/migrations/[projectId]/source/route.ts",
  "src/app/api/migrations/[projectId]/media/route.ts",
  "src/app/api/migrations/[projectId]/blogs/route.ts",
  "src/app/api/migrations/[projectId]/deploy/route.ts",
  "src/app/api/layouts/route.ts",
  "src/app/api/migrations/[projectId]/page-plan/route.ts",
  "src/app/api/migrations/[projectId]/content-matches/route.ts",
  "src/app/api/migrations/[projectId]/prepared-drafts/route.ts",
];

for (const file of routeFiles) {
  const source = read(file);
  assert.match(source, /await auth\(\)/, `${file} must authenticate requests`);
  assert.match(source, /Unauthorized/, `${file} must reject anonymous requests`);
}

for (const file of [
  "src/lib/wp/client.ts",
  "src/lib/clients.ts",
  "src/lib/migration/media/migrate.ts",
  "src/lib/migration/media/remote.ts",
  "src/lib/migration/projects.ts",
  "src/lib/security/uploads.ts",
  "src/lib/layouts/repository.ts",
  "src/lib/page-plan/repository.ts",
  "src/lib/content-matches/repository.ts",
  "src/lib/prepared-drafts/repository.ts",
]) {
  assert.match(read(file), /^import "server-only";/, `${file} must remain server-only`);
}

const clientSources = [
  "src/components/build-wizard.tsx",
  "src/components/dependency-resolver.tsx",
  "src/components/template-importer.tsx",
  "src/components/template-library.tsx",
  "src/components/page-plan-workspace.tsx",
  "src/components/content-match-workspace.tsx",
].map(read).join("\n");
assert.doesNotMatch(clientSources, /ENERGIZE_PLUGIN_SECRET|ENCRYPTION_KEY|DATABASE_URL/);

const migrationDeploy = read(
  "src/app/api/migrations/[projectId]/deploy/route.ts",
);
assert.match(migrationDeploy, /createdBy: userId/);
assert.match(migrationDeploy, /checkDeployRateLimit/);
assert.match(
  read("src/lib/migration/deploy/schema.ts"),
  /dryRun: z\.boolean\(\)\.default\(true\)/,
);

console.log("migration security boundaries verified");

function read(file: string): string {
  return readFileSync(resolve(process.cwd(), file), "utf8");
}
