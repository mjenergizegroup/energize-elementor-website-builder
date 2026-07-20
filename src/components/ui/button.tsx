import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md bg-clip-padding text-sm font-semibold leading-none whitespace-nowrap shadow-xs transition-[background-color,color,box-shadow,transform] duration-150 outline-none select-none focus-visible:ring-4 focus-visible:ring-[rgb(57_115_210_/_16%)] disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-2 aria-invalid:ring-[var(--color-danger)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)] active:translate-y-px",
        outline:
          "bg-[var(--color-surface-raised)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface)] aria-expanded:bg-[var(--color-surface)]",
        secondary:
          "bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-raised)]",
        ghost:
          "bg-transparent text-[var(--color-text-secondary)] shadow-none hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)] aria-expanded:bg-[var(--color-surface)]",
        destructive:
          "bg-[var(--color-danger-tint)] text-[var(--color-danger)] shadow-none hover:bg-[color-mix(in_srgb,var(--color-danger-tint)_82%,var(--color-danger))]",
        link: "bg-transparent px-0 text-[var(--color-primary-hover)] shadow-none underline-offset-4 hover:text-[var(--color-primary)] hover:underline",
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
