import { SignupForm } from "../../components/signup-form"
import Image from "next/image"
import Link from "next/link"

export default function SignupPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-[#0f1420] p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col items-center gap-8">
        <Link href="/" className="flex flex-col items-center gap-2">
          <Image
            src="/logo2.png"
            alt="Polaris Logo"
            width={80}
            height={80}
          />
          <span className="text-xl font-medium text-white">Polaris</span>
        </Link>
        <SignupForm />
      </div>
    </div>
  )
}

