import { describe, it, expect, vi, beforeEach } from "vitest";

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}));

vi.mock("../lib/api", () => ({
  apiFetch: apiFetchMock,
}));

import {
  fetchGraphOverview,
  fetchShortestPath,
  backfillKnowledgeGraph,
} from "../features/graph/graphApi";

describe("Knowledge Graph API client", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("fetches overview with optional relationshipType filter", async () => {
    apiFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ nodes: [], edges: [] }),
    });

    await fetchGraphOverview();
    expect(apiFetchMock).toHaveBeenCalledWith("/api/v1/graph/overview", {
      headers: { "X-Suppress-Toast": "true" },
    });

    await fetchGraphOverview("WORKS_AT");
    expect(apiFetchMock).toHaveBeenLastCalledWith(
      "/api/v1/graph/overview?relationshipType=WORKS_AT",
      { headers: { "X-Suppress-Toast": "true" } },
    );
  });

  it("queries shortest path with optional toast suppression", async () => {
    apiFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ nodes: [], edges: [] }),
    });

    await fetchShortestPath(" gr-1 ", " gr-2 ", { suppressToast: true });
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/v1/graph/shortest-path?sourceId=gr-1&targetId=gr-2",
      { headers: { "X-Suppress-Toast": "true" } },
    );
  });

  it("triggers tenant backfill or single-connector graph sync", async () => {
    apiFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "completed",
        nodesSynced: 10,
        edgesSynced: 4,
      }),
    });

    const allRes = await backfillKnowledgeGraph();
    expect(apiFetchMock).toHaveBeenCalledWith("/api/v1/graph/backfill", {
      method: "POST",
      headers: { "X-Suppress-Toast": "true" },
    });
    expect(allRes.nodesSynced).toBe(10);

    await backfillKnowledgeGraph("conn-uuid-1");
    expect(apiFetchMock).toHaveBeenLastCalledWith(
      "/api/v1/graph/sync/connection/conn-uuid-1",
      {
        method: "POST",
        headers: { "X-Suppress-Toast": "true" },
      },
    );
  });
});
