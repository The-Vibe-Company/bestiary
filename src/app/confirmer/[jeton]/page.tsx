import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { confirmerAdresse, type ResultatConfirmation } from "@/comptes/confirmation";
import { entreeDuJeuOuverte } from "@/comptes/ouverture";
import { BOUTON_ENTREE, PageEntree } from "@/components/PageEntree";
import { getPool } from "@/db";
import { LIEN_CONFIRMATION_HEURES } from "@/reglages";
import styles from "../../entree.module.css";
import { demanderNouveauLien } from "./actions";
import { NouveauLien } from "./NouveauLien";

// Le jeton est dans l'adresse de la page : il ne doit fuir vers aucun autre site, ni être indexé.
export const metadata: Metadata = { title: "Confirmer votre adresse", referrer: "no-referrer", robots: { index: false, follow: false } };

const TITRES: Record<ResultatConfirmation, string> = {
  confirmee: "Adresse confirmée",
  "deja-confirmee": "Adresse déjà confirmée",
  expire: "Ce lien a expiré",
  inconnu: "Ce lien n'est pas valable",
};

/**
 * La page qu'ouvre le lien de l'e-mail de confirmation (US-0114). Ouvrir le lien suffit à
 * confirmer l'adresse ; un lien expiré propose d'en recevoir un nouveau.
 */
export default async function ConfirmerAdresse({ params }: { params: Promise<{ jeton: string }> }) {
  await connection();
  if (!entreeDuJeuOuverte()) notFound();
  const { jeton } = await params;
  const resultat = await confirmerAdresse(getPool(), jeton);

  return (
    <PageEntree
      titre={TITRES[resultat]}
      illustration={{ chemin: "entree/inscription.webp", alt: "Un sac d'aventurier ouvert sur un rocher, au-dessus d'une vallée sauvage au lever du soleil" }}
    >
      {resultat === "expire" ? (
        <>
          <p className={styles.texte}>
            Un lien reste valable {LIEN_CONFIRMATION_HEURES} heures. Demandez-en un nouveau : il partira à la même adresse.
          </p>
          <NouveauLien demander={demanderNouveauLien.bind(null, jeton)} />
        </>
      ) : resultat === "inconnu" ? (
        <p className={styles.texte}>Vérifiez qu&apos;il est complet, ou ouvrez le dernier e-mail de Bestia que vous avez reçu.</p>
      ) : (
        <div className={styles.confirmation}>
          <p className={styles.texte}>Merci : votre adresse e-mail est vérifiée.</p>
          <Link href="/jeu" className={`${BOUTON_ENTREE} ${styles.envoyer}`}>
            Aller au jeu
          </Link>
        </div>
      )}
    </PageEntree>
  );
}
