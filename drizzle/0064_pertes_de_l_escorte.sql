-- US-0944 : combien des Bêtes de chaque Espèce de l'escorte d'une Expédition sont perdues au combat contre une Bête trop
-- forte (src/expeditions/pertes.ts) ; `nombre` reste celui du départ. Purement additive : aucune Expédition n'a encore
-- combattu, toutes ses lignes partent de zéro.
ALTER TABLE "expedition_escorte" ADD COLUMN "perdues" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "expedition_escorte" ADD CONSTRAINT "expedition_escorte_perdues_parmi_elles" CHECK ("expedition_escorte"."perdues" between 0 and "expedition_escorte"."nombre");