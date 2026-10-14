# Jalon 1 · Entrer dans le jeu

Le visiteur devient joueur : il crée son compte, se choisit un nom de chef, puis, après un court récit, naît sur la Couronne, dans son Foyer, toujours en prairie. Étapes couvertes : 5 à 9 de l'ordre d'attaque, sauf l'étape 8, retirée le 2026-10-05 (ADR 0008).

## Étape 5 · Créer un compte

### US-0101 · Trouver l'entrée du jeu sur la page d'accueil
**En tant que** visiteur, **je veux** voir sur la page d'accueil un bouton pour créer un compte et un autre pour me connecter, **afin de** comprendre tout de suite par où entrer dans le jeu.

- **Débloquée par** : Étape 2
- **Critères d'acceptation** :
  - La page d'accueil montre « Créer un compte » et « Se connecter », visibles sans défiler, sur ordinateur comme sur mobile.
  - « Créer un compte » mène au formulaire d'inscription, « Se connecter » au formulaire de connexion.
  - Une courte phrase présente le jeu : « Faites votre sac : l'aventure vous attend. »
  - En production, « Ouverture prochaine » tient la place des deux boutons jusqu'à ce qu'Antoine ouvre le jeu : il en décide seul, à la main, quand il le veut, sans attendre une story précise (décidé le 2026-10-05). Il faut seulement que les e-mails partent pour de vrai (The-Vibe-Company/bestiary#58), sans quoi un joueur ne pourrait ni confirmer son adresse ni changer de mot de passe.

### US-0102 · Ouvrir le formulaire d'inscription
**En tant que** visiteur, **je veux** un formulaire court qui ne demande que mon adresse e-mail et un mot de passe, **afin de** créer mon compte en moins d'une minute.

- **Débloquée par** : US-0101
- **Critères d'acceptation** :
  - Le formulaire demande l'adresse e-mail et le mot de passe, rien d'autre.
  - Sur mobile, le champ e-mail ouvre le clavier avec « @ », et le navigateur peut proposer un mot de passe fort.
  - Le bouton « Créer mon compte » est sous les champs, facile à toucher au pouce.
  - Un lien « J'ai déjà un compte » mène à la connexion.
  - Pas de case à cocher : quand les conditions d'utilisation existeront, une phrase sous le bouton y renverra (« En créant un compte, vous acceptez les conditions d'utilisation »).

### US-0103 · Vérifier le format de l'adresse e-mail
**En tant que** visiteur, **je veux** être prévenu tout de suite si mon adresse e-mail est mal écrite, **afin de** corriger avant d'envoyer le formulaire.

- **Débloquée par** : US-0102
- **Critères d'acceptation** :
  - Une adresse sans « @ » ou sans domaine (« nom@ », « nom.fr ») affiche « Cette adresse e-mail n'est pas valide » sous le champ.
  - Un champ vide affiche « Indiquez votre adresse e-mail ».
  - Le message apparaît quand on quitte le champ, pas à chaque lettre tapée.
  - Le jeu refait la même vérification à l'envoi, même si le navigateur a été contourné.

### US-0104 · Reconnaître une adresse écrite avec des majuscules
**En tant que** visiteur, **je veux** que mon adresse soit reconnue même tapée avec des majuscules ou des espaces autour, **afin de** ne jamais me retrouver avec deux comptes, ni bloqué à la connexion.

- **Statut** : Livrée le 2026-10-03 avant la création des comptes : la table des comptes existe, réduite à l'adresse, et la base refuse une adresse avec majuscules ou espaces, ou déjà utilisée. L'inscription (US-0107) et la connexion (US-0116) passeront par la même règle (normaliserEmail).
- **Débloquée par** : US-0103
- **Critères d'acceptation** :
  - Les espaces avant et après l'adresse sont retirés.
  - « Nom@Exemple.fr » et « nom@exemple.fr » désignent le même compte, à l'inscription comme à la connexion.
  - L'adresse est enregistrée en minuscules.

### US-0105 · Exiger un mot de passe assez long
**En tant que** visiteur, **je veux** connaître la règle du mot de passe avant de me tromper, **afin de** choisir du premier coup un mot de passe accepté.

- **Débloquée par** : US-0102
- **Critères d'acceptation** :
  - La règle est écrite sous le champ : au moins 12 caractères (MOT_DE_PASSE_MIN), sans exiger chiffre, majuscule ni symbole.
  - Un mot de passe trop court affiche « Le mot de passe doit contenir au moins N caractères » et bloque l'envoi.
  - Une longueur maximale de 128 caractères (MOT_DE_PASSE_MAX) évite les mots de passe démesurés.
  - Pas de liste des mots de passe courants pour l'instant : à 12 caractères, presque tous sont déjà trop courts.

### US-0106 · Afficher ou masquer le mot de passe
**En tant que** visiteur, **je veux** pouvoir afficher le mot de passe que je tape, **afin de** vérifier que je ne me suis pas trompé, surtout sur un clavier de téléphone.

- **Débloquée par** : US-0105
- **Critères d'acceptation** :
  - Le mot de passe est masqué par défaut.
  - Un bouton en forme d'œil l'affiche en clair ; un second appui le masque.
  - Le bouton est assez grand pour le pouce et se manie aussi au clavier.

### US-0107 · Créer le compte
**En tant que** visiteur, **je veux** que mon compte soit créé dès que le formulaire est valide, **afin de** pouvoir entrer dans le jeu.

- **Statut** : Livrée le 2026-10-03. Empreinte scrypt (réglages OWASP), sel par compte ; la base refuse tout ce qui n'est pas une empreinte. L'inscription reste fermée en production jusqu'à US-0116.
- **Débloquée par** : US-0104, US-0105
- **Critères d'acceptation** :
  - Un formulaire valide crée un compte avec l'adresse et le mot de passe.
  - Le mot de passe n'est jamais enregistré en clair : seule une empreinte est gardée, et il n'apparaît dans aucun journal.
  - La date de création du compte est enregistrée.

### US-0108 · Confirmer la création du compte
**En tant que** visiteur, **je veux** un message qui confirme que mon compte existe, **afin de** passer sereinement à la suite.

- **Statut** : Livrée le 2026-10-03, puis dépassée par US-0123 : le joueur est connecté dès la création, et la confirmation mène droit au jeu (« Entrer dans le jeu »). L'adresse retenue ne sert plus qu'au lien « Se connecter » d'une adresse déjà inscrite (US-0109).
- **Débloquée par** : US-0107
- **Critères d'acceptation** :
  - Après la création, le message « Votre compte est créé » s'affiche.
  - Le message propose d'aller à la connexion, avec l'adresse déjà remplie.
  - Le mot de passe n'est plus présent dans le formulaire.

### US-0109 · Refuser une adresse déjà utilisée
**En tant que** visiteur, **je veux** un message clair si mon adresse a déjà un compte, **afin de** me connecter au lieu de recommencer.

- **Débloquée par** : US-0107
- **Critères d'acceptation** :
  - Une adresse déjà inscrite, majuscules comprises, affiche « Cette adresse a déjà un compte » et rien n'est créé.
  - Le message propose un lien vers la connexion, avec l'adresse déjà remplie.
  - L'adresse reste dans le champ, le mot de passe est effacé.
  - Deux inscriptions avec la même adresse au même instant ne créent qu'un seul compte : la base l'interdit.

### US-0110 · Empêcher le double envoi du formulaire
**En tant que** visiteur, **je veux** que le bouton montre qu'il travaille et ne réagisse qu'une fois, **afin de** ne pas déclencher deux inscriptions par un double toucher.

- **Débloquée par** : US-0107
- **Critères d'acceptation** :
  - Pendant l'envoi, le bouton est désactivé et montre qu'il travaille.
  - Un double clic ou un double toucher n'envoie le formulaire qu'une fois.
  - En cas d'erreur, le bouton redevient actif.

### US-0111 · Garder ses saisies quand le jeu ne répond pas
**En tant que** visiteur, **je veux** un message compréhensible si le jeu ne répond pas pendant l'inscription, **afin de** réessayer sans tout retaper.

- **Débloquée par** : US-0107
- **Critères d'acceptation** :
  - Si le réseau coupe ou si le jeu ne répond pas, le message « Impossible de joindre Bestia, réessayez dans un instant » s'affiche.
  - L'adresse reste dans le champ.
  - Aucune erreur technique (code, détail interne) n'est montrée au visiteur.

### US-0112 · Freiner les inscriptions en rafale
**En tant que** joueur, **je veux** que la création de comptes en masse soit freinée, **afin de** partager le Monde avec de vrais chefs, sans noms ni Cases de la Couronne accaparés par des comptes factices.

- **Débloquée par** : US-0107
- **Critères d'acceptation** :
  - Au-delà de 5 comptes (INSCRIPTIONS_PAR_HEURE_MAX) créés depuis une même adresse réseau en une heure, les suivants sont refusés avec un message poli. L'adresse réseau n'est jamais gardée : seule son empreinte chiffrée, une heure.
  - Le refus n'explique pas comment le contourner.
  - Un champ piège invisible arrête les robots naïfs ; Vercel BotID viendra si des robots plus malins se montrent.

### US-0113 · Envoyer des e-mails depuis le jeu
**En tant que** développeur, **je veux** que le jeu puisse envoyer des e-mails, **afin de** permettre la confirmation d'adresse et la réinitialisation du mot de passe.

- **Statut** : Livrée le 2026-10-03 sans envoi réel : Resend n'est pas encore branché (offre payante ou compte existant à trancher, DNS chez Cloudflare), voir The-Vibe-Company/bestiary#58. D'ici là, les e-mails restent dans le journal, et en ligne leur échec est noté.
- **Débloquée par** : Étape 1
- **Critères d'acceptation** :
  - Le jeu envoie ses e-mails depuis une adresse d'expédition au nom de Bestia : « Bestia <bonjour@bestia.thevibecompany.co> ».
  - Le service d'envoi est Resend, par la place de marché Vercel ; sa clé est lue dans la variable RESEND_API_KEY.
  - En local, les e-mails s'affichent dans le journal au lieu de partir.
  - Un envoi raté est noté dans le journal, sans bloquer le joueur.

### US-0114 · Confirmer son adresse e-mail
**En tant que** nouveau joueur, **je veux** recevoir un lien pour confirmer mon adresse e-mail, **afin de** prouver qu'elle m'appartient et pouvoir récupérer mon compte plus tard.

- **Statut** : Livrée le 2026-10-03. Les e-mails ne partent pas encore pour de vrai (The-Vibe-Company/bestiary#58). Un lien déjà utilisé affiche « Adresse déjà confirmée » : un nouveau lien n'y servirait à rien. Le rappel de confirmer viendra avec les premiers écrans du jeu.
- **Débloquée par** : US-0107, US-0113
- **Critères d'acceptation** :
  - Juste après l'inscription, un e-mail part avec un lien de confirmation valable 24 heures (LIEN_CONFIRMATION_HEURES), à usage unique ; seule l'empreinte du jeton est gardée.
  - Ouvrir le lien marque l'adresse comme confirmée et affiche « Adresse confirmée ».
  - Un lien expiré ou déjà utilisé affiche un message et propose d'en recevoir un nouveau.
  - Confirmer son adresse est conseillé, pas obligatoire pour jouer : un rappel y invite. La récupération du compte ne l'exige pas non plus : le lien de réinitialisation part vers toute adresse qui a un compte, et l'ouvrir confirme l'adresse (US-0126, US-0128). On la rendra obligatoire si les faux comptes posent problème.

## Étape 6 · Se connecter et se déconnecter

### US-0115 · Ouvrir le formulaire de connexion
**En tant que** visiteur, **je veux** un formulaire de connexion simple, **afin de** retrouver mon compte en quelques secondes.

- **Débloquée par** : US-0101, US-0106
- **Critères d'acceptation** :
  - Le formulaire demande l'adresse e-mail et le mot de passe, avec le bouton pour afficher le mot de passe.
  - Le navigateur peut remplir les champs avec les identifiants qu'il a enregistrés.
  - Un lien « Créer un compte » mène à l'inscription.

### US-0116 · Se connecter
**En tant que** joueur, **je veux** me connecter avec mon adresse et mon mot de passe, **afin de** retrouver mon jeu là où je l'ai laissé.

- **Statut** : Livrée le 2026-10-03. La session tient dans un cookie httpOnly (__Host- en ligne), la base n'en garde que l'empreinte ; sa durée provisoire est de 30 jours (US-0119). La page du jeu est provisoire. L'entrée reste fermée en production.
- **Débloquée par** : US-0107, US-0115
- **Critères d'acceptation** :
  - Une adresse et un mot de passe justes ouvrent une session.
  - Le joueur arrive sur la page du jeu.
  - La date de dernière connexion est enregistrée.

### US-0117 · Refuser une connexion par un message unique
**En tant que** joueur, **je veux** un seul et même message quand l'adresse ou le mot de passe est faux, **afin de** ne donner aucun indice à qui tenterait de deviner mes identifiants.

- **Débloquée par** : US-0116
- **Critères d'acceptation** :
  - Une adresse inconnue et un mot de passe faux affichent le même message : « Adresse ou mot de passe incorrect ».
  - Le jeu met le même temps à répondre dans les deux cas.
  - L'adresse reste dans le champ, le mot de passe est effacé.

### US-0118 · Freiner les essais répétés de mot de passe
**En tant que** joueur, **je veux** que les essais de mot de passe à répétition soient bloqués un moment, **afin de** protéger mon compte contre qui essaierait tous les mots de passe.

- **Débloquée par** : US-0117
- **Critères d'acceptation** :
  - Après 5 échecs d'affilée (ECHECS_CONNEXION_MAX) sur une même adresse, les essais sont bloqués pendant 15 minutes (BLOCAGE_CONNEXION_MINUTES), même avec le bon mot de passe. L'adresse n'est gardée que sous son empreinte chiffrée.
  - Le message dit combien de temps attendre, et s'affiche aussi pour une adresse inconnue, pour ne rien révéler.
  - Une connexion réussie remet le décompte des échecs à zéro.

### US-0119 · Rester connecté d'une visite à l'autre
**En tant que** joueur, **je veux** rester connecté quand je ferme l'onglet et reviens plus tard, **afin de** jouer plusieurs fois par jour sans retaper mon mot de passe.

- **Débloquée par** : US-0116
- **Critères d'acceptation** :
  - Après la fermeture de l'onglet ou du navigateur, une nouvelle visite trouve le joueur toujours connecté.
  - La session dure 30 jours (SESSION_JOURS) et se prolonge à chaque visite d'une page du jeu, au plus une fois par jour.
  - Le cookie de session est inaccessible aux scripts de la page et ne circule qu'en HTTPS.

### US-0120 · Se déconnecter
**En tant que** joueur, **je veux** me déconnecter depuis la barre du haut, **afin de** quitter un appareil partagé sans y laisser mon compte ouvert.

- **Statut** : Livrée le 2026-10-03. Le bouton n'apparaît que sur les pages du jeu (/jeu…), qui exigent d'être connecté : la page d'accueil reste statique. Il tient dans la barre jusqu'à 320 px ; le menu viendra quand la barre se remplira.
- **Débloquée par** : US-0119, Étape 2
- **Critères d'acceptation** :
  - « Se déconnecter » est accessible depuis la barre du haut, sur ordinateur comme sur mobile (dans un menu si la place manque).
  - Après la déconnexion, le joueur revient à la page d'accueil.
  - La session est supprimée côté jeu, pas seulement effacée du navigateur.
  - Le bouton Précédent du navigateur ne réaffiche aucune page du jeu.

### US-0121 · Fermer les pages du jeu aux visiteurs
**En tant que** joueur, **je veux** que personne ne voie les pages de mon jeu sans être connecté à mon compte, **afin de** garder mon jeu pour moi seul.

- **Débloquée par** : US-0119
- **Critères d'acceptation** :
  - Un visiteur non connecté qui ouvre une page du jeu est envoyé vers la connexion.
  - Après la connexion, il arrive sur la page qu'il voulait ouvrir.
  - Aucune donnée du jeu n'est renvoyée à un visiteur non connecté, même par un appel direct.

### US-0122 · Renvoyer vers le jeu un joueur déjà connecté
**En tant que** joueur, **je veux** aller droit dans le jeu quand je suis déjà connecté, **afin de** ne pas repasser par des écrans inutiles.

- **Statut** : Livrée le 2026-10-03. Le renvoi se fait dans le proxy, à l'ouverture de la page seulement : un envoi de formulaire qui connecte le joueur (US-0123) affiche sa confirmation sur place. La page d'accueil, statique, lit un témoin de connexion sans secret.
- **Débloquée par** : US-0119
- **Critères d'acceptation** :
  - Un joueur connecté qui ouvre la page de connexion ou d'inscription est envoyé vers le jeu.
  - Sur la page d'accueil, un joueur connecté voit « Retourner au jeu » à la place des deux boutons d'entrée.

### US-0123 · Être connecté dès la création du compte
**En tant que** nouveau joueur, **je veux** être connecté dès que mon compte est créé, **afin de** commencer à jouer sans ressaisir mes identifiants.

- **Débloquée par** : US-0108, US-0119
- **Critères d'acceptation** :
  - Juste après la création, le joueur est connecté sans ressaisir son adresse ni son mot de passe.
  - Le message « Votre compte est créé » mène directement à la suite de l'entrée dans le jeu.
  - Cette session dure et se prolonge comme une connexion normale.

### US-0124 · Jouer sur ordinateur et sur mobile en même temps
**En tant que** joueur, **je veux** rester connecté à la fois sur mon ordinateur et sur mon téléphone, **afin de** passer de l'un à l'autre au fil de la journée.

- **Statut** : Livrée le 2026-10-03. Chaque appareil a sa propre session ; les pages du jeu partent en « private, no-cache, no-store » (vérifié sur une construction de production), donc jamais servies depuis un cache.
- **Débloquée par** : US-0120
- **Critères d'acceptation** :
  - Se connecter sur un deuxième appareil ne déconnecte pas le premier.
  - Se déconnecter sur un appareil laisse l'autre connecté.
  - Ce qui change sur un appareil apparaît sur l'autre au plus tard au prochain chargement de page.

### US-0125 · Retrouver sa page après une session expirée
**En tant que** joueur, **je veux** être prévenu clairement quand ma session a expiré, **afin de** me reconnecter et reprendre où j'en étais.

- **Débloquée par** : US-0121
- **Critères d'acceptation** :
  - Une action envoyée avec une session expirée n'est pas appliquée.
  - Le joueur voit « Votre session a expiré, reconnectez-vous » sur le formulaire de connexion.
  - Après la reconnexion, il revient sur la page où il était.

### US-0126 · Demander un lien de réinitialisation du mot de passe
**En tant que** joueur, **je veux** demander un lien pour changer mon mot de passe oublié, **afin de** retrouver l'accès à mon compte.

- **Statut** : Livrée le 2026-10-04. Le lien part vers toute adresse qui a un compte, confirmée ou non ; pas plus d'un par minute pour une même adresse. Durée provisoire : 60 minutes (US-0127). Les e-mails ne partent pas encore pour de vrai (The-Vibe-Company/bestiary#58).
- **Débloquée par** : US-0113, US-0117
- **Critères d'acceptation** :
  - Un lien « Mot de passe oublié » apparaît sous le formulaire de connexion et dans le message d'erreur de connexion.
  - Le joueur saisit son adresse ; le même message s'affiche que l'adresse ait un compte ou non : « Si un compte existe pour cette adresse, un e-mail vient de partir. »
  - Si le compte existe, un e-mail part avec un lien personnel.

### US-0127 · Recevoir un e-mail de réinitialisation clair
**En tant que** joueur, **je veux** un e-mail court avec un bouton pour changer mon mot de passe, **afin de** reconnaître tout de suite qu'il vient de Bestia.

- **Statut** : Livrée le 2026-10-04, épurée sur décision d'Antoine : le loup, « Mot de passe oublié ? » et le bouton, centrés, rien d'autre (ni phrase, ni durée, ni « ignorez si… », ni lien de secours). Le lien reste valable 60 minutes (LIEN_REINITIALISATION_MINUTES), sans que l'e-mail le dise.
- **Débloquée par** : US-0126
- **Critères d'acceptation** :
  - L'e-mail porte le nom Bestia (le loup) et contient un bouton « Changer mon mot de passe » vers le lien.
  - Le lien est valable 60 minutes.
  - Une version texte accompagne la mise en forme, pour les messageries qui ne l'affichent pas.
  - Il ne contient jamais de mot de passe.

### US-0128 · Choisir un nouveau mot de passe
**En tant que** joueur, **je veux** saisir un nouveau mot de passe depuis le lien reçu, **afin de** reprendre la main sur mon compte.

- **Statut** : Livrée le 2026-10-04. Ouvrir la page ne consomme pas le lien ; seul le changement le fait, tout ou rien. Un lien qui ne sert plus dit pourquoi (US-0129).
- **Débloquée par** : US-0105, US-0127
- **Critères d'acceptation** :
  - Le lien ouvre une page qui demande le nouveau mot de passe, avec les mêmes règles qu'à l'inscription.
  - Le nouveau mot de passe remplace l'ancien, qui ne fonctionne plus. Ouvrir le lien confirme aussi l'adresse e-mail (décidé avec US-0126).
  - Le joueur est ensuite connecté et arrive dans son jeu.
  - Les sessions déjà ouvertes sur d'autres appareils sont toutes fermées : si l'ancien mot de passe a été volé, qui s'en servait perd l'accès. Les autres liens de réinitialisation du compte sont annulés.

### US-0129 · Refuser un lien expiré ou déjà utilisé
**En tant que** joueur, **je veux** un message clair quand le lien de réinitialisation ne marche plus, **afin de** redemander un lien sans chercher pourquoi.

- **Statut** : Livrée le 2026-10-04. La page dit pourquoi le lien ne sert plus, à l'ouverture comme à l'envoi s'il expire entre-temps : « Ce lien a expiré » (avec « Recevoir un nouveau lien »), « Ce lien a déjà servi » (avec « Se connecter ») ou « Ce lien n'est pas valable » pour un lien inconnu.
- **Débloquée par** : US-0128
- **Critères d'acceptation** :
  - Un lien ouvert après 60 minutes affiche « Ce lien a expiré » et propose d'en demander un nouveau.
  - Un lien déjà utilisé ne sert pas une seconde fois.
  - Demander un nouveau lien rend les précédents inutilisables : ils sont considérés comme expirés.

### US-0130 · Freiner les demandes de lien répétées
**En tant que** joueur, **je veux** que personne ne puisse remplir ma boîte de réception de demandes de réinitialisation, **afin de** ne pas être importuné à cause de mon compte.

- **Statut** : Livrée le 2026-10-04. Le plafond s'ajoute à la règle d'un lien par minute ; il compte les liens des 60 dernières minutes. Des demandes simultanées passent l'une après l'autre : une rafale ne fait partir qu'un e-mail.
- **Débloquée par** : US-0126
- **Critères d'acceptation** :
  - Au-delà de 5 demandes par heure pour une même adresse, aucun nouvel e-mail ne part.
  - Le message affiché reste le même, pour ne rien révéler.

## Étape 7 · Choisir son nom de chef

### US-0131 · Demander le nom de chef à la première connexion
**En tant que** nouveau joueur, **je veux** qu'on me demande mon nom de chef dès ma première connexion, **afin de** porter un nom dans le Monde avant toute chose.

- **Statut** : Livrée le 2026-10-04. L'écran « Votre nom de chef » (`/jeu/nom-de-chef`) : le titre, le champ et « Valider », grisé jusqu'à US-0139. Un joueur qui a déjà son nom va droit au jeu.
- **Débloquée par** : US-0121, US-0123, Étape 3
- **Critères d'acceptation** :
  - Un compte sans nom de chef arrive sur l'écran « Votre nom de chef », quelle que soit la page demandée.
  - Aucune autre page du jeu n'est accessible avant d'avoir choisi un nom.

### US-0132 · Respecter la longueur du nom
**En tant que** nouveau joueur, **je veux** connaître la longueur permise pendant que je tape, **afin de** ne pas découvrir la règle au moment de valider.

- **Statut** : Livrée le 2026-10-04. Les caractères comptent tels qu'on les voit (« É » en vaut un), sans les espaces autour. Le compteur (« 5/16 ») paraît dès qu'on écrit ; le champ ne prend pas plus de 16 caractères, un collage trop long est coupé. « 3 caractères minimum » paraît quand on quitte le champ.
- **Débloquée par** : US-0131
- **Critères d'acceptation** :
  - Le nom compte entre 3 et 16 caractères.
  - Un compteur montre les caractères restants pendant la saisie.
  - Un nom trop court ou trop long affiche la règle sous le champ et bloque la validation.

### US-0133 · Limiter les caractères autorisés
**En tant que** nouveau joueur, **je veux** un message précis si mon nom contient un caractère refusé, **afin de** corriger sans deviner.

- **Statut** : Livrée le 2026-10-04. Le message paraît dès que le caractère est tapé et le nomme : « « @ » n'est pas autorisé », ou « Caractère invisible non autorisé ». L'apostrophe courbe des téléphones devient droite d'elle-même. La règle complète du nom (`verifierNomDeChef`) attend l'enregistrement (US-0139) pour être refaite par le serveur.
- **Débloquée par** : US-0131
- **Critères d'acceptation** :
  - Les lettres de l'alphabet latin, accents compris (é, ç, œ, ß, ș), sont acceptées ; pas les autres alphabets, dont les lettres imitent les nôtres (« О » cyrillique).
  - Les espaces, traits d'union, apostrophes et chiffres sont acceptés. Le nom commence par une lettre, et deux signes ne se suivent pas (« Loup--Gris », « L''Ourse »).
  - Les émojis, les caractères invisibles et les symboles sont refusés, avec un message qui nomme le caractère.
  - Le jeu refait la vérification à l'enregistrement.

### US-0134 · Nettoyer les espaces du nom
**En tant que** nouveau joueur, **je veux** que les espaces en trop soient retirés de mon nom, **afin de** ne pas porter par erreur un nom mal présenté.

- **Statut** : Livrée le 2026-10-05. Le champ montre le nom tel qu'il sera enregistré : un espace en tête ou un deuxième espace de suite ne s'écrivent pas, l'espace de fin disparaît quand on quitte le champ, et le curseur reste où l'on tape. Le serveur fera le même nettoyage (`nettoyerNom`) à l'enregistrement (US-0139).
- **Débloquée par** : US-0133
- **Critères d'acceptation** :
  - Les espaces au début et à la fin sont retirés avant l'enregistrement.
  - Plusieurs espaces de suite sont réduits à un seul.
  - Un nom fait uniquement d'espaces est refusé comme vide.

### US-0135 · Refuser un nom déjà pris dans le Monde
**En tant que** nouveau joueur, **je veux** apprendre que mon nom est déjà porté par un autre chef, **afin de** choisir un nom qui soit bien à moi.

- **Statut** : Livrée le 2026-10-05. La vérification part quand on quitte le champ, pour un nom par ailleurs correct. Chaque chef garde en base, à côté de son nom, sa forme de comparaison (minuscules, sans accents ni signes), unique dans le Monde : la base refuse deux noms jugés identiques.
- **Débloquée par** : US-0131
- **Critères d'acceptation** :
  - Un nom déjà porté dans le Monde est refusé avec « Ce nom est déjà pris ».
  - La comparaison ignore les majuscules : « Loup » et « loup » sont le même nom.
  - Elle ignore aussi les accents et les signes : « Élan » et « Elan », « Cœur » et « Coeur », « Ours Brun » et « Ours-Brun » sont le même nom.
  - Le nom s'affiche avec les majuscules choisies par le joueur.

### US-0136 · Voir si le nom est libre pendant la saisie
**En tant que** nouveau joueur, **je veux** voir si mon nom est libre avant de valider, **afin de** chercher un autre nom sans aller-retour.

- **Statut** : Livrée le 2026-10-05. La recherche part après une demi-seconde sans frappe (`NOM_DE_CHEF_PAUSE_MS`), ou tout de suite si l'on quitte le champ avant. Libre : une petite coche verte au bout du champ, annoncée « Disponible » aux lecteurs d'écran. Pris : « Ce nom est déjà pris » sous le champ. Un nom déjà cherché ne repart pas au serveur ; un nom refusé par une autre règle n'y part jamais.
- **Débloquée par** : US-0135
- **Critères d'acceptation** :
  - Quand le joueur s'arrête de taper, un signe indique « disponible » ou « déjà pris ».
  - La vérification ne part pas à chaque lettre tapée.
  - « Disponible » ne réserve pas le nom : la validation peut encore le refuser.

### US-0137 · Départager deux chefs qui veulent le même nom au même instant
**En tant que** nouveau joueur, **je veux** un message clair si quelqu'un a pris mon nom juste avant moi, **afin de** comprendre pourquoi il est refusé alors qu'il était libre.

- **Statut** : Livrée côté serveur le 2026-10-05. L'enregistrement (`enregistrerNomDeChef`) nettoie le nom, refait toutes les règles, puis laisse la base trancher : sur dix comptes qui enregistrent le même nom au même instant, un seul l'obtient. Un double appui du même joueur ne crée qu'un chef. Le message et la saisie conservée paraissent avec le bouton « Valider » (US-0139).
- **Débloquée par** : US-0135
- **Critères d'acceptation** :
  - Si deux joueurs valident le même nom au même instant, un seul l'obtient.
  - L'autre voit « Ce nom vient d'être pris » et reste sur l'écran du nom, sa saisie conservée.
  - La base garantit l'unicité du nom dans le Monde, pas seulement l'écran.

### US-0138 · Refuser les noms interdits
**En tant que** joueur, **je veux** que les noms injurieux ou trompeurs soient refusés, **afin de** partager le Monde avec des chefs aux noms corrects.

- **Statut** : Livrée le 2026-10-05. La liste vit en base (`mot_interdit`), remplie au départ par la migration 0021 : injures, termes sexuels et haineux courants en français et en anglais, et noms de l'équipe. Le refus paraît comme « déjà pris » : après la pause dans la frappe, ou en quittant le champ ; l'enregistrement refait la vérification.
- **Débloquée par** : US-0131
- **Critères d'acceptation** :
  - Un nom qui contient un mot interdit est refusé avec « Ce nom n'est pas autorisé », sans citer le mot.
  - Les noms qui se font passer pour l'équipe du jeu (« Bestia », « Admin », « Modérateur ») sont refusés ; « Bestia » l'est même à l'intérieur d'un nom.
  - La liste des mots interdits se modifie sans toucher au code.
  - Un mot long est refusé où qu'il soit (« Connard42 ») ; un mot court seulement seul (« Le Con », pas « Faucon »). Les contournements sont défaits : espaces et signes glissés, chiffres lus comme des lettres (0 → o, 1 → i ou l, 3 → e, 4 → a, 5 → s, 7 → t), lettres répétées (« Connnnard »).

### US-0139 · Valider son nom de chef
**En tant que** nouveau joueur, **je veux** valider mon nom une fois toutes les règles respectées, **afin de** passer à la suite de mon arrivée.

- **Statut** : Livrée le 2026-10-05. « Valider » s'active dès que le nom respecte les règles du champ, tant que le jeu ne l'a pas dit pris ou interdit ; pendant l'envoi, « Validation… ». L'étape du Couple de départ n'existant pas encore, le joueur arrive sur la page provisoire du jeu, qui l'accueille par son nom (« Bienvenue, Ourse »).
- **Débloquée par** : US-0132, US-0134, US-0136, US-0137, US-0138
- **Critères d'acceptation** :
  - Le bouton « Valider » n'est actif que si le nom respecte toutes les règles.
  - Le nom est enregistré pour ce compte et pour ce Monde.
  - Le joueur passe à l'étape suivante de l'entrée dans le jeu.
  - Un nom pris au moment de valider affiche « Ce nom vient d'être pris » si la coche « disponible » était affichée, sinon « Ce nom est déjà pris » ; le joueur reste sur l'écran, sa saisie conservée (US-0137).
  - Le nom est définitif : une ligne discrète sous le bouton le dit, « Ce nom ne pourra plus être changé », sans fenêtre de confirmation.

### US-0140 · Afficher le nom de chef dans la barre du haut
**En tant que** joueur, **je veux** voir mon nom de chef dans la barre du haut, **afin de** me sentir chez moi sur chaque page.

- **Statut** : Livrée le 2026-10-05. Le nom remplace « Se déconnecter » dans la pastille de droite, avec une petite flèche ; le menu montre le nom en entier en tête, puis « Se déconnecter ». Il se referme d'un clic ailleurs, avec Échap ou d'un nouveau clic, et se pilote au clavier. Tant que le joueur n'a pas de nom, « Se déconnecter » reste seul.
- **Débloquée par** : US-0120, US-0139
- **Critères d'acceptation** :
  - Le nom de chef s'affiche dans la barre du haut, sur toutes les pages du jeu.
  - Un nom long est coupé proprement sur mobile (points de suspension) et se lit en entier au survol ou au toucher.
  - Toucher ou cliquer le nom ouvre un menu qui contient « Se déconnecter ».

## Étape 8 · Choisir son Couple de départ

Étape retirée le 2026-10-05 : il n'y a plus de Couple de départ, les premières Bêtes, ce sont les explorateurs qui les ramènent (ADR 0008). Après son nom de chef, le joueur passe directement à l'étape 9. Les stories de l'étape sont abandonnées, et leurs numéros ne resservent pas :

- US-0141 · Présenter les trois cartes de Couple de départ : livrée le 2026-10-05, retirée le même jour.
- US-0142 · Lire le style de jeu de chaque Espèce.
- US-0143 · Voir le Rôle de la poule et du pigeon.
- US-0144 · Consulter les caractéristiques avant de choisir.
- US-0145 · Sélectionner une carte.
- US-0146 · Confirmer un choix définitif.
- US-0147 · Enregistrer le Couple de départ.
- US-0148 · Rendre le choix du Couple impossible à changer.
- US-0149 · Empêcher un double choix.
- US-0150 · Choisir son Couple sur mobile.

## Étape 9 · Naître sur la carte

### US-0151 · Préparer les Cases de la Couronne
**En tant que** développeur, **je veux** un premier ensemble de Cases de la Couronne en base, chacune avec son Biome, **afin de** faire naître des joueurs avant que le Monde entier soit généré (étape 18).

- **Statut** : Livrée le 2026-10-05. Le Monde est un disque d'hexagones de 60 anneaux autour du Cœur sauvage ; ses anneaux extérieurs forment la Couronne (3 au départ, 6 depuis US-0152, soit 2 070 Cases), toutes préparées d'un coup à la mise en ligne (`npm run monde:couronne`). Les Biomes y forment des régions d'un seul tenant, tirées de la graine du Monde ; la prairie en couvre environ 40 %. Une mini-carte de la Couronne est sur la page de contrôle.
- **Débloquée par** : Étape 3, Étape 4
- **Critères d'acceptation** :
  - La base contient des Cases hexagonales, chacune repérée de façon unique dans le Monde et marquée comme faisant partie de la Couronne.
  - Chaque Case a un Biome parmi ceux en base.
  - Toute la Couronne est préparée : les anneaux extérieurs d'un Monde de 60 anneaux (réglables ; le rayon est fixé sur le Monde, la Couronne ne peut que s'élargir vers l'intérieur).
  - La génération complète du Monde (étape 18) n'ajoutera que les Cases manquantes : une Case déjà en base ne change jamais de Biome ni de propriétaire.

### US-0152 · Définir les Cases où un Foyer peut naître
**En tant que** développeur, **je veux** une règle claire qui dit sur quelles Cases un Foyer peut naître, **afin de** donner à chaque nouveau joueur un départ qui se tient.

- **Statut** : Livrée le 2026-10-05. La règle (`peutAccueillirUnFoyer`) attend la naissance (US-0153). Pour loger plus de chefs, la Couronne passe de 3 à 6 anneaux : environ 90 Foyers dans Aube. Les Biomes sont calculés sur une bande fixe de 10 anneaux, si bien qu'élargir la Couronne ne change aucune Case. La page de contrôle marque d'un point les emplacements de Foyer possibles.
- **Débloquée par** : US-0151
- **Critères d'acceptation** :
  - Une Case déjà possédée n'est jamais proposée.
  - Une Case de mer, de lac ou de rivière n'accueille jamais de Foyer.
  - Deux Foyers sont séparés d'au moins 4 Cases.
  - Le Foyer naît toujours sur une Case de prairie : tous les départs se valent (ADR 0008).

### US-0153 · Recevoir une Case libre sur la Couronne
**En tant que** nouveau joueur, **je veux** recevoir une Case de la Couronne juste après avoir validé mon nom de chef, **afin de** commencer ma vie de chef quelque part dans le Monde.

- **Statut** : Livrée le 2026-10-05. Le chef et sa Case naissent ensemble, dans le même enregistrement que le nom, ou pas du tout ; les naissances d'un Monde passent l'une après l'autre. Monde plein : « Aube est complet ». La page de contrôle cercle les Cases possédées, avec le nom du chef au survol.
- **Débloquée par** : US-0139, US-0152
- **Critères d'acceptation** :
  - Juste après la validation du nom de chef, le jeu attribue au joueur une Case libre de la Couronne, sans lui demander de choisir.
  - La Case appartient désormais à ce joueur, et à lui seul.
  - Près des derniers arrivés : le nouveau chef naît au hasard parmi les 5 emplacements libres les plus proches du dernier chef né ; le tout premier d'un Monde, sur un emplacement tiré au hasard. Les voisins arrivent ainsi en même temps.

### US-0154 · Ne jamais donner la même Case à deux joueurs
**En tant que** nouveau joueur, **je veux** être sûr que ma Case n'est donnée qu'à moi, **afin de** ne jamais partager mon Foyer avec un inconnu.

- **Statut** : Livrée le 2026-10-05. Tenue par US-0153 : les naissances d'un Monde passent l'une après l'autre, et une Case n'a qu'un champ « chef ». Un test fait naître 30 chefs au même instant : 30 Cases différentes, toutes à 4 Cases au moins les unes des autres.
- **Débloquée par** : US-0153
- **Critères d'acceptation** :
  - Deux joueurs qui naissent au même instant reçoivent deux Cases différentes.
  - Un test qui fait naître un grand nombre de joueurs en parallèle ne trouve aucun doublon.
  - La base refuse qu'une Case ait deux propriétaires.

### US-0155 · Faire de sa Case son Foyer
**En tant que** nouveau joueur, **je veux** que ma Case devienne mon Foyer, avec la hutte du chef, **afin de** posséder un cœur de Territoire que personne ne pourra prendre.

- **Statut** : Livrée le 2026-10-05. Le Territoire est une fiche en base, liée à sa Case Foyer ; il naît avec le chef et sa Case, ou rien. La hutte du chef n'est pas encore une donnée : elle deviendra le premier bâtiment avec les constructions (jalon 6), et n'existe d'ici là qu'en image (US-0157). Un Territoire qui disparaît (compte supprimé) rend sa Case libre et prenable. La page de contrôle marque chaque Foyer.
- **Débloquée par** : US-0153
- **Critères d'acceptation** :
  - La Case reçue devient le Foyer du joueur, avec la hutte du chef.
  - Le Territoire du joueur existe et compte une seule Case : son Foyer.
  - Le Foyer est marqué comme imprenable (la règle jouera à l'étape 59).

### US-0156 · Faire démarrer le temps du Territoire à la naissance
**En tant que** développeur, **je veux** que le Territoire soit suivi par le mécanisme du temps dès sa naissance, **afin de** préparer la production et tout ce qui avancera ensuite.

- **Statut** : Livrée le 2026-10-05. Le Territoire est le deuxième élément suivi par le temps, après le Monde : son marque-page part de sa naissance, à l'heure du jeu, et la base refuse qu'il recule. Toute page ou action du jeu met d'abord le Territoire du joueur à l'heure ; la tâche planifiée rattrape ceux que personne n'a regardés depuis 5 minutes. Il n'y a encore rien à calculer : avancer, c'est déplacer le marque-page. La page de contrôle compte les Territoires suivis et le retard du plus en retard.
- **Débloquée par** : US-0155, Étape 3
- **Critères d'acceptation** :
  - Le Territoire porte un instant « calculé jusqu'à » égal à l'heure de sa naissance.
  - Le rattrapage à l'ouverture de page et la tâche planifiée le font avancer.
  - Un compte sans Foyer n'a rien à faire avancer.

### US-0157 · Voir l'illustration de son Foyer
**En tant que** nouveau joueur, **je veux** voir une belle illustration de mon Foyer et de la hutte du chef, **afin de** me sentir chez moi dès la première seconde.

- **Statut** : Livrée le 2026-10-06. La page du jeu (`/jeu`) devient l'écran du Foyer : la hutte du chef au petit matin, choisie parmi trois propositions générées dans le style des illustrations validées (`public/illustrations/foyer/prairie.webp`), et « Foyer · prairie » posé en bas de l'image. Plus d'accueil ni de phrase : le nom du chef est dans la barre du haut. Sur mobile, l'image est recadrée en hauteur autour de la hutte.
- **Débloquée par** : US-0155, Étape 2
- **Critères d'acceptation** :
  - L'écran du Foyer montre une grande illustration de la hutte du chef dans la prairie, dans la direction artistique du prototype.
  - Le Biome du Foyer est écrit près de l'illustration (« Foyer · prairie »).
  - Tous les Foyers naissant en prairie (US-0152), une seule illustration sert à tous.
  - L'illustration s'adapte à la largeur de l'écran.

### US-0158 · Lire le récit d'arrivée
**En tant que** nouveau joueur, **je veux** un court récit entre mon nom de chef et mon Foyer, **afin de** savoir où j'arrive avant d'y entrer.

- **Statut** : Livrée le 2026-10-06. Valider son nom mène à `/jeu/arrivee`, dans l'habillage des pages d'entrée, avec l'illustration du Monde en plateau. Le récit est noté comme lu quand le joueur appuie sur « Entrer dans mon Foyer » (et non dès l'affichage, ce qui le perdait quand Next calculait la page deux fois, corrigé avec US-0160) : y revenir ensuite mène droit au Foyer.
- **Débloquée par** : US-0157
- **Critères d'acceptation** :
  - À la première arrivée, juste après le nom de chef, un court récit dit en quelques lignes : le nom du chef, la prairie où naît son Foyer, la Couronne au bord du Monde.
  - Ni consigne ni explication du jeu : le récit et un bouton qui mène au Foyer, rien d'autre (README, « Textes à l'écran »).
  - Le récit ne s'affiche qu'une fois.
  - Le texte : le nom du chef en titre (« Ourse Brune. »), puis « Une prairie au bord du Monde, sur la Couronne d'Aube. C'est ici que naît votre Foyer. », et le bouton « Entrer dans mon Foyer ».

### US-0159 · Prévenir quand la Couronne est pleine
**En tant que** nouveau joueur, **je veux** un message clair s'il n'y a plus de place sur la Couronne, **afin de** ne pas rester devant une erreur incompréhensible.

- **Statut** : Livrée le 2026-10-06. Le nom et la Case naissent ensemble ou pas du tout (US-0153) : un Monde plein n'enregistre rien. Sous 10 places, chaque naissance écrit une alerte dans le journal de Vercel, et la page de contrôle affiche le nombre de places en couleur d'alerte. Une alerte par e-mail viendra avec l'envoi réel des e-mails (The-Vibe-Company/bestiary#58).
- **Débloquée par** : US-0153
- **Critères d'acceptation** :
  - S'il ne reste aucune Case où naître, la naissance n'a pas lieu et le joueur voit sous le champ du nom : « Aube est complet. Un nouveau Monde ouvre bientôt. »
  - Rien n'est enregistré : le joueur reviendra choisir son nom quand un autre Monde sera ouvert, sans jamais être un chef sans Foyer.
  - L'équipe est alertée quand il reste moins de 10 places de Foyer dans le Monde.
  - L'ouverture d'un autre Monde est une décision d'Antoine, et une story à part.

### US-0160 · Reprendre l'entrée dans le jeu là où on l'a laissée
**En tant que** nouveau joueur, **je veux** retrouver l'étape où je m'étais arrêté si je ferme l'onglet en plein milieu, **afin de** ne rien refaire ni rien perdre.

- **Statut** : Livrée le 2026-10-06. La garde du jeu reprend l'arrivée à la bonne étape sur toute page du jeu. Depuis US-0153, un nom sans Foyer n'arrive plus ; un chef né avant reçoit le sien à son retour, comme à une naissance ordinaire. Le récit passe avant toute page tant que le joueur n'est pas entré dans son Foyer.
- **Débloquée par** : US-0139, US-0158, US-0159
- **Critères d'acceptation** :
  - Sans nom de chef, le joueur revient sur le choix du nom.
  - Avec un nom mais sans Foyer, la naissance est retentée dès son arrivée.
  - Avec un Foyer mais sans avoir vu le récit d'arrivée, il le voit d'abord.
  - Ensuite, il arrive sur son Foyer.

### US-0161 · Arriver sur son Foyer à chaque visite
**En tant que** joueur, **je veux** arriver directement sur mon Foyer quand j'ouvre le jeu, **afin de** reprendre ma session en un geste.

- **Statut** : Livrée le 2026-10-06. Le Foyer a pour adresse `/jeu`. Un joueur connecté qui ouvre le site, ou touche le logo du loup, y est envoyé tout droit, comme après la connexion ; la garde du jeu fait passer avant les étapes d'arrivée qui manquent (US-0160).
- **Débloquée par** : US-0157, US-0160
- **Critères d'acceptation** :
  - Un joueur qui a son Foyer arrive dessus après la connexion et à chaque ouverture du jeu.
  - Pour un joueur connecté, le logo du loup ramène au Foyer.
  - Le Foyer a sa propre adresse, que l'on peut garder en favori ou ajouter à l'écran d'accueil du téléphone.

### US-0162 · Voir son Couple de départ depuis le Foyer
**En tant que** joueur, **je veux** retrouver mon Couple de départ sur l'écran du Foyer, **afin de** garder sous les yeux le choix qui marque mes débuts.

- **Statut** : Abandonnée le 2026-10-05 avec l'étape 8 : il n'y a plus de Couple de départ (ADR 0008).

### US-0163 · Garder un premier écran simple
**En tant que** nouveau joueur, **je veux** un premier écran qui ne montre que ce que j'ai déjà, **afin de** ne pas me perdre dans des menus vides.

- **Statut** : Livrée le 2026-10-06. L'écran était déjà dans cet état depuis US-0157 ; des tests le gardent ainsi : l'écran du Foyer n'a ni lien, ni bouton, ni menu, et le menu du chef ne propose que « Se déconnecter ». Décidé : pas de phrase à la place des blocs absents, l'écran se comprend sans elle (voir « Textes à l'écran » dans le [README](../../README.md)).
- **Débloquée par** : US-0157
- **Critères d'acceptation** :
  - Le Foyer ne montre que la barre du haut et l'illustration du Foyer.
  - Aucun menu, bouton ou bloc ne mène à une fonction qui n'existe pas encore.
  - Aucune phrase ne tient lieu des blocs encore absents.

### US-0164 · Voir son Foyer sur mobile
**En tant que** joueur, **je veux** un Foyer qui se lit bien sur mon téléphone, **afin de** jouer au pouce autant que sur ordinateur.

- **Statut** : Livrée le 2026-10-06. Essayé de 320×568 à 390×844 et couché (844×390) : rien ne défile de côté, le récit et son bouton de 52 px tiennent dans le plus petit écran, et le Foyer couché tient sous la barre sans défiler, recadré sur le toit de la hutte. Le nom du chef est un bouton de 44 px ; coupé s'il est long, il se lit en entier dans son menu. Ouvert depuis l'écran d'accueil d'un iPhone, le jeu passe sous l'heure et l'encoche : la barre du haut descend d'autant, son Encre derrière l'heure, et la page laisse libres les bords de l'écran. Décidé : sur un grand téléphone, l'illustration garde son format, et la place libre en dessous accueillera les blocs du jalon 2.
- **Débloquée par** : US-0158, US-0163
- **Critères d'acceptation** :
  - Sur mobile, le Foyer se lit de haut en bas sans zoom ni défilement de côté : barre du haut, puis illustration.
  - Le nom du chef reste visible ou accessible d'un toucher.
  - Le récit d'arrivée tient dans l'écran, et son bouton se touche au pouce.
