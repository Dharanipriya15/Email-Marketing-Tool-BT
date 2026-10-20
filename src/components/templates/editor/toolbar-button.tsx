"use client";

import { Button } from "@/components/ui/button";

type ToolbarButtonProps = Omit<React.ComponentProps<typeof Button>, "variant" | "size"> & {
  label: string;
  active?: boolean;
};

// Accepts (and forwards) arbitrary props so it can be used as a Radix
// `asChild` trigger for popovers and dropdowns.
export function ToolbarButton({ label, active, children, ...props }: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="icon-sm"
      aria-label={label}
      aria-pressed={active}
      title={label}
      {...props}
    >
      {children}
    </Button>
  );
}

// Popover content is portaled, but React still bubbles its submit events up
// to the surrounding template <form>. Stop them here so pressing Enter in a
// popover field never saves the whole template.
export function PopoverForm({
  onSubmit,
  children,
}: {
  onSubmit: () => void;
  children: React.ReactNode;
}) {
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onSubmit();
      }}
    >
      {children}
    </form>
  );
}
