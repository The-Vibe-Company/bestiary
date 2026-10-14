-- US-0815 : les Élevages lancés, chacun avec son Territoire, son Espèce, son éleveur (null s'il n'est plus là), le nombre
-- de Bêtes demandées, la durée d'Élevage d'une Bête et le coût payé, et l'heure du clic. Purement additive : aucun
-- Élevage n'existe encore.
CREATE TABLE "elevage" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "elevage_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"territoire_id" integer NOT NULL,
	"espece_id" text NOT NULL,
	"eleveur_id" integer,
	"quantite" integer NOT NULL,
	"duree_minutes" integer NOT NULL,
	"cout" bigint NOT NULL,
	"lance_le" timestamp with time zone NOT NULL,
	CONSTRAINT "elevage_au_moins_une_bete" CHECK ("elevage"."quantite" > 0),
	CONSTRAINT "elevage_duree_positive" CHECK ("elevage"."duree_minutes" > 0),
	CONSTRAINT "elevage_cout_positif" CHECK ("elevage"."cout" >= 0)
);
--> statement-breakpoint
ALTER TABLE "elevage" ADD CONSTRAINT "elevage_territoire_id_territoire_id_fk" FOREIGN KEY ("territoire_id") REFERENCES "public"."territoire"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elevage" ADD CONSTRAINT "elevage_espece_id_espece_id_fk" FOREIGN KEY ("espece_id") REFERENCES "public"."espece"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elevage" ADD CONSTRAINT "elevage_eleveur_id_habitant_id_fk" FOREIGN KEY ("eleveur_id") REFERENCES "public"."habitant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "elevage_par_territoire" ON "elevage" USING btree ("territoire_id");--> statement-breakpoint
CREATE INDEX "elevage_par_eleveur" ON "elevage" USING btree ("eleveur_id");