-- Trigger pour supprimer en cascade les données utilisateur
-- quand un utilisateur est supprimé depuis Neon Auth (app ou dashboard)

-- Fonction qui supprime les données utilisateur dans le schéma public
-- SECURITY DEFINER : exécute avec les permissions du propriétaire de la fonction
-- (nécessaire car Neon Auth n'a pas accès direct à notre schéma public)
CREATE OR REPLACE FUNCTION cascade_delete_user_data()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Supprimer l'utilisateur dans notre table Users
  -- (Villages et UserResources seront supprimés automatiquement via CASCADE)
  -- IF EXISTS évite les erreurs si l'utilisateur n'existe pas dans notre table
  DELETE FROM public."Users" WHERE id = OLD.id;
  RETURN OLD;
EXCEPTION
  WHEN OTHERS THEN
    -- Log l'erreur mais ne bloque pas la suppression dans neon_auth
    RAISE WARNING 'cascade_delete_user_data failed for user %: %', OLD.id, SQLERRM;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Supprimer le trigger s'il existe déjà (pour pouvoir le recréer proprement)
DROP TRIGGER IF EXISTS trigger_cascade_delete_user ON neon_auth.user;

-- Trigger qui s'exécute AVANT la suppression dans neon_auth.user
CREATE TRIGGER trigger_cascade_delete_user
BEFORE DELETE ON neon_auth.user
FOR EACH ROW
EXECUTE FUNCTION cascade_delete_user_data();
