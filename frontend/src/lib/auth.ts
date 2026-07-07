import { UserManager } from "oidc-client-ts";
import type { UserManagerSettings } from "oidc-client-ts";

const oidcConfig: UserManagerSettings = {
  authority: "http://localhost:8180/realms/luminai",
  client_id: "luminai-spa",
  redirect_uri: "http://localhost:3000/callback",
  response_type: "code",
  scope: "openid profile email",
  post_logout_redirect_uri: "http://localhost:3000/",

  // Use PKCE S256 explicitly (default in oidc-client-ts v3, stated for clarity)
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — pkce_method is a valid oidc-client-ts v3 setting
  pkce_method: "S256",

  // Keycloak returns all profile claims inside the id_token.
  // Setting loadUserInfo: false prevents an extra /userinfo request
  // that can fail due to Keycloak CORS config in local dev.
  loadUserInfo: false,

  // Strip OIDC protocol claims (iss, nbf, iat, etc.) from the profile
  // so only application-relevant claims (sub, name, email) remain.
  filterProtocolClaims: true,

  // Silent token renewal via a hidden iframe
  automaticSilentRenew: true,

  // Disable session check iframe — avoids cross-origin iframe issues
  // in local dev where Keycloak and the SPA are on different ports.
  monitorSession: false,
};

export const userManager = new UserManager(oidcConfig);
