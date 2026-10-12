import { describe, expect, it } from "vitest";
import { departDUneBete, issueDUneRencontre } from "./recit-de-rencontre";

describe("le départ d'une Bête vue sans qu'elle suive (US-0940)", () => {
  const h = (heure: number) => new Date(Date.UTC(2026, 9, 9, heure));
  /** Une Bête peu commune, de force 1 000, sur sa Case de 10 h à 16 h : la Bête 1 de la Case 1. */
  const bete = { arrivee: h(10), depart: h(16), force: 1_000, rareteId: "peu_commune", caseId: 1, numero: 1, beteDeNaissanceId: null };
  /** L'Expédition sans escorte qui l'a vue, de 9 h à 13 h. */
  const sansEscorte = { id: 7, arrivee: h(9), depart: h(13), escorte: null };

  it("sans autre Expédition qui l'ait à portée, à la fin de sa durée", () => {
    expect(departDUneBete(bete, [sansEscorte])).toEqual(h(16));
    expect(departDUneBete(bete, [sansEscorte, { id: 8, arrivee: h(11), depart: h(15), escorte: 999 }])).toEqual(h(16));
  });

  it("plus tôt quand une autre Expédition, assez forte, arrive sur sa Case : à l'instant où elle la suit", () => {
    expect(departDUneBete(bete, [sansEscorte, { id: 8, arrivee: h(12), depart: h(14), escorte: 1_000 }])).toEqual(h(12));
  });

  it("à la fin de sa durée quand l'Expédition assez forte n'arrive qu'après son départ", () => {
    expect(departDUneBete(bete, [sansEscorte, { id: 8, arrivee: h(16), depart: h(18), escorte: 5_000 }])).toEqual(h(16));
  });
});

describe("ce qu'il advint de la Bête d'une Rencontre (US-0940)", () => {
  const fin = new Date("2026-10-09T16:00:00Z");
  const avant = new Date("2026-10-09T15:59:59.999Z");

  it("apprivoisée, elle a suivi l'Expédition, quel que soit son départ", () => {
    expect(issueDUneRencontre(true, avant, fin)).toBe("apprivoisee");
    expect(issueDUneRencontre(true, null, fin)).toBe("apprivoisee");
  });

  it("trop forte, elle est restée sur sa Case tant qu'elle y était encore quand l'Expédition l'a quittée", () => {
    expect(issueDUneRencontre(false, new Date("2026-10-09T18:30:00Z"), fin)).toBe("restee");
    // Parties au même instant : la Bête était encore là jusqu'au bout du séjour.
    expect(issueDUneRencontre(false, fin, fin)).toBe("restee");
  });

  it("partie de sa Case avant la fin du séjour, elle est repartie à la fin de sa durée", () => {
    expect(issueDUneRencontre(false, avant, fin)).toBe("repartie");
  });

  it("sans départ connu, elle est restée", () => {
    expect(issueDUneRencontre(false, null, fin)).toBe("restee");
  });
});
