import { describe, expect, it, vi } from "vitest";

const { query } = vi.hoisted(() => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
}));

vi.mock("@workspace/db", () => ({
  pool: { query },
}));

import { getRecentArtifacts, getRecentRuns } from "../src/services/memoryService.js";

describe("agent memory ownership filters", () => {
  it("queries artifacts only for the requesting user", async () => {
    await getRecentArtifacts("user-a");

    expect(query).toHaveBeenCalledTimes(1);
    const [statement, params] = query.mock.calls[0] as [string, unknown[]];
    expect(statement).toContain("WHERE user_id = $1");
    expect(params[0]).toBe("user-a");
  });

  it("queries run history only for the requesting user", async () => {
    query.mockClear();
    await getRecentRuns("user-b");

    expect(query).toHaveBeenCalledTimes(1);
    const [statement, params] = query.mock.calls[0] as [string, unknown[]];
    expect(statement).toContain("WHERE user_id = $1");
    expect(params[0]).toBe("user-b");
  });
});
