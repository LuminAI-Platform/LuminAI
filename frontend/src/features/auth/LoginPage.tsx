import React, { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "../../stores/authStore";

export const LoginPage: React.FC = () => {
  // const { login, loginMock, checkUser, isLoading, error } = useAuthStore(); // Uncomment loginMock for sandbox dev
  const { login, checkUser, isLoading, error } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    // Capture the path the user was trying to reach before being bounced to /login
    const intended = sessionStorage.getItem("post_login_redirect");
    checkUser().then((user) => {
      if (user) {
        const dest = intended ?? "/";
        sessionStorage.removeItem("post_login_redirect");
        navigate({ to: dest as "/", replace: true });
      }
    });
  }, [checkUser, navigate]);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleLogin = async () => {
    setIsConnecting(true);
    try {
      await login();
    } catch {
      setIsConnecting(false);
    }
  };

  /* [SANDBOX/DEV] Uncomment handleMockLogin to enable sandbox mock login without Keycloak
  const handleMockLogin = async () => {
    setIsConnecting(true);
    try {
      // @ts-expect-error loginMock optional in store
      await loginMock("admin@luminai.dev", "Admin User");
      const dest = sessionStorage.getItem("post_login_redirect") ?? "/";
      sessionStorage.removeItem("post_login_redirect");
      navigate({ to: dest as "/", replace: true });
    } catch {
      setIsConnecting(false);
    }
  };
  */

  return (
    <div className="flex min-h-screen w-screen bg-zinc-950 text-zinc-100 font-sans relative overflow-hidden items-center justify-center p-6">
      {/* Subtle dotted background grid */}
      <div className="absolute inset-0 bg-grid-dots opacity-40 pointer-events-none z-0" />

      {/* Decorative Blur Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[130px] pointer-events-none" />

      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-12 gap-8 items-center relative z-10">
        {/* Left Column: Visual branding and system details */}
        <div className="md:col-span-7 flex flex-col justify-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center font-bold shadow-lg shadow-blue-500/25">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-zinc-100 leading-none">
                LuminAI
              </span>
              <span className="text-[10px] font-bold text-blue-500 tracking-widest uppercase mt-0.5">
                Enterprise OS
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-linear-to-r from-zinc-100 via-zinc-200 to-zinc-400 tracking-tight leading-[1.1]">
              The Unified Semantic Data Environment
            </h1>
            <p className="text-zinc-400 text-sm md:text-base leading-relaxed max-w-xl">
              Connect raw pipelines, define enterprise-wide semantic models, map
              ontology schemas, and deploy production-grade agent endpoints.
            </p>
          </div>

          {/* Integration Stats cards */}
          <div className="grid grid-cols-3 gap-4 max-w-lg mt-2">
            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-4 flex flex-col gap-1 backdrop-blur-xs">
              <span className="text-zinc-500 text-[10px] font-mono uppercase tracking-wider">
                Deployments
              </span>
              <span className="text-lg font-bold text-zinc-200">
                1.2k+ / day
              </span>
            </div>
            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-4 flex flex-col gap-1 backdrop-blur-xs">
              <span className="text-zinc-500 text-[10px] font-mono uppercase tracking-wider">
                Data Ingestion
              </span>
              <span className="text-lg font-bold text-zinc-200">2.4 PB</span>
            </div>
            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-4 flex flex-col gap-1 backdrop-blur-xs">
              <span className="text-zinc-500 text-[10px] font-mono uppercase tracking-wider">
                Sync Latency
              </span>
              <span className="text-lg font-bold text-emerald-500">14 ms</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-zinc-500 text-xs">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse mr-1" />
            <span>Keycloak Authorization Server active: </span>
            <a
              href="http://localhost:8180"
              target="_blank"
              rel="noreferrer"
              className="text-blue-500 hover:underline"
            >
              localhost:8180
            </a>
          </div>
        </div>

        {/* Right Column: Interactive Login Container */}
        <div className="md:col-span-5 bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-8 backdrop-blur-md relative shadow-2xl shadow-black/50">
          <div className="flex flex-col gap-2 mb-8">
            <h2 className="text-xl font-bold tracking-tight text-zinc-100">
              Secure Client Access
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Use your enterprise Single Sign-On (SSO) credentials to
              authenticate with Keycloak.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-950/30 border border-red-500/20 text-red-400 rounded-xl text-xs flex gap-2.5 items-start">
              <svg
                className="shrink-0 mt-0.5"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div className="flex-1 font-medium leading-normal">{error}</div>
            </div>
          )}

          <div className="space-y-6">
            <button
              onClick={handleLogin}
              disabled={isLoading || isConnecting}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2.5 transition-all duration-200 active:scale-[0.98] cursor-pointer shadow-lg shadow-blue-500/15 disabled:opacity-50 disabled:pointer-events-none"
            >
              {isConnecting || isLoading ? (
                <>
                  <svg
                    className="animate-spin"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      className="opacity-25"
                    />
                    <path
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      className="opacity-75"
                    />
                  </svg>
                  Connecting to Identity Provider...
                </>
              ) : (
                <>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                  Sign In with Keycloak SSO
                </>
              )}
            </button>

            {/* [SANDBOX/DEV] Uncomment button below to enable sandbox mock login button
            <button
              onClick={handleMockLogin}
              disabled={isLoading || isConnecting}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-750 font-semibold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2.5 transition-all duration-200 active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Bypass with Sandbox Credentials
            </button>
            */}
          </div>
        </div>
      </div>
    </div>
  );
};
