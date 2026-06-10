"use client"

import * as React from "react"
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"

import { cn } from "@/lib/utils"
import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react"

// Select-style trigger that opens a popup with a search input and a filtered
// list. Built on the base-ui combobox (no asChild, matching our other ui
// components).
function Combobox({
  items,
  value,
  onValueChange,
  placeholder = "Select an option",
  searchPlaceholder = "Search...",
  emptyMessage = "No matches found.",
  className,
}: {
  items: string[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  className?: string
}) {
  return (
    <ComboboxPrimitive.Root
      items={items}
      value={value || null}
      onValueChange={(next) => {
        if (typeof next === "string" && next) onValueChange(next)
      }}
    >
      <ComboboxPrimitive.Trigger
        data-slot="combobox-trigger"
        className={cn(
          "flex h-11 w-full items-center justify-between gap-1.5 border-2 border-[var(--color-black)] bg-[var(--color-surface)] py-2 pr-2 pl-3.5 text-[13px] font-medium text-[var(--color-black)] whitespace-nowrap transition-colors outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-red)] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      >
        <span
          data-slot="combobox-value"
          className="line-clamp-1 flex flex-1 text-left"
        >
          <ComboboxPrimitive.Value placeholder={placeholder} />
        </span>
        <ComboboxPrimitive.Icon
          render={
            <ChevronDownIcon className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
          }
        />
      </ComboboxPrimitive.Trigger>
      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner
          side="bottom"
          sideOffset={4}
          align="center"
          className="isolate z-50"
        >
          <ComboboxPrimitive.Popup
            data-slot="combobox-content"
            className="relative isolate z-50 flex max-h-[min(theme(spacing.80),var(--available-height))] w-(--anchor-width) min-w-36 origin-(--transform-origin) flex-col overflow-hidden border-2 border-[var(--color-black)] bg-popover text-popover-foreground duration-100"
          >
            <div className="flex items-center gap-2 border-b border-[var(--color-black)] px-3">
              <SearchIcon className="size-4 shrink-0 text-[var(--color-muted)]" />
              <ComboboxPrimitive.Input
                placeholder={searchPlaceholder}
                className="h-10 w-full bg-transparent text-[13px] font-medium text-[var(--color-black)] outline-none placeholder:text-[var(--color-muted)]"
              />
            </div>
            <ComboboxPrimitive.Empty className="px-3 py-3 text-[13px] text-[var(--color-muted)] empty:hidden">
              {emptyMessage}
            </ComboboxPrimitive.Empty>
            <ComboboxPrimitive.List className="overflow-y-auto p-1">
              {(item: string) => (
                <ComboboxPrimitive.Item
                  key={item}
                  value={item}
                  className="relative flex w-full cursor-default items-center gap-1.5 py-2 pr-8 pl-2 text-[13px] outline-hidden select-none data-highlighted:bg-[var(--color-panel)] data-highlighted:text-[var(--color-black)]"
                >
                  <span className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
                    {item}
                  </span>
                  <ComboboxPrimitive.ItemIndicator
                    render={
                      <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />
                    }
                  >
                    <CheckIcon className="pointer-events-none size-4" />
                  </ComboboxPrimitive.ItemIndicator>
                </ComboboxPrimitive.Item>
              )}
            </ComboboxPrimitive.List>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  )
}

export { Combobox }
