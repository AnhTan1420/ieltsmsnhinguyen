import { Suspense } from "react";
import LoginForm from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 p-8 text-white">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
