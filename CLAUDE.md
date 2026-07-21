# CLAUDE.md

Ce dépôt contient un **simulateur mono-page** (OAD renouvellement du
vignoble champenois). Le format est atypique — lire ce document en entier
avant toute modification. Pour le détail complet, voir `README.md`
(notamment §2 et §5).

## Contraintes absolues

- **NE JAMAIS modifier `support.js`.** C'est un moteur de rendu
  générique et généré — il porte en tête la bannière
  `// GENERATED from dc-runtime/src/*.ts — do not edit. Rebuild with
  \`cd dc-runtime && bun run build\`.`. Il ne contient aucune logique
  propre à ce simulateur. Toute modification y est interdite, même
  mineure ou "juste pour tester".

- **`index.html` n'est pas du HTML classique.** C'est un template
  `<x-dc>` interprété par `support.js` :
  - directives `sc-if value="{{ condition }}"` et
    `sc-for list="{{ tableau }}" as="x"` pour le conditionnel et les
    boucles ;
  - interpolations `{{ expression }}` ;
  - un composant React écrit comme `class Component extends DCLogic`
    dans `<script type="text/x-dc" data-dc-script">`, transpilé à la
    volée par Babel (chargé dynamiquement par `support.js`).
  - **Pas de JSX** (le composant utilise `React.createElement`, pas de
    syntaxe `<Foo/>` dans le `<script>`), **pas de `<form>`**, **pas de
    `localStorage`**. Respecter strictement cette syntaxe existante ;
    ne pas réintroduire de HTML/JS "classique" dans ce fichier.

- **`moteur-oad.js` est pur : sans DOM, sans état.** Uniquement des
  fonctions de calcul, exposées à la fois via `module.exports` (Node,
  tests) et `window.OAD` (navigateur). Toute logique métier ou
  financière (rendements, coûts, répartition faire-valoir, réserve
  individuelle…) va **exclusivement** dans ce fichier — jamais dans
  `index.html`, même pour un calcul "petit" ou ponctuel.

- **Aucun build, aucune dépendance npm.** Tout doit continuer à
  fonctionner en ouvrant simplement `index.html` dans un navigateur
  (avec accès Internet pour React/ReactDOM/Babel via `unpkg.com` et les
  polices Google Fonts) et en exécutant les tests avec
  `node tests/parite.test.js`, sans étape d'installation.

- **Avant TOUTE modification de `moteur-oad.js` : lancer les tests.**
  Après la modification : les relancer. Si un test casse de façon
  volontaire (changement de formule assumé), mettre à jour la valeur
  attendue avec un commentaire expliquant **pourquoi**, en référençant
  le chantier ou la décision à l'origine du changement — jamais une
  mise à jour silencieuse d'un chiffre attendu.

- **Formats fr-FR dans l'UI** : espaces insécables pour les milliers,
  virgule décimale (jamais de point ni de séparateur `,` façon
  anglo-saxon dans les nombres affichés à l'utilisateur).

## Architecture

- **`index.html`** — toute l'interface : structure visuelle (template
  `<x-dc>`), tous les champs de saisie, et la logique d'orchestration
  (lecture des champs, appel au moteur, mise en forme des résultats),
  regroupée dans un unique `<script type="text/x-dc" data-dc-script>`
  en bas de fichier. Pas de fichier `app.js` séparé : cette version
  fusionne « vue » et « contrôleur » dans le HTML.
- **`moteur-oad.js`** — pur, sans DOM ni état, uniquement des fonctions
  de calcul (kg → €, scénarios, faire-valoir, charges, KPI dérivés).
  Exposé via `window.OAD` et `module.exports`. Seule partie du projet
  contenant de la logique métier/financière.
- **`support.js`** — moteur de rendu générique et généré (bannière
  "GENERATED — do not edit"). Lit le fichier `.dc.html` (balise
  `<x-dc>`, directives `sc-for`/`sc-if`, interpolations `{{ }}`),
  télécharge React/ReactDOM/Babel depuis `unpkg.com`, compile le
  template en éléments React et attache le composant au DOM.
- **Flux de données** : une saisie déclenche `on.xxx(e)` →
  `setState(...)` → re-render React → `renderVals()` (dans
  `index.html`) ré-exécuté en entier → construit l'objet `inp` →
  `OAD.construireScenarios(inp)` (dans `moteur-oad.js`) calcule les 3
  scénarios (arrachage / complantation / statu quo) sur `kg` puis `€`
  → `renderVals()` en dérive KPI, textes et graphiques SVG → l'objet
  résultat alimente les `{{ }}` du template au rendu suivant. Aucun
  debounce : chaque frappe recalcule tout, sur 10 ans, pour les 3
  scénarios.
- **Où changer quoi** : une formule de calcul (rendement, coût,
  répartition) → `moteur-oad.js`. Un champ, un libellé, une mise en
  page, l'ordre des étapes → le template `<x-dc>` d'`index.html`. Le
  comportement d'un bouton, le calcul d'un KPI, un texte affiché → le
  bloc `<script data-dc-script>` d'`index.html`. `support.js` ne
  devrait jamais avoir besoin d'être touché.

Détails complets (glossaire des champs, formules du moteur kg/€,
KPI, graphiques, limites et hypothèses) : voir `README.md`.
