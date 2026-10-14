// L'envoi des e-mails du jeu (US-0113), par Resend. Côté serveur uniquement.
//
// - En production et sur les prévisualisations, avec la clé RESEND_API_KEY : l'e-mail part.
// - En local (et dans les tests) : il s'affiche dans le journal au lieu de partir.
// - Un envoi raté est noté dans le journal, sans jamais bloquer le joueur : envoyerEmail
//   ne lève pas d'erreur, elle répond seulement s'il est parti.
import "server-only";
import { ENVOI_EMAIL_DELAI_MAX_MS, EXPEDITEUR_EMAILS } from "@/reglages";

export type Email = { a: string; sujet: string; texte: string; html?: string };

/** Une adresse à moitié masquée, pour que le journal ne garde pas l'adresse d'un joueur. */
export function masquerAdresse(adresse: string): string {
  const [nom, domaine] = adresse.split("@");
  return domaine ? `${nom.slice(0, 1)}***@${domaine}` : "***";
}

function enLigne(env: Record<string, string | undefined>): boolean {
  return env.VERCEL_ENV === "production" || env.VERCEL_ENV === "preview";
}

/** Envoie un e-mail ; rend true s'il est parti (ou affiché en local), false sinon. */
export async function envoyerEmail(email: Email, env: Record<string, string | undefined> = process.env): Promise<boolean> {
  if (!enLigne(env)) {
    console.info(`[e-mail non envoyé en local] De : ${EXPEDITEUR_EMAILS} · À : ${email.a} · Sujet : ${email.sujet}\n${email.texte}`);
    return true;
  }
  const cle = env.RESEND_API_KEY?.trim();
  // Le contenu n'est jamais écrit dans le journal en ligne : il peut porter un lien personnel.
  const trace = `« ${email.sujet} » pour ${masquerAdresse(email.a)}`;
  if (!cle) {
    console.error(`E-mail non envoyé, ${trace} : RESEND_API_KEY manquante (voir The-Vibe-Company/bestiary#58).`);
    return false;
  }
  try {
    const reponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: EXPEDITEUR_EMAILS, to: [email.a], subject: email.sujet, text: email.texte, html: email.html }),
      signal: AbortSignal.timeout(ENVOI_EMAIL_DELAI_MAX_MS),
    });
    if (reponse.ok) return true;
    console.error(`E-mail non envoyé, ${trace} : Resend a répondu ${reponse.status}.`);
    return false;
  } catch (erreur) {
    const raison = erreur instanceof Error && erreur.name === "TimeoutError" ? "pas de réponse à temps" : "service injoignable";
    console.error(`E-mail non envoyé, ${trace} : ${raison}.`);
    return false;
  }
}
