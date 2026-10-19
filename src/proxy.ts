// Passe avant certaines pages :
// - les pages de contrôle : sans le mot de passe de contrôle, le navigateur le demande ;
// - les pages du jeu : la session est prolongée, au plus une fois par jour (US-0119) ; expirée,
//   elle mène à la connexion, qui le dit, et ramène ensuite à la même page (US-0125) ;
// - l'inscription et la connexion : un joueur déjà connecté qui les ouvre va droit au jeu (US-0122) ;
// - l'accueil : un joueur connecté qui ouvre le site, ou touche le logo, arrive sur son Foyer (US-0161) ;
// - le relais de la mesure d'audience (/ingest, src/analytique.ts) : vers PostHog US, sans les cookies du jeu.
import { NextResponse, type NextRequest } from "next/server";
import { RELAIS_POSTHOG } from "./analytique";
import { DEMANDE_MOT_DE_PASSE, motDePasseAccepte } from "./controle/acces";
import { nomDuCookie, nomDuTemoin, reglagesDuCookie, reglagesDuTemoin } from "./comptes/cookie-session";
import { compteDeLaSession, etatDeLaSession } from "./comptes/session";
import { connexionPuis, suiteSure } from "./comptes/suite";
import { getPool } from "./db";

export const config = { matcher: ["/", "/controle", "/controle/:path*", "/jeu", "/jeu/:path*", "/inscription", "/connexion", "/ingest/:path*"] };

export async function proxy(request: NextRequest) {
  const chemin = request.nextUrl.pathname;
  if (chemin.startsWith(`${RELAIS_POSTHOG}/`)) return relayerVersPostHog(request);
  if (chemin.startsWith("/controle")) return protegerControle(request);
  if (chemin === "/" || chemin === "/inscription" || chemin === "/connexion") return envoyerAuJeuSiConnecte(request);
  return suivreLaSession(request);
}

/**
 * Les envois de la mesure d'audience, relayés tels quels vers PostHog US : ses scripts depuis us-assets, le reste
 * depuis us.i. Le cookie de session (et tout autre cookie) et un éventuel mot de passe de contrôle restent ici.
 */
function relayerVersPostHog(request: NextRequest) {
  const chemin = request.nextUrl.pathname.slice(RELAIS_POSTHOG.length);
  const hote = /^\/(static|array)\//.test(chemin) ? "https://us-assets.i.posthog.com" : "https://us.i.posthog.com";
  const entetes = new Headers(request.headers);
  entetes.delete("cookie");
  entetes.delete("authorization");
  // L'hôte est fixé avant le chemin : aucun chemin (« //ailleurs… ») ne peut mener hors de PostHog.
  const cible = new URL(hote);
  cible.pathname = chemin;
  cible.search = request.nextUrl.search;
  return NextResponse.rewrite(cible, { request: { headers: entetes } });
}

/** L'ouverture d'une page (GET), par opposition à un envoi de formulaire. */
const ouverture = (request: NextRequest) => request.method === "GET" && !request.headers.has("next-action");

/** Le cookie de session et le témoin, effacés avec leurs réglages (un cookie __Host- ne s'efface qu'en HTTPS). */
function effacerLesCookies(reponse: NextResponse): NextResponse {
  reponse.cookies.set(nomDuCookie(), "", { ...reglagesDuCookie(new Date(0)), maxAge: 0 });
  reponse.cookies.set(nomDuTemoin(), "", { ...reglagesDuTemoin(new Date(0)), maxAge: 0 });
  return reponse;
}

/**
 * À l'ouverture seulement, pas pendant un envoi de formulaire : un envoi qui connecte le joueur,
 * comme l'inscription (US-0123), doit pouvoir afficher sa confirmation sur place. Un cookie de
 * session périmé est effacé au passage, pour que l'accueil ne propose plus de retourner au jeu.
 */
async function envoyerAuJeuSiConnecte(request: NextRequest) {
  if (!ouverture(request)) return;
  const jeton = request.cookies.get(nomDuCookie())?.value;
  if (!jeton) return;
  try {
    if (!(await compteDeLaSession(getPool(), jeton))) return effacerLesCookies(NextResponse.next());
  } catch {
    return; // Sans réponse de la base, la page s'affiche simplement.
  }
  const suite = request.nextUrl.pathname === "/connexion" ? suiteSure(request.nextUrl.searchParams.get("suite")) : "/jeu";
  return NextResponse.redirect(new URL(suite, request.url));
}

function protegerControle(request: NextRequest) {
  if (motDePasseAccepte(request.headers.get("authorization"))) return;
  return new Response("Mot de passe de contrôle requis.", {
    status: 401,
    headers: { "WWW-Authenticate": DEMANDE_MOT_DE_PASSE, "Cache-Control": "no-store" },
  });
}

/** La page du jeu demandée, sans le paramètre interne de Next (_rsc). */
function pageDemandee(request: NextRequest): string {
  const parametres = new URLSearchParams(request.nextUrl.searchParams);
  parametres.delete("_rsc");
  const requete = parametres.toString();
  return request.nextUrl.pathname + (requete ? `?${requete}` : "");
}

async function suivreLaSession(request: NextRequest) {
  const jeton = request.cookies.get(nomDuCookie())?.value;
  if (!jeton) return;
  try {
    const etat = await etatDeLaSession(getPool(), jeton);
    if (!etat.valide) {
      // Une action envoyée avec une session expirée est arrêtée par la garde du jeu (exigerCompte).
      if (!ouverture(request)) return;
      return effacerLesCookies(NextResponse.redirect(new URL(connexionPuis(pageDemandee(request), { expiree: true }), request.url)));
    }
    if (!etat.prolongeeJusqua) return;
    const reponse = NextResponse.next();
    reponse.cookies.set(nomDuCookie(), jeton, reglagesDuCookie(etat.prolongeeJusqua));
    reponse.cookies.set(nomDuTemoin(), "1", reglagesDuTemoin(etat.prolongeeJusqua));
    return reponse;
  } catch (erreur) {
    // Sans réponse de la base, la page décide seule (la garde du jeu vérifie la session).
    console.error(`Session non suivie : ${erreur instanceof Error ? erreur.message : "erreur inconnue"}.`);
  }
}
