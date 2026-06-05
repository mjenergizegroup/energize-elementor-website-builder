import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-[34px] py-12">
      <SignUp />
    </main>
  );
}
