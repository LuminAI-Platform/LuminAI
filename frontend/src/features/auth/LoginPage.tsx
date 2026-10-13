import React, { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "../../stores/authStore";
import { Database, Network, Cpu, Share2, Shield, ArrowRight, Loader2, AlertCircle } from "lucide-react";

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

    const particleCount = Math.min(Math.floor((width * height) / 16000), 75);
    const particles: Particle[] = [];
    const colors = ["#60a5fa", "#818cf8", "#34d399", "#a1a1aa"];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 1.8 + 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: Math.random() * 0.4 + 0.3,
      });
    }

    const mouse = { x: -1000, y: -1000, radius: 180 };
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

    const maxDistance = 140;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6; // Reduced intense glare
        ctx.globalAlpha = p.alpha;
        ctx.fill();
        ctx.restore();

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxDistance) {
            const lineAlpha = (1 - dist / maxDistance) * 0.25;
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = "#3b82f6";
            ctx.globalAlpha = lineAlpha;
            ctx.lineWidth = 0.9;
            ctx.stroke();
            ctx.restore();
          }
        }

        const mdx = p.x - mouse.x;
        const mdy = p.y - mouse.y;
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mdist < mouse.radius) {
          const mAlpha = (1 - mdist / mouse.radius) * 0.4;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = "#60a5fa";
          ctx.globalAlpha = mAlpha;
          ctx.lineWidth = 1.1;
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
      className="fixed inset-0 pointer-events-none z-0 opacity-60"
    />
  );
};

export const LoginPage: React.FC = () => {
  const { login, checkUser, isLoading, error } = useAuthStore();
  const navigate = useNavigate();

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

  const [isConnecting, setIsConnecting] = useState(false);

  const handleLogin = async () => {
    setIsConnecting(true);
    try {
      await login();
    } catch {
      setIsConnecting(false);
    }
  };

  return (
    <div className="min-h-screen h-screen w-screen bg-[#07080b] text-zinc-100 font-sans relative overflow-y-auto overflow-x-hidden flex flex-col p-6 md:p-10 select-none">
      <ParticleMeshCanvas />

      {/* Controlled, subtle ambient background lights instead of blinding neon */}
      <div className="fixed top-[-10%] left-[20%] w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="fixed bottom-[-10%] right-[20%] w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[120px] pointer-events-none z-0" />

      {/* Main Container */}
      <div className="w-full max-w-[1240px] mx-auto my-auto py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10 items-stretch">

        {/* Left Column: Visual branding and system details */}
        <div className="lg:col-span-7 bg-[#0b0d14]/90 border border-zinc-800/80 rounded-xl p-7 lg:p-9 flex flex-col justify-between gap-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">

          {/* Top Thin Accent Line */}
          <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-blue-500/10 via-blue-400/70 to-blue-500/10 pointer-events-none" />

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
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="text-lg font-semibold tracking-tight text-white">
                    Lumin
                  </span>
                  <span className="text-blue-400 text-lg font-semibold tracking-tight">
                    AI
                  </span>
                </div>
                <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase mt-1">
                  ENTERPRISE DATA PLATFORM v2.4
                </span>
              </div>
            </div>

            <div className="space-y-3 mt-2">
              <h1 className="text-3xl lg:text-4xl font-semibold text-white tracking-tight leading-[1.15]">
                The Unified Data Platform
              </h1>
              <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed max-w-xl">
                Connect data sources, define unified schemas, explore entity relationships, and monitor automated pipelines.
              </p>
            </div>
          </div>

          {/* Platform Capabilities Overview */}
          <div className="space-y-3">
            <div className="bg-[#10131f]/60 border border-zinc-800/80 rounded-lg p-3.5 flex items-start gap-3.5">
              <div className="w-7 h-7 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-medium text-zinc-200">
                  Data Ingestion & Connectors
                </h2>
                <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                  Ingest structured tabular files (CSV, JSON) and connect relational databases into staged raw storage.
                </p>
              </div>
            </div>

            <div className="bg-[#10131f]/60 border border-zinc-800/80 rounded-lg p-3.5 flex items-start gap-3.5">
              <div className="w-7 h-7 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                <Network className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-medium text-zinc-200">
                  Schema Studio & Ontology Models
                </h2>
                <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                  Map raw columns to typed ontology properties and configure validation rules visually.
                </p>
              </div>
            </div>

            <div className="bg-[#10131f]/60 border border-zinc-800/80 rounded-lg p-3.5 flex items-start gap-3.5">
              <div className="w-7 h-7 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-medium text-zinc-200">
                  Entity Resolution & Golden Records
                </h2>
                <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                  Identify duplicate records, resolve attribute conflicts, and maintain canonical golden records with provenance.
                </p>
              </div>
            </div>

            <div className="bg-[#10131f]/60 border border-zinc-800/80 rounded-lg p-3.5 flex items-start gap-3.5">
              <div className="w-7 h-7 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                <Share2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-medium text-zinc-200">
                  Knowledge Graph & Search
                </h2>
                <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                  Perform multi-hop relationship traversals in Neo4j and full-text faceted entity search in OpenSearch.
                </p>
              </div>
            </div>
          </div>

          {/* Left Footer Bar */}
          <div className="border-t border-zinc-800/80 pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between text-[11px] text-zinc-500 font-mono gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Multi-Tenant Architecture</span>
            </div>
            <span>Keycloak OIDC Ready</span>
          </div>
        </div>

        {/* Right Column: Keycloak SSO Card */}
        <div className="lg:col-span-5 bg-[#0b0d14]/90 border border-zinc-800/80 rounded-xl p-7 lg:p-9 flex flex-col justify-between backdrop-blur-xl shadow-2xl min-h-[460px] relative overflow-hidden">

          {/* Top Thin Accent Line */}
          <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-blue-500/10 via-blue-400/70 to-blue-500/10 pointer-events-none" />

          {/* Top Badge */}
          <div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-md px-2.5 py-1 text-xs text-zinc-300 inline-flex items-center gap-2 font-mono">
              <Shield className="w-3.5 h-3.5 text-zinc-400" />
              Single Sign-On
            </div>

            <div className="mt-5 space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight text-white">
                Account Sign In
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Sign in with your enterprise account to access connections, pipelines, and entity graphs.
              </p>
            </div>
          </div>

          {/* Action Area */}
          <div className="my-auto py-8">
            {error && (
              <div className="mb-4 p-3 bg-red-950/40 border border-red-800/50 text-red-300 rounded-lg text-xs flex gap-2.5 items-start">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                <div className="flex-1 font-medium leading-normal">{error}</div>
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={isLoading || isConnecting}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs py-3 px-4 rounded-lg flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none shadow-md shadow-blue-600/20"
            >
              {isConnecting || isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  Connecting to Identity Provider...
                </>
              ) : (
                <>
                  <span>Sign In with Keycloak SSO</span>
                  <ArrowRight className="w-4 h-4 text-blue-200" />
                </>
              )}
            </button>
          </div>

          {/* Card Footer Badges */}
          <div className="text-[11px] text-zinc-500 font-mono text-center tracking-wide pt-4 border-t border-zinc-900">
            Protected by OpenID Connect (OIDC) Single Sign-On
          </div>
        </div>
      </div>

      {/* Bottom Footer Notice */}
      <div className="w-full max-w-[1240px] mx-auto mt-4 pt-2 pb-4 flex items-center justify-between text-[11px] text-zinc-600 font-mono">
        <span>LuminAI Enterprise Data Platform</span>
        <span>Version 1.0.0</span>
      </div>
    </div>
  );
};