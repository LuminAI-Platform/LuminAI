import { describe, it, expect } from "vitest";
import { ICON_MAP } from "../lib/icons";

describe("Central Semantic Icon Map (ICON_MAP) uniqueness guard", () => {
  it("ensures no two destination or KPI keys (nav.*, kpi.*, engine.*) resolve to the same icon", () => {
    const groups = [
      { prefix: "nav", entries: Object.entries(ICON_MAP.nav) },
      { prefix: "kpi", entries: Object.entries(ICON_MAP.kpi) },
      { prefix: "engine", entries: Object.entries(ICON_MAP.engine) },
    ];

    const seen = new Map<unknown, string>();
    const collisions: string[] = [];

    for (const { prefix, entries } of groups) {
      for (const [key, iconComponent] of entries) {
        const fullKey = `${prefix}.${key}`;
        expect(iconComponent, `Missing icon for ${fullKey}`).toBeDefined();
        const existingKey = seen.get(iconComponent);
        if (existingKey) {
          collisions.push(
            `Duplicate icon shared by "${existingKey}" and "${fullKey}"`,
          );
        } else {
          seen.set(iconComponent, fullKey);
        }
      }
    }

    expect(
      collisions,
      `Icon collisions detected:\n${collisions.join("\n")}`,
    ).toEqual([]);
  });

  it("ensures failed and completedWithIssues status icons are distinct", () => {
    expect(ICON_MAP.status.failed).not.toBe(
      ICON_MAP.status.completedWithIssues,
    );
  });
});
