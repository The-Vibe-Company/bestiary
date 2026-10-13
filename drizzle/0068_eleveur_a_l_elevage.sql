-- US-0843 : sur chaque Habitant, l'Espèce que l'éleveur élève (null : libre), posée au lancement d'un Élevage (US-0815).
-- Purement additive : aucun Élevage ne se lance encore, tous les Habitants restent libres.
ALTER TABLE "habitant" ADD COLUMN "espece_elevee" text;--> statement-breakpoint
ALTER TABLE "habitant" ADD CONSTRAINT "habitant_espece_elevee_espece_id_fk" FOREIGN KEY ("espece_elevee") REFERENCES "public"."espece"("id") ON DELETE no action ON UPDATE no action;