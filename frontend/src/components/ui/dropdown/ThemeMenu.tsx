import React from "react";
import { Sun, Moon, Monitor, Check } from "lucide-react";
import { useThemeStore } from "../../../stores/themeStore";
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "./DropdownMenu";
import { Tooltip } from "../Tooltip";

export interface ThemeMenuProps {
  className?: string;
}

export const ThemeMenu: React.FC<ThemeMenuProps> = ({ className = "" }) => {
  const { theme, resolvedTheme, setTheme } = useThemeStore();

  const getTriggerIcon = () => {
    if (theme === "system") {
      return <Monitor className="w-4 h-4 text-text" />;
    }
    if (theme === "light") {
      return <Sun className="w-4 h-4 text-warning" />;
    }
    return <Moon className="w-4 h-4 text-primary" />;
  };

  const getTriggerTooltip = () => {
    if (theme === "system") {
      return `Theme: System (${resolvedTheme === "dark" ? "Dark" : "Light"})`;
    }
    return `Theme: ${theme === "light" ? "Light" : "Dark"}`;
  };

  return (
    <DropdownMenuRoot>
      <Tooltip label={getTriggerTooltip()} side="bottom">
        <DropdownMenuTrigger
          asChild
          className={className}
          aria-label={getTriggerTooltip()}
        >
          <button
            type="button"
            className="p-2 text-text-secondary hover:bg-surface-subtle hover:text-text rounded-lg flex items-center justify-center transition-colors cursor-pointer border border-transparent hover:border-border h-9 w-9"
          >
            {getTriggerIcon()}
          </button>
        </DropdownMenuTrigger>
      </Tooltip>

      <DropdownMenuContent align="end" side="bottom" className="w-48">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>

        <DropdownMenuItem
          icon={<Sun className="w-4 h-4 text-warning" />}
          selected={theme === "light"}
          rightSlot={
            theme === "light" ? (
              <Check className="w-4 h-4 text-primary" />
            ) : undefined
          }
          onClick={() => setTheme("light")}
        >
          Light
        </DropdownMenuItem>

        <DropdownMenuItem
          icon={<Moon className="w-4 h-4 text-primary" />}
          selected={theme === "dark"}
          rightSlot={
            theme === "dark" ? (
              <Check className="w-4 h-4 text-primary" />
            ) : undefined
          }
          onClick={() => setTheme("dark")}
        >
          Dark
        </DropdownMenuItem>

        <DropdownMenuItem
          icon={<Monitor className="w-4 h-4 text-text-secondary" />}
          selected={theme === "system"}
          rightSlot={
            theme === "system" ? (
              <Check className="w-4 h-4 text-primary" />
            ) : undefined
          }
          onClick={() => setTheme("system")}
        >
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuRoot>
  );
};
