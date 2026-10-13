import { afterEach, describe, expect, it, vi } from "vitest";

const garde = vi.hoisted(() => ({ exigerCompte: vi.fn() }));
vi.mock("@/comptes/garde", () => garde);
vi.mock("@/db", () => ({ getPool: () => ({}) }));
const roles = vi.hoisted(() => ({
  affecterUneBete: vi.fn(async () => true),
  retirerUneBete: vi.fn(async () => true),
}));
vi.mock("@/monde/roles", () => roles);
const cache = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/cache", () => cache);
const MAINTENANT = vi.hoisted(() => new Date("2026-10-13T09:15:00.000Z"));
vi.mock("@/temps/horloge", async (original) => ({ ...(await original<object>()), maintenant: () => MAINTENANT }));

import { affecterAuRole, retirerDuRole } from "./actions";

describe.each([
  ["« + » : affecter une Bête à son Rôle (US-0837)", affecterAuRole, roles.affecterUneBete],
  ["« − » : retirer une Bête de son Rôle (US-0837)", retirerDuRole, roles.retirerUneBete],
] as const)("%s", (_titre, action, ecriture) => {
  afterEach(() => {
    vi.unstubAllEnvs();
    garde.exigerCompte.mockReset();
    ecriture.mockClear();
    cache.refresh.mockClear();
  });

  it("passe par la garde, puis change l'Espèce dans le Territoire du joueur, à l'heure du jeu, et relit la page", async () => {
    garde.exigerCompte.mockResolvedValue({ id: 7, email: "nom@exemple.fr", nomDeChef: "Ourse", territoireId: 12, recitLu: true });
    await action("poule");
    expect(garde.exigerCompte).toHaveBeenCalledWith("/jeu/betes");
    expect(ecriture).toHaveBeenCalledExactlyOnceWith(expect.anything(), 12, "poule", MAINTENANT);
    expect(cache.refresh).toHaveBeenCalledTimes(1);
  });

  it("relit la page même quand rien n'a changé : la page relue fait foi", async () => {
    garde.exigerCompte.mockResolvedValue({ territoireId: 12 });
    ecriture.mockResolvedValueOnce(false);
    await action("poule");
    expect(cache.refresh).toHaveBeenCalledTimes(1);
  });

  it("s'arrête à la garde sans session : rien ne change", async () => {
    garde.exigerCompte.mockRejectedValue(Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/connexion?suite=%2Fjeu%2Fbetes;307;" }));
    await expect(action("poule")).rejects.toMatchObject({ digest: expect.stringContaining("/connexion") });
    expect(ecriture).not.toHaveBeenCalled();
  });

  it("ne change rien sans Territoire", async () => {
    garde.exigerCompte.mockResolvedValue({ territoireId: null });
    await action("poule");
    expect(ecriture).not.toHaveBeenCalled();
  });

  it.each([[""], ["Poule"], ["poule; drop table"], ["x".repeat(65)], [42 as unknown as string]])("ignore une Espèce dont l'identifiant n'en est pas un : %s", async (id) => {
    garde.exigerCompte.mockResolvedValue({ territoireId: 12 });
    await action(id);
    expect(ecriture).not.toHaveBeenCalled();
  });

  it("reste fermé en production tant que l'entrée du jeu est fermée", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    await action("poule");
    expect(garde.exigerCompte).not.toHaveBeenCalled();
    expect(ecriture).not.toHaveBeenCalled();
  });
});
