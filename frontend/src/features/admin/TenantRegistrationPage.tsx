import { useState, type FormEvent } from "react";
import { ApiError, apiFetch } from "../../lib/api";

interface CreateTenantResponse {
  id: string;
  name: string;
  slug: string;
  schema: string;
  status: string;
}

const inputClassName =
  "w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

async function getApiErrorMessage(error: unknown): Promise<string> {
  if (error instanceof ApiError) {
    if (error.isForbidden) {
      return "You do not have permission to provision tenants.";
    }

    let body: { error?: string; message?: string; detail?: string } = {};
    try {
      body = (await error.response.clone().json()) as typeof body;
    } catch {
      // Some gateway errors do not return JSON.
    }

    if (error.status === 400) {
      return (
        body.error ?? body.message ?? body.detail ?? "Invalid request payload."
      );
    }
    if (error.status === 409) {
      return body.error ?? "A tenant with that slug already exists.";
    }
    if (body.error || body.message || body.detail) {
      return body.error ?? body.message ?? body.detail ?? "Request failed.";
    }
  }

  return "Unable to create the tenant. Check the details and try again.";
}

export function TenantRegistrationPage() {
  const [tenantName, setTenantName] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await apiFetch("/api/v1/admin/tenants", {
        method: "POST",
        body: JSON.stringify({
          name: tenantName.trim(),
          slug: tenantSlug.trim(),
        }),
      });
      const result = (await response.json()) as CreateTenantResponse;
      setSuccessMessage(
        `Successfully provisioned tenant '${result.name}' with schema '${result.schema}'.`,
      );
      setTenantName("");
      setTenantSlug("");
    } catch (requestError) {
      setError(await getApiErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">
          Platform administration
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          Provision a tenant
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
          Create a new organization tenant in the system. This provisions a
          dedicated schema and prepares the environment for the new tenant.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-zinc-800/80 bg-zinc-900 p-6 shadow-lg shadow-black/10"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-2 block text-xs font-semibold text-zinc-300">
                Tenant name <span className="text-blue-400">*</span>
              </span>
              <input
                required
                value={tenantName}
                onChange={(event) => setTenantName(event.target.value)}
                placeholder="Acme Corporation"
                className={inputClassName}
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-2 block text-xs font-semibold text-zinc-300">
                Tenant slug <span className="text-blue-400">*</span>
              </span>
              <input
                required
                pattern="[a-z0-9][a-z0-9_-]*[a-z0-9]"
                value={tenantSlug}
                onChange={(event) => setTenantSlug(event.target.value)}
                placeholder="acme-corp"
                className={inputClassName}
              />
              <span className="mt-1.5 block text-xs text-zinc-500">
                Use a lowercase string without spaces for the tenant schema
                identifier.
              </span>
            </label>
          </div>

          {error && (
            <div className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="mt-5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              {successMessage}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Provisioning..." : "Create tenant"}
            </button>
          </div>
        </form>

        <aside className="h-fit rounded-xl border border-zinc-800/80 bg-zinc-950 p-5">
          <h2 className="text-sm font-semibold text-zinc-100">
            What happens next
          </h2>
          <p className="mt-2 text-xs leading-5 text-zinc-500">
            A new schema will be provisioned in the database. You can then
            provision users for this new tenant using the User registration
            page.
          </p>
        </aside>
      </div>
    </div>
  );
}
