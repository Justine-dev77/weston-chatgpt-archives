# Weston ChatGPT Archives

Petit lecteur local pour les exports ChatGPT de Weston Academy.

## Principe de confidentialité
Le site ne contient aucune conversation. L'import de `conversations.json` se fait dans le navigateur.
Les conversations retenues sont ensuite stockées dans le stockage local du navigateur de l'appareil.

## Sur PC
Le plus simple est de déposer ce dossier sur GitHub Pages (comme le lecteur Claude), puis d'ouvrir l'URL.
Cliquer sur **Importer un export** et sélectionner `conversations.json`.

## Sur iPhone / iPad
Ouvrir la même URL dans Safari.
Utiliser **Partager > Sur l'écran d'accueil** pour l'installer comme une app.
Importer soit le gros `conversations.json`, soit, de préférence, une sauvegarde Weston générée sur le PC via
**Exporter ma sauvegarde Weston** puis **Restaurer une sauvegarde** sur l'iPad.

## Filtrage Weston
L'import classe les conversations en :
- Weston détectées
- À vérifier
- Écartées

Le filtrage est basé sur les personnages, lieux et termes propres à l'univers. Il vaut mieux cocher
**Inclure les conversations à vérifier** lors du premier essai si des conversations ont des titres très vagues.

## Fonctions V1
- Recherche plein texte
- Favoris
- Dossiers / arcs personnalisés
- Masquer des conversations
- Masquer « Sans titre »
- Reprise automatique de lecture
- Surlignage simple par sélection
- Export / restauration d'une sauvegarde Weston
- Responsive PC / iPad / téléphone
- PWA installable depuis Safari/Chrome quand elle est hébergée en HTTPS

## Important
Le stockage local est propre à chaque navigateur/appareil. Pour synchroniser PC et iPad, exporter une sauvegarde
Weston sur l'un puis la restaurer sur l'autre.
