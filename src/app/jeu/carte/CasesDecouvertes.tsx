import styles from "./CasesDecouvertes.module.css";

/** Un nombre entier à la française, les milliers séparés d'une espace insécable : l'espace fine se voit à peine dans la police du jeu. */
const entier = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/ /g, " ");
const auDixieme = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** US-0443 : la part du Monde découverte, au dixième de pour cent (« 0,6 % ») : jamais 0,0 % ni 100,0 % à tort. */
function part(nombre: number, total: number): string {
  const pourcent = Math.round((1000 * nombre) / total) / 10;
  if (nombre > 0 && pourcent === 0) return "moins de 0,1 %";
  if (nombre < total && pourcent === 100) return "plus de 99,9 %";
  return `${auDixieme.format(pourcent)} %`;
}

/**
 * US-0443 : le nombre de Cases que le joueur a découvertes (`nombre`), et la part du Monde (de `total` Cases) que cela
 * fait, en une petite ligne de verre sur la carte, une boussole de cuivre devant : « 61 Cases découvertes · 0,6 % du
 * Monde », le nombre en crème et la part en cuivre. Elle suit la carte, qui la tient à jour de chaque découverte
 * (US-0442). Faute de place, elle passe à la ligne au « · », jamais ailleurs. Elle se déclare posée sur la carte : la
 * flèche du Foyer la contourne.
 */
export function CasesDecouvertes({ nombre, total }: { nombre: number; total: number }) {
  const cases = nombre > 1 ? "Cases découvertes" : "Case découverte";
  return (
    <p className={styles.compteur} data-sur-la-carte="">
      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <circle cx="8" cy="8" r="6.2" />
        <path d="M10.6 5.4 9 9 5.4 10.6 7 7z" />
      </svg>
      <span>
        <b>{entier(nombre)}</b>
        {` ${cases}`}
      </span>
      {" · "}
      <span>
        <em>{part(nombre, total)}</em> du Monde
      </span>
    </p>
  );
}
