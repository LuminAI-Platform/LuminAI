import React, { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "../../stores/authStore";

// Animated Particle Mesh & Connected Node Lattice canvas background component
const ParticleMeshCanvas: React.FC = () => {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      color: string;
      alpha: number;
    }

    const particleCount = Math.min(Math.floor((width * height) / 14000), 90);
    const particles: Particle[] = [];
    const colors = [
      "#60a5fa",
      "#38bdf8",
      "#818cf8",
      "#34d399",
      "#93c5fd",
      "#c084fc",
    ];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        radius: Math.random() * 2.2 + 1.2,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: Math.random() * 0.4 + 0.6, // Bright, vivid particles
      });
    }

    // Interactive cursor lattice tracker
    const mouse = { x: -1000, y: -1000, radius: 200 };
    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    const handleMouseLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    const maxDistance = 150;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw particle nodes & connection lattice lines
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        // Draw particle node with radiant neon glow
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 14;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
        ctx.restore();

        // Connect node lattice lines
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxDistance) {
            const lineAlpha = (1 - dist / maxDistance) * 0.45;
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = "#38bdf8";
            ctx.shadowColor = "#3b82f6";
            ctx.shadowBlur = 8;
            ctx.globalAlpha = lineAlpha;
            ctx.lineWidth = 1.1;
            ctx.stroke();
            ctx.restore();
          }
        }

        // Interactive mouse node lattice connections with high glow
        const mdx = p.x - mouse.x;
        const mdy = p.y - mouse.y;
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mdist < mouse.radius) {
          const mAlpha = (1 - mdist / mouse.radius) * 0.7;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = "#60a5fa";
          ctx.shadowColor = "#60a5fa";
          ctx.shadowBlur = 12;
          ctx.globalAlpha = mAlpha;
          ctx.lineWidth = 1.4;
          ctx.stroke();
          ctx.restore();
        }
      }

      ctx.globalAlpha = 1.0;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 opacity-90"
    />
  );
};

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
    <div className="min-h-screen h-screen w-screen bg-[#07090e] text-zinc-100 font-sans relative overflow-y-auto overflow-x-hidden flex flex-col p-6 md:p-10 select-none">
      {/* Animated Particle Mesh & Connected Node Lattice Background */}
      <ParticleMeshCanvas />

      {/* Background Subtle Ambient Glows */}
      <div className="fixed top-[-20%] left-[-10%] w-[700px] h-[700px] bg-blue-600/10 rounded-full blur-[150px] pointer-events-none z-0" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[700px] h-[700px] bg-indigo-600/10 rounded-full blur-[150px] pointer-events-none z-0" />

      {/* Main Container */}
      <div className="w-full max-w-[1240px] mx-auto my-auto py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10 items-stretch">
        {/* Left Column: Visual branding and system details */}
        <div className="lg:col-span-7 bg-[#0c0f1d]/90 border border-zinc-800/80 rounded-2xl p-7 lg:p-9 flex flex-col justify-between gap-8 backdrop-blur-md shadow-2xl shadow-black/80 relative overflow-hidden">
          {/* Top Blue Glowing Border Line */}
          <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-blue-600/10 via-blue-500/90 to-blue-600/10 pointer-events-none" />

          {/* Header Block */}
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25 shrink-0">
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
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                </svg>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold tracking-tight text-white leading-none">
                    Lumin
                    <span className=" text-blue-400 text-xl font-bold  rounded-md uppercase tracking-wider">
                      AI
                    </span>
                  </span>
                </div>
                <span className="text-[10px] font-mono tracking-widest text-zinc-400 uppercase mt-1 font-medium">
                  ENTERPRISE DATA OPERATING SYSTEM
                </span>
              </div>
            </div>

            <div className="space-y-3 mt-2">
              <h1 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-[1.15]">
                The Unified Semantic
                <br />
                Data Environment
              </h1>
              <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed max-w-xl">
                Connect raw pipelines, define enterprise-wide semantic models,
                map ontology schemas, and deploy production-grade agent
                endpoints.
              </p>
            </div>
          </div>

          {/* Metrics & Topology Section */}
          <div className="space-y-6">
            {/* Stat cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#111525]/80 border border-zinc-800/80 rounded-xl p-3.5 flex flex-col justify-between min-h-[90px]">
                <span className="text-zinc-400 text-[10px] font-mono uppercase tracking-wider font-semibold">
                  DEPLOYMENTS
                </span>
                <div className="mt-1">
                  <span className="text-lg font-bold text-white">1.2k+</span>
                  <span className="text-zinc-400 text-xs font-normal ml-0.5">
                    /day
                  </span>
                </div>
                <div className="flex items-end gap-1 h-3 mt-2">
                  <div className="w-2.5 h-1.5 bg-blue-600/40 rounded-xs"></div>
                  <div className="w-2.5 h-2.5 bg-blue-500/60 rounded-xs"></div>
                  <div className="w-2.5 h-2 bg-blue-500/80 rounded-xs"></div>
                  <div className="w-2.5 h-3 bg-blue-500 rounded-xs"></div>
                  <div className="w-2.5 h-3.5 bg-blue-400 rounded-xs"></div>
                </div>
              </div>

              <div className="bg-[#111525]/80 border border-zinc-800/80 rounded-xl p-3.5 flex flex-col justify-between min-h-[90px]">
                <span className="text-zinc-400 text-[10px] font-mono uppercase tracking-wider font-semibold">
                  INGESTION
                </span>
                <div className="mt-1">
                  <span className="text-lg font-bold text-white">2.4</span>
                  <span className="text-blue-400 text-sm font-bold ml-1">
                    PB
                  </span>
                </div>
                <div className="flex items-center gap-1.5 h-3 mt-2">
                  <div className="w-3.5 h-3 bg-indigo-600/80 rounded-xs"></div>
                  <div className="w-3.5 h-3 bg-indigo-500/80 rounded-xs"></div>
                  <div className="w-3.5 h-3 bg-indigo-400/90 rounded-xs"></div>
                </div>
              </div>

              <div className="bg-[#111525]/80 border border-zinc-800/80 rounded-xl p-3.5 flex flex-col justify-between min-h-[90px]">
                <span className="text-zinc-400 text-[10px] font-mono uppercase tracking-wider font-semibold">
                  SYNC LATENCY
                </span>
                <div className="mt-1">
                  <span className="text-lg font-bold text-emerald-400">14</span>
                  <span className="text-emerald-400 text-xs font-bold ml-1">
                    ms
                  </span>
                </div>
                <div className="flex items-center gap-1.5 h-3 mt-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]"></span>
                  <span className="text-emerald-400 text-[10px] font-mono font-medium">
                    Sub-quantum SLA
                  </span>
                </div>
              </div>
            </div>

            {/* Topology Widget */}
            <div className="bg-[#111525]/50 border border-zinc-800/80 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <div className="flex items-center gap-2 text-zinc-400 tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  <span>ACTIVE SCHEMA TOPOLOGY</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span>99.99% Fabric Health</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { name: "Snowflake" },
                  { name: "Kafka Bus" },
                  { name: "PostgreSQL" },
                  { name: "AWS S3" },
                ].map((item) => (
                  <div
                    key={item.name}
                    className="bg-[#090b14] border border-zinc-800/80 rounded-lg px-3 py-2 flex items-center justify-between text-xs text-zinc-300 font-medium"
                  >
                    <span>{item.name}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]"></span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Left Footer Bar */}
          <div className="border-t border-zinc-800/60 pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-zinc-400 font-mono gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"></span>
              <span>
                Global Cluster:{" "}
                <span className="text-zinc-300">us-east-prod-1</span>
              </span>
            </div>
            <span className="text-zinc-400">Encrypted Key Broker Active</span>
          </div>
        </div>

        {/* Right Column: Keycloak SSO Card */}
        <div className="lg:col-span-5 bg-[#0c0f1d]/90 border border-zinc-800/80 rounded-2xl p-7 lg:p-9 flex flex-col justify-between backdrop-blur-md shadow-2xl shadow-black/80 min-h-[460px] relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-blue-600/10 via-blue-500/90 to-blue-600/10 pointer-events-none" />

          {/* Top Lock Badge */}
          <div>
            <div className="bg-[#13192a] border border-zinc-700/60 rounded-full px-3 py-1 text-xs text-zinc-300 inline-flex items-center gap-2 font-medium">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Zero Trust Auth Gateway
            </div>

            <div className="mt-5 space-y-2">
              <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-white">
                Secure Client Access
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Single Sign-On gateway for enterprise tenants and authenticated
                engineers.
              </p>
            </div>
          </div>

          {/* Action Area */}
          <div className="my-auto py-8">
            {error && (
              <div className="mb-4 p-3.5 bg-red-950/30 border border-red-500/20 text-red-400 rounded-xl text-xs flex gap-2.5 items-start">
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

            <button
              onClick={handleLogin}
              disabled={isLoading || isConnecting}
              className="w-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold text-sm py-3.5 px-5 rounded-xl flex items-center justify-center gap-2.5 transition-all duration-200 active:scale-[0.99] cursor-pointer shadow-lg shadow-blue-600/30 disabled:opacity-50 disabled:pointer-events-none"
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
              className="mt-3 w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-750 font-semibold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2.5 transition-all duration-200 active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Bypass with Sandbox Credentials
            </button>
            */}
          </div>

          {/* Card Footer Badges */}
          <div className="text-[11px] text-zinc-500 font-mono text-center tracking-wide pt-4">
            • 256-bit TLS Encryption • Multi-Tenant Isolation • SOC2 Type II
          </div>
        </div>
      </div>

      {/* Bottom Footer Links */}
      <div className="w-full max-w-[1240px] mx-auto mt-4 pt-2 pb-4 flex items-center gap-6 text-xs text-zinc-600 font-mono">
        <a href="#" className="hover:text-zinc-400 transition-colors">
          Security Policy
        </a>
        <a href="#" className="hover:text-zinc-400 transition-colors">
          System Status
        </a>
        <a href="#" className="hover:text-zinc-400 transition-colors">
          Agent API Reference
        </a>
      </div>
    </div>
  );
};
