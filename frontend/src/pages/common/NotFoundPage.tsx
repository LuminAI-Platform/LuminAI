import React from "react";
import { Link } from "@tanstack/react-router";
import { Compass, Home, ArrowLeft } from "lucide-react";
import { Button } from "../../components/ui";

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-blue-500 mb-6 shadow-xl shadow-blue-500/5">
        <Compass className="w-8 h-8 animate-pulse" />
      </div>

      <span className="text-xs font-mono font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full mb-3">
        404 — PAGE NOT FOUND
      </span>

      <h1 className="text-3xl font-bold text-zinc-100 tracking-tight mb-2">
        Page Not Found
      </h1>

      <p className="text-sm text-zinc-400 max-w-md mb-8 leading-relaxed">
        The page you are looking for does not exist or may have been moved.
      </p>

      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          size="md"
          leftIcon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => window.history.back()}
        >
          Go Back
        </Button>

        <Link to="/">
          <Button
            variant="primary"
            size="md"
            leftIcon={<Home className="w-4 h-4" />}
          >
            Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
};
