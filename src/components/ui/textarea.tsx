import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-md bg-[var(--color-surface-raised)] px-3.5 py-3 text-sm text-[var(--color-text-primary)] shadow-xs transition-[box-shadow] outline-none placeholder:text-[var(--color-text-faint)] focus-visible:ring-4 focus-visible:ring-[rgb(57_115_210_/_16%)] disabled:cursor-not-allowed disabled:bg-[var(--color-surface)] disabled:opacity-70 aria-invalid:ring-2 aria-invalid:ring-[var(--color-danger)]",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
