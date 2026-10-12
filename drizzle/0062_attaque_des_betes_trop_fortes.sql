-- US-0943 : l'instant du jeu où la Bête d'une Rencontre, trop forte pour l'escorte et restée sur sa Case, a attaqué
-- l'Expédition, au plus une fois par Bête et par Expédition (src/expeditions/attaque.ts) ; null tant qu'elle ne l'a pas
-- fait. Le combat (US-0944) la lira. Purement additive : aucune Bête n'a encore attaqué, et en production aucune n'est trop forte, toutes
-- les Espèces y étant communes.
ALTER TABLE "rencontre" ADD COLUMN "attaque_le" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rencontre" ADD CONSTRAINT "rencontre_attaque_de_la_bete_restee" CHECK ("rencontre"."attaque_le" is null or (not "rencontre"."apprivoisee" and "rencontre"."attaque_le" >= "rencontre"."vue_le"));
