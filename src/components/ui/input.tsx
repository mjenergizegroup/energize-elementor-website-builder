import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-md bg-[var(--color-surface-raised)] px-3.5 py-2 text-sm font-medium text-[var(--color-text-primary)] shadow-xs transition-[box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-semibold file:text-[var(--color-text-primary)] placeholder:text-[var(--color-text-faint)] focus-visible:ring-4 focus-visible:ring-[rgb(57_115_210_/_16%)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-[var(--color-surface)] disabled:opacity-70 aria-invalid:ring-2 aria-invalid:ring-[var(--color-danger)]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
