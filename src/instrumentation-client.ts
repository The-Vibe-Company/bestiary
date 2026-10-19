// Chargé par le navigateur avant que la page ne réponde : la mesure d'audience (voir src/analytique.ts).
import posthog from "posthog-js";
import { masquerLesJetons, pageAJeton, reglagesPostHog } from "./analytique";

const reglages = reglagesPostHog();
// Une page arrivée par un lien à jeton (réinitialisation, confirmation) ne démarre pas la mesure (voir pageAJeton).
if (reglages && !pageAJeton(window.location.pathname)) {
  posthog.init(reglages.cle, {
    api_host: reglages.hote,
    ui_host: "https://us.posthog.com",
    defaults: "2026-08-30",
    // Une page vue à chaque changement d'adresse, navigations internes du jeu comprises.
    capture_pageview: "history_change",
    // Les jetons secrets des adresses (réinitialisation, confirmation) ne partent jamais chez PostHog.
    get_current_url: masquerLesJetons,
    before_send: (evenement) => evenement && masquerLesJetons(evenement),
  });
}
