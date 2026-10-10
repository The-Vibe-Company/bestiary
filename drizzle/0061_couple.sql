-- US-0956 : le Couple réuni de chaque Espèce, un seul par Territoire : son mâle et sa femelle ont quitté l'effectif pour
-- la Réserve, à `reuni_le`, l'instant du jeu où l'effectif les a comptés tous deux au Foyer (src/monde/couple.ts). Le
-- retour d'une Expédition les réunit désormais. Les effectifs qui comptent déjà un mâle et une femelle au Foyer, arrivés
-- avant cette story, réunissent ici le leur, sous la même règle que le retour (plus de mâles, et plus de femelles, que de
-- Bêtes de l'Espèce sorties en escorte) : le mâle et la femelle passent de l'effectif à la Réserve, et l'Espèce au
-- « Couple réuni » du Bestiaire. Il est daté de l'arrivée au Foyer, avec une Expédition, du premier mâle ou de la
-- première femelle, la plus tardive des deux ; un sexe dont aucune arrivée n'est connue ne compte pas (greatest ignore
-- null), et sans aucune arrivée connue, du marque-page du Territoire. En production, toute Bête de l'effectif est arrivée
-- ainsi (US-0938). Rien ne s'efface, et rejouée, elle ne change rien : seules les Espèces sans Couple en reçoivent un.
CREATE TABLE "couple" (
	"territoire_id" integer NOT NULL,
	"espece_id" text NOT NULL,
	"reuni_le" timestamp with time zone NOT NULL,
	CONSTRAINT "couple_territoire_id_espece_id_pk" PRIMARY KEY("territoire_id","espece_id")
);
--> statement-breakpoint
ALTER TABLE "couple" ADD CONSTRAINT "couple_territoire_id_territoire_id_fk" FOREIGN KEY ("territoire_id") REFERENCES "public"."territoire"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "couple" ADD CONSTRAINT "couple_espece_id_espece_id_fk" FOREIGN KEY ("espece_id") REFERENCES "public"."espece"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
WITH "a_reunir" AS (
  SELECT e."territoire_id", e."espece_id"
  FROM "effectif" e
  WHERE NOT EXISTS (SELECT 1 FROM "couple" c WHERE c."territoire_id" = e."territoire_id" AND c."espece_id" = e."espece_id")
  GROUP BY e."territoire_id", e."espece_id"
  HAVING least(
      coalesce(sum(e."nombre") FILTER (WHERE e."sexe" = 'male'), 0),
      coalesce(sum(e."nombre") FILTER (WHERE e."sexe" = 'femelle'), 0)
    ) > (
      SELECT coalesce(sum(s."nombre"), 0) FROM "expedition_escorte" s JOIN "expedition" x ON x."id" = s."expedition_id"
      WHERE x."territoire_id" = e."territoire_id" AND s."espece_id" = e."espece_id" AND x."rentree_le" IS NULL
    )
),
"reunis" AS (
  INSERT INTO "couple" ("territoire_id", "espece_id", "reuni_le")
  SELECT a."territoire_id", a."espece_id", coalesce(greatest(
      (SELECT min(x."rentree_le") FROM "rencontre" r JOIN "expedition" x ON x."id" = r."expedition_id"
       WHERE x."territoire_id" = a."territoire_id" AND r."espece_id" = a."espece_id" AND r."sexe" = 'male' AND x."rentree_le" IS NOT NULL),
      (SELECT min(x."rentree_le") FROM "rencontre" r JOIN "expedition" x ON x."id" = r."expedition_id"
       WHERE x."territoire_id" = a."territoire_id" AND r."espece_id" = a."espece_id" AND r."sexe" = 'femelle' AND x."rentree_le" IS NOT NULL)
    ), t."calcule_jusqu_a")
  FROM "a_reunir" a JOIN "territoire" t ON t."id" = a."territoire_id"
  ON CONFLICT DO NOTHING
  RETURNING "territoire_id", "espece_id", "reuni_le"
),
"en_reserve" AS (
  UPDATE "effectif" e SET "nombre" = e."nombre" - 1
  FROM "reunis" r WHERE e."territoire_id" = r."territoire_id" AND e."espece_id" = r."espece_id"
)
INSERT INTO "bestiaire" ("territoire_id", "espece_id", "etat", "croisee_le")
SELECT "territoire_id", "espece_id", 'couple_reuni', "reuni_le" FROM "reunis"
ON CONFLICT ("territoire_id", "espece_id") DO UPDATE SET "etat" = excluded."etat" WHERE excluded."etat" > "bestiaire"."etat";
