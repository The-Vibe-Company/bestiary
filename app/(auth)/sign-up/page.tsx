import { SignUpForm } from "@/components/auth/sign-up-form";
import { Card } from "@/components/ui/card";

export default function SignUpPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url(/assets/backgrounds/background-main.png)" }}
      />

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/50"></div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8 flex items-center justify-center gap-3">
            <span className="text-[var(--burnt-amber)] text-sm">◆</span>
            <h1
              className="font-[family-name:var(--font-title)] font-bold tracking-[0.2em]"
              style={{ textShadow: '0 0 25px rgba(179,123,52,0.35)' }}
            >
              <span className="text-5xl text-[var(--burnt-amber)]">B</span>
              <span className="text-3xl text-[var(--ivory)]">ESTIARY</span>
            </h1>
            <span className="text-[var(--burnt-amber)] text-sm">◆</span>
          </div>

          <Card>
            <SignUpForm />
          </Card>
        </div>
      </div>
    </div>
  );
}
