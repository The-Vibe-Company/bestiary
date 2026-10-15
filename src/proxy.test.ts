import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sessions = vi.hoisted(() => ({ etatDeLaSession: vi.fn(), compteDeLaSession: vi.fn() }));
vi.mock("./comptes/session", () => sessions);
vi.mock("./db", () => ({ getPool: () => ({}) }));

import { reglagesDuCookie } from "./comptes/cookie-session";
import { proxy } from "./proxy";

const FIN = new Date("2026-11-02T12:00:00Z");
const visite = (cookie?: string) => new NextRequest("https://bestia.test/jeu", { headers: cookie ? { cookie } : {} });

describe("prolongation de la session au passage d'une page du jeu", () => {
  beforeEach(() => {
    sessions.etatDeLaSession.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("renouvelle le cookie quand la session vient d'être prolongée", async () => {
    sessions.etatDeLaSession.mockResolvedValue({ valide: true, prolongeeJusqua: FIN });
    const reponse = await proxy(visite("bestia_session=jeton-de-session"));
    expect(sessions.etatDeLaSession).toHaveBeenCalledWith({}, "jeton-de-session");
    const cookie = reponse?.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("bestia_session=jeton-de-session");
    expect(cookie).toContain(`Expires=${FIN.toUTCString()}`);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toContain("Path=/");
    // Le témoin de connexion suit la session (US-0122) : prolongé avec elle, lisible par la page.
    const temoin = reponse?.headers.getSetCookie().find((c) => c.startsWith("bestia_connecte=")) ?? "";
    expect(temoin).toContain("bestia_connecte=1");
    expect(temoin).toContain(`Expires=${FIN.toUTCString()}`);
    expect(temoin).not.toMatch(/HttpOnly/i);
  });

  it("ne touche à rien quand la session n'a pas besoin d'être prolongée", async () => {
    sessions.etatDeLaSession.mockResolvedValue({ valide: true, prolongeeJusqua: null });
    expect(await proxy(visite("bestia_session=jeton-de-session"))).toBeUndefined();
  });

  it("ne va pas en base sans cookie de session", async () => {
    expect(await proxy(visite())).toBeUndefined();
    expect(sessions.etatDeLaSession).not.toHaveBeenCalled();
  });

  it("laisse jouer si la prolongation échoue", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    sessions.etatDeLaSession.mockRejectedValue(new Error("base injoignable"));
    expect(await proxy(visite("bestia_session=jeton-de-session"))).toBeUndefined();
  });
});

describe("cookie de session en ligne", () => {
  it("ne circule qu'en HTTPS, reste illisible par la page et ne part vers aucun autre site", () => {
    expect(reglagesDuCookie(FIN, { VERCEL_ENV: "production" })).toEqual({ httpOnly: true, secure: true, sameSite: "lax", path: "/", expires: FIN });
    expect(reglagesDuCookie(FIN, {})).toMatchObject({ httpOnly: true, secure: false });
  });
});

describe("joueur déjà connecté qui ouvre l'accueil, l'inscription ou la connexion", () => {
  const ouvrir = (chemin: string, options: { cookie?: string; methode?: string; action?: boolean } = {}) =>
    new NextRequest(`https://bestia.test${chemin}`, {
      method: options.methode ?? "GET",
      headers: { ...(options.cookie ? { cookie: options.cookie } : {}), ...(options.action ? { "next-action": "abc" } : {}) },
    });

  beforeEach(() => {
    sessions.compteDeLaSession.mockReset().mockResolvedValue({ id: 7, email: "nom@exemple.fr" });
  });

  it.each([
    // US-0161 : ouvrir le site, ou toucher le logo, mène au Foyer.
    ["/", "https://bestia.test/jeu"],
    ["/inscription", "https://bestia.test/jeu"],
    ["/connexion", "https://bestia.test/jeu"],
    ["/connexion?suite=%2Fjeu%2Fterritoire", "https://bestia.test/jeu/territoire"],
    ["/connexion?suite=https%3A%2F%2Fpirate.exemple", "https://bestia.test/jeu"],
  ])("envoie droit au jeu à l'ouverture de %s", async (chemin, vers) => {
    const reponse = await proxy(ouvrir(chemin, { cookie: "bestia_session=jeton-de-session" }));
    expect(reponse?.status).toBe(307);
    expect(reponse?.headers.get("location")).toBe(vers);
  });

  it("laisse un envoi de formulaire afficher sa réponse sur place (la confirmation d'inscription, US-0123)", async () => {
    expect(await proxy(ouvrir("/inscription", { cookie: "bestia_session=jeton-de-session", methode: "POST", action: true }))).toBeUndefined();
  });

  it("laisse passer un visiteur, sans aller en base : l'accueil reste rapide", async () => {
    expect(await proxy(ouvrir("/inscription"))).toBeUndefined();
    expect(await proxy(ouvrir("/"))).toBeUndefined();
    expect(sessions.compteDeLaSession).not.toHaveBeenCalled();
  });

  it("laisse passer une session expirée, en effaçant ses cookies périmés (US-0125)", async () => {
    sessions.compteDeLaSession.mockResolvedValue(null);
    const reponse = await proxy(ouvrir("/connexion", { cookie: "bestia_session=jeton-perime; bestia_connecte=1" }));
    expect(reponse?.headers.get("location")).toBeNull();
    const effaces = reponse?.headers.getSetCookie() ?? [];
    expect(effaces.find((c) => c.startsWith("bestia_session="))).toMatch(/Max-Age=0/);
    expect(effaces.find((c) => c.startsWith("bestia_connecte="))).toMatch(/Max-Age=0/);
  });
});

describe("session expirée au passage d'une page du jeu (US-0125)", () => {
  beforeEach(() => {
    sessions.etatDeLaSession.mockReset().mockResolvedValue({ valide: false });
  });

  it("mène à la connexion, qui le dira et ramènera ensuite à la même page, et efface les cookies périmés", async () => {
    const requete = new NextRequest("https://bestia.test/jeu/territoire?onglet=betes&_rsc=abc", { headers: { cookie: "bestia_session=jeton-perime" } });
    const reponse = await proxy(requete);
    expect(reponse?.status).toBe(307);
    expect(reponse?.headers.get("location")).toBe("https://bestia.test/connexion?suite=%2Fjeu%2Fterritoire%3Fonglet%3Dbetes&expiree=1");
    const effaces = reponse?.headers.getSetCookie() ?? [];
    expect(effaces.find((c) => c.startsWith("bestia_session="))).toMatch(/Max-Age=0/);
    expect(effaces.find((c) => c.startsWith("bestia_connecte="))).toMatch(/Max-Age=0/);
  });

  it("laisse une action envoyée se faire arrêter par la garde du jeu, qui ne l'applique pas", async () => {
    const action = new NextRequest("https://bestia.test/jeu", { method: "POST", headers: { cookie: "bestia_session=jeton-perime", "next-action": "abc" } });
    expect(await proxy(action)).toBeUndefined();
  });
});

describe("relais de la mesure d'audience vers PostHog", () => {
  const envoi = (adresse: string) =>
    proxy(
      new NextRequest(`https://bestia.test${adresse}`, {
        method: "POST",
        headers: { cookie: "__Host-bestia_session=jeton-de-session", authorization: "Basic c2VjcmV0", "content-type": "text/plain" },
      }),
    );

  it.each([
    ["/ingest/e/?ip=0&ver=1", "https://us.i.posthog.com/e/?ip=0&ver=1"],
    ["/ingest/flags/?v=2", "https://us.i.posthog.com/flags/?v=2"],
    ["/ingest/static/array.js", "https://us-assets.i.posthog.com/static/array.js"],
    ["/ingest/array/phc_cle/config.js", "https://us-assets.i.posthog.com/array/phc_cle/config.js"],
  ])("relaie %s vers %s", async (adresse, cible) => {
    const reponse = await envoi(adresse);
    expect(reponse?.headers.get("x-middleware-rewrite")).toBe(cible);
    expect(sessions.etatDeLaSession).not.toHaveBeenCalled();
  });

  it("ne relaie jamais hors de PostHog", async () => {
    for (const adresse of ["/ingest//ailleurs.test/x", "/ingest/%2F%2Failleurs.test/x"]) {
      expect(new URL((await envoi(adresse))?.headers.get("x-middleware-rewrite") ?? "").host).toBe("us.i.posthog.com");
    }
  });

  it("ne laisse partir ni les cookies du jeu, ni un mot de passe", async () => {
    const reponse = await envoi("/ingest/e/");
    const gardes = (reponse?.headers.get("x-middleware-override-headers") ?? "").split(",");
    expect(gardes).toContain("content-type");
    expect(gardes).not.toContain("cookie");
    expect(gardes).not.toContain("authorization");
    expect(reponse?.headers.get("x-middleware-request-cookie")).toBeNull();
    expect(reponse?.headers.get("x-middleware-request-authorization")).toBeNull();
  });
});
