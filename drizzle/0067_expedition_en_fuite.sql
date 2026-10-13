-- US-0945 : l'Expédition qui a fait demi-tour à l'instant d'une attaque, sa fuite après le combat, et non un rappel du
-- joueur (src/expeditions/fuite.ts) ; son demi-tour s'écrit dans rappelee_le. Purement additive : aucune Expédition n'a
-- encore fui, toutes partent de false.
ALTER TABLE "expedition" ADD COLUMN "en_fuite" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "expedition" ADD CONSTRAINT "expedition_en_fuite_a_fait_demi_tour" CHECK (not "expedition"."en_fuite" or "expedition"."rappelee_le" is not null);