import { SignUpForm } from "@/components/auth/sign-up-form";
import { Card } from "@/components/ui/card";

export default function SignUpPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url(/assets/background.png)" }}
      />

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/50"></div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-[family-name:var(--font-title)] tracking-[0.2em] text-[var(--ivory)] mb-2 stone-texture inline-block px-4 py-2 rounded">
              BESTIARY
            </h1>
          </div>

          <Card>
            <SignUpForm />
          </Card>
        </div>
      </div>
    </div>
  );
}
