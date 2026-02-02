import { SignUpForm } from '@/components/auth/sign-up-form'
import { Card } from '@/components/ui/card'

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-[#10b981] mb-2 font-[family-name:var(--font-title)]">
            Bestiary
          </h1>
          <p className="text-gray-600">Créez votre compte</p>
        </div>

        <Card>
          <SignUpForm />
        </Card>
      </div>
    </div>
  )
}
