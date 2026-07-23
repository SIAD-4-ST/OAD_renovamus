# OAD Renouvellement du vignoble — Parcours guidé

Simulateur pédagogique qui compare, sur une parcelle champenoise, **trois
trajectoires sur un horizon de 10 ou 25 ans** (au choix, étape 5) :
arrachage-replantation, complantation (entreplants) et statu quo (ne rien
faire). L'utilisateur avance dans un
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
    - [6bis. Le registre parcellaire — un mode de saisie alternatif](#6bis-le-registre-parcellaire--un-mode-de-saisie-alternatif)
7. [Le moteur kg — `simulerReserveKg`](#7-le-moteur-kg--simulerreservekg)
8. [Ce qui distingue les 3 scénarios](#8-ce-qui-distingue-les-3-scénarios)
9. [La couche € — `coucheEuro`](#9-la-couche--coucheeuro)
10. [Faire-valoir — `repartir`](#10-faire-valoir--repartir)
11. [Charges d'entretien récurrentes — `chargesEntretien`](#11-charges-dentretien-récurrentes--chargesentretien)
12. [Assemblage des scénarios — `construireScenarios`](#12-assemblage-des-scénarios--construirescenarios)
13. [Manque à gagner — `manqueAGagner`](#13-manque-à-gagner--manqueagagner)
14. [Palissage dérivé de la géométrie — `coutPalissage`](#14-palissage-dérivé-de-la-géométrie--coutpalissage)
    - [14bis. Protection du jeune plant — `coutProtectionPlant`](#14bis-protection-du-jeune-plant--coutprotectionplant)
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

Une suite de tests de parité couvre `moteur-oad.js` (`tests/parite.test.js`,
64 tests à ce jour) : `node tests/parite.test.js`, sans dépendance (`assert`
natif de Node). Elle fige le comportement observé des formules — voir
l'en-tête du fichier — et doit être lancée avant **et** après toute
modification du moteur de calcul (voir CLAUDE.md).

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
    la navigation latérale (`etapes`), les listes de KPI (`kpisFinance`,
    `kpisPhysique`), les lignes de tableaux (`detailRows`, `magRows`…).
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
| 1 | **Votre exploitation** | Surface totale, âge moyen du vignoble, VolCo, prix du raisin, réserve individuelle actuelle (curseur en % du plafond). Ce sont les repères globaux, dénominateurs de toute la comparaison. Saisie manuelle par défaut, ou bascule vers un **registre parcellaire** (jeu d'exemple préchargé, en mémoire de session uniquement, aucun import de fichier pour l'instant) qui dérive surface totale et âge moyen d'un tableau de parcelles — voir [§6bis](#6bis-le-registre-parcellaire--un-mode-de-saisie-alternatif). |
| 2 | **La parcelle que vous désignez** | Âge, taux de pieds manquants, rendement estimé, déclin en statu quo, régime de faire-valoir (propriété / fermage / métayage) et ses paramètres. En mode registre, un sélecteur d'`idu` et des cases à cocher par ligne désignent la parcelle et en dérivent âge et taux de manquants (§6bis). |
| 3 | **Votre projet de replantation** | Géométrie (longueur, largeur, écarts) avec contrôle en direct du cahier des charges AOC ; matériel végétal et conduite (porte-greffe, irrigation, montée en charge) avec fiche conseil ; aide au choix du matériel végétal (dépliable, purement informative) ; dimensionnement du palissage dérivé de la géométrie. |
| 4 | **Coûts et charges** | Investissement ponctuel (arrachage, préparation, plant, palissage, protection du jeune plant, irrigation, pénalité VSL), paramètres de la complantation (survie, entrée en production, coût par entreplant), charges d'entretien récurrentes (calées par défaut sur Cerfrance/MHCS pour 3 des 4 taux — voir §11). |
| 5 | **Résultats** | Synthèse rédigée, sélecteur d'horizon (10 ou 25 ans), sélecteur de vue (Ensemble / Part exploitant / Part propriétaire), de test de résistance climatique et de mode main d'œuvre (Prestataire / Familiale — affichage seul, §11 F7), KPI en 2 familles typographiquement distinctes — décision financière (€) et effets physiques non monétisés (voir §17) —, encadré main d'œuvre économisée, graphiques de stock de réserve et de trajectoire d'âge (repliés par défaut), détail annuel dépliable, tableau du manque à gagner, et une fiche imprimable regroupant hypothèses, KPI (avec formule) et détail annuel des 3 scénarios (bouton « Imprimer », `window.print()`). |

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
        densite, coutArrachageHa, coutPlant, coutPalissageHa,
        irrigation, coutIrrigHa, coutEntreplant, survie, entreeProd, prixKg,
        coutSurfaceProdHaAn, coutRdtParKg, coutReposHaAn, coutPlantierHaAn,
        tauxHoraire, fv:{regime,loyerAn,…} }
   │
   ▼  OAD.construireScenarios(inp)                        moteur-oad.js
sc = { arrachage:     { kg:[…lignes t=0..horizon], eur:[…], investissement },
       complantation: { kg:[…],                  eur:[…], investissement },
       statuquo:      { kg:[…],                  eur:[…], investissement:0 } }
   │
   ├─► cum(serieRep(sc.X))            → séries cumulées (trésorerie, selon la vue faire-valoir)
   ├─► OAD.manqueAGagner(...)         → tableau « manque à gagner »
   ├─► OAD.chargesEntretien(...)      → KPI « charges évitées en transition »
   ├─► OAD.moEconomisee(...)          → encadré « main d'œuvre économisée » (h/ha, jamais dans cashNet — §11)
   ├─► OAD.trajectoireAge(inp)        → trajectoire d'âge du vignoble, 3 scénarios (§17, chantier P7)
   └─► KPI directs (invest, reserveReelle, stockMin…)
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
des 3 scénarios sur l'horizon choisi (10 ou 25 ans), plus tous les KPI et
graphiques. Sur une machine normale, c'est instantané ; ça n'a jamais posé
de problème de fluidité en pratique.

## 6. Glossaire des champs de saisie

Toutes les valeurs saisies vivent dans un seul objet, `state.v`, initialisé
avec ces valeurs par défaut (constructeur du composant, `index.html`) :

### Étape 1 — Votre exploitation

| champ (`v.xxx`) | unité | défaut | rôle |
|---|---|---|---|
| `surfTot` | ha | 10 | surface totale de l'exploitation — dénominateur de l'effet âge et des charges statu quo. Ignoré en mode registre parcellaire, où il est dérivé du registre (§6bis) |
| `ageMoy` | ans | 38 | âge moyen du vignoble **avant** l'opération |
| `riPct` (curseur) | % | 75 | niveau actuel de réserve individuelle, en % du plafond 10 000 kg/ha → `reserveInit = 10000 × riPct/100` |
| `volco` | kg/ha | 9000 | volume commercialisable, fixé chaque année par le CIVC |
| `prixKg` | €/kg | 7 | prix unique du raisin (v1 : pas de distinction cépage/cru) |

### Étape 2 — La parcelle désignée

| champ | unité | défaut | rôle |
|---|---|---|---|
| `ageParc` | ans | 55 | âge de la parcelle candidate au renouvellement. Dérivé du registre en mode registre (§6bis) |
| `manquants` | % | 15 | taux de pieds manquants → dimensionne la complantation. Dérivé du registre en mode registre (§6bis) |
| `rendEstime` | kg/ha | 10500 | rendement actuel de la parcelle — sert au statu quo **et** à la complantation |
| `declinSQ` | %/an | 1 | déclin annuel de rendement si on ne touche à rien (statu quo) — défaut indicatif, à ajuster à la parcelle |
| `regime` | propriete\|fermage\|metayage | propriete | régime de faire-valoir, pilote la répartition des flux (§10) |
| `loyerHa` (si fermage) | €/ha/an | 3000 | loyer fermage → `fv.loyerAn = loyerHa × surfParc` (surface de la parcelle, pas de l'exploitation — voir §10) |
| `partRecolte` (si métayage) | % | 33 | part de recettes au propriétaire |
| `partCouts` (si métayage) | % | 33 | part de coûts au propriétaire |

### Étape 3 — Projet de replantation

**Géométrie** (→ objet `g`, voir [§16](#16-géométrie-de-plantation--geometrie)) :

| champ | unité | défaut |
|---|---|---|
| `geoL` (longueur) | m | 100 |
| `geoW` (largeur) | m | 100 |
| `ecartRang` | m | 1 |
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
| `coutArrachageHa` | €/ha | 22500 | coût d'arrachage **tout compris** (arrachage + évacuation des souches + amendement calcaire + préparation du sol), année 0 — source MHCS, voir journal d'arbitrages §12 |
| `coutPlant` | €/pied | 2.10 | plant, année `repos` (× densité) — source MHCS |
| `coutPalissageHa` | €/ha | 12000 (prérempli ≈13116-14577 selon relevé) | palissage, année `repos` — voir §14 |
| `coutProtectionHa` | €/ha | 10000 (prérempli, chantier P8) | protection du jeune plant (tuteur + cache-plant), année `repos` — poste séparé du palissage, voir journal d'arbitrages §12 |
| `coutIrrigHa` | €/ha | 5000 | irrigation, année `repos`, si activée |
| `penaliteVSL` | % | 15 | pénalité de rendement si conduite semi-large (`ecartRang ≥ 1.5`) |
| `survie` | % | 50 | taux de survie des entreplants |
| `entreeProd` | années | 7 | début de montée en charge des entreplants |
| `coutEntreplant` | €/pied | 4.5 | coût des entreplants, année 0 — supposé inclure déjà tuteur + cache-plant de l'entreplant, hypothèse non vérifiée (voir §12) |

### Étape 4 — Coûts et charges (suite) : charges d'entretien récurrentes

Modèle à 3 volets (§11, refonte détaillée dans le journal d'arbitrages qui
suit). Depuis le **chantier 2** (calibration Cerfrance/MHCS), trois des
quatre taux sont calés par défaut sur une source professionnelle — seul
`coutReposHaAn` reste nul (assumé, à recaler séparément, hors périmètre de
ce chantier) :

| champ | unité | défaut | rôle | source |
|---|---|---|---|---|
| `coutSurfaceProdHaAn` | €/ha/an | 11400 | vigne mature en production — et taux permanent du « reste » de l'exploitation | Cerfrance 2024 — charges de structure hors charges locatives (15 300 €/ha), amortissement (3 900 €/ha) retiré en totalité, voir §11 |
| `coutRdtParKg` | €/kg | 1.52 | vendange, transport, prestations récolte — proportionnel aux kg récoltés | Cerfrance 2024 — charges proportionnelles (~15 200 €/ha) ÷ rendement de référence 10 000 kg/ha |
| `coutReposHaAn` | €/ha/an | 0 | jachère après arrachage (`t < repos`) | assumé — à caler (hors périmètre du chantier 2) |
| `coutPlantierHaAn` | €/ha/an | 8000 | jeune vigne en formation (`repos ≤ t < repos+rampYears`) | MHCS — taille de formation + remplacement des plants morts |
| `tauxHoraire` | €/h | 17 (SMIC 2026 chargé) | conversion h → € dans les détails par opération ci-dessous |
| `fracFormation` | ratio | 0,35 | applique le volet production à la ligne « taille de formation » du volet plantier |

Chacun de ces trois taux de charge (`coutSurfaceProdHaAn`,
`coutReposHaAn`, `coutPlantierHaAn`) peut être saisi directement ou
**repris** d'un détail par opération dépliable (volets « production »,
« repos », « plantier »), préremplissage opt-in décrit dans le journal
d'arbitrages ci-dessous (F4).

### Étape 5 — Résultats

| champ | défaut | rôle |
|---|---|---|
| `v.horizon` | `'10'` (10 ans) | sélecteur 10 / 25 ans → `inp.horizon` ; recalcule les 3 scénarios sur toute la durée choisie (§17) |
| `sequence` (« Test de résistance ») | aucune | force une ou deux années à `12296,6 − 3440` kg/ha (écart-type régional), appliqué **à l'identique** aux 3 scénarios |
| `state.vueFV` | `'1'` (Ensemble) | bascule Ensemble / Part exploitant / Part propriétaire — traverse `OAD.repartir()` avant cumul (§10) |
| `state.moExterne` | `true` (Prestataire) | bascule Prestataire / Familiale de l'encadré « main d'œuvre économisée » — affichage uniquement, jamais dans le calcul (§11 F7) |

## 6bis. Le registre parcellaire — un mode de saisie alternatif

**Chantier 1.** Aux étapes 1 et 2, deux boutons « Saisie manuelle » /
« Registre parcellaire » (`out.setSourceManuel` / `out.setSourceRegistre`,
`index.html`) basculent `state.sourceParcellaire` (`'manuel'` par défaut).
Quand `modeRegistre` (= `sourceParcellaire === 'registre'`) est actif,
`surfTot`, `ageMoy`, `ageParc` et `manquants` ne sont plus des champs
saisis directement : ils sont **dérivés d'un tableau de parcelles**, plutôt
que d'un chiffre unique par champ — utile quand l'exploitation a déjà un
registre parcellaire (type CIVC/douanes) sous la main.

**Origine des données — jeu d'exemple, pas d'import réel.** `state.registreRows`
est peuplé au chargement à partir d'une constante `REGISTRE_EXEMPLE_CSV`
(`index.html`, chaîne CSV `;`-séparée codée en dur, 12 lignes), parsée par
`parseRegistreCSV()` (résolution des colonnes par en-tête, indépendante de
l'ordre ; normalisation de `situation` en `'plantee'`/`'arrachee'`).
**Aucun import de fichier n'est câblé pour l'instant** — c'est prévu pour
une prochaine version. Le registre **ne persiste pas** : ni envoyé, ni
`localStorage` (rappel de la contrainte CLAUDE.md), il vit en mémoire de
l'onglet et disparaît au rechargement — un bandeau dans l'UI le rappelle
explicitement à l'utilisateur.

**Étape 1 — agrégation exploitation.** `OAD.agregerRegistreExploitation(registreRows,
campagne)` (`moteur-oad.js`) renvoie `{ surfTot, ageMoy }` :
`surfTot` = somme de **toutes** les lignes (plantées + arrachées, une
parcelle arrachée reste une surface de l'exploitation, en repos) ;
`ageMoy` = moyenne pondérée par surface, **excluant** les lignes arrachées
du numérateur et du dénominateur (une parcelle sans vigne en terre n'a pas
d'âge de vigne). `v.campagne` (défaut : année courante du navigateur) sert
de référence pour `age = campagne − anneePlant`.

**Étape 2 — désignation de la parcelle.** Un sélecteur `idu` (`iduOptions`,
les `idu` distincts parmi les lignes *plantées* uniquement) choisit un
identifiant de parcelle ; un tableau de ses lignes (`parcelleLignesTable`)
propose une case à cocher par ligne (`state.parcelleLignesExclues`) pour
inclure/exclure une sous-ligne de la sélection — utile si un même `idu`
regroupe des sous-parcelles hétérogènes. Les lignes retenues alimentent
`OAD.agregerRegistreParcelle(lignesRetenues, campagne)` (`moteur-oad.js`),
qui renvoie `surfParc`, `ageParc` et `tauxManquant` (pondérés par surface),
ainsi que `cepage` (le cépage de plus grande surface cumulée dans la
sélection) et `cepageMixte` (alerte purement informative si la sélection
mélange plusieurs cépages — l'UI n'a qu'un seul champ cépage, voir §15).

**Branchement dans `inp`.** En mode registre, `renderVals()` (`index.html`)
substitue les 4 valeurs dérivées à celles de `state.v` : `inp.surfTot`,
`inp.ageMoy`, `inp.ageParc`, `inp.manquants` (= `tauxManquant/100`)
viennent du registre plutôt que des champs `v.surfTot`/`v.ageMoy`/
`v.ageParc`/`v.manquants`. `agregParcelle.surfParc` cascade jusqu'à
`fv.loyerAn = loyerHa × surfParcResolu` (§10). Depuis le chantier
« réconciliation géométrie/registre » (§16), cette surface **passe
par la géométrie** plutôt que de la court-circuiter :
`geometrie(v, agregParcelle.surfParc)` reprend `surfImposee` telle
quelle comme `g.surf` (donc `surfParcResolu = g.surf === agregParcelle.surfParc`,
sans écart) et n'en dérive que la largeur équivalente — la densité, elle,
continue de dépendre uniquement des écartements, indépendamment du mode
actif.

## 7. Le moteur kg — `simulerReserveKg`

C'est la fonction centrale (`moteur-oad.js:8`). Elle simule, année par
année de `t=0` à `t=horizon` (10 ans par défaut, ou 25 — §6), le compte de réserve individuelle
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
  surfProd        = surfRest + (jeune ? surfArr : 0)
  recolteReste    = rendY·surfRest
  recolteParcelle = jeune ? rendY·f·fProjet·surfArr : 0
  recolte         = recolteReste + recolteParcelle
  ```
  Le facteur projet (`fProjet`, pénalité VSL/matériel) ne s'applique **qu'au
  bloc replanté**, jamais au reste de l'exploitation.

- **`complantation` / `statuquo`** — la parcelle reste en production toute
  la période, mais avec un rendement propre `rendParcFn(t, rendY)` :
  ```
  surfProd        = surfTot                                  // toujours plein
  recolteReste    = rendY·surfRest
  recolteParcelle = rendParcFn(t, rendY)·surfArr
  recolte         = recolteReste + recolteParcelle
  ```

`recolteParcelle`/`recolteReste` (chantier 5) décomposent explicitement la
récolte entre la parcelle étudiée et le reste de l'exploitation — c'est sur
cette décomposition que s'appuient `coucheEuro` (§9) et `chargesEntretien`
(§11) pour n'appliquer le régime de faire-valoir qu'aux flux attribuables à
la parcelle (§10).

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

**Sortie**, une ligne par année : `{t, surfProd, rendY, recolte,
recolteParcelle, recolteReste, volcoVendu: min(recolte,volco)+sortieInsuff,
volcoCible: volco, mise, deficit, sortieInsuff, sortieArr, stockDebut,
stockFin, stockHa}`.

## 8. Ce qui distingue les 3 scénarios

| | `arrachage` | `complantation` | `statuquo` |
|---|---|---|---|
| Surface productive | `surfRest`, puis `surfTot` après `returnYear` | toujours `surfTot` | toujours `surfTot` |
| Rendement de la parcelle | `rendMean·f·fProjet` une fois relancée | `rendParcCompl(t, rendY)` — monte de `rendEstime` vers un rendement cible qui suppose les manquants comblés à 100 % (pondérés par un facteur de récupération), à partir de `entreeProd` | `rendParcSQ(t, rendY) = rendY·(rendEstime/rendMean)·(1−declinSQ)ᵗ` |
| Sortie de réserve « arrachage » | oui, années 1 à `nbSortie` | non | non |
| Investissement ponctuel | arrachage (t=0) + replantation (t=repos) | entreplants (t=0), ajustés du taux de survie | aucun |
| Repos / interruption | oui (`repos` années) | non | non |

`rendParcCompl` (`moteur-oad.js`, juste au-dessus de sa définition dans
`construireScenarios`) — **chantier 6**, cohérence coût/rendement de la
complantation. Avant ce chantier, le coût (`invCompl`, ÷ `survie`) achetait
déjà assez de plants pour compenser la casse et combler 100 % des
manquants, mais `rendCible` ne portait le gain qu'à hauteur de `survie` :
double pénalité (on payait pour compenser la mortalité *et* on la subissait
quand même dans le rendement). Modèle retenu — « on repique jusqu'à
combler » : le coût reste ÷ `survie`, et le rendement cible suppose donc le
comblement complet des manquants, pondéré par un facteur de récupération
(un entreplant ne produit pas tout de suite comme le reste d'une parcelle
déjà en place) :
```
gainComblement = manquants · rendMean · facteurRecup      // facteurRecup = 0.8 (constante moteur)
rendCible    = rendEstime + gainComblement
ratio        = rendEstime / rendMean
ratioCible   = rendCible / rendMean
prog(t)      = 0                              si t < entreeProd
             = min(1, (t − entreeProd + 1)/3)  sinon   // montée linéaire sur 3 ans
rendParcCompl(t, rendY) = rendY · (ratio + (ratioCible − ratio) · prog(t))
```
Modèle rejeté — « on plante une fois » : coût sans ÷ `survie` (pas de
réachat des pieds morts) et rendement pondéré par `survie` (ex-formule).
Rejeté car incohérent avec le champ « Coût par entreplant » de l'UI, dont
le calcul présuppose déjà un réachat implicite compensant la mortalité.

## 9. La couche € — `coucheEuro`

Transforme une série `kg` en série `€` (`moteur-oad.js:62`). Depuis le
chantier 5, chaque flux est **décomposé entre la parcelle étudiée et le
reste de l'exploitation**, pour que le régime de faire-valoir (§10) ne
s'applique qu'aux flux attribuables à la parcelle :

```
venduRecolte        = min(recolte, volcoCible)
ratioParcelle       = recolte > 0 ? recolteParcelle / recolte : 0
venduRecolteParcelle = venduRecolte × ratioParcelle
venduRecolteReste     = venduRecolte − venduRecolteParcelle

venteRaisinParcelle = venduRecolteParcelle × prixKg
venteRaisinReste    = (venduRecolteReste + sortieInsuff) × prixKg
venteRaisin         = venteRaisinParcelle + venteRaisinReste          // = volcoVendu × prixKg, inchangé

cashRI       = sortieArr × prixKg      // 100 % parcelle : sortieArr ne dépend que de surfArr
coutsParcelle = coutsParcelleParAnnee[t] || 0   // investissement ponctuel + charges d'entretien parcelle (§11)
coutsReste    = coutsResteParAnnee[t] || 0      // charges d'entretien du reste de l'exploitation (§11)
couts        = coutsParcelle + coutsReste       // inchangé
cashNet      = venteRaisin + cashRI − couts
cashSansRI   = venteRaisin − couts     // pour visualiser ce que la réserve apporte
```

**Convention de répartition de `volcoVendu`** — la part de récolte
plafonnée par le VolCo (`min(recolte, volco)`) est répartie **au prorata de
la récolte réelle** de la parcelle et du reste : tant que le plafond n'est
pas atteint (`recolte ≤ volco`, cas courant), `venduRecolte = recolte` et
chacun vend l'intégralité de sa propre récolte, sans arbitraire. Le
plafonnement n'intervient qu'en cas de surproduction, et il est alors
partagé proportionnellement aux contributions de chacun — c'est la seule
convention neutre, cohérente avec le fait que `volco` est calculé sur
`surfProd` global (il n'existe pas de VolCo « par parcelle » dans le
modèle).

`sortieInsuff` (déstockage de la réserve pour compenser un déficit de
récolte face au VolCo) est en revanche **toujours logé côté « reste »**,
donc toujours 100 % exploitant : le stock (`stockDebut`/`stockFin`) n'est
jamais individualisé par parcelle dans `simulerReserveKg` — c'est un compte
de réserve d'exploitation unique — l'attribuer partiellement à la parcelle
serait donc une convention arbitraire non traçable dans les données
disponibles.

## 10. Faire-valoir — `repartir`

Répartit un flux `€` déjà calculé entre exploitant et propriétaire, **sans
changer le total** (`moteur-oad.js:96`). Depuis le chantier 5, le régime ne
s'applique **qu'aux flux attribuables à la parcelle** — le reste de
l'exploitation (récolte du reste, `sortieInsuff` mutualisée) reste 100 %
exploitant quel que soit le régime choisi :
```
revParcelle = venteRaisinParcelle + cashRI
resteNet    = venteRaisinReste − coutsReste            // toujours 100 % exploitant

propriete : exp = revParcelle − coutsParcelle + resteNet                        , prop = 0
fermage   : exp = revParcelle − coutsParcelle − loyerAn + resteNet              , prop = loyerAn
metayage  : prop = a·revParcelle − b·coutsParcelle
            exp  = (1−a)·revParcelle − (1−b)·coutsParcelle + resteNet
            avec a = partRecolte, b = partCouts
```
Dans les 3 cas : `exp + prop = revParcelle − coutsParcelle + resteNet =
venteRaisin + cashRI − couts = cashNet` — le total reste conservé,
indépendamment du découpage parcelle/reste.

`loyerAn` (calculé dans `renderVals()`, `index.html`) est désormais assis
sur `surfParc` (la surface de la parcelle), pas `surfTot` : le loyer d'une
parcelle louée porte sur cette parcelle, pas sur toute l'exploitation.

Utilisé dans `renderVals()` (fonction `serieRep`) pour les 3 boutons
**Ensemble / Part exploitant / Part propriétaire** de l'étape 5 : dans les
deux derniers cas, chaque point de la série trésorerie passe par
`OAD.repartir()` avant d'être cumulé.

## 11. Charges d'entretien récurrentes — `chargesEntretien`

Sans elles, **ne rien faire n'a aucun coût** dans le modèle, ce qui biaise
systématiquement la comparaison en faveur du statu quo. Modèle à **3
volets** (`moteur-oad.js:127`, refonte détaillée dans le journal
d'arbitrages ci-dessous), **décomposé parcelle / reste** depuis le
chantier 5. Depuis le **chantier 2** (F8 ci-dessous), `coutSurfaceProdHaAn`
et `coutRdtParKg` sont calés par défaut sur Cerfrance 2024, et
`coutPlantierHaAn` sur MHCS ; seul `coutReposHaAn` reste neutre (`0`,
assumé) :

- **Charge de surface**, déclinée en **trois taux exclusifs dans le
  temps** pour le scénario arrachage : `coutReposHaAn` (jachère),
  `coutPlantierHaAn` (jeune vigne en formation) et `coutSurfaceProdHaAn`
  (vigne mature — c'est aussi le taux permanent appliqué au « reste » de
  l'exploitation et aux scénarios statu quo / complantation, toujours en
  production).
- **Charge de rendement** (`coutRdtParKg`, €/kg) : vendange, transport,
  prestations. Proportionnelle aux kg réellement récoltés → s'annule
  d'elle-même en repos et en plantier puisque `recolteParcelle` exclut
  déjà la parcelle non productive sur cette fenêtre.

```
surfRest = surfTot − surfParc,  S = surfParc
rampYears = inp.rampYears ?? ramp.length   // 3 par défaut

scénario 'arrachage' :
  csParc = coutReposHaAn      si t < repos                        (jachère)
         = coutPlantierHaAn   si repos ≤ t < repos + rampYears     (jeune vigne en formation)
         = coutSurfaceProdHaAn  sinon                              (vigne mature)

scénarios 'statuquo' / 'complantation' :
  csParc = coutSurfaceProdHaAn                // parcelle toujours en production

charge_parcelle(t) = csParc·S              + coutRdtParKg·recolteParcelle(t)
charge_reste(t)    = coutSurfaceProdHaAn·surfRest + coutRdtParKg·recolteReste(t)
```
La fonction retourne `{ parcelle, reste }` (deux maps indexées par année,
non fusionnées — un piège classique est de les traiter comme un tableau
plat, voir le journal d'arbitrages ci-dessous).

Branchée **par scénario** : le différentiel entre statu quo et arrachage
pendant la transition capte « ce que l'arrachage évite » (la vendange de
la parcelle, pas sa charge de surface) — c'est le KPI « Charges évitées en
transition » de l'étape 5 (affiché seulement si au moins un des quatre
taux est non nul), purement dérivé et jamais réinjecté dans le calcul.

### Journal d'arbitrages — Charges d'entretien, refonte 3 volets

Chantier qui remplace le modèle à 2 composantes ci-dessus (figé avant ce
chantier : `coutSurfaceHaAn` + `coefRepos`, un coefficient réducteur
appliqué seulement pendant le repos, puis charge pleine dès la
replantation) par le modèle à 3 volets décrit plus haut, ajoute un
préremplissage par opération opt-in, et un indicateur physique de main
d'œuvre économisée séparé de la trésorerie.

**F4 — préremplissage opt-in par opération.**
`OAD.proposerVoletProduction(densite, tauxHoraire)` (`moteur-oad.js:550`)
calcule un détail par opération (taille, liage, ébourgeonnage, relevage,
rognage — manuel ; sol, ferti-irrigation, traitements — mécanisé) à
partir du référentiel `REF_OPS_MANUEL`/`REF_OPS_MECANISE`. Ce détail
n'alimente **jamais** `inp` tant que l'utilisateur n'a pas cliqué « ↻
Reprendre cette estimation » (`index.html`, boutons `reprendreVoletProd` /
`reprendreVoletRepos` / `reprendreVoletPlantier`) : le détail par
opération lui-même reste nul (postes « à caler ») tant qu'on ne clique pas
dessus, et cliquer écrase le champ avec le total du détail. Ceci est
indépendant de la valeur par défaut du champ : depuis le chantier 2 (F8),
`coutSurfaceProdHaAn` et `coutPlantierHaAn` partent déjà d'un défaut calé
(Cerfrance/MHCS), que le bouton « Reprendre » permet de remplacer par une
estimation plus fine si l'utilisateur le souhaite — il ne les active pas
depuis zéro. `coutReposHaAn` reste à `0` par défaut (assumé, hors
périmètre du chantier 2). Les snapshots de parité (§1, totaux `610349` /
`52954`) sont écrits en dur avec les 4 taux de charge à `0`
(`INP_A`, `tests/parite.test.js`) : ils restent inchangés par construction,
indépendamment des défauts de l'UI.

**F5 / F5a — volet transition en deux sous-phases absolues (repos /
plantier).** Remplace `coefRepos` et l'hypothèse « établissement = charge
pleine » du modèle précédent, qui appliquait `coutSurfaceHaAn` en plein
dès la replantation — y compris pendant la formation de la jeune vigne,
alors qu'aucune vendange n'est encore rentrée. Les deux sous-phases sont
des **taux absolus indépendants** (pas un coefficient multiplicatif de
`coutSurfaceProdHaAn`) : `coutReposHaAn` pour la jachère (`t < repos`),
`coutPlantierHaAn` pour la jeune vigne en formation
(`repos ≤ t < repos + rampYears`), chacun éditable directement ou repris
d'un détail par opération dédié (sous-blocs « Repos » et « Plantier »,
`index.html`). Encadré anti-double-compte affiché dans l'UI : ce volet ne
couvre que l'entretien récurrent, jamais l'installation (arrachage,
préparation, plants, palissage), déjà comptée dans l'investissement
ponctuel (`invArr`, §12).

**F6 — heures = indicateur physique, jamais monétisé dans le calcul.**
`OAD.heuresManuellesParAnnee` (`moteur-oad.js:572`) et `OAD.moEconomisee`
(`moteur-oad.js:587`) calculent un différentiel d'heures manuelles
(h/ha) entre arrachage et statu quo sur la fenêtre de transition. Ce
différentiel — et lui seul — alimente l'encadré « Main d'œuvre
économisée » de l'étape 5 (`index.html`) : il n'entre **jamais** dans
`cashNet`, la trésorerie ou un KPI financier. Garde-fou vérifié par
`tests/parite.test.js` (§7 du fichier de tests) : `cashNet` des 3
scénarios est identique, que l'indicateur soit calculé ou non.

**F7 — toggle prestataire / familiale.**
`state.moExterne` (défaut `true`, prestataire — hypothèse majoritaire en
Champagne) bascule l'affichage de l'encadré MO, sans jamais toucher au
calcul : en mode prestataire, `mo.euroIndicatifHa` (heures × taux
horaire) s'affiche en plus, avec la mention explicite « indicatif, hors
trésorerie » ; en mode familiale, seul le texte « temps redéployable »
apparaît, sans équivalent €. Le toggle ne pilote qu'un affichage
conditionnel côté `index.html` — jamais un paramètre de
`construireScenarios`.

**Provenance à deux étages.**
1. Agrégats **€/ha Cerfrance** (temps et coûts par hectare, source
   professionnelle agrégée), ventilés par opération via le **barème de la
   tâche de l'Avenant n°217 à la convention collective des exploitations
   viticoles de la Champagne délimitée (IDCC 8216)**, étendu le
   08/09/2021 — `REF_OPS_MANUEL` (`moteur-oad.js:526`), exprimé en heures
   pour 1000 pieds.
2. **€/h : SMIC 2026 chargé ≈ 17 €/h** (`TAUX_HORAIRE_DEFAUT`,
   `moteur-oad.js:545`), éditable dans l'UI (`v.tauxHoraire`).

**Caveat — le barème 217 est un plancher, pas une moyenne.** C'est un
tarif de tâche (rémunération professionnelle minimale par unité
d'ouvrage), pas une mesure du temps réellement passé sur le terrain : le
temps réel est souvent supérieur. Repères indicatifs (UMC) : taille
≈ 200 h/ha, liage ≈ 90 h/ha, relevage ≈ 120 h/ha, rognage ≈ 60 h/ha — à
comparer, densité par densité, aux h/ha issues du barème 217. Les postes
mécanisés (sol, ferti-irrigation, traitements — `REF_OPS_MECANISE`,
`moteur-oad.js:537`) et les coûts de repos/plantier (`REF_REPOS`/
`REF_PLANTIER`, `index.html`) sont, eux, entièrement **à caler sur des
données coopératives réelles** : nuls par défaut, badgés « à caler — dire
d'expert coop » dans l'UI.

**F8 — chantier 2 : calibration Cerfrance/MHCS, charges de structure et
charges proportionnelles.** Avant ce chantier, `coutSurfaceProdHaAn` et
`coutRdtParKg` valaient `0` par défaut : le statu quo était gratuit et
biaisait toute la comparaison. Source retenue : Cerfrance, « Évolution du
coût de production du raisin sur 10 ans », exercice 2024, **hors charges
locatives** (cohérent avec le modèle : le fermage/métayage est déjà traité
par `repartir()`, §10 — inclure le loyer dans le taux de surface aurait
doublé `fv.loyerAn`). Décomposition Cerfrance : coût de production total
30 503 €/ha = charges proportionnelles (~15 200 €/ha, à 10 000 kg/ha de
référence, dont 75 % vendange/prestations) + charges de structure
(~15 300 €/ha).

*Risque de double-compte identifié avant calibration* : les charges de
structure Cerfrance **incluent** ~3 900 €/ha d'amortissements
(15 200 + 15 300 ≈ 30 500 ≈ le total : l'amortissement est un sous-poste
de la structure, pas un poste additif). Le modèle compte déjà
l'investissement de plantation en flux ponctuel (`invArr`, §12) : assigner
15 300 €/ha tel quel à `coutSurfaceProdHaAn` aurait compté une partie de la
plantation deux fois — une fois en `invArr`, une fois amortie dans la
charge annuelle de structure.

*Option retenue — retrait total de l'amortissement* : `coutSurfaceProdHaAn
= 15 300 − 3 900 = 11 400 €/ha/an`, seule option sourcée sans hypothèse
supplémentaire. Deux autres options ont été écartées faute de donnée :
isoler la seule part « plantation » du poste amortissement (nécessiterait
une source détaillant sa composition matériel/bâtiments/pressoir/plantation,
non disponible) ; ou dériver une annuité de plantation à partir de
l'investissement saisi par l'utilisateur ÷ une durée d'amortissement
(nécessiterait de choisir et sourcer cette durée — non retenue pour ce
chantier). Conséquence assumée : le taux retiré **la totalité** de
l'amortissement, pas seulement la part plantation — `coutSurfaceProdHaAn`
sous-estime donc légèrement le vrai coût de structure hors plantation
(matériel, bâtiments, pressoir — jamais captés ailleurs dans le modèle).
Ce biais est **symétrique** : le même taux s'applique à la parcelle et au
« reste » de l'exploitation, dans les 3 scénarios (voir test §9,
`tests/parite.test.js`) — il affecte donc les niveaux absolus de cashNet,
jamais les écarts inter-scénarios.

`coutRdtParKg = 1,52 €/kg` (= 15 200 / 10 000) est repris intégralement,
sans isoler les ~25 % non-vendange (probablement engrais/phyto, qui
suivraient plutôt une logique €/ha qu'€/kg) : simplification assumée pour
ce chantier, qui introduit un biais mineur (sur/sous-estimation selon les
années de rendement) mais reste symétrique sur les 3 scénarios. Aucun
retraitement n'est nécessaire pour le décalage entre le rendement de
référence Cerfrance (10 000 kg/ha) et `rendMean` (12 296,6 kg/ha) : les
taux `€/ha/an` sont indépendants du rendement par construction, et le taux
`€/kg` s'applique à la récolte réellement simulée (`recolteParcelle`/
`recolteReste`), pas à un forfait — voir §11 pour la formule.

`coutPlantierHaAn = 8 000 €/ha/an` (source MHCS, taille de formation +
remplacement des plants morts) et `coutReposHaAn = 0` (assumé, à recaler
séparément) sont hors périmètre de ce chantier.

## 12. Assemblage des scénarios — `construireScenarios`

Point d'entrée principal du moteur (`moteur-oad.js:152`), appelé une fois
par rendu (`renderVals()`). Construit les paramètres communs (`base`),
calcule les trois séries `kg`, puis les coûts ponctuels + récurrents, puis
la couche `€`.

**Investissement ponctuel arrachage** (`invArr`, indexé par année) :
```
invArr[0]     = surfParc × coutArrachageHa                                    // année de l'arrachage — tout compris (voir journal ci-dessous)
invArr[repos] += surfParc × (densite·coutPlant + coutPalissageHa
                              + coutProtectionHa                              // chantier P8, voir journal ci-dessous
                              + (irrigation ? coutIrrigHa : 0))                // replantation
```

### Journal d'arbitrages — chantier P8 : palissage détaillé par élément et protection du jeune plant

Chantier déclenché par un relevé de prix fournisseur par élément (amarre,
piquet, fiche de tête en L galva, kit bout de route, crochet piquet inox,
fil, tuteur en U galva, cache-plant), à brancher sur `coutPalissage()`
(§14) et sur un nouveau poste dédié.

**Garde-fou 1 — anti-double-compte, deux risques identifiés et tranchés.**
1. Tuteur en U et cache-plant ne sont pas du palissage (structure du
   rang) mais de la **protection individuelle du pied** — poste séparé
   (`coutProtectionHa`, fonction `OAD.coutProtectionPlant(densite)`),
   plutôt que fondu dans `coutPalissageHa`, pour deux raisons : (a) il ne
   dépend que de la densité, pas de la géométrie du rang (espacement
   piquets, nb fils) ; (b) le fondre dans le palissage aurait cassé la
   symétrie avec la complantation (le palissage n'est jamais appliqué à
   `invCompl` — voir §12 ci-dessus — alors qu'un entreplant a, physiquement,
   autant besoin d'un tuteur qu'un pied replanté en arrachage).
2. En creusant l'UI existante, la ligne `REF_PLANTIER[0]` du détail par
   opération « plantier » (`index.html`) portait déjà le libellé
   *« Protection des jeunes plants »* — nulle par défaut, « à caler »,
   alimentant `coutPlantierHaAn` (charge **annuelle récurrente** MHCS,
   taille de formation + remplacement des plants morts, §11). Risque non
   anticipé au lancement du chantier : un futur remplissage de cette ligne
   « à caler » avec un prix matériel aurait doublé le nouvel achat
   ponctuel. Résolu en recentrant son libellé sur la seule **main d'œuvre**
   de surveillance/relève (`"Surveillance / relève de la protection (MO)"`,
   avec renvoi explicite vers le nouveau poste d'investissement), sans
   toucher à son comportement (toujours 0 par défaut, opt-in).

**Garde-fou 2 — symétrie avec la complantation, arbitrage explicite.**
`coutProtectionHa` n'est volontairement **pas** appliqué à `invCompl` : le
champ `coutEntreplant` (prix d'achat par pied, saisi librement) est posé
comme incluant déjà la protection de l'entreplant. C'est une **hypothèse
à vérifier par l'utilisateur auprès de sa source** — pas un fait établi
par ce chantier — d'où l'avertissement explicite affiché sous le champ
« Coût par entreplant » dans l'UI. Si l'hypothèse s'avère fausse pour une
source donnée, l'entreplant est sous-évalué de `tuteurU + cachePlant`
(≈ 1,25 €/pied avec les prix ci-dessous) par rapport à l'arrachage.

**Chiffrage de l'écart** (géométrie de référence retenue pour ce chantier :
200×15 m, écarts 1,10×1,10 → densite = 8 264 pieds/ha, surf = 0,30 ha — à
distinguer des valeurs par défaut *actuelles* de l'UI, qui ont changé
depuis, voir §6) :
- Modèle palissage seul, ancien (6 lignes, LutEnVi 2025) : ≈ 13 116 €/ha.
- Modèle palissage seul, nouveau (8 lignes, relevé fournisseur + gripple/MO
  LutEnVi conservés) : ≈ 14 577 €/ha.
- Protection seule (tuteur + cache-plant) à cette densité : ≈ 10 330 €/ha.
- **Total palissage + protection : ≈ 24 900 €/ha**, contre 12 000 €/ha pour
  l'ancienne valeur par défaut de `coutPalissageHa` seule — sous-estimation
  d'un facteur ≈ 2, portée presque intégralement par l'absence historique
  de tuteur/cache-plant, pas par la révision des prix de palissage
  eux-mêmes (qui ne bouge que de ≈ +11 %).

**Provenance — instantané non daté.** Les 8 prix du relevé fournisseur
(amarre, piquet, fiche de tête, kit bout de route, crochet, fil, tuteur,
cache-plant) sont ceux communiqués par l'utilisateur au lancement du
chantier ; **la date exacte du relevé et le nom du fournisseur restent à
préciser** avant tout usage réel (prix acier volatils — voir `PRIX_PALISSAGE`
et `PRIX_PROTECTION_PLANT`, `moteur-oad.js`). Gripple et MO pose piquet
restent sur le classeur LutEnVi 2025, faute d'équivalent dans le nouveau
relevé (prix matière uniquement, pas de main d'œuvre ni de tendeur).

**Hypothèses de mapping à confirmer** (non tranchées faute de repère dans
le relevé, voir commentaire `coutPalissage()`, `moteur-oad.js`) : le
« piquet » du relevé (3,80 €, « selon espacement ») est traité comme
piquet **intermédiaire** uniquement — la tête de rang est couverte par la
fiche de tête + le kit bout de route, qui remplacent l'ancien « piquet de
tête » LutEnVi ; le « crochet piquet inox » (1 par piquet) est appliqué
sur cette même base (piquets intermédiaires uniquement).

### Journal d'arbitrages — chantier P3 : recalage MHCS et suppression de `coutPrepaHa`

Avant ce chantier, l'investissement de replantation distinguait deux lignes
saisies séparément : `coutArrachageHa` (4 500 €/ha, année 0) et `coutPrepaHa`
(3 500 €/ha, préparation du sol, année `repos`) — décomposition héritée du
classeur LutEnVi 2025. Source retenue depuis ce chantier : **MHCS**, dont le
prix d'arrachage (22 500 €/ha) est un **forfait tout compris** — arrachage,
évacuation des souches, amendement calcaire **et préparation du sol** — non
décomposable en sous-lignes. Maintenir `coutPrepaHa` en parallèle aurait donc
compté la préparation du sol une fois dans `coutArrachageHa` (MHCS, implicite)
et une fois dans `coutPrepaHa` (LutEnVi, explicite) : double emploi.

*Option retenue — suppression complète du champ* (plutôt que le geler à 0,
grisé, avec un libellé « inclus dans le coût d'arrachage ») : la fusion MHCS
n'est pas un choix de présentation réversible que la coopérative pourrait un
jour redéfaire — la source ne permet pas d'isoler à nouveau un prix de
préparation du sol distinct. Un champ gelé aurait donné l'illusion contraire
et serait resté à l'écran en continu, contre le principe de sobriété de
saisie. La décomposition LutEnVi 2025 reste consultable dans l'historique
git (et dans ce journal) si elle doit resservir de repère de comparaison.

`coutPlant` recalé à 2,10 €/pied (MHCS), contre 1,80 €/pied (LutEnVi) avant
ce chantier — même logique de source unique que ci-dessus, sans changement
de périmètre (toujours un coût par pied, année `repos`, × `densite`).

`invArr[repos]` ne porte donc plus que `densite·coutPlant + coutPalissageHa
+ (irrigation ? coutIrrigHa : 0)` ; `invArr[0] = surfParc × coutArrachageHa`
absorbe désormais la préparation du sol. Le calendrier d'engagement (t=0
puis t=`repos`) est inchangé, pour les deux motifs d'arrachage (classique,
`repos=1` ; sanitaire, `repos=3`).

**Investissement ponctuel complantation** (`invCompl`) :
```
nbPlants     = surfParc × densite × manquants     // pieds manquants à combler
invCompl[0]  = nbPlants × coutEntreplant / survie  // achat majoré pour combler 100 % malgré la casse
```
Ce ÷ `survie` (on rachète plus de plants que de manquants pour finir à 100 %
comblé) est la raison pour laquelle, depuis le **chantier 6** (voir §8), le
rendement cible de la complantation (`rendCible`) ne repondère plus par
`survie` : il suppose le comblement complet et ne discounte que par un
facteur de récupération (jeunesse de l'entreplant), pour éviter de payer la
mortalité deux fois (une fois dans le coût, une fois dans le rendement).

**Coûts totaux par année, par scénario** (fusion investissement + entretien
§11 — l'investissement, 100 % causé par `surfParc`, ne fusionne qu'avec la
part `.parcelle` de `chargesEntretien`, jamais avec `.reste`) :
```
ceArr  = chargesEntretien('arrachage', scArr, inp)          // { parcelle, reste }
ceComp = chargesEntretien('complantation', scCompl, inp)
ceSQ   = chargesEntretien('statuquo', scSQ, inp)

coutsArrParcelle  = invArr   ⊕ ceArr.parcelle    ,  coutsArrReste  = ceArr.reste
coutsCompParcelle = invCompl ⊕ ceComp.parcelle   ,  coutsCompReste = ceComp.reste
coutsSQParcelle   =            ceSQ.parcelle     ,  coutsSQReste   = ceSQ.reste
```
(`⊕` = fusion additive année par année.) Ces quatre maps par scénario
alimentent `coucheEuro` (§9) via `eco(coutsParcelle, coutsReste)`.

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

`coutPalissage(geo, prix, opt)` (`moteur-oad.js`) dérive un coût de
palissage à l'hectare à partir de la géométrie de plantation. Depuis le
**chantier P8**, les prix sont de source **mixte** : un relevé fournisseur
par élément (piquet, fiche de tête, kit bout de route, amarre, crochet,
fil) complété par deux prix conservés du classeur **LutEnVi 2025** feuille
« Coût hectare d'installation » (gripple, MO pose piquet — sans équivalent
dans le nouveau relevé, qui ne porte que sur la matière). Il **préremplit**
`coutPalissageHa` (champ éditable) tant que l'utilisateur ne l'a pas
modifié à la main. Un poste **distinct**, `coutProtectionHa` (tuteur +
cache-plant, `coutProtectionPlant()`), couvre la protection du jeune plant
— voir §12, journal d'arbitrages chantier P8, pour l'anti-double-compte.

```
espacement  = espPiquet ?? 6 m                              // choix éditable — repère LutEnVi ≈ 4,3 m
nbFils      = nbFils ?? FILS_PAR_TAILLE[typeTaille] ?? 4     // guyot/cordon/arcure simple = 4, arcure double = 5

interParRang = max(0, round(Lrang/espacement) − 1)
nbInter      = nbRangs × interParRang         // piquets intermédiaires — base du "piquet" et du "crochet" du relevé
nbTete       = 2 × nbRangs                    // fiche de tête + kit bout de route + amarre : 2 par rang chacun
mlFils       = nbFils × nbRangs × Lrang       // mètres linéaires de fil, tous fils confondus
nbGripple    = nbFils × nbRangs
nbPiquets    = nbInter + nbTete                // base MO pose : tout poteau planté

totalParcelle = Σ (quantité × prix unitaire) sur les 8 lignes
totalHa       = totalParcelle / surf
```

**Prix unitaires** (`PRIX_PALISSAGE`, `moteur-oad.js`) :

| poste | prix | source |
|---|---|---|
| piquet intermédiaire | 3,80 €/piquet | relevé fournisseur [date à préciser] |
| fiche de tête en L galva | 5,98 €, 2/rang | relevé fournisseur [date à préciser] |
| kit bout de route | 3,88 €, 2/rang | relevé fournisseur [date à préciser] |
| amarre 1200 | 7,32 €, 2/rang | relevé fournisseur [date à préciser] |
| crochet piquet inox | 0,26 €, 1/piquet intermédiaire | relevé fournisseur [date à préciser] |
| fil (par fil, au mètre linéaire) | 0,15 €/m | relevé fournisseur [date à préciser] |
| gripple | 1,826 €/gripple | LutEnVi 2025 (conservé, pas d'équivalent dans le relevé) |
| MO pose piquet | 1,318 €/piquet posé | LutEnVi 2025, dérivé (2 864,56 €/ha ÷ 2 174 piquets/ha) |

⚠ Avec l'espacement par défaut (6 m), le nombre de piquets intermédiaires
est **~30 % plus faible** que le repère implicite LutEnVi (~1 piquet tous
les 4 pieds, soit ≈ 4,3 m) — divergence assumée et affichée dans l'UI.

**Mapping du relevé — hypothèses à confirmer** (voir journal §12) : le
« piquet » (3,80 €) est traité comme piquet intermédiaire uniquement (la
tête de rang est couverte par fiche de tête + kit bout de route) ; le
« crochet piquet inox » est appliqué sur cette même base (intermédiaires
uniquement, pas la tête). À corriger si le relevé source précise
autrement la répartition.

## 14bis. Protection du jeune plant — `coutProtectionPlant`

`coutProtectionPlant(densite, prix)` (`moteur-oad.js`, chantier P8) dérive
un coût de protection du jeune plant (tuteur en U galvanisé + cache-plant)
à l'hectare, à partir de la seule densité de plantation — **indépendant**
de la géométrie du rang (espacement, nb fils), à la différence du
palissage ci-dessus :
```
totalHa = densite × (tuteurU + cachePlant)
```
**Prix unitaires** (`PRIX_PROTECTION_PLANT`, `moteur-oad.js`) : tuteur en U
galva 0,77 €/pied, cache-plant 0,48 €/pied — relevé fournisseur [date à
préciser], même instantané que `PRIX_PALISSAGE` ci-dessus.

Préremplit `coutProtectionHa` (champ éditable, UI étape 4) tant que
l'utilisateur ne l'a pas modifié à la main — même mécanique opt-in que
`coutPalissageHa`. Appliqué **uniquement** au scénario arrachage
(`invArr[repos]`, §12), jamais à la complantation : voir le journal
d'arbitrages du chantier P8 (§12) pour les deux garde-fous
anti-double-compte (recentrage de `REF_PLANTIER[0]` sur la main d'œuvre
seule ; hypothèse que `coutEntreplant` inclut déjà la protection).

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
`ARBRE_PG` est une table de 17 branches (`moteur-oad.js:472`) reproduisant
les combinaisons calcaire × profondeur × drainage du guide, avec les
porte-greffes envisageables et des renvois d'avertissement (ex. `161-49 C`
: dépérissements signalés depuis 2008, déconseillé). Alimente les blocs
« Porte-greffes envisageables » et la fiche `PG_INFO` (statique, dans le
composant) de l'étape 3 ; **n'entre jamais dans `inp`**.

## 16. Géométrie de plantation — `geometrie()`

Calculée côté composant (méthode `geometrie(v, surfImposee)`,
`index.html:1136`), à partir de `geoL`, `geoW`, `ecartRang`, `ecartPied`,
et d'un second argument optionnel `surfImposee` (ha).

**Mode manuel** (`surfImposee` absent) — comportement historique, inchangé :
```
densite  = round(10000 / (eR × eP))              // pieds/ha
W        = geoW                                   // saisi
nbRangs  = max(1, floor(W / eR))
piedsRang= max(1, floor(L / eP))
surf     = round(L × W / 10000, 4)                // ha, 4 décimales — pilote inp.surfParc
pieds    = nbRangs × piedsRang
```

**Mode registre** (`surfImposee > 0`, chantier "réconciliation
géométrie/registre") — la surface directrice est désormais celle du
registre parcellaire (`agregParcelle.surfParc`), pas le rectangle saisi :
```
densite  = round(10000 / (eR × eP))              // pieds/ha, inchangé
W        = OAD.largeurEquivalente(surfImposee, L) // dérivée, PAS geoW
nbRangs  = max(1, floor(W / eR))                  // même formule, plancher conservateur
piedsRang= max(1, floor(L / eP))
surf     = surfImposee                            // EXACTEMENT — jamais recalculé depuis L×W
pieds    = nbRangs × piedsRang
```
`L` (la longueur de rang saisie) n'est **jamais** corrigée ni recalculée,
dans aucun des deux modes — voir journal d'arbitrages ci-dessous pour la
justification. Dans les deux modes, `vsl = eR ≥ 1.5` déclenche la
pénalité de rendement (`penaliteVSL`) et le conseil de diamètre de fil
porteur ; `aoc.*` alimente le bandeau de conformité au cahier des charges
homologué le 31/07/2025 (rang ≤ 2,00 m, pied 0,70–1,50 m, somme ≤ 3,00 m).

### Journal d'arbitrages — réconciliation géométrie/registre (option A)

**Constat de départ.** En mode registre, `renderVals()` pilotait déjà
`inp.surfParc` (et donc `nbPlants`, `piedsAffiches`) depuis le registre
parcellaire (chantier 1, §6bis), mais l'écran 3 laissait l'utilisateur
saisir librement une largeur qui ne servait plus à rien de cohérent : la
vignette « Surface » du bandeau affichait la surface du registre pendant
que le rectangle saisi (L × W) donnait une tout autre valeur — incohérence
visible et non signalée.

**Décision : surface directrice = registre, largeur dérivée, longueur
intouchable.** Plutôt que de laisser deux sources de surface coexister
sans lien, la largeur devient `largeurEquivalente(surfImposee, L) =
surfImposee × 10000 / L` (`moteur-oad.js`) : une fonction pure qui
recalcule W pour que `L × W / 10000 = surfImposee` exactement. La
longueur, elle, n'est **jamais** modifiée par l'outil.

**Raison — asymétrie économique démontrée entre L et W.** Ramené à
l'hectare, `coutPalissage()` (§14) ne dépend de la géométrie qu'à travers
`nbRangs`, `L` et `surf` — jamais directement de `W`. En reformulant
`nbRangs ≈ W / eR`, chaque poste par hectare se réduit à :

| Poste | par hectare | dépend de |
|---|---|---|
| Fils (ml) | `nbFils × 10000 / eR` | ni L ni W |
| Têtes de rang | `2 × 10000 / (eR × L)` | **L seul** |
| Piquets intermédiaires | `(10000/eR) × (1/esp − 1/L)` | **L seul** |
| Gripples | `nbFils × 10000 / (eR × L)` | **L seul** |

**W est économiquement neutre au ratio par hectare — L ne l'est pas.**
Avec les constantes `PRIX_PALISSAGE` actuelles (eR = 1,10 m, piquets tous
les 6 m, 4 fils), passer d'un rang de 200 m à un rang de 50 m à surface
égale renchérit le palissage de l'ordre de 4 000 à 5 000 €/ha (vérifié par
`tests/parite.test.js`, §13, garde-fou ≥ 3 500 €/ha). Dériver la largeur
plutôt que la longueur est donc le seul choix qui ne fausse pas
silencieusement un poste de coût à cinq chiffres.

**Limite assumée — la largeur affichée est un artefact de calcul, pas une
mesure de terrain.** Une parcelle réelle issue d'un agrégat de lignes de
registre (potentiellement plusieurs `idu`, formes irrégulières) n'est
presque jamais un rectangle. La « largeur équivalente » n'a donc de sens
que comme paramètre d'entrée de `coutPalissage()`, jamais comme grandeur à
vérifier sur le terrain — d'où le libellé et la mention explicite dans
l'UI (« la parcelle n'est pas un rectangle, cette largeur est un
équivalent de calcul, pas une mesure de terrain »).

**Limite assumée — biais conservateur du plancher sur `nbRangs`.**
`nbRangs = max(1, floor(W / eR))` accepte `nbRangs × eR ≤ W` (un rang
partiel ne se plante pas) : à largeur dérivée égale, le nombre de rangs
réellement plantables est légèrement sous-estimé plutôt que
sur-estimé — biais jugé préférable à l'inverse (sur-promettre un rang qui
ne rentre pas).

**Dette ouverte, non traitée ici.** La bonne cible à terme est de
supprimer complètement la notion de largeur et de raisonner directement en
mètres linéaires de rang par hectare dans `coutPalissage()` (refonte du
moteur, hors périmètre de ce chantier — la fonction actuelle continue de
lire `geo.nbRangs`/`geo.L`/`geo.surf`, jamais `geo.W`, ce qui a permis
cette réconciliation sans toucher `coutPalissage()`). Restent également
ouverts, à trancher séparément : la définition exacte de
`surface_ss_parcelle` dans l'export registre (surface plantée ou
déclarée, avec ou sans tournières — impacte la densité de pieds
appliquée) ; l'opportunité d'introduire un champ « surface » explicite en
mode manuel pour lui appliquer la même mécanique ; et le cas d'un `idu`
multi-lignes aux longueurs de rang hétérogènes, où une longueur unique
pour l'agrégat reste une approximation.

## 17. KPI et synthèse

Tous calculés dans `renderVals()` (`index.html`), après
`OAD.construireScenarios(inp)`. Depuis le **chantier P6** (refonte de
l'écran 5), l'écran sépare deux familles typographiquement distinctes,
jamais mélangées dans une même grille de cartes — `out.kpisFinance` /
`out.kpiEffortNet` (blanc, décision € ) et `out.kpisPhysique` (fond
teinté, effets physiques non monétisés) :

| KPI | formule | famille (écran) |
|---|---|---|
| Investissement brut | `invest = sc.arrachage.investissement` | Financière — toujours visible |
| Amortisseur de réserve | `reserveReelle = Σ sc.arrachage.eur[t].cashRI` ; libellé « mobilise X % de l'investissement » sous 100 %, reformulé en € au-delà (jamais de `%` > 100 affiché) | Financière — toujours visible |
| — théorique | `reserveTheo = volSortieArr × surfParc × nbSortie × prixKg` | (détail du KPI ci-dessus) |
| Point bas de trésorerie | `creuxAbs = min_t arrParcelle_cum[t]`, avec `arrParcelle[t] = venteRaisinParcelle[t] + cashRI[t] − coutsParcelle[t]` (vue « Ensemble ») réparti via `OAD.repartir()` en neutralisant le flux du reste (`venteRaisinReste`/`coutsReste` à 0) pour les vues Part exploitant/propriétaire — trésorerie cumulée **absolue de la parcelle seule** (pas relative au statu quo, pas noyée dans le revenu du reste de l'exploitation), sur la vue faire-valoir active | Financière — toujours visible |
| Effort net après réserve | `effortNet = max(0, invest − reserveReelle)` | Financière — repliée par défaut (`state.effortNetOuvert`) |
| Réserve minimale en transition | `stockMin = min_t sc.arrachage.kg[t].stockHa`, alerte si `< 4000` kg/ha (`seuilReserve`) | Physique — toujours visible |
| Écart d'âge à l'horizon | `trajAge = OAD.trajectoireAge(inp)` ; `gainAgeHorizon = trajAge.statuquo[horizon] − trajAge.arrachage[horizon]` ; contrepartie énoncée dans la même phrase (« rendement à reconstruire durant la transition ») ; détail complet en trajectoire dans le graphique associé (§18) | Physique — toujours visible |

`chargesEntretien` renvoie `{ parcelle, reste }` (§11) : les KPI dérivés
de charges ne lisent que `.parcelle`, qui seule porte l'écart de phase
(repos/plantier/production) propre au scénario arrachage — `.reste` est
identique aux deux scénarios comparés et s'annulerait dans la différence
de toute façon.

**Retirés de l'écran par le chantier P6** (toujours calculés, conservés
dans `out.printKpiRows` pour la fiche imprimable — voir ci-dessous) :
« Tension maximale de trésorerie » (`creux = min_t (arr_cum[t] − sq_cum[t])`,
la version *relative* au statu quo — remplacée à l'écran par le « Point
bas de trésorerie » *absolu* ci-dessus, qui répond directement à « combien
dois-je être en mesure de financer, et quand ») et « Charges évitées en
transition » (`Σ_{t=0}^{returnYear−1} max(0, chSQ.parcelle[t] −
chArr.parcelle[t])`, `returnYear = 3+repos`).

**Fiche imprimable** (étape 5, bouton « Imprimer » → `window.print()`,
mise en page dédiée via `@media print` dans `index.html`, masque nav/aside
et n'affiche que `.print-sheet`) : un document d'audit autonome, distinct
de l'écran, construit dans `renderVals()` à partir de 5 tableaux —
`out.printInpRows` (rappel de toutes les hypothèses saisies), `out.printKpiRows`
(tous les KPI, y compris ceux retirés de l'écran ci-dessus, chacun avec sa
formule), et `out.printDetailArr` / `printDetailCompl` / `printDetailSQ`
(détail annuel complet des 3 scénarios). Pensé pour qu'un chiffre affiché
à l'écran puisse toujours être retracé jusqu'à sa formule et à l'hypothèse
qui l'alimente, sans avoir à relire le code.

Séparé de ces grilles, un encadré dédié (jamais dans `out.kpisFinance` ni
`out.kpisPhysique`) affiche l'indicateur physique « main d'œuvre
économisée » (F6/F7, voir le journal d'arbitrages en §11) — volontairement
hors grille KPI puisqu'il n'est pas un montant financier ; sa phrase
énonce désormais explicitement la contrepartie (« une heure non
travaillée … est aussi une heure de vendange en moins »).

### Journal d'arbitrages — chantier P7 : trajectoire d'âge du vignoble

Remplace le KPI ponctuel `ageApres`/`gainAge` (instantané : comptait la
parcelle à l'âge 0 dès `t=0`, y compris pendant le repos du sol où aucune
vigne n'est encore en terre — le rajeunissement était donc affiché avant
d'être acquis) par `OAD.trajectoireAge(inp)` (`moteur-oad.js`), une
trajectoire de l'âge moyen de l'exploitation sur l'horizon, pour les 3
scénarios — symétrique du graphique de stock de réserve (§18).

Trois conventions tranchées avant codage :
- **Pendant le repos (arrachage, `t < repos`)** : la parcelle sort du
  numérateur **et** du dénominateur (option B) — même règle que
  `agregerRegistreExploitation` pour les lignes « Arrachée » du registre
  (chantier 1, [§6bis](#6bis-le-registre-parcellaire--un-mode-de-saisie-alternatif)) :
  une parcelle sans vigne en terre n'a pas d'âge de vigne. Rejeté : la
  compter à l'âge 0 dès `t=0` (convention de l'ancien
  KPI, flatteuse) ou la garder à l'écran avec un âge nul non distingué.
- **Redémarrage à l'âge 0 ancré sur `repos`** (replantation physique, date
  de `invArr[repos]`), pas sur `returnYear` (3+repos, entrée en production
  dans le modèle kg) : cet indicateur est un capital **physique**,
  volontairement découplé de la capacité de production — l'ancrer sur
  `returnYear` réintroduirait un biais productif dans un indicateur pensé
  pour en être indépendant.
- **Complantation** : mix pondéré à deux générations de pieds sur la même
  parcelle — `(1−manquants)` de la surface continue de vieillir
  normalement (`ageParc+t`), `manquants` repart à l'âge `t` (entreplants
  plantés à `t=0`).

Le « reste de l'exploitation » (hors parcelle) vieillit de +1 an/an, à
l'identique dans les 3 scénarios (le temps passe pareil partout, principe
de symétrie du projet) — ce terme s'annule dans les écarts inter-scénarios
mais garde des niveaux affichés physiquement justes.

Propriété structurelle qui en découle, vérifiée par les tests
(`tests/parite.test.js`, section 10) : l'écart d'âge avec le statu quo
reste **plat** pendant le repos (les deux vieillissent au même rythme tant
que rien n'est replanté), fait un **saut net** à la replantation (`t =
repos`), puis reste **plat** indéfiniment — à la différence de la
trésorerie, l'écart d'âge, une fois acquis, ne se referme jamais
spontanément.

`serieRep(scn)` choisit, selon le bouton actif (**Ensemble / Part
exploitant / Part propriétaire**), soit `row.cashNet` directement, soit
`OAD.repartir(row, inp.fv).exp` ou `.prop`. La somme cumulée de cette série
est la base des courbes de trésorerie (statu quo, complantation,
arrachage) et de la variante « sans mobilisation de la réserve »
(`arrSansRI`, calculée avec `cashRI` forcé à 0 avant répartition).

`horizon` est désormais un champ éditable (`v.horizon`, sélecteur 10/25
ans, étape 5), et non plus une prop cachée du composant — voir §6.
`seuilReserve` (4000 kg/ha, alerte de réserve minimale) reste, lui, une
**prop du composant** (`this.props.seuilReserve ?? 4000`) — un mécanisme
prévu par le format `.dc` pour qu'un site hôte puisse la surcharger. Cette
version d'`index.html` ne l'expose dans aucun champ visible : elle reste
donc toujours à sa valeur par défaut tant que la page est ouverte seule.

## 18. Graphiques SVG faits main

Pas de librairie de graphiques : chaque figure est un `<svg>` construit à
la main avec `React.createElement('svg', …)`, méthode par méthode :

- **`chart(series, opt)`** — courbes multi-séries avec grille, ligne de
  référence en pointillé (ex. plafond 10 000 kg/ha) et annotations
  ponctuelles. Utilisé pour le graphique de stock de réserve
  (`chartStock`), replié par défaut à l'écran depuis le chantier P6
  (`state.stockChartOuvert`), et pour la trajectoire d'âge du vignoble
  (`chartAge`, chantier P7, replié par défaut — `state.ageChartOuvert`).
  Depuis P7, chaque série peut porter un `marker` (`'circle'`|`'square'`|
  `'triangle'`, tracé à chaque point `t`) en plus de `dash`
  (`strokeDasharray`, déjà présent mais inutilisé avant P7) : accessibilité
  vision dichromate — ne jamais distinguer des séries par la seule
  couleur. `chartStock` n'a volontairement pas été rétrofité (hors
  périmètre de P7) ; la légende associée à un `chart()` accessible se
  construit via `legendSwatch(c, dash, marker)`, jamais en HTML/SVG brut
  dans le template `<x-dc>` (cohérent avec le reste des graphiques,
  entièrement construits en script).

**Retirés par le chantier P6** (méthodes supprimées, plus aucune trace
dans `index.html`) : `waterfall(invest, reserve, effort)` — graphique en
cascade « Décomposition de l'effort » —, `compareBars(items, fmt)` —
barres horizontales « Les trois voies à 10 ans », avec la ligne des
annuités équivalentes qui l'accompagnait — et `annualBars(rows)` —
barres empilées année par année (cash net vs cash sans réserve). Le
graphique « Trajectoire de trésorerie cumulée » (courbes `chartTreso`,
avec et sans mobilisation de la réserve) et son encadré « pourquoi la
réserve est décisive » ont également été retirés de l'écran. Ces quatre
figures n'existent plus que dans l'historique git ; rien de leur logique
ne subsiste ailleurs — les chiffres qu'elles portaient (investissement,
réserve, effort net, écart
final avec/sans réserve) restent lisibles via les KPI et, pour le détail
formule par formule, via la fiche imprimable (`out.printKpiRows`, §17).

## 19. Limites, hypothèses et paramètres cachés

- **Mono-parcelle, prix unique.** Pas de distinction cépage/cru/millésime.
- **Aucune valeur terminale d'actif.** Le stock de réserve individuelle en
  fin d'horizon (`stockFin`/`stockHa`) et l'écart d'âge du vignoble
  (`trajectoireAge`) sont des actifs physiques contraints, jamais
  convertis en €, y compris à l'horizon : `coucheEuro` ne reçoit même pas
  ces champs en entrée (garde-fou vérifié par `tests/parite.test.js` §12)
  et `trajectoireAge` ne prend aucun paramètre monétaire (`prixKg` sans
  effet sur son résultat, même test). Un vignoble rajeuni ou une réserve
  reconstituée à l'année 10 ne sont donc jamais comptés comme un gain
  patrimonial dans les KPI financiers — cohérent avec le principe
  anti-double-compte du projet, mais à garder en tête pour toute lecture
  « valeur nette du patrimoine ».
- **Aucune actualisation.** Les flux de trésorerie (`cashNet`, `investissement`,
  cumuls) sont sommés bruts sur l'horizon (10 ou 25 ans), sans taux
  d'actualisation ni VAN : un euro à l'année 10 pèse, dans les KPI,
  exactement comme un euro à l'année 0. Choix de simplicité pour un outil
  de sensibilisation (§0) ; à corriger si l'outil devait un jour servir de
  base à une décision d'investissement chiffrée.
- **Prix du raisin unique, sans distinction cépage/cru/millésime** (rappel
  du point ci-dessus, qui a aussi une composante temporelle : `prixKg` est
  supposé constant sur tout l'horizon, sans inflation ni cycle de marché).
- **Valeurs réglementaires figées, à revérifier à chaque campagne.**
  `volSortieArr = 9000` kg/ha (sortie de réserve à l'arrachage) et
  `plafond = 10000` kg/ha (plafond de réserve individuelle) sont des seuils
  fixés par le cahier des charges AOC/CIVC de la campagne en cours, pas des
  constantes physiques : ils **peuvent changer d'une campagne à l'autre** et
  doivent être revérifiés avant tout usage, au même titre que le volume
  commercialisable (`v.volco`, déjà un champ de saisie éditable, lui).
- **Paramètres fixés en dur dans `renderVals()`, non éditables dans
  l'UI :** `volSortieArr = 9000` kg/ha, `plafond = 10000` kg/ha,
  `rendMean = 12296.6` kg/ha (moyenne régionale). `horizon` (10 ou 25 ans),
  lui, **est** éditable (sélecteur étape 5) — seule `seuilReserve` reste une
  prop cachée non exposée (§17). Le facteur écart-type régional
  (`EC = 3440` kg/ha) est câblé directement dans `renderVals()`.
- **Faire-valoir simplifié** : fermage = loyer fixe (souvent indexé
  kg/bouteilles en réalité) ; métayage = parts éditables mais fixes dans le
  temps ; les contrats réels varient davantage.
- **Rendement des leviers branché sur le VolCo** mais paramétré par des
  hypothèses à caler : pénalité VSL (`penaliteVSL`), montée en charge
  (`ramp`), survie et délai de complantation (`survie`, `entreeProd`).
- **Coût de stockage de la réserve négligé.**
- **Relevé de prix palissage/protection (chantier P8) non daté** :
  `PRIX_PALISSAGE` et `PRIX_PROTECTION_PLANT` (`moteur-oad.js`) reprennent
  des prix fournisseur communiqués par l'utilisateur sans date de relevé ni
  nom de fournisseur précisés — à compléter avant tout usage réel (prix
  acier volatils). Hypothèse non vérifiée que `coutEntreplant` inclut déjà
  la protection de l'entreplant (voir §12, journal P8).
- **Charges d'entretien récurrentes** : depuis le chantier 2 (§11, F8),
  `coutSurfaceProdHaAn` (11 400 €/ha/an) et `coutRdtParKg` (1,52 €/kg) sont
  calés sur Cerfrance 2024, `coutPlantierHaAn` (8 000 €/ha/an) sur MHCS.
  Seul `coutReposHaAn` reste nul (assumé, à caler séparément) — sur cette
  seule fenêtre (jachère après arrachage), le statu quo garde un léger biais
  optimiste résiduel. Le référentiel manuel (`REF_OPS_MANUEL`, barème
  Avenant 217) est un **plancher** de tarif de tâche, pas une moyenne de
  temps réel ; les postes mécanisés du détail par opération restent,
  eux, entièrement à caler sur données coop (voir le journal
  d'arbitrages, §11).
- **Porte-greffe, clones, fiche conseil** : purement informatifs, n'entrent
  jamais dans `inp` ni dans le calcul.
- **Règles AOC modélisées** : écartement rang ≤ 2,00 m, pied 0,70–1,50 m,
  somme ≤ 3,00 m (cahier des charges homologué le 31/07/2025) ; irrigation
  interdite (avertissement seulement, ne bloque pas le calcul) ; Voltis
  ≤ 5 % de l'encépagement + 10 % d'assemblage (badge informatif).
- **Dépendance réseau** : `support.js` charge React/ReactDOM/Babel depuis
  `unpkg.com`, et `index.html` charge les polices depuis Google Fonts. Sans
  connexion Internet au premier chargement, la page reste blanche.
- **Classeur Excel de portage : maquette jetable, ne fait pas foi.** Le
  classeur Excel qui a servi de support initial au chiffrage de ce chantier
  (distinct des classeurs sources cités en provenance des valeurs, ex.
  LutEnVi 2025, §12/§14) est une maquette de travail jetable : il n'est **pas**
  maintenu en parallèle de ce dépôt et ne doit **jamais** être utilisé comme
  référence pour auditer un chiffre affiché à l'écran. `moteur-oad.js` et
  `tests/parite.test.js` (formules + snapshots figés) font seuls foi.

## 20. Pour aller plus loin

Idées de suite, non entamées à ce jour :

- **Décider du sort de `this.props.seuilReserve`** (§17) : `horizon` a
  depuis été exposé dans l'UI (sélecteur 10/25 ans, étape 5) mais
  `seuilReserve` (alerte de réserve minimale, 4000 kg/ha) reste une prop
  non exposée — l'exposer dans l'UI, ou la documenter comme un point
  d'intégration pour un site hôte qui embarquerait ce composant.
- **Seuil de bascule sur le niveau de réserve individuelle** : indiquer, à
  partir de quel niveau de RI actuel (`v.riPct`) un projet donné devient
  absorbable sans tension de trésorerie excessive — le seul endroit où
  l'outil pourrait guider sans devenir prescriptif. Non entamé.
- **Analyse de sensibilité / tornade** sur les paramètres à caler
  (`penaliteVSL`, `ramp`, `survie`, `entreeProd`, charges…). Non entamée.
