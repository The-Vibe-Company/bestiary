-- US-0951 : combien des Bêtes de chaque Espèce de l'escorte perdues au combat ne sont que des Blessés
-- (src/expeditions/pertes.ts) : elles restent dans l'effectif et rentrent au Foyer avec l'Expédition. Purement additive :
-- les pertes déjà subies restent toutes des morts.
ALTER TABLE "expedition_escorte" ADD COLUMN "blessees" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "expedition_escorte" ADD CONSTRAINT "expedition_escorte_blessees_parmi_les_perdues" CHECK ("expedition_escorte"."blessees" between 0 and "expedition_escorte"."perdues");