import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { buttonVariants } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default async function Home() {
  const { userId } = await auth();

  return (
    <main className="flex flex-1 items-center justify-center px-[34px] py-12">
      <div className="w-full max-w-xl rounded-[var(--radius)] border border-[var(--line)] bg-[var(--card)] p-8 text-center shadow-[var(--shadow-lg)]">
        <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-[14px] bg-linear-to-br from-[var(--primary)] to-[var(--secondary)] text-lg font-extrabold text-primary-foreground">
          E
        </div>
        <h1 className="text-[42px] font-bold leading-none tracking-[-0.025em] text-[var(--ink)]">
          Energize Website Builder
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm font-medium leading-6 text-[var(--muted)]">
          Internal tool for building dental practice WordPress sites. Inject
          approved content and brand kits into theme templates and push pages to
          client sites as drafts.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href={userId ? "/dashboard" : "/sign-in"}
            className={buttonVariants()}
          >
            {userId ? "Go to dashboard" : "Sign in"}
            <ArrowRight data-icon="inline-end" />
          </Link>
        </div>
      </div>
    </main>
  );
}
