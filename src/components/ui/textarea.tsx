import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full border-2 border-[var(--color-black)] bg-[var(--color-surface)] px-3.5 py-3 text-[13px] text-[var(--color-black)] transition-colors outline-none placeholder:text-[var(--color-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-red)] disabled:cursor-not-allowed disabled:bg-[var(--color-panel)] disabled:opacity-70 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
