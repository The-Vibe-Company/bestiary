import { afterEach, describe, expect, it, vi } from "vitest";

const base = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/db", () => ({ getPool: () => base }));
vi.mock("next/server", async (original) => ({ ...(await original<object>()), connection: async () => {} }));

import { GET } from "./route";

const JETON = "un-jeton-de-test-assez-long";
const appel = (autorisation?: string) =>
  GET(new Request("http://localhost/api/stats", { headers: autorisation ? { authorization: autorisation } : {} }));

describe("statistiques des comptes (/api/stats)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    base.query.mockReset();
  });

  it("refuse un appel sans jeton, ou avec un mauvais", async () => {
    vi.stubEnv("STATS_TOKEN", JETON);
    for (const autorisation of [undefined, "Bearer mauvais", JETON]) expect((await appel(autorisation)).status).toBe(401);
    expect(base.query).not.toHaveBeenCalled();
  });

  it.each([undefined, ""])("refuse tout quand STATS_TOKEN vaut %j", async (jeton) => {
    vi.stubEnv("STATS_TOKEN", jeton);
    expect((await appel(`Bearer ${JETON}`)).status).toBe(401);
    expect((await appel("Bearer ")).status).toBe(401);
    expect(base.query).not.toHaveBeenCalled();
  });

  it("rend les comptes, les nouveaux et les actifs", async () => {
    vi.stubEnv("STATS_TOKEN", JETON);
    base.query.mockResolvedValue({ rows: [{ total: 12, jour: 1, semaine: 4, actifs_jour: 2, actifs_semaine: 5 }] });
    const reponse = await appel(`Bearer ${JETON}`);
    expect(reponse.status).toBe(200);
    expect(reponse.headers.get("cache-control")).toBe("no-store");
    expect(await reponse.json()).toEqual({
      total_users: 12,
      new_users_1d: 1,
      new_users_7d: 4,
      active_users_1d: 2,
      active_users_7d: 5,
    });
  });
});
