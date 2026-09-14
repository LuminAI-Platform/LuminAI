import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "../../stores/authStore";

const SANDBOX_ROLES = [
  {
    value: "admin",
    label: "Admin (PLATFORM_ADMIN)",
    roles: ["admin", "user", "PLATFORM_ADMIN"],
  },
  { value: "viewer", label: "Viewer (no admin)", roles: ["user"] },
] as const;

/**
 * Validates that a redirect path is a safe, same-origin relative path.
 * Rejects protocol-relative URLs (//evil.com), absolute URLs, and empty values.
 */
function getSafeRedirectPath(): string {
  const raw = sessionStorage.getItem("post_login_redirect");
  sessionStorage.removeItem("post_login_redirect");

  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/";
  }
  return raw;
}

export function SandboxLoginPage() {
  const { loginMock, isLoading, error } = useAuthStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@luminai.dev");
  const [name, setName] = useState("Admin User");
  const [selectedRole, setSelectedRole] = useState<string>("admin");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const roleConfig =
        SANDBOX_ROLES.find((r) => r.value === selectedRole) ?? SANDBOX_ROLES[0];
      await loginMock(email, name, roleConfig.roles as unknown as string[]);
      const destination = getSafeRedirectPath();
      navigate({ to: destination as "/", replace: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-100">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl border border-amber-500/30 bg-zinc-900 p-6 shadow-2xl shadow-black/30"
      >
        <div className="mb-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">
            Development only
          </p>
          <h1 className="text-2xl font-semibold">Sandbox sign in</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            This route is available only in Vite development builds and does not
            contact Keycloak.
          </p>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-zinc-300">
              Name
            </span>
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm outline-none focus:border-amber-400"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-zinc-300">
              Email
            </span>
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm outline-none focus:border-amber-400"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-zinc-300">
              Role preset
            </span>
            <select
              value={selectedRole}
              onChange={(event) => setSelectedRole(event.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm outline-none focus:border-amber-400"
            >
              {SANDBOX_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <span className="mt-1.5 block text-xs text-zinc-500">
              Choose a role to test different permission levels.
            </span>
          </label>
        </div>

        {error && <p className="mt-4 text-sm text-red-300">{error}</p>}

        <button
          type="submit"
          disabled={isLoading || isSubmitting}
          className="mt-6 w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Signing in..." : "Enter sandbox"}
        </button>
      </form>
    </main>
  );
}
