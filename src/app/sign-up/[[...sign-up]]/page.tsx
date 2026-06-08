import { SignUp } from "@clerk/nextjs";

const appearance = {
  variables: {
    fontFamily: "Inter, sans-serif",
    colorPrimary: "#bf2e31",
    colorText: "#191919",
    colorBackground: "#FFFFFF",
    colorInputBackground: "#FFFFFF",
    colorInputText: "#191919",
    borderRadius: "0px",
  },
};

export default function SignUpPage() {
  return (
    <main className="app-wrap flex flex-1 items-center">
      <section className="auth-card mx-auto grid w-full max-w-[980px] grid-cols-[320px_minmax(0,1fr)]">
        <div className="flex flex-col justify-between bg-[var(--color-black)] p-7 text-[var(--color-on-black)]">
          <div>
            <div className="brand-mark mb-6">E</div>
            <div className="eyebrow">{"// Team access"}</div>
            <h1 className="mt-3 text-[36px] font-black leading-none tracking-[-0.04em] text-white">
              Create access.
            </h1>
            <p className="mt-4 text-[13px] leading-6 text-[#aaaaaa]">
              Team-only account setup for the Energize Website Builder.
            </p>
          </div>
          <div className="text-[10px] font-bold uppercase leading-none tracking-[0.12em] text-[#777777]">
            Internal production
          </div>
        </div>
        <div className="flex items-center justify-center bg-[var(--color-surface)] p-8">
          <SignUp appearance={appearance} />
        </div>
      </section>
    </main>
  );
}
