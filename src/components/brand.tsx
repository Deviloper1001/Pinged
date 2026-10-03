import { cn } from "@/lib/utils"

export function Logo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.svg"
      alt="pinged logo"
      className={cn("h-9 w-9", className)}
      aria-hidden="true"
    />
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <Logo />
      <span className="text-xl font-semibold tracking-tight">pinged</span>
    </span>
  )
}
