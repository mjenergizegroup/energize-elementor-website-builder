import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center border-2 border-[var(--color-black)] bg-clip-padding text-[10px] font-bold uppercase leading-none tracking-[0.12em] whitespace-nowrap transition-colors duration-150 outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-red)] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--color-red)] text-[var(--color-on-red)] hover:bg-[var(--color-red-dark)]",
        outline:
          "bg-[var(--color-surface)] text-[var(--color-black)] hover:bg-[var(--color-panel)] aria-expanded:bg-[var(--color-panel)]",
        secondary:
          "bg-[var(--color-panel)] text-[var(--color-black)] hover:bg-[var(--color-surface)]",
        ghost:
          "bg-[var(--color-surface)] text-[var(--color-black)] hover:bg-[var(--color-panel)] aria-expanded:bg-[var(--color-panel)]",
        destructive:
          "bg-[var(--color-surface)] text-[var(--color-red)] hover:bg-[var(--color-red-light)]",
        link: "border-transparent bg-transparent px-0 text-[var(--color-red)] underline-offset-4 hover:underline",
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
