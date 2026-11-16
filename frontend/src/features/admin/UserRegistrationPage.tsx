import { useState, type FormEvent } from "react";
import { ApiError, apiFetch } from "../../lib/api";

interface CreateUserResponse {
  userId: string;
  tenantId: string;
  tenantSlug: string;
  keycloakId: string;
  email: string;
  role: string;
  message: string;
}

const inputClassName =
  "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none transition-colors placeholder:text-text-secondary focus:border-border-focus";

async function getApiErrorMessage(error: unknown): Promise<string> {
  if (error instanceof ApiError) {
    if (error.isForbidden) {
      return "You do not have permission to provision users.";
    }
    if (error.status === 502) {
      return "Could not reach Keycloak to create the account. Try again shortly, or contact engineering if this persists.";
    }

    let body: { message?: string; detail?: string } = {};
    try {
      body = (await error.response.clone().json()) as typeof body;
    } catch {
      // Some gateway errors do not return JSON.
    }

    if (error.status === 400) {
      return (
        body.message ??
        body.detail ??
        "Please check the tenant slug, email, and role."
      );
    }
    if (error.status === 409) {
      return "That email is already registered for this tenant.";
    }
    if (error.status === 404) {
      return "No active tenant was found with that slug.";
    }
    if (body.message || body.detail) {
      return body.message ?? body.detail ?? "Request failed.";
    }
  }

  return "Unable to create the user. Check the details and try again.";
}

export function UserRegistrationPage() {
  const [tenantSlug, setTenantSlug] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("VIEWER");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await apiFetch("/api/v1/internal/users", {
        method: "POST",
        body: JSON.stringify({
          tenantSlug: tenantSlug.trim(),
          email: email.trim(),
          fullName: fullName.trim() || null,
          role,
        }),
      });
      const result = (await response.json()) as CreateUserResponse;
      setSuccessMessage(result.message);
      setTenantSlug("");
      setEmail("");
      setFullName("");
      setRole("VIEWER");
    } catch (requestError) {
      setError(await getApiErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Platform administration
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-text">
          Register a platform user
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
          Provision a user for an existing tenant. Keycloak will email them a
          secure link to set their password.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-border bg-surface p-6"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-2 block text-xs font-semibold text-text">
                Tenant slug <span className="text-primary">*</span>
              </span>
              <input
                required
                pattern="[a-z0-9][a-z0-9_-]*[a-z0-9]"
                value={tenantSlug}
                onChange={(event) => setTenantSlug(event.target.value)}
                placeholder="acme-corp or acme_corp"
                className={inputClassName}
              />
              <span className="mt-1.5 block text-xs text-text-secondary">
                Use the existing tenant&apos;s lowercase slug.
              </span>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-text">
                Full name
              </span>
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Alex Morgan"
                className={inputClassName}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-text">
                Email address <span className="text-primary">*</span>
              </span>
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="alex@acme.com"
                className={inputClassName}
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-2 block text-xs font-semibold text-text">
                Platform role
              </span>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className={inputClassName}
              >
                <option value="VIEWER">Viewer</option>
                <option value="ADMIN">Admin</option>
              </select>
            </label>
          </div>

          {error && (
            <div className="mt-5 rounded-lg border border-error-border bg-error-bg px-4 py-3 text-sm text-error">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="mt-5 rounded-lg border border-success-border bg-success-bg px-4 py-3 text-sm text-success">
              {successMessage}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-text transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Provisioning..." : "Create user"}
            </button>
          </div>
        </form>

        <aside className="h-fit rounded-lg border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold text-text">What happens next</h2>
          <p className="mt-2 text-xs leading-5 text-text-secondary">
            The account is linked to the selected tenant and Keycloak sends a
            password setup email. No password is handled by this form.
          </p>
        </aside>
      </div>
    </div>
  );
}
