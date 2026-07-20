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
          "flex h-11 w-full items-center justify-between gap-1.5 rounded-md bg-[var(--color-surface-raised)] py-2 pr-2 pl-3.5 text-sm font-medium text-[var(--color-text-primary)] whitespace-nowrap shadow-xs transition-[box-shadow] outline-none select-none focus-visible:ring-4 focus-visible:ring-[rgb(57_115_210_/_16%)] disabled:cursor-not-allowed disabled:opacity-50",
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
            className="relative isolate z-50 flex max-h-[min(theme(spacing.80),var(--available-height))] w-(--anchor-width) min-w-36 origin-(--transform-origin) flex-col overflow-hidden rounded-md bg-popover text-popover-foreground shadow-md duration-100"
          >
            <div className="flex items-center gap-2 bg-[var(--color-surface)] px-3">
              <SearchIcon className="size-4 shrink-0 text-[var(--color-text-faint)]" />
              <ComboboxPrimitive.Input
                placeholder={searchPlaceholder}
                className="h-10 w-full bg-transparent text-sm font-medium text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-faint)]"
              />
            </div>
            <ComboboxPrimitive.Empty className="px-3 py-3 text-sm text-[var(--color-text-secondary)] empty:hidden">
              {emptyMessage}
            </ComboboxPrimitive.Empty>
            <ComboboxPrimitive.List className="overflow-y-auto p-1">
              {(item: string) => (
                <ComboboxPrimitive.Item
                  key={item}
                  value={item}
                  className="relative flex w-full cursor-default items-center gap-1.5 rounded-sm py-2 pr-8 pl-2 text-sm outline-hidden select-none data-highlighted:bg-[var(--color-primary-tint)] data-highlighted:text-[var(--color-primary-hover)]"
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
