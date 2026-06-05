import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-[11px] border border-[var(--line)] bg-[var(--card)] px-3.5 py-3 text-sm text-[var(--ink)] transition-colors outline-none placeholder:text-[var(--muted)] focus-visible:border-[var(--secondary)] focus-visible:ring-3 focus-visible:ring-[rgba(22,138,173,.15)] disabled:cursor-not-allowed disabled:bg-[var(--paper-2)] disabled:opacity-70 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
