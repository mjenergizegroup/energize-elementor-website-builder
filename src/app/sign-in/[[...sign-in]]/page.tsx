import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-[34px] py-12">
      <SignIn />
    </main>
  );
}
