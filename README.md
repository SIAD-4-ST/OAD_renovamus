# OAD Renouvellement du vignoble — Parcours guidé

Simulateur pédagogique qui compare, sur une parcelle champenoise, **trois
trajectoires à 10 ans** : arrachage-replantation, complantation
(entreplants) et statu quo (ne rien faire). L'utilisateur avance dans un
**parcours guidé en 5 étapes** (Exploitation → Parcelle → Plantation →
Coûts → Résultats) ; à chaque étape, une synthèse chiffrée se met à jour
en continu dans la colonne de droite.

> Ce document explique, du premier coup d'œil à la dernière formule,
> **comment le fichier est construit, comment il tourne dans le
> navigateur, et comment chaque nombre affiché à l'écran est calculé** —
> de façon à ce qu'on puisse l'auditer, le faire évoluer ou le recaler
> sans avoir à deviner ni à relire tout le code.

---

## Sommaire

1. [Démarrage rapide](#1-démarrage-rapide)
2. [Architecture des 3 fichiers](#2-architecture-des-3-fichiers)
3. [Comment tourne la page — le format `.dc` / `x-dc`](#3-comment-tourne-la-page--le-format-dc--x-dc)
4. [Le parcours en 5 étapes](#4-le-parcours-en-5-étapes)
5. [Le flux de données, de la frappe au résultat](#5-le-flux-de-données-de-la-frappe-au-résultat)
6. [Glossaire des champs de saisie](#6-glossaire-des-champs-de-saisie)
7. [Le moteur kg — `simulerReserveKg`](#7-le-moteur-kg--simulerreservekg)
8. [Ce qui distingue les 3 scénarios](#8-ce-qui-distingue-les-3-scénarios)
9. [La couche € — `coucheEuro`](#9-la-couche--coucheeuro)
10. [Faire-valoir — `repartir`](#10-faire-valoir--repartir)
11. [Charges d'entretien récurrentes — `chargesEntretien`](#11-charges-dentretien-récurrentes--chargesentretien)
12. [Assemblage des scénarios — `construireScenarios`](#12-assemblage-des-scénarios--construirescenarios)
13. [Manque à gagner — `manqueAGagner`](#13-manque-à-gagner--manqueagagner)
14. [Palissage dérivé de la géométrie — `coutPalissage`](#14-palissage-dérivé-de-la-géométrie--coutpalissage)
15. [Arbre de décision porte-greffe — `preconPorteGreffe`](#15-arbre-de-décision-porte-greffe--preconportegreffe)
16. [Géométrie de plantation — `geometrie()`](#16-géométrie-de-plantation--geometrie)
17. [KPI et synthèse](#17-kpi-et-synthèse)
18. [Graphiques SVG faits main](#18-graphiques-svg-faits-main)
19. [Limites, hypothèses et paramètres cachés](#19-limites-hypothèses-et-paramètres-cachés)
20. [Pour aller plus loin](#20-pour-aller-plus-loin)

---

## 1. Démarrage rapide

Aucune installation, aucun build, aucune dépendance à gérer :

```
ouvrir index.html dans un navigateur (double-clic, ou un serveur local type
`python -m http.server`)
```

**Une connexion Internet est nécessaire au premier chargement** : la page
va chercher les polices (Google Fonts) et, surtout, `support.js` télécharge
lui-même **React, ReactDOM et Babel** depuis `unpkg.com` avant de pouvoir
afficher quoi que ce soit (voir [§3](#3-comment-tourne-la-page--le-format-dc--x-dc)).
Sans réseau, l'écran reste blanc.

Il n'y a actuellement **aucune suite de tests automatisés** dans le
dépôt (voir [§20](#20-pour-aller-plus-loin)) : toute modification du moteur
de calcul (`moteur-oad.js`) doit être vérifiée manuellement, en comparant
quelques cas connus avant/après.

## 2. Architecture des 3 fichiers

```
index.html     — la totalité de l'interface : structure visuelle (balisage
                 « x-dc », voir §3), tous les champs de saisie, ET la
                 logique d'orchestration (lecture des champs, appel au
                 moteur, mise en forme des résultats), regroupée dans un
                 unique <script type="text/x-dc" data-dc-script> en bas
                 de fichier. Il n'y a pas de fichier app.js séparé : cette
                 version fusionne « vue » et « contrôleur » dans le HTML.

moteur-oad.js  — pur, sans DOM, sans état : uniquement des fonctions de
                 calcul. Exposé via `window.OAD` (navigateur) et
                 `module.exports` (Node, si on veut l'utiliser dans des
                 scripts de test ou d'analyse). C'est la seule partie du
                 projet qui contient de la logique métier/financière.

support.js     — MOTEUR DE RENDU GÉNÉRIQUE, généré (bannière en tête de
                 fichier : « GENERATED from dc-runtime/src/*.ts — do not
                 edit »). Il ne contient aucune logique propre à ce
                 simulateur : c'est un composant technique réutilisable,
                 vendu tel quel, qui sait lire un fichier au format
                 « .dc.html » (balise <x-dc>, directives sc-for/sc-if,
                 interpolations {{ }}) et le transformer en application
                 React qui tourne dans la page. Ne pas modifier ce fichier
                 à la main.
```

**Fichiers de travail à connaître :** si vous devez changer une **formule
de calcul** (un rendement, un coût, une répartition), c'est dans
`moteur-oad.js`. Si vous devez changer un **champ, un libellé, une mise en
page, l'ordre des étapes**, c'est dans le template `<x-dc>` d'`index.html`
(§4 et §6). Si vous devez changer **ce que fait un bouton, comment un KPI
est calculé, quel texte s'affiche**, c'est dans le bloc
`<script data-dc-script>` d'`index.html` (§5, §17). Vous ne devriez jamais
avoir besoin de toucher `support.js`.

## 3. Comment tourne la page — le format `.dc` / `x-dc`

`index.html` n'est pas un fichier HTML « classique » : c'est le format de
travail d'un outil de design (celui qui a servi à produire cette
maquette), rendu directement jouable dans un navigateur grâce à
`support.js`. Trois ingrédients :

- **`<x-dc>…</x-dc>`** — délimite le *template* : du HTML enrichi de
  quelques directives.
  - `{{ expression }}` : interpolation. Affiche la valeur d'une propriété
    calculée par le composant (ex. `{{ investTxt }}`).
  - `<sc-if value="{{ condition }}">…</sc-if>` : affiche son contenu
    seulement si `condition` est vraie. Utilisé pour n'afficher qu'une
    seule étape à la fois (`estEtape0` … `estEtape4`, voir §4) ou les
    panneaux dépliables.
  - `<sc-for list="{{ tableau }}" as="x">…</sc-for>` : répète son contenu
    pour chaque élément de `tableau`, exposé sous le nom `x`. Utilisé pour
    la navigation latérale (`etapes`), les listes de KPI (`kpis`), les
    lignes de tableaux (`detailRows`, `magRows`…).
  - Les attributs `onClick="{{ fonction }}"`, `onInput="{{ on.xxx }}"` etc.
    branchent les événements DOM sur des fonctions exposées par le
    composant.
- **`<script type="text/x-dc" data-dc-script">`** — le code du composant,
  écrit comme une classe React (`class Component extends DCLogic`). C'est
  ici que vivent l'état (`this.state`), les gestionnaires d'événements, et
  la méthode `renderVals()` qui **recalcule tout** (géométrie, scénarios,
  KPI, textes, graphiques) à chaque rendu et renvoie un objet ordinaire —
  c'est cet objet qui alimente les `{{ }}` du template.
- **`support.js`** — au chargement de la page, il repère le bloc `<x-dc>`
  et le script `data-dc-script`, télécharge dynamiquement **React 18**,
  **ReactDOM** et **Babel standalone** depuis `unpkg.com` (Babel sert à
  transpiler le JS du composant à la volée, sans étape de build), compile
  le template en éléments React, instancie le composant, et l'attache au
  DOM. Ensuite, le fonctionnement est du React tout ce qu'il y a de plus
  normal : chaque `setState` déclenche un nouveau rendu, donc un nouvel
  appel à `renderVals()`, donc un recalcul complet du moteur — exactement
  comme l'ancienne version recalculait tout à chaque `input`/`change`,
  mais via le cycle de rendu React plutôt qu'un écouteur DOM manuel.

En résumé : **`index.html` + `support.js` ne sont pas un vrai/faux
HTML statique** — c'est une petite application React assemblée au vol
dans le navigateur, à partir d'un fichier unique. C'est ce qui permet de
livrer l'outil sous la forme d'un seul fichier ouvrable directement, sans
build ni serveur Node.

## 4. Le parcours en 5 étapes

La navigation de gauche (`etapes`, généré depuis un tableau de labels dans
`renderVals()`) et le bouton « {{ labelSuivant }} → » en bas de page
pilotent un simple index `state.step` (0 à 4). Une seule étape est visible
à la fois (`estEtape0`…`estEtape4`), mais **le calcul tourne sur
l'ensemble des champs déjà saisis à tout moment** — la colonne de droite
(« Synthèse en continu ») affiche donc des résultats mis à jour dès
l'étape 1, avec les valeurs par défaut pour tout ce qui n'a pas encore été
renseigné.

| # | Étape | Contenu |
|---|---|---|
| 1 | **Votre exploitation** | Surface totale, âge moyen du vignoble, VolCo, prix du raisin, réserve individuelle actuelle (curseur en % du plafond). Ce sont les repères globaux, dénominateurs de toute la comparaison. |
| 2 | **La parcelle que vous désignez** | Âge, taux de pieds manquants, rendement estimé, déclin en statu quo, régime de faire-valoir (propriété / fermage / métayage) et ses paramètres. |
| 3 | **Votre projet de replantation** | Géométrie (longueur, largeur, écarts) avec contrôle en direct du cahier des charges AOC ; matériel végétal et conduite (porte-greffe, irrigation, montée en charge) avec fiche conseil ; aide au choix du matériel végétal (dépliable, purement informative) ; dimensionnement du palissage dérivé de la géométrie. |
| 4 | **Coûts et charges** | Investissement ponctuel (arrachage, préparation, plant, palissage, irrigation, pénalité VSL), paramètres de la complantation (survie, entrée en production, coût par entreplant), charges d'entretien récurrentes (nulles par défaut). |
| 5 | **Résultats** | Synthèse rédigée, sélecteur de vue (Ensemble / Part exploitant / Part propriétaire) et de test de résistance climatique, 6 KPI, 3 graphiques (décomposition de l'effort, comparaison à 10 ans, stock de réserve), détail annuel dépliable, tableau du manque à gagner. |

La colonne de droite (`<aside>`, « Synthèse en continu ») est visible à
**toutes** les étapes : elle reprend un sous-ensemble des mêmes résultats
(surface, densité, pieds à planter, conformité AOC, investissement,
réserve mobilisée, effort net, tension de trésorerie, réserve minimale) et
propose un raccourci direct vers l'étape 5.

## 5. Le flux de données, de la frappe au résultat

```
Saisie utilisateur (input/select/range)
   │  onInput/onChange="{{ on.xxx }}"                    index.html (template)
   ▼
this.on[xxx](e)  →  setState({ v: { ...v, [xxx]: e.target.value } })   data-dc-script
   │
   ▼  React re-render  →  renderVals() ré-exécuté EN ENTIER
   │
   ├─ geometrie(v)                        → g   (densité, rangs, surface, conformité AOC)
   ├─ OAD.coutPalissage(g, …)             → cp  (préremplit coutPalissageHa si non édité)
   │
   ▼  construction de `inp` (l'objet attendu par le moteur)
inp = { geo, surfTot, surfParc:g.surf, ageMoy, ageParc, repos, nbSortie,
        volSortieArr, plafond, volco, rendMean, reserveInit, horizon, ramp,
        rendYearFn, rendFactorProjet, rendEstime, manquants, declinSQ,
        densite, coutArrachageHa, coutPrepaHa, coutPlant, coutPalissageHa,
        irrigation, coutIrrigHa, coutEntreplant, survie, entreeProd, prixKg,
        coutSurfaceHaAn, coutRdtParKg, coefRepos, fv:{regime,loyerAn,…} }
   │
   ▼  OAD.construireScenarios(inp)                        moteur-oad.js
sc = { arrachage:     { kg:[…11 lignes t=0..10], eur:[…], investissement },
       complantation: { kg:[…],                  eur:[…], investissement },
       statuquo:      { kg:[…],                  eur:[…], investissement:0 } }
   │
   ├─► cum(serieRep(sc.X))            → séries cumulées (trésorerie, selon la vue faire-valoir)
   ├─► OAD.manqueAGagner(...)         → tableau « manque à gagner »
   ├─► OAD.chargesEntretien(...)      → KPI « charges évitées en transition »
   └─► KPI directs (invest, reserveReelle, stockMin, ageApres…)
   │
   ▼  `out = { …tous les textes, couleurs, handlers, éléments <svg> React… }`
return out    // consommé par le template <x-dc> au prochain rendu
```

Chaque `row` d'une série `kg` (sortie de `simulerReserveKg`) porte, pour
une année `t` : `surfProd, rendY, recolte, volcoVendu, volcoCible, mise,
deficit, sortieInsuff, sortieArr, stockDebut, stockFin, stockHa`. Chaque
`row` de la série `eur` correspondante (sortie de `coucheEuro`) porte :
`venteRaisin, cashRI, couts, cashNet, cashSansRI`. Les deux tableaux sont
indexés au même `t` : `sc.arrachage.kg[i]` et `sc.arrachage.eur[i]`
décrivent la même année.

**Il n'y a pas de debounce** : chaque frappe déclenche un recalcul complet
des 3 scénarios sur 10 ans, plus tous les KPI et graphiques. Sur une
machine normale, c'est instantané ; ça n'a jamais posé de problème de
fluidité en pratique.

## 6. Glossaire des champs de saisie

Toutes les valeurs saisies vivent dans un seul objet, `state.v`, initialisé
avec ces valeurs par défaut (constructeur du composant, `index.html`) :

### Étape 1 — Votre exploitation

| champ (`v.xxx`) | unité | défaut | rôle |
|---|---|---|---|
| `surfTot` | ha | 1 | surface totale de l'exploitation — dénominateur de l'effet âge et des charges statu quo |
| `ageMoy` | ans | 38 | âge moyen du vignoble **avant** l'opération |
| `riPct` (curseur) | % | 75 | niveau actuel de réserve individuelle, en % du plafond 10 000 kg/ha → `reserveInit = 10000 × riPct/100` |
| `volco` | kg/ha | 9000 | volume commercialisable, fixé chaque année par le CIVC |
| `prixKg` | €/kg | 7 | prix unique du raisin (v1 : pas de distinction cépage/cru) |

### Étape 2 — La parcelle désignée

| champ | unité | défaut | rôle |
|---|---|---|---|
| `ageParc` | ans | 55 | âge de la parcelle candidate au renouvellement |
| `manquants` | % | 15 | taux de pieds manquants → dimensionne la complantation |
| `rendEstime` | kg/ha | 10500 | rendement actuel de la parcelle — sert au statu quo **et** à la complantation |
| `declinSQ` | %/an | 0 | déclin annuel de rendement si on ne touche à rien (statu quo) |
| `regime` | propriete\|fermage\|metayage | propriete | régime de faire-valoir, pilote la répartition des flux (§10) |
| `loyerHa` (si fermage) | €/ha/an | 3000 | loyer fermage → `fv.loyerAn = loyerHa × surfTot` |
| `partRecolte` (si métayage) | % | 33 | part de recettes au propriétaire |
| `partCouts` (si métayage) | % | 33 | part de coûts au propriétaire |

### Étape 3 — Projet de replantation

**Géométrie** (→ objet `g`, voir [§16](#16-géométrie-de-plantation--geometrie)) :

| champ | unité | défaut |
|---|---|---|
| `geoL` (longueur) | m | 200 |
| `geoW` (largeur) | m | 15 |
| `ecartRang` | m | 1.10 |
| `ecartPied` | m | 1.10 |

**Matériel & conduite :**

| champ | défaut | rôle |
|---|---|---|
| `materiel` | vinifera | vinifera / Voltis — badge d'information réglementaire seulement, n'entre pas dans le calcul |
| `porteGreffe` | 41 B | affichage pur, alimente la fiche conseil (`PG_INFO`), **hors calcul** |
| `irrigation` | '0' (non) | active `coutIrrigHa` dans l'investissement ; déclenche un badge « interdite en AOC » |
| `ramp` | `0.3,0.6,1` | montée en charge du rendement les 3 premières années après repos (§7) |

**Aide au choix du matériel végétal** (`cepage`, `calcaireActif`,
`profondeurSol`, `drainageSol`) : purement informatif, alimente
`OAD.preconPorteGreffe()` (§15), **hors calcul économique**.

**Dimensionnement du palissage** (`typeTaille`, `nbFils`, `espPiquet`) :
alimente `OAD.coutPalissage()` (§14), qui **préremplit** `coutPalissageHa`
tant que l'utilisateur ne l'a pas édité à la main (drapeau
`state.palisManuel`, remis à `false` par le bouton « ↻ Reprendre la valeur
dérivée de la géométrie »).

**Coûts (investissement ponctuel) :**

| champ | unité | défaut | utilisé pour |
|---|---|---|---|
| `motif` | classique\|sanitaire | classique | commute `repos`/`nbSortie` (§7) |
| `coutArrachageHa` | €/ha | 4500 | coût de l'arrachage, année 0 |
| `coutPrepaHa` | €/ha | 3500 | préparation du sol, année `repos` |
| `coutPlant` | €/pied | 1.8 | plant, année `repos` (× densité) |
| `coutPalissageHa` | €/ha | 12000 (prérempli) | palissage, année `repos` |
| `coutIrrigHa` | €/ha | 5000 | irrigation, année `repos`, si activée |
| `penaliteVSL` | % | 15 | pénalité de rendement si conduite semi-large (`ecartRang ≥ 1.5`) |
| `survie` | % | 50 | taux de survie des entreplants |
| `entreeProd` | années | 7 | début de montée en charge des entreplants |
| `coutEntreplant` | €/pied | 4.5 | coût des entreplants, année 0 |

### Étape 4 — Coûts et charges (suite) : charges d'entretien récurrentes

Modèle surface/rendement (§11), **nulles par défaut** pour préserver la
parité avec le classeur de référence tant qu'elles ne sont pas calées :

| champ | unité | défaut |
|---|---|---|
| `coutSurfaceHaAn` | €/ha/an | 0 |
| `coutRdtParKg` | €/kg | 0 |
| `coefRepos` | × surface | 0 |

### Étape 5 — Résultats

| champ | défaut | rôle |
|---|---|---|
| `sequence` (« Test de résistance ») | aucune | force une ou deux années à `12296,6 − 3440` kg/ha (écart-type régional), appliqué **à l'identique** aux 3 scénarios |
| `state.vueFV` | `'1'` (Ensemble) | bascule Ensemble / Part exploitant / Part propriétaire — traverse `OAD.repartir()` avant cumul (§10) |

## 7. Le moteur kg — `simulerReserveKg`

C'est la fonction centrale (`moteur-oad.js:8`). Elle simule, année par
année de `t=0` à `t=horizon` (10), le compte de réserve individuelle
(kg/ha) d'**un** scénario. Elle est appelée trois fois par
`construireScenarios` (une fois par scénario), avec des paramètres
différents.

Notations : `surfArr` = surface de la parcelle concernée (`surfParc`),
`surfRest = surfTot − surfArr` = le reste de l'exploitation (non concerné
par l'opération, produit toujours à `rendMean`), `fProjet =
rendFactorProjet` = pénalité de rendement du projet (VSL…).

**Étape 1 — rendement de l'année :**
```
rendY = rendYearFn(t)  si fourni (test de résistance, étape 5)
      = rendMean        sinon (12 296,6 kg/ha, moyenne régionale)
```

**Étape 2 — surface productive et récolte, selon le scénario :**

- **`arrachage`** — la parcelle sort totalement de production pendant le
  repos, puis revient progressivement :
  ```
  returnYear = 3 + repos                    // 4 (classique) ou 6 (sanitaire)
  jeune      = t ≥ returnYear
  f          = ramp[t − returnYear]  si jeune et dans la table ramp, sinon 1
  surfProd   = surfRest + (jeune ? surfArr : 0)
  recolte    = rendY·surfRest + (jeune ? rendY·f·fProjet·surfArr : 0)
  ```
  Le facteur projet (`fProjet`, pénalité VSL/matériel) ne s'applique **qu'au
  bloc replanté**, jamais au reste de l'exploitation.

- **`complantation` / `statuquo`** — la parcelle reste en production toute
  la période, mais avec un rendement propre `rendParcFn(t, rendY)` :
  ```
  surfProd = surfTot                                  // toujours plein
  recolte  = rendY·surfRest + rendParcFn(t, rendY)·surfArr
  ```

**Étape 3 — VolCo cible :**
```
volco = surfProd × p.volco     // le volume commercialisable est calculé sur la surface EN PRODUCTION
```

**Étape 4 — stock de début d'année :**
```
stockDebut = reserveInit × surfTot     si t = 0
           = stockFin de l'année t−1   sinon
```
`reserveInit` est assis sur `surfTot` (surface totale) pour les trois
scénarios.

**Étape 5 — mise en réserve** (le surplus récolté au-dessus du VolCo,
plafonné par la place disponible sous le plafond 10 000 kg/ha) :
```
mise = max(0, min(recolte − volco,
                   max(0, (plafond − stockDebut/surfProd) × surfProd)))
```

**Étape 6 — sortie « insuffisance »** (compense un déficit de récolte face
au VolCo, en puisant dans le stock — actif dans les 3 scénarios via
`optInsuff:true`) :
```
deficit      = max(0, volco − recolte)
sortieInsuff = min(deficit, stockDebut)
```

**Étape 7 — sortie « arrachage »** (sortie spécifique, réservée au
scénario `arrachage`, années 1 à `nbSortie`, plafonnée par ce qu'il reste
de stock après la sortie insuffisance) :
```
sortieArr = min(volSortieArr × surfArr, max(0, stockDebut − sortieInsuff))
            si scenario='arrachage' et 1 ≤ t ≤ nbSortie
          = 0  sinon
```
`volSortieArr = 9000 kg/ha` et `plafond = 10000 kg/ha` sont fixés en dur
dans `renderVals()` (non éditables dans l'UI — voir §19).
`nbSortie = 3` (motif classique) ou `5` (motif sanitaire).

**Étape 8 — stock de fin d'année et ratio à l'hectare :**
```
stockFin = max(0, stockDebut + mise − sortieInsuff − sortieArr)
stockHa  = stockFin / surfProd      (0 si surfProd = 0)
```

**Sortie**, une ligne par année : `{t, surfProd, rendY, recolte, volcoVendu:
min(recolte,volco)+sortieInsuff, volcoCible: volco, mise, deficit,
sortieInsuff, sortieArr, stockDebut, stockFin, stockHa}`.

## 8. Ce qui distingue les 3 scénarios

| | `arrachage` | `complantation` | `statuquo` |
|---|---|---|---|
| Surface productive | `surfRest`, puis `surfTot` après `returnYear` | toujours `surfTot` | toujours `surfTot` |
| Rendement de la parcelle | `rendMean·f·fProjet` une fois relancée | `rendParcCompl(t, rendY)` — monte de `rendEstime` vers un mix `rendEstime`/`rendMean` pondéré par `survie`, à partir de `entreeProd` | `rendParcSQ(t, rendY) = rendY·(rendEstime/rendMean)·(1−declinSQ)ᵗ` |
| Sortie de réserve « arrachage » | oui, années 1 à `nbSortie` | non | non |
| Investissement ponctuel | arrachage (t=0) + replantation (t=repos) | entreplants (t=0), ajustés du taux de survie | aucun |
| Repos / interruption | oui (`repos` années) | non | non |

`rendParcCompl` (`moteur-oad.js:134-138`) :
```
rendCible    = rendEstime + (rendMean − rendEstime)·survie
ratio        = rendEstime / rendMean
ratioCible   = rendCible / rendMean
prog(t)      = 0                              si t < entreeProd
             = min(1, (t − entreeProd + 1)/3)  sinon   // montée linéaire sur 3 ans
rendParcCompl(t, rendY) = rendY · (ratio + (ratioCible − ratio) · prog(t))
```

## 9. La couche € — `coucheEuro`

Transforme une série `kg` en série `€` (`moteur-oad.js:49`) :
```
venteRaisin = volcoVendu × prixKg
cashRI      = sortieArr × prixKg      // valorisation de la sortie de réserve « arrachage »
couts       = coutsParAnnee[t] || 0   // investissement ponctuel + charges d'entretien (§11)
cashNet     = venteRaisin + cashRI − couts
cashSansRI  = venteRaisin − couts     // pour visualiser ce que la réserve apporte
```

## 10. Faire-valoir — `repartir`

Répartit un flux `€` déjà calculé entre exploitant et propriétaire, **sans
changer le total** (`moteur-oad.js:67`) :
```
rev = venteRaisin + cashRI
propriete : exp = rev − couts                           , prop = 0
fermage   : exp = rev − couts − loyerAn                 , prop = loyerAn
metayage  : prop = a·rev − b·couts                       , exp = (1−a)·rev − (1−b)·couts
            avec a = partRecolte, b = partCouts
```
Utilisé dans `renderVals()` (fonction `serieRep`) pour les 3 boutons
**Ensemble / Part exploitant / Part propriétaire** de l'étape 5 : dans les
deux derniers cas, chaque point de la série trésorerie passe par
`OAD.repartir()` avant d'être cumulé.

## 11. Charges d'entretien récurrentes — `chargesEntretien`

Sans elles, **ne rien faire n'a aucun coût** dans le modèle, ce qui biaise
systématiquement la comparaison en faveur du statu quo. Modèle en deux
composantes (`moteur-oad.js:92`), neutre par défaut (`coutSurfaceHaAn =
coutRdtParKg = 0`) :

- **Charge de surface** (`coutSurfaceHaAn`, €/ha/an) : sol, palissage,
  entretien hors récolte. Persiste tant que la surface est gérée — **y
  compris la jeune vigne en établissement**.
- **Charge de rendement** (`coutRdtParKg`, €/kg) : vendange, transport,
  prestations. Proportionnelle aux kg réellement récoltés → s'annule
  d'elle-même en repos et en établissement puisque `recolte` exclut déjà
  la parcelle non productive.

```
surfRest = surfTot − surfParc,  S = surfParc

scénario 'arrachage' :
  coefParc  = coefRepos  si t < repos   (jachère : charge de surface réduite)
            = 1           sinon          (jeune vigne : charge de surface pleine)
  surfGeree = surfRest + coefParc·S

scénarios 'statuquo' / 'complantation' :
  surfGeree = surfTot                    // parcelle toujours gérée en plein

charge(t) = coutSurfaceHaAn·surfGeree + coutRdtParKg·recolte(t)
```
Branchée **par scénario** : le différentiel entre statu quo et arrachage
pendant la transition capte « ce que l'arrachage évite » (la vendange de
la parcelle, pas sa charge de surface) — c'est le KPI « Charges évitées en
transition » de l'étape 5 (affiché seulement si au moins une des deux
charges est non nulle), purement dérivé et jamais réinjecté dans le calcul.

## 12. Assemblage des scénarios — `construireScenarios`

Point d'entrée principal du moteur (`moteur-oad.js:111`), appelé une fois
par rendu (`renderVals()`). Construit les paramètres communs (`base`),
calcule les trois séries `kg`, puis les coûts ponctuels + récurrents, puis
la couche `€`.

**Investissement ponctuel arrachage** (`invArr`, indexé par année) :
```
invArr[0]     = surfParc × coutArrachageHa                                    // année de l'arrachage
invArr[repos] += surfParc × (coutPrepaHa + densite·coutPlant + coutPalissageHa
                              + (irrigation ? coutIrrigHa : 0))                // replantation
```

**Investissement ponctuel complantation** (`invCompl`) :
```
nbPlants     = surfParc × densite × manquants     // pieds manquants à combler
invCompl[0]  = nbPlants × coutEntreplant / survie  // coût pondéré du taux de survie
```

**Coûts totaux par année, par scénario** (fusion investissement +
entretien §11) :
```
coutsArr  = invArr   ⊕ chargesEntretien('arrachage', scArr, inp)
coutsComp = invCompl ⊕ chargesEntretien('complantation', scCompl, inp)
coutsSQ   = {}       ⊕ chargesEntretien('statuquo', scSQ, inp)
```
(`⊕` = fusion additive année par année.)

**Sortie :**
```
{ arrachage:     { kg, eur, investissement: Σ invArr  },   // hors entretien
  complantation: { kg, eur, investissement: Σ invCompl},
  statuquo:      { kg, eur, investissement: 0          } }
```
`investissement` est volontairement **hors charges d'entretien** : c'est
la base du KPI « Effort net après réserve » (§17), qui répond à « combien
dois-je financer pour l'opération elle-même », indépendamment de charges
d'exploitation récurrentes qui existeraient de toute façon.

## 13. Manque à gagner — `manqueAGagner`

Indicateur **dérivé**, jamais réinjecté dans le calcul (tableau dépliable
« Manque à gagner », étape 5) :
```
manqueAGagner(scen, refSQ, prixKg)[t] = max(0, (refSQ.kg[t].volcoVendu − scen.kg[t].volcoVendu) × prixKg)
```
Mesure la perte de vente (jamais négative) par rapport au statu quo,
causée par une parcelle temporairement hors production ou en montée en
charge.

## 14. Palissage dérivé de la géométrie — `coutPalissage`

`coutPalissage(geo, prix, opt)` (`moteur-oad.js:185`) dérive un coût de
palissage à l'hectare à partir de la géométrie de plantation, sur la base
des prix unitaires du classeur **LutEnVi 2025** (feuille « Coût hectare
d'installation »). Il **préremplit** `coutPalissageHa` (champ éditable)
tant que l'utilisateur ne l'a pas modifié à la main.

```
espacement  = espPiquet ?? 6 m                              // choix éditable — repère LutEnVi ≈ 4,3 m
nbFils      = nbFils ?? FILS_PAR_TAILLE[typeTaille] ?? 4     // guyot/cordon/arcure simple = 4, arcure double = 5

interParRang = max(0, round(Lrang/espacement) − 1)
nbInter      = nbRangs × interParRang         // piquets intermédiaires
nbTete       = 2 × nbRangs                    // piquets de tête
nbAmarre     = 2 × nbRangs
mlFils       = nbFils × nbRangs × Lrang       // mètres linéaires de fil, tous fils confondus
nbGripple    = nbFils × nbRangs
nbPiquets    = nbInter + nbTete

totalParcelle = Σ (quantité × prix unitaire) sur les 6 lignes
totalHa       = totalParcelle / surf
```

**Prix unitaires** (`PRIX_PALISSAGE_LUTENVI`, `moteur-oad.js:172`) :

| poste | prix | source |
|---|---|---|
| piquet intermédiaire | 3,99 €/piquet | LutEnVi 2025 |
| piquet de tête | 6,00 €/piquet | LutEnVi 2025 |
| amarre | 2,64 €/amarre | LutEnVi 2025 |
| fil (par fil, au mètre linéaire) | 0,132 €/m | LutEnVi (0,528 €/m pour 4 fils groupés ÷ 4) |
| gripple | 1,826 €/gripple | LutEnVi 2025 |
| MO pose piquet | 1,318 €/piquet posé | dérivé LutEnVi (2 864,56 €/ha ÷ 2 174 piquets/ha) |

⚠ Avec l'espacement par défaut (6 m), le nombre de piquets intermédiaires
est **~30 % plus faible** que le repère implicite LutEnVi (~1 piquet tous
les 4 pieds, soit ≈ 4,3 m) — divergence assumée et affichée dans l'UI.

## 15. Arbre de décision porte-greffe — `preconPorteGreffe`

**Information pure, hors calcul économique.** Reproduction fidèle de
l'arbre du Guide pratique Viticulture durable en Champagne 2025 (p. 39).

```
bandeCalcaire(pct) : >25 % → '>25' ; 15-25 % → '15-25' ; 5-15 % → '5-15' ; <5 % → hors grille

preconPorteGreffe(calcaire, profondeur, drainage) :
  1. cherche une ligne exacte de ARBRE_PG (bande, profondeur, drainage)
  2. sinon, regroupe toutes les lignes (bande, profondeur) quel que soit le
     drainage → match "approche" (le guide ne distingue pas ce cas)
  3. sinon → "hors-grille"
```
`ARBRE_PG` est une table de 17 branches (`moteur-oad.js:225`) reproduisant
les combinaisons calcaire × profondeur × drainage du guide, avec les
porte-greffes envisageables et des renvois d'avertissement (ex. `161-49 C`
: dépérissements signalés depuis 2008, déconseillé). Alimente les blocs
« Porte-greffes envisageables » et la fiche `PG_INFO` (statique, dans le
composant) de l'étape 3 ; **n'entre jamais dans `inp`**.

## 16. Géométrie de plantation — `geometrie()`

Calculée côté composant (méthode `geometrie(v)`, `index.html:642`), à
partir de `geoL`, `geoW`, `ecartRang`, `ecartPied` :
```
densite  = round(10000 / (eR × eP))              // pieds/ha
nbRangs  = max(1, floor(W / eR))
piedsRang= max(1, floor(L / eP))
surf     = round(L × W / 10000, 4)                // ha, 4 décimales
pieds    = nbRangs × piedsRang
vsl      = eR ≥ 1.5                                // conduite semi-large si rangs larges
aoc.rang   = eR ≤ 2.00
aoc.pied   = 0.70 ≤ eP ≤ 1.50
aoc.somme  = eR + eP ≤ 3.00
```
`surf` devient `inp.surfParc` — **c'est la géométrie qui pilote la surface
de la parcelle**, pas un champ de saisie direct. `vsl` déclenche la
pénalité de rendement (`penaliteVSL`) et le conseil de diamètre de fil
porteur. `aoc.*` alimente le bandeau de conformité au cahier des charges
homologué le 31/07/2025 (rang ≤ 2,00 m, pied 0,70–1,50 m, somme ≤ 3,00 m).

## 17. KPI et synthèse

Tous calculés dans `renderVals()` (`index.html:765`), après
`OAD.construireScenarios(inp)` :

| KPI | formule | groupe |
|---|---|---|
| Investissement brut | `invest = sc.arrachage.investissement` | Financement |
| Amortisseur de réserve | `reserveReelle = Σ sc.arrachage.eur[t].cashRI` | Financement |
| — dont % de couverture | `couv = reserveReelle / invest` | Financement |
| — théorique | `reserveTheo = volSortieArr × surfParc × nbSortie × prixKg` | Financement |
| Effort net après réserve | `effortNet = max(0, invest − reserveReelle)` | Financement |
| Charges évitées en transition | `Σ_{t=0}^{returnYear−1} max(0, chSQ[t] − chArr[t])`, avec `returnYear = 3+repos` — affiché seulement si `coutSurfaceHaAn>0 \|\| coutRdtParKg>0` | Exploitation |
| Tension maximale de trésorerie | `creux = min_t (arr_cum[t] − sq_cum[t])`, où `arr_cum`/`sq_cum` sont les séries cumulées selon la vue faire-valoir active | Risque |
| Réserve minimale en transition | `stockMin = min_t sc.arrachage.kg[t].stockHa`, alerte si `< 4000` kg/ha (`seuilReserve`) | Risque |
| Effet technique du renouvellement | `ageApres = (ageMoy·surfTot − ageParc·surfParc)/surfTot` ; `gainAge = ageMoy − ageApres` | Risque |

`serieRep(scn)` choisit, selon le bouton actif (**Ensemble / Part
exploitant / Part propriétaire**), soit `row.cashNet` directement, soit
`OAD.repartir(row, inp.fv).exp` ou `.prop`. La somme cumulée de cette série
est la base des courbes de trésorerie (statu quo, complantation,
arrachage) et de la variante « sans mobilisation de la réserve »
(`arrSansRI`, calculée avec `cashRI` forcé à 0 avant répartition).

`horizon` (10 ans par défaut) et `seuilReserve` (4000 kg/ha) sont en
réalité des **props du composant** (`this.props.horizon`,
`this.props.seuilReserve`) — un mécanisme prévu par le format `.dc` pour
qu'un site hôte puisse les surcharger. Cette version d'`index.html` ne les
expose dans aucun champ visible : ils restent donc toujours à leur valeur
par défaut tant que la page est ouverte seule.

## 18. Graphiques SVG faits main

Pas de librairie de graphiques : chaque figure est un `<svg>` construit à
la main avec `React.createElement('svg', …)`, méthode par méthode :

- **`chart(series, opt)`** (`index.html:652`) — courbes multi-séries avec
  grille, ligne de référence en pointillé (ex. plafond 10 000 kg/ha) et
  annotations ponctuelles. Utilisé pour le graphique de stock de réserve
  (`chartStock`).
- **`waterfall(invest, reserve, effort)`** (`index.html:689`) — graphique
  en cascade à 3 colonnes (Investissement → Réserve → Effort net),
  utilisé pour « Décomposition de l'effort ».
- **`compareBars(items, fmt)`** (`index.html:711`) — barres horizontales
  comparant un point d'arrivée par scénario, utilisé pour « Les trois
  voies à 10 ans » (`chartCompare`).
- **`annualBars(rows)`** (`index.html:731`) — barres empilées année par
  année (cash net vs cash sans réserve). **Définie mais non appelée** dans
  `renderVals()` actuellement : code mort laissé par une itération
  précédente de la maquette, à nettoyer ou à rebrancher selon le besoin.

## 19. Limites, hypothèses et paramètres cachés

- **Mono-parcelle, prix unique.** Pas de distinction cépage/cru/millésime.
- **Paramètres fixés en dur dans `renderVals()`, non éditables dans
  l'UI :** `volSortieArr = 9000` kg/ha, `plafond = 10000` kg/ha,
  `rendMean = 12296.6` kg/ha (moyenne régionale), `horizon = 10` ans
  (sauf prop `horizon`, non exposée — §17). Le facteur écart-type régional
  (`EC = 3440` kg/ha) est câblé directement dans `renderVals()`.
- **Faire-valoir simplifié** : fermage = loyer fixe (souvent indexé
  kg/bouteilles en réalité) ; métayage = parts éditables mais fixes dans le
  temps ; les contrats réels varient davantage.
- **Rendement des leviers branché sur le VolCo** mais paramétré par des
  hypothèses à caler : pénalité VSL (`penaliteVSL`), montée en charge
  (`ramp`), survie et délai de complantation (`survie`, `entreeProd`).
- **Coût de stockage de la réserve négligé.**
- **Charges d'entretien récurrentes nulles par défaut** — tant qu'elles ne
  sont pas calées (`coutSurfaceHaAn`, `coutRdtParKg`), le statu quo reste
  gratuit dans le modèle et la comparaison est optimiste pour le statu quo.
- **Porte-greffe, clones, fiche conseil** : purement informatifs, n'entrent
  jamais dans `inp` ni dans le calcul.
- **Règles AOC modélisées** : écartement rang ≤ 2,00 m, pied 0,70–1,50 m,
  somme ≤ 3,00 m (cahier des charges homologué le 31/07/2025) ; irrigation
  interdite (avertissement seulement, ne bloque pas le calcul) ; Voltis
  ≤ 5 % de l'encépagement + 10 % d'assemblage (badge informatif).
- **Dépendance réseau** : `support.js` charge React/ReactDOM/Babel depuis
  `unpkg.com`, et `index.html` charge les polices depuis Google Fonts. Sans
  connexion Internet au premier chargement, la page reste blanche.
- **Aucun test automatisé** dans le dépôt actuel (voir §20).

## 20. Pour aller plus loin

Idées de suite, non entamées à ce jour :

- **Réintroduire une suite de tests** sur `moteur-oad.js` (il est pur et
  s'exporte via `module.exports`, donc testable avec `node` sans aucune
  dépendance) — au minimum, figer quelques cas de parité avec le classeur
  de référence pour détecter toute régression de formule.
- **Nettoyer ou rebrancher `annualBars`** (§18), actuellement mort.
- **Décider du sort de `this.props.horizon` / `this.props.seuilReserve`**
  (§17) : les exposer dans l'UI, ou les documenter comme un point
  d'intégration pour un site hôte qui embarquerait ce composant.
