import type { Metadata } from "next";
import Link from "next/link";
import kit from "@/components/kit.module.css";
import { BOUTON_ENTREE, PageEntree, TitreEntree } from "@/components/PageEntree";
import entree from "./entree.module.css";
import styles from "./not-found.module.css";

export const metadata: Metadata = { title: "Page introuvable" };

/** Toute adresse inconnue arrive ici, avec le code 404 : le panneau des pages d'entrée, ses explorateurs qui cherchent. */
export default function PageIntrouvable() {
  return (
    <PageEntree
      illustration={{ chemin: "accueil/explorateurs.webp", alt: "Deux explorateurs et leur lama scrutent l'horizon, carte en main", cadrage: "22% 50%" }}
    >
      <p className={`${kit.etiquette} ${styles.code}`}>Erreur 404</p>
      <TitreEntree>Page introuvable</TitreEntree>
      <p className={entree.texte}>Même nos explorateurs ne la trouvent pas.</p>
      <Link href="/" className={`${BOUTON_ENTREE} ${styles.retour}`}>
        Revenir à l&apos;accueil
      </Link>
    </PageEntree>
  );
}
