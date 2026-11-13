import React, { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "../../stores/authStore";
import { Shield, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import dashboardImg from "../../assets/How Data Science Connects the Dots.jpg";
import logoImg from "../../assets/luminai-logo.svg";

export const LoginPage: React.FC = () => {
  const { login, checkUser, isLoading, error } = useAuthStore();
  const navigate = useNavigate();
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const intended = sessionStorage.getItem("post_login_redirect");
    checkUser().then((user) => {
      if (user) {
        const dest = intended ?? "/";
        sessionStorage.removeItem("post_login_redirect");
        navigate({ to: dest as "/", replace: true });
      }
    });
  }, [checkUser, navigate]);

  const handleLogin = async () => {
    setIsConnecting(true);
    try {
      await login();
    } catch {
      setIsConnecting(false);
    }
  };

  const busy = isConnecting || isLoading;

  return (
    <div className="min-h-screen w-screen flex items-stretch bg-page font-sans select-none">
      {/* ── Left panel — sign-in hero ────────────────────────────────────── */}
      <div className="w-full lg:w-[42%] flex flex-col min-h-screen">
        {/* Top spacer — pushes content to true vertical center */}
        <div className="flex-1" />

        {/* Form group — vertically centered */}
        <div className="px-8 sm:px-12 lg:px-16">
          {/* LuminAI Logo */}
          <div className="mb-10">
            <img
              src={logoImg}
              alt="LuminAI"
              className="h-8 w-auto select-none"
              draggable={false}
            />
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-text">
              Sign in to your workspace
            </h1>
            <p className="mt-2 text-sm text-text-secondary leading-relaxed">
              Use your company account to continue.
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-border mb-8" />

          {/* Error banner */}
          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-error-border bg-error-bg px-3.5 py-3 text-sm text-error">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
              <span>{error}</span>
            </div>
          )}

          {/* CTA — user-facing copy, no internal tooling names */}
          <button
            onClick={handleLogin}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-text transition-colors hover:bg-primary-hover disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                Signing in…
              </>
            ) : (
              <>
                <Shield className="h-4 w-4" />
                Continue with company account
                <ArrowRight className="h-4 w-4 ml-auto" />
              </>
            )}
          </button>

          {/* Support link — useful for the user, replaces the developer OIDC note */}
          <p className="mt-5 text-xs text-text-secondary text-center">
            Trouble signing in?{" "}
            <a
              href="mailto:it-support@luminai.dev"
              className="text-text-secondary underline underline-offset-2 hover:text-text transition-colors"
            >
              Contact your administrator
            </a>
          </p>
        </div>

        {/* Bottom spacer — mirrors top, keeps content centered */}
        <div className="flex-1" />

        {/* Footer — LuminAI only, no version, meets contrast on both themes */}
        <div className="px-8 sm:px-12 lg:px-16 py-6 border-t border-border">
          <span className="text-xs text-text-secondary">
            © {new Date().getFullYear()} LuminAI Enterprise
          </span>
        </div>
      </div>

      {/* ── Right panel — static product image, no overlay ───────────────── */}
      <div className="hidden lg:block flex-1 relative overflow-hidden border-l border-border">
        <img
          src={dashboardImg}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-left-top"
          draggable={false}
        />
      </div>
    </div>
  );
};
