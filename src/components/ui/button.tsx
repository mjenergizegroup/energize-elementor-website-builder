import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border bg-clip-padding text-sm font-semibold leading-none whitespace-nowrap shadow-xs transition-[background-color,border-color,color,box-shadow,transform] duration-150 outline-none select-none focus-visible:border-[var(--color-primary)] focus-visible:ring-4 focus-visible:ring-[rgb(57_115_210_/_12%)] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:border-[var(--color-primary-hover)] hover:bg-[var(--color-primary-hover)] active:translate-y-px",
        outline:
          "border-[var(--color-border-default)] bg-[var(--color-surface-raised)] text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface)] aria-expanded:bg-[var(--color-surface)]",
        secondary:
          "border-[var(--color-border-default)] bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-raised)]",
        ghost:
          "border-transparent bg-transparent text-[var(--color-text-secondary)] shadow-none hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)] aria-expanded:bg-[var(--color-surface)]",
        destructive:
          "border-[var(--color-danger-tint)] bg-[var(--color-danger-tint)] text-[var(--color-danger)] shadow-none hover:border-[var(--color-danger)]",
        link: "border-transparent bg-transparent px-0 text-[var(--color-primary-hover)] shadow-none underline-offset-4 hover:text-[var(--color-primary)] hover:underline",
      },
      size: {
        default:
          "h-11 gap-2 px-6 has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        xs: "h-7 gap-1 px-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 px-4 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2 px-7 has-data-[icon=inline-end]:pr-6 has-data-[icon=inline-start]:pl-6",
        icon: "size-10",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7",
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
