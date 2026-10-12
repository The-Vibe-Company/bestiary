import { describe, expect, it } from "vitest";
import { dureesReelles, especesTropFortes, especesVuesSansSuite, type RetourARaconter, rappelDUneExpedition, recitDeRetour } from "./recit-de-retour";

const MINUTE = 60_000;
/** Une heure de Paris en octobre (UTC+2), comme le jeu l'enregistre, en temps universel. */
const aParis = (jour: number, heure: number, minute = 0) => new Date(Date.UTC(2026, 9, jour, heure - 2, minute));

/** Le retour d'une Expédition partie vers une Forêt à 3 Cases du Foyer, 12 Cases levées, aucune Bête vue. */
const retour = (autre: Partial<RetourARaconter> = {}): RetourARaconter => ({
  destination: { biome: "Forêt", distance: 3 },
  durees: { aller: 60, sejour: 240, retour: 60 },
  casesLevees: 12,
  rencontres: 0,
  rentreeLe: aParis(9, 18, 5),
  ...autre,
});

describe("le récit de retour d'une Expédition (US-0917)", () => {
  it("donne la destination et son Biome, les durées de l'aller, du séjour et du retour, les Cases sorties du brouillard ; daté du retour", () => {
    expect(recitDeRetour(retour())).toEqual({
      titre: "Retour d'Expédition",
      texte: [
        "Destination : Forêt, à 3 Cases de votre Foyer.",
        "Aller 1 h, séjour 4 h, retour 1 h.",
        "12 Cases sont sorties du brouillard.",
        "Aucune Bête ne s'est montrée.",
      ].join("\n"),
      survenuLe: aParis(9, 18, 5),
    });
  });

  it("dit une destination à une Case, au singulier", () => {
    expect(recitDeRetour(retour({ destination: { biome: "Lac", distance: 1 } })).texte).toMatch(/^Destination : Lac, à 1 Case de votre Foyer\.\n/);
  });

  it("écrit les durées comme le reste du jeu : en minutes, en heures et minutes, puis en jours et heures", () => {
    const durees = (aller: number, sejour: number, retourMinutes: number) =>
      recitDeRetour(retour({ durees: { aller, sejour, retour: retourMinutes } })).texte.split("\n")[1];
    expect(durees(40, 60, 40)).toBe("Aller 40 min, séjour 1 h, retour 40 min.");
    expect(durees(80, 150, 80)).toBe("Aller 1 h 20, séjour 2 h 30, retour 1 h 20.");
    expect(durees(160, 26 * 60, 160)).toBe("Aller 2 h 40, séjour 1 j 2 h, retour 2 h 40.");
  });

  it("compte les Cases sorties du brouillard, une seule ou aucune", () => {
    const cases = (casesLevees: number) => recitDeRetour(retour({ casesLevees })).texte.split("\n")[2];
    expect(cases(1)).toBe("Une Case est sortie du brouillard.");
    expect(cases(0)).toBe("Aucune Case n'est sortie du brouillard.");
    expect(cases(31)).toBe("31 Cases sont sorties du brouillard.");
  });

  it("quand rien ne s'est montré, le dit en une phrase ; sinon, combien de Bêtes se sont montrées", () => {
    const betes = (rencontres: number) => recitDeRetour(retour({ rencontres })).texte.split("\n").at(-1);
    expect(betes(0)).toBe("Aucune Bête ne s'est montrée.");
    expect(betes(1)).toBe("Une Bête s'est montrée.");
    expect(betes(3)).toBe("3 Bêtes se sont montrées.");
  });

  it("n'est jamais vide, même sans Case levée ni Bête vue", () => {
    const { titre, texte } = recitDeRetour(retour({ casesLevees: 0, rencontres: 0 }));
    expect(titre).not.toBe("");
    expect(texte.split("\n")).toHaveLength(4);
  });
});

describe("les durées réelles d'une Expédition rentrée (US-0917)", () => {
  const partLe = aParis(9, 14);

  it("l'aller jusqu'à l'arrivée, le séjour choisi, le retour jusqu'à l'heure où elle est rentrée", () => {
    const horaires = { partLe, trajetMinutes: 40, sejourMinutes: 60 };
    expect(dureesReelles(horaires, new Date(partLe.getTime() + 140 * MINUTE))).toEqual({ aller: 40, sejour: 60, retour: 40 });
  });

  it("le retour se lit à l'heure où elle est vraiment rentrée, pas à celle que donnaient ses horaires", () => {
    const horaires = { partLe, trajetMinutes: 40, sejourMinutes: 60 };
    expect(dureesReelles(horaires, new Date(partLe.getTime() + 155 * MINUTE))?.retour).toBe(55);
  });

  it("aucune tant que son trajet n'est pas chiffré (US-0912)", () => {
    expect(dureesReelles({ partLe, trajetMinutes: null, sejourMinutes: 60 }, aParis(9, 18))).toBeNull();
  });
});

describe("le récit de retour d'une Expédition rappelée (US-0920)", () => {
  it("dit qu'elle a été rappelée, à l'aller, et quand, et qu'elle n'a pas séjourné", () => {
    const texte = recitDeRetour(retour({ durees: { aller: 50, sejour: 0, retour: 50 }, rappel: { le: aParis(9, 14, 50), pendant: "aller" } })).texte;
    expect(texte.split("\n").slice(0, 3)).toEqual([
      "Destination : Forêt, à 3 Cases de votre Foyer.",
      "Rappelée à l'aller le 9 octobre à 14:50.",
      "Aller 50 min, sans séjour, retour 50 min.",
    ]);
  });

  it("dit qu'elle a été rappelée pendant son séjour, et quand", () => {
    const texte = recitDeRetour(retour({ durees: { aller: 60, sejour: 30, retour: 60 }, rappel: { le: aParis(9, 15, 30), pendant: "sejour" } })).texte;
    expect(texte.split("\n").slice(1, 3)).toEqual(["Rappelée pendant le séjour le 9 octobre à 15:30.", "Aller 1 h, séjour 30 min, retour 1 h."]);
  });

  it("ne dit rien d'un rappel quand il n'y en a pas eu", () => {
    expect(recitDeRetour(retour({ rappel: null })).texte).not.toContain("Rappelée");
  });

  it("compte ses durées réelles : l'aller jusqu'au rappel, aucun séjour, et le retour", () => {
    const partLe = aParis(9, 14);
    const horaires = { partLe, trajetMinutes: 40, sejourMinutes: 60, rappeleeLe: new Date(partLe.getTime() + 25 * MINUTE) };
    expect(dureesReelles(horaires, new Date(partLe.getTime() + 50 * MINUTE))).toEqual({ aller: 25, sejour: 0, retour: 25 });
    const enSejour = { ...horaires, rappeleeLe: new Date(partLe.getTime() + 55 * MINUTE) };
    expect(dureesReelles(enSejour, new Date(partLe.getTime() + 95 * MINUTE))).toEqual({ aller: 40, sejour: 15, retour: 40 });
    // Un séjour commencé, si court soit-il, compte au moins une minute : jamais « Rappelée pendant le séjour », « sans séjour ».
    const aPeine = { ...horaires, rappeleeLe: new Date(partLe.getTime() + 40 * MINUTE + 20_000) };
    expect(dureesReelles(aPeine, new Date(partLe.getTime() + 80 * MINUTE + 20_000))?.sejour).toBe(1);
  });

  it("dit pendant quelle phase elle a été rappelée : à l'arrivée pile, elle n'a pas séjourné", () => {
    const partLe = aParis(9, 14);
    const horaires = { partLe, trajetMinutes: 40, sejourMinutes: 60 };
    const rappelee = (minutes: number) => rappelDUneExpedition({ ...horaires, rappeleeLe: new Date(partLe.getTime() + minutes * MINUTE) });
    expect(rappelee(25)).toEqual({ le: new Date(partLe.getTime() + 25 * MINUTE), pendant: "aller" });
    expect(rappelee(40)?.pendant).toBe("aller");
    expect(rappelee(40 + 1 / 60_000)?.pendant).toBe("sejour");
    expect(rappelee(70)?.pendant).toBe("sejour");
    expect(rappelDUneExpedition(horaires)).toBeNull();
  });
});

describe("quand seules des Bêtes plus rares se sont montrées (US-0935)", () => {
  /** Une Rencontre d'une Bête de l'Espèce `especeId`, de Rareté `rareteId`, qui a suivi l'Expédition ou non. */
  const vue = (especeId: string, rareteId: string, apprivoisee = false) => ({ especeId, rareteId, apprivoisee });

  it("le récit dit ce que les explorateurs ont vu, chaque Espèce nommée une fois, mais qu'aucune Bête ne les a suivis", () => {
    const betes = (vuesSansSuite: string[], rencontres = vuesSansSuite.length) => recitDeRetour(retour({ rencontres, vuesSansSuite })).texte.split("\n").at(-1);
    expect(betes(["Renard roux"])).toBe("Vos explorateurs ont vu Renard roux, mais aucune Bête ne les a suivis.");
    expect(betes(["Renard roux", "Loup gris"], 3)).toBe("Vos explorateurs ont vu Renard roux et Loup gris, mais aucune Bête ne les a suivis.");
    expect(betes(["Renard roux", "Loup gris", "Lion"])).toBe("Vos explorateurs ont vu Renard roux, Loup gris et Lion, mais aucune Bête ne les a suivis.");
  });

  it("ses Espèces, chacune une fois, dans l'ordre des apparitions, quand aucune des Bêtes vues n'est commune ni n'a suivi", () => {
    expect(especesVuesSansSuite([vue("goupil", "peu_commune"), vue("isard", "rare"), vue("goupil", "peu_commune")])).toEqual(["goupil", "isard"]);
  });

  it("aucune quand une Bête commune s'est montrée ou qu'une Bête a suivi l'Expédition, ni quand rien ne s'est montré : le récit garde le nombre de Bêtes", () => {
    expect(especesVuesSansSuite([vue("goupil", "peu_commune"), vue("mulot", "commune", true)])).toBeNull();
    expect(especesVuesSansSuite([vue("goupil", "peu_commune"), vue("mulot", "commune")])).toBeNull();
    expect(especesVuesSansSuite([vue("isard", "rare", true)])).toBeNull();
    expect(especesVuesSansSuite([])).toBeNull();
    expect(recitDeRetour(retour({ rencontres: 2 })).texte.split("\n").at(-1)).toBe("2 Bêtes se sont montrées.");
  });
});

describe("la Bête trop forte pour l'escorte, restée sur sa Case (US-0942)", () => {
  /** Les lignes du récit du retour `autre`. */
  const lignes = (autre: Partial<RetourARaconter>) => recitDeRetour(retour(autre)).texte.split("\n");
  /** Le Renard roux, peu commun, auquel il manquait 37 340 de force ; le Loup gris, rare, 150 000. */
  const renard = { nom: "Renard roux", manque: 37_340 };
  const loup = { nom: "Loup gris", manque: 150_000 };

  it("quand seules des Bêtes trop fortes se sont montrées, la ligne qui les nomme dit « trop forte pour votre escorte » et la force qui lui manquait, en chiffres", () => {
    expect(lignes({ rencontres: 1, vuesSansSuite: ["Renard roux"], tropFortes: [renard] }).at(-1)).toBe(
      "Vos explorateurs ont vu Renard roux, mais aucune Bête ne les a suivis : trop forte pour votre escorte, il lui manquait 37\u00a0340 de force.",
    );
  });

  it("plusieurs Espèces trop fortes : la force qui manquait pour chacune, dans l'ordre où elles se sont montrées", () => {
    expect(lignes({ rencontres: 3, vuesSansSuite: ["Renard roux", "Loup gris"], tropFortes: [renard, loup] }).at(-1)).toBe(
      "Vos explorateurs ont vu Renard roux et Loup gris, mais aucune Bête ne les a suivis : trop fortes pour votre escorte, il lui manquait 37\u00a0340 de force pour Renard roux et 150\u00a0000 pour Loup gris.",
    );
    expect(lignes({ rencontres: 3, vuesSansSuite: ["Renard roux", "Loup gris", "Lion"], tropFortes: [renard, loup, { nom: "Lion", manque: 640_000 }] }).at(-1)).toBe(
      "Vos explorateurs ont vu Renard roux, Loup gris et Lion, mais aucune Bête ne les a suivis : trop fortes pour votre escorte, il lui manquait 37\u00a0340 de force pour Renard roux, 150\u00a0000 pour Loup gris et 640\u00a0000 pour Lion.",
    );
  });

  it("quand d'autres Bêtes ont suivi, une ligne après celle des Bêtes montrées dit celles qui n'ont pas suivi, trop fortes, et de combien", () => {
    expect(lignes({ rencontres: 3, tropFortes: [renard] }).slice(-2)).toEqual([
      "3 Bêtes se sont montrées.",
      "Renard roux n'a pas suivi vos explorateurs : Bête trop forte pour votre escorte, il lui manquait 37\u00a0340 de force.",
    ]);
    expect(lignes({ rencontres: 4, tropFortes: [renard, loup] }).at(-1)).toBe(
      "Renard roux et Loup gris n'ont pas suivi vos explorateurs : Bêtes trop fortes pour votre escorte, il lui manquait 37\u00a0340 de force pour Renard roux et 150\u00a0000 pour Loup gris.",
    );
  });

  it("rien de plus quand aucune Bête n'a été trop forte", () => {
    expect(lignes({ rencontres: 2, tropFortes: [] })).toEqual(lignes({ rencontres: 2 }));
    expect(lignes({ rencontres: 2 }).at(-1)).toBe("2 Bêtes se sont montrées.");
  });

  it("les Espèces trop fortes sont celles des Bêtes vues qui n'ont pas suivi l'Expédition, chacune une fois, dans l'ordre des apparitions", () => {
    const vue = (especeId: string, apprivoisee: boolean) => ({ especeId, apprivoisee });
    expect(especesTropFortes([vue("isard", false), vue("mulot", true), vue("goupil", false), vue("isard", false)])).toEqual(["isard", "goupil"]);
    expect(especesTropFortes([vue("mulot", true)])).toEqual([]);
    expect(especesTropFortes([])).toEqual([]);
  });

  it("une Bête trop forte et une Bête ramenée au Foyer : la ligne de la Bête restée vient avant celle de l'arrivée au Foyer (US-0938)", () => {
    expect(lignes({ rencontres: 2, tropFortes: [renard], ramenees: [{ nom: "Souris grise", sexe: "male" }] }).slice(-3)).toEqual([
      "2 Bêtes se sont montrées.",
      "Renard roux n'a pas suivi vos explorateurs : Bête trop forte pour votre escorte, il lui manquait 37\u00a0340 de force.",
      "Bête ramenée au Foyer : Souris grise (mâle).",
    ]);
  });
});

describe("les Bêtes qui ont suivi l'Expédition jusqu'au Foyer (US-0938)", () => {
  /** La dernière ligne du récit d'une Expédition suivie des Bêtes `ramenees`, et qui en a vu deux de plus. */
  const fin = (...ramenees: [string, "male" | "femelle"][]) =>
    recitDeRetour(retour({ rencontres: ramenees.length + 2, ramenees: ramenees.map(([nom, sexe]) => ({ nom, sexe })) })).texte.split("\n").at(-1);

  it("une ligne de plus, après les Bêtes qui se sont montrées, dit chacune ramenée au Foyer avec son sexe", () => {
    expect(recitDeRetour(retour({ rencontres: 3, ramenees: [{ nom: "Renard roux", sexe: "male" }] })).texte.split("\n").slice(-2)).toEqual([
      "3 Bêtes se sont montrées.",
      "Bête ramenée au Foyer : Renard roux (mâle).",
    ]);
    expect(fin(["Poule", "femelle"])).toBe("Bête ramenée au Foyer : Poule (femelle).");
  });

  it("plusieurs : chaque Espèce une fois, dans l'ordre de leur Apprivoisement, avec ses mâles et ses femelles", () => {
    expect(fin(["Renard roux", "male"], ["Poule", "femelle"])).toBe("Bêtes ramenées au Foyer : Renard roux (mâle) et Poule (femelle).");
    expect(fin(["Souris grise", "male"], ["Poule", "femelle"], ["Souris grise", "femelle"], ["Souris grise", "male"], ["Loup gris", "male"])).toBe(
      "Bêtes ramenées au Foyer : Souris grise (2 mâles, 1 femelle), Poule (femelle) et Loup gris (mâle).",
    );
    expect(fin(["Poule", "femelle"], ["Poule", "femelle"])).toBe("Bêtes ramenées au Foyer : Poule (2 femelles).");
  });

  it("aucune ligne quand aucune Bête n'a suivi", () => {
    expect(recitDeRetour(retour({ rencontres: 2, ramenees: [] })).texte.split("\n")).toHaveLength(4);
    expect(recitDeRetour(retour({ rencontres: 2 })).texte.split("\n").at(-1)).toBe("2 Bêtes se sont montrées.");
  });
});

describe("d'autres joueurs séjournaient sur la Case (US-0962)", () => {
  it("une ligne le dit, sans nommer personne, après les Cases sorties du brouillard et avant les Bêtes", () => {
    const ramenees = [{ nom: "Renard roux", sexe: "male" as const }];
    expect(recitDeRetour(retour({ rencontres: 1, ramenees, autresExpeditions: true })).texte.split("\n")).toEqual([
      "Destination : Forêt, à 3 Cases de votre Foyer.",
      "Aller 1 h, séjour 4 h, retour 1 h.",
      "12 Cases sont sorties du brouillard.",
      "D'autres Expéditions séjournaient sur la Case.",
      "Une Bête s'est montrée.",
      "Bête ramenée au Foyer : Renard roux (mâle).",
    ]);
  });

  it("aucune ligne quand l'Expédition était seule sur sa Case", () => {
    for (const autresExpeditions of [false, undefined]) {
      expect(recitDeRetour(retour({ rencontres: 1, autresExpeditions })).texte.split("\n")).not.toContain("D'autres Expéditions séjournaient sur la Case.");
    }
  });
});
