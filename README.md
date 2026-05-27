# OAD Arrachage — Simulateur de Priorités Parcellaires (Prototype)

## 📝 Présentation du projet
Ce dépôt héberge le Proof of Concept (POC) d'un Outil d'Aide à la Décision (OAD) cartographique destiné à simuler et hiérarchiser les priorités d'arrachage de parcelles viticoles. 

Développé en approche **Vibe Coding**, l'objectif de ce prototype est de valider l'ergonomie des interfaces, la cinématique d'ajustement des critères métier et la pertinence visuelle des indicateurs géographiques avant industrialisation.

## 🛠️ Architecture Technique Globale
Le prototype est volontairement conçu sans dépendances lourdes ni framework complexe (approche Vanilla Architecture) pour faciliter sa lecture par les équipes de la DSI :
* **`index.html`** : Structure de l'interface (Dashboard à trois colonnes : Filtres/Exploitations, Cartographie centrale, Panel d'analyse détaillé).
* **`app.js`** : Moteur de calcul des indices de priorité, gestion de l'état de l'application (`S`) et interactions avec la carte.
* **`data.js`** : Jeu de données de test (Mock). Contient 5 structures d'exploitations (Base A) et une collection GeoJSON de 12 parcelles localisées sur la commune de Cuis (51) (Base B).

## 🧮 Logique Métier & Algorithme de Calcul
L'indice de priorité global ($I$, noté de 0 à 100) d'une parcelle est calculé dynamiquement par la fonction `calcI()` via une moyenne pondérée de 5 sous-scores sectoriels :

1.  **Rapport de surface (`sc_prop`)** : Poids de la sous-parcelle par rapport à la surface totale de l'exploitation.
2.  **Taux de manquants (`sc_manq`)** : Impact direct de la perte de pieds de vigne.
3.  **Pression virale (`sc_viro`)** : Cumul cumulé des taux d'enroulement et de court-noué.
4.  **Productivité globale (`sc_prod`)** : Écart par rapport à un rendement de référence théorique (12 000 kg/ha).
5.  **État de la réserve individuelle (`sc_defr`)** : Évaluation du besoin de déblocage de la réserve d'exploitation.

Les coefficients de pondération par défaut sont modifiables en direct dans l'interface via l'objet d'état `S.pond` (`pp`, `pm`, `pv`, `ppr`, `pd`).

## ⚠️ Spécifications pour l'Industrialisation (Notes à destination de la DSI)
Ce POC valide l'approche fonctionnelle mais comporte des simplifications architecturales majeures à traiter lors du passage en production :

* **Gestion de la persistance (Saisie terrain) :** Les modifications utilisateur (ex: forçage du statut Flavescence Dorée ou ajustement des réserves) sont actuellement mémorisées via l'API `localStorage` du navigateur (`key: oad_cuis_v2`). La version de production devra implémenter des points de terminaison d'API (REST) connectés à une base de données relationnelle sécurisée.
* **Flux de données SIG :** La géométrie des parcelles est stockée sous forme de chaînes de caractères statiques. Pour le déploiement à l'échelle du vignoble, l'application devra s'interfacer avec le serveur cartographique de l'organisation via des flux dynamiques standardisés (WFS / Web Feature Service).
* **Confidentialité des données :** Les données d'exploitations intégrées à ce prototype sont purement fictives et générées à des fins de simulation ergonomique.

## 🚀 Déploiement local
Aucun environnement d'exécution (Node.js, Python, serveurs) n'est requis pour exécuter ce prototype. 
Ouvrir simplement le fichier `index.html` dans un navigateur moderne.