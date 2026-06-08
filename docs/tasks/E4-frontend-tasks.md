# 🧑‍💻 E4 — Frontend Developer Task Sheet

## Sprint 0 — Foundation (Weeks 1–2)

- **Role:** Frontend Developer
- **Primary Focus:** UI Design system, responsive application layout shell, and OIDC auth flow.
- **Working Directory:** `frontend/`
- **Language:** TypeScript 5 + React 19 + Vite + Tailwind CSS v4

---

## 📖 Reference Documentation

Please review the following project specifications in the `docs/` folder before commencing:
* `docs/02-architecture.md` (specifically §6 on end-to-end user client flows)
* `docs/06-technology-stack.md` (specifically §4.3 frontend ecosystem libraries and §7 OpenAPI codegen specs)
* `docs/07-security-architecture.md` (specifically §2.2 authentication flows using authorization code + PKCE)

---

## 🚫 Dev Rules & Restrictions
* **DO NOT** modify `core-backend/`, `data-engine/`, or `infra/` workspaces.
* **DO NOT** use generic styling or components. Style exclusively using Tailwind CSS v4.
* **DO NOT** install heavy third-party CSS component UI kits (e.g., Bootstrap, Material UI). Use **Radix UI** primitives combined with Tailwind utility styles.
* **DO NOT** manually type backend API interfaces. Enforce strict types by generating them using the OpenAPI script (Task S0-10).

---

## 📋 Assigned Tasks

---

### TASK S0-08: Design System & Application Layout Shell (5 pts)
* **Goal:** Create a responsive, dark-themed base application shell featuring a collapsable sidebar navigation.
* **Working Directory:** `frontend/`
* **Target Files:**
  * `src/styles/tokens.css` (custom design tokens)
  * `src/index.css` (global styles & Tailwind integration)
  * `src/components/layout/Sidebar.tsx`
  * `src/components/layout/TopBar.tsx`
  * `src/components/layout/AppShell.tsx`
  * `src/App.tsx` (entry update)

#### Requirements
1. **Theme and Styling:**
   * Configure dark theme values using CSS custom properties (define bg primary, secondary, text, and accent colors).
   * Integrate the design system tokens into the Tailwind imports.
   * Load the modern 'Inter' font family from Google Fonts inside the entry HTML page.
2. **Layout Components:**
   * **Sidebar:** Create a left-anchored collapsible sidebar containing navigation items (Dashboard, Explorer, Connections, Ontology, Graph, Settings) with Lucide React icons.
   * **TopBar:** Setup a top header showing navigation context, global search trigger, active tenant context selection dropdown, and user avatar.
   * **AppShell:** Compose layout grid combining sidebar and content views.
3. **Routing Stubs:**
   * Integrate TanStack Router to manage client side routing.
   * Bind routes for `/`, `/explorer`, `/connections`, `/ontology`, `/graph`, and `/settings` displaying mock stubs in the main content area.

#### Acceptance Criteria
* The application compiles without errors using `npm run build`.
* The sidebar collapses smoothly and adapts to mobile/tablet viewport sizes dynamically.
* Users can click sidebar links to transition routes without page reloads.

---

### TASK S0-09: Keycloak OIDC Integration & Login flow (3 pts)
* **Goal:** Integrate OpenID Connect authorization code flow with PKCE using Keycloak authentication provider.
* **Working Directory:** `frontend/`
* **Target Files:**
  * `src/lib/auth.ts` (OIDC manager client configuration)
  * `src/stores/authStore.ts` (Zustand client auth state store)
  * `src/features/auth/LoginPage.tsx` (Premium fallback login screen)
  * `src/components/layout/ProtectedRoute.tsx`

#### Requirements
1. **OIDC Client Integration:**
   * Initialize `oidc-client-ts` using authorization code flow, targeting client ID `luminai-spa` on the local Keycloak server (`http://localhost:8180/realms/luminai`).
2. **Auth State Store:**
   * Setup a Zustand state store tracking authenticating state, JWT tokens, loading state, and active user attributes.
3. **Redirect Flow:**
   * Implement a route guard wrapper (`ProtectedRoute`) blocking access to layout views when unauthenticated.
   * Implement callback redirect route (`/callback`) handling the tokens returned by Keycloak.
4. **Login Screen:**
   * Design a premium login splash screen featuring clean typography, minimal layouts, and brand identity for users before redirecting.

#### Acceptance Criteria
* Accessing protected pages redirects unauthenticated clients to the login gate.
* Clicking login successfully redirects to Keycloak, completes auth, and returns the user to the app dashboard.
* Active user details (name, email, avatar) render dynamically inside the layout shell on load.

---

### TASK S0-10: OpenAPI Client Codegen Pipeline (3 pts)
* **Goal:** Create a pipeline workflow to generate TypeScript client APIs automatically from the backend Spring Boot OpenAPI schema.
* **Working Directory:** `frontend/`
* **Target Files:**
  * `package.json` (npm scripts setup)
  * `src/lib/api.ts` (API Client config)
  * `src/lib/api-client/README.md`

#### Requirements
1. **Codegen Tooling:**
   * Integrate `@openapitools/openapi-generator-cli` as a development dependency.
   * Configure an npm script `generate:api` pointing to the backend built spec resource (`core-backend/build/openapi.json`) generating fetch client definitions.
2. **API Wrapper Integration:**
   * Create a global API fetch client wrapper that hooks into the Zustand auth store to append active JWT tokens into the header of every request (`Authorization: Bearer <JWT>`).

#### Acceptance Criteria
* Running `npm run generate:api` compiles without dependency errors.
* Generates type-safe service definitions and schemas under `src/lib/api-client/`.
* Code generator output directory is ignored in Git config.
