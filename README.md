# OAD Renouvellement — maquette v1.1

Simulateur comparant trois trajectoires à 10 ans pour une parcelle de vigne
champenoise : **arrachage-replantation**, **complantation** (entreplants) et
**statu quo**. Aucune dépendance, aucun build : ouvrir `index.html` dans un
navigateur. Tests moteur : `node tests.js` (40 invariants).

> Ce document décrit **toutes les données d'entrée, toutes les formules et
> tous les branchements** entre l'UI (`index.html`), l'orchestration
> (`app.js`) et le moteur de calcul (`moteur.js`), pour qu'on puisse auditer
> ou faire évoluer l'outil sans deviner.

---

## Sommaire

1. [Architecture des 3 fichiers](#1-architecture-des-3-fichiers)
2. [Flux de données, de l'écran au calcul](#2-flux-de-données-de-lécran-au-calcul)
3. [Glossaire des entrées (id HTML → variable → formule)](#3-glossaire-des-entrées-id-html--variable--formule)
4. [Le moteur kg — `simulerReserveKg`](#4-le-moteur-kg--simulerreservekg)
5. [Ce qui distingue les 3 scénarios](#5-ce-qui-distingue-les-3-scénarios)
6. [La couche € — `coucheEuro`](#6-la-couche--coucheeuro)
7. [Faire-valoir — `repartir`](#7-faire-valoir--repartir)
8. [Charges d'entretien récurrentes — `chargesEntretien`](#8-charges-dentretien-récurrentes--chargesentretien)
9. [Assemblage des scénarios — `construireScenarios`](#9-assemblage-des-scénarios--construirescenarios)
10. [Manque à gagner — `manqueAGagner`](#10-manque-à-gagner--manqueagagner)
11. [Palissage dérivé de la géométrie — `coutPalissage`](#11-palissage-dérivé-de-la-géométrie--coutpalissage)
12. [Arbre de décision porte-greffe — `preconPorteGreffe`](#12-arbre-de-décision-porte-greffe--preconportegreffe)
13. [Géométrie de plantation — `geometrie()`](#13-géométrie-de-plantation--geometrie)
14. [KPI et synthèse — écran 4](#14-kpi-et-synthèse--écran-4)
15. [Graphiques SVG — `chart()`](#15-graphiques-svg--chart)
16. [Table de correspondance id HTML ↔ moteur](#16-table-de-correspondance-id-html--moteur)
17. [Tests](#17-tests)
18. [Limites, hypothèses et paramètres cachés](#18-limites-hypothèses-et-paramètres-cachés)
19. [Historique v1.1](#19-historique-v11)

---

## 1. Architecture des 3 fichiers

```
index.html   — tous les champs de saisie (id=…) + zones de résultat (id=…), aucune logique
app.js       — lit le DOM, construit l'objet `inp`, appelle moteur.js, réinjecte le
               résultat dans le DOM (texte, tableaux, SVG). IIFE unique, pas de framework.
moteur.js    — pur, sans DOM : fonctions de calcul exposées via `window.OAD`
               (navigateur) et `module.exports` (Node, pour tests.js).
tests.js     — 40 assertions sur moteur.js exécutées avec `node tests.js`.
```

`index.html` charge les scripts dans cet ordre : `moteur.js` puis `app.js`.
`app.js` s'exécute une fois au chargement (`calculer()` en bas de fichier)
puis se ré-exécute à **chaque** `input`/`change` sur n'importe quel champ
(`document.querySelectorAll('input,select').forEach(el => el.addEventListener('input', calculer))`),
plus sur les boutons de bascule faire-valoir. Il n'y a pas de debounce : le
recalcul est intégralement synchrone et redessine tout l'écran 4 à chaque
frappe.

## 2. Flux de données, de l'écran au calcul

```
DOM (37 champs)
   │  lireEntrees()                              app.js
   ▼
inp = { geo, surfTot, ageMoy, repos, nbSortie, volSortieArr, plafond, volco,
        rendMean, reserveInit, horizon, ramp, rendYearFn, rendFactorProjet,
        rendEstime, manquants, declinSQ, densite, coutArrachageHa, coutPrepaHa,
        coutPlant, coutPalissageHa, irrigation, coutIrrigHa, coutEntreplant,
        survie, entreeProd, prixKg, coutSurfaceHaAn, coutRdtParKg, coefRepos, fv }
   │
   ▼  OAD.construireScenarios(inp)                moteur.js
   │
sc = { arrachage:     { kg:[...11 lignes t=0..10], eur:[...], investissement },
       complantation: { kg:[...],                  eur:[...], investissement },
       statuquo:      { kg:[...],                  eur:[...], investissement:0 } }
   │
   ├─► cumSerie(serieRepartie(sc.X, inp))  → séries cumulées pour le graphique trésorerie
   ├─► OAD.manqueAGagner(...)              → tableau « manque à gagner »
   ├─► OAD.chargesEntretien(...)           → KPI « charges évitées en transition »
   └─► KPI directs (invest, reserveReelle, stockMin, ageApres…)
   │
   ▼  écritures DOM (innerHTML / textContent)     app.js
Écran 4 : synthèse, 9 KPI, 2 graphiques SVG, 2 tableaux dépliables
```

Chaque `row` d'une série `kg` (sortie de `simulerReserveKg`) porte, pour une
année `t` : `surfProd, rendY, recolte, volcoVendu, volcoCible, mise, deficit,
sortieInsuff, sortieArr, stockDebut, stockFin, stockHa`. Chaque `row` de la
série `eur` correspondante (sortie de `coucheEuro`) porte : `venteRaisin,
cashRI, couts, cashNet, cashSansRI`. Les deux tableaux sont indexés au même
`t`, donc `sc.arrachage.kg[i]` et `sc.arrachage.eur[i]` décrivent la même
année.

## 3. Glossaire des entrées (id HTML → variable → formule)

### Écran 0 — Votre exploitation

| id HTML | clé dans `inp` | unité | défaut | rôle |
|---|---|---|---|---|
| `surfTot` | `surfTot` | ha | 1 | surface totale de l'exploitation (dénominateur de l'effet âge et des charges statu quo) |
| `ageMoy` | `ageMoy` | ans | 38 | âge moyen du vignoble **avant** l'opération |
| `riPct` (slider) | → `reserveInit = plafond × riPct / 100` | % | 75 | niveau actuel de réserve individuelle, en % du plafond 10 000 kg/ha |
| `volco` | `volco` | kg/ha | 9000 | Volume commercialisable fixé chaque année par le CIVC |
| `prixKg` | `prixKg` | €/kg | 7 | prix unique du raisin (v1 : pas de distinction cépage/cru) |

### Écran 1 — La parcelle désignée

| id HTML | clé dans `inp` | unité | défaut | rôle |
|---|---|---|---|---|
| `ageParc` | `ageParc` | ans | 55 | âge de la parcelle candidate au renouvellement |
| `manquants` | `manquants` (÷100) | % | 15 | taux de pieds manquants → dimensionne la complantation |
| `rendEstime` | `rendEstime` | kg/ha | 10500 | rendement actuel de la parcelle (sert au statu quo **et** à la complantation) |
| `declinSQ` | `declinSQ` (÷100) | %/an | 0 | déclin annuel de rendement si on ne touche à rien (statu quo) |
| `regime` | `fv.regime` | `propriete｜fermage｜metayage` | propriete | régime de faire-valoir, pilote la répartition des flux (§7) |
| `loyerHa` | → `fv.loyerAn = loyerHa × surfTot` | €/ha/an | 3000 | loyer fermage (visible seulement si régime = fermage) |
| `partRecolte` | `fv.partRecolte` (÷100) | % | 33 | part de recettes au propriétaire (métayage) |
| `partCouts` | `fv.partCouts` (÷100) | % | 33 | part de coûts au propriétaire (métayage) |

### Écran 2 — Projet de replantation

**Géométrie** (→ objet `geo`, voir [§13](#13-géométrie-de-plantation--geometrie)) :

| id HTML | variable | unité | défaut |
|---|---|---|---|
| `geoL` | `L` | m | 200 |
| `geoW` | `W` | m | 15 |
| `ecartRang` | `eR` | m | 1.10 |
| `ecartPied` | `eP` | m | 1.10 |

**Matériel & conduite :**

| id HTML | clé dans `inp` | défaut | rôle |
|---|---|---|---|
| `materiel` | dérive `fMat` (=1, effet Voltis jugé négligeable ≤5 %) | vinifera | badge d'avertissement réglementaire seulement |
| `porteGreffe` | — (affichage pur) | 41 B | alimente la fiche conseil `PG_INFO` (app.js), **n'entre pas dans le calcul** |
| `irrigation` | `irrigation` (bool) | Non | active `coutIrrigHa` dans l'investissement ; déclenche un badge « interdite en AOC » |
| `ramp` | `ramp` (liste) | `[0.3,0.6,1]` | montée en charge du rendement les 3 premières années après repos (§4) |

**Aide au choix du matériel végétal** (`cepage`, `calcaireActif`, `profondeurSol`,
`drainageSol`) : purement informatif, alimente `majClones()` et
`OAD.preconPorteGreffe()` (§12), **hors calcul économique**.

**Dimensionnement du palissage** (`typeTaille`, `nbFils`, `espPiquet`) :
alimente `OAD.coutPalissage()` (§11) qui préremplit `coutPalissageHa` tant
que l'utilisateur ne l'a pas édité à la main (`palisManuel`).

**Coûts (investissement ponctuel) :**

| id HTML | clé dans `inp` | unité | défaut | utilisé pour |
|---|---|---|---|---|
| `motif` | → `sanitaire` (bool) | classique | commute `repos`/`nbSortie` (§4) |
| `coutArrachageHa` | `coutArrachageHa` | €/ha | 4500 | `invArr[0]` |
| `coutPrepaHa` | `coutPrepaHa` | €/ha | 3500 | `invArr[repos]` |
| `coutPlant` | `coutPlant` | €/pied | 1.4 | `invArr[repos]` (× densité) |
| `coutPalissageHa` | `coutPalissageHa` | €/ha | 12000 (préremp.) | `invArr[repos]` |
| `coutIrrigHa` | `coutIrrigHa` | €/ha | 5000 | `invArr[repos]` si `irrigation` |
| `penaliteVSL` | → `fDens = 1 − penaliteVSL/100` | % | 10 | pénalité de rendement si conduite semi-large (`eR ≥ 1.5`) |
| `survie` | `survie` (÷100) | % | 50 | taux de survie des entreplants |
| `entreeProd` | `entreeProd` | années | 7 | début de montée en charge des entreplants |
| `coutEntreplant` | `coutEntreplant` | €/pied | 4.5 | `invCompl[0]` |

**Charges d'entretien récurrentes** (nouveau — modèle surface / rendement,
§8), **nulles par défaut** pour préserver la parité avec le classeur de
référence tant qu'elles ne sont pas calées :

| id HTML | clé dans `inp` | unité | défaut |
|---|---|---|---|
| `coutSurfaceHaAn` | `coutSurfaceHaAn` | €/ha/an | 0 |
| `coutRdtParKg` | `coutRdtParKg` | €/kg | 0 |
| `coefRepos` | `coefRepos` | × surface | 0 |

### Écran 3 — Aléa climatique

| id HTML | clé dans `inp` | défaut | rôle |
|---|---|---|---|
| `sequence` | → `rendYearFn` via `sequenceFn()` | aucune | force une ou plusieurs années à `12296,6 − 3440` kg/ha (écart-type régional), appliqué **à l'identique** aux 3 scénarios |

## 4. Le moteur kg — `simulerReserveKg`

C'est la fonction centrale (`moteur.js:7`). Elle simule, année par année de
`t=0` à `t=horizon` (10), le compte de réserve individuelle (kg/ha) d'**un**
scénario. Elle est appelée trois fois par `construireScenarios` (une fois
par scénario), avec des paramètres différents.

Notations : `surfArr` = surface de la parcelle concernée (`surfParc`),
`surfRest = surfTot − surfArr` = le reste de l'exploitation (non concerné
par l'opération, produit toujours à `rendMean`), `fProjet =
rendFactorProjet` = pénalité de rendement du projet (VSL…).

**Étape 1 — rendement de l'année :**
```
rendY = rendYearFn(t)  si fourni (séquence d'aléa, écran 3)
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
scénarios — c'est une divergence assumée vs. le classeur de référence, mais
appliquée identiquement partout donc neutre pour la comparaison.

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
`volSortieArr = 9000 kg/ha` (fixé, non éditable dans l'UI — voir §18).
`nbSortie = 3` (motif classique) ou `5` (motif sanitaire).

**Étape 8 — stock de fin d'année et ratio à l'hectare :**
```
stockFin = max(0, stockDebut + mise − sortieInsuff − sortieArr)
stockHa  = stockFin / surfProd      (0 si surfProd = 0)
```

**Sortie**, une ligne par année : `{t, surfProd, rendY, recolte, volcoVendu:
min(recolte,volco)+sortieInsuff, volcoCible: volco, mise, deficit,
sortieInsuff, sortieArr, stockDebut, stockFin, stockHa}`.

## 5. Ce qui distingue les 3 scénarios

| | `arrachage` | `complantation` | `statuquo` |
|---|---|---|---|
| Surface productive | `surfRest`, puis `surfTot` après `returnYear` | toujours `surfTot` | toujours `surfTot` |
| Rendement de la parcelle | `rendMean·f·fProjet` une fois relancée | `rendParcCompl(t, rendY)` — monte de `rendEstime` vers un mix `rendEstime`/`rendMean` pondéré par `survie`, à partir de `entreeProd` | `rendParcSQ(t, rendY) = rendY·(rendEstime/rendMean)·(1−declinSQ)ᵗ` |
| Sortie de réserve « arrachage » | oui, années 1 à `nbSortie` | non | non |
| Investissement ponctuel | arrachage (t=0) + replantation (t=repos) | entreplants (t=0), ajustés du taux de survie | aucun |
| Repos / interruption | oui (`repos` années) | non | non |

`rendParcCompl` (moteur.js:132-137) :
```
rendCible    = rendEstime + (rendMean − rendEstime)·survie
ratio        = rendEstime / rendMean
ratioCible   = rendCible / rendMean
prog(t)      = 0                              si t < entreeProd
             = min(1, (t − entreeProd + 1)/3)  sinon   // montée linéaire sur 3 ans
rendParcCompl(t, rendY) = rendY · (ratio + (ratioCible − ratio) · prog(t))
```

## 6. La couche € — `coucheEuro`

Transforme une série `kg` en série `€` (moteur.js:48) :
```
venteRaisin = volcoVendu × prixKg
cashRI      = sortieArr × prixKg      // valorisation de la sortie de réserve « arrachage »
couts       = coutsParAnnee[t] || 0   // investissement ponctuel + charges d'entretien (§9)
cashNet     = venteRaisin + cashRI − couts
cashSansRI  = venteRaisin − couts     // pour visualiser ce que la réserve apporte (toggle « sans RI »)
```

## 7. Faire-valoir — `repartir`

Répartit un flux `€` déjà calculé entre exploitant et propriétaire, **sans
changer le total** (moteur.js:66) :
```
rev = venteRaisin + cashRI
propriete : exp = rev − couts                           , prop = 0
fermage   : exp = rev − couts − loyerAn                 , prop = loyerAn
metayage  : prop = a·rev − b·couts                       , exp = (1−a)·rev − (1−b)·couts
            avec a = partRecolte, b = partCouts
```
Utilisé par `app.js` (`serieRepartie`) pour les 3 boutons **Ensemble / Part
exploitant / Part propriétaire** de l'écran 4 : dans les deux derniers cas,
chaque point de la série trésorerie passe par `OAD.repartir()` avant d'être
cumulé.

## 8. Charges d'entretien récurrentes — `chargesEntretien`

Ajoutées en v1.1 pour que le **statu quo ne soit plus gratuit** — sans
elles, ne rien faire n'a aucun coût dans le modèle, ce qui biaise
systématiquement la comparaison en faveur du statu quo. Modèle en deux
composantes (moteur.js:91), neutre par défaut (`coutSurfaceHaAn =
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
pendant la transition capte « ce que l'arrachage évite » (la vendange de la
parcelle, pas sa charge de surface) — c'est le KPI « Charges évitées en
transition » de l'écran 4 (§14), purement dérivé et jamais réinjecté dans
le calcul.

## 9. Assemblage des scénarios — `construireScenarios`

Point d'entrée principal du moteur (moteur.js:110), appelé une fois par
`calculer()`. Construit les paramètres communs (`base`), calcule les trois
séries `kg`, puis les coûts poncturels + récurrents, puis la couche `€`.

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
entretien §8) :
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
`investissement` est volontairement **hors charges d'entretien** : c'est la
base du KPI « Effort net après réserve » (§14), qui répond à « combien
dois-je financer pour l'opération elle-même », indépendamment de charges
d'exploitation récurrentes qui existeraient de toute façon.

## 10. Manque à gagner — `manqueAGagner`

Indicateur **dérivé**, jamais réinjecté dans le calcul (affiché dans le
tableau dépliable « Manque à gagner ») :
```
manqueAGagner(scen, refSQ, prixKg)[t] = max(0, (refSQ.kg[t].volcoVendu − scen.kg[t].volcoVendu) × prixKg)
```
Mesure la perte de vente (jamais négative) par rapport au statu quo, causée
par une parcelle temporairement hors production ou en montée en charge.

## 11. Palissage dérivé de la géométrie — `coutPalissage`

`coutPalissage(geo, prix, opt)` (moteur.js:184) dérive un coût de
palissage à l'hectare à partir de la géométrie de plantation, sur la base
des prix unitaires du classeur **LutEnVi 2025** (feuille « Coût hectare
d'installation »). Il **préremplit** `coutPalissageHa` (champ éditable) tant
que l'utilisateur ne l'a pas modifié à la main (`palisManuel`, remis à
`false` par le bouton ↻).

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

**Prix unitaires** (`PRIX_PALISSAGE_LUTENVI`, moteur.js:171) :

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

## 12. Arbre de décision porte-greffe — `preconPorteGreffe`

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
`ARBRE_PG` est une table de 17 branches (moteur.js:224) reproduisant les
combinaisons calcaire × profondeur × drainage du guide, avec les
porte-greffes envisageables et des renvois d'avertissement (ex. `161-49 C` :
dépérissements signalés depuis 2008, déconseillé). Alimente les blocs
`#preconPG` et `#pgInfo` de l'écran 2 (`majPrecon()`, `majPG()` dans
app.js) ; **n'entre jamais dans `inp`**.

## 13. Géométrie de plantation — `geometrie()`

Calculée côté `app.js` (ligne 121), à partir de `geoL`, `geoW`,
`ecartRang`, `ecartPied` :
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

## 14. KPI et synthèse — écran 4

Tous calculés dans `calculer()` (app.js:190), après `OAD.construireScenarios(inp)` :

| KPI | formule | groupe |
|---|---|---|
| Investissement brut | `invest = sc.arrachage.investissement` | Financement |
| Amortisseur de réserve | `reserveReelle = Σ sc.arrachage.eur[t].cashRI` | Financement |
| — dont % de couverture | `couv = reserveReelle / invest` | Financement |
| — théorique | `reserveTheo = volSortieArr × surfParc × nbSortie × prixKg` | Financement |
| Effort net après réserve | `effortNet = max(0, invest − reserveReelle)` | Financement |
| Charges évitées en transition | `Σ_{t=0}^{returnYear−1} max(0, chSQ[t] − chArr[t])`, avec `returnYear = 3+repos` et `chX = OAD.chargesEntretien(...)` — affiché seulement si `coutSurfaceHaAn>0 \|\| coutRdtParKg>0` | Exploitation |
| Tension maximale de trésorerie | `creux = min_t (arr_cum[t] − sq_cum[t])`, où `arr_cum`/`sq_cum` sont les séries cumulées de `serieRepartie()` | Risque |
| Réserve minimale en transition | `stockMin = min_t sc.arrachage.kg[t].stockHa`, alerte si `< 4000` kg/ha | Risque |
| Effet technique du renouvellement | `ageApres = (ageMoy·surfTot − ageParc·surfParc)/surfTot` ; `gainAge = ageMoy − ageApres` | Risque |

`serieRepartie(sc, inp)` (app.js:180) choisit, selon le bouton actif
(**Ensemble / Part exploitant / Part propriétaire**), soit `row.cashNet`
directement, soit `OAD.repartir(row, inp.fv).exp` ou `.prop`. `cumSerie()`
en fait la somme cumulée, base des deux courbes de trésorerie (statu quo,
complantation, arrachage) et de la variante « sans mobilisation de la
réserve » (`arrSansRI`, calculée avec `cashRI` forcé à 0 avant répartition).

Le paragraphe `#synthese` et les 3 blocs `#kpisFin` / `#kpisExp` /
`#kpisRisq` sont regénérés en HTML à chaque appel de `calculer()`.

## 15. Graphiques SVG — `chart()`

Pas de librairie : `chart(series, opt)` (app.js:314) génère un `<svg>` à la
main. `series` est une liste de `{pts: number[], c: couleur, w: épaisseur,
dash?}` ; toutes les séries doivent avoir la même longueur (11 points,
t=0..10).

```
échelle Y : yMin = min(0, tous les points, opt.y0)
            yMax = max(0, tous les points, opt.ref.v)
            + marge de 8 % (ou 1 si l'amplitude est nulle)
échelle X : linéaire, t=0..n réparti sur la largeur utile

éléments dessinés, dans l'ordre :
  - 5 lignes de grille horizontales + libellés d'axe Y (opt.fmt)
  - ligne de référence à Y=0 (toujours)
  - ligne de référence opt.ref (ex. plafond 10 000 kg/ha), en pointillé or
  - graduations d'axe X (années)
  - un <path> par série (courbe brisée point à point)
  - un cercle + libellé par annotation (opt.annot), ex. le point bas de trésorerie
```
Deux graphiques l'utilisent : `#chartTreso` (trésorerie cumulée, avec
annotation du creux) et `#chartStock` (stock de réserve kg/ha, avec ligne
de plafond à 10 000 et annotation du point bas).

## 16. Table de correspondance id HTML ↔ moteur

Vérifiée automatiquement : tout `$('id')` référencé dans `app.js`
correspond à un `id="..."` existant dans `index.html` (sinon `calculer()`
lève une exception et **tout l'écran 4, y compris les graphiques, cesse de
se mettre à jour** — c'est la cause du bug corrigé précédemment sur cette
branche : `renderDecision()` était appelée sans être définie, et `#kpisFin`
/ `#kpisExp` / `#kpisRisq` n'existaient pas encore dans le HTML).

| Zone résultat (id) | Alimentée par |
|---|---|
| `#syDens`, `#syRangs`, `#syLong`, `#syPieds`, `#sySurf`, `#syMode` | `geometrie()` |
| `#aocCheck` | `geometrie().aoc` |
| `#conseq` | badges VSL / fil porteur / Voltis / irrigation |
| `#pgInfo` | `PG_INFO` (app.js, statique) |
| `#preconPG` | `OAD.preconPorteGreffe()` |
| `#cloneTable` | `CLONES` (app.js, statique) |
| `#palisDetail`, préremplit `#coutPalissageHa` | `OAD.coutPalissage()` |
| `#fvHint` | régime de faire-valoir (`inp.fv`) |
| `#synthese`, `#kpisFin`, `#kpisExp`, `#kpisRisq` | §14 |
| `#chartTreso`, `#lectureTreso` | `chart()` sur les séries cumulées |
| `#chartStock`, `#lectureStock` | `chart()` sur `stockHa` |
| `#tableDetail` | détail annuel du scénario `arrachage` |
| `#tableMaG` | `OAD.manqueAGagner()` |

## 17. Tests

`node tests.js` — 40 assertions, toutes sur `moteur.js` (aucun test DOM).
Points clés couverts :

- **T1–T9** : parité avec le classeur de référence (stock min ≈ 5 021,8
  kg/ha en t=3, stock final 10 000, Σ sorties/mises), non-régression des
  scénarios non-arrachage, conservation du total lors de la répartition
  faire-valoir.
- **T18–T21** : cohérence du calcul de palissage (pricing = Σ qté×prix,
  monotonies des choix B/C, parité ±5 % avec LutEnVi).
- **T25–T30** (charges d'entretien, ajoutées avec le modèle surface/
  rendement) : neutralité à coûts nuls, statu quo non gratuit dès que les
  charges sont calées, charge de surface pleine en établissement / réduite
  au `coefRepos` en jachère, charge de rendement nulle sur la parcelle tant
  qu'elle ne vendange pas, investissement exposé indépendamment de
  l'entretien.

## 18. Limites, hypothèses et paramètres cachés

Reprend et complète la note de bas de page de `index.html` :

- **Mono-parcelle, prix unique.** Pas de distinction cépage/cru/millésime.
- **Paramètres fixés en dur dans `lireEntrees()` (app.js), non éditables
  dans l'UI :** `volSortieArr = 9000` kg/ha, `plafond = 10000` kg/ha,
  `rendMean = 12296.6` kg/ha (moyenne régionale), `horizon = 10` ans. Le
  facteur écart-type régional (`EC = 3440` kg/ha) est câblé dans
  `sequenceFn()`.
- **Le texte de `index.html` mentionne un « butoir 15 500 » qui n'existe
  pas dans le code actuel** (aucune référence à 15500 dans `moteur.js` ou
  `app.js`) — soit un paramètre à implémenter, soit une note à retirer.
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

## 19. Historique v1.1

- **Rendement des leviers → VolCo** : la conduite (VSL) porte une pénalité
  de rendement branchée sur la récolte, donc sur le VolCo. En année
  normale, le coussin au-dessus du VolCo + le plafond absorbent une
  pénalité modérée (quasi invisible) ; elle ne mord la vente que sous
  stress (petite récolte) — voir T7 dans `tests.js`.
- **Motif d'arrachage → commutation sanitaire** : « Sanitaire (FD) »
  bascule automatiquement `repos = 3` ans et `nbSortie = 5` (au lieu de
  1 / 3).
- **Faire-valoir** : propriété / fermage / métayage, répartition appliquée
  aux € seuls, total conservé (T8–T9).
- **Géométrie de plantation** pilote densité, nombre de rangs et surface,
  avec contrôle du cahier des charges (rang/pied/somme).
- **Dimensionnement du palissage** dérivé de la géométrie (§11), préremplit
  le coût plutôt que de l'imposer.
- **Charges d'entretien récurrentes** (modèle surface/rendement, §8) :
  corrige le biais « statu quo gratuit », neutre par défaut.
- **Écran 4 remanié** : synthèse décisionnelle, KPI hiérarchisés
  (Financement / Exploitation / Risque & technique), graphiques annotés.
