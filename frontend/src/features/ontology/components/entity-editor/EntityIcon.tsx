import React from "react";
import { ENTITY_ICON_MAP } from "../../constants";

export { ENTITY_ICON_KEYS, ENTITY_ICON_LABELS } from "./entityIconConstants";

export const EntityIcon: React.FC<{ iconKey: string; size?: number }> = ({
  iconKey,
  size = 16,
}) => {
  const icon = ENTITY_ICON_MAP[iconKey] ?? ENTITY_ICON_MAP["package"];
  return (
    <span
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {icon}
    </span>
  );
};
