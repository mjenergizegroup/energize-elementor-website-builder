import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-[11px] border border-[var(--line)] bg-[var(--card)] px-3.5 py-2 text-sm text-[var(--ink)] transition-colors outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-semibold file:text-[var(--ink)] placeholder:text-[var(--muted)] focus-visible:border-[var(--secondary)] focus-visible:ring-3 focus-visible:ring-[rgba(22,138,173,.15)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-[var(--paper-2)] disabled:opacity-70 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    />
  )
}

export { Input }
