-- US-0837 : les Bêtes d'un Territoire affectées au Rôle de leur Espèce, une ligne par Espèce. Purement additive :
-- aucune Bête n'est encore affectée.
CREATE TABLE "affectation" (
	"territoire_id" integer NOT NULL,
	"espece_id" text NOT NULL,
	"nombre" integer NOT NULL,
	CONSTRAINT "affectation_territoire_id_espece_id_pk" PRIMARY KEY("territoire_id","espece_id"),
	CONSTRAINT "affectation_jamais_negative" CHECK ("affectation"."nombre" >= 0)
);
--> statement-breakpoint
ALTER TABLE "affectation" ADD CONSTRAINT "affectation_territoire_id_territoire_id_fk" FOREIGN KEY ("territoire_id") REFERENCES "public"."territoire"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affectation" ADD CONSTRAINT "affectation_espece_id_espece_id_fk" FOREIGN KEY ("espece_id") REFERENCES "public"."espece"("id") ON DELETE no action ON UPDATE no action;