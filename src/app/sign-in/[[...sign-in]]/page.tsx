import { SignIn } from "@clerk/nextjs";
import { AuthShell } from "@/components/app/auth-shell";

export default function Page() {
  return (
    <AuthShell>
      <SignIn />
    </AuthShell>
  );
}
