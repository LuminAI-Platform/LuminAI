import React from "react";
import { CheckCircle2 } from "../../../lib/icons";
import { Badge } from "../../../components/ui/Badge";
import { AUTH_URL } from "../../../stores/authTypes";
import type { UserProfileCardProps } from "../types";

export const UserProfileCard: React.FC<UserProfileCardProps> = ({
  userName,
  userEmail,
  roles,
}) => {
  return (
    <div className="bg-surface border border-border rounded-lg p-6 flex flex-col justify-between shadow-xs transition-colors">
      <div>
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border">
          <div className="w-12 h-12 rounded-lg bg-surface-subtle border border-border text-text-secondary flex items-center justify-center font-bold text-base select-none">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text">{userName}</h3>
            <p className="text-xs text-text-secondary">{userEmail}</p>
          </div>
        </div>

        <div className="flex flex-col gap-4 text-xs">
          <div>
            <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider block mb-1.5">
              Assigned Platform Roles
            </label>
            <div className="flex flex-wrap gap-1.5">
              {roles.length > 0 ? (
                roles.map((r) => (
                  <Badge key={r} variant="purple">
                    {r}
                  </Badge>
                ))
              ) : (
                <span className="text-text-secondary">No roles assigned</span>
              )}
            </div>
          </div>

          {AUTH_URL && (
            <div>
              <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider block mb-1">
                Authentication Authority
              </label>
              <span className="text-text text-[11px] bg-surface-subtle px-2.5 py-1 rounded-md border border-border inline-block font-mono break-all">
                {AUTH_URL}
              </span>
            </div>
          )}

          <div>
            <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider block mb-1">
              Session Status
            </label>
            <div className="flex items-center gap-2 text-emerald-400 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              <span>Authenticated</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
