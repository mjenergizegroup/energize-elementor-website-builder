import { AppShell } from "@/components/app-shell";
import packageJson from "../../../package.json";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const buildId =
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
    process.env.VERCEL_DEPLOYMENT_ID?.slice(0, 7) ??
    "local";

  return (
    <AppShell version={packageJson.version} buildId={buildId}>
      {children}
    </AppShell>
  );
}
