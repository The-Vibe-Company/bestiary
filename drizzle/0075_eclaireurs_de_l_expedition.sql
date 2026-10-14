-- US-0976 : les Éclaireurs d'une Expédition, Espèce par Espèce : des Bêtes d'une Espèce Éclaireuse parties affectées à leur
-- Rôle, à côté de l'escorte, et combien sont des mâles (US-0960). Purement additive : aucune Expédition n'en a encore.
CREATE TABLE "expedition_eclaireur" (
	"expedition_id" integer NOT NULL,
	"espece_id" text NOT NULL,
	"nombre" integer NOT NULL,
	"males" integer,
	CONSTRAINT "expedition_eclaireur_expedition_id_espece_id_pk" PRIMARY KEY("expedition_id","espece_id"),
	CONSTRAINT "expedition_eclaireur_au_moins_un" CHECK ("expedition_eclaireur"."nombre" > 0),
	CONSTRAINT "expedition_eclaireur_males_parmi_eux" CHECK ("expedition_eclaireur"."males" between 0 and "expedition_eclaireur"."nombre")
);
--> statement-breakpoint
ALTER TABLE "expedition_eclaireur" ADD CONSTRAINT "expedition_eclaireur_expedition_id_expedition_id_fk" FOREIGN KEY ("expedition_id") REFERENCES "public"."expedition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expedition_eclaireur" ADD CONSTRAINT "expedition_eclaireur_espece_id_espece_id_fk" FOREIGN KEY ("espece_id") REFERENCES "public"."espece"("id") ON DELETE no action ON UPDATE no action;