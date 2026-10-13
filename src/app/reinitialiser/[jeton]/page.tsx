import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { entreeDuJeuOuverte } from "@/comptes/ouverture";
import { etatDuLien } from "@/comptes/reinitialisation";
import { PageEntree } from "@/components/PageEntree";
import { getPool } from "@/db";
import { choisirMotDePasse } from "./actions";
import { FormulaireNouveauMotDePasse } from "./FormulaireNouveauMotDePasse";
import { LienHorsService } from "./LienHorsService";

// Le jeton est dans l'adresse de la page : il ne doit fuir vers aucun autre site, ni être indexé.
export const metadata: Metadata = { title: "Nouveau mot de passe", referrer: "no-referrer", robots: { index: false, follow: false } };

/**
 * La page qu'ouvre le bouton de l'e-mail « Mot de passe oublié » (US-0128). L'ouvrir ne consomme
 * pas le lien : seul le changement de mot de passe le fait. Un lien qui ne sert plus dit
 * pourquoi : expiré, déjà utilisé, ou inconnu (US-0129).
 */
export default async function NouveauMotDePasse({ params }: { params: Promise<{ jeton: string }> }) {
  await connection();
  if (!entreeDuJeuOuverte()) notFound();
  const { jeton } = await params;
  const lien = await etatDuLien(getPool(), jeton);
  const illustration = { chemin: "entree/connexion.webp", alt: "Une hutte au toit de chaume, éclairée au crépuscule, au bout d'un chemin fleuri", cadrage: "50% 30%" };
  if (lien.etat !== "valable") {
    return (
      <PageEntree illustration={illustration}>
        <LienHorsService raison={lien.etat} />
      </PageEntree>
    );
  }
  return (
    <PageEntree illustration={illustration}>
      <FormulaireNouveauMotDePasse email={lien.email} choisir={choisirMotDePasse.bind(null, jeton)} />
    </PageEntree>
  );
}
