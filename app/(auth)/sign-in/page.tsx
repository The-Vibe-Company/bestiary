import { SignInForm } from "@/components/auth/sign-in-form";
import { Card } from "@/components/ui/card";

export default function SignInPage() {
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
            <h1 className="text-5xl font-[family-name:var(--font-title)] tracking-[0.2em] text-[var(--ivory)] mb-2" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>
              BESTIARY
            </h1>
          </div>

          <Card>
            <SignInForm />
          </Card>
        </div>
      </div>
    </div>
  );
}
