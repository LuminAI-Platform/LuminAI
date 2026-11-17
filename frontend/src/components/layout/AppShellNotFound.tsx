import React from "react";
import { Link } from "@tanstack/react-router";
import { Compass, Home } from "lucide-react";
import { Button } from "../ui/Button";

export const AppShellNotFound: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] py-16 px-6 text-center select-none">
      <div className="w-14 h-14 rounded-2xl bg-surface border border-border flex items-center justify-center text-text-secondary mb-4 shadow-xs">
        <Compass className="w-7 h-7" />
      </div>

      <span className="text-[11px] font-semibold text-text-secondary bg-surface-subtle border border-border px-2.5 py-1 rounded-full mb-3 uppercase tracking-wider">
        404 — Not Found
      </span>

      <h1 className="text-2xl sm:text-3xl font-bold text-text tracking-tight mb-2">
        Page Not Found
      </h1>

      <p className="text-sm text-text-secondary max-w-md mb-6 leading-relaxed">
        The page you are looking for does not exist or may have been moved.
      </p>

      <Link to="/">
        <Button
          variant="primary"
          size="md"
          leftIcon={<Home className="w-4 h-4" />}
        >
          Back to Dashboard
        </Button>
      </Link>
    </div>
  );
};
