import Link from "next/link"
import { Button } from "@/components/ui/button"
import Image from "next/image"

export default function HomePage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-12 bg-[#0f1420] p-6 md:p-10">
      <div className="flex w-full max-w-md flex-col items-center gap-12 text-center">
        <div className="flex flex-col items-center gap-2">
          <Image
            src="/logo2.png"
            alt="Polaris Logo"
            width={100}
            height={100}
          />
          <span className="text-2xl font-medium text-white">Polaris</span>
        </div>

        <div className="space-y-4">
          <h1 className="text-5xl font-bold tracking-tight text-white">Navigate with AI</h1>
          <p className="text-xl text-gray-300">Your LLM-powered navigation platform</p>
        </div>

        <div className="flex gap-4">
          <Button asChild className="bg-[#5b46f4] hover:bg-[#4a38d5] text-white px-10 py-6 text-lg rounded-md">
            <Link href="/login">Login</Link>
          </Button>
          <Button
            variant="outline"
            asChild
            className="border-[#5b46f4] text-[#5b46f4] hover:bg-[#1a1e2e] px-10 py-6 text-lg rounded-md"
          >
            <Link href="/signup">Sign up</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

