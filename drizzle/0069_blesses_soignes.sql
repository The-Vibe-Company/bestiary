-- US-0955 : l'Expédition dont les Blessés sont soignés, un éleveur libre les attendant au Foyer à son retour : ils
-- guérissent plus vite (src/monde/guerison.ts). Purement additive : les Blessés déjà rentrés restent non soignés, false.
ALTER TABLE "expedition" ADD COLUMN "blesses_soignes" boolean DEFAULT false NOT NULL;
