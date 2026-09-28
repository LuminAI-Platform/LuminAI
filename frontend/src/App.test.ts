import { describe, it, expect } from "vitest";
import * as UI from "./components/ui";

describe("Application UI Component Library", () => {
  it("should export core reusable UI components", () => {
    expect(UI.Button).toBeDefined();
    expect(UI.Input).toBeDefined();
    expect(UI.Badge).toBeDefined();
    expect(UI.Card).toBeDefined();
    expect(UI.Modal).toBeDefined();
    expect(UI.Table).toBeDefined();
    expect(UI.Skeleton).toBeDefined();
    expect(UI.EmptyState).toBeDefined();
    expect(UI.ConfirmDialog).toBeDefined();
    expect(UI.Toast).toBeDefined();
    expect(UI.ToastProvider).toBeDefined();
    expect(typeof UI.showToastNotification).toBe("function");
  });
});
