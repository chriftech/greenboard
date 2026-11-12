import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = {
  title: "Sign up — Greenboard",
  description: "Create a Greenboard account, or keep going as a guest.",
};

export default function SignupPage() {
  return (
    <AuthShell title="Create your account" subtitle="Free, and your board comes with you.">
      <AuthForm mode="signup" />
    </AuthShell>
  );
}
