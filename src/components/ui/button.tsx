import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[11px] border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-all duration-200 ease-out outline-none select-none focus-visible:border-[var(--secondary)] focus-visible:ring-3 focus-visible:ring-[rgba(22,138,173,.15)] active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-linear-to-b from-[var(--primary)] to-[var(--primary-deep)] text-primary-foreground shadow-[0_12px_24px_-16px_rgba(30,96,145,.85)] hover:-translate-y-px hover:shadow-[0_16px_30px_-18px_rgba(30,96,145,.95)]",
        outline:
          "border-[var(--line)] bg-transparent text-[var(--ink-soft)] hover:border-[var(--line-strong)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)] aria-expanded:bg-[var(--paper-2)] aria-expanded:text-[var(--ink)]",
        secondary:
          "border-[var(--line)] bg-[var(--paper-2)] text-[var(--ink)] hover:border-[var(--line-strong)] hover:bg-[var(--card)]",
        ghost:
          "border-[var(--line)] bg-transparent text-[var(--ink-soft)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)] aria-expanded:bg-[var(--paper-2)] aria-expanded:text-[var(--ink)]",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-11 gap-2 px-[22px] has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 px-3 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2 px-6 has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        icon: "size-10",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
