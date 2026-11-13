import React, { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "../../stores/authStore";

export const CallbackPage: React.FC = () => {
  const { handleCallback, error, clearError } = useAuthStore();
  const navigate = useNavigate();
  const hasTriggered = useRef(false);

  useEffect(() => {
    // Prevent double execution in React StrictMode
    if (hasTriggered.current) return;
    hasTriggered.current = true;

    const processCallback = async () => {
      try {
        await handleCallback();
        const savedRedirect = sessionStorage.getItem("post_login_redirect");
        if (
          savedRedirect &&
          savedRedirect !== "/login" &&
          savedRedirect.startsWith("/")
        ) {
          sessionStorage.removeItem("post_login_redirect");
          navigate({ to: savedRedirect, replace: true });
        } else {
          navigate({ to: "/", replace: true });
        }
      } catch (err) {
        console.error("Authentication callback error:", err);
      }
    };

    processCallback();
  }, [handleCallback, navigate]);

  const handleRetry = () => {
    clearError();
    navigate({ to: "/login", replace: true });
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-page text-text font-sans relative overflow-hidden">
      <div className="flex flex-col items-center gap-6 relative z-10 max-w-md text-center px-6">
        {error ? (
          <div className="space-y-6">
            <div className="w-16 h-16 bg-error-bg border border-error-border text-error rounded-full flex items-center justify-center mx-auto">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold tracking-tight text-text">
                Authentication Failed
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                {error ||
                  "An error occurred while validating the security token. Please try again."}
              </p>
            </div>

            <button
              onClick={handleRetry}
              className="px-6 py-2.5 bg-surface hover:bg-surface-hover border border-border text-text text-xs font-semibold rounded-lg transition-all cursor-pointer"
            >
              Return to Login
            </button>
          </div>
        ) : (
          <>
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-2 border-border" />
              <div className="absolute inset-0 rounded-full border-2 border-t-text-secondary border-r-border animate-spin" />
              <div className="absolute inset-2 rounded-full border border-border bg-page flex items-center justify-center">
                <span className="w-2 h-2 rounded-full bg-text-secondary" />
              </div>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold tracking-wider uppercase text-text-secondary">
                Finalizing Session
              </h3>
              <p className="text-[11px] text-text-secondary">
                Exchanging authorization codes for cryptographic tokens...
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
