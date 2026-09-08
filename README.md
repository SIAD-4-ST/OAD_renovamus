# OAD Renouvellement du vignoble — Parcours guidé

Simulateur pédagogique qui chiffre, sur une parcelle champenoise et sur un
horizon de 10 ou 25 ans (au choix, étape 5), **l'impact d'un
arrachage-replantation sur l'exploitation** : investissement, mobilisation
de la réserve individuelle, charges de transition, main d'œuvre et
rajeunissement du vignoble. Ce n'est plus un comparateur de trajectoires :
depuis la note de cadrage du 24/07/2026 (voir §12bis, journal
d'arbitrages), le statu quo (ne rien faire) reste calculé en interne comme
**contre-factuel silencieux** — il alimente chaque différentiel affiché
(manque à gagner, écart d'âge, charges évitées…) mais n'est plus un
scénario que l'utilisateur peut choisir de regarder à l'écran ; la
complantation reste calculée pour compatibilité (`@deprecated`) mais n'est
elle non plus jamais affichée. Ce repositionnement a une conséquence
explicite à garder en tête en le lisant : l'outil ne documente plus ce que
coûte l'immobilisme, seulement ce que change l'action (§12bis, décision 2).
L'utilisateur avance dans un **parcours guidé en 5 étapes** (Exploitation →
Parcelle → Plantation → Coûts → Résultats) ; à chaque étape, une synthèse
chiffrée se met à jour en continu dans la colonne de droite.

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
    - [3bis. Conventions d'interface — classes CSS et panneaux d'aide](#3bis-conventions-dinterface--classes-css-et-panneaux-daide)
    - [3ter. Refonte d'interface — les 14 prompts (lot 1a / 1b / 1c)](#3ter-refonte-dinterface--les-14-prompts-lot-1a--1b--1c)
4. [Le parcours en 3 temps](#4-le-parcours-en-3-temps)
    - [4bis. Le temps 2 — une décision par carte](#4bis-le-temps-2--une-décision-par-carte)
5. [Le flux de données, de la frappe au résultat](#5-le-flux-de-données-de-la-frappe-au-résultat)
6. [Glossaire des champs de saisie](#6-glossaire-des-champs-de-saisie)
    - [6bis. Le registre parcellaire — seule source des surfaces et des âges](#6bis-le-registre-parcellaire--seule-source-des-surfaces-et-des-âges)
    - [6ter. Le faire-valoir au registre — un régime par parcelle](#6ter-le-faire-valoir-au-registre--un-régime-par-parcelle)
7. [Le moteur kg — `simulerReserveKg`](#7-le-moteur-kg--simulerreservekg)
    - [7bis. Journal d'arbitrages — chantier A2 : uniformisation de l'arrachage](#7bis-journal-darbitrages--chantier-a2--uniformisation-de-larrachage)
    - [7ter. Journal d'arbitrages — chantier A3 : remplacement des paliers de montée en charge](#7ter-journal-darbitrages--chantier-a3--remplacement-des-paliers-de-montée-en-charge)
8. [Ce qui distingue les 3 scénarios](#8-ce-qui-distingue-les-3-scénarios)
9. [La couche € — `coucheEuro`](#9-la-couche--coucheeuro)
10. [Faire-valoir — `repartir`](#10-faire-valoir--repartir)
11. [Charges d'entretien récurrentes — `chargesEntretien`](#11-charges-dentretien-récurrentes--chargesentretien)
12. [Assemblage des scénarios — `construireScenarios`](#12-assemblage-des-scénarios--construirescenarios)
    - [12bis. Journal d'arbitrages consolidé — note de cadrage du 24/07/2026](#12bis-journal-darbitrages-consolidé--note-de-cadrage-du-24072026)
13. [Manque à gagner — `manqueAGagner`](#13-manque-à-gagner--manqueagagner)
14. [Palissage dérivé de la géométrie — `coutPalissage`](#14-palissage-dérivé-de-la-géométrie--coutpalissage)
    - [14bis. Protection du jeune plant — `coutProtectionPlant`](#14bis-protection-du-jeune-plant--coutprotectionplant)
15. [Arbre de décision porte-greffe — `preconPorteGreffe`](#15-arbre-de-décision-porte-greffe--preconportegreffe)
16. [Géométrie de plantation — `OAD.geometrieAgronomique()`](#16-géométrie-de-plantation--oadgeometrieagronomique)
17. [KPI et synthèse](#17-kpi-et-synthèse)
    - [17bis. Les deux sorties d'impression](#17bis-les-deux-sorties-dimpression)
18. [Graphiques SVG faits main](#18-graphiques-svg-faits-main)
    - [18bis. La frise de trajectoire — `friseTrajectoire()`](#18bis-la-frise-de-trajectoire--frisetrajectoire)
    - [18ter. La composition du vignoble — `graphExploitation()`](#18ter-la-composition-du-vignoble--graphexploitation)
19. [Limites, hypothèses et paramètres cachés](#19-limites-hypothèses-et-paramètres-cachés)
    - [19bis. Journal d'arbitrages — accueil, simplification de l'interface, deux corrections](#19bis-journal-darbitrages--accueil-simplification-de-linterface-deux-corrections)
    - [19ter. Journal d'arbitrages — session du 01/09/2026](#19ter-journal-darbitrages--session-du-01092026)
    - [19quater. Journal d'arbitrages — prompt B9 : assiette de surface (registre vs production)](#19quater-journal-darbitrages--prompt-b9--assiette-de-surface-registre-vs-production)
    - [19quinquies. Journal d'arbitrages — refonte du temps 3 : six thèmes, un axe d'années (08/09/2026)](#19quinquies-journal-darbitrages--refonte-du-temps-3--six-thèmes-un-axe-dannées-08092026)
20. [Pour aller plus loin](#20-pour-aller-plus-loin)
21. [Recette humaine — contrôles non automatisables](#21-recette-humaine--contrôles-non-automatisables)

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
97 tests à ce jour) : `node tests/parite.test.js`, sans dépendance (`assert`
natif de Node). Elle fige le comportement observé des formules — voir
l'en-tête du fichier — et doit être lancée avant **et** après toute
modification du moteur de calcul (voir CLAUDE.md). La section 15
(« Parcours de recette métier », chantier C3) traduit en tests les
parcours automatisables de la note de cadrage ; les contrôles qui
demandent un œil humain (lisibilité de l'écran 5) sont listés séparément,
non simulés par un test factice — voir [§21](#21-recette-humaine--contrôles-non-automatisables).

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

## 3bis. Conventions d'interface — classes CSS et panneaux d'aide

### Le panneau d'accueil (prompt B6)

L'encart « mode d'emploi » replié en tête de l'étape 1 est remplacé par un
**panneau d'accueil**, ouvert au premier chargement seulement (drapeau
`accueilVu`, persisté avec la clé `oad-renovamus-v1`), refermable, et
atteignable en permanence par le bouton **« Comment lire cet outil »** de
l'en-tête, à côté du Lexique. L'encart de l'étape 1 reste en place, replié.

Il contient une **frise SVG faite main** (`friseAccueil()`, construite en
`React.createElement` comme les graphiques, §18) : arrachage (année 0) →
repos → plantation → 3ᵉ feuille → pleine production, avec la courbe de
rendement qui tombe puis remonte et la barre de réserve individuelle qui se
vide pour combler le trou avant de se reconstituer. C'est le mécanisme que
l'outil chiffre et que l'interface n'expliquait nulle part. Le dessin est
**illustratif** : il montre la forme du phénomène, pas le résultat des
saisies — la page le dit explicitement.

Un encadré **« ce que l'outil ne fait pas »** énonce les trois limites qui
comptent pour lire l'écran 5 : aucune recommandation, aucune actualisation
des flux, aucune valeur patrimoniale du vignoble rajeuni ni de la réserve
reconstituée — d'où des résultats structurellement pessimistes en fin
d'horizon.

**Contraintes techniques tenues** : SVG inline, **aucune image externe** (la
page dépend déjà d'unpkg et de Google Fonts, §19) ; **pas de
`position: fixed`** — le panneau est dans le flux du document, en tête de
page, car un panneau fixe qui recouvre la page est un piège à focus
classique. `Échap` le ferme et le focus revient au bouton qui l'a ouvert,
quel que soit le chemin de fermeture ; la frise porte un `aria-label`
descriptif.

**Deux textes corrigés au passage**, qui contredisaient la note de cadrage
du 24/07/2026 : l'accroche « l'outil compare deux avenirs […] la renouveler
ou ne rien faire » devient une formulation de **simulateur d'impact du seul
renouvellement**, le maintien en l'état n'étant plus qu'un repère de
comparaison ; et l'entrée **« Complantation » du lexique**, qui annonçait à
l'utilisateur un scénario calculé mais jamais affiché, est retirée du
lexique visible — le moteur continue de le calculer, ce qui disparaît est la
promesse faite à l'écran.

### Les styles répétés vivent dans `<style>`, plus dans les balises

Le template `<x-dc>` a longtemps porté ses styles exclusivement en
attribut `style=` inline. Une poignée de motifs y était répétée
verbatim des dizaines de fois (le même champ de saisie 28 fois, le même
libellé 46 fois), ce qui rendait toute retouche d'apparence
mécanique et risquée — et laissait des variantes diverger sans qu'on
le voie (trois habillages différents du **même** volet repliable).

Ces motifs sont désormais des **classes**, définies dans l'unique bloc
`<style>` en tête de fichier. `support.js` traduit `class` en
`className` et `for` en `htmlFor` (voir `support.js`, table
d'attributs), donc la syntaxe HTML normale suffit — rien à adapter.

| Classe | Rôle |
|---|---|
| `.field` | conteneur vertical d'un champ (libellé + saisie + aide) |
| `.lbl` | libellé de champ |
| `.row` | ligne saisie + unité |
| `.unit` | unité à droite d'une saisie (`ha`, `€/kg`…) |
| `.hint` | ligne d'aide sous un champ ; `.hint.warn` pour la variante rouge |
| `.inp` / `.sel` | saisie numérique / liste déroulante |
| `.ro` | **valeur dérivée non saisissable** (fond ambré) — signal visuel constant : ambré = calculé pour vous |
| `.grid` | grille de champs auto-ajustée |
| `.card` / `.card-h` | carte blanche et son titre |
| `.fold` / `.fold-btn` / `.fold-sign` / `.fold-body` | volet repliable (voir ci-dessous) |
| `.th` / `.th.r` | en-tête de colonne d'un tableau en grille |
| `.mono` / `.eyebrow` | chiffre en chasse fixe / surtitre d'étape |
| `.dec-grid` / `.dec-large` | grille des cartes de décision du temps 2 (§4bis) ; `.dec-large` occupe toute la largeur |
| `.dec` / `.dec-h` / `.dec-num` / `.dec-pied` | carte de décision, son en-tête, son surtitre `DÉCISION N`, son pied séparé d'un filet pointillé |
| `.dec3` | grille interne de la décision 3 : contrôles à gauche, lignes de palissage à droite |
| `.jalons` / `.jalon` | bandeau des quatre décisions et l'un de ses pavés |
| `.seg-groupe` / `.seg-btn` | groupe de boutons segmentés et l'un de ses boutons |

Les `style=` restants sont ceux qui sont **uniques à un élément** ou qui
portent une **valeur calculée** `{{ }}` (couleurs d'état, largeurs de
colonnes) — ceux-là ne peuvent pas devenir des classes.

**Règle** : un style qui apparaît une seule fois reste inline ; à partir
de la deuxième occurrence identique, il devient une classe.

### Tous les volets repliables se ressemblent

Il existait trois habillages du même contrôle « déplier / replier ».
Un seul subsiste : `.fold` (le cadre) → `.fold-btn` (l'en-tête cliquable
pleine largeur) → `.fold-sign` (le `+` / `−` à droite) → `.fold-body`
(le contenu, sous un `sc-if`). Chaque volet reste piloté par sa propre
paire `xxxOuvert` / `toggleXxx` dans l'état du composant, comme avant.

Quand un volet replié cache une **valeur que l'utilisateur doit pouvoir
vérifier**, son en-tête l'affiche en résumé (voir
`chargesProdResumeTxt`) : replier ne doit jamais enterrer un chiffre qui
pilote le calcul.

### Les trois panneaux d'aide

| Panneau | État | Défaut | Contenu |
|---|---|---|---|
| Mode d'emploi | `introOuvert` | **ouvert** | à quoi sert l'outil, les 5 étapes, « tout est prérempli », « rien n'est enregistré » — en tête de l'étape 1 |
| Lexique | `lexiqueOuvert` | replié | 8 définitions (réserve individuelle, VolCo, repos, plantier, faire-valoir, statu quo, densité, complantation), sous l'en-tête, accessible depuis **n'importe quelle étape** |
| Charges de production | `chargesProdOuvert` | replié | les paramètres Cerfrance 2024 de l'étape 1, avec leur détail par opération |

Le lexique est dans le `<header>`, hors de la grille des étapes : c'est
le seul contenu d'aide qui doit rester atteignable partout.

### Vocabulaire visible

L'interface ne mentionne **jamais** les chantiers (« chantier A4 »),
les renvois au README (« voir §7 »), ni les numéros d'arbitrage
(« P6 »). Ces références restent utiles et sont conservées — mais en
**commentaires HTML/JS** et dans ce README, jamais dans un texte lu par
l'utilisateur. Un vigneron qui ouvre l'outil ne sait pas ce qu'est un
chantier B3.

De même, « à caler » (jargon interne signifiant « valeur non encore
sourcée ») est remplacé partout par « à ajuster », et les formulations
qui décrivaient la mécanique interne (« alimente la référence interne de
calcul, jamais un scénario affiché à part ») par ce que la valeur veut
dire pour celui qui la saisit.

### Accessibilité

- Chaque libellé de champ est rattaché à sa saisie par `for` / `id`
  (identifiant dérivé du nom d'état : `v.surfTot` → `f-surfTot`), donc
  cliquer le libellé donne le focus au champ et un lecteur d'écran
  annonce lequel.
- L'étape courante du sommaire porte `aria-current="step"`, en plus de
  sa couleur de fond.
- Sous 1080 px de large, la grille à 3 colonnes se replie en une seule
  (sommaire horizontal en haut, synthèse sous le contenu).

## 3ter. Refonte d'interface — les 14 prompts (lot 1a / 1b / 1c)

Cette section décrit **ce qui a changé dans l'interface** lors de la refonte
menée d'après `PROMPTS.md`. Le moteur n'a rien perdu : toutes les fonctions de
calcul ajoutées sont pures, exposées via `module.exports` et `window.OAD`, et
couvertes par `tests/parite.test.js` (sections 20 à 28).

Le critère d'acceptation, rappelé à chaque prompt : **est-ce lisible à trois
mètres, et le conseiller peut-il ne montrer qu'une chose à la fois ?**

### Lot 1a — resserrer (prompts 1 à 4)

**Échelle typographique à quatre niveaux.** Les 19 tailles de police présentes
dans le gabarit sont ramenées à quatre, déclarées en classes `.n1` à `.n4` :

| Niveau | Usage | Corps | Remplace |
|---|---|---|---|
| N1 | chiffre de tête | 36 px, `nowrap` | *(introduit au prompt 5)* |
| N2 | titre d'écran ou de bloc | 22 px | 16, 17, 19, 20, 21, 24, 26 |
| N3 | libellé, texte courant | 13,5 px (libellé en 600) | 13, 14, 14,5, 15 |
| N4 | aide, surtitre, unité | 11,5 px, `--encre-3` | 9,5, 10, 10,5, 11, 12, 12,5 |

**Grilles de champs à deux colonnes fixes.** `.grid` passe de
`repeat(auto-fill, minmax(220px, 1fr))` à `1fr 1fr` (gap 18 × 30 px), repli à
une colonne sous 900 px. Les tableaux à colonnes internes — référentiel de
temps de travaux, table des clones, registre, détail annuel — gardent leur
grille propre et leur `overflow-x` : ce ne sont pas des grilles de champs.

**Registre parcellaire replié en bandeau.** Le tableau éditable est derrière un
volet refermé au chargement, sous un bandeau qui dit ce qu'il contient
(`OAD.synthetiseRegistre` : nombre de lignes, surface totale, cépages
distincts). L'import CSV garde son propre volet à côté : c'est un geste de
mise en route, pas une correction de détail, il reste atteignable sans ouvrir
le registre. `state.registreOuvert` et `state.importOuvert` sont des états de
navigation, **hors instantané** — sans quoi replier ne servirait à rien.

**Lexique au contact des champs.** Les cinq entrées de métier (réserve
individuelle, VolCo, repos du sol, plantier, faire-valoir) portent une clé et
une glose d'une ligne (`court`) dans `lexiqueEntrees`, exposées par `out.lex`
et citées sous le champ concerné. Le terme se signale par un soulignement
pointillé (`.lex`) et porte la définition longue en `title`. L'accordéon du
haut lit la même liste : une correction vaut pour les deux.

**Pied d'écran.** Chaque temps se termine par un pied séparé d'un filet,
portant l'action principale nommée par l'étape qu'elle atteint et, quand elle
n'est pas la suivante, le raccourci « Aller aux résultats ». Les deux
réutilisent les handlers existants (`suivant`, `allerResultats`).

### Lot 1b — les résultats autour d'une frise (prompts 5 à 9)

**Trois chiffres de tête**, en N1 : *retour en production* (une année),
*investissement net de la réserve mobilisée* (un montant signé, chantier C3), *vignoble rajeuni de* (une durée).
Chacun porte sa décomposition en N4 — un chiffre de 36 px ne doit jamais être
un chiffre nu. Aucun n'est recalculé dans `index.html` ; l'année manquait au
moteur, d'où `OAD.anneeRetourProduction(repos)`.

**Newsreader remplace Fraunces** pour les titres et les chiffres de tête
(poids 650 → 600, axe optique 9..144 → 6..72). Archivo reste le texte courant,
JetBrains Mono les chiffres et unités.

**La frise de trajectoire** (`friseTrajectoire()`, §18bis) : trois pistes qui
partagent le même axe de 11 colonnes d'année — phases de la parcelle, stock de
réserve, trésorerie cumulée. C'est le cœur de la refonte : le temps était
partout dans l'outil et n'était jamais dessiné.

> **Révisé le 08/09/2026 (§18bis, §19quinquies).** La frise porte désormais
> **six pistes** — phase, stock de réserve, déblocage, blocage, investissements,
> entretien — et la trésorerie cumulée n'en fait plus partie. Le principe du
> prompt 7 est inchangé : un seul axe de temps, toutes les échelles alignées
> dessus, et les points de courbe au centre de leur colonne.

**Les cinq blocs deviennent cinq onglets** (`role="tablist"`, navigation aux
flèches, `state.ongletResultat` hors instantané) : « Coût, poste par poste »,
« Réserve individuelle », « Main d'œuvre et charges », « Ce qui est replanté »,
« Rajeunissement du vignoble ». Les intitulés « Bloc 1 » à « Bloc 5 »
disparaissent — ils numérotaient l'ordre du code. L'annexe technique, les
hypothèses de comparaison et le manque à gagner restent hors onglets.

> **Écart assumé avec `PROMPTS.md`.** Le handoff appariait « Réserve
> individuelle » au bloc 4 et « Main d'œuvre et charges » au bloc 3, alors que
> c'est l'inverse dans le code, et nommait le cinquième onglet « Détail
> annuel » alors que le bloc 5 est le rajeunissement du vignoble — le détail
> annuel restant par ailleurs hors onglets à la demande du même prompt.
> L'appariement a été résolu **par libellé** : un onglet doit dire ce qu'il
> contient.

> ⚠️ **Annulé le 08/09/2026 (§19quinquies).** Les cinq onglets ont été
> **supprimés**, avec `state.ongletResultat` et leur navigation clavier : ils
> rangeaient l'écran par bloc de code et n'en montraient qu'un à la fois. Le
> contenu est réparti par **thème** — six cartes, une par piste de la frise —
> et l'écran se parcourt désormais par **année**, via l'axe de la frise
> (`state.anneeFrise`). Les deux paragraphes ci-dessus sont conservés pour
> l'historique : ils décrivent l'état du 07/09/2026, plus l'écran actuel.

**Les graphiques par défaut, les tableaux repliés.** `stockChartOuvert` et
`ageChartOuvert` démarraient à `true`, leurs boutons de repli conservés et
retournés en « Masquer ». En regard, tout volet de détail long annonce dans son
en-tête ce qu'il contient et le total de sa colonne principale.

> **Suppression du 08/09/2026.** Le bloc « Ce que le renouvellement produit »
> a été retiré du temps 3, et les deux graphiques qu'il portait avec lui :
> `chartStock`, `chartAge`, leurs états (`stockChartOuvert`,
> `ageChartOuvert`), leurs boutons de repli et les trois KPI physiques
> (`kpiEcartAge`, `kpiReserveHorizon`, `kpiReserveMin`) n'existent plus dans
> `index.html`. Le paragraphe ci-dessus est conservé pour l'historique. La
> seconde moitié — « tout volet de détail long annonce ce qu'il contient » —
> reste en vigueur. Ce que le bloc portait et qui **reste à l'écran** : la
> réserve à l'horizon et son plancher, dans la phrase de synthèse
> (`reserveHorizonTxt` puis `stockMinTxt`) et sur la fiche d'audit ; l'écart
> d'âge, dans le chiffre de tête `teteAge` et sur la fiche d'audit.

### Lot 1c — le parcours en trois temps (prompts 10 à 14)

**Panneau « Hypothèses ».** Tout ce qui est préréglé ET sourcé sort du
parcours, en quatre sections portant chacune sa source et sa date : charges
annuelles de référence (Cerfrance 2024), référentiel de temps de travaux et
taux horaire (Avenant 217, SMIC 2026 chargé), tarifs de palissage et de
protection (LutEnVi 2025), paramètres de faire-valoir. **Aucun contrôle ne
disparaît** : les 36 champs liés à `state.v` restent saisissables, exactement
une fois chacun — un test le vérifie clé par clé. Les champs sont *déplacés*,
pas dupliqués.

Une valeur qui n'est plus celle de sa source porte le badge ambre, et
« Reprendre les valeurs de référence » la remet à sa valeur d'origine, section
par section ou globalement. Le badge teste la **valeur**, pas `champsTouches` :
ici la question est « ce chiffre est-il encore celui de la source ? », et
remettre soi-même la valeur de référence doit faire disparaître le badge —
c'est l'inverse du chemin court (§6), qui suit « ce chiffre a-t-il été
regardé ». La reprise ne touche jamais les saisies qui décrivent la parcelle,
le projet ou le registre : `HYPOTHESES_SECTIONS` en fixe la liste, un test
l'interdit.

Comme le panneau d'accueil, il est **dans le flux du document** — pas de
`position: fixed`, pas de piège à focus — avec la même discipline : le focus
entre sur le bouton de fermeture, `Échap` ferme, le focus revient au bouton
d'ouverture.

**Parcours en trois temps** — voir §4.

**Schéma de parcelle dessiné pendant la saisie** — voir §16.

**Thème sombre de projection.** Toutes les couleurs du gabarit passent par des
jetons déclarés sur `:root`, basculés par un attribut `data-theme` posé sur
l'élément racine depuis le composant (`appliquerTheme()`, appelée par
`componentDidMount` et `componentDidUpdate` : rien dans `<x-dc>` ne peut
atteindre `<html>`). Le thème sombre ne fait que redéfinir les valeurs — il n'y
a qu'un endroit à relire pour vérifier un contraste, et un test exige que les
deux thèmes définissent exactement le même jeu de jetons. **Plus aucune couleur
littérale dans le gabarit**, `#000` de la fiche imprimée excepté ; un test
l'interdit désormais. Le châssis des graphiques (grille, axes, graduations,
filets) suit le thème ; les couleurs de **série** ne changent pas.

Le mode **sombre est le défaut** (l'outil est d'abord montré au
vidéoprojecteur) ; le clair reste à un clic, et `<html>` porte déjà
`data-theme="sombre"` dans le fichier pour qu'aucun éclair de fond crème ne
précède le montage de React. Le choix de thème entre
dans l'instantané `localStorage` — on ne veut pas rebasculer à chaque ouverture
en salle — mais vit **hors de `state.v`**, qui reste l'objet des saisies :
« Effacer mes données » ne le remet donc pas à zéro.

**Deux sorties d'impression** — voir §17bis.

### Fonctions ajoutées au moteur

| Fonction | Rôle | Prompt | Tests |
|---|---|---|---|
| `synthetiseRegistre(rows)` | `{ nbLignes, surfaceTotale, cepages }` pour le bandeau replié du registre | 3 | §20 |
| `anneeRetourProduction(repos)` | `repos + 3` — l'année où la parcelle reproduit | 5 | §21 |
| `phasesParcelle(repos, horizon)` | segments `[debut, fin[` : arrachage, repos, plantier, production | 5 / 7 | §21 |
| `phaseParAnnee(repos, horizon)` | la même découpe, un identifiant par année | 7 | §21 |
| `tresorerieCumulee(scen, fv, vue, opt)` | `{ annuelle, cumulee }`, `opt.parcelleSeule` neutralise le reste de l'exploitation | 7 | §22 |
| `conformiteDensiteAOC(densite)` | bornes 8 000 / 10 000 pieds/ha, plus le **sens** du dépassement | 12 | §26 |
| `metresDeRang(geo)` | `nbRangs × L` — la longueur qui commande le palissage | 12 | §26 |

`tresorerieCumulee` **remplace** l'assemblage qui vivait dans `index.html`
(`serieRep` / `serieRepParcelle` / `cum`). Le test §22 rejoue littéralement
l'ancien code et compare, sur les trois vues de faire-valoir et les deux
périmètres : le déplacement ne change aucun chiffre.

## 4. Le parcours en 3 temps

> **Depuis la refonte d'interface (§3ter).** Les cinq étapes suivaient la
> structure du *calcul* — exploitation, parcelle, plantation, coûts, résultats
> — pas la conversation entre le conseiller et le vigneron. Elles sont
> ramenées à **trois moments d'entretien** : décrire ce qu'on a, décider ce
> qu'on fait, regarder ce que ça donne. **Rien n'est supprimé** : les cinq
> écrans deviennent cinq *sections*, deux par temps pour les deux premiers,
> séparées par un filet.

La barre de parcours est un **bandeau horizontal de trois pavés égaux**
(surtitre `TEMPS N` en mono, titre en N2, sous-titre listant le contenu) : trois
pavés larges se lisent en projection, une liste verticale de cinq lignes non.
À droite du bandeau, l'indicateur des onze repères (§6) et le point d'entrée du
panneau **Hypothèses** (§3ter). `#appGrid` est passé de trois colonnes à deux.

**Le bandeau est figé en haut de l'écran.** L'en-tête et la barre de parcours
sont réunis dans un unique conteneur `#barre-fixe` en `position:sticky;top:0` :
les trois temps et le bouton *Hypothèses* restent atteignables pendant tout le
défilement, y compris au temps 3 où les résultats sont longs. Un seul conteneur
collant plutôt que deux empilés, parce que la hauteur de l'en-tête varie
(lexique déplié, boutons qui passent à la ligne) : un `top:` chiffré pour la
barre serait faux dès qu'elle change. Le panneau **Hypothèses** est passé *sous*
ce conteneur — il reste dans le flux du document, sinon il occuperait à lui seul
tout l'écran figé.

La hauteur réellement rendue du conteneur est mesurée après chaque rendu et à
chaque redimensionnement (`mesurerBarre()`), puis publiée dans la propriété
`--barre-h` de l'élément racine — la propriété n'est réécrite que si la hauteur
a bougé. Deux choses s'y calent : la colonne latérale collante
(`top:calc(var(--barre-h) + 16px)`) et le `scroll-padding-top` de `html`, qui
empêche un champ atteint au clavier (« reprendre au premier repère », §6) de se
ranger derrière la barre. `--barre-h` est déclarée **hors** du bloc des jetons
de couleur : ce n'est pas une teinte, et les deux thèmes doivent déclarer
exactement les mêmes jetons (§27).

Le tout pilote un simple index `state.step` (0 à 2). Les booléens
`estEtape0`…`estEtape4` sont **conservés** et remappés
(`estEtape0 = estEtape1 = step === 0`, `estEtape2 = estEtape3 = step === 1`,
`estEtape4 = step === 2`) : cinq blocs de gabarit inchangés n'ont pas à être
réécrits pour un changement de découpage. Le calcul, lui, tourne sur
l'ensemble des champs à tout moment.

> `state.step` **n'entre pas** dans l'instantané `localStorage` (§19bis) : un
> instantané écrit par la version à cinq étapes se recharge donc tel quel,
> aucune migration n'est nécessaire. Un test fige cette absence.

| # | Temps | Sections | Contenu |
|---|---|---|---|
| 1 | **La parcelle** | *Votre exploitation* + *La parcelle désignée* | Registre parcellaire (bandeau replié, importable, corrigeable et complétable ligne à ligne — §6bis), surface totale et âge moyen **dérivés du registre**, VolCo, prix du raisin. Puis la **géométrie de la parcelle** avec son **schéma dessiné pendant la saisie** (§16) : surface arrachée (du registre), écart entre rangs, écart entre pieds, nombre de rangs — seuls champs saisis ; longueur de rang, densité, pieds à planter, conformité des écartements et **conformité de la densité aux bornes AOC** en sont déduits, jamais saisis. Puis âge, taux de pieds manquants et **régime de faire-valoir**, tous trois **dérivés du registre** (§6ter), et rendement estimé. |
| 2 | **Le projet** | *Quatre décisions, puis les références* (§4bis) | **Quatre cartes de décision**, chacune portant son propre dessin : durée de repos du sol (trois frises), année de pleine production (profil de montée en charge), palissage et conduite dérivés de la géométrie du temps 1 (§14, huit lignes en barres), entretien de la transition (bande de durées B.1 repos / B.2 plantier). Puis les **investissements ponctuels** (arrachage et préparation, plants, arrosage du plantier) et le bloc **Références** — variété plantée (11 options, des trois cépages principaux aux variétés VIFA) et porte-greffe, arbre d'aide au choix (calcaire / profondeur / drainage), table des clones de la variété retenue (informatif, §15). Les **tarifs** de palissage et de protection sont dans le panneau Hypothèses, pas ici : ce sont des références sourcées, pas des choix de projet. |
| 3 | **La trajectoire** | *Résultats* | **Trois chiffres de tête** en 36 px, puis la **frise de trajectoire à six pistes** (§18bis) et le panneau **« Année N »** qui donne les six chiffres de l'année retenue sur l'axe. Puis le bandeau climatique non repliable, les deux boutons d'impression, la synthèse rédigée et les réglages d'affichage (vue de faire-valoir, mode main d'œuvre, test de résistance). *(Le bloc « Ce que le renouvellement produit » — trois KPI physiques et deux graphiques repliables — a été retiré le 08/09/2026 : il doublonnait les chiffres de tête et la carte de thème « Réserve ».)* Le détail est rangé par **thème** : six cartes de synthèse (une par piste, avec son total sur l'horizon et trois à cinq lignes de détail), puis le détail du thème 5 (investissement poste par poste) et du thème 6 (régimes de travail et main d'œuvre), une bande compacte de récapitulatif technique, et la **matrice annuelle par thème** dans son volet repliable — cliquer une ligne y sélectionne l'année. |

> **Refonte du temps 3 (08/09/2026), §18bis et §19ter.** Les **cinq onglets**
> ont disparu : ils rangeaient l'écran par bloc de code et n'en montraient
> qu'un à la fois. La **trésorerie cumulée** est sortie de l'écran — piste de
> la frise, point bas, différentiel, cascade, et les phrases de synthèse qui
> les commentaient. Le volet « hypothèses de comparaison » est parti avec
> elles : `declinSQ` reste dans `state.v` et dans `inp` (le moteur le lit pour
> bâtir `sc.reference`), mais n'est plus saisissable — la fiche d'audit en
> donne la valeur, marquée **NON SAISISSABLE**. `state.ongletResultat` est
> remplacé par `state.anneeFrise`, également hors instantané `localStorage`.

La colonne de droite (`<aside>`, « Synthèse en continu ») est masquée pendant
qu'on décrit la parcelle (temps 1) et réapparaît dès le temps 2
(`syntheseVisible = step > 0`) : elle reprend un sous-ensemble des mêmes
résultats (surface, densité, pieds à planter, conformité AOC, investissement,
réserve mobilisée, solde investissement/réserve) puis, sous le surtitre
**RÉSERVE** — anciennement `RISQUE` —, deux grandeurs physiques : la réserve
minimale de la transition et ce que l'arrachage a **débloqué** sur la période.
Elle propose un raccourci direct vers le temps 3.

### 4bis. Le temps 2 — une décision par carte

> **Chantier « une décision par carte » (direction 1c v2).** Le temps 2
> s'ouvrait sur un titre, un paragraphe et **deux volets « Ajuster » refermés** :
> hormis le sélecteur de durée de repos, aucun contenu n'était visible, et
> l'écran ne portait **aucun graphique** — alors que le temps 1 dessine sa
> parcelle et le temps 3 sa frise. Le même contenu se range désormais en
> **quatre décisions, chacune portant son propre dessin**, suivies des
> investissements ponctuels et d'un bloc « Références » qui accueille tout ce
> qui est information hors calcul. **Aucun champ n'est supprimé ni rendu
> inaccessible** ; un test de parité le vérifie clé par clé.

Trois arbitrages tenus par cette refonte :

1. **Les volets « Ajuster » sont démontés** — les cartes redeviennent visibles.
   Il ne reste aucun volet « Ajuster » dans l'outil (celui du temps 1 avait
   disparu au prompt 12) ; `ajusterOuvert3` / `ajusterOuvert4` et leurs valeurs
   dérivées ont quitté `state` et `renderVals()`.
2. **Aucun montant de synthèse au temps 2** : l'investissement total, la réserve
   mobilisée et le solde investissement/réserve restent au temps 3. Le temps 2 n'affiche que les
   valeurs de ses propres champs et le total du palissage, qui y est calculé.
3. **Rien n'a bougé dans le moteur.** Toutes les grandeurs de l'écran existaient
   déjà ; aucune fonction n'a été ajoutée à `moteur-oad.js`, aucune formule n'a
   été recodée dans `index.html`.

Les deux anciennes sections (`estEtape2` « Ce que vous replantez » et
`estEtape3` « Ce que cela coûte ») fusionnent en **un seul flux** rendu sous le
seul `sc-if estEtape2`. Le remappage des booléens est **inchangé**
(`estEtape2 = estEtape3 = step === 1`, §4) : c'est le bloc `estEtape3` du
gabarit qui a disparu, faute de contenu propre.

**Le bandeau d'entrée** — quatre pavés (numéro, libellé, valeur retenue) — dit
ce qui est déjà décidé. Ce n'est pas une navigation, et il ne porte aucun lien :
l'outil ne met jamais rien dans l'URL (§19bis).

| Décision | Le dessin | Sa source dans le moteur |
|---|---|---|
| 1 · Combien de temps laisser le sol au repos | Trois frises de 11 années, une par durée : on choisit **dans** le dessin | `OAD.phasesParcelle(repos, horizon)` — la même découpe que la frise du temps 3 (§18bis), pour que les deux écrans racontent la même chronologie. Conséquences : `OAD.nbSortiePourRepos`, `OAD.anneeRetourProduction` |
| 2 · Quand la vigne produira à plein | Profil de montée en charge en barres, de l'année de repos à la pleine production | `OAD.rampeLineaire(anneePleineProd)` — c'est `inp.ramp`, indexé depuis l'année de retour en production ; le pourcentage n'est **jamais** recalculé ici |
| 3 · Comment le rang sera équipé | Les huit lignes de palissage en **barres proportionnelles**, triées par total décroissant | `OAD.coutPalissage(g, null, {espacementPiquet, nbFils, typeTaille, optionnelsExclus})` (§14). Le tri et la largeur des barres sont de la mise en forme ; quantités, prix unitaires et totaux viennent du moteur |
| 4 · Ce que la parcelle coûte pendant la transition | Bande de trois durées (repos, plantier, production) : les **largeurs sont les durées**, les chiffres les charges annuelles | Les trois sous-phases telles que `OAD.chargesEntretien` les facture : repos sur `[0, repos[`, plantier sur `[repos, repos + rampYears[`, production ensuite. Le troisième bloc est un **repère** (charge de référence du panneau Hypothèses) : bordure pointillée, il n'ajoute aucun coût au projet |

Les segments de frise ne portent **aucun libellé** : à 1/11 de la largeur, un
texte est systématiquement tronqué. Leur nom est dans le `title` et dans la
légende, rappelée une fois sous les trois frises — même règle que la frise du
temps 3 (§18bis).

**Deux points d'implémentation méritent d'être connus avant d'y toucher :**

- **La durée de repos se choisit sur trois `<button value="1|2|3">`** qui
  appellent le **même** gestionnaire que l'ancien `<select>` (`on.repos`), donc
  le même marquage de `champsTouches`. Le gestionnaire générique lit désormais
  `e.currentTarget.value` et non `e.target.value` : le clic peut atterrir sur un
  enfant du bouton (le libellé, un segment de frise), alors que `currentTarget`
  désigne toujours l'élément qui porte le gestionnaire — pour un `<input>` ou un
  `<select>`, c'est exactement cet élément, comportement inchangé.
  L'`id` **`f-repos` suit la valeur courante** (les deux autres boutons prennent
  `f-repos-2`, `f-repos-3`) : c'est la cible du chemin court « reprendre au
  premier repère » (§6), qui doit atterrir sur un contrôle visible et focusable.
- **L'année de pleine production a deux contrôles pour un seul champ** : quatre
  boutons segmentés (4ᵉ, 5ᵉ, 6ᵉ, 8ᵉ) et le champ numérique, pour toute autre
  valeur. Les boutons passent par `this.on.anneePleineProd`, exactement comme la
  frappe dans le champ — un seul chemin d'écriture, un seul marquage.

Les deux volets du bloc **Références** (`refAideOuverte` — l'ancien
`aideOuverte` — et `refClonesOuverte`) sont repliés
par défaut et **hors instantané `localStorage`**, comme tous les états de
navigation (§19bis). Chaque en-tête annonce son contenu en résumé : on doit
savoir ce qu'on ouvre sans avoir à l'ouvrir.

Quatre décisions de rédaction et de structure sur ce bloc, tranchées après coup
et qui ne sont pas des broutilles :

- son titre nomme le **contenu** (« Cépage, porte-greffe et clones ») et non
  « Matériel végétal », qui est déjà le libellé du premier champ juste en
  dessous. Un titre qui répète mot pour mot l'étiquette d'un de ses champs ne
  dit rien de plus, et laisse croire que le bloc ne porte que ce champ ;
- la réserve **« n'entre pas dans le calcul économique » n'est écrite qu'une
  fois**, dans l'en-tête, pour tout le bloc. Elle l'était trois fois de plus —
  sous le porte-greffe, dans le résumé du volet des clones et dans
  `clonesSourceTxt` — et une réserve répétée quatre fois finit par ne plus se
  lire nulle part. Reste en place la note de bas de table sur le **niveau de
  production**, qui dit autre chose : que l'échelle PlantGrape est qualitative
  et n'est pas un rendement en kg/ha ;
- **un seul sélecteur de matériel végétal**, la variété, qui commande la table
  de clones. Il remplace le couple `materiel` + `cepage`, qui pouvait se
  contredire (§6). Options écrites en dur dans le gabarit et non bouclées sur
  `VARIETES` : une interpolation est rendue dans un `<span>`, ce qu'un
  `<option>` n'a pas le droit de contenir ;
- **le volet « Fiche du porte-greffe retenu » a été retiré.** N'en subsiste que
  l'**avertissement**, en `.hint.warn` sous le sélecteur, et seulement pour les
  porte-greffes qui en portent un — en pratique le 161-49 C et ses
  dépérissements signalés depuis 2008. Ce n'est pas un reliquat : l'arbre
  d'aide au choix ne commente que les porte-greffes qu'il **recommande**, et un
  porte-greffe déconseillé n'y figure justement pas. Sans cette ligne, retenir
  le 161-49 C n'aurait plus rien affiché du tout. `PG_INFO` reste entier dans
  `index.html` — c'en est la source, et la description longue resservira si la
  fiche revient.

Classes ajoutées à la feuille de style : `.dec-grid`, `.dec-large`, `.dec`,
`.dec-h`, `.dec-num`, `.dec-pied`, `.dec3`, `.jalons`, `.jalon`, `.seg-groupe`,
`.seg-btn` (§3bis). Sous 900 px, `.dec-grid` et `.dec3` passent à une colonne,
au même seuil que `.grid`. **Aucun jeton de couleur nouveau**, et aucune couleur
littérale dans le gabarit : un test l'interdit (§27).

## 5. Le flux de données, de la frappe au résultat

```
Saisie utilisateur (input/select/range)
   │  onInput/onChange="{{ on.xxx }}"                    index.html (template)
   ▼
this.on[xxx](e)  →  setState({ v: { ...v, [xxx]: e.target.value } })   data-dc-script
   │
   ▼  React re-render  →  renderVals() ré-exécuté EN ENTIER
   │
   ├─ OAD.geometrieAgronomique(surf, eR, eP, nbRangs) → g  (densité, longueur de rang déduite,
   │                                            conformité AOC ; surf = v.surfArr en mode
   │                                            manuel, surface du registre en mode registre
   │                                            — chantier A4, §16)
   ├─ OAD.coutPalissage(g, …)             → cp  (préremplit coutPalissageHa si non édité)
   │
   ▼  construction de `inp` (l'objet attendu par le moteur)
inp = { geo, surfTot, surfParc:g.surf, ageMoy, ageParc, repos, nbSortie,
        volSortieArr, plafond, volco, rendMean, reserveInit, horizon,
        ramp, rampYears,                          // OAD.rampeLineaire(anneePleineProd) — chantier A3, §7bis
        rendYearFn, rendFactorProjet, rendEstime, manquants, declinSQ,
        densite, coutArrachageHa, coutPlant, coutPalissageHa,
        irrigation, coutIrrigHa, coutEntreplant, survie, prixKg,
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

> **Depuis la refonte d'interface (§3ter, §4).** Les sous-sections ci-dessous
> gardent l'ancienne numérotation en cinq écrans, qui reste la façon la plus
> claire de décrire *quel champ décrit quoi*. La correspondance avec les trois
> temps : écrans 1 et 2 → **temps 1**, écrans 3 et 4 → **temps 2**, écran 5 →
> **temps 3**. Les préréglages sourcés (charges Cerfrance, référentiel de temps
> de travaux et taux horaire, tarifs de palissage et de protection, paramètres
> de faire-valoir) ne sont plus dans le parcours : ils sont dans le **panneau
> Hypothèses** (§3ter). Aucun champ n'a disparu.

### Le chemin court — 11 repères (prompt B4, arbitrage 11)

Les 53 contrôles de l'outil sont hiérarchisés depuis le 01/09/2026 : **11
champs** restent au fil principal, le reste vivait dans un volet `.fold`
« Ajuster » replié, **au sein de son écran d'origine**. Aucun champ n'a été
supprimé ni rendu inaccessible ; chaque en-tête de volet affichait en résumé
les valeurs qu'il cachait, pour que replier n'enterre jamais un chiffre qui
pilote le calcul.

> **Il ne reste plus aucun volet « Ajuster ».** Celui du temps 1 a disparu au
> prompt 12 (loyer et parts de métayage dans le panneau Hypothèses, nombre de
> rangs remonté dans la carte « Géométrie de la parcelle ») ; les deux du temps
> 2 ont été démontés par le chantier « une décision par carte » (§4bis), qui
> rend leurs champs visibles dans quatre cartes de décision. La hiérarchie des
> 11 repères, elle, est inchangée : c'est le moyen de replier qui a disparu,
> pas la liste des repères.

| Écran | Les 11 repères |
|---|---|
| 1 | surface totale, âge moyen *(ou dérivés du registre)*, VolCo, prix du raisin |
| 2 | surface arrachée, âge de la parcelle, rendement estimé, régime de faire-valoir *(dérivé du registre, §6ter)*, écart entre rangs, écart entre pieds |
| 4 | durée de repos |

La liste vit dans `REPERES_CHEMIN_COURT` (`index.html`), avec pour chaque
repère son écran et l'`id` de son champ. Un indicateur discret et permanent
de la navigation latérale annonce « *n* repères sur 11 sont encore des
valeurs d'exemple » et emmène, d'un clic, au premier repère non touché en
lui donnant le focus. En mode registre, les repères dérivés du fichier de
l'exploitant comptent comme renseignés — ce sont ses données, pas un exemple.

**Drapeaux « champ touché ».** `state.champsTouches` marque chaque clé de
`v` réellement éditée, posé par le gestionnaire générique `on[k]` sur le
modèle de `palisManuel` / `protectionManuel`. Un champ reste « touché »
même si l'utilisateur y remet la valeur par défaut : ce qu'on suit, c'est
« ce chiffre a-t-il été regardé ». Ces drapeaux sont persistés avec
l'instantané (§19), sans quoi l'indicateur et le libellé de l'investissement
repartiraient à zéro alors que les valeurs, elles, seraient restaurées.

**Libellé de l'investissement (arbitrage 11).** Tant qu'aucun des quatre
postes `coutArrachageHa`, `coutPlant`, `coutPalissageHa`,
`coutProtectionHa` n'a été édité, le KPI s'intitule **« Coût de référence
Champagne »** — à l'écran 5, dans la synthèse latérale et dans la fiche
imprimable. Dès qu'un seul est modifié, il devient **« Votre
investissement »**. Le montant ne change pas ; seul change ce que le libellé
prétend.

**Champs retirés de l'interface (prompt C1), conservés dans `state.v`, dans
`inp` et dans le moteur :** `fracFormation` (coefficient de modélisation ;
sa valeur retenue reste affichée là où elle agit), `survie` et
`coutEntreplant` (n'alimentent que la complantation, jamais affichée).
`campagne` n'est plus une saisie du tout depuis le 07/09/2026 : voir le
paragraphe ci-dessous. Tous restent listés dans la fiche
d'audit imprimable, avec une provenance qui dit désormais « NON
SAISISSABLE » plutôt que « Saisi ».

Toutes les valeurs saisies vivent dans un seul objet, `state.v`, initialisé
avec ces valeurs par défaut (constructeur du composant, `index.html`). Un
repère de lecture avant la table : plusieurs champs ci-dessous (`declinSQ`,
`survie`, `coutEntreplant`…) n'alimentent que le statu quo ou la
complantation, calculés en interne comme contre-factuels (§12bis, décision
1) — leur valeur influence les KPI de l'écran 5 par différence, jamais un
scénario affiché à part entière. C'est signalé champ par champ ci-dessous.

### Étape 1 — Votre exploitation

| champ (`v.xxx`) | unité | défaut | rôle |
|---|---|---|---|
| `surfTot` | ha | 10 | surface totale de l'exploitation — dénominateur de l'effet âge et des charges statu quo. Ignoré en mode registre parcellaire, où il est dérivé du registre (§6bis) |
| `surfProdTot` | ha | — | **surface en production** : assiette du VolCo, du plafond et du stock de réserve (§7, §19quater). Dérivée du registre (`surfProd`) ; repli explicite `surfProdTot ?? surfTot` quand elle n'est pas fournie |
| `ageMoy` | ans | 38 | âge moyen du vignoble **avant** l'opération |
| `riPct` (curseur) | % | 75 | niveau actuel de réserve individuelle, en % du plafond 10 000 kg/ha → `reserveInit = 10000 × riPct/100` |
| `volco` | kg/ha | 9000 | volume commercialisable, fixé chaque année par le CIVC |
| `prixKg` | €/kg | 7 | prix unique du raisin (v1 : pas de distinction cépage/cru) |

**Charges de production à l'hectare** (§11 — chantier B1, déplacé depuis
l'écran « Coûts et charges » : ce sont des paramètres de référence de
l'exploitation, réutilisés à l'écran 5, pas des coûts spécifiques au
projet de renouvellement) :

| champ | unité | défaut | rôle | source |
|---|---|---|---|---|
| `coutSurfaceProdHaAn` | €/ha/an | 11400 | **charge liée à la surface**, vigne mature en production — et taux permanent du « reste » de l'exploitation | Cerfrance 2024 — charges de structure hors charges locatives (15 300 €/ha), amortissement (3 900 €/ha) retiré en totalité |
| `coutRdtParKg` | €/kg | 1.52 | **coût de la vendange** (vendange, transport, prestations récolte) — proportionnel aux kg récoltés, donc exprimé en €/kg et non en €/ha | Cerfrance 2024 — charges proportionnelles (~15 200 €/ha) ÷ rendement de référence 10 000 kg/ha |
| `tauxHoraire` | €/h | 17 (SMIC 2026 chargé) | conversion h → € dans le détail par opération ci-dessous |
| **heures manuelles / mécanisées à l'hectare** | h/ha | dérivées, 0 par défaut pour le volet mécanisé | détail par opération dépliable (`REF_OPS_MANUEL`, `REF_OPS_MECANISE`, `OAD.proposerVoletProduction()`) — chaque ligne (manuelle ou mécanisée) reste éditable ; agrégats affichés séparément (`voletProdHeuresTxt` / `voletProdHeuresMecaTxt`), voir journal d'arbitrages « chantier B1 » (§11) |

`coutSurfaceProdHaAn` peut être saisi directement ou **repris** d'un détail
par opération dépliable (volet « production », mêmes manuel/mécanisé que
ci-dessus), préremplissage opt-in décrit dans le journal d'arbitrages du
§11 (F4). `coutReposHaAn`/`coutPlantierHaAn` (charge de transition
propre à l'arrachage, pas un paramètre général de l'exploitation) restent
à l'étape 4, voir plus bas.

### Étape 2 — La parcelle désignée

**Géométrie** (→ objet `g`, `OAD.geometrieAgronomique()`, voir
[§16](#16-géométrie-de-plantation--oadgeometrieagronomique) — chantier A4
pour la formule, **chantier B2** pour son emplacement : bloc « Géométrie de
la parcelle » **en tête** de l'écran 2, déplacé depuis l'écran 3) :

| champ | unité | défaut | rôle |
|---|---|---|---|
| `surfArr` | ha | 1 | surface arrachée — pilote la géométrie (§16, chantier A4) ; ignoré en mode registre, où elle vient de la surface agrégée du registre (§6bis), affichée en lecture seule dans le même bloc |
| `ecartRang` | m | 1 | écartement entre rangs — pilote densité et conformité AOC |
| `nbRangs` | rangs | 100 | nombre de rangs — saisi (remplace la largeur déclarée), en mode registre comme en mode manuel |
| `ecartPied` | m | 1.10 | écartement entre pieds — pilote densité et conformité AOC |

Seuls ces 4 champs sont saisis dans le bloc géométrie ; longueur de rang,
densité, pieds à planter et badge de conformité AOC en sont **déduits**,
jamais saisis (§16). La longueur de rang n'est plus un champ depuis le
chantier A4 : elle est déduite (surface ÷ (nbRangs × écart rang)), affichée
à titre indicatif uniquement.

| champ | unité | défaut | rôle |
|---|---|---|---|
| `ageParc` | ans | 55 | âge de la parcelle candidate au renouvellement. Dérivé du registre en mode registre (§6bis) |
| `manquants` | % | 15 | taux de pieds manquants → dimensionne la complantation. Dérivé du registre en mode registre (§6bis) |
| `rendEstime` | kg/ha | 10500 | rendement actuel de la parcelle — sert au statu quo **et** à la complantation |
| `declinSQ` | %/an | 1 | déclin annuel de rendement si on ne touche à rien (statu quo) — défaut indicatif, à ajuster à la parcelle |
| `regime` | propriete\|fermage\|metayage | — | régime de faire-valoir, pilote la répartition des flux (§10). **N'est plus une saisie** : dérivé du registre parcellaire, colonne « Faire-valoir » (`mode_explo`) — voir §6ter. Ne figure plus dans `state.v` |
| `loyerHa` (si fermage) | €/ha/an | 3000 | loyer fermage → `fv.loyerAn = loyerHa × surfParc` (surface de la parcelle, pas de l'exploitation — voir §10) |
| `partRecolte` (si métayage) | % | 33 | part de recettes au propriétaire |
| `partCouts` (si métayage) | % | 33 | part de coûts au propriétaire |

### Étape 3 — Projet de replantation

Depuis le **chantier B2**, la géométrie de la parcelle n'est plus saisie
ici : voir « Étape 2 » ci-dessus. Depuis le **chantier B3**, l'écran ne
comporte plus que **deux blocs** (voir journal d'arbitrages, §15) :
« Matériel végétal et aide au choix », puis « Palissage et conduite ». Le
champ `irrigation` **n'est plus affiché ici** depuis le chantier B3 — voir
« Étape 4 » ci-dessous, qui l'a récupéré au chantier **B4**. La pénalité
VSL et son détecteur ont également été retirés (chantier B4, voir §11
journal d'arbitrages) : ni champ de saisie, ni badge, dans aucun écran.

**Bloc 1 — Matériel végétal et aide au choix.** Le simulateur d'aide au
choix (`calcaireActif`, `profondeurSol`, `drainageSol`, purement informatif,
alimente `OAD.preconPorteGreffe()`, §15, **hors calcul économique**) éclaire
la sélection définitive.

> Le **cépage a quitté ce volet** : il ne servait pas à l'arbre du Guide 2025,
> qui ne lit que le calcaire, la profondeur et le drainage — la signature de
> `preconPorteGreffe(calcaireActif, profondeurSol, drainageSol)` le dit. Il est
> remonté dans le sélecteur de variété, en tête du bloc, où il est retenu une
> fois pour tout l'écran.

| champ | défaut | rôle |
|---|---|---|
| `cepage` | Pinot noir *(ou le cépage dominant du registre, §6bis)* | **la variété plantée**, choisie parmi les 11 de `VARIETES` — commande la table de clones (`OAD.clonesParCepage`), **hors calcul économique** |
| `porteGreffe` | 41 B | affichage pur, alimente l'avertissement de `PG_INFO`, **hors calcul** |

> **`materiel` a été supprimé de `state.v`.** Il valait « vinifera » ou
> « Voltis » et vivait à côté de `cepage` sans qu'aucun des deux ne contraigne
> l'autre : rien n'empêchait de retenir « vinifera » **et** « Voltis ». Les deux
> sélecteurs ont fusionné en un seul, `cepage`, qui liste les **11 variétés
> plantables** — Chardonnay, Pinot noir, Meunier, Pinot blanc, Pinot gris,
> Arbane, Petit Meslier, Chardonnay rose, puis Voltis, Orellis et Serelis
> (VIFA). La **nature** du matériel (*Vitis vinifera* ou variété résistante) en
> est **dérivée** par la table `VARIETES` d'`index.html` et dite en une ligne
> sous le sélecteur ; elle n'entre, comme avant, dans aucun scénario. Un
> instantané `localStorage` antérieur porte encore `materiel` : `fusionnerV`
> l'ignore sans bruit, aucune migration n'est nécessaire.
>
> **Orthographe : « Arbane »**, celle du cahier des charges de l'AOC Champagne,
> et non « Arbanne » qu'on rencontre aussi. `cepageAffichage()` reconnaît les
> deux dans les codes du registre (test sur « ARBAN ») ; l'écran n'en écrit
> qu'une.
>
> **Liste VIFA — Voltis, Orellis, Serelis — confirmée par le commanditaire le
> 07/09/2026.** ⚠ Elle **évolue** : la revérifier à chaque diffusion. C'est le
> seul entretien que demande la table `VARIETES`.
>
> Le référentiel de **clones**, lui, n'a pas bougé : 42 lignes, Chardonnay,
> Pinot noir et Meunier seulement (§15). Pour les huit autres variétés, la table
> n'est ni affichée vide ni comblée — le volet dit qu'aucune ligne n'existe au
> référentiel retenu et renvoie au catalogue officiel, à plantgrape.fr ou au
> Comité Champagne. C'est la même règle que les cellules vides de la table.

**Bloc 2 — Palissage et conduite.**

| champ | unité | défaut | rôle |
|---|---|---|---|
| `typeTaille` | — | guyot | mode de conduite (dont Chablis, chantier A5) — alimente `nbFils` par défaut et `OAD.coutPalissage()` |
| `anneePleineProd` | années | 5 | année de pleine production, comptée depuis la plantation (l'année 3 est l'entrée en production, 3e feuille) ; alimente `inp.ramp` via `OAD.rampeLineaire()` — chantier A3, remplace le sélecteur de paliers 30/60/100 % (§7bis) |

**Dimensionnement du palissage** (`typeTaille`, `nbFils`, `espPiquet`) :
alimente `OAD.coutPalissage()` (§14), qui **préremplit** `coutPalissageHa`
tant que l'utilisateur ne l'a pas édité à la main (drapeau
`state.palisManuel`, remis à `false` par le bouton « ↻ Reprendre la valeur
dérivée de la géométrie »). Depuis le **chantier A5**, chaque ligne du
détail porte une catégorie obligatoire/optionnelle ; seules les lignes
optionnelles sont décochables (§14).

### Étape 4 — Coûts et charges

Depuis le **chantier B4**, l'écran ne comporte plus que **deux blocs**
(voir journal d'arbitrages, §11) : BLOC A « Investissements liés à la
parcelle arrachée puis replantée », BLOC B « Entretien en deux temps ». Le
volet « production » (`coutSurfaceProdHaAn`, `coutRdtParKg`, `tauxHoraire`)
n'apparaît **pas** ici : c'est un paramètre de référence de l'exploitation,
déplacé à l'étape 1 par le chantier B1 (§11 F9) — sa réapparition ici
casserait la règle « aucun poste compté deux fois entre écran 1 et écran 4 ».

**BLOC A — Investissements** :

| champ | unité | défaut | rôle |
|---|---|---|---|
| `repos` | 1\|2\|3 ans | 1 | durée de repos du sol choisie librement par le vigneron ; détermine `nbSortie` via `OAD.nbSortiePourRepos()` (§7) — chantier A2, décision CIVC de juillet 2026 non encore publiée |
| `coutArrachageHa` | €/ha | 22500 | prestations d'arrachage **et** préparation de la parcelle, **tout compris** (arrachage + évacuation des souches + amendement calcaire + préparation du sol), année 0 — source MHCS, voir journal d'arbitrages §12 |
| `coutPlant` | €/pied | 2.10 | matériel végétal à acheter (plant), année `repos` (× densité) — source MHCS |
| `coutPalissageHa` | €/ha | 12000 (prérempli ≈13116-14577 selon relevé) | matériel de palissage à acheter, année `repos` — voir §14 |
| `coutProtectionHa` | €/ha | 10000 (prérempli, chantier P8) | protection du matériel végétal à acheter (tuteur + cache-plant), année `repos` — poste séparé du palissage, voir journal d'arbitrages §12 |
| `irrigation` | '0' (non) | active `coutIrrigHa` dans l'investissement — **déplacé depuis l'écran 3** (chantier B4, options de coût à l'installation) |
| `coutIrrigHa` | €/ha | 5000 | irrigation, année `repos`, si activée |
| `survie` | % | 50 | taux de survie des entreplants (complantation, non exposée à l'écran 5 depuis le chantier A1) |
| `coutEntreplant` | €/pied | 4.5 | matériel végétal à acheter pour la complantation (coût par entreplant), année 0 — supposé inclure déjà tuteur + cache-plant, hypothèse non vérifiée (voir §12) |

Le début de montée en charge des entreplants (ex-champ `entreeProd`, années,
défaut 7) n'est plus un champ éditable depuis le **chantier A3** : le champ
UI a été renommé et repurposé pour `anneePleineProd` (étape 3) ; la
complantation, non exposée à l'écran des résultats depuis le chantier A1,
garde son ancien défaut (7 ans) fixé en dur dans `moteur-oad.js` (voir §7bis).

**BLOC B — Entretien en deux temps** (modèle à 3 volets, §11 — le volet
« production » vit à l'étape 1, voir plus haut) :

| champ | unité | défaut | rôle | source |
|---|---|---|---|---|
| `coutReposHaAn` | €/ha/an | 0 | B.1 — entretien de la parcelle au repos (`t < repos`) | assumé — à caler (hors périmètre du chantier 2) |
| `coutPlantierHaAn` | €/ha/an | 8000 | B.2 — entretien du plantier (`repos ≤ t < repos+rampYears`) | MHCS — taille de formation + remplacement des plants morts |
| `fracFormation` | ratio | 0,35 | applique le volet production à la ligne « taille de formation » du volet B.2 |

Depuis le **chantier 2** (calibration Cerfrance/MHCS), `coutPlantierHaAn`
est calé sur une source professionnelle — seul `coutReposHaAn` reste nul
(assumé, à recaler séparément, hors périmètre de ce chantier). Ces deux
taux de charge peuvent être saisis directement ou **repris** d'un détail
par opération dépliable (B.1 « repos », B.2 « plantier »), préremplissage
opt-in décrit dans le journal d'arbitrages ci-dessous (F4, puis chantier
B4 pour la liste d'options). `tauxHoraire` (SMIC 2026 chargé, 17 €/h) est
saisi une seule fois, à l'étape 1 avec le volet « production » (§6), et
réutilisé ici pour convertir h → € dans les volets B.1/B.2.

### Étape 5 — Résultats

| champ | défaut | rôle |
|---|---|---|
| `v.horizon` | `'10'` (10 ans) | sélecteur 10 / 25 ans → `inp.horizon` ; recalcule les 3 scénarios sur toute la durée choisie (§17) |
| `sequence` (« Test de résistance ») | aucune | force une ou deux années à `12296,6 − 3440` kg/ha (écart-type régional), appliqué **à l'identique** aux 3 scénarios |
| `state.vueFV` | `'1'` (Ensemble) | bascule Ensemble / Part exploitant / Part propriétaire — traverse `OAD.repartir()` avant cumul (§10) |
| `state.moExterne` | `true` (Prestataire) | bascule Prestataire / Familiale de l'encadré « main d'œuvre économisée » — affichage uniquement, jamais dans le calcul (§11 F7) |

## 6bis. Le registre parcellaire — seule source des surfaces et des âges

**Chantier 1, puis prompt B8.** Le registre a d'abord été un *mode de saisie
alternatif* : deux boutons « Saisie manuelle » / « Registre parcellaire »
basculaient `state.sourceParcellaire`, `'manuel'` par défaut.

**Arbitrage du 01/09/2026 (prompt B8) : la saisie manuelle disparaît.** Le
registre est la **seule** source. Les deux boutons de bascule et
`out.setSourceManuel` ont été retirés des étapes 1 et 2, avec toutes les
branches `!modeRegistre` de ces deux écrans. `state.sourceParcellaire` reste
en place, figé à `'registre'` : le pont vers le moteur et les libellés de
provenance de l'écran 5 le lisent encore, sous forme de ternaires désormais
toujours vrais — leur nettoyage est un lot à part, hors du prompt B8.

`surfTot`, `ageMoy`, `surfParc`, `ageParc`, `manquants` et `cepage` sont donc
**dérivés d'un tableau de parcelles**, jamais saisis. Les clés correspondantes
de `V_DEFAUTS` (`v.surfTot`, `v.ageMoy`, `v.surfArr`, `v.ageParc`,
`v.manquants`) subsistent comme filet interne côté moteur ; seule leur
exposition en interface a disparu.

**Contrepartie assumée : le registre doit pouvoir se remplir à la main.**
Rendre le registre obligatoire sans lui donner l'ajout et la suppression de
lignes aurait rendu l'outil inutilisable pour qui n'a pas d'export CSV du
portail CIVC sous la main — voir « Ajout et suppression de lignes » ci-dessous.

**État bloquant du registre vide.** Quand `agregExploitation.surfTot` vaut 0
(registre vide, ou toutes lignes à 0 ha), l'étape 1 remplace les deux champs
dérivés par un bandeau « Ajoutez au moins une ligne au registre pour
continuer » (`out.registreSansSurface`) plutôt que d'afficher `0 ha` et un âge
moyen indéterminé. Le test porte sur la **surface**, pas sur le nombre de
lignes : dix lignes à 0 ha ne valent pas mieux qu'aucune ligne. C'est un
garde-fou d'**interface** : côté moteur, `simulerReserveKg` protégeait déjà
ses divisions (`surfProd === 0 ? 0 : …`), et un test dédié le fige (§18,
section 19 des tests).
**Ce que le registre donne aussi, et qui ne tient pas dans deux nombres.**
`OAD.repartirRegistreParAge(rows, campagne)` en tire la part déjà arrachée,
la part plantée et la surface par classe d'âge (`[0,10[`, `[10,30[`,
`[30,50[`, `[50,∞[`). C'est la source du graphique « La composition de votre
vignoble » affiché juste sous les deux champs dérivés — voir §18ter.


**Origine des données — jeu d'exemple, pas d'import réel.** `state.registreRows`
est peuplé au chargement à partir d'une constante `REGISTRE_EXEMPLE_CSV`
(`index.html`, chaîne CSV `;`-séparée codée en dur, 12 lignes), parsée par
`parseRegistreCSV()` (résolution des colonnes par en-tête, indépendante de
l'ordre ; normalisation de `situation` en `'plantee'`/`'arrachee'`).
### Import de l'export portail CIVC (prompt B2)

Un bouton **« Importer mon registre »** à l'étape 1 lit un CSV local via
`<input type="file">` et `FileReader` : **aucun envoi, aucune donnée en
URL**. Le fichier est parsé par `parseRegistreCSV()`, dont la résolution des
colonnes par en-tête rend l'ordre du fichier indifférent.

**Colonnes attendues, confirmées le 01/09/2026** (`COLONNES_CIVC`) :
`idu`, `commune`, `num_civc`, `mode_explo`, `cepage`, `anneeplant`,
`surface_ss_parcelle`, `productivite_moyenne`, `taux_manquant`,
`enroulement`, `court_noue`, `situation`.

`parseRegistreCSV()` sait *résoudre* une colonne mais pas *constater* qu'elle
manque — il produirait des zéros silencieux. D'où `colonnesManquantes()` :
si une colonne obligatoire est absente, le message d'erreur **la nomme** et
**la table en place n'est pas remplacée**. Un fichier sans ligne de données
est refusé de même. L'écrasement est précédé d'une confirmation qui
mentionne explicitement la perte des corrections saisies.

Après un import réussi, `state.parcelleIdu` est reposé sur la première
parcelle plantée et `state.parcelleLignesExclues` est vidé : tous deux sont
indexés sur la **position** des lignes et deviendraient faux en silence.

L'onglet et le titre du tableau s'intitulent **« Registre parcellaire —
exemple »** tant qu'aucun import n'a eu lieu ; le drapeau `registreImporte`
est persisté avec l'instantané, sinon un registre importé se présenterait à
nouveau comme le jeu d'exemple après rechargement.

### Édition des cellules (prompt B2, arbitrage 2 — révisé au prompt B8)

Au prompt B2, seules les quatre colonnes qui **pilotent le calcul** étaient
saisissables (`surface`, `anneePlant`, `tauxManquant`, `situation`) ; `idu`,
`commune` et `cepage` restaient en lecture, « identifiants du fichier », et
il n'y avait **ni ajout ni suppression** de lignes.

**Prompt B8 : toutes les colonnes sont saisissables**, `idu` et `commune`
comprises. La raison tient en une phrase : puisqu'il peut n'y avoir aucun
fichier, il n'y a plus d'« identifiants du fichier » à protéger. Ce qui n'a
pas changé : l'exclusion de lignes de la parcelle désignée reste un mécanisme
de l'**étape 2**, distinct de la suppression pure et simple de l'étape 1.

Deux colonnes ont un effet au-delà de leur cellule (`majCelluleRegistre`) :
renommer l'`idu` de la parcelle désignée **emmène la désignation avec lui** ;
passer en « Arrachée » la dernière ligne Plantée d'un `idu` force une
redésignation. Dans les deux cas c'est `OAD.resoudreParcelleIdu()` qui
tranche — une seule règle pour l'édition, la suppression et le chargement.

### Ajout et suppression de lignes (prompt B8)

Un bouton **« + Ajouter une ligne »** sous le tableau de l'étape 1 et un
bouton **✕** par ligne. Aucune confirmation : rien n'est détruit ailleurs que
dans ce navigateur, et l'instantané local n'est pas versionné — une boîte de
dialogue ne protégerait de rien qu'elle puisse rendre.

**Valeurs par défaut d'une ligne ajoutée** (`OAD.ligneRegistreVierge()`,
assumées, sans source) : `idu` et `commune` vides — ce sont des identifiants
CIVC que le vigneron connaît, l'outil n'en invente pas ; `cepage`
`CHARDONNAY B` ; `anneePlant` = campagne − 10 ; `surface`, `tauxManquant` à
0 ; `situation` `plantee` ; `modeExplo` `propriete` — le seul régime qui ne
prélève rien (§6ter). Une ligne vierge n'apporte donc **aucune surface**
et ne lève pas à elle seule l'état bloquant.

**`_id` change de nature.** C'était la position de la ligne, réattribuée à
chaque parsing et à chaque relecture de l'instantané. Depuis que des lignes
peuvent être supprimées, c'est une **identité** : `state.nextRowId` est un
compteur monotone (`OAD.prochainIdRegistre()`), initialisé au-dessus du plus
grand `_id` présent et jamais reculé — un identifiant libéré par une
suppression n'est jamais réattribué. Sans cela, `state.parcelleLignesExclues`,
qui indexe par `_id`, ferait glisser un décochage sur une ligne voisine.
`nextRowId` n'est **pas** persisté : il se recalcule à l'identique depuis les
lignes au chargement suivant.

En conséquence, `fusionnerRegistre()` ne renumérote plus : les `_id` d'un
instantané sont relus tels quels, et seules les lignes qui n'en portent pas
de valide (instantané antérieur au prompt B8, ou doublon) en reçoivent un
nouveau, pris au-dessus du plus grand déjà présent.

Les cellules stockent la **frappe brute** (« 0, », « 1,2 », vide en cours de
correction) : la conversion en nombre se fait au seul point qui alimente le
moteur, dans `renderVals()`. Sans cela, un champ que l'utilisateur est en
train de vider se remplirait d'un 0 sous ses doigts.

### Persistance (prompt B1)

Le registre **persiste** désormais, sous forme d'instantané, avec le reste
des saisies — voir §19. Ce qui est enregistré est le **tableau avec ses
valeurs déjà corrigées**, jamais un diff ni un identifiant de ligne : au
rechargement on relit la table telle quelle, ce qui rend inutile toute clé
stable de ligne. `_id` est réattribué par position à chaque parsing ; c'est
un index de rendu, jamais une identité persistée. Rien n'est envoyé hors du
navigateur, et un bandeau le rappelle à l'utilisateur.

> **Ajout du prompt 13.** L'instantané porte désormais aussi le **thème**
> (`clair` / `sombre`) : l'outil est montré au vidéoprojecteur, on ne veut pas
> rebasculer à chaque ouverture. Il vit **hors de `state.v`**, qui reste
> l'objet des saisies — « Effacer mes données » ne le remet donc pas à zéro,
> ce n'est pas une donnée de simulation. Un instantané écrit avant ce prompt,
> ou porteur d'une valeur inconnue, retombe sur le **sombre**, désormais le
> défaut : seule la valeur `clair` explicitement enregistrée rend l'outil clair. Ce qui n'entre
> toujours PAS dans l'instantané : l'étape courante, l'année retenue sur la
> frise du temps 3 (`anneeFrise`, qui a remplacé `ongletResultat` le
> 08/09/2026), les volets ouverts ou repliés, le panneau Hypothèses, le
> registre replié — ce sont des états de navigation.

**Étape 1 — agrégation exploitation.** `OAD.agregerRegistreExploitation(registreRows,
campagne)` (`moteur-oad.js`) renvoie
`{ surfTot, surfProd, surfPlantier, surfRepos, ageMoy }` :
`surfTot` = somme de **toutes** les lignes (plantées + arrachées, une
parcelle arrachée reste une surface de l'exploitation, en repos) ;
`surfProd` = **surface en production**, seules les lignes plantées d'âge
≥ `SEUIL_ENTREE_PRODUCTION` (3 ans, valeur *à valider*, §19quater) ;
`surfPlantier` = lignes plantées sous ce seuil ; `surfRepos` = lignes
arrachées. Les trois forment une **partition** de `surfTot`
(`surfTot = surfProd + surfPlantier + surfRepos`) : `surfProd` est
l'assiette réglementaire que le moteur consomme sous le nom `surfProdTot`
(VolCo, plafond et stock de réserve — §7, §19quater), `surfTot` reste la
surface d'affichage et le dénominateur des charges du reste de
l'exploitation ;
`ageMoy` = moyenne pondérée par surface, **excluant** les lignes arrachées
du numérateur et du dénominateur (une parcelle sans vigne en terre n'a pas
d'âge de vigne). La référence des âges (`age = campagne − anneePlant`) est
`CAMPAGNE_COURANTE`, constante d'`index.html` fixée à l'année courante du
navigateur (`new Date().getFullYear()`) au chargement.

> **La campagne de référence n'est plus paramétrable (07/09/2026).** Elle
> était un champ du volet « Ajuster » de l'écran 1 (`v.campagne`) ; c'est
> désormais toujours l'année en cours. Personne n'a de raison de dater le
> vignoble d'une autre année que celle où il est regardé, et le paramètre
> coûtait un champ à comprendre. `CAMPAGNE_COURANTE` vit **hors de
> `V_DEFAUTS`** : ce n'est pas une saisie, donc rien à persister, rien à
> restaurer, rien à « reprendre ». Un instantané localStorage écrit par une
> version antérieure porte encore `v.campagne` ; `fusionnerV` l'ignore sans
> bruit, puisqu'il ne remplace que des clés existantes de `V_DEFAUTS` —
> aucune migration n'est nécessaire. Le volet « Ajuster » de l'écran 1, dont
> elle était la dernière occupante, disparaît avec elle (comme celui du
> temps 1 avant lui : un volet vide ne reste pas à l'écran), et avec lui
> `ajusterOuvert1` / `toggleAjuster1` / `ajusterResume1` /
> `ajusterChevron1`. Rien ne change au calcul : la valeur par défaut de
> l'ancien champ était déjà l'année en cours.

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
mélange plusieurs cépages — l'UI n'a qu'un seul champ cépage, voir §15),
et enfin `regime` / `regimeMixte` — le régime de faire-valoir dominant en
surface et son alerte de mélange, sur le même modèle que le cépage (§6ter).

**Branchement dans `inp`.** En mode registre, `renderVals()` (`index.html`)
substitue les valeurs dérivées à celles de `state.v` : `inp.surfTot`,
`inp.ageMoy`, `inp.ageParc`, `inp.manquants` (= `tauxManquant/100`)
viennent du registre plutôt que des champs `v.surfTot`/`v.ageMoy`/
`v.ageParc`/`v.manquants`. `inp.fv.regime` s'y ajoute (§6ter), à ceci près
qu'il n'a plus de champ de repli : `v.regime` a disparu de `state.v`. `agregParcelle.surfParc` cascade jusqu'à
`fv.loyerAn = loyerHa × surfParcResolu` (§10) et, depuis le **chantier A4**
(§16), jusqu'à la géométrie elle-même : `OAD.geometrieAgronomique(surf, …)`
reçoit `agregParcelle.surfParc` comme `surf` (donc `surfParcResolu = g.surf
=== agregParcelle.surfParc`, sans écart) et n'en dérive que la longueur de
rang — la densité, elle, continue de dépendre uniquement des écartements,
indépendamment du mode actif. (Avant le chantier A4, cette surface passait
par une réconciliation « largeur équivalente » aujourd'hui obsolète, voir
§16.)

## 6ter. Le faire-valoir au registre — un régime par parcelle

Le régime de faire-valoir se saisissait dans un bloc à part, au bas du
temps 1 (`v.regime`, un sélecteur à trois valeurs), et valait pour **toute**
la parcelle désignée. C'était une approximation commode : une exploitation
champenoise possède telle parcelle, en loue une autre en fermage et en
travaille une troisième en métayage. Un régime global obligeait à choisir
lequel des trois décrivait le moins mal l'ensemble.

**Le faire-valoir est désormais une propriété de la ligne**, au même titre
que le cépage ou la situation. Il tient dans la colonne `mode_explo` que le
format d'export du portail CIVC prévoyait déjà (§6bis) — elle existait au
format sans que rien ne la lise. Le tableau du registre porte une colonne
**« Faire-valoir »** saisissable ligne à ligne (Propriété / Fermage /
Métayage), et le bloc du bas du temps 1 a disparu.

**Trois écritures, une seule chose.** `OAD.normaliserRegimeFv(brut)` accepte
le code du fichier CIVC (`FD`, `FE`, `MET`…), le libellé en toutes lettres
(« Métayage »), et la clé interne écrite par le sélecteur (`metayage`). Une
valeur vide, absente ou inconnue retombe sur `propriete` : c'est le régime
majoritaire en Champagne, et le seul qui n'ajoute ni loyer ni part de
récolte — à défaut d'information, l'outil ne prélève rien plutôt que
d'inventer un prélèvement. Un registre importé d'une version antérieure,
dont la colonne `mode_explo` est vide, se comporte donc exactement comme
avant ce chantier.

**Le régime du calcul est dérivé, jamais saisi.**
`OAD.agregerRegistreParcelle()` renvoie, à côté de `surfParc`, `ageParc` et
`tauxManquant`, deux champs de plus :

| Champ | Règle |
|---|---|
| `regime` | régime **dominant en surface** parmi les lignes retenues de la parcelle désignée ; `propriete` sur une sélection vide |
| `regimeMixte` | `true` si les lignes retenues mêlent plusieurs régimes |

La pondération est **en surface**, pas en nombre de lignes : c'est la
surface qui porte les flux que `repartir()` découpe entre exploitant et
propriétaire (§10). En cas d'égalité parfaite, l'ordre de `REGIMES_FV`
tranche — deux rendus du même registre ne doivent jamais donner deux
réponses, et réordonner ses lignes ne doit pas changer son résultat.

**Ce que l'écran affiche.** Le temps 1 montre le régime dérivé en lecture
seule, dans la même grille que l'âge et les pieds manquants, avec la mention
« dérivé du registre — régime dominant en surface ». Une sélection à régimes
mêlés est **signalée**, pas bloquée : l'outil est pédagogique, mais il ne
peut appliquer qu'un régime, et l'utilisateur doit savoir que celui qu'il lit
ne décrit qu'une partie de sa parcelle. Le tableau de la parcelle désignée
affiche lui aussi le faire-valoir de chaque ligne, en lecture — cocher ou
décocher une ligne sans voir son régime reviendrait à changer le calcul à
l'aveugle.

**Ce qui ne bouge pas.** `loyerHa`, `partRecolte` et `partCouts` restent des
saisies, dans le panneau Hypothèses : ce sont des **montants**, pas un
régime. `repartir()` (§10) est inchangé — il reçoit toujours un seul
`fv.regime`, c'est son origine qui a changé. `state.v` perd sa clé `regime` :
rien à persister ni à restaurer, la valeur se recalcule à chaque rendu depuis
le registre. Un instantané localStorage écrit avant ce chantier porte encore
`v.regime` ; `fusionnerV` l'ignore sans bruit, puisqu'il ne remplace que des
clés existantes de `V_DEFAUTS` — aucune migration n'est nécessaire.

Le repère « régime de faire-valoir » reste l'un des **11 repères** du chemin
court, mais rejoint les repères dérivés du registre (surface totale, âge
moyen, surface arrachée, âge de la parcelle) : il compte pour renseigné, et
son `id` vise le sélecteur de parcelle désignée, d'où l'on voit le
faire-valoir des lignes retenues.

## 7. Le moteur kg — `simulerReserveKg`

C'est la fonction centrale (`moteur-oad.js:8`). Elle simule, année par
année de `t=0` à `t=horizon` (10 ans par défaut, ou 25 — §6), le compte de réserve individuelle
(kg/ha) d'**un** scénario. Elle est appelée trois fois par
`construireScenarios` (une fois par scénario), avec des paramètres
différents.

Notations : `surfArr` = surface de la parcelle concernée (`surfParc`),
`surfProdTot` = **surface en production** de l'exploitation (`surfProd` du
registre ; repli sur `surfTot` quand l'appelant ne la fournit pas — §19quater),
`surfRest = surfProdTot − surfArr` = le reste de l'exploitation (non concerné
par l'opération, produit toujours à `rendMean`), `fProjet =
rendFactorProjet` = pénalité de rendement du projet — hook générique du
moteur (`?? 1`, §7bis/moteur-oad.js:13), non alimenté par l'UI depuis le
**chantier B4** (vaut 1 en pratique ; portait la pénalité VSL avant ce
chantier, voir §11 journal « chantier B4 »).

**Étape 1 — rendement de l'année :**
```
rendY = rendYearFn(t)  si fourni (test de résistance, étape 5)
      = rendMean        sinon (12 296,6 kg/ha, moyenne régionale)
```

**Étape 2 — surface productive et récolte, selon le scénario :**

- **`arrachage`** — la parcelle sort totalement de production pendant le
  repos, puis revient progressivement :
  ```
  returnYear = 3 + repos                    // repos = 1, 2 ou 3 ans (choix libre, chantier A2)
  jeune      = t ≥ returnYear
  f          = ramp[t − returnYear]  si jeune et dans la table ramp, sinon 1
  surfProd        = surfRest + (jeune ? surfArr : 0)
  recolteReste    = rendY·surfRest
  recolteParcelle = jeune ? rendY·f·fProjet·surfArr : 0
  recolte         = recolteReste + recolteParcelle
  ```
  Le facteur projet (`fProjet`, hook `rendFactorProjet`) ne s'applique
  **qu'au bloc replanté**, jamais au reste de l'exploitation — vaut 1 en
  pratique depuis que l'UI ne l'alimente plus (chantier B4).

- **`complantation` / `statuquo`** — la parcelle reste en production toute
  la période, mais avec un rendement propre `rendParcFn(t, rendY)` :
  ```
  surfProd        = surfProdTot                              // toujours plein
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
stockDebut = reserveInit × surfProdTot   si t = 0
           = stockFin de l'année t−1     sinon
```
`reserveInit` (kg/ha) est assis sur `surfProdTot` (**surface en
production**) pour les trois scénarios — et non sur `surfTot`, qui
compterait aussi les plantiers et les parcelles en repos, lesquels
n'ouvrent aucun droit à réserve. Voir §19quater.

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
`plafond = 10000 kg/ha` est fixé en dur dans `renderVals()` (non éditable
dans l'UI — voir §19). Depuis le **chantier A2** (§7bis), `volSortieArr` et
`nbSortie` viennent du moteur (`OAD.VOL_SORTIE_ARRACHAGE`,
`OAD.nbSortiePourRepos(repos)`) plutôt que d'être câblés dans `index.html`.

**Étape 8 — stock de fin d'année et ratio à l'hectare :**
```
stockFin = max(0, stockDebut + mise − sortieInsuff − sortieArr)
stockHa  = stockFin / surfProd      (0 si surfProd = 0)
```

**Sortie**, une ligne par année : `{t, surfProd, rendY, recolte,
recolteParcelle, recolteReste, volcoVendu: min(recolte,volco)+sortieInsuff,
volcoCible: volco, mise, deficit, sortieInsuff, sortieArr, stockDebut,
stockFin, stockHa}`.

### 7bis. Journal d'arbitrages — chantier A2 : uniformisation de l'arrachage

**Décision.** Décision CIVC de juillet 2026 (**non encore publiée** à ce
jour — mention de statut réglementaire affichée dans l'UI tant qu'elle ne
l'est pas). Le motif d'arrachage classique/sanitaire, qui commutait un
booléen entre deux couples `(repos, nbSortie)` figés (1 an/3 déblocages ou
3 ans/5 déblocages), disparaît. Le vigneron choisit désormais librement une
durée de repos du sol de **1, 2 ou 3 ans** (`v.repos`, étape 4), qui
détermine mécaniquement le nombre de déblocages de réserve : 1→3, 2→4, 3→5,
toujours à `VOL_SORTIE_ARRACHAGE = 9000` kg/ha (inchangé).

**Où vit la règle.** Conformément à la contrainte du projet (toute logique
métier dans `moteur-oad.js`, jamais dans `index.html`), la table
1/3-2/4-3/5 est encodée une seule fois dans le moteur :
`NB_SORTIE_PAR_REPOS = {1:3, 2:4, 3:5}` et la fonction
`nbSortiePourRepos(repos)` qui la lit (lève une erreur si `repos` n'est pas
1, 2 ou 3). `VOL_SORTIE_ARRACHAGE` (9000 kg/ha, valeur inchangée) est
également exposé comme constante du moteur plutôt que câblé en dur dans
`renderVals()`. `index.html` ne fait plus qu'appeler
`OAD.nbSortiePourRepos(v.repos)` et lire `OAD.VOL_SORTIE_ARRACHAGE` — il ne
recode aucune règle.

**Ce qui ne change pas.** La distinction sanitaire ne disparaît pas
entièrement : elle change de **statut**, passant de règle réglementaire
(qui commutait `repos`/`nbSortie`) à **poste de coût optionnel** dans le
détail par opération du volet « repos » (case à cocher « Inclure la
dévitalisation court-noué », `voletReposCourtNoue` / `REF_REPOS`, §11) —
ce mécanisme, indépendant du motif, n'est pas touché par ce chantier.
`returnYear = 3 + repos` (§7, étape 2) reste une formule générale, valable
pour les trois durées de repos sans modification.

### 7ter. Journal d'arbitrages — chantier A3 : remplacement des paliers de montée en charge

**Décision.** Le sélecteur « Montée en charge jeunes vignes » (3 profils
câblés en dur : 30·60·100 %, 50·80·100 %, immédiate) disparaît. Le vigneron
ne saisit plus qu'une seule donnée, `v.anneePleineProd` : l'année de pleine
production, comptée depuis la plantation. Identité de calendrier respectée :
l'année 3 est l'entrée en production (3e feuille), qui coïncide exactement
avec `returnYear = 3 + repos` (premier millésime sans déblocage de réserve,
§7) — c'est la borne basse imposée au champ (min 3, max 12).

**Où vit la règle.** `OAD.rampeLineaire(anneePleineProd)` (`moteur-oad.js`)
porte seule la formule : `n = anneePleineProd − 2` paliers annuels depuis
l'entrée en production, chacun valant `(i+1)/n` (progression linéaire,
`i` de 0 à `n−1`) ; lève une erreur si `anneePleineProd < 3`.
`index.html` appelle cette fonction et assigne son résultat à `inp.ramp`
(consommé par `simulerReserveKg` comme avant, §7) et à `inp.rampYears`
(sa longueur) — il ne recode aucune progression. Exemples : `anneePleineProd
= 3` → `[1]` (pleine production immédiate) ; `= 6` → `[0,25 · 0,5 · 0,75 · 1]`
soit 25 % · 50 % · 75 % · 100 %, affiché en clair à côté du champ.

**LIMITE ASSUMÉE — arbitrage A (échelons uniformes) contre l'arbitrage C
(ancrage agronomique).** Ce chantier retient une rampe **uniforme** :
`n = anneePleineProd − 2` échelons égaux, quel que soit `n`. L'arbitrage
écarté (« C », ancrage agronomique) aurait fait dépendre la forme de la
courbe de l'âge réel de la vigne (progression non linéaire type
3e/4e/5e feuille), indépendamment de `n`. Conséquence directe, à
documenter noir sur blanc pour ne pas être découverte en recette et prise
pour un bug : **le rendement de 3e feuille (premier point de la rampe,
`ramp[0] = 1/n`) devient fonction de l'année de pleine production saisie,
pas de l'âge de la vigne** — pour une vigne physiquement identique en 3e
feuille, `ramp[0]` vaut 50 % si `anneePleineProd = 4` (`n=2`) mais environ
16,7 % si `anneePleineProd = 8` (`n=6`, `1/6`). Testé explicitement en
section 15 de `tests/parite.test.js` (chantier C3). Voir §12bis, décision 3.

**Point de vigilance — `rampYears`.** `chargesEntretien` et `moEconomisee`
(`moteur-oad.js`, §11) lisent `inp.rampYears ?? (inp.ramp ? inp.ramp.length
: 3)` pour délimiter la fenêtre « plantier » (charge de transition,
`coutPlantierHaAn`). Comme `inp.ramp` reste alimenté (même clé qu'avant ce
chantier), ce repli aurait techniquement suffi, mais `index.html` alimente
désormais `inp.rampYears` explicitement (`= rampeProfil.length`) pour ne pas
dépendre implicitement de ce repli.

**Champ renommé et repurposé — effet de bord sur la complantation.** Le
champ UI `v.entreeProd` (panneau « Complantation (entreplants) », borne
min 3/max 12 — d'où la réutilisation des mêmes bornes ici) portait en
réalité un rôle **différent et sans rapport** : le début, à âge fixe, de la
montée en charge des entreplants dans `rendParcCompl` (§8), une formule à
elle indépendante de `repos`. Ce champ est renommé/repurposé en
`v.anneePleineProd` pour l'arrachage ; `index.html` n'alimente donc plus
`inp.entreeProd`. Pour ne pas modifier silencieusement ce calcul interne,
`moteur-oad.js` retombe sur le défaut historique du champ
(`inp.entreeProd ?? 7`, voir §8) — la complantation continue d'être
calculée à l'identique de son défaut d'avant ce chantier, mais n'est plus
éditable : acceptable tant qu'elle reste hors interface (chantier A1) ; à
revoir si un chantier futur la réexpose à l'écran.

## 8. Ce qui distingue les 3 scénarios

**Lecture après le chantier A1 (24/07/2026, §12bis) : `moteur-oad.js` calcule
toujours 3 scénarios, mais un seul est un scénario au sens de l'interface.**
`arrachage` est le seul exposé à l'écran 5. `statuquo` (alias `reference`)
est le contre-factuel interne de tous les différentiels affichés (manque à
gagner, écart d'âge, charges évitées…) — il n'est jamais montré comme un
choix parmi d'autres. `complantation` est conservée pour compatibilité
(`@deprecated`), hors interface depuis le chantier A1. Le tableau ci-dessous
documente les 3 formules telles qu'elles vivent dans le moteur, pas 3
scénarios que l'utilisateur pourrait sélectionner.

| | `arrachage` | `complantation` | `statuquo` |
|---|---|---|---|
| Surface productive | `surfRest`, puis `surfProdTot` après `returnYear` | toujours `surfProdTot` | toujours `surfProdTot` |
| Rendement de la parcelle | `rendMean·f·fProjet` une fois relancée | `rendParcCompl(t, rendY)` — monte de `rendEstime` vers un rendement cible qui suppose les manquants comblés à 100 % (pondérés par un facteur de récupération), à partir de `entreeProdCompl` (7 ans, fixé en dur depuis le chantier A3, §7ter — plus alimenté par l'UI) | `rendParcSQ(t, rendY) = rendY·(rendEstime/rendMean)·(1−declinSQ)ᵗ` |
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
prog(t)      = 0                              si t < entreeProdCompl
             = min(1, (t − entreeProdCompl + 1)/3)  sinon   // montée linéaire sur 3 ans
rendParcCompl(t, rendY) = rendY · (ratio + (ratioCible − ratio) · prog(t))
```
Modèle rejeté — « on plante une fois » : coût sans ÷ `survie` (pas de
réachat des pieds morts) et rendement pondéré par `survie` (ex-formule).
Rejeté car incohérent avec le champ « Coût par entreplant » de l'UI, dont
le calcul présuppose déjà un réachat implicite compensant la mortalité.

Depuis le **chantier A3** (§7bis), `entreeProdCompl = inp.entreeProd ?? 7` :
`index.html` n'alimente plus `inp.entreeProd` (le champ UI qui le portait a
été renommé/repurposé pour l'arrachage), le moteur retombe donc sur le
défaut historique du champ (7 ans) — formule et sortie inchangées tant que
la complantation reste hors interface (chantier A1).

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

**F9 — chantier B1 : remontée des charges de production à l'écran 1.** Le
bloc « production » (`coutSurfaceProdHaAn`, `coutRdtParKg`, détail par
opération manuel/mécanisé, `tauxHoraire`) correspond en réalité aux coûts
de production opérationnels à l'hectare de **l'exploitation** — un
paramètre de référence, pas une donnée du projet de renouvellement.
Déplacé de l'écran 4 (« Coûts et charges ») vers l'écran 1 (« Votre
exploitation »), sans toucher au modèle à 3 volets ci-dessus : seule la
localisation des champs de **saisie** change, la fonction `chargesEntretien`
et sa lecture de `inp.coutSurfaceProdHaAn`/`inp.coutRdtParKg` sont
inchangées (`state.v` est un objet plat, indépendant de l'étape affichée —
`renderVals()` recalcule tout à chaque rendu quelle que soit l'étape
active, §5). `coutReposHaAn`/`coutPlantierHaAn` (charge de transition,
propre au calendrier d'arrachage `repos`) restent à l'écran 4.

*Inventaire avant création — champs demandés par la note de cadrage vs.
existant.* Quatre champs demandés : heures de travail manuel/ha, heures de
travail mécanisé/ha, charge liée à la surface/ha, coût de la vendange/ha.
**Aucun champ nouveau n'a été créé** — les quatre couvraient déjà de
l'existant :
- *Charge liée à la surface* → `coutSurfaceProdHaAn` (réutilisé tel quel).
- *Coût de la vendange* → `coutRdtParKg` (réutilisé tel quel). Nuance
  signalée plutôt que masquée : ce champ est exprimé en **€/kg**
  (proportionnel à la récolte réellement simulée), pas en €/ha comme le
  demande littéralement la note de cadrage — c'est la seule ligne du modèle
  qui porte le concept « coût de la vendange », et la reformuler en €/ha
  aurait exigé soit un nouveau champ non branché au calcul, soit une
  modification du modèle (interdite par ce chantier). Le champ garde son
  unité native ; le libellé UI dit « Coût de la vendange » sans prétendre à
  un €/ha qu'il n'est pas.
- *Heures manuel/ha* et *heures mécanisé/ha* → déjà **saisissables**,
  ligne par ligne, dans le détail par opération existant
  (`REF_OPS_MANUEL`/`REF_OPS_MECANISE`, `OAD.proposerVoletProduction()`,
  `state.voletProdOverrides`) : chaque opération manuelle ou mécanisée a
  son propre h/ha éditable (opt-in, défauts Avenant 217 pour le manuel,
  `0`/« à sourcer » pour le mécanisé — inchangés). Seul ajout : un agrégat
  d'affichage `voletProdHeuresMecaniseHa` (heures mécanisées totales),
  calculé par un simple `filter().reduce()` sur la sortie déjà existante de
  `proposerVoletProduction()` (`index.html`, aucune formule nouvelle côté
  moteur) — symétrique de `voletProdHeuresManuellesHa`, qui existait déjà
  avant ce chantier.

**Chaînage vérifié vers l'écran 5.** `coutSurfaceProdHaAn`/`coutRdtParKg`
alimentent `inp` exactement comme avant (`index.html`, construction de
`inp`, inchangée) → `OAD.construireScenarios(inp)` → `chargesEntretien()` →
KPI « Charges évitées en transition » / différentiel statu quo affiché à
l'écran 5. Aucune étape de ce chaînage ne dépend de l'étape UI active.

### Journal d'arbitrages — chantier B4 : écran 4 restructuré en deux blocs

**Décision.** L'écran 4 passe de 3 cartes (« Investissement ponctuel »,
« Complantation », « Charge de transition ») à exactement **2 blocs** :
**BLOC A** « Investissements liés à la parcelle arrachée puis replantée »
(fusionne l'ancien « Investissement ponctuel » et « Complantation » —
matériel de palissage, matériel végétal, protection du matériel végétal,
prestations d'arrachage/préparation, options de coût à l'installation, et
la complantation, elle-même un investissement en matériel végétal) et
**BLOC B** « Entretien en deux temps » (ex-« Charge de transition »,
renommé, contenu inchangé : B.1 repos, B.2 plantier). Pur réagencement
d'`index.html` ; `moteur-oad.js` n'est touché que pour retirer le
détecteur `vsl` (voir plus bas), aucune formule de coût n'est modifiée.

**Irrigation relocalisée, chantier B3 refermé.** Le sélecteur « Ferti-
irrigation du plantier » (`v.irrigation`), retiré de l'écran 3 au chantier
B3 sans nouveau domicile, rejoint le BLOC A, sous-section « Options de coût
à l'installation », aux côtés du coût `coutIrrigHa` déjà présent ici. Champ
et calcul strictement inchangés (`inp.irrigation` construit exactement
comme avant) — seul l'emplacement dans l'UI change.

**VSL retirée de l'interface, hook moteur conservé.** Le champ `penaliteVSL`
(saisie) et le badge dérivé (`g.vsl`, « VSL »/« Traditionnelle », conseil
de diamètre de fil porteur) disparaissent intégralement de l'UI :
- `v.penaliteVSL` retiré de `state.v` ; `fDens` (passé à `inp.rendFactorProjet`)
  est désormais câblé en dur à `1` dans `renderVals()` (`index.html`),
  au lieu de `g.vsl ? (1 − penal) : 1`.
- `geometrieAgronomique()` (`moteur-oad.js`) ne renvoie plus de champ `vsl`
  (ex `eR ≥ 1.5`) — code mort une fois la pénalité retirée de l'UI, retiré
  par la même occasion (déjà signalé comme candidat par le chantier A4).
  Testé avant/après (`node tests/parite.test.js`, aucune référence à `.vsl`
  dans les tests) : 70 ok, 0 FAIL, inchangé.
- **`rendFactorProjet` n'est PAS retiré du moteur.** `simulerReserveKg`
  (§7, `moteur-oad.js:13`) continue de lire `p.rendFactorProjet ?? 1` — un
  hook générique, indépendant de la VSL par construction, que d'autres
  chantiers pourraient réutiliser (ex. une pénalité Voltis). Seul l'appel
  depuis `index.html` cesse de l'alimenter avec autre chose que `1`.
  Vérifié manuellement : appeler `simulerReserveKg` avec
  `rendFactorProjet: 0.8` continue de pondérer `recolteParcelle` comme
  avant — le hook reste actif.
- Résidus retirés en cascade, tous strictement dérivés de `g.vsl`/`penaliteVSL`
  et donc devenus orphelins : le badge « Conduite » (`syMode`) de l'écran 2,
  les entrées « VSL »/« Traditionnelle » et « Fil porteur » de l'encart
  conséquences (écran 3), les deux lignes correspondantes de la fiche
  imprimable (`printInpRows`).
- Le contrôle de conformité AOC (`aoc.rang/pied/somme`, rang ≤ 2,00 m) est
  **conservé sans modification** : structurellement indépendant de `vsl`
  dans `geometrieAgronomique()`, comme le confirmait déjà le chantier A4.

**« Entretien du paysage ».** Recherché dans `index.html`/`moteur-oad.js` :
**aucun champ existant** ne porte ce nom ou ce libellé — rien à retirer.

**B.1/B.2 — options d'entretien alignées sur la note de cadrage.**
`REF_REPOS` (`index.html`) gagne une ligne « Tontes » (absente
jusqu'ici) et relabellise « Couvert végétal » → « Couverture végétale
(naturelle ou semée) », « Désherbage » → « Désherbage mécanique », pour
correspondre explicitement à la liste attendue (couverture végétale,
tontes, désherbage mécanique, dévitalisation, sous-solage) ; toutes les
nouvelles lignes restent à `0`, « à caler — dire d'expert coop », comme
leurs voisines — aucune valeur n'est inventée. `REF_PLANTIER` gagne une
ligne « Désherbage » (absente jusqu'ici, même défaut nul) et relabellise
« Remplacement des reprises ratées » → « Remplacement des plants morts » ;
« Taille de formation » existait déjà comme ligne dérivée dynamique
(fraction du volet production, chantier F4/F5) — non dupliquée. Les lignes
« Surveillance / relève de la protection (MO) » et « Entretien du
palissage posé », non citées par la note de cadrage, sont **conservées**
plutôt que retirées : la première existe spécifiquement pour l'anti-
double-compte du chantier P8 (§12) et sa suppression aurait rouvert ce
risque sans instruction explicite en ce sens.

**Discipline anti-double-comptage vérifiée.** L'encart d'avertissement en
tête du BLOC B (« Ne pas inclure l'installation… ») est resté **strictement
identique, caractère pour caractère**, à sa version d'avant ce chantier.
Les tests §11 vérifiant que `coutProtectionHa` s'ajoute à l'investissement
exactement à `t = repos` (jamais `t = 0`) n'ont pas été touchés par ce
chantier et continuent de passer sans modification — la restructuration de
l'écran ne déplace aucune formule, seulement des champs de saisie.

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
puis t=`repos`) est inchangé, pour les deux motifs d'arrachage alors en
vigueur (classique, `repos=1` ; sanitaire, `repos=3`) — motif depuis
remplacé par un choix libre de `repos` (1/2/3 ans), voir §7bis, chantier A2.

> **État à date (postérieur à P3).** La formule ci-dessus décrit
> `invArr[repos]` **tel qu'il sortait du chantier P3**. Le chantier **P8** y a
> depuis ajouté `coutProtectionHa` (protection du jeune plant, 10 000 €/ha par
> défaut). La composition en vigueur est donc :
> `invArr[repos] = surfParc × (densite·coutPlant + coutPalissageHa +
> coutProtectionHa + (irrigation ? coutIrrigHa : 0))`.
> C'est cet écart d'un chantier à l'autre qui avait laissé la fiche d'audit
> décrire une formule fausse jusqu'au **chantier C2** (voir ci-dessous).

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

**Sortie** (depuis le **chantier A1**, voir journal d'arbitrages ci-dessous —
renommage + qualification, aucun changement de calcul) :
```
{ arrachage:     { kg, eur, investissement: Σ invArr  },   // scénario exposé
  reference:     { kg, eur, investissement: 0          },  // ex-statuquo — RÉFÉRENCE INTERNE, non affichable
  statuquo:      { … même objet que `reference` … },        // alias de compatibilité (tests, code existant)
  complantation: { kg, eur, investissement: Σ invCompl} }   // @deprecated chantier A1 — calcul conservé, plus exposé
```
`investissement` est volontairement **hors charges d'entretien** : c'est
la base du KPI « Investissement net de la réserve mobilisée » (§17,
ex-« Effort net après réserve », renommé et déclampé au chantier C3), qui
répond à « quelle part de l'opération la réserve ne couvre pas »,
indépendamment de charges
d'exploitation récurrentes qui existeraient de toute façon.

### Journal d'arbitrages — chantier C2 : la fiche d'audit documentait une formule fausse (07/09/2026)

**Défaut constaté.** L'entrée « investissement (brut) » de `out.printKpiRows`
(fiche d'audit imprimable, `index.html`) annonçait la formule
`S × coûtArrachageHa (an. 0) + S × (coûtPrepaHa + densité × coûtPlant +
coûtPalissageHa + irrigation × coûtIrrigHa) (an. repos)`. Deux erreurs, dans
le même sens :

- elle citait **`coûtPrepaHa`**, champ supprimé au chantier P3 ci-dessus
  (double emploi avec le forfait MHCS `coutArrachageHa`) — il n'existe plus
  nulle part dans le moteur ;
- elle **omettait `coûtProtectionHa`**, ajouté au chantier P8 et valant
  10 000 €/ha par défaut.

Conséquence mesurée : un lecteur qui recalculait à la main tombait sur un
écart de **`surfParc` × 10 000 €/ha** par rapport au montant affiché en face
de la formule — soit 5 000 € sur la parcelle de 0,5 ha des valeurs par
défaut — sans aucun moyen de comprendre d'où il venait. La fiche d'audit
étant le document destiné au conseiller / comptable, un écart inexpliqué y
coûte plus cher qu'ailleurs : c'est précisément le document dont on attend
qu'il soit recalculable.

**Correction.** Formule alignée sur le bloc `invArr` de
`construireScenarios` :
```
an. 0     : S_parcelle × coûtArrachageHa
an. repos : S_parcelle × (densité × coûtPlant + coûtPalissageHa
                          + coûtProtectionHa + irrigation × coûtIrrigHa)
```
Vérification aux valeurs par défaut de l'interface : 30 927,20 € par la
formule affichée contre 30 927,20 € rendus par le moteur — écart nul.
L'ancienne formule donnait 25 927,20 €.

**Périmètre strictement documentaire.** *Aucun* calcul n'est touché :
`invArr` est inchangé, `coutPrepaHa` n'est pas réintroduit, et les autres
entrées de `printKpiRows` sont laissées en l'état (elles relèvent des
chantiers C5 et C7). Les mentions de `coutPrepaHa` subsistant dans ce README
sont toutes dans le présent journal, où elles documentent sa suppression :
elles doivent y rester.

**Garde-fou.** Le test « C2 — composition de l'investissement arrachage »
(`tests/parite.test.js`, section 31) fige *numériquement* la composition
plutôt que la chaîne d'affichage : sur un jeu d'entrées où les quatre postes
de l'installation sont non nuls simultanément (protection et irrigation
comprises), il vérifie que `arrachage.investissement` vaut exactement la
somme des deux engagements, et qu'une variation unitaire de chaque paramètre
déplace le total de son coefficient exact. Une dérive future de la
composition casse donc un test, et le commentaire posé au-dessus de
`printKpiRows` renvoie explicitement à `invArr`. Un troisième test, lui
textuel, garde la chaîne affichée exempte de `coûtPrepaHa` et porteuse de
`coûtProtectionHa`.

### Journal d'arbitrages — chantier C3 : déclampage du solde investissement/réserve et réserve à l'horizon (07/09/2026)

Deux défauts corrigés **ensemble**, parce qu'ils ne doivent jamais s'afficher
l'un sans l'autre.

#### (a) Le clamp

`index.html` calculait `const effortNet = Math.max(0, invest − reserveReelle)`.
Ce plancher à zéro écrasait toute la région où la réserve couvre
l'investissement — c'est-à-dire **le cas dominant**. Aux valeurs par défaut :
réserve mobilisée ≈ 189 000 € contre ≈ 61 300 € d'investissement, soit un
solde réel de ≈ −127 700 € affiché « 0 € ».

Un indicateur constant sur son domaine principal n'est pas une simplification,
c'est une perte d'information. Mesure faite sur un jeu où la réserve est le
facteur limitant (`volco` au-dessus du rendement moyen, donc aucune mise en
réserve possible), en faisant varier le curseur `riPct` de 0 à 100 % :

| `riPct` | solde (depuis C3) | ancien KPI clampé |
|---:|---:|---:|
| 0 % | +15 891 € | +15 891 € |
| 10 % | +10 884 € | +10 884 € |
| 20 % | +3 884 € | +3 884 € |
| 30 % | −3 009 € | **0 €** |
| 50 % | −16 119 € | **0 €** |
| 70 % | −29 122 € | **0 €** |
| 100 % | −40 809 € | **0 €** |

L'ancien KPI était plat sur plus de 70 % de la plage. Le nouveau est continu et
monotone sur toute la plage — c'est le critère d'acceptation du chantier, tenu
par le test « C3 — CRITÈRE D'ACCEPTATION » (section 32 de `tests/parite.test.js`).

De plus, « 0 € à financer » se lit « gratuit », ce que le modèle ne dit pas.

#### (b) L'asymétrie de la réserve, et pourquoi la correction est physique

`cashRI` monétise la **sortie** de réserve ; le **stock consommé** n'a aucun
coût. C'est assumé (« aucune valeur terminale d'actif », §19) mais
**directionnel** : cela penche toujours du même côté. Deux régimes très
différents se cachent derrière le même solde en euros :

- réserve **saturée au plafond** : le déblocage est réellement gratuit, le
  stock aurait été perdu de toute façon ;
- réserve **non saturée** : c'est un prélèvement de plusieurs milliers de kg/ha
  sur un stock qui manquera plus tard, invisible partout ailleurs.

**La règle du projet reste entière : le stock de réserve n'est JAMAIS
monétisé.** La correction retenue est **physique** (kg/ha), jamais monétaire —
`OAD.reserveHorizon(scArr, scRef, horizon)` ne reçoit **aucun paramètre
monétaire** et doit rester structurellement incapable de produire un euro,
comme `trajectoireAge`. Un garde-fou dédié le vérifie en faisant varier
`prixKg` (« C3 — GARDE-FOU : reserveHorizon ne produit aucun euro »).

*Rejeté — valoriser le stock consommé, même « à titre indicatif » et entre
parenthèses* : un lecteur qui voit un euro le soustrait, quel que soit
l'avertissement qui l'accompagne.

*Rejeté — un badge « réserve saturée / non saturée »* : nommer le régime
ajoute du vocabulaire là où deux nombres suffisent. La ligne affichée est une
comparaison directe, qui se lit seule :

> Réserve à 10 ans : **4 514 kg/ha**, contre **7 650 kg/ha** sans renouvellement.

#### (c) Localisation

Le calcul vivait dans la vue, en violation de la règle « toute logique
financière dans `moteur-oad.js` ». Il est rapatrié : deux fonctions pures,
`soldeInvestissementReserve(scenArr)` et `reserveHorizon(scArr, scRef, horizon)`,
exportées via `module.exports` et `window.OAD`.

#### Contrainte d'adjacence — non négociable

La ligne de réserve à l'horizon est rendue **immédiatement sous** le solde,
**dans le même bloc de template**, sous un **unique** `sc-if`. Il ne doit
exister aucun état de l'interface où le solde s'affiche sans elle — état
dégradé compris (les deux sont repliés ensemble sur le même `kpiVide`), et
phrase de synthèse comprise (`syntheseSoldeTxt` est immédiatement suivi de
`reserveHorizonTxt`).

Raison : lu seul, un solde négatif se lit comme un excédent, alors que c'est un
déstockage. Un commentaire le dit explicitement des deux côtés — dans le
template à l'endroit du rendu, et dans le script au-dessus de
`out.kpiReserveHorizon` — pour qu'une session ultérieure ne les sépare pas en
croyant aérer la mise en page. Le test « C3 — ADJACENCE » le vérifie
structurellement (ordre, absence de conditionnel entre les deux, unicité du
repli, présence du commentaire).

#### Vocabulaire

- **« effort net » disparaît.** Nouveau libellé : **« Investissement net de la
  réserve mobilisée »**.
- **« à financer » disparaît de ce KPI.** Aucun coût de financement n'est
  modélisé — ni taux, ni durée, ni différé (§19). La question du financement
  est portée par le **point bas de trésorerie**, pas par ce solde.
- L'ancien `det`, « investissement − réserve = coût réel de décision », était
  **faux** : ce n'est pas le coût réel de la décision (qui supposerait un
  différentiel — voir chantier C4), c'est un solde de financement. Remplacé par
  une description de la soustraction, sans qualification.
- Cas négatif : **« Réserve mobilisée au-delà de l'investissement : X € »**.
  Les mots **« excédent », « gain », « bénéfice » sont interdits** ici et un
  test les refuse : ce n'est pas un profit, c'est un déstockage.

#### Renommages

`effortNet` → `soldeInvestReserve` ; `out.effortNetTxt` → `out.soldeReserveTxt`
(+ `soldeReserveAbsTxt`, `soldeEstNegatif`) ; `out.kpiEffortNet` →
`out.kpiSoldeReserve` (+ `out.kpiReserveHorizon`) ; `state.effortNetOuvert` →
`state.soldeReserveOuvert`. Ce dernier est un état de navigation, **hors
instantané `localStorage`** : le renommer ne casse aucun instantané écrit par
une version antérieure.

#### Hors périmètre, explicitement

`simulerReserveKg`, `coucheEuro` et `chargesEntretien` ne sont pas touchés.
Aucun taux d'emprunt n'est introduit. La réserve n'est convertie en euros nulle
part.

### Journal d'arbitrages — chantier C4 : le différentiel par rapport à « ne rien faire » (07/09/2026)

#### Le problème

Un simulateur d'**impact** dont tous les chiffres sont absolus ne mesure aucun
impact : « impact » est un mot différentiel. Le différentiel existait déjà dans
le code (`creux`, `manqueAGagner`) mais avait été retiré de l'écran au
chantier P6.

Démonstration, mesurée sur le moteur avec les valeurs par défaut rendues par
l'interface :

| Paramétrage | Différentiel trésorerie parcelle à 10 ans | Réserve consommée nette |
|---|---|---|
| Défauts UI (`rendMean` 12 296,6) | **+15 700 €/ha** | 0 kg/ha (réserve saturée) |
| Vendange dégradée (`rendMean` 8 856,6 = moy. − σ) | **−68 000 €/ha** | 3 136 kg/ha |

**84 000 €/ha d'écart entre les deux mondes — et dans les deux, l'écran
affichait le même « 0 € » et le même point bas.** Les deux KPI de tête étaient
insensibles à la variable qui décide de tout.

> **Note de reproduction.** Les tests de la section 33 figent ce comportement
> sur une fixture explicite (`INP_C4`, 10 ha d'exploitation / 1 ha renouvelé,
> charges calibrées) et non sur les défauts de l'interface : densité, palissage
> et protection y sont dérivés d'une géométrie que `tests/parite.test.js` ne
> reconstruit pas. Sur cette fixture, le différentiel vaut **+10 840 €** en
> vendange nominale et **−162 018 €** en vendange dégradée. Les magnitudes
> diffèrent donc du tableau ci-dessus ; le comportement — changement de signe,
> écart de plusieurs dizaines de milliers d'euros — est le même, et c'est lui
> que les tests gardent.

#### Ce que l'arbitrage retient, et ce qu'il refuse

L'arbitrage **ne rétablit pas** le comparateur supprimé par la note de cadrage
de juillet 2026. Le contrefactuel reste invisible **comme scénario
configurable** et devient visible **comme point de référence arithmétique**,
sur une ligne.

Interdictions explicites — elles sont le cœur de l'arbitrage, et un test les
tient (« C4 — INTERDICTIONS ») :

- aucune seconde courbe sur les graphiques ;
- aucune colonne « statu quo » dans un tableau ;
- aucun champ de saisie relatif au scénario de référence (`declinSQ`, déplacé
  par C1, reste le seul) ;
- ce chiffre ne monte **pas** dans les trois chiffres de tête (36 px) :
  `teteRetour` / `teteEffort` / `teteAge` restent inchangés ;
- **aucune formulation évaluative** (« favorable », « rentable », « perdant »,
  « recommandé ») : un montant signé et son libellé, rien d'autre. Le principe
  « aucune recommandation » tient.

#### Le calcul

`OAD.differentielTresorerie(scArr, scRef, fv, vue, opt)` réutilise **telle
quelle** `tresorerieCumulee(…, { parcelleSeule: true })` sur les deux scénarios
et retourne `{ annuel[], cumule[], aHorizon }`. **Aucune règle nouvelle** :
c'est une soustraction terme à terme de deux séries déjà produites par le
moteur. Ne pas y introduire d'actualisation, de pondération ni de traitement du
signe.

- `parcelleSeule: true`, et non la trésorerie de l'exploitation : sur
  l'exploitation entière, le revenu du reste du domaine noie l'effet de
  l'opération (déjà vérifié au test P6).
- Vue de faire-valoir : **la même que le reste de l'écran**, sans exception.
- Le code nouveau lit **`sc.reference`**, jamais l'alias historique
  `sc.statuquo`. Un test le vérifie.

#### Affichage

Une **ligne unique**, en clôture de l'écran de résultats, libellée « Par
rapport à ne rien faire, à 10 ans », affichée **toujours**, quel que soit le
signe (aucun `sc-if` propre au différentiel ne l'entoure — testé). Son détail
énonce la *convention* du chiffre (parcelle seule, horizon, vue de
faire-valoir), parce qu'un différentiel dont on ignore l'assiette n'est pas
interprétable ; il ne dit rien de ce qu'il faudrait en conclure. La ligne
figure aussi sur la fiche d'audit, avec sa formule, comme tout autre chiffre.

#### Critère d'acceptation

Basculer le test de résistance climatique fait changer le différentiel affiché
de plusieurs dizaines de milliers d'euros. Avant ce chantier, rien ne bougeait
à l'écran.

#### Point de révision assumé

C4 fait primer le principe de crédibilité du projet sur la lettre de la note de
cadrage de juillet 2026. **Si cette note visait explicitement à ce qu'aucun
chiffre négatif ne soit montré au vigneron, C4 est à rejeter — mais il faut
alors aussi retirer `manqueAGagner` de la fiche d'audit**, sans quoi la
contradiction est simplement déplacée.

### Journal d'arbitrages — chantier C5 : une cascade unique en remplacement des montants épars (07/09/2026)

#### Le problème

L'écran et la fiche d'audit exposaient **six montants en euros** : investissement
brut, solde investissement/réserve, point bas de trésorerie (parcelle seule,
**absolu**), tension max vs statu quo (**différentielle**, calculée mais
masquée), manque à gagner cumulé, charges évitées. Ils mélangeaient trois axes —
parcelle / exploitation, absolu / différentiel, ponctuel / flux — **sans
qu'aucun ne dise sa convention**. Le lecteur ne pouvait pas les hiérarchiser.

Le problème n'était pas qu'il manquait des chiffres : il en manquait **un seul
qui ordonne les autres**.

#### ⚠️ La contrainte de conception, et pourquoi elle est dure

**La cascade doit être une décomposition EXACTE du différentiel de C4, pas un
empilement d'indicateurs existants.**

Vérification faite avant le chantier : les quantités historiques **ne se
recomposent pas**. Sur le paramétrage dégradé,
`−invest + réserve + chargesEvitees − manqueAGagner` donne **−44 054 €** alors
que le différentiel réel vaut **−67 975 €** — **23 921 € d'écart**. Les causes
sont connues, et ce sont des troncatures :

- `chargesEvitees` ne somme que sur `t < returnYear` et ne retient que les
  écarts positifs (`max(0, …)`) ;
- `manqueAGagner` applique lui aussi un `max(0, …)` et ne porte que sur
  `volcoVendu` (donc mélange parcelle et reste de l'exploitation).

**Une cascade qui ne tombe pas juste est pire que six chiffres épars : elle
donne l'apparence de la rigueur.** Les termes sont donc redéfinis comme une
décomposition du différentiel lui-même — sans plancher, sans fenêtre tronquée.

#### La décomposition

Sur la parcelle seule, arrachage − référence, sur tout l'horizon. Elle est
**exacte par construction**, puisque `tresorerieCumulee(parcelleSeule)` vaut
`Σ(venteRaisinParcelle + cashRI − coutsParcelle)` et que
`coutsParcelle = invArr ⊎ chargesEntretien.parcelle` :

| # | Terme | Contenu | Signe attendu |
|---|---|---|---|
| 1 | Investissement de renouvellement | `−Σ invArr` (la référence n'en porte aucun) | négatif |
| 2 | Réserve mobilisée à l'arrachage | `+Σ Δ cashRI` | positif |
| 3 | Écart de recettes raisin | `Σ Δ venteRaisinParcelle` | négatif puis se referme |
| 4 | Écart de charges d'entretien | `−Σ Δ chargesEntretien.parcelle` | positif |
| **=** | **Différentiel à 10 ans** | `differentielTresorerie(...).aHorizon` | — |

Exemple, vendange dégradée, propriété, vue « Ensemble » :

```
Investissement de renouvellement      −61 854 €
Réserve mobilisée à l'arrachage      +189 000 €
Écart de recettes raisin            −397 031 €
Écart de charges d'entretien        +107 868 €
──────────────────────────────────────────────
= Différentiel à 10 ans             −162 018 €
```

#### Faire-valoir — la linéarité, écrite pour qu'on ne la « corrige » pas

`repartir()` est **linéaire** en `revParcelle` et en `coutsParcelle` : chaque
terme hérite donc du même coefficient que dans `repartir`, sans qu'aucune règle
nouvelle soit nécessaire.

- **Métayage** : les termes 2 et 3 portent `(1 − partRecolte)` côté exploitant
  (et `partRecolte` côté propriétaire) ; les termes 1 et 4 portent
  `(1 − partCouts)` (resp. `partCouts`).
- **Fermage** : le loyer est **identique dans les deux scénarios et s'annule
  dans le différentiel**. Il n'y a donc **pas de cinquième terme**, et la part
  propriétaire du différentiel est **nulle**.

Ce raisonnement est écrit en commentaire dans le moteur **exprès** : c'est
exactement le genre de linéarité qu'une session ultérieure « corrigera » à tort,
en croyant qu'un régime de faire-valoir demande un traitement particulier. Il
n'en demande aucun. Deux tests le tiennent (« C5 — métayage : chaque terme
hérite du coefficient de repartir() » et « C5 — fermage : le loyer s'annule »).

#### L'assertion interne

`cascadeDifferentielle` **lève une exception** si `Σ montants − total` dépasse
1 €. Une cascade fausse doit casser **bruyamment**, pas dériver en silence —
c'est tout l'intérêt du chantier. Un test dédié fabrique une incohérence et
vérifie que le moteur lève bien (« C5 — GARDE-FOU »).

#### Ce qui reste hors cascade

Clairement séparés, sous un trait, parce que **ce ne sont pas des termes d'une
somme** :

- **la réserve à l'horizon en kg/ha** (chantier C3) — physique, jamais
  additionnable à des euros. La contrainte d'adjacence de C3 se **déplace** ici :
  la réserve n'est monétisée que dans la cascade, sa contrepartie physique est
  donc rendue immédiatement sous la cascade ;
- **le point bas de trésorerie** (€, année) — un **extremum**, pas un cumul.

Un test vérifie qu'aucun des deux n'entre dans le corps de
`cascadeDifferentielle`.

#### Ce qui a été retiré

**À l'écran** : le bloc repliable « Manque à gagner », le cartouche « Réserve
mobilisée », le cartouche « Investissement net de la réserve mobilisée », et le
cartouche KPI « investissement brut » — ce dernier redevenu le simple **total du
tableau qu'il surmonte** (ce n'est pas un indicateur concurrent : c'est la somme
des lignes juste au-dessus, et elle entre dans la cascade comme premier terme).

**Sur la fiche d'audit** : les entrées `manqueAGagner` et `chargesEvitees` sont
**retirées** et remplacées par les quatre termes de la cascade, chacun avec sa
formule. *Laisser coexister deux jeux de chiffres aux périmètres différents
recréerait exactement le problème que ce chantier résout.*

Le KPI `kpiStockReserve`, qui doublonnait la réserve à l'horizon de C3 avec un
libellé évaluatif (« s'est entièrement reconstituée »), est remplacé par
`kpiReserveHorizon`, adossé au moteur : une seule définition, deux emplacements
d'affichage dont l'un est imposé par l'adjacence.

#### Compatibilité

`manqueAGagner` **reste exportée et testée**, marquée `@deprecated chantier C5`
avec renvoi à la cascade. Elle ne doit plus alimenter ni l'écran ni la fiche
d'audit. Un test de non-régression documentaire mesure l'écart de l'empilement
historique au différentiel, pour que la raison du chantier reste vérifiable et
ne devienne pas une affirmation de README.

#### Critère d'acceptation

Un lecteur ayant sous les yeux la cascade seule peut reconstituer le
raisonnement complet sans revenir aux hypothèses, et **l'addition tombe juste** —
vérifié sur 4 jeux d'entrées × 3 régimes × 3 vues, soit 36 combinaisons.

#### Hors périmètre, explicitement

`simulerReserveKg`, `coucheEuro`, `repartir` et `chargesEntretien` ne sont pas
modifiés : la cascade est un **assemblage de sorties existantes**, pas une
physique nouvelle. Aucune actualisation. Ni les graphiques SVG ni la frise de
trajectoire ne sont touchés.

### Journal d'arbitrages — chantier C7 : ce que la fiche d'audit ne calcule pas (07/09/2026)

#### Pourquoi

Arbitrage 7 : la fiche d'audit vise le **conseiller / comptable**, pas le
banquier. Elle assume donc l'**auditabilité du modèle** plutôt que le dossier de
financement. Mais une fiche d'audit qui ne dit pas ce qu'elle **ne** calcule pas
n'est pas auditable : le lecteur ne peut pas savoir où s'arrête la garantie.

#### Les six omissions, en pied de fiche

1. **Aucune actualisation.** Un euro de l'année 10 pèse comme un euro de
   l'année 0.
2. **Aucune valeur terminale d'actif.** Réserve en stock et rajeunissement du
   vignoble ne sont jamais convertis en euros, y compris à l'horizon.
3. **Aucun coût de financement.** Aucun taux d'emprunt, aucune durée, aucun
   différé.
4. **Aucun échéancier de paiement.** Trésorerie en année pleine. Pour mémoire,
   campagne 2026 : première échéance à 25 % du volume commercialisable
   (2 200 kg/ha) au 5 décembre, solde en trois versements égaux — *valeur
   annuelle, à revérifier à chaque campagne*.
5. **Prix du raisin unique et constant**, sans distinction cépage / cru /
   millésime, sans inflation.
6. **Rendement butoir non modélisé** (15 500 kg/ha en 2026) : la récolte n'est
   pas plafonnée dans le moteur.

**Le point 4 est obligatoire, pas seulement informatif.** Le point bas de
trésorerie est présenté dans un contexte de financement ; sans cette mention, le
lecteur croit lire une trésorerie **datée** alors que le modèle raisonne en
année pleine. Les années du point bas et du creux de réserve sont des années,
pas des dates.

Un test vérifie que les six sont présentes, qu'il y en a exactement six, que
l'échéancier cite ses valeurs et son avertissement de péremption, et que le bloc
**ne promet aucun module à venir** : il constate une limite, il n'annonce rien.

#### Correctif technique joint — l'année du creux de réserve

`tMin = sc.arrachage.kg.find(r => r.stockHa === stockMin).t` reposait sur une
**égalité de flottants**. Cela fonctionnait — même tableau, même valeur, donc
même représentation binaire — mais cela casse **en silence** le jour où la série
transite par un arrondi (un `toFixed`, une moyenne, un recalcul intermédiaire) :
`find` rend alors `undefined` et l'accès à `.t` lève, ou pire, tombe sur une
autre année de valeur voisine.

Remplacé par une recherche du minimum **et de son année en un seul passage**,
par comparaison :

```js
const creuxStock = sc.arrachage.kg.reduce(
  (min, r) => (r.stockHa < min.stockHa ? r : min), sc.arrachage.kg[0]);
```

Comportement en cas d'ex æquo : la **première** année gagne — identique à
l'ancien `find`, et figé par un test. Le test « C7 — tMin robuste » couvre le
cas nominal, les valeurs séparées d'un seul bit, les ex æquo, et démontre le cas
où l'ancienne écriture ne trouvait rien.

#### Hors périmètre

Aucun module de financement, aucun pas de temps infra-annuel : ces deux points
sont écartés par arbitrage. La fiche se contente de le dire.

### Journal d'arbitrages — chantier A1 : recentrage sur un scénario unique

**Décision (24/07/2026).** La note de cadrage du 24/07/2026 supprime les
scénarios « statu quo » et « complantation » de l'**interface** — seul
`arrachage` reste un scénario affichable à l'utilisateur. Arbitrage explicite :
suppression d'interface, **pas** de suppression de calcul.

**Motif — le statu quo reste un contre-factuel nécessaire.** L'écran 5 énonce
des comparaisons (« la parcelle renouvelée représente moins de travail et de
charges qu'une parcelle en production ») : une comparaison suppose un terme de
référence. Sans le statu quo calculé en interne, ces différentiels — KPI
« Écart d'âge à l'horizon » (§17), encadré « Main d'œuvre économisée » (§11,
F6/F7), tableau « Manque à gagner » (§13) — n'auraient plus de contre-factuel
à comparer. Le statu quo devient donc une **référence de calcul interne**,
jamais un scénario proposé au choix de l'utilisateur.

**Ce chantier (A1) ne fait que renommer et qualifier.** Dans l'objet retourné
par `construireScenarios` (`moteur-oad.js`) :
- `reference` — nouvelle clé, ex-`statuquo`, commentée « RÉFÉRENCE INTERNE —
  non affichable comme scénario ».
- `statuquo` — **alias de compatibilité**, pointe vers le même objet que
  `reference` (pas une copie), pour ne pas casser le code et les tests
  existants qui lisent encore cette clé.
- `complantation` — conservée, commentée `@deprecated` avec la date et le
  motif (note de cadrage du 24/07/2026) ; son calcul (`scCompl`, `invCompl`,
  `rendParcCompl`, §8) n'est touché nulle part.
- `arrachage` — inchangé.

Aucune formule, aucun paramètre par défaut, aucune valeur de test n'a changé :
`git diff` de ce chantier ne montre que le renommage, l'alias et les
commentaires ci-dessus. La suppression effective de la complantation et du
statu quo de l'écran (template `<x-dc>`, sélecteurs, graphiques, tableaux
comparatifs) est un chantier ultérieur, hors périmètre d'A1.

### 12bis. Journal d'arbitrages consolidé — note de cadrage du 24/07/2026

La note de cadrage du 24/07/2026 regroupe plusieurs décisions déjà
détaillées, chantier par chantier, dans les sections ci-dessus. Cette
entrée les indexe à un seul endroit, datées, pour la traçabilité de la
note elle-même — elle ne remplace aucun des journaux détaillés existants
(voir consigne « ne pas supprimer l'historique »).

> **Suite, 08/09/2026 — refonte du temps 3 (§19quinquies).** La décision 1
> ci-dessous (« contre-factuel silencieux ») a connu deux mouvements
> successifs : le chantier C4 lui avait rendu **une ligne** à l'écran — un
> point de référence arithmétique, pas un scénario configurable —, puis la
> refonte du temps 3 a retiré cette ligne et la cascade de C5 avec elle. Le
> contre-factuel redevient donc **entièrement silencieux à l'écran**, et
> `declinSQ` n'est plus saisissable. Ni `OAD.differentielTresorerie` ni
> `OAD.cascadeDifferentielle` ne sont supprimées : elles restent exportées,
> testées et marquées `@deprecated`. Un chantier ultérieur ne doit rétablir
> sur le temps 3 **ni piste de trésorerie, ni cascade différentielle** — le
> détail de l'arbitrage et de ce qu'il écarte est en §19quinquies.

**1. Contre-factuel silencieux.** Le statu quo est conservé en référence
interne (`sc.statuquo`/`sc.reference`, `moteur-oad.js`) ; son exposition à
l'écran est supprimée. Motif : les différentiels de l'écran 5 (manque à
gagner, écart d'âge, charges évitées, main d'œuvre économisée) sont des
**comparaisons** — elles ont structurellement besoin d'un terme de
référence, mais ce terme n'a pas besoin d'être lui-même un scénario que
l'utilisateur consulte séparément. Détail complet : journal « chantier A1 »
ci-dessus.

**2. Repositionnement assumé — OAD devient un simulateur d'impact.**
Conséquence directe de la décision 1 : l'outil ne compare plus « ne rien
faire » à « agir », il chiffre uniquement ce que change l'arrachage-
replantation. Conséquence explicite à ne pas perdre de vue en le lisant :
**l'outil ne documente plus le coût de l'immobilisme** — un utilisateur qui
chercherait à l'écran 5 « combien me coûte le statu quo en valeur absolue »
ne trouvera que des différentiels (ce que l'arrachage change), jamais un
chiffre de statu quo affiché en tant que tel.

**3. Montée en charge — arbitrage A (échelons uniformes) retenu contre
l'arbitrage C (ancrage agronomique).** Détail, formule et **limite assumée
documentée noir sur blanc** (rendement de 3e feuille = 50 % si N=4, ≈16,7 %
si N=8, pour une vigne identique) : voir §7ter, journal « chantier A3 ».

**4. Comptage agronomique des pieds, distinct du comptage géométrique du
palissage.** `densite × surf` (agronomique, matériel végétal) et
`nbRangs`/`L`/espacement (géométrique, piquets et fils) ne coïncident pas
exactement — assumé, pas un bug. Détail : §16, journal « chantier A4 ».

**5. Multi-parcelles agrégé (arbitrage B) et sa limite.** Un seul couple
d'écartements et un seul `nbRangs` pour tout le lot renouvelé, y compris en
mode registre multi-lignes — donc un seul verdict de conformité AOC pour un
lot potentiellement hétérogène (une sous-parcelle non conforme peut être
noyée dans un agrégat jugé conforme). Détail : §16.

**6. Retrait de la VSL de l'interface.** Champ `penaliteVSL` et badge
associé supprimés de l'UI ; le hook générique `rendFactorProjet` de
`simulerReserveKg` (§7) et le contrôle de conformité AOC (`aoc.*`,
structurellement indépendant de la VSL) sont conservés intacts dans le
moteur. Détail : §11, journal « chantier B4 ».

**7. Règle repos/déblocages — décision CIVC de juillet 2026, NON PUBLIÉE à
la date d'écriture.** `NB_SORTIE_PAR_REPOS = {1:3, 2:4, 3:5}`
(`moteur-oad.js`, chantier A2) encode une règle dont la source
réglementaire n'est, à ce jour, pas publiée — voir §7bis. **Point de
vigilance signalé ici plutôt que masqué** : au moment d'écrire cette
entrée, `moteur-oad.js` (lignes 743-748) ne porte qu'une mise en garde
générale (« décision CIVC de juillet 2026, NON ENCORE PUBLIÉE ») et
**aucune liste explicite de quatre points de vérification** — malgré la
consigne du chantier C2 qui en présupposait l'existence. À vérifier une
fois la décision CIVC publiée : durée(s) de repos effectivement retenue(s)
(1/2/3 ans, ou une liste différente), correspondance exacte
repos→nb de déblocages, `VOL_SORTIE_ARRACHAGE` (9 000 kg/ha, inchangé
depuis avant ce chantier) toujours en vigueur, et devenir du motif
classique/sanitaire (définitivement aboli ou simplement recatégorisé, voir
§7bis).

## 13. Manque à gagner — `manqueAGagner`

> ⚠️ **@deprecated — chantier C5 (07/09/2026).** Cette fonction reste exportée
> et testée pour compatibilité, mais elle n'alimente plus ni l'écran ni la fiche
> d'audit : elle n'est **pas recomposable** avec le différentiel de trésorerie
> (le `max(0, …)` annule les années où l'arrachage vend plus que la référence, et
> elle ne porte que sur `volcoVendu`). Elle est remplacée par le terme « Écart de
> recettes raisin » de `cascadeDifferentielle` — voir §12, journal d'arbitrages
> « chantier C5 ».

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
nbFils      = nbFils ?? FILS_PAR_TAILLE[typeTaille] ?? 4     // guyot/cordon/arcure simple = 4, arcure double/chablis = 5

interParRang = max(0, round(Lrang/espacement) − 1)
nbInter      = nbRangs × interParRang         // piquets intermédiaires — base du "piquet" et du "crochet" du relevé
nbTete       = 2 × nbRangs                    // fiche de tête + kit bout de route + amarre : 2 par rang chacun
mlFils       = nbFils × nbRangs × Lrang       // mètres linéaires de fil, tous fils confondus
nbGripple    = nbFils × nbRangs
nbPiquets    = nbInter + nbTete                // base MO pose : tout poteau planté

totalParcelle = Σ (quantité × prix unitaire) sur les lignes INCLUSES        // chantier A5, voir journal ci-dessous
totalHa       = totalParcelle / surf
```

**Prix unitaires et catégorie** (`PRIX_PALISSAGE`, `moteur-oad.js` — depuis
le **chantier A5**, chaque ligne porte un attribut `categorie`,
`obligatoire` ou `optionnel`, voir journal ci-dessous) :

| poste | prix | catégorie | source |
|---|---|---|---|
| piquet intermédiaire | 3,80 €/piquet | obligatoire | relevé fournisseur [date à préciser] |
| fiche de tête en L galva | 5,98 €, 2/rang | obligatoire | relevé fournisseur [date à préciser] |
| kit bout de route | 3,88 €, 2/rang | **optionnel** | relevé fournisseur [date à préciser] |
| amarre 1200 | 7,32 €, 2/rang | obligatoire | relevé fournisseur [date à préciser] |
| crochet piquet inox | 0,26 €, 1/piquet intermédiaire | obligatoire | relevé fournisseur [date à préciser] |
| fil (par fil, au mètre linéaire) | 0,15 €/m | obligatoire | relevé fournisseur [date à préciser] |
| gripple | 1,826 €/gripple | obligatoire | LutEnVi 2025 (conservé, pas d'équivalent dans le relevé) |
| MO pose piquet | 1,318 €/piquet posé | obligatoire | LutEnVi 2025, dérivé (2 864,56 €/ha ÷ 2 174 piquets/ha) |

Prix et quantités des 8 lignes **inchangés** par le chantier A5 — seule une
catégorie et une case à cocher (pour les lignes optionnelles) ont été
ajoutées ; voir journal ci-dessous pour l'argumentaire et les zones
d'incertitude signalées plutôt que tranchées.

⚠ Avec l'espacement par défaut (6 m), le nombre de piquets intermédiaires
est **~30 % plus faible** que le repère implicite LutEnVi (~1 piquet tous
les 4 pieds, soit ≈ 4,3 m) — divergence assumée et affichée dans l'UI.

> Ce repère de 4,3 m est nommé `ESP_PIQUET_REF` dans `index.html` (chantier
> « une décision par carte », §4bis). Ce n'est **ni une borne réglementaire ni
> un paramètre de calcul** : `coutPalissage()` compte les piquets à
> l'espacement réellement saisi, quel qu'il soit. C'est un repère d'affichage,
> et l'aide sous le champ ne passe en rouge qu'**au-delà** — jusqu'ici elle
> était rouge en permanence, y compris quand la valeur était conforme, ce qui
> apprenait à ne plus la lire.
>
> Depuis le même chantier, les huit lignes sont dessinées en **barres
> proportionnelles triées par total décroissant** (§4bis) plutôt qu'en liste :
> le tri et la largeur des barres sont de la mise en forme, les quantités, prix
> unitaires et totaux viennent toujours de `coutPalissage()`. La case à cocher
> des lignes optionnelles est conservée, `typeTaille` est désormais passé à la
> fonction (sans effet sur le résultat, `nbFils` étant toujours fourni).

**Mapping du relevé — hypothèses à confirmer** (voir journal §12) : le
« piquet » (3,80 €) est traité comme piquet intermédiaire uniquement (la
tête de rang est couverte par fiche de tête + kit bout de route) ; le
« crochet piquet inox » est appliqué sur cette même base (intermédiaires
uniquement, pas la tête). À corriger si le relevé source précise
autrement la répartition.

**Fils par type de taille** (`FILS_PAR_TAILLE`, `moteur-oad.js`) :

| taille | fils | source |
|---|---|---|
| guyot / cordon / arcure simple | 4 | hypothèse à confirmer (non figée par le guide) |
| arcure double | 5 | hypothèse à confirmer (non figée par le guide) |
| chablis | 5 | **chantier A5 — valeur communiquée par l'utilisateur, pas de référentiel documentaire fourni ; à sourcer si besoin** |

### Journal d'arbitrages — chantier A5 : modes de conduite et équipements de palissage

**Décision — catégorisation obligatoire/optionnel.** Les 8 lignes de
`coutPalissage` sont désormais réparties en deux catégories, portées par un
attribut `categorie` sur chaque ligne (`'obligatoire'` ou `'optionnel'`),
sans changement de prix ni de quantité. Seules les lignes **obligatoires**
sont toujours comptées ; les lignes **optionnelles** peuvent être
décochées dans l'UI (`opt.optionnelsExclus`, tableau d'ids côté
`OAD.coutPalissage`, vide par défaut — comportement historique inchangé
tant que l'appelant ne fournit pas explicitement cette liste).

**Mapping retenu, et deux catégories signalées sans équivalent.** La note
de cadrage cite « piquets de tête, fils, interpiquets » comme obligatoires
(→ `ficheTete`, `filML`, `piquetInter`) et « écarteurs, kits de route /
kits Boudrout, autres » comme optionnels. Seul un des trois exemples
optionnels a un équivalent parmi les 8 lignes existantes : **« kits de
route / kits Boudrout » = la ligne `kitBoutRoute` (« Kits bout de route »)
déjà présente dans `PRIX_PALISSAGE`** — signalé plutôt que tranché,
conformément à la consigne du chantier : les deux graphies désignent très
vraisemblablement le même article (« Boudrout » lit comme une variante
phonétique/de transcription de « bout de route »), mais ceci n'a pas été
confirmé auprès d'une source ; **aucune nouvelle nomenclature n'a été
créée**, la ligne garde son libellé `PRIX_PALISSAGE` existant. « Écarteurs »
et « autres » **n'ont pas d'équivalent** parmi les 8 lignes actuelles —
aucune ligne n'a été inventée ou requalifiée pour les représenter ; ce
sont des catégories vides tant qu'une source ne les documente pas.

**Les 4 lignes restantes (Amarres, Crochets piquet inox, Gripple, MO pose
piquets) ne sont nommées dans aucun des deux exemples de la note de
cadrage** — classées `obligatoire` par jugement structurel (nécessaires au
fonctionnement physique du palissage : l'amarre ancre la tension du fil de
tête, le crochet retient le fil sur le piquet intermédiaire, le gripple
joint/tend le fil, la MO de pose est indissociable des piquets eux-mêmes
qui sont, eux, obligatoires). Choix documenté ici pour audit, pas un fait
établi par une source externe.

**Pourquoi `totalHa ≈ 14 577 €/ha` (section 11 des tests) reste inchangé
sans aucune modification des tests.** Le paramètre `opt.optionnelsExclus`
est **additif et opt-in** : par défaut (absent ou vide), aucune ligne
n'est exclue, obligatoire ou optionnelle — le total est donc identique à
celui d'avant ce chantier. Les tests figés (`tests/parite.test.js`, §11)
appellent `OAD.coutPalissage(GEO_TEST, null, {espacementPiquet:6, nbFils:4})`
sans ce paramètre : ils continuent, sans modification, de recevoir les 8
lignes et le total ≈ 14 577 €/ha. Décocher `kitBoutRoute` dans l'UI (le
seul cas testé manuellement, voir sanity-check en session) réduit le total
d'environ 336 €/ha sur la géométrie de référence — la baisse attendue,
puisque exclure une ligne à prix non nul ne peut pas laisser le total
inchangé.

**Taille Chablis.** Ajoutée au sélecteur « Type de taille » (`v.typeTaille`,
option `chablis`) et à `FILS_PAR_TAILLE` (5 fils). Le nombre de fils n'a
pas été fourni par une source documentaire : **valeur communiquée
directement par l'utilisateur** lors de ce chantier, sans référentiel
cité — à sourcer si une justification écrite est nécessaire plus tard.
Sélectionner cette taille modifie `mlFils`/`nbGripple` (comptés au fil) et
donc le total, exactement comme arcure double (même nombre de fils).

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

## 15. Arbre de décision porte-greffe — `preconPorteGreffe` · référentiel clones

### Référentiel clones — `CLONES_CHAMPAGNE` / `OAD.clonesParCepage()`

**Information pure, hors calcul économique**, exactement comme `ARBRE_PG` :
le référentiel n'entre dans aucun `inp` et n'influence aucun scénario (un
test le vérifie). Depuis le prompt A1 il vit dans `moteur-oad.js` et non
plus dans `index.html` (où `this.CLONES` offrait 3 cépages sur 2 colonnes,
avec les seules notes du Guide).

**Union de deux sources, chaque ligne portant son origine** — arbitrage 4 :

- Guide pratique Viticulture durable en Champagne 2025, p. 42-44 ;
- PlantGrape (INRAE / IFV / Institut Agro Montpellier), www.plantgrape.fr —
  **relevé non daté, à confirmer avant diffusion**.

**42 lignes** : 11 Chardonnay, 19 Pinot noir, 12 Meunier. 13 champs par
ligne (`cepage`, `clone`, `sources`, `refAgronomiques`, `production`,
`sucre`, `fertilite`, `typiciteChampagne`, `precocite`, `botrytis`,
`multiplicationHa`, `remarqueGuide`, `remarquePlantGrape`).
`OAD.clonesParCepage(cepage)` renvoie les lignes triées par **numéro** de
clone croissant — tri numérique, pas lexicographique.

> **Huit variétés du sélecteur n'ont aucune ligne ici** : pinot blanc, pinot
> gris, arbane, petit meslier, chardonnay rose, et les trois VIFA (Voltis,
> Orellis, Serelis). `clonesParCepage()` renvoie alors un tableau vide, et
> l'écran (§4bis) affiche un message le disant, avec les pistes où chercher —
> catalogue officiel des variétés (FranceAgriMer / IFV), plantgrape.fr, données
> du Comité Champagne. Ni table vide, ni ligne inventée : c'est la même règle
> que les cellules vides ci-dessous.

Une copie de travail lisible est commitée sous `data/clones-champagne.json` ;
le littéral du moteur en est la transcription (le projet n'a ni build ni
dépendance, le navigateur ne peut pas charger le JSON).

**Aucune cellule vide n'est comblée.** `botrytis` n'est renseigné que sur
**5 des 42 lignes** (Pinot noir 236 et 665, Meunier 818, 900 et 924) ; les 37
autres restent vides à l'écran, avec la note renvoyant aux données CIVC ou à
plantgrape.fr (arbitrage 5). Trois lignes portent une **origine partielle** :
Pinot noir 115 et Meunier 925 (PlantGrape hors référence Champagne),
Meunier 458 (PlantGrape seul, absent du Guide).

**Affichage — écran 3, prompt B7.** Sept colonnes, dans cet ordre : Clone ·
Niveau de production · Richesse en sucre · Fertilité · *Typicité en
Champagne* (Pinot noir) ou *Précocité* (Chardonnay, Meunier) · Sensibilité
Botrytis · Remarque.

- **Niveau de production** porte une infobulle : échelle qualitative
  PlantGrape, **ce n'est pas un rendement en kg/ha** et cela n'entre dans
  aucun calcul.
- **Disponibilité retirée de l'écran.** Une colonne affichait
  `multiplicationHa` (surface de multiplication en pépinière) ; elle a été
  retirée de la table — relevé national non daté, sans valeur de décision
  pour l'utilisateur. Le champ **reste** dans le référentiel du moteur, où
  il est toujours transcrit depuis les sources : c'est l'affichage qui
  disparaît, pas la donnée.
- **Origine par ligne** : marqueur `G·P` (les deux sources), `G·P*`
  (PlantGrape hors référence Champagne), `P` (PlantGrape seul), avec
  légende ; les trois origines partielles sont distinguées en couleur.
- **Badge d'alerte « mutations réverses »** sur les Meunier 458, 900 et 983,
  au même traitement visuel que l'avertissement 161-49 C des porte-greffes.
- **Table ni triable ni filtrable**, ordre fixe par numéro de clone : trier
  par production suggérerait un classement que les sources ne portent pas.

### L'arbre porte-greffe

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

**Table clones** (`this.CLONES`, `index.html`, statique) : liste par
cépage (Pinot noir / Meunier / Chardonnay) des clones diffusés et d'une
note de comportement, sourcée Guide pratique 2025 p. 42-44. Colonnes
**Rendement / Degré / Botrytis** volontairement **vides** (chantier B3) :
aucune valeur n'est disponible dans le Guide pour ces critères à ce
niveau de détail — plutôt que de les omettre silencieusement ou d'inventer
un chiffre, elles restent affichées en colonnes vides avec une note
renvoyant vers les données CIVC ou plantgrape.fr. Purement informatif,
**n'entre jamais dans `inp`**, comme le reste de l'aide au choix.

### Journal d'arbitrages — chantier B3 : écran 3 réduit à deux blocs

**Décision.** L'écran 3 passe de 3 cartes (« Matériel et conduite »,
« Aide au choix » repliable, « Dimensionnement du palissage ») à
exactement **2 blocs** : « Matériel végétal et aide au choix » (le
simulateur d'aide — cépage/calcaire/profondeur/drainage, arbre
`preconPorteGreffe`, table clones — précède désormais la sélection
définitive `materiel`/`porteGreffe` qu'il éclaire, au lieu de la suivre) et
« Palissage et conduite » (mode de conduite `typeTaille`, dont Chablis —
chantier A5 —, année de pleine production, équipements de palissage
obligatoires/optionnels — chantier A5). Pur réagencement d'`index.html` :
aucune formule de `moteur-oad.js` n'est touchée.

**Irrigation retirée de l'écran, pas de l'état.** Le sélecteur « Ferti-
irrigation du plantier » (`v.irrigation`) disparaît de l'écran 3. Ni
`state.v.irrigation` (toujours défini, défaut `'0'`) ni `inp.irrigation`
(toujours construit à partir de `v.irrigation`, §12) ne sont touchés — la
valeur reste ce qu'elle était à la dernière saisie, simplement plus
modifiable tant qu'un chantier B4 ne l'aura pas replacée à l'écran 4
(options de coût à l'installation). Le badge de conséquence « ⚠ Irrigation
… interdite en AOC » (`conseqs`, alimenté par `v.irrigation === '1'`) reste
affiché dans le bloc 1 en attendant.

**Badge porte-greffe et table clones conservés intégralement.** La fiche
`PG_INFO` (dont l'avertissement `161-49 C` : dépérissements signalés
depuis 2008, déconseillé) reste attachée à la sélection définitive du
porte-greffe, dans le bloc 1. La table clones (Guide 2025 p. 42-44)
n'est ni tronquée ni recalée : colonnes Rendement/Degré/Botrytis ajoutées
vides (voir plus haut), aucune valeur comblée.

## 16. Géométrie de plantation — `OAD.geometrieAgronomique()`

**Depuis le chantier A4** (voir journal d'arbitrages ci-dessous), la
géométrie n'est plus pilotée par une longueur et une largeur déclarées.
Calculée dans le moteur (`geometrieAgronomique(surf, eR, eP, nbRangs)`,
`moteur-oad.js`), à partir de quatre grandeurs : `surf` (ha — `v.surfArr`
en mode manuel, surface du registre en mode registre), `eR`/`eP`
(écartements, saisis) et `nbRangs` (nombre de rangs, saisi). La longueur de
rang `L` est **déduite**, jamais saisie :
```
densite = round(10000 / (eR × eP))          // pieds/ha, arrondi AVANT multiplication par la surface
L       = (nbRangs × eR) > 0 ? surf × 10000 / (nbRangs × eR) : 0   // longueur de rang — AFFICHAGE SEUL
W       = nbRangs × eR                       // largeur du bloc — auxiliaire d'affichage, dérivée
pieds   = round(densite × surf)              // comptage AGRONOMIQUE — seul comptage de pieds à planter
aoc     = { rang: eR ≤ 2.0, pied: 0.7 ≤ eP ≤ 1.5, somme: eR+eP ≤ 3.0 }
```
(Le détecteur `vsl`, ex `eR ≥ 1.5`, n'apparaît plus dans cette formule
depuis le chantier B4 — voir §12bis, décision 6, et le journal d'arbitrages
« chantier B4 » au §11.)

Un seul couple d'écartements et une seule géométrie pour tout le lot
renouvelé (**mode agrégé — arbitrage B**, §12bis décision 5) : en mode
registre, `surf` = la surface déjà agrégée par `agregerRegistreParcelle`
(somme des lignes retenues, §6bis), `nbRangs` reste saisi comme en mode
manuel — aucune gestion parcelle par parcelle. **Limite assumée de
l'arbitrage B** : un lot agrégé multi-`idu` hétérogène (écartements réels
différents d'une sous-parcelle à l'autre) reçoit malgré tout un seul couple
d'écartements saisi et donc un seul verdict de conformité AOC — le badge ne
distingue pas une sous-parcelle non conforme noyée dans un agrégat
conforme. **Aucun seuil de plausibilité n'est arbitré sur `L`** (ni haut ni
bas) : une longueur de rang dérivée absurde (trop courte, trop longue) ne
déclenche aucun avertissement — faiblesse connue, documentée mais non
corrigée par ce chantier (voir journal ci-dessous et
`tests/parite.test.js`).

**Deux comptages de pieds distincts, à ne jamais confondre :**
- **Pieds à planter** = `densite × surf` (comptage **agronomique**) → alimente le matériel végétal (`nbPlants`, coût du plant).
- **Piquets / fils** = dérivés de `nbRangs`, `L` et de l'espacement (comptage **géométrique**) → alimente uniquement `OAD.coutPalissage()` (§14), qui continue de lire `geo.nbRangs`/`geo.L`/`geo.surf` sans modification.

Ces deux comptages ne coïncident pas exactement (le premier ignore la forme
réelle du rang, le second en dépend) et ce n'est **pas un bug** — voir
§12bis (décision 4) et le journal d'arbitrages ci-dessous. Dans les deux modes, `aoc.*` alimente le
bandeau de conformité au cahier des charges homologué le 31/07/2025
(rang ≤ 2,00 m, pied 0,70–1,50 m, somme ≤ 3,00 m). Depuis le **chantier
B4**, `geometrieAgronomique()` ne renvoie plus de détecteur `vsl` (ex
`eR ≥ 1.5`) : la pénalité de rendement associée et le conseil de diamètre
de fil porteur qu'il déclenchait ont été retirés de l'interface — voir
§19 et le journal d'arbitrages « chantier B4 » (§11).

### Journal d'arbitrages — chantier A4 : refonte de la géométrie de parcelle

**Décision.** La géométrie n'est plus pilotée par une largeur et une
longueur déclarées (`v.geoL`/`v.geoW`, supprimés). Le vigneron saisit
désormais : surface arrachée (`v.surfArr`, ha, nouveau champ étape 2),
écartement entre rangs, **nombre de rangs** (`v.nbRangs`, nouveau champ,
remplace la largeur saisie) et écartement entre pieds. La longueur de rang
est déduite, affichée mais jamais saisie.

**Où vit la règle.** `OAD.geometrieAgronomique()` (`moteur-oad.js`) porte
seule la formule ; `index.html` ne fait plus qu'appeler cette fonction et
afficher ses résultats — c'est un déplacement de logique métier du HTML
vers le moteur (l'ancienne méthode `geometrie()` d'`index.html` était une
entorse à la règle CLAUDE.md « toute logique métier va exclusivement dans
`moteur-oad.js` »).

**Comptage des pieds : agronomique et lui seul.** Avant ce chantier, le
nombre de pieds affiché différait selon le mode (rectangle géométrique
`nbRangs × piedsRang` en mode manuel, `densite × surf` en mode registre —
voir l'ancien journal ci-dessous, §16). Ce chantier tranche : le comptage
est désormais **toujours** `densite × surf` (agronomique), dans les deux
modes — le comptage géométrique (`nbRangs`, `L`) ne sert plus qu'au
palissage.

**Incompatibilité signalée, non corrigée silencieusement — `largeurEquivalente`
et la réconciliation géométrie/registre (§16, journal ci-dessous)
deviennent obsolètes.** La fonction `OAD.largeurEquivalente(surfHa, L)`
(`moteur-oad.js`) n'est **pas modifiée** par ce chantier, conformément à la
consigne — elle reste exportée, fonctionnelle, et ses tests dédiés
(`tests/parite.test.js`, §13) continuent de passer, puisqu'ils l'appellent
directement. Mais son **unique raison d'être** — dériver une largeur à
partir d'une longueur de rang *saisie* (`v.geoL`) et de la surface du
registre — n'a plus de sens dans le nouveau modèle : `v.geoL` n'existe
plus, la longueur est désormais déduite (jamais saisie) dans les deux
modes, via `geometrieAgronomique()`. Conséquence : `index.html` n'appelle
plus `largeurEquivalente()` nulle part — la fonction devient du code mort
du point de vue de l'interface (toujours vivante, testée et correcte côté
moteur, simplement plus jamais invoquée). Le mode registre lui-même
continue de fonctionner (`surf` = surface agrégée du registre, injectée
dans `geometrieAgronomique()` exactement comme `v.surfArr` en mode manuel)
mais **par un mécanisme différent** de celui documenté dans l'ancien
journal ci-dessous (qui reste comme trace historique de la décision
« option A », remplacée ici) — à réévaluer si un chantier futur a besoin
de ce que `largeurEquivalente()` calculait spécifiquement.

**Multi-parcelles — mode agrégé, pas de gestion parcelle par parcelle.**
Une seule géométrie (un seul couple d'écartements, un seul `nbRangs`) pour
tout le lot renouvelé, y compris en mode registre multi-lignes : la
surface est la somme des surfaces arrachées (déjà le comportement
d'`agregerRegistreParcelle`, §6bis, inchangé), le nombre de rangs est le
total saisi pour le lot. Aucune structure de données par sous-parcelle
n'a été introduite.

**Faiblesse connue, non traitée — aucun seuil de plausibilité sur `L`.**
Ni ce chantier ni les précédents n'arbitrent de borne haute ou basse sur la
longueur de rang déduite : une combinaison surface/nbRangs/écart rang
incohérente (ex. très peu de rangs sur une grande surface) produit une
longueur de rang déduite déraisonnable, sans avertissement. Documenté et
laissé tel quel — `tests/parite.test.js` (§14) fige cette absence de garde-fou.

### Journal d'arbitrages — chantier B2 : géométrie et paramètres de plantation à l'écran 2

**Décision.** Le bloc « Géométrie de la parcelle » (formule inchangée
depuis le chantier A4 ci-dessus) est déplacé de l'écran 3 (« Votre projet
de replantation ») vers la **tête** de l'écran 2 (« La parcelle que vous
désignez »), avant même le sélecteur de parcelle du registre. Pur
déplacement d'UI : `moteur-oad.js` n'est pas touché, `OAD.geometrieAgronomique()`
continue de porter seule la formule. Préalable vérifié avant d'entamer ce
chantier : A4 était déjà commité et `geometrieAgronomique` déjà câblée
(sinon ce chantier se serait arrêté, comme demandé).

**Consolidation des 4 champs de saisie.** `surfArr` (surface arrachée,
ajoutée à l'écran 2 par le chantier B1) vivait jusqu'ici dans la grille
âge/manquants, séparée des écartements/nombre de rangs restés à l'écran 3.
Les quatre champs — surface arrachée, écart entre rangs, nombre de rangs,
écart entre pieds — sont désormais réunis dans le même bloc « Géométrie de
la parcelle », en tête d'écran, conformément à l'objectif « rien d'autre »
: aucun autre champ saisi n'y figure. Longueur de rang déduite, densité,
pieds à planter et badge de conformité AOC restent des valeurs affichées,
jamais saisies — inchangé depuis A4, simplement redisposé dans le nouvel
emplacement.

**Badge AOC conservé tel quel.** Il ne dépend que des écartements
(`eR ≤ 2,00 m`, `eP` entre 0,70 et 1,50 m, `eR+eP ≤ 3,00 m`,
`geometrieAgronomique()`) — aucune dépendance à la VSL ni à quoi que ce
soit qui aurait pu bouger avec le déplacement. Reste pertinent et
inchangé.

**Bloc synthèse retiré de l'écran 2.** Après le chantier B1 (retrait sur
l'écran 1), `syntheseVisible` (`index.html`, dérivé de `s.step`) passe de
`step > 0` à `step > 1` : la colonne de droite (`<aside>`) n'apparaît plus
qu'à partir de l'écran 3, où elle redevient pertinente (la géométrie et la
parcelle sont déjà renseignées).

### Journal d'arbitrages — réconciliation géométrie/registre (option A, historique — remplacé par le chantier A4 ci-dessus)

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

### 16bis. Le schéma de parcelle et les bornes de densité (prompt 12)

La géométrie se saisissait en chiffres alors qu'elle se **dessine**, et rien
ne montrait à l'utilisateur si ce qu'il venait de taper tenait debout.

`schemaParcelle(d)` dessine, à droite des champs et à chaque frappe, les rangs
en bandes verticales. Le nombre de bandes est **plafonné à 21** quel que soit
le nombre réel de rangs : au-delà, une trame de rangs n'est plus qu'un aplat,
et en dessous de cinq les bandes deviennent des colonnes. Les cotes sous le
dessin portent le nombre exact, et le pied à deux colonnes donne mètres de
rang, nombre de pieds, hectares arrachés et densité. Le schéma est
**proportionnel, pas cadastral** — la légende le dit.

Sous le schéma, une **ligne de vérification** : « Densité obtenue : N pieds/ha »
et la conformité aux bornes AOC Champagne. Le contrôle vient du moteur —
`OAD.conformiteDensiteAOC(densite)`, bornes `DENSITE_AOC_MIN = 8000` et
`DENSITE_AOC_MAX = 10000`, inclusives — parce que c'en est un : il compare un
résultat de calcul à deux bornes réglementaires. Il renvoie `ok` **et** `sens`
(`'sous'` / `'au-dessus'`), ce qui permet à l'écran de dire *ce qui cloche*
plutôt qu'un « non conforme » muet. **Il ne bloque pas** la saisie : l'outil est
pédagogique, il signale, il n'interdit pas.

`geometrieAgronomique` contrôlait déjà les **écartements** (rang ≤ 2,00 m, pied
entre 0,70 et 1,50 m, somme ≤ 3,00 m) ; les deux contrôles coexistent et
s'affichent l'un sous l'autre. La **longueur de rang** est devenue un champ
dérivé affiché en lecture seule, avec la mention « calculé — N m de rang au
total » (`OAD.metresDeRang(geo)`, soit `nbRangs × L`).

Le **nombre de rangs** est remonté de son volet « Ajuster » dans la carte
Géométrie, à côté du schéma qu'il dessine. Le volet du temps 1, vidé par ce
déplacement et par le panneau Hypothèses, a disparu — un volet qui n'a plus
rien à contenir ne reste pas à l'écran.

---

## 17. KPI et synthèse

Tous calculés dans `renderVals()` (`index.html`), après
`OAD.construireScenarios(inp)`. Tous les KPI ci-dessous décrivent l'**impact
du scénario arrachage** — `sc.statuquo`/`sc.reference` n'y apparaît que
comme terme de comparaison à l'intérieur d'une formule (contre-factuel
silencieux, §12bis décision 1), jamais comme un second scénario à
consulter séparément à l'écran. Depuis le **chantier P6** (refonte de
l'écran 5), l'écran sépare deux familles typographiquement distinctes,
jamais mélangées dans une même grille de cartes — `out.kpisFinance` /
`out.kpiEffortNet` (blanc, décision € ) et `out.kpisPhysique` (fond
teinté, effets physiques non monétisés) :

| KPI | formule | famille (écran) |
|---|---|---|
| **Cascade — 4 termes** (chantier C5) | `OAD.cascadeDifferentielle(sc.arrachage, sc.reference, inp, fv, vue)` → `{ termes: [{id, lib, montant}], total }`. Décomposition **exacte** du différentiel : `−Σ invArr`, `+Σ Δ cashRI`, `Σ Δ venteRaisinParcelle`, `−Σ Δ chargesEntretien.parcelle`. Le moteur **lève** si `Σ montants − total > 1 €` | Financière — **le** bloc de clôture de l'écran ; remplace les montants épars |
| Par rapport à ne rien faire (total de la cascade) | `OAD.differentielTresorerie(...).aHorizon` (chantier C4) — montant **signé**, affiché toujours, aucune formulation évaluative | Financière — total de la cascade, en clôture |
| Investissement brut | `invest = sc.arrachage.investissement` | **Total du tableau « coût de l'investissement »** (chantier C5 : n'est plus un cartouche KPI concurrent) ; premier terme de la cascade |
| Amortisseur de réserve | `reserveReelle = Σ sc.arrachage.eur[t].cashRI` | Devenu le terme « Réserve mobilisée » de la cascade (chantier C5) ; le cartouche a quitté l'écran |
| — théorique | `reserveTheo = volSortieArr × surfParc × nbSortie × prixKg` | (cité dans la phrase de synthèse) |
| Point bas de trésorerie | `creuxAbs = min_t arrParcelle_cum[t]`, avec `arrParcelle[t] = venteRaisinParcelle[t] + cashRI[t] − coutsParcelle[t]` (vue « Ensemble ») réparti via `OAD.repartir()` en neutralisant le flux du reste (`venteRaisinReste`/`coutsReste` à 0) pour les vues Part exploitant/propriétaire — trésorerie cumulée **absolue de la parcelle seule** (pas relative au statu quo, pas noyée dans le revenu du reste de l'exploitation), sur la vue faire-valoir active | **Hors cascade**, sous le trait : c'est un **extremum**, pas un cumul — il ne s'additionne à rien |
| Investissement net de la réserve mobilisée | `OAD.soldeInvestissementReserve(sc.arrachage).solde = invest − reserveMobilisee`, **signé, sans plancher** (chantier C3 — l'ancien `max(0, …)` écrasait à zéro le cas dominant). Cas négatif : « réserve mobilisée au-delà de l'investissement », jamais « excédent » ni « gain » — c'est un déstockage | Chiffre de tête (`teteEffort`) et **fiche d'audit** ; le cartouche d'écran est devenu deux termes de la cascade (chantier C5) |
| Réserve à l'horizon (kg/ha) | `OAD.reserveHorizon(sc.arrachage, sc.reference, horizon)` → `{ arrachageKgHa, referenceKgHa, ecartKgHa }`, lus sur `stockHa` à `t = horizon`. Contrepartie **physique** de la monétisation de la réserve, en kg/ha, **jamais convertie en euros** | **Hors cascade** — adjacence non négociable (C3), déplacée sur la cascade par C5 puis, la cascade et le bloc « ce que le renouvellement produit » ayant tous deux quitté l'écran, sur la **phrase de synthèse** du temps 3, où elle précède immédiatement le plancher de la transition. Également sur la fiche d'audit, sous le solde signé |
| Réserve minimale en transition | `stockMin = min_t sc.arrachage.kg[t].stockHa`, alerte si `< 4000` kg/ha (`seuilReserve`) | Physique — dans la phrase de synthèse (immédiatement après la réserve à l'horizon), sur la bande de récapitulatif technique et sur la fiche d'audit. Le cartouche `kpiReserveMin` a disparu avec le bloc « ce que le renouvellement produit » (08/09/2026) |
| Écart d'âge à l'horizon | `trajAge = OAD.trajectoireAge(inp)` ; `gainAgeHorizon = trajAge.statuquo[horizon] − trajAge.arrachage[horizon]` ; contrepartie énoncée dans la même phrase (« rendement à reconstruire durant la transition ») ; la contrepartie est énoncée dans la même phrase | Physique — chiffre de tête `teteAge` et fiche d'audit. Le cartouche `kpiEcartAge` et le graphique de trajectoire d'âge ont disparu avec le bloc « ce que le renouvellement produit » (08/09/2026) |

`chargesEntretien` renvoie `{ parcelle, reste }` (§11) : les KPI dérivés
de charges ne lisent que `.parcelle`, qui seule porte l'écart de phase
(repos/plantier/production) propre au scénario arrachage — `.reste` est
identique aux deux scénarios comparés et s'annulerait dans la différence
de toute façon.

**Retirés de l'écran par le chantier P6**, puis traités par le **chantier C5** :

- « Tension maximale de trésorerie » (`creux = min_t (arr_cum[t] − sq_cum[t])`,
  la version *relative* au statu quo) — reste calculée et **reste sur la fiche
  d'audit**. À l'écran, le « Point bas de trésorerie » *absolu* continue de
  répondre à « combien dois-je être en mesure de financer, et quand ».
- « Charges évitées en transition »
  (`Σ_{t=0}^{returnYear−1} max(0, chSQ.parcelle[t] − chArr.parcelle[t])`) —
  **supprimée**, y compris de la fiche d'audit, au chantier C5. Elle ne sommait
  que sur `t < returnYear` et ne retenait que les écarts positifs : deux
  troncatures qui la rendaient **non recomposable** avec le différentiel de
  trésorerie. Le terme « Écart de charges d'entretien » de la cascade la
  remplace — même source, mais sur tout l'horizon et sans plancher.
- Idem pour le tableau « Manque à gagner » (`manqueAGagner`), retiré de l'écran
  **et** de la fiche : la fonction reste exportée et testée, marquée
  `@deprecated chantier C5`, et le terme « Écart de recettes raisin » de la
  cascade la remplace exactement.

**Fiche imprimable** (étape 5, bouton « Imprimer » → `window.print()`,
mise en page dédiée via `@media print` dans `index.html`, masque nav/aside
et n'affiche que `.print-sheet`) : un document d'audit autonome, distinct
de l'écran, construit dans `renderVals()` à partir de `out.printInpRows`
(rappel de toutes les hypothèses saisies), `out.printKpiRows` (tous les KPI,
y compris ceux retirés de l'écran ci-dessus, chacun avec sa formule — dont les
quatre termes de la cascade, via `out.printCascadeRows`), `out.printDetailArr`
(détail annuel du seul scénario arrachage depuis le chantier C1) et
`out.printLimitesRows` (**ce que le calcul ne modélise pas**, chantier C7).
Pensé pour qu'un chiffre affiché à l'écran puisse toujours être retracé
jusqu'à sa formule et à l'hypothèse qui l'alimente, sans avoir à relire le
code — et, depuis C7, pour que le lecteur sache aussi **où s'arrête la
garantie**.

⚠️ **Les chaînes `formule` de `printKpiRows` sont de la documentation
recopiée à la main : rien ne les recalcule.** Elles peuvent donc diverger en
silence du moteur — c'est exactement ce qui est arrivé à l'entrée
« investissement (brut) », restée deux chantiers durant sur une formule
fausse (`coûtPrepaHa` supprimé au chantier P3 mais toujours cité,
`coûtProtectionHa` ajouté au chantier P8 mais jamais repris), pour un écart
de 10 000 €/ha à la main du lecteur. Corrigée au **chantier C2** (§12,
journal d'arbitrages), qui a aussi posé le garde-fou : la composition de
l'investissement est désormais figée *numériquement* par un test
(`tests/parite.test.js`, section 31), et un commentaire au-dessus de
`printKpiRows` renvoie au bloc `invArr` de `moteur-oad.js`. **Toute
modification d'une formule du moteur documentée ici doit être répercutée
dans la chaîne correspondante.**

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
  (chantier 1, [§6bis](#6bis-le-registre-parcellaire--seule-source-des-surfaces-et-des-âges)) :
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

### 17bis. Les deux sorties d'impression (prompt 14)

La fiche imprimable était un document d'audit en trois tableaux monochromes :
elle ne reprenait ni la synthèse ni les chiffres de tête, on ne pouvait pas la
laisser au vigneron en fin d'entretien. Il y a désormais **deux sorties, deux
boutons, deux publics**.

| Sortie | Bouton | Contenu | Couleur |
|---|---|---|---|
| Remise | « Remettre au vigneron » | **une page** : identification de la parcelle et date, les trois chiffres de tête, la frise de trajectoire, la synthèse, et en pied les limites de l'outil | conservée |
| Audit | « Fiche d'audit » | la fiche exhaustive : hypothèses (`printInpRows`), KPI avec formule (`printKpiRows`), détail annuel (`matriceRows`) | monochrome |

> **Révisé le 08/09/2026 (§19quinquies).** Aucune des deux sorties ne porte
> plus de trésorerie. La remise rend `friseTrajectoireImprimee`, la variante
> **compacte** de la frise à six pistes : la feuille d'impression masque tous
> les `button`, or l'axe des années est devenu un jeu de onze boutons — la
> frise de l'écran y perdrait sa graduation, donc son axe de temps. Les deux
> variantes sortent de la même fonction et du même jeu de données. La fiche
> d'audit remplace son détail annuel de huit colonnes de moteur (dont
> `cashNet`) par la **matrice annuelle par thème**, `out.matriceRows`,
> construite une seule fois et partagée avec l'écran ; elle perd les trois
> entrées de `printKpiRows` adossées aux cumuls en euros (point bas, « par
> rapport à ne rien faire », tension max vs statu quo) ainsi que les quatre
> lignes de cascade, et gagne la mention **NON SAISISSABLE** sur `declinSQ`.

Les deux blocs vivent **au niveau du document**, hors de `<main>` : ce sont des
pages à part entière, pas des annexes de l'écran. La sortie demandée est
désignée par un attribut `data-print` posé sur la racine le temps de
l'impression, et retiré sur l'événement **`afterprint`** — pas sur la ligne
suivant `print()`, qui rend la main, selon le navigateur, avant que l'aperçu
ait fini de composer la page ; retirer l'attribut trop tôt imprimerait une page
vide. Un délai de repli couvre les navigateurs qui n'émettent pas l'événement.
**Sans attribut** (impression déclenchée au clavier), c'est la fiche d'audit qui
sort : c'est la sortie exhaustive.

La remise **garde ses couleurs** (`print-color-adjust: exact`) : sa frise est
son contenu, une frise en niveaux de gris ne dit plus rien. La frise est un SVG
construit en React, jamais une image : elle s'imprime en vectoriel sans qu'on
ait rien à demander. `@page { size: A4 portrait }`, `page-break-inside: avoid` —
tenir sur une seule page est sa contrainte de conception.

La synthèse imprimée (`out.syntheseTxt`) est assemblée des **mêmes morceaux**
que le bloc sombre de l'écran : une fiche qu'on laisse au vigneron ne doit pas
raconter autre chose que ce qu'il vient de lire, et deux rédactions parallèles
finiraient par diverger. Seul le gras disparaît. Un test le vérifie morceau par
morceau.

Quel que soit le thème actif, l'impression **reste en clair** : la feuille
`@media print` ramène tous les jetons à leurs valeurs claires.

---

## 18. Graphiques SVG faits main

Pas de librairie de graphiques : chaque figure est un `<svg>` construit à
la main avec `React.createElement('svg', …)`, méthode par méthode :

- **`chart(series, opt)`** — courbes multi-séries avec grille, ligne de
  référence en pointillé (ex. plafond 10 000 kg/ha) et annotations
  ponctuelles. **Plus appelée depuis le 08/09/2026** : ses deux seuls
  appelants — le graphique de stock de réserve (`chartStock`) et la
  trajectoire d'âge du vignoble (`chartAge`, chantier P7) — sont partis
  avec le bloc « ce que le renouvellement produit ». La méthode et sa
  compagne `legendSwatch()` restent dans `index.html`, inutilisées : le
  seul dessin de l'écran est désormais la **frise de trajectoire** (§18bis),
  qui a son propre rendu. Un chantier ultérieur qui ajouterait une courbe
  doit repartir de `chart()`, pas en réécrire une.
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
réserve, solde investissement/réserve, écart
final avec/sans réserve) restent lisibles via les KPI et, pour le détail
formule par formule, via la fiche imprimable (`out.printKpiRows`, §17).

### 18bis. La frise de trajectoire — `friseTrajectoire()` (prompt 7, refondue le 08/09/2026)

Le cœur de l'écran de résultats. Le temps est partout dans l'outil — « années
3-4 », « repos », « plantier », « à 10 ans » — et n'était jamais dessiné : il se
lisait dans des blocs séparés, chacun avec son unité (années, kilos, euros,
heures). Il est dessiné **une seule fois**, toutes les échelles alignées sur le
même axe horizontal, pour que le lien de cause à effet se voie sans être
expliqué.

Construit en `React.createElement` dans `renderVals()`, pas dans le gabarit :
les pistes doivent partager exactement la même géométrie de colonnes, ce qui
suppose de la calculer une fois et de la distribuer. C'est aussi pourquoi les
couleurs de **série** y sont littérales — le gabarit, lui, n'en porte aucune
(test §27).

#### De trois pistes à six (08/09/2026)

La frise portait trois pistes : phase, stock de réserve, **trésorerie cumulée**.
Elle en porte six, une par thème, et la trésorerie n'en fait plus partie.

| # | Piste | Source exacte | Unité(s) | Rendu |
|---|---|---|---|---|
| 1 | Phase de la parcelle | `OAD.phasesParcelle(repos, horizon)` ; `OAD.phaseParAnnee(...)` pour la phase d'une année | années | bande de 34 px, segments `flexGrow` proportionnels aux durées réelles ; un segment d'une seule année affiche « an N » et garde son nom en `title` ; le segment qui contient l'année retenue porte un liseré d'accent |
| 2 | Stock de réserve | `sc.arrachage.kg[t].stockHa`, échelle jusqu'à `inp.plafond` | kg/ha | **inchangée** — aire `#F1E6CC` + courbe `#A97F26` en SVG `viewBox="0 0 1000 80"`, `preserveAspectRatio="none"` ; point du creux et son étiquette conservés |
| 3 | Déblocage de réserve | `kg[t].sortieArr` ; € = `sortieArr × inp.prixKg`, **identique à** `eur[t].cashRI` ; kg/ha = `sortieArr / inp.surfParc` | kg **et** € | barres pleines `#A97F26` |
| 4 | Bloqué en réserve | `kg[t].mise` ; part des autres parcelles = `mise × recolteReste / recolte` | kg | barres **creuses** (contour `#A97F26`), la part remplie `#F1E6CC` étant celle des autres parcelles |
| 5 | Investissements | les mêmes postes que `out.investLignes` — arrachage en année 0, plants / palissage / protection (/ arrosage) en année `repos` ; total = `sc.arrachage.investissement` | € | barres **empilées** par poste |
| 6 | Entretien | `OAD.heuresManuellesParAnnee('arrachage', sc.arrachage.kg, inp)` → h/ha ; total parcelle = `× inp.surfParc` | heures | barres pleines `#4C7A57` |

**Unités.** Le total (parcelle) vient en premier, l'unité à l'hectare en second,
partout où les deux ont un sens — déblocage, entretien. Le stock, lui, reste en
kg/ha et n'est **jamais** converti en euros : c'est un stock physique, pas une
créance (§19, chantier C3).

**Une seule liste de postes d'investissement** (`POSTES_INVEST` dans
`renderVals`) alimente le tableau « poste par poste », la carte du thème 5 et la
piste empilée. Deux listes du même fait finissent toujours par diverger d'un
poste ; un test vérifie que leur somme est bien `sc.arrachage.investissement`.

#### Pourquoi la trésorerie cumulée sort de la frise

C'est un **arbitrage, pas un oubli**, et il ne doit pas être « réparé ».

Sur un horizon de 10 ans avec deux vendanges déficitaires par défaut, la
trésorerie cumulée de la parcelle seule est négative dans la quasi-totalité des
configurations. Lue en premier — et elle l'était, troisième piste d'une image
qui ouvre l'écran — elle ne dit qu'une chose déjà connue : *un renouvellement
coûte avant de rapporter*. Elle occupait le tiers inférieur de la seule image de
l'écran pour ce message-là, et rendait les deux autres pistes secondaires.

Ce qui disparaît avec elle, sur cet écran uniquement :

- la troisième piste et tout ce qui l'alimentait (`treso`, `tresoTxt`,
  `pointBasT`, les barres à quatre couleurs) ;
- le cartouche « Point bas de trésorerie » (`kpiPointBas`) — un **extremum** de
  cette série, qui n'a plus de série ;
- la ligne différentielle de C4 et la cascade de C5, qui lisaient
  `OAD.differentielTresorerie`, donc les mêmes cumuls ;
- dans la synthèse rédigée, la tension maximale, l'absorption à l'horizon et la
  comparaison de cumuls au statu quo — trois phrases qui commentaient une image
  désormais absente ;
- dans la synthèse latérale, la ligne « Tension max trésorerie » ; le surtitre
  `RISQUE` devient `RÉSERVE` et porte deux grandeurs physiques.

Ce qui **ne** disparaît **pas** : `OAD.tresorerieCumulee`,
`OAD.differentielTresorerie` et `OAD.cascadeDifferentielle` restent exportées,
testées et justes. Elles portent une marque `@deprecated` qui dit exactement
cela — le calcul est conservé, c'est son affichage qui est retiré. Le garde-fou
de la cascade (exception au-delà de 1 € d'écart) continue de les protéger.

#### L'axe des années est devenu le contrôle de l'écran

Les onze pastilles de la graduation sont des **boutons** (`aria-pressed`).
L'année retenue est teintée dans chaque piste, et un panneau « Année N » donne
ses six chiffres — phase, stock, déblocage kg + €, blocage kg dont autres
parcelles, investissement par poste, heures + h/ha + charge de surface de la
phase. C'est ce que la frise ne pouvait donner qu'au survol, c'est-à-dire ni au
vidéoprojecteur ni au clavier.

`state.anneeFrise` porte cette année. C'est un état de **navigation** : hors
instantané `localStorage`, comme `step` et les volets. Il est borné à l'horizon
à chaque rendu — un changement de paramétrage ne doit jamais laisser une
sélection hors axe. La matrice annuelle écrit le même état : il n'y a qu'une
seule année retenue à l'écran, jamais deux sélections concurrentes.

#### Géométrie, et la variante imprimée

**Les points de la courbe tombent au centre de leur colonne d'année** —
`x = (i + 0,5) × 1000 / N` — et non à ses bords, sans quoi la courbe se
décalerait d'une demi-colonne par rapport aux barres et à la graduation. Les
quatre pistes en barres partagent les mêmes colonnes `flex: 1` et le même `gap`
que la graduation.

L'annotation du creux est **hors du SVG**, dans un `div` positionné par-dessus :
avec `preserveAspectRatio="none"`, un texte à l'intérieur serait étiré
horizontalement.

**Aucune interpolation, aucun lissage** : les valeurs tracées sont celles du
moteur, année par année.

La sortie « remise au vigneron » rend `out.friseTrajectoireImprimee`, la
**variante compacte** de la même frise (`d.compact`), pour deux raisons dont la
première est un vrai piège : la feuille d'impression masque tous les `button`,
or l'axe est devenu un jeu de onze boutons — imprimée telle quelle, la frise
perdrait sa graduation, donc son axe de temps ; et la remise tient sur **une**
page, ce que six pistes aux hauteurs de l'écran ne permettraient pas. Mêmes
séries, mêmes couleurs, même fonction : les deux rendus ne peuvent pas raconter
deux trajectoires différentes.

La légende sous la frise dit la **causalité** et nomme l'aléa effectivement
simulé — sans lui, la chaîne « récolte courte → creux de réserve » n'a pas de
premier maillon. Une seconde légende, en pastilles, nomme les couleurs de série
que le lecteur doit pouvoir rattacher à un poste : les phases et les postes
d'investissement. Les pistes à une seule teinte portent leur nom dans le libellé
de la piste — une pastille n'y ajouterait rien.

---

### 18ter. La composition du vignoble — `graphExploitation()`

Le temps 1 affichait le registre sous forme de **deux nombres** — surface
totale, âge moyen — et d'un tableau de douze lignes replié par défaut. Deux
nombres qui perdent précisément ce sur quoi se décide un renouvellement :
quelle part du domaine est **déjà arrachée**, et comment la surface plantée se
distribue **par classe d'âge**. Personne ne lit une pyramide des âges dans une
colonne « année de plantation ».

Le graphique est placé **juste sous les deux champs dérivés qu'il décompose**,
avant le volet « Ajuster » : c'est une lecture de l'exploitation, pas un
réglage. Il est masqué quand `out.registreSansSurface` est vrai — l'écran
affiche alors son état bloquant, un graphique vide n'y ajouterait rien.

Depuis le 07/09/2026, la carte qui porte ce graphique porte aussi le curseur
de **réserve individuelle actuelle** (`v.riPct`), remonté du volet « Ajuster »
de l'écran 1 : la réserve est le stock de kilos déjà constitué par ce
vignoble, elle se lit avec sa pyramide des âges. Seul le **graphique** reste
masqué quand le registre ne porte aucune surface ; la carte, elle, reste à
l'écran — le curseur est une saisie, il ne doit jamais disparaître. Le volet
« Ajuster » de l'écran 1 n'a plus rien contenu ensuite que la campagne de
référence, puis, celle-ci n'étant plus paramétrable (voir §6bis), plus rien du
tout : il a été supprimé, avec `ajusterResume1` et son chevron.

Le comptage vit dans le moteur (`OAD.repartirRegistreParAge(rows, campagne)`,
pur et testé) ; `graphExploitation()` ne fait que le mettre en forme, en
`React.createElement` comme la frise.

Depuis le prompt B9 (§19quater), la fonction reçoit un **second argument** :
l'agrégat `agregerRegistreExploitation`, dont elle tire une note sous la piste
« Plantée et arrachée ». Cette piste découpe la surface **au registre** ; ce
n'est pas l'assiette qui porte le VolCo et le plafond de réserve, laquelle
retranche aussi les **plantiers** — invisibles dans ce découpage, puisqu'ils
sont plantés. La note le dit en toutes lettres plutôt que de laisser croire que
« Plantée » et « en production » désignent la même surface. Elle n'est rendue
que si l'agrégat est fourni : sans lui, la piste reste juste, elle dit
simplement moins.

**Deux échelles distinctes, jamais additionnées** — chaque bloc porte la sienne
en sous-titre, sans quoi on lirait cinq parts qui ne font pas cent :

| Bloc | Dénominateur | Rendu |
|---|---|---|
| Plantée / Arrachée | surface **totale** (arrachée comprise), comme `agregerRegistreExploitation` | une piste, deux segments `flexGrow` séparés d'un filet de fond de 2 px ; le libellé est dans le segment dès 16 % de largeur, la part seule en dessous ; les deux surfaces en hectares sont reprises en légende, qu'un segment étroit ne peut pas porter |
| Classes d'âge | surface **plantée** seule — une parcelle arrachée n'a plus d'âge de vigne, même exclusion que l'âge moyen pondéré | quatre barres dont la longueur est la **part de la surface plantée**, pas une part du maximum : la piste entière vaut cent pour cent et les quatre barres s'y ajoutent exactement |

**Bornes des classes : `[0,10[`, `[10,30[`, `[30,50[`, `[50,∞[`** — fermées à
gauche, ouvertes à droite. Une vigne de trente ans tout juste est « 30 à 50 »,
jamais comptée deux fois. Un âge négatif (année de plantation postérieure à la
campagne, ou cellule en cours de saisie) tombe dans la première classe plutôt
que d'être perdu : **la somme des classes vaut toujours exactement la surface
plantée**, invariant sans lequel le graphique mentirait sur des proportions.
Un test le fige (§18, section 29 des tests).

**Couleurs.** Comme la frise et le schéma de parcelle, ce sont des couleurs de
*série* : littérales, identiques dans les deux thèmes. Les classes d'âge
portent une rampe d'une **seule teinte**, du clair au foncé
(`#9BBEA7 · #74A084 · #547E64 · #365D46`) : l'âge est une grandeur *ordonnée*,
quatre couleurs franches lui inventeraient quatre catégories sans rapport. La
teinte ne porte **aucun jugement** — l'outil ne dit pas qu'une vigne de
cinquante ans est un problème, il montre la surface concernée. Les deux
extrémités de la rampe ont été vérifiées lisibles sur le fond clair **et** sur
le fond sombre, et chaque barre porte son chiffre en clair à côté d'elle : la
couleur ne porte jamais seule l'information. « Arrachée » reprend le beige de
la phase **repos** de la frise (`#CFC6B0`) — une parcelle arrachée *est* une
surface en repos, elle doit se reconnaître d'un graphique à l'autre.

La piste de fond des classes d'âge prend `--surface-basse` et non
`--bordure-claire` : dans le thème sombre, le dernier pas de la rampe est plus
foncé qu'une bordure et la barre s'y lirait comme un **creux**, figure et fond
inversés. Le filet `--bordure` qui la borde redonne l'étendue des cent pour
cent, que le fond seul ne montre plus dans le thème clair.

---

## 19. Limites, hypothèses et paramètres cachés

> 🚧 **CHANTIER C6 — NON DÉMARRÉ, en attente d'une vérification externe
> BLOQUANTE (série C, 07/09/2026).**
>
> `coutSurfaceProdHaAn` (11 400 €/ha/an, documenté « charges de structure hors
> charges locatives, amortissement retiré » = 15 300 − 3 900) est **écrasé** par
> `reprendreVoletProd` avec le total du détail par opération
> (`REF_OPS_MANUEL` / `REF_OPS_MECANISE` : taille, liage, ébourgeonnage,
> relevage, rognage, sol, ferti-irrigation, traitements). Ce sont des
> **opérations culturales**, pas des charges de structure : **deux assiettes
> incompatibles dans un seul champ**.
>
> Les deux conséquences sont **de sens opposé**, ce qui est la pire
> configuration — le total paraît plausible pour de mauvaises raisons :
> si 11 400 est de la structure seule, les opérations culturales ne sont nulle
> part dans le modèle par défaut, et comme la référence porte ce taux 10 ans
> contre 6 pour l'arrachage, l'omission biaise **en faveur du statu quo** ;
> cliquer « ↻ Reprendre » remplace la structure par les opérations et fait
> disparaître assurance, foncier, mécanisation et frais généraux — biais
> **dans l'autre sens**.
>
> Enjeu de magnitude : 11 400 × 10 ans = **114 000 €/ha**, soit environ deux
> fois l'investissement de plantation. C'est le poste le plus lourd du modèle,
> et le seul dont le commentaire de provenance dise « ou repris de… », ce qui
> n'est pas une provenance.
>
> **Précondition à lever avant tout code** : faire confirmer par le **Cerfrance
> Nord Est Île-de-France** le périmètre exact du poste 15 300 €/ha de la
> référence 2024 — charges de structure seules, ou total incluant les
> opérations culturales ? Interroger la **grille d'analyse de gestion**, pas le
> document de synthèse grand public, où la ventilation n'est en général pas
> explicitée. Le sens du chantier en dépend et la réponse **n'est pas
> déductible du dépôt**. La conclusion, sourcée et datée, se reporte ici.
>
> Le chantier prévoit ensuite de scinder en `coutStructureHaAn` (défaut
> Cerfrance, **jamais** cible d'un bouton « Reprendre ») et
> `coutOperationsHaAn` (seule cible de `reprendreVoletProd`), `chargesEntretien`
> consommant la somme des deux, avec `coutSurfaceProdHaAn` conservé en entrée
> de compatibilité pour les instantanés `localStorage` antérieurs. **Ne pas
> démarrer sans la source écrite.**

> **Depuis le chantier C7 (07/09/2026), les six omissions les plus
> structurantes de cette section sont RECOPIÉES EN PIED DE FICHE D'AUDIT**
> (`out.printLimitesRows`, rendu dans la sortie « Fiche d'audit »), pour qu'un
> conseiller ou un comptable sache où s'arrête la garantie du document qu'il a
> sous les yeux, sans avoir à ouvrir ce README : aucune actualisation, aucune
> valeur terminale d'actif, aucun coût de financement, aucun échéancier de
> paiement, prix du raisin unique et constant, rendement butoir non modélisé.
> Toute limite ajoutée ici et jugée structurante doit y être répercutée — un
> test vérifie que la fiche en porte exactement six.

- **Mono-parcelle, prix unique.** Pas de distinction cépage/cru/millésime.
- **Aucun échéancier de paiement — trésorerie en année pleine (chantier C7).**
  Le modèle ne connaît pas de pas de temps infra-annuel : les années du point
  bas de trésorerie et du creux de réserve sont des **années, pas des dates**.
  Pour mémoire, campagne 2026 : première échéance à 25 % du volume
  commercialisable (2 200 kg/ha) au 5 décembre, solde en trois versements
  égaux — **valeur annuelle, à revérifier à chaque campagne**. Cette mention
  est obligatoire sur la fiche d'audit : le point bas y est présenté dans un
  contexte de financement, et sans elle le lecteur croit lire une trésorerie
  datée.
- **Rendement butoir non modélisé (chantier C7).** La récolte n'est plafonnée
  nulle part dans le moteur ; le butoir de la campagne 2026 (15 500 kg/ha)
  n'est appliqué à aucune série. Une récolte simulée au-dessus de ce seuil
  n'est pas écrêtée. À ne pas confondre avec le VolCo (`VOLCO_CAMPAGNE`,
  8 800 kg/ha en 2026), qui, lui, est bien modélisé.
- **Aucun coût de financement (rappelé par C3 et C7).** Ni taux d'emprunt, ni
  durée, ni différé. Le solde investissement / réserve n'est donc **pas** un
  coût de crédit, et le point bas de trésorerie n'est pas un besoin de
  financement chiffré. C'est la raison pour laquelle le mot « à financer » a
  été retiré du KPI de solde au chantier C3.
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
- **Assiette des charges d'entretien (prompt B9, décision D3).** Depuis que
  la production, le VolCo, le plafond et le stock de réserve sont assis sur la
  **surface en production** (`surfProdTot`, §7), `chargesEntretien` fait
  exception : le reste de l'exploitation y est toujours facturé au taux
  « vigne en production » sur `surfTot − surfParc`, plantiers et parcelles en
  repos compris. L'exploitation paie donc de l'entretien de vigne mature sur
  des hectares qui ne produisent pas. Limite assumée, tenue par un test nommé,
  traitée dans un lot ultérieur — voir §19quater.
- **Pas d'écrêtement du stock de réserve (prompt B9, décision D4).** Quand la
  surface en production diminue (arrachage), le stock déjà constitué peut
  dépasser `plafond × nouvelle surface en production`. Le moteur le conserve
  et se contente d'annuler la marge de mise. Point réglementaire **non
  tranché**, à faire arbitrer par le service Appellation/Vendanges du Comité
  avant toute modélisation — voir §19quater.
- **Seuil d'entrée en production non sourcé.** `SEUIL_ENTREE_PRODUCTION = 3`
  ans sépare le plantier de la vigne en production, donc décide de l'assiette
  réglementaire. Cohérent avec `returnYear = 3 + repos` (§7), mais marqué
  « À VALIDER » dans le moteur : à confirmer sur le cahier des charges AOC
  Champagne, chapitre entrée en production.
- **Aucune actualisation.** Les flux de trésorerie (`cashNet`, `investissement`,
  cumuls) sont sommés bruts sur l'horizon (10 ans côté interface depuis
  l'arbitrage 6 du 01/09/2026 ; le moteur accepte toujours 25), sans taux
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
  commercialisable (`v.volco`, champ de saisie éditable).
- **VolCo de campagne — `OAD.VOLCO_CAMPAGNE = 8800` kg/ha.** Décision du
  Bureau exécutif du Comité Champagne du **22/07/2026**, campagne 2026
  (9 000 en 2025, 10 000 en 2024, 11 400 en 2023, 12 000 en 2022). C'est
  une **valeur annuelle** : elle doit être revérifiée à chaque campagne, et
  elle est le défaut du champ `v.volco`, que l'utilisateur reste libre de
  modifier. Un test de cohérence (§18 de la suite) vérifie que le défaut de
  l'interface et la constante du moteur ne divergent pas.
- **⚠ `VOLCO_CAMPAGNE` et `VOL_SORTIE_ARRACHAGE` sont deux choses
  différentes.** La seconde vaut 9 000 kg/ha, et le VolCo de la campagne
  2025 valait lui aussi 9 000 kg/ha : **coïncidence de chiffres, pas
  égalité de nature.** `VOL_SORTIE_ARRACHAGE` est le volume annuel débloqué
  de la réserve individuelle pendant la fenêtre d'arrachage (règle CIVC
  repos → déblocages) ; `VOLCO_CAMPAGNE` est le volume commercialisable
  voté chaque année. Les deux ne se mettent pas à jour ensemble. Ne jamais
  dériver l'une de l'autre ni les fusionner en une constante unique — un
  test dédié vérifie qu'elles restent distinctes.
- **Paramètres non éditables dans l'UI, sortis de `renderVals()` au prompt
  A2** : `OAD.PLAFOND_RESERVE` (10 000 kg/ha), `OAD.REND_MOYEN_REGIONAL`
  (12 296,6 kg/ha) et `OAD.ECART_TYPE_REGIONAL` (3 440 kg/ha) vivent
  désormais dans `moteur-oad.js`, où ils portent leur provenance et sont
  couverts par les tests. Ils étaient auparavant câblés dans la vue —
  intenable depuis que l'écart-type pilote le **scénario par défaut**
  (arbitrage 8). Le couple (moyenne, écart-type) reste *assumé* : sa
  période de calcul est à documenter avant diffusion.
  `horizon` n'est **plus** éditable depuis l'arbitrage 6 : figé à 10 ans
  côté UI, entier côté moteur. `seuilReserve` reste une prop cachée non
  exposée (§17).
- **⚠ Le test de résistance climatique change de nature selon le VolCo
  saisi.** Le test force la mauvaise vendange à
  `REND_MOYEN_REGIONAL − ECART_TYPE_REGIONAL` = **8 856,6 kg/ha**. Face à un
  VolCo de 9 000 (campagne 2025) elle est **déficitaire** de 143 kg/ha et
  puise dans la réserve ; face au VolCo de 8 800 (campagne 2026) elle est
  **excédentaire** de 57 kg/ha et l'abonde. Le scénario par défaut de
  l'outil bascule donc de sens selon un champ que l'utilisateur peut
  modifier. Ce comportement n'a **pas** été changé — `simulerReserveKg` est
  intact ; il a été rendu visible et testable par
  `OAD.stressEstDeficitaire(volco)` (prompt A3) et le bandeau de l'écran 5
  affiche la précision correspondante, calculée sur le VolCo effectivement
  saisi.
- **Faire-valoir simplifié** : fermage = loyer fixe (souvent indexé
  kg/bouteilles en réalité) ; métayage = parts éditables mais fixes dans le
  temps ; les contrats réels varient davantage.
- **Rendement des leviers branché sur le VolCo** mais paramétré par des
  hypothèses à caler : montée en charge de l'arrachage (`anneePleineProd`
  → `ramp`, chantier A3, §7ter), survie des entreplants (`survie`) et délai
  de leur montée en charge (`entreeProdCompl`, 7 ans fixé en dur depuis le
  chantier A3, complantation non exposée). `rendFactorProjet` (hook générique
  de `simulerReserveKg`, §7) reste actif dans le moteur mais n'est plus
  alimenté par l'UI depuis le chantier B4 (pénalité VSL retirée de
  l'interface, §11, journal d'arbitrages « chantier B4 ») — vaut 1 en pratique.
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
  interdite (l'ancien badge « interdite en AOC » a été remplacé au prompt
  B7 par un renvoi au cahier des charges, chapitre I — conditions de
  production ; le champ « arrosage du plantier » ne bloque pas le calcul et
  ne porte, par arbitrage du 01/09/2026, **aucun commentaire de
  provenance** : seule dérogation du projet à la règle de sourçage) ; Voltis
  ≤ 5 % de l'encépagement + 10 % d'assemblage (badge informatif).
- **Dépendance réseau** : `support.js` charge React/ReactDOM/Babel depuis
  `unpkg.com`, et `index.html` charge les polices depuis Google Fonts. Sans
  connexion Internet au premier chargement, la page reste blanche. C'est la
  raison pour laquelle la frise d'accueil (prompt B6) et tous les graphiques
  sont en **SVG inline** : aucune image externe n'est ajoutée à cette
  dépendance déjà présente.
- **Persistance locale — la contrainte « pas de `localStorage` » est levée**
  (arbitrage 1 du 01/09/2026, prompt B1). L'outil enregistre un **instantané**
  de `state.v`, de `state.registreRows` et de quelques drapeaux
  (`registreImporte`, `champsTouches`, `accueilVu`) sous la clé versionnée
  `oad-renovamus-v1`. Jamais un diff, jamais un identifiant de ligne : au
  rechargement la table est relue telle quelle, ce qui rend inutile toute
  clé stable de ligne. Un instantané d'une version antérieure du format est
  ignoré en silence, l'outil repartant sur ses défauts. Lectures et écritures
  sont encapsulées et ne lèvent jamais : `localStorage` peut être absent,
  plein ou refusé (navigation privée, politique d'entreprise). **Ce qui reste
  interdit :** tout appel réseau et toute donnée placée dans l'URL. Rien ne
  sort jamais du navigateur. Le bouton « Effacer mes données » de l'en-tête
  vide la clé et recharge les valeurs d'exemple. `CLAUDE.md` a été mis à
  jour dans le même commit, pour qu'une session ultérieure ne supprime pas
  la persistance en croyant réparer une violation.
- **Classeur Excel de portage : maquette jetable, ne fait pas foi.** Le
  classeur Excel qui a servi de support initial au chiffrage de ce chantier
  (distinct des classeurs sources cités en provenance des valeurs, ex.
  LutEnVi 2025, §12/§14) est une maquette de travail jetable : il n'est **pas**
  maintenu en parallèle de ce dépôt et ne doit **jamais** être utilisé comme
  référence pour auditer un chiffre affiché à l'écran. `moteur-oad.js` et
  `tests/parite.test.js` (formules + snapshots figés) font seuls foi.

### 19bis. Journal d'arbitrages — accueil, simplification de l'interface, deux corrections

Objectif : qu'une personne qui n'a jamais vu le projet puisse s'en
servir. Aucune fonctionnalité, aucun champ, aucun KPI n'a été retiré —
seule la manière dont ils sont présentés change. Le moteur
(`moteur-oad.js`) n'a pas été touché.

**Ce qui a changé dans l'interface** (détail des conventions : §3bis)

1. **Un mode d'emploi**, ouvert au premier affichage en tête de l'étape 1 :
   ce que l'outil compare, les 5 étapes, le fait que tout est prérempli
   et qu'aucune donnée n'est enregistrée ni envoyée.
2. **Un lexique** accessible depuis l'en-tête, à toutes les étapes.
3. **Le jargon de développement est sorti des textes visibles** : plus de
   « chantier A4 », « voir README, journal d'arbitrages », « P6 »,
   « v1 ». Ces références restent en commentaires et ici.
4. **Les charges de production de l'étape 1 sont repliées** par défaut —
   ce sont des paramètres de référence déjà calés que personne n'a à
   toucher au premier passage. Leur en-tête affiche les deux montants en
   résumé, pour que le repli n'enterre pas un chiffre vérifiable.
5. **Les 4 réglages d'affichage de l'étape 5** (vue faire-valoir, main
   d'œuvre, horizon, test de résistance), auparavant alignés en une rangée
   où rien ne disait ce qu'ils font, sont étiquetés un par un sous un
   titre qui précise qu'ils ne modifient aucune saisie.
6. **Le sommaire porte un sous-titre par étape** — « Plantation » seul ne
   dit pas ce qu'on va y saisir.
7. **Uniformisation** : un seul habillage de volet repliable au lieu de
   trois, et les styles inline répétés (≈ 280 occurrences) portés sur des
   classes CSS.
8. **Accessibilité** : `for`/`id` sur les 40 champs saisissables,
   `aria-current` sur l'étape courante, mise en page repliée sous 1080 px.

**Deux corrections**

- **`tests/parite.test.js` — 4 tests ne s'exécutaient pas.** Le jeu
  d'essai « repos = 3 ans » avait été renommé `INP_B_REPOS3`, mais quatre
  tests référençaient encore `INP_B_SANITAIRE` : ils échouaient sur
  `ReferenceError`, pas sur une valeur. Les références ont été alignées
  sur le nom réel du jeu d'essai ; la suite passe à **97 ok, 0 FAIL**.
  Aucune valeur attendue n'a été modifiée.
- **`index.html` — l'avertissement « cépages mixtes » ne s'affichait
  jamais.** `out.cepageMixteTxt` était calculé à partir de
  `out.cepageMixteAlerte`, qui n'est affecté qu'une trentaine de lignes
  plus bas dans `renderVals()` : la valeur lue était toujours
  `undefined`, donc le texte toujours vide, y compris sur une sélection
  de registre réellement hétérogène. Le texte est désormais dérivé de sa
  source (`agregParcelle.cepageMixte`), indépendante de l'ordre des
  affectations sur `out`. Avertissement purement informatif — aucun
  impact sur le calcul économique.

### 19ter. Journal d'arbitrages — session du 01/09/2026

Quatorze décisions prises en séance, appliquées par la séquence de prompts
A1-A3 / B1-B7 / C1-C3. Pour chacune : ce qu'elle produit, et **ce qu'elle
écarte** — une décision dont on n'a pas noté l'alternative se rediscute à
l'infini.

> **Révisions ultérieures.** L'arbitrage 8 (test de résistance climatique actif
> par défaut, deux vendanges déficitaires) est **maintenu** — c'est lui, en
> revanche, qui rend la trésorerie cumulée négative dans la quasi-totalité des
> configurations, et donc lui qui a motivé son retrait de l'écran du temps 3 le
> 08/09/2026 (§19quinquies). Le paramétrage par défaut n'a pas changé : c'est
> ce qu'on en montre qui a changé.

| # | Décision | Conséquence | Ce que ça écarte |
|---|---|---|---|
| 1 | `localStorage` autorisé — persistance par **instantané** de `state.v` et `state.registreRows`, pas par diff | Les saisies survivent au rechargement ; bouton « Effacer mes données » dans l'en-tête ; `CLAUDE.md` mis à jour **dans le même commit** | Écarte la persistance par diff, qui aurait exigé une clé stable par ligne de registre — donc un appariement fragile après import. Écarte aussi tout stockage distant : rien ne sort du navigateur |
| 2 | ~~Registre : **édition des cellules uniquement**, ni ajout ni suppression ni exclusion de lignes à l'écran 1~~ — **révisé au prompt B8** (voir ci-dessous) | 4 colonnes saisissables (surface, année de plantation, taux de manquants, situation) | Écarte un éditeur de registre complet. Le mécanisme d'exclusion de lignes de l'écran 2 reste seul et inchangé — deux mécanismes d'exclusion auraient été indistinguables pour l'utilisateur |
| 2bis (B8) | **Le registre devient la seule source** : la saisie manuelle disparaît des écrans 1 et 2, et le tableau gagne l'ajout et la suppression de lignes | Toutes les colonnes saisissables, bouton « + Ajouter une ligne » et ✕ par ligne, bandeau bloquant si la surface totale est nulle | Deux sources concurrentes pour les mêmes grandeurs obligeaient à documenter partout laquelle avait gagné. Rendre le registre obligatoire imposait en retour de pouvoir le remplir sans export CSV — d'où l'ajout/suppression, qui contredit délibérément l'arbitrage 2 |
| 3 | Import : **export du portail CIVC**, 12 colonnes spécifiées | Colonne obligatoire manquante → message qui **la nomme**, table en place non remplacée | Écarte un import « best effort » qui aurait produit des zéros silencieux là où une colonne manque |
| 4 | Clones : **union** Guide 2025 + PlantGrape, origine marquée par ligne — 42 lignes | Référentiel sourcé dans le moteur, marqueur d'origine par ligne, 3 origines partielles visibles | Écarte le choix d'une source unique, qui aurait perdu soit les clones hors Guide, soit les colonnes agronomiques |
| 5 | Colonne **Botrytis conservée vide**, avec note explicative | Affichée et vide sur 37 des 42 lignes, renvoi CIVC / plantgrape.fr | Écarte à la fois le retrait de la colonne (on perdrait l'information qu'elle manque) et son remplissage par dire d'expert |
| 6 | **Horizon figé à 10 ans**, sélecteur retiré, paramètre conservé dans le moteur | Un réglage de moins ; `inp.horizon = 10` en dur côté UI | Écarte le sélecteur 10/25 ans. **N'écarte pas** la capacité du moteur : les tests de parité couvrent toujours 25 ans |
| 7 | **Arrosage du plantier** autorisé et affiché, sans mention de provenance dans le code | Sélecteur rétabli sous ce libellé, renvoi au cahier des charges | Écarte le badge « interdite en AOC », qui tranchait une question réglementaire à la place de la source. **Seule dérogation du projet à la règle de sourçage** |
| 8 | **Test de résistance climatique actif par défaut**, 2 années déficitaires | Bandeau non repliable en tête de l'écran 5, bascule en un clic | Écarte le défaut « moyenne régionale chaque année », qui présentait la transition sous son jour le plus favorable |
| 9 | IDU réels du jeu d'exemple : **diffusion validée** | Le jeu d'exemple reste tel quel | Écarte l'anonymisation des identifiants parcellaires |
| 10 | **Mobile hors périmètre** | Aucun travail d'adaptation petite largeur | Écarte le responsive mobile pour cette version |
| 11 | **Chemin court à 11 champs** ; investissement affiché comme « coût de référence Champagne » | Volets « Ajuster » repliés par écran, indicateur « *n* repères sur 11 », libellé qui bascule sur « votre investissement » dès qu'un des 4 postes est édité | Écarte la suppression de champs : les 53 contrôles sont tous encore là. Écarte aussi un total présenté comme « le vôtre » alors qu'il n'est qu'une référence |
| — | Référentiel clones **hébergé dans `moteur-oad.js`**, comme `ARBRE_PG` | `CLONES_CHAMPAGNE` + `OAD.clonesParCepage()`, JSON de travail commité sous `data/` | Écarte le chargement du JSON à l'exécution — le projet n'a ni build ni dépendance |
| — | `declinSQ` déplacé vers un volet **« hypothèses de comparaison »** à l'écran 5 | Saisi juste au-dessus du tableau « Manque à gagner » qu'il commande | Écarte son maintien à l'écran 2, où il passait pour une caractéristique de la parcelle alors qu'il décrit le contre-factuel |
| — | Écran 5 : **KPI physiques en tête**, trésorerie en second | Bloc « Ce que le renouvellement produit » au niveau typographique des ex-KPI financiers ; ceux-ci descendent d'un cran sans rien perdre | Écarte une lecture qui commence par une trésorerie cumulée négative dans la quasi-totalité des configurations |
| — | Année de retour à l'équilibre : **écartée** | Aucun indicateur du moment où la trésorerie s'inverse | Point de vigilance porté en recette (§21) : vérifier que la lecture ne devient pas décourageante au point d'être inutilisable |

**Ce que la séquence n'a pas touché.** `support.js` (jamais modifié).
`simulerReserveKg` et toutes les formules du moteur : les 97 tests de parité
d'origine passent inchangés, aucune valeur attendue n'a été mise à jour. Les
17 tests ajoutés (sections 16 à 18) documentent le référentiel clones, les
constantes de campagne, le basculement du test climatique et la cohérence
entre les défauts de l'interface et les constantes du moteur — **114 ok,
0 FAIL**.

**Ce qui reste ouvert après cette séquence** (repris de la séquence de
prompts, à trancher avant diffusion) :

- Numéro de la décision CIVC fixant la règle repos → déblocages
  (1/2/3 ans → 3/4/5 années à 9 000 kg/ha), toujours non publiée.
- `coutReposHaAn` reste à 0 €/ha/an — seul paramètre de charge non sourcé ;
  sur la fenêtre de jachère, le contre-factuel garde un biais optimiste
  résiduel.
- Postes mécanisés des volets par opération, à caler sur données coopérative
  ou Chambre d'agriculture de la Marne.
- Date de relevé des prix `PRIX_PALISSAGE` et `PRIX_PROTECTION_PLANT`.
- Date de relevé des surfaces de multiplication PlantGrape, et période de
  calcul du couple (`REND_MOYEN_REGIONAL`, `ECART_TYPE_REGIONAL`).

### 19quater. Journal d'arbitrages — prompt B9 : assiette de surface (registre vs production)

**Diagnostic.** `agregerRegistreExploitation` renvoyait `surfTot` = somme de
**toutes** les lignes du registre, Plantée et Arrachée. Cette valeur était
injectée telle quelle dans `construireScenarios` puis `simulerReserveKg` comme
**surface productive** : `surfRest = surfTot − surfArr` (récolte du reste de
l'exploitation), `surfProd = surfTot` en statu quo et complantation,
`volco = surfProd × volco`, `stockDebut = reserveInit × surfTot` et le plafond
de mise en réserve `plafond × surfProd`.

Or l'assiette réglementaire du rendement commercialisable et du plafond de
réserve individuelle est la **surface en production**, qui exclut :

- les parcelles en repos (`situation = 'arrachee'`) ;
- les **plantiers**, c'est-à-dire les lignes Plantée dont l'âge est inférieur
  au seuil d'entrée en production.

Conséquence : sur une exploitation en renouvellement régulier (5 à 8 % de
surface non productive en permanence), l'outil surestimait simultanément la
récolte, le VolCo, le plafond de mise en réserve et le **stock de réserve
initial**. Le biais n'était pas neutralisé par la comparaison inter-scénarios :
la dynamique de réserve est non linéaire (bornes `min`/`max`, plafond, plancher
à zéro) et `sortieArr` est plafonné par `stockDebut` — le déblocage d'arrachage
apparaissait donc plus finançable qu'il ne l'est réellement.

**Les quatre décisions.**

| # | Décision | Conséquence | Ce que ça écarte |
|---|---|---|---|
| D1 | `surfTot` **conserve** sa définition (toutes lignes) et reste la surface d'affichage du temps 1. On **ajoute** `surfProd`, on ne redéfinit rien | `agregerRegistreExploitation` renvoie `{ surfTot, surfProd, surfPlantier, surfRepos, ageMoy }`, partition stricte de `surfTot` | Écarte la redéfinition silencieuse de `surfTot`, qui aurait cassé les 164 tests existants sans signal explicite — un changement de sémantique déguisé en correction |
| D2 | Seuil d'entrée en production : `campagne − anneePlant ≥ 3`, porté par la constante nommée `SEUIL_ENTREE_PRODUCTION` | Commentaire de provenance dans le moteur : « **À VALIDER** — CDC AOC Champagne, chapitre entrée en production ; cohérent avec `returnYear = 3 + repos` (§7) » | Écarte le nombre nu dans le code. **Ce n'est pas une valeur sourcée** : elle est marquée comme telle, à la manière des autres valeurs « assumé » du projet |
| D3 | Le moteur consomme `surfProdTot` pour **production, VolCo, plafond et stock de réserve**. Les **charges d'entretien** restent inchangées : `chargesEntretien` continue de facturer `surfRest = surfTot − surfParc` au taux « vigne en production » | Limite connue, tenue par un test nommé `LIMITE ASSUMÉE : chargesEntretien facture le reste de l'exploitation sur surfTot…` | Écarte le changement simultané des deux sémantiques. Une seule change à la fois : sans quoi un écart de résultat ne serait imputable ni à l'une ni à l'autre. **Traité dans un lot ultérieur** |
| D4 | **Écrêtement hors périmètre** : quand le stock dépasse `plafond × nouvelle surface en production` après arrachage, le comportement actuel est maintenu — le stock existant est conservé, seule la marge de mise s'annule (`Math.max(0, …)`) | `TODO` explicite dans `simulerReserveKg`, et un test nommé `LIMITE ASSUMÉE : le stock de réserve n'est pas écrêté…` qui fige le comportement | Écarte toute modélisation d'un écrêtement décidée par le code. **Point réglementaire à faire trancher par le service Appellation/Vendanges du Comité** avant modélisation |

**Ce qui a changé, concrètement.**

- `moteur-oad.js` — `SEUIL_ENTREE_PRODUCTION = 3` (exportée) ;
  `agregerRegistreExploitation` renvoie la partition ; `simulerReserveKg` lit
  `surfProdTot` aux quatre emplacements de production/réserve (`surfRest`,
  `surfProd` en branche non-arrachage, `stockDebut` à `t = 0`, et par voie de
  conséquence `volco` et la marge de plafond) ; `construireScenarios` accepte
  `inp.surfProdTot` et le propage.
- **Garde-fou** — `surfParc > surfTot` devient `surfParc > surfProdTot` : la
  parcelle candidate à l'arrachage est nécessairement en production. Le message
  d'erreur nomme les **deux** assiettes, sans quoi un utilisateur dont la
  parcelle tient dans `surfTot` mais pas dans `surfProdTot` ne comprendrait pas
  ce qu'on lui refuse. Même borne côté interface (`out.erreurSurface`), pour
  que le moteur ne lève jamais au rendu.
- **Repli explicite** — `inp.surfProdTot ?? inp.surfTot`, dans
  `construireScenarios` **et** dans `simulerReserveKg` (fonction exportée,
  appelable directement). Il préserve la parité stricte des fixtures de test
  antérieures et le mode hors registre, où aucune décomposition n'est
  dérivable.
- **Interface** — temps 1 : champ « Surface en production » à côté de
  « Surface totale », avec la mention de ce qu'il laisse dehors (plantier,
  repos) ; note de décomposition sous la piste « Plantée et arrachée » du
  graphique, qui dit en toutes lettres que « Plantée » et « en production » ne
  sont pas la même surface ; bandeau replié du registre qui annonce les deux
  chiffres. Écran des hypothèses : ligne « Surface en production » d'origine
  *Dérivé du registre — lignes Plantée d'âge ≥ 3 ans*, et l'origine de la
  réserve initiale précise désormais sur quelle assiette la conversion en kg
  s'appuie.

**Vérification.** Les 164 tests antérieurs passent **sans qu'aucune fixture ni
valeur attendue n'ait été touchée** ; 16 tests ajoutés (section 30) —
**180 ok, 0 FAIL**. Deux d'entre eux tiennent les critères d'acceptation par
**exécution comparée**, pas par assertion de principe :

- *invariance* — sur un registre sans ligne Arrachée et sans ligne sous le
  seuil, `construireScenarios` avec et sans `surfProdTot` produit des sorties
  strictement identiques (`assert.deepStrictEqual` sur l'objet complet) ;
- *sensibilité* — sur un registre témoin à 2 ha au registre pour 1 ha en
  production, stock de réserve initial, VolCo annuel et assiette du plafond de
  mise sont strictement inférieurs à l'ancien calcul, dans un rapport égal à
  `surfProd / surfTot` (0,5), vérifié année par année.

**Deux points parkés, à rouvrir explicitement.**

1. **Assiette des charges** (D3) — `chargesEntretien` facture toujours le reste
   de l'exploitation au taux « vigne en production » sur `surfTot − surfParc`,
   plantiers et parcelles en repos compris. Lot ultérieur.
2. **Écrêtement du stock** (D4) — aucune règle n'est appliquée quand la surface
   en production diminue. À faire trancher par le service Appellation/Vendanges
   du Comité.

**Effet de bord documenté, non corrigé.** Une ligne Plantée sans année de
plantation exploitable retombe sur le `|| campagne` hérité (âge 0) et se
classe donc en **plantier**, hors assiette de production. Comportement figé par
un test ; le corriger demanderait de décider ce que vaut une ligne incomplète,
ce qui n'était pas l'objet de ce lot. Dans le même esprit : une exploitation
dont **toute** la surface serait en repos ou en plantier donne une assiette
nulle, donc des résultats à zéro — le moteur ne divise pas par la surface
(gardes `surfProd === 0 ? 0 : …`), mais l'écran 1 ne déclenche pas d'état
bloquant pour autant, son test portant sur `surfTot`.

### 19quinquies. Journal d'arbitrages — refonte du temps 3 : six thèmes, un axe d'années (08/09/2026)

**Diagnostic.** Le temps 3 se lisait en **cinq onglets** — « Coût, poste par
poste », « Réserve individuelle », « Main d'œuvre et charges », « Ce qui est
replanté », « Rajeunissement du vignoble » — dont un seul était visible à la
fois. Ces intitulés reprenaient l'ordre des **blocs de code**, pas une question
que l'utilisateur se pose ; rien à l'écran ne disait qu'il restait quatre
onglets fermés, et un conseiller ne peut pas expliquer une trajectoire en les
dépliant l'un après l'autre.

Au-dessus d'eux, la frise portait trois pistes, dont la troisième était la
**trésorerie cumulée de la parcelle seule**. Sur dix ans avec deux vendanges
déficitaires par défaut — le paramétrage par défaut, arbitrage 8 du prompt B3 —
cette courbe est négative dans la quasi-totalité des configurations. Elle
occupait le tiers inférieur de la seule image de l'écran pour dire une chose
déjà connue : *un renouvellement coûte avant de rapporter*. Autour d'elle
s'étaient accumulés un cartouche « point bas », une ligne différentielle (C4) et
une cascade de quatre termes (C5), tous adossés aux mêmes cumuls en euros.

**Décision.** Le temps 3 est réorganisé par **THÈME** et par **ANNÉE**. Six
pistes sur un axe de onze colonnes — phase, stock de réserve, déblocage,
blocage, investissements, entretien —, six cartes de synthèse, un panneau
« Année N », une matrice années × thèmes. La trésorerie cumulée sort de l'écran.

| # | Décision | Conséquence | Ce que ça écarte |
|---|---|---|---|
| 1 | **La trésorerie cumulée sort de la frise** et de l'écran | Six pistes thématiques à sa place ; la piste du stock de réserve est reprise **inchangée** (géométrie, point du creux, étiquette) | Écarte le maintien d'une courbe juste mais illisible en tête d'écran. Écarte aussi de la remplacer par une trésorerie « annuelle » ou « lissée » : le problème n'était pas la forme du cumul, c'était qu'un flux financier négatif ouvre l'écran |
| 2 | Le **point bas de trésorerie** (`kpiPointBas`) est retiré | Le bloc « ce que le renouvellement produit » ne porte plus que des grandeurs physiques | Écarte de le garder « au cas où » : c'est l'extremum d'une série qui n'est plus affichée. Un extremum sans sa série n'est pas interprétable |
| 3 | La **ligne différentielle (C4)** et la **cascade (C5)** quittent l'écran et la fiche d'audit | Le seul chiffre financier de tête reste l'investissement net de la réserve | N'annule pas l'arbitrage C4 sur son terrain : un simulateur d'impact a besoin d'un point de référence arithmétique. Ce qui a changé, c'est l'écran — un cumul différentiel sur dix ans n'a pas de colonne où se poser dans une lecture par année |
| 4 | `OAD.tresorerieCumulee`, `OAD.differentielTresorerie` et `OAD.cascadeDifferentielle` **restent exportées et testées**, marquées `@deprecated` | Les tests de moteur des §22, §33 et §34 sont conservés en entier, garde-fou de la cascade compris | Écarte la suppression pure et simple : les fonctions sont justes, et rien ne dit qu'un futur écran (dossier de financement, export comptable) n'en aura pas besoin. Ce qui est retiré est l'**affichage**, pas le calcul |
| 5 | Le volet **« Hypothèses de comparaison »** est retiré ; `declinSQ` n'est plus saisissable | La clé reste dans `state.v` et dans `inp` — le moteur la lit pour bâtir `sc.reference`, dont dépend `reserveHorizon`, encore affichée. La fiche d'audit en donne la valeur, marquée **NON SAISISSABLE** | Écarte de supprimer la clé : `sc.reference` en dépend. Écarte aussi de laisser le champ : un réglage dont on ne voit plus l'effet invite à régler au hasard |
| 6 | Les **cinq onglets** disparaissent | Contenu réparti par thème : coût poste par poste → thème 5, réserve → thèmes 2 et 3, main d'œuvre → thème 6, récapitulatif technique → une bande compacte, rajeunissement → le troisième chiffre de tête, qui le portait déjà dans sa légende | Écarte de convertir les onglets en volets repliables : ç'aurait été le même défaut avec un autre habillage. Écarte aussi d'y ajouter un sixième onglet par thème |
| 7 | L'**axe des années devient le contrôle** de l'écran : onze boutons `aria-pressed`, un panneau « Année N », des lignes de matrice cliquables | `state.anneeFrise` remplace `state.ongletResultat`, également **hors instantané `localStorage`** | Écarte le survol comme seul accès au détail annuel : un `title` n'existe ni au vidéoprojecteur ni au clavier. Écarte deux sélections concurrentes — l'axe et la matrice écrivent le même état |
| 8 | Le tableau « mode technique » devient la **matrice annuelle par thème**, partagée par l'écran et la fiche d'audit | Une seule construction (`out.matriceRows`), deux rendus | Écarte de garder les huit colonnes de moteur (surface productive, VolCo vendu, sortie pour insuffisance, cash net) : elles disaient le calcul, pas la trajectoire, et la dernière était le flux même que ce chantier retire |
| 9 | Le sélecteur de **faire-valoir** est rebranché sur la réserve débloquée | Le coefficient est **lu sur `OAD.repartir`** par différence entre un euro de `cashRI` et zéro — `repartir` est affine en `cashRI`, cette différence *est* son coefficient | Le sélecteur ne pilotait plus que des séries retirées : il serait devenu un bouton qui ne change rien, ce qui est pire qu'un contrôle absent. Écarte de recopier une table de régimes dans la vue — elle divergerait le jour où `repartir` changerait |
| 10 | La **remise au vigneron** rend une variante **compacte** de la même frise (`d.compact`) | Axe en texte simple, hauteurs réduites d'un tiers | La feuille d'impression masque tous les `button` : l'axe interactif y aurait perdu sa graduation, donc son axe de temps. Écarte une seconde fonction de dessin, qui divergerait de celle de l'écran |

**Critère de recette, vérifié par test.** Le mot « trésorerie » n'apparaît plus
dans le gabarit du temps 3 ni dans les deux sorties d'impression (lecture du
gabarit **sans ses commentaires** — ceux-ci documentent volontairement ce qui a
été retiré, et un test qui lirait le fichier brut échouerait sur sa propre
documentation).

**Ce qu'un chantier ultérieur ne doit pas « rétablir ».** Ces retraits ne sont
pas des oublis, et le code les commente à l'endroit exact où ils ont eu lieu :

- **aucune piste de trésorerie** sur la frise du temps 3, sous quelque forme
  que ce soit — cumul, flux annuel, courbe lissée ;
- **aucune cascade différentielle** ni ligne de différentiel cumulé sur cet
  écran ;
- **aucun cartouche de point bas**, qui n'est que l'extremum de la série
  retirée ;
- **aucune conversion de la réserve en euros** dans les thèmes 2 et 4 : le
  stock reste physique (§19, chantier C3) ;
- **aucune septième piste** : une piste de plus est un thème de plus, qui se
  décide, il ne s'ajoute pas ;
- **aucun champ de saisie du contrefactuel** : `declinSQ` garde sa valeur par
  défaut et sa mention sur la fiche d'audit.

**Tests ajoutés** (§36) : la somme des postes d'investissement par année égale
`sc.arrachage.investissement` (sur quatre paramétrages, poste à poste et
colonne à colonne) ; `Σ sortieArr × prixKg` égale `Σ cashRI`, en somme **et**
année par année ; le gabarit du temps 3 ne porte plus ni le mot « trésorerie »
ni d'appel aux deux fonctions retirées, et la frise porte six pistes, pas sept ;
la frise, le panneau d'année et la matrice lisent la même année retenue ;
`phaseParAnnee` couvre les onze années sans trou et s'accorde avec
`phasesParcelle` (vérification de la garantie du §21, sans la dupliquer).

**Tests mis à jour**, avec leur motif inscrit sur place : §23 (attentes
inversées — les onglets ont disparu), §24 (32 contrôles au lieu de 33,
`declinSQ` excepté), §28 (la synthèse imprimée ne porte plus l'absorption ni la
comparaison de cumuls ; la remise rend la frise compacte), §32 (la contrainte
d'adjacence se déplace sur le bloc « ce que le renouvellement produit »), §33 et
§34 (les tests de gabarit deviennent des verrous de non-retour ; les tests de
moteur sont conservés intacts).

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
  (`anneePleineProd`, `survie`, charges…). Non entamée.

## 21. Recette humaine — contrôles non automatisables

La note de cadrage du chantier C3 propose six parcours de recette ; les
six sont automatisables et couverts par `tests/parite.test.js` (section
15, « Parcours de recette métier »). Un septième point de contrôle,
proposé par la même note, ne l'est pas : la **lisibilité de l'écran 5**
relève d'un jugement humain (clarté d'un texte, cohérence visuelle d'un
graphique, absence de chevauchement) qu'un test automatisé ne peut que
simuler artificiellement — écrire un test factice sur ce point donnerait
une fausse impression de couverture. À vérifier manuellement, à chaque
changement touchant l'écran 5 :

- Le bandeau d'en-tête, les légendes de graphiques (stock de réserve,
  trajectoire d'âge) et le tableau « Manque à gagner » ne doivent annoncer
  ou afficher que ce qui est réellement exposé à l'utilisateur — pas de
  courbe, colonne ou légende résiduelle d'un scénario non sélectionnable
  (voir chantier C1, audit des résidus de la refonte).
- Les libellés de KPI restent compréhensibles sans lire le code : un
  utilisateur qui n'a jamais ouvert `moteur-oad.js` doit pouvoir relier
  chaque chiffre affiché à sa formule via la fiche imprimable, sans
  ambiguïté sur ce qui est un résultat du scénario arrachage et ce qui est
  un repère de comparaison interne (statu quo).
- Aucun chevauchement ni troncature de texte sur les tailles d'écran
  courantes (desktop standard, fenêtre réduite) — l'outil n'a pas de
  breakpoint mobile dédié à ce jour.
- La fiche imprimable (`window.print()`) reste lisible en A4 : titres de
  section, tableaux non coupés en plein milieu d'une ligne, pas de couleur
  illisible une fois imprimée en noir et blanc.

### Points ajoutés par la session du 01/09/2026

Six contrôles supplémentaires, tous non automatisables pour la même
raison : ils portent sur ce qu'une personne **comprend** en regardant
l'écran, pas sur ce que le code calcule. Les vérifier avant toute
diffusion, et après tout changement touchant les écrans concernés.

**1. Lisibilité de l'écran 5 après la bascule de hiérarchie (prompt B5).**
Les KPI physiques sont passés en tête, les KPI financiers d'un cran en
dessous. Vérifier **à l'œil** que la lecture n'est pas devenue
décourageante au point d'être inutilisable : avec un horizon de 10 ans et
deux vendanges déficitaires par défaut, la trésorerie cumulée est négative
dans la quasi-totalité des configurations. La question à se poser en
regardant l'écran est : *un vigneron qui découvre l'outil comprend-il que
le renouvellement produit quelque chose, ou n'y voit-il qu'une perte ?* Si
c'est la seconde réponse, le problème n'est pas dans le calcul — il est
dans l'ordre de lecture, et c'est ce point qu'il faut rouvrir.

**2. Absence d'indicateur de retour à l'équilibre — limite ASSUMÉE.**
L'année où la trésorerie annuelle s'inverse a été **écartée** en séance.
L'utilisateur ne dispose donc d'aucun repère sur le moment où l'opération
cesse de coûter. C'est une décision, pas un oubli : ne pas la « corriger »
sans rouvrir l'arbitrage. Ce qu'il faut vérifier en recette, c'est que
cette absence ne conduit pas un lecteur à conclure que la trésorerie ne
revient **jamais** à l'équilibre — ce que l'outil ne dit pas et ne peut pas
dire sur 10 ans.

**3. Cohérence du libellé de l'investissement (arbitrage 11).** Parcours à
faire dans cet ordre :
   - ouvrir l'outil sans rien toucher → les trois emplacements (KPI de
     l'écran 5, synthèse latérale, fiche imprimable) doivent dire **« Coût
     de référence Champagne »**, avec la mention renvoyant au temps 2 ;
   - modifier **un seul** des quatre postes (`coutArrachageHa`,
     `coutPlant`, `coutPalissageHa`, `coutProtectionHa`) → les trois
     emplacements doivent basculer **ensemble** sur « Votre
     investissement » ; aucun ne doit rester en arrière ;
   - remettre la valeur d'origine → le libellé doit **rester** « Votre
     investissement » (le drapeau suit « ce chiffre a-t-il été regardé »,
     pas « diffère-t-il du défaut ») ;
   - recharger la page → le libellé doit être conservé (drapeaux persistés) ;
   - « Effacer mes données » → retour à « Coût de référence Champagne ».

**4. Panneau d'accueil au clavier (prompt B6).** Sans jamais toucher la
souris :
   - au premier chargement, le panneau est ouvert ; `Tab` doit atteindre
     le bouton « Commencer ✕ » sans passer par du contenu invisible ;
   - `Échap` ferme le panneau, et le focus doit revenir **visiblement** sur
     le bouton « Comment lire cet outil » de l'en-tête ;
   - ce même bouton rouvre le panneau et le focus doit partir sur le bouton
     de fermeture ;
   - vérifier qu'on peut tabuler dans toute la page **sans** que le focus
     disparaisse derrière un élément recouvrant : le panneau est dans le
     flux du document précisément pour éviter ce piège, et toute
     réintroduction d'un `position: fixed` le ramènerait.
   - recharger : le panneau ne doit **plus** s'ouvrir tout seul.
   - vérifier au lecteur d'écran que la frise annonce sa description
     (`aria-label`) plutôt que d'être passée sous silence.

**5. Message d'erreur d'import CIVC (prompt B2).** Préparer un export du
portail auquel on retire **une** colonne obligatoire, puis l'importer :
   - le message doit **nommer la colonne manquante**, pas dire « fichier
     invalide » ;
   - le registre affiché à l'écran ne doit **pas** avoir changé — c'est le
     point le plus important, et le plus facile à casser en refactorant ;
   - refaire avec deux colonnes retirées : les deux doivent être nommées ;
   - importer un fichier correct, refuser la confirmation → rien ne change ;
   - accepter → le tableau, le sélecteur de parcelle et le titre de
     l'onglet (« Registre parcellaire », sans « — exemple ») changent
     ensemble ; les corrections de cellules précédentes ont bien disparu,
     comme la confirmation l'annonçait.

**6. Effacement des données effectif (prompt B1).** Saisir dans plusieurs
écrans, corriger une cellule du registre, recharger pour vérifier que tout
est revenu, puis « Effacer mes données » :
   - la confirmation doit précéder toute destruction ;
   - après effacement, **tous** les champs reviennent aux valeurs
     d'exemple, y compris le registre, la parcelle sélectionnée, les lignes
     exclues de l'étape 2 et l'indicateur « *n* repères sur 11 » ;
   - recharger encore une fois : les valeurs d'exemple doivent tenir — si
     les saisies réapparaissent, la clé n'a pas été vidée mais seulement
     l'état en mémoire.
   - refaire le tout en navigation privée stricte, où `localStorage` peut
     être refusé : l'outil doit fonctionner normalement, simplement sans
     rien conserver, et **sans message d'erreur**.

**7. Les quatre décisions du temps 2 (§4bis).** Rien de tout ceci ne se teste
sans navigateur — ce sont des dessins, un ordre de tabulation et un focus :
   - cliquer chacune des trois durées de repos : les **trois** frises se
     redessinent (la sélectionnée prend le fond ambré et `aria-pressed="true"`),
     la ligne de conséquences change de nombre de déblocages et d'année de
     retour, la bande de durées de la décision 4 et le bandeau des quatre
     décisions suivent ;
   - **au clavier seulement** : atteindre les trois boutons par `Tab`, choisir
     par `Entrée` puis par `Espace` — les deux doivent écrire la valeur ;
   - depuis le temps 3, cliquer « reprendre au premier repère » quand `repos`
     est le repère restant : l'outil doit emmener au temps 2 et donner le focus
     au bouton **de la valeur courante** (`id="f-repos"`), visible à l'écran et
     non caché derrière le bandeau figé ;
   - survoler chaque segment de frise : le `title` doit nommer la phase et ses
     années (« plantier — années 1 à 3 ») ;
   - année de pleine production : alterner les boutons `4ᵉ`/`5ᵉ`/`6ᵉ`/`8ᵉ` et la
     frappe dans le champ — le profil de montée en charge, le pied de carte et
     la largeur du bloc « plantier » de la décision 4 doivent bouger dans les
     deux cas, et le champ afficher la valeur choisie au bouton ;
   - espacement des piquets : à 4 m l'aide LutEnVi est grise, à 6 m elle passe
     en rouge et nomme l'espacement saisi ;
   - décocher les kits bout de route : la ligne passe en gris, affiche `exclu`,
     et le total ambré baisse ;
   - réduire la fenêtre sous 900 px : les cartes passent à une colonne, la
     décision 3 aussi, et les trois blocs de la bande de durées s'enroulent sans
     tronquer leur montant.

**8. Le matériel végétal en une seule liste (§4bis, §6).** Sans toucher au
registre, dans le bloc Références du temps 2 :
   - parcourir les **11 variétés** : les trois cépages principaux ouvrent la
     table de clones (11 / 19 / 12 lignes) ; les huit autres — pinot blanc,
     pinot gris, arbane, petit meslier, chardonnay rose, Voltis, Orellis,
     Serelis — affichent le message « aucune ligne au référentiel retenu », et
     **jamais** une table vide ou remplie ;
   - retenir une variété VIFA : la ligne sous le sélecteur doit passer à
     « variété résistante (VIFA) — ≤ 5 % de l'encépagement… ». Vérifier qu'il
     n'existe **plus** de second champ « vinifera / Voltis » avec lequel elle
     pourrait se contredire ;
   - importer un registre dont le cépage dominant est un pinot blanc ou un
     pinot gris : le sélecteur doit afficher cette variété-là, pas « Pinot
     noir » (l'ordre des tests de `cepageAffichage` en dépend) ;
   - retenir le porte-greffe **161-49 C** : l'avertissement de dépérissement
     doit s'afficher sous le sélecteur, en rouge, alors même que l'arbre d'aide
     au choix ne le recommande pas. Sur 41 B ou SO4, aucune ligne ne s'affiche.
