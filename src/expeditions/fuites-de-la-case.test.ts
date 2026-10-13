import { describe, expect, it } from "vitest";
import { type BeteDeLaCase, type ExpeditionDeLaCase, fuitesDeLaCase } from "./fuites-de-la-case";

const T0 = new Date("2026-10-01T00:00:00Z");
const h = (n: number) => new Date(T0.getTime() + n * 3_600_000);
/** La fin des calculs des essais, bien après tout ce qui s'y passe. */
const FIN = h(100);

/** Une Expédition présente de `arrivee` à `depart` (en heures), d'une escorte de force `escorte` ; ses attaques connues de tout temps. */
const expedition = (id: number, territoireId: number, arrivee: number, depart: number, escorte: number | null, autres: Partial<ExpeditionDeLaCase> = {}): ExpeditionDeLaCase => ({
  id,
  territoireId,
  arrivee: h(arrivee),
  depart: h(depart),
  escorte,
  enFuite: false,
  connuesJusqua: h(-100),
  ...autres,
});

/**
 * Une Bête présente de `arrivee` à `depart` (en heures), de force `force` et de Rareté `rareteId`, qui attaque chacune des
 * Expéditions de `attaques` (identifiant → heures après leur Rencontre) à l'instant dit, et jamais les autres.
 */
const bete = (
  numero: number,
  arrivee: number,
  depart: number,
  { force = 1000, rareteId = "rare", attaques = {}, territoireId = null }: { force?: number; rareteId?: string; attaques?: Record<number, number>; territoireId?: number | null } = {},
): BeteDeLaCase => ({
  arrivee: h(arrivee),
  depart: h(depart),
  force,
  rareteId,
  caseId: 1,
  numero: territoireId === null ? numero : null,
  beteDeNaissanceId: territoireId === null ? null : numero,
  especeId: "loup-gris",
  territoireId,
  chance: 0.5,
  hasards: (expeditionId, heure) => {
    const apresLaRencontre = attaques[expeditionId];
    return apresLaRencontre !== undefined && Math.floor(apresLaRencontre) === heure ? { attaque: 0, moment: apresLaRencontre - heure } : { attaque: 1, moment: 0 };
  },
});

describe("les fuites d'une Case (US-0945)", () => {
  it("une Bête trop forte qui reste attaque l'Expédition à l'instant de ses tirages, qui fuit alors", () => {
    const { fuites, attaques } = fuitesDeLaCase([expedition(1, 10, 0, 10, 5)], [bete(7, 1, 7, { attaques: { 1: 2 } })], FIN);
    expect(fuites).toEqual(new Map([[1, h(3)]]));
    expect(attaques).toEqual([{ expeditionId: 1, caseId: 1, numero: 7, beteDeNaissanceId: null, especeId: "loup-gris", le: h(3) }]);
  });

  it("partie avant l'attaque, avec l'Expédition qu'elle suit, la Bête n'attaque plus personne", () => {
    // X n'a pas la force de la Bête, Y si : arrivée une heure après elle, Y l'emmène avant l'attaque promise sur X.
    const expeditions = [expedition(1, 10, 0, 10, 5), expedition(2, 20, 2, 10, 2000)];
    expect(fuitesDeLaCase(expeditions, [bete(7, 1, 7, { attaques: { 1: 2 } })], FIN).fuites).toEqual(new Map());
  });

  it("en fuite, une Expédition n'est plus sur la Case pour personne : la Bête qu'elle aurait emmenée reste, et attaque une autre", () => {
    // X (Territoire 10) fuit à 2 h ; la Bête de 6 h, à la portée de X mais pas de Y (Territoire 20), reste et attaque Y à 7 h.
    const expeditions = [expedition(1, 10, 0, 10, 10), expedition(2, 20, 5, 10, 1)];
    const betes = [bete(7, 1, 4, { attaques: { 1: 1 } }), bete(8, 6, 9, { force: 5, attaques: { 2: 1 } })];
    expect(fuitesDeLaCase(expeditions, betes, FIN).fuites).toEqual(
      new Map([
        [1, h(2)],
        [2, h(7)],
      ]),
    );
  });

  it("ne refait pas une fuite déjà écrite, et ne compte pas une attaque d'avant l'instant où le Territoire est calculé", () => {
    const betes = [bete(7, 1, 4, { attaques: { 1: 1 } }), bete(8, 6, 9, { force: 5, attaques: { 2: 1 } })];
    // Écrite : X n'est sur la Case que jusqu'à 2 h, et la Bête de 6 h reste pour Y.
    const ecrite = [expedition(1, 10, 0, 2, 10, { enFuite: true }), expedition(2, 20, 5, 10, 1)];
    expect(fuitesDeLaCase(ecrite, betes, FIN).fuites).toEqual(new Map([[2, h(7)]]));
    // Son Territoire calculé jusqu'à 3 h sans fuite : X n'a pas fui à 2 h, emmène la Bête de 6 h, et Y n'est pas attaquée.
    const calculee = [expedition(1, 10, 0, 10, 10, { connuesJusqua: h(3) }), expedition(2, 20, 5, 10, 1)];
    expect(fuitesDeLaCase(calculee, betes, FIN).fuites).toEqual(new Map());
  });

  it("deux Bêtes qui attaquent au même instant : deux attaques, une seule fuite", () => {
    const betes = [bete(7, 1, 7, { attaques: { 1: 2 } }), bete(8, 2, 7, { attaques: { 1: 1 } })];
    const { fuites, attaques } = fuitesDeLaCase([expedition(1, 10, 0, 10, 5)], betes, FIN);
    expect(fuites).toEqual(new Map([[1, h(3)]]));
    expect(attaques.map((x) => [x.numero, x.le])).toEqual([
      [7, h(3)],
      [8, h(3)],
    ]);
  });

  it("une Bête de naissance ne se montre qu'aux Expéditions de son Territoire, et n'attaque qu'elles", () => {
    const expeditions = [expedition(1, 10, 0, 10, 5), expedition(2, 20, 0, 10, 5)];
    const deNaissance = bete(3, 1, 7, { territoireId: 20, attaques: { 1: 1, 2: 2 } });
    expect(fuitesDeLaCase(expeditions, [deNaissance], FIN).fuites).toEqual(new Map([[2, h(3)]]));
  });

  it("ne calcule rien à partir de la fin donnée", () => {
    expect(fuitesDeLaCase([expedition(1, 10, 0, 10, 5)], [bete(7, 1, 7, { attaques: { 1: 2 } })], h(3)).fuites).toEqual(new Map());
  });
});
