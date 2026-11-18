import React from "react";
import { useThemeStore } from "../../../stores/themeStore";
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "./DropdownMenu";
import { Tooltip } from "../Tooltip";
import { Sun, Moon, Monitor, Check, ICON_SIZES } from "../../../lib/icons";

export interface ThemeMenuProps {
  className?: string;
}

export const ThemeMenu: React.FC<ThemeMenuProps> = ({ className = "" }) => {
  const { theme, setTheme } = useThemeStore();

  const getTriggerIcon = () => {
    if (theme === "system") {
      return (
        <Monitor
          size={ICON_SIZES.header}
          className="text-text"
          aria-hidden="true"
        />
      );
    }
    if (theme === "light") {
      return (
        <Sun
          size={ICON_SIZES.header}
          className="text-warning"
          aria-hidden="true"
        />
      );
    }
    return (
      <Moon
        size={ICON_SIZES.header}
        className="text-primary"
        aria-hidden="true"
      />
    );
  };

  const getTriggerTooltip = () => {
    if (theme === "system") {
      return "Theme: System";
    }
    if (theme === "light") {
      return "Theme: Light";
    }
    return "Theme: Dark";
  };

  const label = getTriggerTooltip();

  return (
    <DropdownMenuRoot>
      <Tooltip label={label} side="bottom">
        <DropdownMenuTrigger asChild className={className} aria-label={label}>
          <button
            type="button"
            aria-label={label}
            className="p-2 text-text-secondary hover:bg-surface-subtle hover:text-text rounded-lg flex items-center justify-center transition-colors cursor-pointer border border-transparent hover:border-border h-9 w-9"
          >
            {getTriggerIcon()}
          </button>
        </DropdownMenuTrigger>
      </Tooltip>

      <DropdownMenuContent align="end" side="bottom" className="w-48">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>

        <DropdownMenuItem
          icon={
            <Sun
              size={ICON_SIZES.dropdown}
              className="text-warning"
              aria-hidden="true"
            />
          }
          selected={theme === "light"}
          rightSlot={
            theme === "light" ? (
              <Check
                size={ICON_SIZES.dropdown}
                className="text-primary"
                aria-hidden="true"
              />
            ) : undefined
          }
          onClick={() => setTheme("light")}
        >
          Light
        </DropdownMenuItem>

        <DropdownMenuItem
          icon={
            <Moon
              size={ICON_SIZES.dropdown}
              className="text-primary"
              aria-hidden="true"
            />
          }
          selected={theme === "dark"}
          rightSlot={
            theme === "dark" ? (
              <Check
                size={ICON_SIZES.dropdown}
                className="text-primary"
                aria-hidden="true"
              />
            ) : undefined
          }
          onClick={() => setTheme("dark")}
        >
          Dark
        </DropdownMenuItem>

        <DropdownMenuItem
          icon={
            <Monitor
              size={ICON_SIZES.dropdown}
              className="text-text-secondary"
              aria-hidden="true"
            />
          }
          selected={theme === "system"}
          rightSlot={
            theme === "system" ? (
              <Check
                size={ICON_SIZES.dropdown}
                className="text-primary"
                aria-hidden="true"
              />
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
