import React from "react";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import type { UserProfileCardProps } from "../types";

export const UserProfileCard: React.FC<UserProfileCardProps> = ({
  userName,
  userEmail,
  roles,
}) => {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-zinc-800/80">
          <div className="w-12 h-12 rounded-lg bg-zinc-800 border border-zinc-700/60 text-zinc-300 flex items-center justify-center font-bold text-base select-none">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">{userName}</h3>
            <p className="text-xs text-zinc-400">{userEmail}</p>
          </div>
        </div>

        <div className="flex flex-col gap-4 text-xs">
          <div>
            <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">
              Assigned Platform Roles
            </label>
            <div className="flex flex-wrap gap-1.5">
              {roles.map((r) => (
                <Badge key={r} variant="purple">
                  {r}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">
              Authentication Authority
            </label>
            <span className="text-zinc-300 text-[11px] bg-zinc-950 px-2.5 py-1 rounded-md border border-zinc-800 inline-block">
              Keycloak OIDC (OAuth 2.0 / RS256)
            </span>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">
              Session Status
            </label>
            <div className="flex items-center gap-2 text-emerald-400 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              <span>Authenticated & Multi-Tenant Verified</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
