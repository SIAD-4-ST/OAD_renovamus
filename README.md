# OAD Arrachage — Simulateur de Priorités Parcellaires (Prototype)

## Présentation du projet
Ce dépôt héberge le POC d'un Outil d'Aide à la Décision (OAD) cartographique destiné à simuler et hiérarchiser les priorités d'arrachage de parcelles viticoles.

Développé en approche **Vibe Coding** (Microsoft 365 Copilot pour les règles métier; Claude Code pour le développement du POC), l'objectif de ce prototype est de valider l'ergonomie des interfaces, les critères métier et la pertinence technique et visuelle des indicateurs et des simulations avant industrialisation.

## Architecture Technique

Le prototype est conçu sans dépendances lourdes ni framework (approche Vanilla Architecture) pour faciliter sa lecture par les équipes de la DSI.

### Fichiers principaux

| Fichier | Rôle |
|---|---|
| `index.html` | Structure de l'interface (dashboard 3 colonnes : Filtres/Carte/Panel) |
| `style.css` | Styles de l'interface |
| `data/data.js` | Données fictives inlinées : 9 exploitations, 23 parcelles sur 3 communes |
| `js/config.js` | Constantes et référentiel des communes (COMMUNES, LS_KEY) |
| `js/state.js` | État global de l'application (`S`), pondérations, saisies terrain (localStorage) |
| `js/calcul.js` | Fonctions de calcul des indices de priorité (`calcI`, sous-scores) |
| `js/carte.js` | Rendu cartographique Leaflet, coloration des polygones |
| `js/panel.js` | Affichage de la liste et du détail parcellaire |
| `js/simulation.js` | Moteur de simulation arrachage/replantation |
| `js/app.js` | Initialisation, sélection commune/exploitation, orchestration |

### Communes couvertes (données de démonstration)

| Commune | Dept | Appellation | Foyer FD |
|---|---|---|---|
| Cuis | 51 | Côte des Blancs | Non |
| Trélou-sur-Marne | 02 | Grande Vallée de la Marne | Oui |
| Arrentières | 10 | Côte des Bar | Non |

## Logique Métier & Algorithme de Calcul

### Formule générale

L'indice de priorité global ($I$, noté de 0 à 100) est calculé par `calcI()` dans `js/calcul.js` via une **moyenne pondérée** de 5 sous-scores, chacun normalisé sur 0–100 :

$$I = \frac{\sum_{k} w_k \cdot s_k}{\sum_k w_k}$$

Les poids $w_k$ sont modifiables en temps réel dans l'interface. Valeurs par défaut : `1/2/3/2/2` (somme = 10).

### Les 5 sous-scores

| Score | Formule | Interprétation |
|---|---|---|
| `sc_prop` | `surface_parcelle / surface_totale_exploitation × 100` | Plus la parcelle est grande relativement à l'exploitation, plus elle pèse |
| `sc_manq` | `taux_manquant` (direct, déjà en %) | Pourcentage de pieds manquants |
| `sc_viro` | `(enroulement + court_noue) / 6 × 100` | Les deux virus sont côtés de 0 à 3 chacun → max combiné = 6 |
| `sc_prod` | `productivite_moyenne / 12 000 × 100` | Score croissant avec la productivité — voir note ci-dessous |
| `sc_defr` | `(10 000 − réserve) / réserve × 100` | Plus la réserve est faible, plus le score est élevé |

> **Note sur `sc_prod` :** le score augmente avec la productivité, ce qui hausse I pour les parcelles à fort rendement. Ce comportement est à valider avec le métier : si l'intention est de pénaliser les parcelles peu productives, la formule est correcte ; si l'on souhaite au contraire prioriser le renouvellement des parcelles dégradées, il faudrait inverser : `(12 000 − prod) / 12 000 × 100`.

### Cas spécial : Flavescence Dorée

Sur une commune avec foyer FD déclaré (`fd: true` dans `config.js`), un score de proximité est calculé :

$$sc_{fd} = \frac{1000 - distance\_foyer\_m}{1000} \times 100$$

Plus la parcelle est proche du foyer (en-deçà de 1 000 m), plus le score est élevé. Si la distance n'est pas renseignée, `sc_fd = 0`.

Le sous-score viroses effectif est alors remplacé par :

$$viroses\_eff = \frac{sc\_viro + sc\_fd}{2}$$

### Seuils de lecture

| I | Couleur | Libellé |
|---|---|---|
| ≥ 70 | Rouge | Prioritaire |
| 50–69 | Orange | Élevé |
| 30–49 | Jaune | Modéré |
| < 30 | Vert | Faible |

### Overrides terrain

Tous les attributs entrant dans le calcul peuvent être **surchargés par la saisie terrain** : une valeur modifiée dans l'interface (distance FD, réserve, etc.) est stockée dans `localStorage` et écrase la donnée source pour le calcul, sans modifier les données d'origine.

## Simulation réserve individuelle (`js/simulation.js`)

La simulation projette l'évolution du stock de réserve individuelle (RI) sur **10 ans** à partir du scénario d'arrachage sélectionné. Elle est déclenchée par `runSim()` depuis le panel parcellaire.

### Paramètres d'entrée

| Paramètre | Valeurs | Défaut |
|---|---|---|
| Type d'arrachage | Classique / Sanitaire | Classique |
| Mode de replantation | Standard / Anticipée | Standard |
| Volume commercialisé (`volco`) | kg/ha/an | 9 000 |
| Rendement replantation (`rend`) | kg/ha/an | 15 500 |

### Structure de la projection (boucle annuelle t = 0 → 10)

À chaque année $t$, le moteur calcule pour l'exploitation :

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

### Indicateurs de synthèse

| KPI | Calcul |
|---|---|
| Stock minimum | $\min(sha_t)$ sur les 10 ans, avec l'année de survenance |
| Couverture des frais | 98 % (sanitaire) ou 84 % (classique) — valeur fixe représentant la part des frais d'arrachage couverts par les sorties RI |
| Stock an 10 | `sha` à $t = 10$ |

Le taux de RI (`tx`) est exprimé en % du plafond réglementaire (10 000 kg/ha). Les seuils de coloration du tableau sont : < 4 000 kg/ha (rouge), 4 000–7 500 (orange), ≥ 7 500 (vert).

## Spécifications pour l'Industrialisation (Notes DSI)

Ce POC valide l'approche fonctionnelle mais comporte des simplifications architecturales à traiter pour le passage en production :

* **Persistance des saisies terrain :** Les modifications utilisateur (forçage FD, ajustement réserves) sont mémorisées via `localStorage` (`key: oad_v3`). La version de production devra implémenter des points de terminaison API (REST) connectés à une base de données relationnelle sécurisée.
* **Flux de données SIG :** Les géométries parcellaires sont statiques. Pour un déploiement à l'échelle du vignoble, l'application devra s'interfacer avec le serveur cartographique de l'organisation via des flux WFS standardisés.
* **Données :** Les exploitations et parcelles intégrées à ce prototype sont purement fictives et générées à des fins de simulation ergonomique.

## Déploiement local

Aucun environnement d'exécution (Node.js, Python, serveur web) n'est requis.
Ouvrir simplement le fichier `index.html` dans un navigateur moderne.
