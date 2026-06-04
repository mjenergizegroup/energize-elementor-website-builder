import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { buttonVariants } from "@/components/ui/button";

export default async function Home() {
  const { userId } = await auth();

  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-md text-center space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">
          Energize Build Tool
        </h1>
        <p className="text-muted-foreground">
          Internal tool for building dental practice WordPress sites. Inject
          approved content and brand kits into theme templates and push pages to
          client sites as drafts.
        </p>
        <div className="flex justify-center gap-3">
          <Link
            href={userId ? "/dashboard" : "/sign-in"}
            className={buttonVariants()}
          >
            {userId ? "Go to dashboard" : "Sign in"}
          </Link>
        </div>
      </div>
    </main>
  );
}
