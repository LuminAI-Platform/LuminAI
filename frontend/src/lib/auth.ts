import { UserManager } from "oidc-client-ts";
import type { UserManagerSettings } from "oidc-client-ts";

const oidcConfig: UserManagerSettings = {
  authority: "http://localhost:8180/realms/luminai",
  client_id: "luminai-spa",
  redirect_uri: "http://localhost:3000/callback",
  response_type: "code",
  scope: "openid profile email",
  post_logout_redirect_uri: "http://localhost:3000/",
  automaticSilentRenew: true,
  monitorSession: false, // Prevents iframe issues in local development if session management isn't fully set up
};

export const userManager = new UserManager(oidcConfig);
