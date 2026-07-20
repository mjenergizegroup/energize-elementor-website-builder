import Link from "next/link";
import Image from "next/image";
import { auth } from "@clerk/nextjs/server";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default async function Home() {
  const { userId } = await auth();

  return (
    <main className="app-wrap flex flex-1 items-center">
      <section className="auth-card mx-auto grid w-full max-w-[760px] md:grid-cols-[220px_minmax(0,1fr)]">
        <div className="flex flex-col justify-between bg-[var(--color-primary-tint)] p-7 text-[var(--color-text-primary)]">
          <div>
            <Image
              src="/brand/energize-logo.png"
              alt="Energize Group"
              width={180}
              height={81}
              priority
              className="mb-6 h-auto w-36"
            />
            <div className="text-xs font-semibold uppercase leading-none tracking-[0.04em] text-[var(--color-text-faint)]">
              Internal tool
            </div>
          </div>
          <div className="text-xs font-semibold uppercase leading-none tracking-[0.04em] text-[var(--color-text-faint)]">
            Production
          </div>
        </div>
        <div className="bg-[var(--color-surface-raised)] p-8">
          <h1 className="text-4xl font-bold leading-tight tracking-[-0.03em]">
            Energize Website Builder
          </h1>
          <p className="mt-4 max-w-md text-[13px] leading-6 text-[var(--color-text-secondary)]">
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
