import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { TemplateLibrary } from "@/components/template-library";
import { listLayoutTemplates } from "@/lib/layouts/repository";

export const dynamic = "force-dynamic";

export default async function TemplateLibraryPage() {
  const { userId } = await auth();
  if (!userId) notFound();
  const layouts = await listLayoutTemplates(userId);

  return (
    <main className="page-body">
      <TemplateLibrary initialLayouts={layouts} />
    </main>
  );
}
