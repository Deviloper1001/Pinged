import { cn } from "@/lib/utils"

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={cn("h-9 w-9", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="pingedGrad" x1="0" y1="0" x2="40" y2="40">
          <stop offset="0%" stopColor="oklch(0.72 0.15 162)" />
          <stop offset="100%" stopColor="oklch(0.55 0.13 180)" />
        </linearGradient>
      </defs>
      <path
        d="M8 6h24a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H18l-8 6v-6H8a4 4 0 0 1-4-4V10a4 4 0 0 1 4-4Z"
        fill="url(#pingedGrad)"
      />
      <circle cx="13.5" cy="17" r="2.4" fill="white" />
      <circle cx="20" cy="17" r="2.4" fill="white" />
      <circle cx="26.5" cy="17" r="2.4" fill="white" />
      <circle cx="31" cy="9" r="3.2" fill="oklch(0.62 0.22 25)" stroke="white" strokeWidth="1.5" />
    </svg>
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
