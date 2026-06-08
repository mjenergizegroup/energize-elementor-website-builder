import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden border-2 px-[9px] py-[3px] text-[10px] font-bold uppercase leading-none tracking-[0.12em] whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-red)] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "border-[var(--color-black)] bg-[var(--color-black)] text-[var(--color-on-black)]",
        secondary:
          "border-[var(--color-red)] bg-[var(--color-red)] text-[var(--color-on-red)]",
        destructive:
          "border-[var(--color-red)] bg-[var(--color-surface)] text-[var(--color-red)]",
        outline: "border-[var(--color-black)] bg-[var(--color-surface)] text-[var(--color-black)]",
        ghost: "border-transparent bg-transparent text-[var(--color-black)]",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
