import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = {
  title: "Log in — Greenboard",
  description: "Log in to Greenboard, or keep going as a guest.",
};

export default function LoginPage() {
  return (
    <AuthShell title="Welcome back" subtitle="Log in to pick up where you left off.">
      <AuthForm mode="login" />
    </AuthShell>
  );
}
