"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PERSONALIZATION_VARIABLES } from "@/lib/personalization";

type PersonalizeMenuProps = {
  onInsert: (token: string) => void;
  label?: string;
};

export function PersonalizeMenu({ onInsert, label = "Personalize" }: PersonalizeMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          <Sparkles />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Replaced with each contact&apos;s details when sent
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {PERSONALIZATION_VARIABLES.map((variable) => (
          <DropdownMenuItem key={variable.token} onSelect={() => onInsert(variable.token)}>
            {variable.label}
            <span className="ml-auto font-mono text-xs text-muted-foreground">{variable.token}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
