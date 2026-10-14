-- US-0960 : combien des Bêtes de chaque Espèce de l'escorte sont des mâles, les autres des femelles, retenu au départ
-- (src/expeditions/depart.ts) : leurs mortes au combat et leurs Blessés s'en tirent, et le Couple se forme dès qu'un mâle
-- et une femelle sont au Foyer. Purement additive : les escortes déjà parties gardent un sexe inconnu (null), compté
-- pour l'un et pour l'autre comme avant. Renumérotée 0074 après 0073 (US-0815).
ALTER TABLE "expedition_escorte" ADD COLUMN "males" integer;--> statement-breakpoint
ALTER TABLE "expedition_escorte" ADD CONSTRAINT "expedition_escorte_males_parmi_elles" CHECK ("expedition_escorte"."males" between 0 and "expedition_escorte"."nombre");