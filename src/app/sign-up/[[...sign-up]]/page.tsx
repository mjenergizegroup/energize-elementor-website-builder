import { SignUp } from "@clerk/nextjs";
import Image from "next/image";

const appearance = {
  variables: {
    fontFamily: "Inter, sans-serif",
    colorPrimary: "var(--color-primary)",
    colorText: "var(--color-text-primary)",
    colorBackground: "var(--color-surface-raised)",
    colorInputBackground: "var(--color-surface-raised)",
    colorInputText: "var(--color-text-primary)",
    borderRadius: "10px",
  },
};

export default function SignUpPage() {
  return (
    <main className="app-wrap flex flex-1 items-center">
      <section className="auth-card mx-auto grid w-full max-w-[980px] md:grid-cols-[320px_minmax(0,1fr)]">
        <div className="flex flex-col justify-between bg-[var(--color-primary-tint)] p-8 text-[var(--color-text-primary)]">
          <div>
            <Image
              src="/brand/energize-logo.png"
              alt="Energize Group"
              width={180}
              height={81}
              priority
              className="mb-8 h-auto w-36"
            />
            <div className="eyebrow">Team access</div>
            <h1 className="mt-3 text-4xl font-bold leading-tight tracking-[-0.03em] text-[var(--color-text-primary)]">
              Create access
            </h1>
            <p className="mt-4 text-sm leading-6 text-[var(--color-text-secondary)]">
              Team-only account setup for the Energize Website Builder.
            </p>
          </div>
          <div className="text-xs font-semibold uppercase leading-none tracking-[0.04em] text-[var(--color-text-faint)]">
            Internal production
          </div>
        </div>
        <div className="flex items-center justify-center bg-[var(--color-surface-raised)] p-8">
          <SignUp appearance={appearance} />
        </div>
      </section>
    </main>
  );
}
