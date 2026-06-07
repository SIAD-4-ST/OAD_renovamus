# OAD Renovamus — Simulateur de Priorités Parcellaires (Prototype)

## Présentation du projet

Ce dépôt héberge le POC d'un Outil d'Aide à la Décision (OAD) cartographique destiné à simuler et hiérarchiser les priorités d'arrachage de parcelles viticoles.

Développé en approche **Vibe Coding** (Microsoft 365 Copilot pour les règles métier ; Claude Code pour le développement du POC), l'objectif de ce prototype est de valider l'ergonomie des interfaces, les critères métier et la pertinence technique et visuelle des indicateurs et des simulations avant industrialisation.

---

## Architecture Technique

Le prototype est conçu sans dépendances lourdes ni framework (approche **Vanilla Architecture**) pour faciliter sa lecture par les équipes de la DSI.

### Fichiers principaux

| Fichier | Rôle |
|---|---|
| `index.html` | Structure de l'interface (dashboard 3 colonnes : Filtres / Carte / Panel) + modales Simulation et Plantation |
| `style.css` | Charte graphique Comité Champagne : thème clair (fond crème, encre marine), polices Archivo + IBM Plex Mono |
| `assets/logo-mark.png` | Logo institutionnel affiché dans l'en-tête |
| `data/data.js` | Données fictives inlinées : 9 exploitations, 23 parcelles sur 3 communes — expose `DATA_PARCELLES` (GeoJSON) et `DATA_EXPLOITATIONS` (tableau JSON) |
| `data/exploitations.json` | Export JSON autonome des exploitations (identique au contenu de `DATA_EXPLOITATIONS`) — utilisable hors navigateur |
| `data/parcelles.geojson` | Export GeoJSON autonome des parcelles (identique au contenu de `DATA_PARCELLES`) — utilisable dans un SIG |
| `js/config.js` | Constantes et référentiel des communes (`COMMUNES`, `LS_KEY`, `ANNEE`) |
| `js/state.js` | État global de l'application (`S`), pondérations, tri de la liste, saisies terrain (localStorage) |
| `js/coeur.js` | **Fonctions pures sans dépendance DOM** : `projeterReserve()`, `calcIndice()`, `dimensionnerPlantation()` — testables indépendamment de l'interface |
| `js/econ.js` | Bilan économique du renouvellement mono-parcelle : référentiel `REFERENTIEL_ECO` et `calculerBilanRenouvellement()` — dépend de `coeur.js` |
| `js/calcul.js` | Accesseurs et helpers sur les données parcellaires/exploitation : `getEx()`, `getRI()`, `pv()`, palette `iColor()` |
| `js/carte.js` | Rendu cartographique Leaflet, double fond Plan/Satellite commutable, coloration des polygones |
| `js/panel.js` | Liste triable (Indice, Surface, Âge, Manquants) et détail parcellaire ; gestion des modales Simulation et Plantation |
| `js/simulation.js` | Orchestration de la modale de simulation : appels à `projeterReserve()` et `calculerBilanRenouvellement()`, rendu graphique Canvas et tableaux |
| `js/plantation.js` | Configurateur de plantation : matériel végétal, densité, palissage, aménagements, couvert au repos, budget indicatif |
| `js/app.js` | Initialisation, sélection commune/exploitation, KPIs communes, bascule mode Vigneron/Technique, orchestration |
| `tests/invariants.html` | Harnais de tests navigateur : vérifie les invariants mathématiques de `coeur.js` et `econ.js` |

### Communes couvertes (données de démonstration)

| Commune | Dept | Appellation |
|---|---|---|
| Cuis | 51 | Côte des Blancs |
| Trélou-sur-Marne | 02 | Grande Vallée de la Marne |
| Arrentières | 10 | Côte des Bar |

---

## Logique Métier & Algorithme de Calcul

### Formule générale

L'indice de priorité global ($I$, noté de 0 à 100) est calculé par `calcIndice()` dans `js/coeur.js` via une **moyenne pondérée** de 5 sous-scores, chacun normalisé sur 0–100 :

$$I = \frac{\sum_{k} w_k \cdot s_k}{\sum_k w_k}$$

Les poids $w_k$ sont modifiables en temps réel dans l'interface. Valeurs par défaut : `1/2/3/2/2` (somme = 10).

### Les 5 sous-scores

| Score | Formule | Interprétation |
|---|---|---|
| `sc_prop` | `100 − min(1, surface_parcelle / surface_totale_exploitation) × 100` | **Emprise inversée** : 100 = parcelle négligeable dans l'exploitation, 0 = toute l'exploitation. Frein à l'arrachage des grandes parcelles dominantes. |
| `sc_manq` | `taux_manquant` (direct, déjà en %) | Pourcentage de pieds manquants |
| `sc_viro` | `(enroulement + court_noue) / 6 × 100` | Les deux virus sont côtés de 0 à 3 chacun → max combiné = 6 |
| `sc_prod` | `(12 000 − productivite_moyenne) / 12 000 × 100` | Score décroissant avec la productivité — priorise le renouvellement des parcelles les moins productives |
| `sc_defr` | `(10 000 − réserve) / 10 000 × 100` | Plus la réserve est faible, plus le score est élevé — normalisé sur le plafond réglementaire (10 000 kg/ha) |

### Seuils de lecture

| I | Couleur | Libellé |
|---|---|---|
| ≥ 70 | Rouge | Prioritaire |
| 50–69 | Orange | Élevé |
| 30–49 | Jaune | Modéré |
| < 30 | Vert | Faible |

### Overrides terrain

Tous les attributs entrant dans le calcul peuvent être **surchargés par la saisie terrain** : une valeur modifiée dans l'interface (réserve, manquants, etc.) est stockée dans `localStorage` et écrase la donnée source pour le calcul, sans modifier les données d'origine.

---

## Interface utilisateur

### Modes d'affichage : Vigneron / Technique

Deux modes sont disponibles via les boutons **Vign / Tech** dans la barre supérieure :

- **Vigneron** (défaut) : affichage simplifié centré sur les indicateurs de décision.
- **Technique** : affichage étendu exposant les sous-scores détaillés et les valeurs brutes (activé via `body.tech-mode`).

### Double fond cartographique (`js/carte.js`)

Deux fonds sont disponibles et commutables via les boutons **Plan / Satellite** superposés à la carte :

- **Plan** (défaut) : CartoCDN Voyager — fond clair avec toponymie, adapté à la lecture des contours parcellaires.
- **Satellite** : Esri World Imagery + étiquettes CartoCDN — fond imagerie pour le repérage terrain.

Le style des polygones s'adapte automatiquement au fond actif (opacité et couleur de contour).

### Liste et tri de la liste (`js/panel.js`)

Les parcelles de la commune/exploitation sélectionnée peuvent être triées selon quatre critères via le sélecteur **Trier** :

| Critère | Ordre |
|---|---|
| Indice | Décroissant (défaut) |
| Surface | Décroissante |
| Âge | Croissant (les plus vieilles d'abord) |
| Manquants | Décroissant |

Le tri courant est persisté dans l'état global (`S.sort`).

### KPIs commune (`js/app.js`)

Le bloc "Contexte commune" affiche trois indicateurs calculés à la sélection :

- Nombre de parcelles
- Surface totale (ha)
- **Âge moyen** des parcelles de la commune (calculé dynamiquement)

### Détail parcellaire et actions (`js/panel.js`)

Depuis le détail d'une parcelle, deux boutons CTA ouvrent les modules spécialisés en **modale overlay** :

- **Simuler la réserve individuelle** — projection RI sur 10 ans + bilan économique
- **Préparer la plantation** — configurateur de plantation

L'indice d'arrachage est représenté par une **jauge horizontale** avec un marqueur positionné sur l'échelle 0–100.

---

## Simulation réserve individuelle (`js/simulation.js` + `js/coeur.js`)

La simulation projette l'évolution du stock de réserve individuelle (RI) sur **10 ans** et restitue simultanément un **bilan économique** complet du renouvellement. Elle est accessible via la modale **"Simuler la réserve individuelle"** depuis le détail parcellaire, ou via le bouton **SIM** dans la liste.

La logique de calcul est portée par `coeur.js` (fonctions pures) ; `simulation.js` assure uniquement l'orchestration UI.

### Paramètres d'entrée

| Paramètre | Valeurs | Défaut |
|---|---|---|
| Type d'arrachage | Classique / Sanitaire | Classique |
| Mode de replantation | Standard / Anticipée | Standard |
| Volume commercialisé (`volco`) | kg/ha/an | 9 000 |
| Rendement replantation (`rend`) | kg/ha/an | 15 500 |

### Structure de la projection RI (boucle annuelle t = 0 → 10)

À chaque année $t$, `projeterReserve()` calcule pour l'exploitation :

**1. Surface productive `sp(t)`**

En mode standard, la surface diminue pendant la période de repos puis remonte progressivement :

| Période | Surface productive |
|---|---|
| $t \leq repos$ | `surf_totale − surf_arrachée` |
| $t = repos + 1$ | `surf_totale − surf_arrachée × 0,7` (1ère feuille) |
| $t = repos + 2$ | `surf_totale − surf_arrachée × 0,3` (2ème feuille) |
| $t \geq repos + 3$ | `surf_totale` (pleine production) |

En mode **anticipé**, la replantation est réalisée avant l'arrachage : `sp(t) = surf_totale` dès $t=0$.

La durée de repos est de **1 an** (arrachage classique) ou **3 ans** (arrachage sanitaire). La sortie de réserve est autorisée jusqu'à l'**an 3** (classique) ou l'**an 5** (sanitaire).

**2. Bilan annuel**

$$récolte = sp(t) \times rendement$$
$$volume\_commercialisé = sp(t) \times volco$$
$$excédent = récolte - volume\_commercialisé$$

**3. Mise en réserve**

Si $excédent > 0$, la mise en réserve est plafonnée pour ne pas dépasser 10 000 kg/ha :

$$mise = \min(excédent,\ 10\,000 \times surf\_totale - stock\_début)$$

**4. Sortie de réserve (S.Arr.)**

Pendant la période d'arrachage (en mode standard), les frais sont couverts par une sortie annuelle plafonnée à 9 000 kg × surface arrachée :

$$sortie = \min(9\,000 \times surf\_arrachée,\ stock\_après\_mise)$$

**5. Stock final**

$$stock_{t+1} = \max(0,\ stock\_après\_mise - sortie)$$

Le stock est ramené en **kg/ha** (`sha = stock / surf_totale`) pour être comparable entre exploitations.

### Indicateurs de synthèse RI

| KPI | Calcul |
|---|---|
| Stock minimum | $\min(sha_t)$ sur les 10 ans, avec l'année de survenance |
| Couverture des frais | Part des frais d'arrachage couverts par les sorties RI (calculé dynamiquement via le bilan économique) |
| Stock an 10 | `sha` à $t = 10$ |

Le taux de RI (`tx`) est exprimé en % du plafond réglementaire (10 000 kg/ha). Les seuils de coloration du tableau sont : < 4 000 kg/ha (rouge), 4 000–7 500 (orange), ≥ 7 500 (vert).

---

## Bilan économique du renouvellement (`js/econ.js`)

Affiché dans la même modale que la simulation RI, le bilan économique projette les **flux de trésorerie nets** sur 10 ans pour le renouvellement d'une parcelle. La logique est portée par `calculerBilanRenouvellement()` dans `econ.js`, qui dépend de `coeur.js`.

> **Note :** ce bilan est calculé en vue **mono-parcelle**. Ne pas sommer les bilans de plusieurs parcelles d'une même exploitation (double comptage de la réserve individuelle).

### Référentiel économique (`REFERENTIEL_ECO`)

| Paramètre | Valeur | Source / statut |
|---|---|---|
| Prix du raisin | 7,00 €/kg | Moyenne Champagne 2024 (6,2–7,45) — **recaler selon cru** |
| Coût arrachage | 3 500 €/ha | **Valeur indicative à confirmer** |
| Aide plantation | 5 600 €/ha | FranceAgriMer restructuration 2025–2026 |
| Aide palissage | 2 500 €/ha | FranceAgriMer restructuration 2025–2026 |
| Coefficient de réduction aides | 1,0 | 1,0 = enveloppe non saturée |
| Indemnité perte de recettes | 2 000 €/ha | **Valeur indicative à confirmer** — uniquement si replantation non anticipée |

### Flux calculés par année

| Flux | Description |
|---|---|
| Sorties RI (€) | Sorties de réserve converties au prix du raisin |
| Aides (€) | Aide plantation + aide palissage + indemnité perte de recettes (si applicable) |
| Coûts (€) | Arrachage (an 0) + couvert au repos + plantation (à l'année de replantation) |
| Manque à gagner (€) | Perte de recettes liée à la surface non productive, valorisée au prix du raisin |
| Net (€) | `Sorties RI + Aides − Coûts − Manque à gagner` |
| Cumul (€) | Flux nets cumulés depuis an 0 |

### Indicateurs de synthèse économique

| KPI | Description |
|---|---|
| Besoin de trésorerie max | Valeur absolue du cumul le plus négatif, et l'année où il survient |
| Couverture aides | Part des coûts de renouvellement couverts par les aides publiques |
| Reste à charge 10 ans | Cumul final négatif = investissement non encore amorti à l'horizon |

---

## Configurateur de plantation (`js/plantation.js` + `js/coeur.js`)

Accessible depuis le bouton **"Préparer la plantation"** dans le détail d'une parcelle. Les calculs métriques sont assurés par `dimensionnerPlantation()` dans `coeur.js`.

### Paramètres de configuration

| Groupe | Paramètres |
|---|---|
| Matériel végétal | Cépage, porte-greffe, type de plant (greffé-soudé / pot), origine clonale |
| Densité & écartement | Écartement inter-rang (1,00–1,50 m), écartement entre pieds (0,90–1,30 m) — contrainte AOC : rang + pied ≤ 2,50 m |
| Palissage | Type (simple / double / lyre), piquets (acacia / métal / composite), fils releveurs (1 ou 2 paires), hauteur (1,00–1,40 m) |
| Aménagements | Orientation des rangs, gestion de l'inter-rang, largeur de tournière (4–8 m) |
| Couverture au repos | Type de couvert (légumineuses, graminées, crucifères, mélange, jachère nue), durée de repos avant plantation (1–5 ans) |

### Synthèse calculée en direct

| Indicateur | Calcul |
|---|---|
| Densité (pieds/ha) | `10 000 / (rang × pied)` |
| Pieds à planter | `densité × surface_parcelle` |
| Plants à commander | `pieds × 1,05` (marge de 5 %) |
| Longueur de rang (ml) | `surface_m² / écartement_rang` |
| Piquets | `ml / 5 + nb_rangs` |
| Fil releveur (m) | `ml × (2 × paires + 1)` |

### Budget indicatif

Quatre postes sont estimés (hors aides et main-d'œuvre interne), restitués sous forme de fourchette (±12 %) :

- **Matériel végétal** : 1,80 €/plant (racines nues) ou 2,60 €/plant (pot)
- **Palissage** : coût au ml selon type de piquet (2,40–3,60 €/ml de base) × facteur palissage (×1 simple, ×1,2 double, ×1,4 lyre)
- **Couvert au repos** : coût à l'ha selon espèce × durée (40–300 €/ha/an)
- **Préparation & plantation** : forfait 3 800 €/ha

Un schéma de plantation (grille CSS paramétrique) illustre l'écartement saisi en temps réel.

---

## Tests (`tests/invariants.html`)

Un harnais de tests navigateur vérifie les **invariants mathématiques** des fonctions pures de `coeur.js` et `econ.js`. Il s'exécute entièrement côté client, sans serveur.

**Lancement** : ouvrir `tests/invariants.html` dans un navigateur. Chaque test s'affiche en vert (PASS) ou rouge (FAIL).

### Invariants couverts

| Module | Invariants vérifiés |
|---|---|
| `projeterReserve` | `sha ≥ 0` sur toutes les lignes ; stock ≤ plafond × surface ; conservation annuelle `fin = déb + mise − sins − sarr` (eps=3) ; `sarr = 0` si mode anticipé — 7 jeux de paramètres |
| `dimensionnerPlantation` | `densité > 0` ; `plantsACommander ≥ pieds` ; `budget.total = Σ postes` ; tous les postes ≥ 0 ; monotonicité densité / écartement — 5 jeux de paramètres |
| `calcIndice` | `I ∈ [0, 100]` ; chaque sous-score ∈ [0, 100] ; `I = 0` si toutes les pondérations sont nulles ; monotonicité manquants croissants → I non décroissant ; **monotonicité part croissante → I non croissant** — 7 jeux de paramètres |
| `calculerBilanRenouvellement` | `couvertureRI ≥ 0` ; `besoinTresorerieMax ≥ 0` ; `Σ net = cumul[horizon]` ; sorties RI nulles si anticipe ; indemnité nulle si anticipe — 5 jeux de paramètres |

---

## Spécifications pour l'Industrialisation (Notes DSI)

Ce POC valide l'approche fonctionnelle mais comporte des simplifications architecturales à traiter pour le passage en production :

* **Architecture modulaire :** Les fonctions pures de `coeur.js` et `econ.js` sont conçues pour être portées telles quelles en backend (Node.js / Python) ou intégrées dans un micro-service de calcul sans refactoring de la logique métier.
* **Persistance des saisies terrain :** Les modifications utilisateur (ajustement réserves, manquants, viroses) sont mémorisées via `localStorage` (`key: oad_v3`). La version de production devra implémenter des points de terminaison API (REST) connectés à une base de données relationnelle sécurisée.
* **Flux de données SIG :** Les géométries parcellaires sont statiques (fichier `data/data.js`). Pour un déploiement à l'échelle du vignoble, l'application devra s'interfacer avec le serveur cartographique de l'organisation via des flux WFS standardisés. Les fichiers `data/exploitations.json` et `data/parcelles.geojson` constituent des exports intermédiaires compatibles avec les outils SIG courants (QGIS, ArcGIS).
* **Référentiel économique :** Les valeurs de `REFERENTIEL_ECO` (coût arrachage, indemnité perte de recettes) sont des placeholders à sourcer et valider avec le Comité Champagne et FranceAgriMer avant tout usage opérationnel.
* **Données :** Les exploitations et parcelles intégrées à ce prototype sont purement fictives et générées à des fins de simulation ergonomique.

---

## Déploiement local

Aucun environnement d'exécution (Node.js, Python, serveur web) n'est requis.
Ouvrir simplement le fichier `index.html` dans un navigateur moderne.

Pour exécuter les tests : ouvrir `tests/invariants.html` dans le même navigateur.
