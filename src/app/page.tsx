import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default async function Home() {
  const { userId } = await auth();

  return (
    <main className="app-wrap flex flex-1 items-center">
      <section className="auth-card mx-auto grid w-full max-w-[760px] grid-cols-[220px_minmax(0,1fr)]">
        <div className="flex flex-col justify-between bg-[var(--color-black)] p-6 text-[var(--color-on-black)]">
          <div>
            <div className="brand-mark mb-5">E</div>
            <div className="text-[10px] font-bold uppercase leading-none tracking-[0.12em] text-[var(--color-red)]">
              {"// Internal tool"}
            </div>
          </div>
          <div className="text-[10px] font-bold uppercase leading-none tracking-[0.12em] text-[#777777]">
            Production
          </div>
        </div>
        <div className="bg-[var(--color-surface)] p-8">
          <h1 className="text-[36px] font-black leading-none tracking-[-0.04em]">
            Energize Website Builder.
          </h1>
          <p className="mt-4 max-w-md text-[13px] leading-6 text-[var(--color-muted)]">
            Build Elementor V4 pages from shared Atomic variables, classes, and
            components, then push WordPress drafts for dental practice sites.
          </p>
          <div className="mt-8">
            <Link
              href={userId ? "/dashboard" : "/sign-in"}
              className={buttonVariants()}
            >
              {userId ? "Go to Dashboard" : "Sign In"}
              <ArrowRight data-icon="inline-end" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
