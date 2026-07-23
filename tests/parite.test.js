/* =====================================================================
 * tests/parite.test.js
 *
 * Ces tests FIGENT le comportement observé du moteur `moteur-oad.js`
 * (v1.1) à la date où ils ont été écrits — y compris ses défauts connus.
 * Ils ne valident PAS la justesse métier ni financière des formules :
 * un test qui passe signifie « le moteur calcule la même chose qu'avant »,
 * pas « le moteur calcule juste ». Objectif unique : détecter toute
 * régression involontaire de formule lors des chantiers suivants.
 *
 * Référence des formules figées ici : README.md §7 (simulerReserveKg),
 * §8 (différences entre scénarios), §9 (coucheEuro), §10 (repartir),
 * §11 (chargesEntretien), §12 (construireScenarios), §13 (manqueAGagner).
 *
 * Exécution : node tests/parite.test.js
 * Aucune dépendance : assert natif de Node uniquement.
 * ===================================================================== */

'use strict';

const assert = require('assert');
const path = require('path');
const OAD = require(path.join(__dirname, '..', 'moteur-oad.js'));

// ----------------------------------------------------------------------
// Mini-harnais de test (pas de dépendance externe, pas de node:test pour
// rester compatible avec les anciennes versions de Node).
// ----------------------------------------------------------------------
let passed = 0, failed = 0, skipped = 0;
let currentSection = '';

function section(name) {
  currentSection = name;
  console.log('\n' + name);
}

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ok   - ' + name);
  } catch (err) {
    failed++;
    console.log('  FAIL - ' + name);
    console.log('         ' + err.message);
  }
}

// Test volontairement non exécuté : documente un comportement à corriger.
// `fn` n'est jamais appelée ici — elle sert de code prêt à l'emploi pour
// le jour où on l'active (voir section 3).
function skip(name, _fn, reason) {
  skipped++;
  console.log('  SKIP - ' + name + (reason ? ' (' + reason + ')' : ''));
}

function assertClose(actual, expected, eps, msg) {
  assert.ok(Math.abs(actual - expected) <= eps,
    (msg ? msg + ' — ' : '') + `attendu ≈ ${expected}, obtenu ${actual} (écart ${Math.abs(actual - expected)})`);
}

// ----------------------------------------------------------------------
// Section 1 — 4 cas canoniques de construireScenarios
//
// Les `inp` ci-dessous sont écrits en dur : ce sont exactement les champs
// que `construireScenarios`/`simulerReserveKg`/`chargesEntretien` lisent
// (voir moteur-oad.js). Le cas (a) reprend les valeurs par défaut de l'UI
// (constructeur `index.html:582-599`) après dérivation par `geometrie(v)`
// et `coutPalissage(g, ...)` (index.html:642-650 et 788-791) :
//   - geoL=200, geoW=15, ecartRang=1.10, ecartPied=1.10
//     → densite = round(10000/(1.10×1.10)) = 8264 pieds/ha
//     → surf = 200×15/10000 = 0.3 ha  → surfParc
//   - coutPalissageHa n'est PAS le défaut affiché (12000) mais la valeur
//     préremplie depuis la géométrie tant que `palisManuel` est faux
//     (état initial) : OAD.coutPalissage(g, null, {espacementPiquet:6,
//     nbFils:4}).totalHa arrondi = 13116 €/ha. C'est le comportement réel
//     de renderVals() au premier rendu, pas une approximation.
// ----------------------------------------------------------------------

const INP_A = {
  surfTot: 1,
  surfParc: 0.3,
  repos: 1,
  nbSortie: 3,
  volSortieArr: 9000,
  plafond: 10000,
  volco: 9000,
  rendMean: 12296.6,
  reserveInit: 7500,
  horizon: 10,
  rendYearFn: null,
  ramp: [0.3, 0.6, 1],
  rendFactorProjet: 1,
  rendEstime: 10500,
  manquants: 0.15,
  // chantier 4 : défaut UI declinSQ passé de 0 à 1 %/an (biais pro-statu-quo
  // corrigé, voir index.html). N'affecte pas les valeurs attendues ci-dessous :
  // avec les défauts UI, recolte statuquo > VolCo même après déclin sur 10 ans,
  // donc volcoVendu reste plafonné à volco et cashNet est inchangé.
  declinSQ: 0.01,
  densite: 8264,
  // chantier P3 : recalage MHCS — coutArrachageHa passe de 4500 à 22500 €/ha
  // (forfait tout compris incluant désormais la préparation du sol, qui
  // avait sa propre ligne coutPrepaHa avant ce chantier — supprimée, voir
  // README §12 journal d'arbitrages) ; coutPlant passe de 1,8 à 2,10 €/pied
  // (même source MHCS). Snapshots de la section 1 recalculés en conséquence.
  coutArrachageHa: 22500,
  coutPlant: 2.10,
  coutPalissageHa: 13116,
  irrigation: false,
  coutIrrigHa: 5000,
  coutEntreplant: 4.5,
  survie: 0.5,
  entreeProd: 7,
  prixKg: 7,
  // chantier 6 : modèle de charges à 3 volets (production / repos / plantier),
  // remplace l'ancien coutSurfaceHaAn/coefRepos (voir moteur-oad.js:113-126).
  // Tous à 0 par défaut ici : opt-in strict, snapshots ci-dessous inchangés.
  coutSurfaceProdHaAn: 0,
  coutRdtParKg: 0,
  coutReposHaAn: 0,
  coutPlantierHaAn: 0,
  fv: { regime: 'propriete', loyerAn: 3000, partRecolte: 0.33, partCouts: 0.33 }
};

// (b) motif sanitaire : repos passe à 3, nbSortie à 5 (index.html:797).
// declinSQ explicité à 0 (chantier 4) pour rester stable indépendamment du
// défaut UI de (a) — ce cas ne teste pas le déclin statu quo.
const INP_B_SANITAIRE = { ...INP_A, repos: 3, nbSortie: 5, declinSQ: 0 };

// (c) stress climatique "creux34" (étape 5, index.html:785) : années 3 et 4
// forcées à rendMean - EC = 12296.6 - 3440 = 8856.6 kg/ha, sur les 3 scénarios.
// declinSQ explicité à 0 (chantier 4), pour la même raison que (b).
const RENDMEAN = 12296.6, EC = 3440;
const INP_C_STRESS = {
  ...INP_A,
  declinSQ: 0,
  rendYearFn: (t) => (t === 3 || t === 4) ? (RENDMEAN - EC) : RENDMEAN
};

// (d) métayage 33/33 : seul `fv.regime` change. construireScenarios()
// n'utilise JAMAIS `inp.fv` (grep sur moteur-oad.js) : la répartition
// faire-valoir est appliquée en aval, par `repartir()`, jamais dans le
// moteur kg/€. Ce cas fige donc explicitement ce comportement — un futur
// chantier qui ferait fuiter `fv` dans construireScenarios() ferait
// diverger ce test de (a). declinSQ explicité à 0 (chantier 4), même raison
// que (b)/(c).
const INP_D_METAYAGE = { ...INP_A, declinSQ: 0, fv: { regime: 'metayage', loyerAn: 3000, partRecolte: 0.33, partCouts: 0.33 } };

function snapshotScenarios(sc) {
  const out = {};
  for (const k of ['arrachage', 'complantation', 'statuquo']) {
    const s = sc[k];
    out[k] = {
      investissement: Math.round(s.investissement),
      cashRITotal: Math.round(s.eur.reduce((acc, r) => acc + r.cashRI, 0)),
      cumulCashNet10: Math.round(s.eur.reduce((acc, r) => acc + r.cashNet, 0)),
      stockFin10: Math.round(s.kg[10].stockFin)
    };
  }
  out.arrachage.stockHaMin = Math.round(Math.min(...sc.arrachage.kg.map(r => r.stockHa)));
  return out;
}

section('1. Cas canoniques — construireScenarios');

// chantier P3 : snapshots recalculés suite au recalage MHCS de INP_A
// (coutArrachageHa 4500→22500, coutPlant 1.8→2.10, suppression coutPrepaHa —
// voir README §12 journal d'arbitrages). Seuls `investissement` (arrachage)
// et les `cumulCashNet10` qui en dérivent (couts plus élevés) bougent ;
// cashRITotal et stockFin10/stockHaMin sont inchangés (indépendants de
// l'investissement).
test('(a) cas base (défauts UI)', () => {
  const sc = OAD.construireScenarios(INP_A);
  assert.deepStrictEqual(snapshotScenarios(sc), {
    arrachage: { investissement: 15891, cashRITotal: 56700, cumulCashNet10: 658209, stockFin10: 10000, stockHaMin: 4622 },
    complantation: { investissement: 3347, cashRITotal: 0, cumulCashNet10: 689653, stockFin10: 10000 },
    statuquo: { investissement: 0, cashRITotal: 0, cumulCashNet10: 693000, stockFin10: 10000 }
  });
});

test('(b) motif sanitaire (repos=3, nbSortie=5)', () => {
  const sc = OAD.construireScenarios(INP_B_SANITAIRE);
  assert.deepStrictEqual(snapshotScenarios(sc), {
    arrachage: { investissement: 15891, cashRITotal: 94500, cumulCashNet10: 658209, stockFin10: 10000, stockHaMin: 3837 },
    complantation: { investissement: 3347, cashRITotal: 0, cumulCashNet10: 689653, stockFin10: 10000 },
    statuquo: { investissement: 0, cashRITotal: 0, cumulCashNet10: 693000, stockFin10: 10000 }
  });
});

test('(c) stress rendYearFn années 3-4 (creux régional)', () => {
  const sc = OAD.construireScenarios(INP_C_STRESS);
  assert.deepStrictEqual(snapshotScenarios(sc), {
    arrachage: { investissement: 15891, cashRITotal: 56700, cumulCashNet10: 654683, stockFin10: 10000, stockHaMin: 0 },
    complantation: { investissement: 3347, cashRITotal: 0, cumulCashNet10: 689653, stockFin10: 10000 },
    statuquo: { investissement: 0, cashRITotal: 0, cumulCashNet10: 693000, stockFin10: 10000 }
  });
});

test('(d) métayage 33/33 — construireScenarios identique à (a), fv ignoré par le moteur kg/€', () => {
  const sc = OAD.construireScenarios(INP_D_METAYAGE);
  assert.deepStrictEqual(snapshotScenarios(sc), {
    arrachage: { investissement: 15891, cashRITotal: 56700, cumulCashNet10: 658209, stockFin10: 10000, stockHaMin: 4622 },
    complantation: { investissement: 3347, cashRITotal: 0, cumulCashNet10: 689653, stockFin10: 10000 },
    statuquo: { investissement: 0, cashRITotal: 0, cumulCashNet10: 693000, stockFin10: 10000 }
  });
});

// chantier P3 : garde-fous sur le recalage MHCS de l'investissement d'arrachage
// (coutArrachageHa 22 500 €/ha tout compris, suppression de coutPrepaHa —
// README §12 journal d'arbitrages). Objectif : détecter tout terme résiduel
// de préparation du sol réintroduit par erreur, et vérifier que le calendrier
// d'engagement (t=0 puis t=repos) reste intact pour les deux motifs.
// INP_A a ses 4 taux de charges d'entretien à 0 (opt-in strict) : sur le
// scénario arrachage, `eur[t].coutsParcelle` n'est donc alimenté QUE par
// `invArr[t]`, ce qui permet de lire l'investissement par année directement.
test("investissement t=0 == surfParc × coutArrachageHa exactement (motif classique, repos=1)", () => {
  const sc = OAD.construireScenarios(INP_A);
  assertClose(sc.arrachage.eur[0].coutsParcelle, INP_A.surfParc * INP_A.coutArrachageHa, 1e-9);
});

test("investissement t=0 == surfParc × coutArrachageHa exactement (motif sanitaire, repos=3)", () => {
  const sc = OAD.construireScenarios(INP_B_SANITAIRE);
  assertClose(sc.arrachage.eur[0].coutsParcelle, INP_B_SANITAIRE.surfParc * INP_B_SANITAIRE.coutArrachageHa, 1e-9);
});

test('aucun terme résiduel de préparation du sol : investissement total == formule exacte sans coutPrepaHa', () => {
  const sc = OAD.construireScenarios(INP_A);
  const attendu = INP_A.surfParc * INP_A.coutArrachageHa
    + INP_A.surfParc * (INP_A.densite * INP_A.coutPlant + INP_A.coutPalissageHa
        + (INP_A.irrigation ? INP_A.coutIrrigHa : 0));
  assertClose(sc.arrachage.investissement, attendu, 1e-6);
});

test("calendrier d'engagement préservé (t=0 puis t=repos, aucun autre t) — motif classique (repos=1)", () => {
  const sc = OAD.construireScenarios(INP_A);
  sc.arrachage.eur.forEach(row => {
    if (row.t === 0 || row.t === INP_A.repos) {
      assert.ok(row.coutsParcelle > 0, `t=${row.t} devrait porter un engagement`);
    } else {
      assertClose(row.coutsParcelle, 0, 1e-9, `t=${row.t} ne devrait porter aucun engagement résiduel`);
    }
  });
});

test("calendrier d'engagement préservé (t=0 puis t=repos, aucun autre t) — motif sanitaire (repos=3)", () => {
  const sc = OAD.construireScenarios(INP_B_SANITAIRE);
  sc.arrachage.eur.forEach(row => {
    if (row.t === 0 || row.t === INP_B_SANITAIRE.repos) {
      assert.ok(row.coutsParcelle > 0, `t=${row.t} devrait porter un engagement`);
    } else {
      assertClose(row.coutsParcelle, 0, 1e-9, `t=${row.t} ne devrait porter aucun engagement résiduel`);
    }
  });
});

// chantier 5 : repartir() ne porte plus que sur les flux attribuables à la
// parcelle (venteRaisinParcelle + cashRI − coutsParcelle) ; le reste de
// l'exploitation (venteRaisinReste, coutsReste — qui inclut sortieInsuff,
// mutualisé) reste 100 % exploitant quel que soit le régime, voir README §10.
// Avec surfParc=0.3 sur surfTot=1, le reste pèse 70 % de la surface : la
// part propriétaire baisse mécaniquement par rapport à l'ancien comportement
// (qui appliquait le régime aux 100 % du flux, y compris le reste).
test('(d) métayage 33/33 — répartition effective via repartir() sur le scénario arrachage', () => {
  const sc = OAD.construireScenarios(INP_D_METAYAGE);
  let cumExp = 0, cumProp = 0;
  sc.arrachage.eur.forEach(row => {
    const rep = OAD.repartir(row, INP_D_METAYAGE.fv);
    cumExp += rep.exp;
    cumProp += rep.prop;
  });
  // chantier P3 : valeurs recalculées suite au recalage MHCS de INP_A (voir
  // section 1 ci-dessus) — coutsParcelle plus élevé (investissement) réduit
  // légèrement exp/prop par rapport aux anciennes valeurs (610349/52954).
  assert.strictEqual(Math.round(cumExp), 606936);
  assert.strictEqual(Math.round(cumProp), 51273);
});

// ----------------------------------------------------------------------
// Section 2 — Invariants structurels (cas base, 3 scénarios)
// ----------------------------------------------------------------------

section('2. Invariants structurels (cas base)');

const SC_BASE = OAD.construireScenarios(INP_A);
const SCENARIOS = ['arrachage', 'complantation', 'statuquo'];

test('conservation du stock : stockFin = max(0, stockDebut + mise - sortieInsuff - sortieArr)', () => {
  SCENARIOS.forEach(k => {
    SC_BASE[k].kg.forEach(row => {
      const attendu = Math.max(0, row.stockDebut + row.mise - row.sortieInsuff - row.sortieArr);
      assertClose(row.stockFin, attendu, 1e-6, `${k} t=${row.t}`);
    });
  });
});

test('stockFin >= 0 et mise >= 0 à chaque année, pour les 3 scénarios', () => {
  SCENARIOS.forEach(k => {
    SC_BASE[k].kg.forEach(row => {
      assert.ok(row.stockFin >= 0, `${k} t=${row.t} : stockFin=${row.stockFin} < 0`);
      assert.ok(row.mise >= 0, `${k} t=${row.t} : mise=${row.mise} < 0`);
    });
  });
});

test('repartir() conserve le total (exp + prop = cashNet) pour les 3 régimes', () => {
  const regimes = [
    { regime: 'propriete', loyerAn: 0, partRecolte: 0, partCouts: 0 },
    { regime: 'fermage', loyerAn: 3000, partRecolte: 0, partCouts: 0 },
    { regime: 'metayage', loyerAn: 0, partRecolte: 0.33, partCouts: 0.33 }
  ];
  regimes.forEach(fv => {
    SCENARIOS.forEach(k => {
      SC_BASE[k].eur.forEach(row => {
        const rep = OAD.repartir(row, fv);
        assertClose(rep.exp + rep.prop, row.cashNet, 1e-6, `${fv.regime} / ${k} t=${row.t}`);
      });
    });
  });
});

test('coucheEuro : cashNet = venteRaisin + cashRI - couts, à chaque année', () => {
  SCENARIOS.forEach(k => {
    SC_BASE[k].eur.forEach(row => {
      assertClose(row.cashNet, row.venteRaisin + row.cashRI - row.couts, 1e-6, `${k} t=${row.t}`);
    });
  });
});

// ----------------------------------------------------------------------
// Section 3 — Horizon 25 ans (chantier 4 : double horizon 10/25 ans)
//
// `horizon` est déjà un paramètre libre de `simulerReserveKg`/
// `construireScenarios` (aucun tableau borné à 10 dans moteur-oad.js :
// `ramp` retombe à 1 au-delà de sa longueur, `rendParcCompl`/`rendParcSQ`
// sont des fonctions de `t` sans plafond). Ce cas fige les mêmes
// invariants structurels que la section 2, mais à horizon 25, sur le cas
// base, pour détecter toute régression qui apparaîtrait seulement sur un
// horizon long (ex. tableau ramp mal indexé, boucle bornée en dur).
// ----------------------------------------------------------------------

section('3. Horizon 25 ans (mêmes invariants structurels, cas base)');

const INP_A25 = { ...INP_A, horizon: 25 };
const SC_A25 = OAD.construireScenarios(INP_A25);

test('horizon 25 : 26 lignes (t=0..25) par scénario', () => {
  SCENARIOS.forEach(k => {
    assert.strictEqual(SC_A25[k].kg.length, 26, k);
    assert.strictEqual(SC_A25[k].eur.length, 26, k);
    assert.strictEqual(SC_A25[k].kg[25].t, 25, k);
  });
});

test('horizon 25 : conservation du stock : stockFin = max(0, stockDebut + mise - sortieInsuff - sortieArr)', () => {
  SCENARIOS.forEach(k => {
    SC_A25[k].kg.forEach(row => {
      const attendu = Math.max(0, row.stockDebut + row.mise - row.sortieInsuff - row.sortieArr);
      assertClose(row.stockFin, attendu, 1e-6, `${k} t=${row.t}`);
    });
  });
});

test('horizon 25 : stockFin >= 0 et mise >= 0 à chaque année, pour les 3 scénarios', () => {
  SCENARIOS.forEach(k => {
    SC_A25[k].kg.forEach(row => {
      assert.ok(row.stockFin >= 0, `${k} t=${row.t} : stockFin=${row.stockFin} < 0`);
      assert.ok(row.mise >= 0, `${k} t=${row.t} : mise=${row.mise} < 0`);
    });
  });
});

test('horizon 25 : coucheEuro : cashNet = venteRaisin + cashRI - couts, à chaque année', () => {
  SCENARIOS.forEach(k => {
    SC_A25[k].eur.forEach(row => {
      assertClose(row.cashNet, row.venteRaisin + row.cashRI - row.couts, 1e-6, `${k} t=${row.t}`);
    });
  });
});

test('horizon 25 : la jeune vigne (arrachage) atteint bien surfProd = surfTot après returnYear, et le reste stable', () => {
  const returnYear = 3 + INP_A25.repos;
  SC_A25.arrachage.kg.forEach(row => {
    if (row.t >= returnYear) assertClose(row.surfProd, INP_A25.surfTot, 1e-6, `t=${row.t}`);
  });
});

// ----------------------------------------------------------------------
// Section 4 — Bug connu, documenté et volontairement désactivé
// ----------------------------------------------------------------------

section('4. Bugs connus (documentés, non actifs)');

// Chantier 2 : garde-fou ajouté — construireScenarios lève désormais une
// Error explicite si surfParc > surfTot, au lieu de laisser simulerReserveKg
// produire une récolte/surface négative en silence (bug v1.1, voir git log).
test('construireScenarios : surfParc > surfTot lève une erreur explicite', () => {
  assert.throws(
    () => OAD.construireScenarios({ ...INP_A, surfTot: 1, surfParc: 1.5 }),
    /surfParc.*surfTot/
  );
});

// ----------------------------------------------------------------------
// Section 5 — Décomposition parcelle / reste de l'exploitation (chantier 5)
//
// Le régime de faire-valoir ne doit s'appliquer qu'aux flux attribuables à
// la parcelle (recolteParcelle, cashRI, coûts au prorata surfacique de la
// parcelle) ; le reste de l'exploitation (recolteReste, sortieInsuff
// mutualisée) reste 100 % exploitant. Voir README §9/§10/§11.
// ----------------------------------------------------------------------

section('5. Décomposition parcelle / reste (chantier 5)');

// Charges d'entretien non nulles pour que la décomposition parcelle/reste
// de coucheEuro/chargesEntretien soit réellement exercée (INP_A les a à 0).
// Chantier 6 : les 3 volets (production / repos / plantier) sont désormais
// tous non nuls et distincts, pour exercer chargesEntretien sur ses 3 phases.
const INP_E_CHARGES = {
  ...INP_A, declinSQ: 0,
  coutSurfaceProdHaAn: 1200, coutReposHaAn: 300, coutPlantierHaAn: 700, coutRdtParKg: 0.15
};
const SC_E = OAD.construireScenarios(INP_E_CHARGES);

// chargesEntretien renvoie { parcelle, reste } (objets indexés par t) — voir
// moteur-oad.js:127-150. Ces 3 tests figent le montant exact porté par la
// parcelle pour chacune des 3 phases du scénario arrachage :
//   totParcelle(t) = csParc(t) × S + coutRdtParKg × recolteParcelle(t)
// où csParc vaut coutReposHaAn (t < repos), coutPlantierHaAn (repos ≤ t <
// repos+rampYears) ou coutSurfaceProdHaAn (t ≥ repos+rampYears). Avec
// repos=1 et rampYears=ramp.length=3, recolteParcelle est nulle pour
// t < repos+rampYears=4 (voir simulerReserveKg : returnYear = 3+repos = 4),
// donc le terme rendement s'annule de lui-même en repos et en plantier —
// seule la phase production porte une charge rendement non nulle.
const CH_ARR_E = OAD.chargesEntretien('arrachage', SC_E.arrachage.kg, INP_E_CHARGES);
const S_E = INP_E_CHARGES.surfParc;
const REPOS_E = INP_E_CHARGES.repos;
const RAMP_E = INP_E_CHARGES.ramp.length;

test('volet transition (arrachage) — repos (t < repos) : coutReposHaAn × S, récolte nulle', () => {
  SC_E.arrachage.kg.forEach(row => {
    if (row.t >= REPOS_E) return;
    assertClose(row.recolteParcelle, 0, 1e-6, `t=${row.t}`);
    assertClose(CH_ARR_E.parcelle[row.t] || 0, INP_E_CHARGES.coutReposHaAn * S_E, 1e-6, `t=${row.t}`);
  });
});

test('volet transition (arrachage) — plantier (repos ≤ t < repos+rampYears) : coutPlantierHaAn × S (+ charge rendement)', () => {
  SC_E.arrachage.kg.forEach(row => {
    if (!(row.t >= REPOS_E && row.t < REPOS_E + RAMP_E)) return;
    const attendu = INP_E_CHARGES.coutPlantierHaAn * S_E + INP_E_CHARGES.coutRdtParKg * row.recolteParcelle;
    assertClose(CH_ARR_E.parcelle[row.t] || 0, attendu, 1e-6, `t=${row.t}`);
  });
});

test('volet transition (arrachage) — production (t ≥ repos+rampYears) : coutSurfaceProdHaAn × S (+ charge rendement)', () => {
  SC_E.arrachage.kg.forEach(row => {
    if (row.t < REPOS_E + RAMP_E) return;
    const attendu = INP_E_CHARGES.coutSurfaceProdHaAn * S_E + INP_E_CHARGES.coutRdtParKg * row.recolteParcelle;
    assertClose(CH_ARR_E.parcelle[row.t] || 0, attendu, 1e-6, `t=${row.t}`);
  });
});

test('coucheEuro : venteRaisinParcelle + venteRaisinReste = venteRaisin, à chaque année, 3 scénarios', () => {
  SCENARIOS.forEach(k => {
    SC_E[k].eur.forEach(row => {
      assertClose(row.venteRaisinParcelle + row.venteRaisinReste, row.venteRaisin, 1e-6, `${k} t=${row.t}`);
    });
  });
});

test('coucheEuro : coutsParcelle + coutsReste = couts, à chaque année, 3 scénarios (charges non nulles)', () => {
  SCENARIOS.forEach(k => {
    SC_E[k].eur.forEach(row => {
      assertClose(row.coutsParcelle + row.coutsReste, row.couts, 1e-6, `${k} t=${row.t}`);
      // vérifie que la décomposition n'est pas triviale (coûts effectivement non nuls)
      assert.ok(row.couts > 0 || row.t === 0, `${k} t=${row.t} : couts=${row.couts}, décomposition non exercée`);
    });
  });
});

test('simulerReserveKg : recolteParcelle + recolteReste = recolte, à chaque année, 3 scénarios', () => {
  SCENARIOS.forEach(k => {
    SC_E[k].kg.forEach(row => {
      assertClose(row.recolteParcelle + row.recolteReste, row.recolte, 1e-6, `${k} t=${row.t}`);
    });
  });
});

// Cas limite : surfParc = surfTot (l'exploitation ne contient que la
// parcelle étudiée) → surfRest = 0, donc recolteReste = 0 à chaque année,
// et le seul flux "reste" qui subsiste est sortieInsuff (mutualisé par
// construction, jamais individualisé par parcelle dans simulerReserveKg).
const INP_F_SURF_EGALE = { ...INP_A, declinSQ: 0, surfParc: 1 };
const SC_F = OAD.construireScenarios(INP_F_SURF_EGALE);

test('surfParc = surfTot : recolteReste = 0 à chaque année, 3 scénarios', () => {
  SCENARIOS.forEach(k => {
    SC_F[k].kg.forEach(row => {
      assertClose(row.recolteReste, 0, 1e-6, `${k} t=${row.t}`);
    });
  });
});

test('surfParc = surfTot : venteRaisinReste = sortieInsuff × prixKg, coutsReste = 0 (charges neutres)', () => {
  SCENARIOS.forEach(k => {
    SC_F[k].eur.forEach((row, i) => {
      const sortieInsuff = SC_F[k].kg[i].sortieInsuff;
      assertClose(row.venteRaisinReste, sortieInsuff * INP_F_SURF_EGALE.prixKg, 1e-6, `${k} t=${row.t}`);
      assertClose(row.coutsReste, 0, 1e-6, `${k} t=${row.t}`);
    });
  });
});

test('surfParc = surfTot, régime métayage : le reste (sortieInsuff) reste 100 % exploitant même quand surfRest = 0', () => {
  const fv = { regime: 'metayage', loyerAn: 0, partRecolte: 0.33, partCouts: 0.33 };
  SC_F.arrachage.eur.forEach(row => {
    const rep = OAD.repartir(row, fv);
    const resteNet = row.venteRaisinReste - row.coutsReste;
    assertClose(rep.exp, (1 - fv.partRecolte) * (row.venteRaisinParcelle + row.cashRI)
      - (1 - fv.partCouts) * row.coutsParcelle + resteNet, 1e-6, `t=${row.t}`);
  });
});

// ----------------------------------------------------------------------
// Section 6 — Fonctions pures : référentiel temps de travaux, volet
// transition et indicateur MO économisée (chantier 3 / prompt 7).
//
// Ces fonctions sont volontairement hors du calcul financier : préremplissage
// opt-in (proposerVoletProduction) et indicateur physique parallèle
// (heuresManuellesParAnnee, moEconomisee). Voir moteur-oad.js:340-419.
// ----------------------------------------------------------------------

section('6. Fonctions pures — volet transition & MO économisée');

test('proposerVoletProduction(8000, 17).heuresManuellesHa ≈ 364', () => {
  const r = OAD.proposerVoletProduction(8000, 17);
  // somme des h1000 de REF_OPS_MANUEL (16+8.5+4.5+14+2.5=45.5) × densite/1000
  assertClose(r.heuresManuellesHa, 364, 1e-6);
});

test("heuresManuellesParAnnee('arrachage', …) : 0 en repos, hProd × 0.35 en plantier, hProd en production", () => {
  const inp = { densite: 8000, repos: 1, ramp: [0.3, 0.6, 1] }; // rampYears = ramp.length = 3
  const rowsKg = [{ t: 0 }, { t: 1 }, { t: 2 }, { t: 3 }, { t: 4 }, { t: 5 }];
  const hProd = OAD.REF_OPS_MANUEL.reduce((s, o) => s + o.h1000 * inp.densite / 1000, 0);
  const h = OAD.heuresManuellesParAnnee('arrachage', rowsKg, inp);
  assertClose(h[0], 0, 1e-9, 'repos t=0 (t < repos=1)');
  assertClose(h[1], hProd * 0.35, 1e-9, 'plantier t=1');
  assertClose(h[2], hProd * 0.35, 1e-9, 'plantier t=2');
  assertClose(h[3], hProd * 0.35, 1e-9, 'plantier t=3');
  assertClose(h[4], hProd, 1e-9, 'production t=4 (t ≥ repos+rampYears=4)');
  assertClose(h[5], hProd, 1e-9, 'production t=5');
});

test("heuresManuellesParAnnee('statuquo', …) : hProd à chaque année (jamais de repos/plantier hors arrachage)", () => {
  const inp = { densite: 8000, repos: 1, ramp: [0.3, 0.6, 1] };
  const rowsKg = [{ t: 0 }, { t: 1 }, { t: 4 }];
  const hProd = OAD.REF_OPS_MANUEL.reduce((s, o) => s + o.h1000 * inp.densite / 1000, 0);
  const h = OAD.heuresManuellesParAnnee('statuquo', rowsKg, inp);
  h.forEach((val, i) => assertClose(val, hProd, 1e-9, `t=${rowsKg[i].t}`));
});

test('moEconomisee : heuresHa ≥ 0, et strictement positif quand la transition (repos+plantier) existe', () => {
  const mo = OAD.moEconomisee(SC_BASE.arrachage.kg, SC_BASE.statuquo.kg, INP_A, 17);
  assert.ok(mo.heuresHa >= 0, `heuresHa=${mo.heuresHa} < 0`);
  assert.ok(mo.heuresHa > 0, 'INP_A a repos=1 et une phase plantier : heuresHa devrait être > 0');
  assertClose(mo.euroIndicatifHa, mo.heuresHa * 17, 1e-9, 'euroIndicatifHa = heuresHa × tauxHoraire');
});

test('moEconomisee : nul quand il n\'y a pas de fenêtre de transition (repos=0, rampYears=0)', () => {
  // rampYears explicite à 0 (le ?? de heuresManuellesParAnnee/moEconomisee ne retombe
  // sur inp.ramp.length que si rampYears est undefined — 0 est bien préservé).
  const inpSansTransition = { ...INP_A, repos: 0, rampYears: 0 };
  const scSansTransition = OAD.construireScenarios(inpSansTransition);
  const mo = OAD.moEconomisee(scSansTransition.arrachage.kg, scSansTransition.statuquo.kg, inpSansTransition, 17);
  assertClose(mo.heuresHa, 0, 1e-6, 'repos=0 et rampYears=0 : aucune fenêtre repos/plantier, donc aucun écart d\'heures');
});

// ----------------------------------------------------------------------
// Section 7 — Garde-fou #2 : l'indicateur MO économisée (heures et son
// équivalent € indicatif) ne fuit JAMAIS dans cashNet / la trésorerie.
//
// INP_A a ses charges financières (coutSurfaceProdHaAn, coutRdtParKg,
// coutReposHaAn, coutPlantierHaAn) à 0 — "financièrement inactif" — alors
// que la transition (repos=1 + plantier) est bien réelle, donc l'indicateur
// MO est "actif" (heuresHa > 0, cf. section 6). Le test vérifie que calculer
// cet indicateur, quel que soit son état, ne modifie ni ne recoupe jamais
// construireScenarios/cashNet : moEconomisee lit sc.*.kg en lecture seule et
// ne renvoie qu'un objet séparé {heuresHa, euroIndicatifHa}.
// ----------------------------------------------------------------------

section('7. Garde-fou — indicateur MO économisée hors trésorerie');

test("cashNet des 3 scénarios est identique, que l'indicateur MO soit calculé ou non", () => {
  const scSansIndicateurMO = OAD.construireScenarios(INP_A);
  const snapshotAvant = SCENARIOS.map(k => scSansIndicateurMO[k].eur.map(r => r.cashNet));

  // "charges heures/MO actives" : la transition existe (heuresHa > 0, cf.
  // section 6), on calcule l'indicateur — mais rien n'est réinjecté dans inp.
  const mo = OAD.moEconomisee(scSansIndicateurMO.arrachage.kg, scSansIndicateurMO.statuquo.kg, INP_A, 17);
  assert.ok(mo.heuresHa > 0, 'précondition : indicateur MO réellement actif pour ce test');

  const scAvecIndicateurMO = OAD.construireScenarios(INP_A);
  SCENARIOS.forEach((k, i) => {
    const snapshotApres = scAvecIndicateurMO[k].eur.map(r => r.cashNet);
    assert.deepStrictEqual(snapshotApres, snapshotAvant[i], `${k} : cashNet a changé après calcul de l'indicateur MO`);
  });
});

test("moEconomisee ne mute pas les lignes kg qu'on lui passe (lecture seule)", () => {
  const sc = OAD.construireScenarios(INP_A);
  const avant = JSON.parse(JSON.stringify(sc.arrachage.kg));
  OAD.moEconomisee(sc.arrachage.kg, sc.statuquo.kg, INP_A, 17);
  assert.deepStrictEqual(sc.arrachage.kg, avant, 'sc.arrachage.kg a été modifié par moEconomisee');
});

// ----------------------------------------------------------------------
// Section 8 — Registre parcellaire (chantier 1) : agrégation exploitation
// et parcelle désignée à partir d'un registre réel (jeu de données fourni,
// idu fictifs, format réel — commune Cuis, num_civc 1425, 12 lignes / 7 idu).
// Campagne de référence 2026 : vérifiée ci-dessous par la moyenne
// arithmétique brute, qui tombe exactement à 49,0 ans — la valeur citée
// comme repère de l'ancienne formule non pondérée, à l'origine du chantier.
// ----------------------------------------------------------------------

const CAMPAGNE_TEST = 2026;

const REGISTRE_TEST = [
  { idu: 'C1237', cepage: 'CHARDONNAY B', anneePlant: 2019, surface: 0.05, tauxManquant: 5, situation: 'plantee' },
  { idu: 'C1255', cepage: 'CHARDONNAY B', anneePlant: 2010, surface: 0.12, tauxManquant: 5, situation: 'plantee' },
  { idu: 'C1516', cepage: 'CHARDONNAY B', anneePlant: 2010, surface: 0.04, tauxManquant: 5, situation: 'plantee' },
  { idu: 'C1517', cepage: 'CHARDONNAY B', anneePlant: 2010, surface: 0.00, tauxManquant: 5, situation: 'plantee' },
  { idu: 'Z0068', cepage: 'MEUNIER N',    anneePlant: 1954, surface: 0.21, tauxManquant: 5, situation: 'arrachee' },
  { idu: 'Z0068', cepage: 'CHARDONNAY B', anneePlant: 1951, surface: 0.14, tauxManquant: 5, situation: 'plantee' },
  { idu: 'Z0068', cepage: 'CHARDONNAY B', anneePlant: 1954, surface: 0.24, tauxManquant: 5, situation: 'plantee' },
  { idu: 'Z0068', cepage: 'CHARDONNAY B', anneePlant: 2006, surface: 0.02, tauxManquant: 5, situation: 'plantee' },
  { idu: 'Z0069', cepage: 'MEUNIER N',    anneePlant: 1951, surface: 0.13, tauxManquant: 5, situation: 'arrachee' },
  { idu: 'Z0069', cepage: 'CHARDONNAY B', anneePlant: 1951, surface: 0.24, tauxManquant: 5, situation: 'plantee' },
  { idu: 'Z0157', cepage: 'MEUNIER N',    anneePlant: 1954, surface: 0.13, tauxManquant: 5, situation: 'arrachee' },
  { idu: 'Z0157', cepage: 'CHARDONNAY B', anneePlant: 1954, surface: 0.18, tauxManquant: 5, situation: 'plantee' }
];

section('8. Registre parcellaire — agrégation exploitation / parcelle (chantier 1)');

test('ageMoy pondéré par surface diffère de la moyenne arithmétique simple', () => {
  const { surfTot, ageMoy } = OAD.agregerRegistreExploitation(REGISTRE_TEST, CAMPAGNE_TEST);
  const ages = REGISTRE_TEST.map(r => CAMPAGNE_TEST - r.anneePlant);
  const moyenneArithmetique = ages.reduce((s, a) => s + a, 0) / ages.length;
  assertClose(moyenneArithmetique, 49.0, 0.01, 'moyenne arithmétique de contrôle (ancienne formule, non pondérée)');
  assert.notStrictEqual(Math.round(ageMoy * 100), Math.round(moyenneArithmetique * 100),
    'ageMoy pondéré ne doit pas coïncider avec la moyenne arithmétique sur un jeu à surfaces hétérogènes');
  assertClose(ageMoy, 60.24, 0.01);
  assertClose(surfTot, 1.50, 1e-9);
});

test('une parcelle Arrachée ne contribue pas à ageMoy (ni au numérateur, ni au dénominateur)', () => {
  const { ageMoy: ageMoyRef } = OAD.agregerRegistreExploitation(REGISTRE_TEST, CAMPAGNE_TEST);
  const registreArracheeModifiee = REGISTRE_TEST.map(r =>
    r.situation === 'arrachee' ? { ...r, anneePlant: 1900, surface: 5 } : r);
  const { ageMoy: ageMoyModifie } = OAD.agregerRegistreExploitation(registreArracheeModifiee, CAMPAGNE_TEST);
  assertClose(ageMoyModifie, ageMoyRef, 1e-9,
    'changer année/surface des lignes Arrachée ne doit pas modifier ageMoy');
});

test("surfTot inclut les parcelles Arrachée (dénominateur de charge du reste de l'exploitation)", () => {
  const { surfTot } = OAD.agregerRegistreExploitation(REGISTRE_TEST, CAMPAGNE_TEST);
  const surfacePlanteeSeule = REGISTRE_TEST.filter(r => r.situation === 'plantee').reduce((s, r) => s + r.surface, 0);
  assert.ok(surfTot > surfacePlanteeSeule, 'surfTot doit être strictement supérieur à la seule surface Plantée dès qu\'il y a des Arrachée');
});

test('surfParc (parcelle désignée, sélection multi-lignes pondérée) ≤ surfTot en toute circonstance', () => {
  const { surfTot } = OAD.agregerRegistreExploitation(REGISTRE_TEST, CAMPAGNE_TEST);
  const lignesZ0068Plantees = REGISTRE_TEST.filter(r => r.idu === 'Z0068' && r.situation === 'plantee');
  const { surfParc, ageParc, tauxManquant, cepage, cepageMixte } = OAD.agregerRegistreParcelle(lignesZ0068Plantees, CAMPAGNE_TEST);
  assertClose(surfParc, 0.40, 1e-9);
  assertClose(ageParc, 70.45, 0.01);
  assertClose(tauxManquant, 5, 1e-9);
  assert.strictEqual(cepage, 'CHARDONNAY B');
  assert.strictEqual(cepageMixte, false);
  assert.ok(surfParc <= surfTot + 1e-9, 'surfParc ne doit jamais dépasser surfTot');
});

test('registre vide → agrégats à 0 sans exception (bascule en saisie manuelle)', () => {
  assert.doesNotThrow(() => {
    const exploitationVide = OAD.agregerRegistreExploitation([], CAMPAGNE_TEST);
    assert.strictEqual(exploitationVide.surfTot, 0);
    assert.strictEqual(exploitationVide.ageMoy, 0);
    const parcelleVide = OAD.agregerRegistreParcelle([], CAMPAGNE_TEST);
    assert.strictEqual(parcelleVide.surfParc, 0);
    assert.strictEqual(parcelleVide.ageParc, 0);
    assert.strictEqual(parcelleVide.cepage, null);
  });
});

// ----------------------------------------------------------------------
// Section 9 — Calibration Cerfrance/MHCS des charges d'entretien (chantier 2)
//
// Défauts UI calibrés (index.html), pas des valeurs arbitraires :
// coutSurfaceProdHaAn = 11 400 €/ha/an — Cerfrance 2024, charges de structure
//   hors charges locatives (15 300), amortissement (3 900) retiré en
//   TOTALITÉ pour éviter le double-compte avec l'investissement de
//   plantation déjà porté par invArr (option retenue : retrait total, voir
//   README §11 — les autres options nécessitaient une source non
//   disponible pour isoler la seule part « plantation » des 3 900 €).
// coutRdtParKg = 1,52 €/kg — Cerfrance 2024, charges proportionnelles ÷
//   rendement de référence 10 000 kg/ha (pas de retraitement du décalage
//   avec rendMean=12296,6 : un taux €/kg s'applique à la récolte réelle,
//   il n'a pas besoin d'être rescalé).
// coutPlantierHaAn = 8 000 €/ha/an — MHCS (taille de formation +
//   remplacement des plants morts).
// coutReposHaAn = 0 — assumé (voir P4, hors périmètre de ce chantier).
// ----------------------------------------------------------------------

section("9. Calibration Cerfrance/MHCS des charges d'entretien (chantier 2)");

const INP_G_CALIBRE = {
  ...INP_A, declinSQ: 0,
  coutSurfaceProdHaAn: 11400, coutRdtParKg: 1.52, coutPlantierHaAn: 8000, coutReposHaAn: 0
};
const SC_G = OAD.construireScenarios(INP_G_CALIBRE);
const INP_G_ZERO = { ...INP_G_CALIBRE, coutSurfaceProdHaAn: 0, coutRdtParKg: 0, coutPlantierHaAn: 0, coutReposHaAn: 0 };
const SC_G_ZERO = OAD.construireScenarios(INP_G_ZERO);

test('statu quo, charges calibrées Cerfrance : cashNet strictement inférieur au cas charges nulles, chaque année', () => {
  SC_G.statuquo.eur.forEach((row, i) => {
    const rowZero = SC_G_ZERO.statuquo.eur[i];
    assert.ok(row.cashNet < rowZero.cashNet, `t=${row.t} : cashNet=${row.cashNet} pas < ${rowZero.cashNet}`);
  });
});

test('charge de rendement calibrée (1,52 €/kg) : nulle d\'elle-même en repos et en plantier (arrachage), recolteParcelle = 0', () => {
  const rampYears = INP_G_CALIBRE.ramp.length;
  const CH_G = OAD.chargesEntretien('arrachage', SC_G.arrachage.kg, INP_G_CALIBRE);
  SC_G.arrachage.kg.forEach(row => {
    if (row.t >= INP_G_CALIBRE.repos + rampYears) return; // hors fenêtre repos+plantier
    assertClose(row.recolteParcelle, 0, 1e-6, `t=${row.t}`);
    const attendu = row.t < INP_G_CALIBRE.repos
      ? INP_G_CALIBRE.coutReposHaAn * INP_G_CALIBRE.surfParc
      : INP_G_CALIBRE.coutPlantierHaAn * INP_G_CALIBRE.surfParc;
    assertClose(CH_G.parcelle[row.t] || 0, attendu, 1e-6, `t=${row.t}`);
  });
});

test("les 3 scénarios subissent le même taux de charge sur le reste de l'exploitation (invariant de symétrie)", () => {
  const ceArr  = OAD.chargesEntretien('arrachage',     SC_G.arrachage.kg,     INP_G_CALIBRE);
  const ceComp = OAD.chargesEntretien('complantation', SC_G.complantation.kg, INP_G_CALIBRE);
  const ceSQ   = OAD.chargesEntretien('statuquo',      SC_G.statuquo.kg,      INP_G_CALIBRE);
  for (let t = 0; t <= INP_G_CALIBRE.horizon; t++) {
    assertClose(ceArr.reste[t] || 0, ceComp.reste[t] || 0, 1e-6, `t=${t} arrachage vs complantation`);
    assertClose(ceArr.reste[t] || 0, ceSQ.reste[t]   || 0, 1e-6, `t=${t} arrachage vs statu quo`);
  }
});

// ----------------------------------------------------------------------
// Section 10 — Trajectoire d'âge du vignoble (chantier P7)
//
// Remplace le KPI ponctuel ageApres/gainAge (instantané, comptait la
// parcelle à l'âge 0 dès t=0 même pendant le repos du sol). Convention
// repos = option B (parcelle exclue numérateur ET dénominateur), même
// règle que agregerRegistreExploitation pour les lignes "Arrachée"
// (chantier 1, section 8 ci-dessus). Redémarrage à 0 ancré sur `repos`
// (replantation physique), pas `returnYear` (entrée en production).
// Voir moteur-oad.js (trajectoireAge) pour le détail de la formule.
//
// Fixture : surfTot=10, surfParc=2 (surfRest=8), ageMoy=40, ageParc=60
// → ageResteInit = (40×10 − 60×2)/8 = 35 (repère « âge du reste seul »
// utilisé pendant le repos), repos=2, manquants=0.2.
// ----------------------------------------------------------------------

section("10. Trajectoire d'âge du vignoble (chantier P7)");

const INP_AGE = { ageMoy: 40, ageParc: 60, surfTot: 10, surfParc: 2, manquants: 0.2, repos: 2, horizon: 5 };

test('t=0 : statu quo, complantation ET arrachage-avant-repos sont cohérents avec ageMoy/ageResteInit (pas de saut artificiel avant toute action)', () => {
  const traj = OAD.trajectoireAge(INP_AGE);
  assertClose(traj.statuquo[0], 40, 1e-9, 'statu quo part de ageMoy');
  assertClose(traj.arrachage[0], 35, 1e-9, 'arrachage part de l\'âge du seul "reste" — la parcelle est déjà exclue dès t=0 (repos ≥ 1)');
});

test('statu quo : toute l\'exploitation vieillit de 1 an/an, sans rajeunissement', () => {
  const traj = OAD.trajectoireAge(INP_AGE);
  for (let t = 0; t <= INP_AGE.horizon; t++) assertClose(traj.statuquo[t], 40 + t, 1e-9, `t=${t}`);
});

test('arrachage pendant le repos (t < repos) : la parcelle est exclue du numérateur ET du dénominateur (option B), jamais comptée à l\'âge 0', () => {
  const traj = OAD.trajectoireAge(INP_AGE);
  // ageResteInit=35 : l'âge moyen affiché pendant le repos est celui du seul
  // "reste" de l'exploitation, qui vieillit lui aussi de 1 an/an.
  assertClose(traj.arrachage[0], 35, 1e-9);
  assertClose(traj.arrachage[1], 36, 1e-9);
});

test('arrachage : l\'âge de la parcelle repart à 0 exactement à t = repos (replantation physique), pas à returnYear (3+repos)', () => {
  const traj = OAD.trajectoireAge(INP_AGE);
  // t=repos=2 : ageParcelle=0, ageReste=37, surfActiveTot=10 → (37×8+0×2)/10=29.6
  assertClose(traj.arrachage[2], 29.6, 1e-9);
  // t=3 : ageParcelle=1 → (38×8+1×2)/10=30.6
  assertClose(traj.arrachage[3], 30.6, 1e-9);
});

test('arrachage vs statu quo : écart plat pendant le repos, saut net à la replantation, puis de nouveau plat (pas de reconvergence naturelle)', () => {
  const traj = OAD.trajectoireAge(INP_AGE);
  const ecart = (t) => traj.statuquo[t] - traj.arrachage[t];
  assertClose(ecart(1), ecart(0), 1e-9, 'écart stable pendant le repos : les deux vieillissent au même rythme tant que rien n\'est replanté');
  assert.ok(ecart(2) > ecart(1), 'saut net en faveur de l\'arrachage exactement à la replantation (t=repos)');
  assertClose(ecart(3), ecart(2), 1e-9, 'écart de nouveau stable après replantation');
  assertClose(ecart(4), ecart(2), 1e-9, 'écart de nouveau stable après replantation (aucune reconvergence naturelle)');
});

test('complantation : mix pondéré à deux générations de pieds (manquants rajeunit, le reste de la parcelle vieillit normalement)', () => {
  const traj = OAD.trajectoireAge(INP_AGE);
  // t=0 : ageParcelle = 0,8×60 + 0,2×0 = 48 → (35×8+48×2)/10 = 37,6
  assertClose(traj.complantation[0], 37.6, 1e-9);
  // t=1 : ageParcelle = 0,8×61 + 0,2×1 = 49 → (36×8+49×2)/10 = 38,6
  assertClose(traj.complantation[1], 38.6, 1e-9);
});

test('complantation avec manquants=0 : identique au statu quo (aucun entreplant, rien à rajeunir)', () => {
  const traj = OAD.trajectoireAge({ ...INP_AGE, manquants: 0 });
  assert.deepStrictEqual(traj.complantation, traj.statuquo);
});

test('surfRest = 0 (la parcelle désignée couvre toute l\'exploitation) : pas d\'exception, âge moyen à 0 pendant le repos plutôt qu\'un NaN', () => {
  let traj;
  assert.doesNotThrow(() => { traj = OAD.trajectoireAge({ ageMoy: 40, ageParc: 60, surfTot: 2, surfParc: 2, manquants: 0.2, repos: 2, horizon: 3 }); });
  assertClose(traj.arrachage[0], 0, 1e-9, 'dénominateur nul pendant le repos → 0, comme agregerRegistreExploitation sur registre vide');
});

test('trajectoireAge est pure : ne mute pas son argument', () => {
  const inpAvant = JSON.parse(JSON.stringify(INP_AGE));
  OAD.trajectoireAge(INP_AGE);
  assert.deepStrictEqual(INP_AGE, inpAvant);
});

// ----------------------------------------------------------------------
// Section 11 — Palissage détaillé (relevé fournisseur, chantier P8) et
// protection du jeune plant (tuteur + cache-plant), poste séparé.
//
// Géométrie de référence : celle des défauts UI (200×15 m, écarts
// 1,10×1,10 → nbRangs=13, densite=8264, surf=0,30 ha), même fixture que
// la section 1. `coutPalissage` n'était testé nulle part avant ce
// chantier — ces tests figent le comportement du nouveau modèle à 8
// lignes (piquet/fiche de tête/kit bout de route/amarre/crochet/fil,
// relevé fournisseur + gripple/MO pose piquet, LutEnVi 2025 conservés
// faute d'équivalent dans le relevé). Voir moteur-oad.js pour le détail
// des hypothèses de mapping (piquet = intermédiaire seul, crochet sur la
// même base).
// ----------------------------------------------------------------------

section('11. Palissage détaillé (relevé P8) et protection du jeune plant');

const GEO_TEST = { nbRangs: 13, L: 200, surf: 0.3 };

test('coutPalissage : 8 lignes, quantités attendues (espacement 6 m, 4 fils/rang)', () => {
  const cp = OAD.coutPalissage(GEO_TEST, null, { espacementPiquet: 6, nbFils: 4 });
  assert.strictEqual(cp.lignes.length, 8);
  assertClose(cp.nbInter, 416, 1e-9, 'interParRang = round(200/6)-1 = 32, ×13 rangs');
  assertClose(cp.nbTete, 26, 1e-9, '2 par rang × 13 rangs');
  assertClose(cp.mlFils, 10400, 1e-9, '4 fils × 13 rangs × 200 m');
  assertClose(cp.nbGripple, 52, 1e-9, '4 fils × 13 rangs');
});

test('coutPalissage : totalHa ≈ 14 577 €/ha (relevé fournisseur + gripple/MO LutEnVi conservés)', () => {
  const cp = OAD.coutPalissage(GEO_TEST, null, { espacementPiquet: 6, nbFils: 4 });
  assertClose(cp.totalHa, 14577, 1, 'total détaillé sur la géométrie par défaut');
});

test("coutProtectionPlant : densite × (tuteurU + cachePlant), sans dépendance à la géométrie du rang", () => {
  const cprot = OAD.coutProtectionPlant(8264);
  assertClose(cprot.tuteurHa, 8264 * 0.77, 1e-6);
  assertClose(cprot.cachePlantHa, 8264 * 0.48, 1e-6);
  assertClose(cprot.totalHa, 8264 * 1.25, 1e-6, '≈ 10 330 €/ha à cette densité — même ordre de grandeur que le palissage seul');
});

// Garde-fou 1 : coutProtectionHa vient s'ajouter à invArr[repos], au même
// titre que coutPalissageHa — jamais dans chargesEntretien (qui resterait
// inchangé), jamais dans invArr[0] (arrachage lui-même, avant repos).
const INP_H_PROTECTION = { ...INP_A, declinSQ: 0, coutProtectionHa: 10330 };
test("coutProtectionHa s'ajoute à l'investissement d'arrachage exactement à t=repos, jamais à t=0", () => {
  const scSansProtection = OAD.construireScenarios(INP_A);
  const scAvecProtection = OAD.construireScenarios(INP_H_PROTECTION);
  assertClose(scAvecProtection.arrachage.eur[0].coutsParcelle, scSansProtection.arrachage.eur[0].coutsParcelle, 1e-6,
    't=0 (arrachage lui-même) : aucun effet de coutProtectionHa');
  const attenduRepos = scSansProtection.arrachage.eur[INP_A.repos].coutsParcelle + INP_A.surfParc * 10330;
  assertClose(scAvecProtection.arrachage.eur[INP_A.repos].coutsParcelle, attenduRepos, 1e-6,
    't=repos : coutsParcelle augmente exactement de surfParc × coutProtectionHa');
});

// Garde-fou 2 (symétrie, décision du chantier P8) : coutProtectionHa
// n'affecte JAMAIS la complantation — coutEntreplant est posé comme
// incluant déjà la protection de l'entreplant (hypothèse à vérifier
// auprès de la source du prix, voir moteur-oad.js).
test("coutProtectionHa n'a aucun effet sur l'investissement de complantation (coutEntreplant l'inclut déjà, par hypothèse)", () => {
  const scSansProtection = OAD.construireScenarios(INP_A);
  const scAvecProtection = OAD.construireScenarios(INP_H_PROTECTION);
  assertClose(scAvecProtection.complantation.investissement, scSansProtection.complantation.investissement, 1e-9);
});

// Absence du champ (comme dans tous les cas canoniques de la section 1,
// écrits avant ce chantier) : comportement strictement inchangé.
test('coutProtectionHa absent de inp (undefined) : investissement arrachage identique au cas explicite à 0', () => {
  const { coutProtectionHa, ...inpSansChamp } = INP_H_PROTECTION;
  const scZero = OAD.construireScenarios({ ...inpSansChamp, coutProtectionHa: 0 });
  const scAbsent = OAD.construireScenarios(inpSansChamp);
  assertClose(scAbsent.arrachage.investissement, scZero.arrachage.investissement, 1e-9);
});

// ----------------------------------------------------------------------
// Section 12 — Consolidation (chantier P9) : invariants transverses issus
// des chantiers 1-8, non encore couverts par un test dédié (certains sont
// déjà exercés indirectement par les sections 1, 5 et 9 ci-dessus — ceux-ci
// les rendent explicites et autonomes, pour que la régression pointe
// directement vers l'invariant métier concerné plutôt que vers un
// snapshot chiffré).
// ----------------------------------------------------------------------

section('12. Consolidation (chantier P9) — invariants transverses');

test('charge de rendement (coutRdtParKg) nulle en repos ET en plantier, quel que soit son taux (recolteParcelle=0 sur toute la fenêtre)', () => {
  const inp = { ...INP_A, declinSQ: 0, coutRdtParKg: 999, coutReposHaAn: 0, coutPlantierHaAn: 0, coutSurfaceProdHaAn: 0 };
  const sc = OAD.construireScenarios(inp);
  const ce = OAD.chargesEntretien('arrachage', sc.arrachage.kg, inp);
  const rampYears = inp.ramp.length;
  sc.arrachage.kg.forEach(row => {
    if (row.t >= inp.repos + rampYears) return;
    assertClose(row.recolteParcelle, 0, 1e-9, `t=${row.t}`);
    assertClose(ce.parcelle[row.t] || 0, 0, 1e-6,
      `t=${row.t} : coutRdtParKg=999 mais recolteParcelle=0 => charge de rendement nulle malgré un taux élevé`);
  });
});

test('test de résistance (rendYearFn) appliqué à l\'identique aux 3 scénarios : même rendY à chaque année', () => {
  const sc = OAD.construireScenarios(INP_C_STRESS);
  for (let t = 0; t <= INP_C_STRESS.horizon; t++) {
    const [rArr, rComp, rSQ] = SCENARIOS.map(k => sc[k].kg[t].rendY);
    assertClose(rArr, rComp, 1e-9, `t=${t} arrachage vs complantation`);
    assertClose(rArr, rSQ, 1e-9, `t=${t} arrachage vs statuquo`);
    const attendu = (t === 3 || t === 4) ? RENDMEAN - EC : RENDMEAN;
    assertClose(rArr, attendu, 1e-9, `t=${t} : choc attendu uniquement années 3-4`);
  }
});

test('investissement t=0 == surfParc × coutArrachageHa, sans terme résiduel (garde-fou transverse, cf. section 1)', () => {
  const sc = OAD.construireScenarios(INP_A);
  assertClose(sc.arrachage.eur[0].coutsParcelle, INP_A.surfParc * INP_A.coutArrachageHa, 1e-9);
});

test('coucheEuro ne renvoie ni stockFin ni stockHa : le stock de réserve ne peut structurellement pas être monétisé dans la couche €', () => {
  SCENARIOS.forEach(k => {
    SC_BASE[k].eur.forEach(row => {
      assert.ok(!('stockFin' in row), `${k} : stockFin ne doit pas apparaître dans la couche €`);
      assert.ok(!('stockHa' in row), `${k} : stockHa ne doit pas apparaître dans la couche €`);
    });
  });
});

test("trajectoireAge est un indicateur physique pur : prixKg (ou tout autre paramètre €) n'a aucun effet sur son résultat", () => {
  const trajAvecPrix = OAD.trajectoireAge({ ...INP_AGE, prixKg: 999999 });
  const trajSansPrix = OAD.trajectoireAge(INP_AGE);
  assert.deepStrictEqual(trajAvecPrix, trajSansPrix,
    'prixKg ne doit avoir aucun effet sur la trajectoire d\'âge (indicateur physique, jamais monétisé — voir README §17)');
});

// ----------------------------------------------------------------------
// Bilan
// ----------------------------------------------------------------------

console.log(`\n${passed} ok, ${failed} FAIL, ${skipped} skip`);
if (failed > 0) process.exit(1);
