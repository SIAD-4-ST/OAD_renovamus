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
// (voir moteur-oad.js). Le cas (a) a été calé, à l'origine, sur les valeurs
// par défaut de l'UI d'ALORS, avant que le chantier A4 ne remplace la
// géométrie « longueur × largeur déclarées » (ancienne fonction interne
// `geometrie(v)` d'index.html, retirée depuis) par `OAD.geometrieAgronomique()`
// (voir README §16) :
//   - geoL=200, geoW=15 (géométrie pré-A4), ecartRang=1.10, ecartPied=1.10
//     → densite = round(10000/(1.10×1.10)) = 8264 pieds/ha
//     → surf = 200×15/10000 = 0.3 ha  → surfParc
//   - coutPalissageHa n'était pas le défaut affiché à l'époque (12000) mais la
//     valeur préremplie depuis la géométrie : OAD.coutPalissage(g, null,
//     {espacementPiquet:6, nbFils:4}).totalHa arrondi = 13116 €/ha.
//   Ce snapshot fige un comportement observé à un instant donné : il n'a pas
//   besoin de refléter les défauts UI actuels pour rester valide comme test
//   de non-régression du moteur.
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

// (b) repos=3 ans (borne haute du choix libre 1/2/3 ans, chantier A2 — le
// motif classique/sanitaire qui figeait autrefois ce couple repos/nbSortie
// a disparu, voir README §7bis) : repos passe à 3, nbSortie à 5.
// declinSQ explicité à 0 (chantier 4) pour rester stable indépendamment du
// défaut UI de (a) — ce cas ne teste pas le déclin statu quo.
const INP_B_REPOS3 = { ...INP_A, repos: 3, nbSortie: 5, declinSQ: 0 };

// (c) stress climatique "creux34" (étape 5, test de résistance climatique) : années 3 et 4
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
  const sc = OAD.construireScenarios(INP_B_REPOS3);
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
  const sc = OAD.construireScenarios(INP_B_REPOS3);
  assertClose(sc.arrachage.eur[0].coutsParcelle, INP_B_REPOS3.surfParc * INP_B_REPOS3.coutArrachageHa, 1e-9);
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
  const sc = OAD.construireScenarios(INP_B_REPOS3);
  sc.arrachage.eur.forEach(row => {
    if (row.t === 0 || row.t === INP_B_REPOS3.repos) {
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

// Renommé au prompt B8 : ce test s'appelait « (bascule en saisie manuelle) ».
// La bascule n'existe plus — le registre est la seule source depuis
// l'arbitrage du 01/09/2026, et un registre vide fait maintenant afficher un
// état bloquant à l'écran 1 (out.registreSansSurface). Le comportement
// NUMÉRIQUE testé ici, lui, est inchangé et doit le rester : c'est sur lui que
// repose l'absence d'exception derrière cet état bloquant.
test('registre vide → agrégats à 0 sans exception (état bloquant affiché)', () => {
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
// Section 13 — Largeur équivalente (chantier "réconciliation
// géométrie/registre", option A). En mode registre, la surface directrice
// vient du registre parcellaire ; la largeur du rectangle saisi n'a plus
// de sens et est remplacée par une largeur dérivée (surf / longueur).
// La longueur, elle, n'est jamais recalculée : voir README, journal
// d'arbitrages, pour la justification économique (W neutre au ratio par
// hectare de coutPalissage, L ne l'est pas).
// ----------------------------------------------------------------------

section('13. Largeur équivalente (chantier réconciliation géométrie/registre)');

test('largeurEquivalente(1,2345 ha, 180 m) : valeur attendue explicite', () => {
  assertClose(OAD.largeurEquivalente(1.2345, 180), 1.2345 * 10000 / 180, 1e-9);
});

test('largeurEquivalente : longueur nulle ou négative → 0', () => {
  assertClose(OAD.largeurEquivalente(1.5, 0), 0, 1e-9);
  assertClose(OAD.largeurEquivalente(1.5, -10), 0, 1e-9);
});

test('largeurEquivalente : surface nulle ou négative → 0', () => {
  assertClose(OAD.largeurEquivalente(0, 180), 0, 1e-9);
  assertClose(OAD.largeurEquivalente(-1, 180), 0, 1e-9);
});

// Reproduit la dérivation de index.html:geometrie(v, surfImposee) — W vient
// exclusivement de largeurEquivalente(surfImposee, L), jamais de v.geoW —
// pour prouver que deux largeurs saisies différentes convergent vers le
// même coutPalissage().totalHa en mode registre (option A, non re-arbitrée).
function geometrieRegistre(geoWSaisie, surfImposee, L, eR) {
  const W = OAD.largeurEquivalente(surfImposee, L); // v.geoW (geoWSaisie) ignoré
  const nbRangs = Math.max(1, Math.floor(W / eR));
  return { nbRangs, L, surf: surfImposee, W };
}

test('invariance : à surface et écartements constants, la largeur saisie n\'affecte plus coutPalissage().totalHa en mode registre', () => {
  const surf = 0.3, L = 200, eR = 1.10;
  const geoA = geometrieRegistre(50, surf, L, eR);   // largeur saisie = 50 m (ignorée)
  const geoB = geometrieRegistre(999, surf, L, eR);  // largeur saisie = 999 m (ignorée)
  assertClose(geoA.W, geoB.W, 1e-9, 'largeur dérivée identique quelle que soit la largeur saisie à l\'origine');
  const cpA = OAD.coutPalissage(geoA, null, { espacementPiquet: 6, nbFils: 4 });
  const cpB = OAD.coutPalissage(geoB, null, { espacementPiquet: 6, nbFils: 4 });
  assertClose(cpA.totalHa, cpB.totalHa, 1e-9,
    'coutPalissage ne lit ni W ni la largeur saisie — seuls nbRangs/L/surf comptent');
});

test('sensibilité conservée : à surface constante, L=200 puis L=50 → totalHa augmente d\'au moins 3 500 €/ha (garde-fou anti-régression)', () => {
  const surf = 0.3, eR = 1.10;
  const geo200 = { nbRangs: Math.max(1, Math.floor(OAD.largeurEquivalente(surf, 200) / eR)), L: 200, surf };
  const geo50  = { nbRangs: Math.max(1, Math.floor(OAD.largeurEquivalente(surf, 50) / eR)), L: 50, surf };
  const cp200 = OAD.coutPalissage(geo200, null, { espacementPiquet: 6, nbFils: 4 });
  const cp50  = OAD.coutPalissage(geo50, null, { espacementPiquet: 6, nbFils: 4 });
  assert.ok(cp50.totalHa - cp200.totalHa >= 3500,
    `attendu un surcoût ≥ 3 500 €/ha entre L=200 (${cp200.totalHa.toFixed(0)} €/ha) et L=50 (${cp50.totalHa.toFixed(0)} €/ha), obtenu ${(cp50.totalHa - cp200.totalHa).toFixed(0)} €/ha`);
});

test('cohérence : surfHa × 10000 / largeurEquivalente(surfHa, L) === L (la largeur dérivée redonne la surface imposée)', () => {
  const surfHa = 0.4567, L = 150;
  const W = OAD.largeurEquivalente(surfHa, L);
  assertClose(surfHa, W * L / 10000, 1e-9,
    'la largeur dérivée, remultipliée par la longueur, redonne exactement la surface imposée (surf === surfParc)');
});

// ----------------------------------------------------------------------
// Section 14 — Régimes de travail de l'arrachage (chantier B5, bloc 4 de
// l'écran 5 : « ne pas surpromettre »). La note de cadrage demande de
// montrer que la parcelle renouvelée « reste entretenue mais représente
// un travail moins important » — vrai pendant le repos, douteux sur le
// plantier (taille de formation, protection, remplacement des manquants,
// désherbage : du vrai travail), le seul poste franchement économisé
// étant la vendange. regimesTravailArrachage segmente donc l'horizon en
// 3 fenêtres (repos/plantier/production) au lieu d'un message agrégé —
// voir moteur-oad.js.
// ----------------------------------------------------------------------

section("14. Régimes de travail de l'arrachage (chantier B5, bloc 4)");

const HPROD_A = OAD.REF_OPS_MANUEL.reduce((s, o) => s + o.h1000 * INP_A.densite / 1000, 0);

test("3 fenêtres renvoyées, dans l'ordre repos → plantier → production, sans trou ni chevauchement", () => {
  const reg = OAD.regimesTravailArrachage(SC_BASE.arrachage.kg, SC_BASE.statuquo.kg, INP_A);
  assert.strictEqual(reg.length, 3);
  assert.deepStrictEqual(reg.map(r => r.id), ['repos', 'plantier', 'production']);
  const total = reg.reduce((s, r) => s + r.nbAnnees, 0);
  assertClose(total, INP_A.horizon + 1, 1e-9, 'la somme des 3 fenêtres doit couvrir t=0..horizon exactement une fois chacune');
});

test('INP_A (repos=1, rampYears=3) : bornes exactes — repos=1 an, plantier=3 ans, production=7 ans', () => {
  const reg = OAD.regimesTravailArrachage(SC_BASE.arrachage.kg, SC_BASE.statuquo.kg, INP_A);
  assertClose(reg[0].nbAnnees, 1, 1e-9, 'repos : t=0 seulement');
  assertClose(reg[1].nbAnnees, 3, 1e-9, 'plantier : t=1,2,3');
  assertClose(reg[2].nbAnnees, 7, 1e-9, 'production : t=4..10');
});

test('repos : aucune heure manuelle travaillée, aucune vendange (pas de vigne en terre)', () => {
  const reg = OAD.regimesTravailArrachage(SC_BASE.arrachage.kg, SC_BASE.statuquo.kg, INP_A);
  const repos = reg[0];
  assertClose(repos.heuresHaAn, 0, 1e-9);
  assert.strictEqual(repos.vendangeActive, false);
  assertClose(repos.heuresHaAnRef, HPROD_A, 1e-6, 'la référence statu quo, elle, continue de travailler la surface équivalente');
});

test('plantier (INP_A : returnYear = repos+rampYears = 4, coïncidence) : hProd × fracFormation, pas encore de vendange', () => {
  const reg = OAD.regimesTravailArrachage(SC_BASE.arrachage.kg, SC_BASE.statuquo.kg, INP_A);
  const plantier = reg[1];
  assertClose(plantier.heuresHaAn, HPROD_A * 0.35, 1e-6, 'fracFormation par défaut = 0.35');
  assert.strictEqual(plantier.vendangeActive, false, "avec INP_A, la vigne entre en production (t=4) exactement à la fin de la fenêtre plantier");
  assertClose(plantier.heuresHaAnRef, HPROD_A, 1e-6);
});

test("production : aucune économie de main d'œuvre résiduelle (heuresHaAn === heuresHaAnRef), vendange active", () => {
  const reg = OAD.regimesTravailArrachage(SC_BASE.arrachage.kg, SC_BASE.statuquo.kg, INP_A);
  const production = reg[2];
  assertClose(production.heuresHaAn, HPROD_A, 1e-6);
  assertClose(production.heuresHaAn, production.heuresHaAnRef, 1e-9, 'une fois mature, la parcelle redemande exactement le même travail manuel que le statu quo');
  assert.strictEqual(production.vendangeActive, true);
});

test('rampYears > 3 (montée en charge allongée) : la vendange peut démarrer avant la fin de la fenêtre plantier', () => {
  // repos=1, rampYears=4 (ex. anneePleineProd=6) : returnYear = 3+1 = 4 < repos+rampYears = 5,
  // donc la dernière année de "plantier" (t=4) a déjà une récolte non nulle — la fenêtre
  // plantier n'a pas de garantie structurelle "vendange nulle", contrairement à INP_A.
  const inp = { ...INP_A, ramp: [0.25, 0.5, 0.75, 1], rampYears: 4 };
  const sc = OAD.construireScenarios(inp);
  const reg = OAD.regimesTravailArrachage(sc.arrachage.kg, sc.statuquo.kg, inp);
  assertClose(reg[1].nbAnnees, 4, 1e-9);
  assert.strictEqual(reg[1].vendangeActive, true, 'la fenêtre plantier chevauche le début de la production réelle');
});

test('rampYears minimal (=1) : la fenêtre plantier se referme avant returnYear, jamais de vendange', () => {
  // repos=1, rampYears=1 : plantier = [1,2), returnYear = 4 > 2 : aucune récolte sur la fenêtre ;
  // la production démarre (charge) dès t=2 mais la récolte réelle (returnYear=4) suit plus tard.
  const inp = { ...INP_A, ramp: [1], rampYears: 1 };
  const sc = OAD.construireScenarios(inp);
  const reg = OAD.regimesTravailArrachage(sc.arrachage.kg, sc.statuquo.kg, inp);
  assert.strictEqual(reg[1].vendangeActive, false);
  assert.strictEqual(reg[2].vendangeActive, true, "la vendange démarre bien dans la fenêtre production (t≥repos+rampYears=2), même si returnYear=4 la retarde encore un peu");
});

test('fracFormation=0 (hypothèse extrême) : aucun travail affiché en plantier, sans erreur', () => {
  const reg = OAD.regimesTravailArrachage(SC_BASE.arrachage.kg, SC_BASE.statuquo.kg, INP_A, OAD.REF_OPS_MANUEL, 0);
  assertClose(reg[1].heuresHaAn, 0, 1e-9);
});

test('fracFormation=1 (hypothèse extrême) : le plantier redevient identique à la référence statu quo', () => {
  const reg = OAD.regimesTravailArrachage(SC_BASE.arrachage.kg, SC_BASE.statuquo.kg, INP_A, OAD.REF_OPS_MANUEL, 1);
  assertClose(reg[1].heuresHaAn, reg[1].heuresHaAnRef, 1e-9);
});

test("repos=3 (INP_B_REPOS3) : la fenêtre repos s'élargit d'autant, le plantier démarre à t=3", () => {
  const sc = OAD.construireScenarios(INP_B_REPOS3);
  const reg = OAD.regimesTravailArrachage(sc.arrachage.kg, sc.statuquo.kg, INP_B_REPOS3);
  assertClose(reg[0].nbAnnees, 3, 1e-9);
  assert.strictEqual(reg[1].id, 'plantier');
});

test('horizon très court (horizon=0) : aucune division par zéro, fenêtres au-delà de l\'horizon nulles', () => {
  const inp = { ...INP_A, horizon: 0 };
  const sc = OAD.construireScenarios(inp);
  const reg = OAD.regimesTravailArrachage(sc.arrachage.kg, sc.statuquo.kg, inp);
  assertClose(reg[0].nbAnnees, 1, 1e-9, 'repos couvre t=0, seule année de l\'horizon');
  assertClose(reg[1].nbAnnees, 0, 1e-9);
  assertClose(reg[2].nbAnnees, 0, 1e-9);
  reg.forEach(r => {
    assert.ok(isFinite(r.heuresHaAn), `${r.id}.heuresHaAn non fini`);
    assert.ok(isFinite(r.heuresHaAnRef), `${r.id}.heuresHaAnRef non fini`);
  });
});

test("regimesTravailArrachage ne mute pas les lignes kg qu'on lui passe (lecture seule)", () => {
  const sc = OAD.construireScenarios(INP_A);
  const avantArr = JSON.parse(JSON.stringify(sc.arrachage.kg));
  const avantSQ = JSON.parse(JSON.stringify(sc.statuquo.kg));
  OAD.regimesTravailArrachage(sc.arrachage.kg, sc.statuquo.kg, INP_A);
  assert.deepStrictEqual(sc.arrachage.kg, avantArr, 'sc.arrachage.kg a été modifié');
  assert.deepStrictEqual(sc.statuquo.kg, avantSQ, 'sc.statuquo.kg a été modifié');
});

test("cohérence transverse : Σ heuresHaAn × nbAnnees sur les 3 fenêtres === Σ heuresManuellesParAnnee('arrachage') brut sur tout l'horizon", () => {
  const reg = OAD.regimesTravailArrachage(SC_BASE.arrachage.kg, SC_BASE.statuquo.kg, INP_A);
  const sommeFenetres = reg.reduce((s, r) => s + r.heuresHaAn * r.nbAnnees, 0);
  const hArrBrut = OAD.heuresManuellesParAnnee('arrachage', SC_BASE.arrachage.kg, INP_A);
  const sommeBrute = hArrBrut.reduce((s, h) => s + h, 0);
  assertClose(sommeFenetres, sommeBrute, 1e-6, 'aucune année ne doit être comptée deux fois ni omise entre les 3 fenêtres');
});

// ----------------------------------------------------------------------
// Section 15 — Parcours de recette métier (note de cadrage, chantier C3)
//
// Traduit en tests les parcours automatisables de la note de cadrage
// (repos/déblocages, taille Chablis, équipements de palissage, montée en
// charge). Les contrôles de lisibilité de l'écran 5 relèvent de la recette
// humaine — voir README §20 pour la liste séparée, non automatisée ici.
// ----------------------------------------------------------------------

section('15. Parcours de recette métier');

test('repos=1 an : le moteur associe exactement 3 déblocages de réserve, à 9 000 kg/ha × surfArr chacun', () => {
  assert.strictEqual(OAD.nbSortiePourRepos(1), 3);
  const inp = { ...INP_A, declinSQ: 0, repos: 1, nbSortie: OAD.nbSortiePourRepos(1) };
  const sc = OAD.construireScenarios(inp);
  const sorties = sc.arrachage.kg.filter(r => r.sortieArr > 0).map(r => r.t);
  assert.deepStrictEqual(sorties, [1, 2, 3], 'déblocages aux années 1 à nbSortie, jamais avant ni après');
  sorties.forEach(t => assertClose(sc.arrachage.kg[t].sortieArr, OAD.VOL_SORTIE_ARRACHAGE * inp.surfParc, 1e-6, `t=${t}`));
});

test('repos=1 an : aucune sortie « arrachage » à t=0 (avant la replantation) ni au-delà de nbSortie', () => {
  const inp = { ...INP_A, declinSQ: 0, repos: 1, nbSortie: OAD.nbSortiePourRepos(1) };
  const sc = OAD.construireScenarios(inp);
  assertClose(sc.arrachage.kg[0].sortieArr, 0, 1e-9, 't=0 : arrachage lui-même, avant tout déblocage');
  for (let t = 4; t <= inp.horizon; t++) assertClose(sc.arrachage.kg[t].sortieArr, 0, 1e-9, `t=${t}`);
});

test('repos=2 ans : le moteur associe exactement 4 déblocages de réserve, aux années 1 à 4', () => {
  assert.strictEqual(OAD.nbSortiePourRepos(2), 4);
  const inp = { ...INP_A, declinSQ: 0, repos: 2, nbSortie: OAD.nbSortiePourRepos(2) };
  const sc = OAD.construireScenarios(inp);
  const sorties = sc.arrachage.kg.filter(r => r.sortieArr > 0).map(r => r.t);
  assert.deepStrictEqual(sorties, [1, 2, 3, 4]);
});

test('repos=2 ans : la réserve minimale mobilisée est plus basse qu\'avec repos=1 an (4 déblocages > 3), jamais négative', () => {
  const inp1 = { ...INP_A, declinSQ: 0, repos: 1, nbSortie: OAD.nbSortiePourRepos(1) };
  const inp2 = { ...INP_A, declinSQ: 0, repos: 2, nbSortie: OAD.nbSortiePourRepos(2) };
  const sc1 = OAD.construireScenarios(inp1), sc2 = OAD.construireScenarios(inp2);
  const min1 = Math.min(...sc1.arrachage.kg.map(r => r.stockHa));
  const min2 = Math.min(...sc2.arrachage.kg.map(r => r.stockHa));
  assert.ok(min2 < min1, `repos=2 doit mobiliser davantage la réserve que repos=1 (min2=${min2}, min1=${min1})`);
  sc2.arrachage.kg.forEach(r => assert.ok(r.stockFin >= 0, `t=${r.t} : stock négatif`));
});

test('repos=2 ans : la réserve totale mobilisée sur les 4 déblocages vaut exactement nbSortie × 9 000 kg/ha × surfArr', () => {
  const inp = { ...INP_A, declinSQ: 0, repos: 2, nbSortie: OAD.nbSortiePourRepos(2) };
  const sc = OAD.construireScenarios(inp);
  const totalMobilise = sc.arrachage.kg.reduce((s, r) => s + r.sortieArr, 0);
  assertClose(totalMobilise, inp.nbSortie * OAD.VOL_SORTIE_ARRACHAGE * inp.surfParc, 1e-6);
});

test('repos=3 ans : le moteur associe exactement 5 déblocages de réserve, aux années 1 à 5', () => {
  assert.strictEqual(OAD.nbSortiePourRepos(3), 5);
  const inp = { ...INP_A, declinSQ: 0, repos: 3, nbSortie: OAD.nbSortiePourRepos(3) };
  const sc = OAD.construireScenarios(inp);
  const sorties = sc.arrachage.kg.filter(r => r.sortieArr > 0).map(r => r.t);
  assert.deepStrictEqual(sorties, [1, 2, 3, 4, 5]);
});

test('durée de repos hors 1/2/3 ans : nbSortiePourRepos refuse explicitement plutôt que de deviner un nombre de déblocages', () => {
  assert.throws(() => OAD.nbSortiePourRepos(4), /repos non prévue/);
  assert.throws(() => OAD.nbSortiePourRepos(0), /repos non prévue/);
});

test('taille Chablis : 5 fils par rang, comme l\'arcure double (valeur communiquée par l\'utilisateur, non sourcée — chantier A5)', () => {
  assert.strictEqual(OAD.FILS_PAR_TAILLE.chablis, 5);
});

test('taille Chablis : le nombre de fils dérivé se répercute sur le métrage de fil et le nombre de gripples du palissage', () => {
  const cpGuyot = OAD.coutPalissage(GEO_TEST, null, { espacementPiquet: 6, typeTaille: 'guyot' });
  const cpChablis = OAD.coutPalissage(GEO_TEST, null, { espacementPiquet: 6, typeTaille: 'chablis' });
  assert.strictEqual(cpChablis.nbFils, 5);
  assertClose(cpChablis.mlFils, cpGuyot.mlFils * 5 / 4, 1e-6);
  assertClose(cpChablis.nbGripple, cpGuyot.nbGripple * 5 / 4, 1e-6);
  assert.ok(cpChablis.totalHa > cpGuyot.totalHa, 'un fil de plus par rang renchérit forcément le total');
});

test('équipements obligatoires (piquets, fiches de tête, amarres, crochets, fils, gripple, MO pose) : toujours comptés, ignorent la liste d\'exclusion', () => {
  const idsObligatoires = ['piquetInter', 'ficheTete', 'amarre', 'crochet', 'filML', 'gripple', 'moPosePiquet'];
  const cp = OAD.coutPalissage(GEO_TEST, null, { espacementPiquet: 6, nbFils: 4, optionnelsExclus: idsObligatoires });
  cp.lignes.filter(l => l.categorie === 'obligatoire').forEach(l => assert.strictEqual(l.inclus, true, l.id));
});

test('équipement optionnel décoché (kits bout de route) : exclu du total, pour exactement le montant de sa ligne', () => {
  const cpTout = OAD.coutPalissage(GEO_TEST, null, { espacementPiquet: 6, nbFils: 4 });
  const cpSansKit = OAD.coutPalissage(GEO_TEST, null, { espacementPiquet: 6, nbFils: 4, optionnelsExclus: ['kitBoutRoute'] });
  const ligneKit = cpTout.lignes.find(l => l.id === 'kitBoutRoute');
  assert.strictEqual(cpSansKit.lignes.find(l => l.id === 'kitBoutRoute').inclus, false);
  assertClose(cpTout.totalParcelle - cpSansKit.totalParcelle, ligneKit.total, 1e-6);
});

test('le total du palissage (obligatoires + optionnels retenus) se répercute intégralement dans l\'investissement d\'arrachage, exactement à t=repos', () => {
  const cp = OAD.coutPalissage(GEO_TEST, null, { espacementPiquet: 6, nbFils: 4 });
  const coutPalissageHa = Math.round(cp.totalHa);
  const scAvec = OAD.construireScenarios({ ...INP_A, coutPalissageHa });
  const scSans = OAD.construireScenarios({ ...INP_A, coutPalissageHa: 0 });
  const ecart = scAvec.arrachage.eur[INP_A.repos].coutsParcelle - scSans.arrachage.eur[INP_A.repos].coutsParcelle;
  assertClose(ecart, INP_A.surfParc * coutPalissageHa, 1e-6);
});

test('rampeLineaire : montée linéaire correcte (N=4 et N=6 depuis l\'entrée en production), refuse une année de pleine production < 3', () => {
  assert.deepStrictEqual(OAD.rampeLineaire(4), [0.5, 1]);
  const r6 = OAD.rampeLineaire(6);
  assertClose(r6[0], 0.25, 1e-9); assertClose(r6[1], 0.5, 1e-9);
  assertClose(r6[2], 0.75, 1e-9); assertClose(r6[3], 1, 1e-9);
  assert.throws(() => OAD.rampeLineaire(2), /≥ 3/);
});

test('LIMITE ASSUMÉE — le rendement de 3e feuille dépend de l\'année de pleine production saisie, pas de l\'âge de la vigne : 50 % pour N=4, ≈16,7 % pour N=8', () => {
  assertClose(OAD.rampeLineaire(4)[0], 0.5, 1e-9, 'N=4 : la 3e feuille produit déjà la moitié du potentiel');
  assertClose(OAD.rampeLineaire(8)[0], 1 / 6, 1e-9, 'N=8 : la même 3e feuille ne produit plus qu\'un sixième — même vigne, même âge, résultat différent selon la saisie');
});

// ----------------------------------------------------------------------
section('16. Référentiel clones (prompt A1) — union Guide 2025 / PlantGrape');
// ----------------------------------------------------------------------
// Ce référentiel est INFORMATIF : aucun test ne doit vérifier qu'il influe sur
// un scénario, puisqu'il n'entre dans aucun `inp` (même traitement qu'ARBRE_PG).
// Ce qui est figé ici, c'est la COMPLÉTUDE et la TRAÇABILITÉ du relevé : toute
// ligne perdue, tout trou comblé en douce fera tomber un de ces tests.

const CLONES = OAD.CLONES_CHAMPAGNE;

test('42 lignes au total, réparties 11 Chardonnay / 19 Pinot noir / 12 Meunier', () => {
  assert.strictEqual(CLONES.length, 42);
  assert.strictEqual(OAD.clonesParCepage('Chardonnay').length, 11);
  assert.strictEqual(OAD.clonesParCepage('Pinot noir').length, 19);
  assert.strictEqual(OAD.clonesParCepage('Meunier').length, 12);
});

test('chaque ligne porte les 13 champs attendus, et `sources` n\'est jamais vide', () => {
  const champs = ['cepage', 'clone', 'sources', 'refAgronomiques', 'production', 'sucre',
    'fertilite', 'typiciteChampagne', 'precocite', 'botrytis', 'multiplicationHa',
    'remarqueGuide', 'remarquePlantGrape'];
  CLONES.forEach(c => {
    champs.forEach(k => assert.ok(k in c, `champ ${k} absent sur ${c.cepage} ${c.clone}`));
    assert.ok(Array.isArray(c.sources) && c.sources.length >= 1,
      `origine absente sur ${c.cepage} ${c.clone} — aucune ligne ne peut être sans source`);
  });
});

test('3 lignes exactement portent une origine partielle : Pinot noir 115 et Meunier 925 (PlantGrape hors référence Champagne), Meunier 458 (PlantGrape seul, absent du Guide)', () => {
  const partielles = CLONES.filter(c =>
    c.sources.length === 1 || c.sources.some(s => s.includes('hors réf.')));
  assert.deepStrictEqual(
    partielles.map(c => c.cepage + ' ' + c.clone).sort(),
    ['Meunier 458', 'Meunier 925', 'Pinot noir 115']);
  assert.deepStrictEqual(CLONES.find(c => c.clone === '458').sources, ['PlantGrape']);
  assert.strictEqual(CLONES.find(c => c.clone === '458').remarqueGuide, '');
});

test('`botrytis` est renseigné sur 5 lignes seulement — les 37 autres restent vides (donnée absente des sources, jamais comblée)', () => {
  const avec = CLONES.filter(c => c.botrytis !== '');
  assert.strictEqual(avec.length, 5);
  assert.deepStrictEqual(
    avec.map(c => c.cepage + ' ' + c.clone),
    ['Pinot noir 236', 'Pinot noir 665', 'Meunier 818', 'Meunier 900', 'Meunier 924']);
});

test('clonesParCepage trie par numéro de clone croissant — tri NUMÉRIQUE, pas lexicographique (75 avant 118)', () => {
  const ch = OAD.clonesParCepage('Chardonnay').map(c => Number(c.clone));
  assert.deepStrictEqual(ch, [75, 76, 78, 95, 96, 118, 121, 124, 130, 131, 132]);
  ['Pinot noir', 'Meunier'].forEach(cep => {
    const nums = OAD.clonesParCepage(cep).map(c => Number(c.clone));
    nums.forEach((n, i) => { if (i) assert.ok(n > nums[i - 1], cep + ' : ordre rompu en ' + n); });
  });
});

test('clonesParCepage ne mute pas le référentiel et renvoie [] sur un cépage inconnu (Voltis)', () => {
  const avant = CLONES.map(c => c.clone).join(',');
  OAD.clonesParCepage('Pinot noir').sort((a, b) => Number(b.clone) - Number(a.clone));
  assert.strictEqual(CLONES.map(c => c.clone).join(','), avant);
  assert.deepStrictEqual(OAD.clonesParCepage('Voltis'), []);
});

test('typiciteChampagne n\'est renseigné que sur le Pinot noir, precocite jamais sur le Pinot noir — les deux colonnes sont exclusives par cépage (colonne conditionnelle de l\'écran 3)', () => {
  CLONES.forEach(c => {
    if (c.typiciteChampagne !== '') assert.strictEqual(c.cepage, 'Pinot noir',
      `typicité renseignée hors Pinot noir : ${c.cepage} ${c.clone}`);
    if (c.precocite !== '') assert.notStrictEqual(c.cepage, 'Pinot noir',
      `précocité renseignée sur Pinot noir : ${c.clone}`);
  });
});

test('les 3 Meunier à mutations réverses (458, 900, 983) sont identifiables par leur remarque — support du badge d\'alerte de l\'écran 3', () => {
  const reverses = CLONES.filter(c =>
    /mutations r[ée]verses/i.test(c.remarqueGuide + ' ' + c.remarquePlantGrape));
  assert.deepStrictEqual(reverses.map(c => c.clone).sort(), ['458', '900', '983']);
  reverses.forEach(c => assert.strictEqual(c.cepage, 'Meunier'));
});

test('le référentiel n\'entre dans aucun calcul : construireScenarios ignore CLONES_CHAMPAGNE (même statut qu\'ARBRE_PG)', () => {
  const avecClone = OAD.construireScenarios({ ...INP_A, clone: '927', cepage: 'Pinot noir' });
  assert.deepStrictEqual(snapshotScenarios(avecClone), snapshotScenarios(SC_BASE));
});

// ----------------------------------------------------------------------
section('17. Constantes de campagne (prompt A2) et stress climatique (prompt A3)');
// ----------------------------------------------------------------------

test('les constantes de campagne sorties de renderVals() valent bien ce que la vue câblait : plafond 10 000, moyenne 12 296,6, écart-type 3 440', () => {
  assert.strictEqual(OAD.PLAFOND_RESERVE, 10000);
  assert.strictEqual(OAD.REND_MOYEN_REGIONAL, 12296.6);
  assert.strictEqual(OAD.ECART_TYPE_REGIONAL, 3440);
});

test('VOLCO_CAMPAGNE et VOL_SORTIE_ARRACHAGE sont deux constantes DISTINCTES : 8 800 (campagne 2026) contre 9 000 (déblocage de réserve), sans lien de dérivation', () => {
  assert.strictEqual(OAD.VOLCO_CAMPAGNE, 8800, 'VolCo campagne 2026 — Bureau exécutif du 22/07/2026');
  assert.strictEqual(OAD.VOL_SORTIE_ARRACHAGE, 9000, 'volume annuel débloqué pendant la fenêtre d\'arrachage');
  assert.notStrictEqual(OAD.VOLCO_CAMPAGNE, OAD.VOL_SORTIE_ARRACHAGE,
    'si ces deux valeurs redeviennent égales, vérifier que ce n\'est pas une fusion accidentelle : elles ne se mettent pas à jour ensemble');
});

test('les KPI existants sont inchangés à VolCo identique — sortir les constantes de la vue n\'a touché aucune formule', () => {
  assert.deepStrictEqual(snapshotScenarios(OAD.construireScenarios(INP_A)), snapshotScenarios(SC_BASE));
  assert.strictEqual(INP_A.plafond, OAD.PLAFOND_RESERVE);
  assert.strictEqual(INP_A.rendMean, OAD.REND_MOYEN_REGIONAL);
});

test('stressEstDeficitaire — DÉFICITAIRE à VolCo 9 000 : la mauvaise vendange (8 856,6 kg/ha) manque 143 kg/ha, elle puise dans la réserve', () => {
  assert.strictEqual(OAD.stressEstDeficitaire(9000), true);
  assertClose(OAD.REND_MOYEN_REGIONAL - OAD.ECART_TYPE_REGIONAL - 9000, -143.4, 1e-9);
});

test('stressEstDeficitaire — EXCÉDENTAIRE à VolCo 8 800 : la MÊME mauvaise vendange dégage 57 kg/ha et abonde la réserve. Le scénario par défaut change de nature selon un champ que l\'utilisateur peut modifier (prompt A3)', () => {
  assert.strictEqual(OAD.stressEstDeficitaire(8800), false);
  assertClose(OAD.REND_MOYEN_REGIONAL - OAD.ECART_TYPE_REGIONAL - 8800, 56.6, 1e-9);
  assert.notStrictEqual(OAD.stressEstDeficitaire(OAD.VOLCO_CAMPAGNE), OAD.stressEstDeficitaire(9000),
    'le basculement se produit entre la campagne 2025 et la campagne 2026 — c\'est le point à documenter côté UI');
});

// ----------------------------------------------------------------------
section('18. Cohérence interface / moteur (prompt B3)');
// ----------------------------------------------------------------------
// index.html n'est pas testable ici (ni DOM ni React), mais deux valeurs y sont
// écrites en littéral tout en devant rester d'accord avec le moteur. On les
// relit dans le texte du fichier : c'est grossier, mais c'est la seule chose
// qui empêchera une mise à jour du VolCo de campagne d'oublier la moitié du
// projet. Voir README §19.

const INDEX_HTML = require('fs').readFileSync(
  require('path').join(__dirname, '..', 'index.html'), 'utf8');

test('le VolCo par défaut de l\'interface (V_DEFAUTS.volco) vaut bien OAD.VOLCO_CAMPAGNE — 8 800 kg/ha, campagne 2026', () => {
  const m = INDEX_HTML.match(/\n\s*volco:\s*(\d+),/);
  assert.ok(m, 'V_DEFAUTS.volco introuvable dans index.html');
  assert.strictEqual(Number(m[1]), OAD.VOLCO_CAMPAGNE,
    'le défaut de l\'UI et la constante du moteur ont divergé : mettre les deux à jour, ou dériver l\'un de l\'autre');
});

test('le test de résistance est actif PAR DÉFAUT dans l\'interface, sur la variante à deux années déficitaires (arbitrage 8)', () => {
  assert.ok(/sequence:\s*'creux34'/.test(INDEX_HTML),
    'V_DEFAUTS.sequence doit valoir creux34 — deux vendanges déficitaires par défaut');
});

test('l\'horizon est figé à 10 ans côté interface, mais le moteur accepte toujours 25 ans (arbitrage 6)', () => {
  assert.ok(/horizon:\s*10,/.test(INDEX_HTML),
    'inp.horizon doit être figé à 10 côté UI');
  assert.ok(!/<option value="25">25 ans<\/option>/.test(INDEX_HTML),
    'le sélecteur d\'horizon 10/25 doit avoir disparu de l\'interface');
  // Le moteur, lui, n'a rien perdu : la section 3 couvre l'horizon 25 ans.
  const sc25 = OAD.construireScenarios({ ...INP_A, horizon: 25 });
  assert.strictEqual(sc25.arrachage.kg.length, 26, 'le moteur doit toujours savoir simuler 25 ans');
});

// ----------------------------------------------------------------------
section('19. Édition manuelle du registre (prompt B8)');
// ----------------------------------------------------------------------
// Arbitrage du 01/09/2026 : le registre parcellaire devient la SEULE source
// des surfaces et des âges, la saisie manuelle disparaît des écrans 1 et 2.
// Pour rester utilisable sans export CSV du portail CIVC, le tableau gagne
// l'ajout et la suppression de lignes — ce qui fait de `_id` une identité et
// non plus un index de rendu. Ces trois fonctions du moteur portent la part
// calculable de cette édition ; le reste (state React, gabarit) n'est pas
// testable ici, d'où les deux contrôles textuels sur index.html en fin de
// section, sur le modèle de la section 18.

test('prochainIdRegistre : registre vide → 0, sinon strictement au-dessus du plus grand _id', () => {
  assert.strictEqual(OAD.prochainIdRegistre([]), 0);
  assert.strictEqual(OAD.prochainIdRegistre(undefined), 0);
  assert.strictEqual(OAD.prochainIdRegistre([{ _id: 0 }, { _id: 1 }, { _id: 2 }]), 3);
  // Trous et désordre : c'est le MAXIMUM qui compte, pas le nombre de lignes —
  // sinon un registre amputé de ses premières lignes recyclerait des _id.
  assert.strictEqual(OAD.prochainIdRegistre([{ _id: 7 }, { _id: 2 }]), 8);
  // _id absent ou non numérique (instantané d'une version antérieure) : ignoré,
  // jamais compté comme un identifiant occupé.
  assert.strictEqual(OAD.prochainIdRegistre([{ _id: 4 }, { idu: 'Z1' }, { _id: 'x' }]), 5);
});

test('ajout de ligne : chaque nouvel _id est unique, y compris après plusieurs ajouts et suppressions', () => {
  // On rejoue la mécanique d'index.html : `nextRowId` est un compteur en state,
  // initialisé par prochainIdRegistre puis incrémenté à chaque ajout — il ne
  // repart JAMAIS du registre courant, sans quoi une suppression libérerait un
  // identifiant qu'un ajout ultérieur réattribuerait à une autre ligne.
  let rows = [
    { _id: 0, idu: 'Z0068', surface: 0.4, situation: 'plantee' },
    { _id: 1, idu: 'Z0069', surface: 0.3, situation: 'plantee' }
  ];
  let nextRowId = OAD.prochainIdRegistre(rows);
  assert.strictEqual(nextRowId, 2);

  const ajouter = () => { rows = [...rows, OAD.ligneRegistreVierge(2026, nextRowId)]; nextRowId += 1; };
  const supprimer = (id) => { rows = rows.filter(r => r._id !== id); };

  ajouter();            // _id 2
  ajouter();            // _id 3
  supprimer(2);         // libère 2 — il ne doit jamais revenir
  ajouter();            // _id 4, pas 2
  supprimer(0);         // libère 0
  ajouter();            // _id 5, pas 0

  const ids = rows.map(r => r._id);
  assert.deepStrictEqual(ids, [1, 3, 4, 5],
    'aucun identifiant libéré par une suppression ne doit être réattribué');
  assert.strictEqual(new Set(ids).size, ids.length, 'les _id doivent rester deux à deux distincts');
});

test('suppression de ligne : les _id des lignes restantes ne changent jamais', () => {
  // C'est la propriété qui protège `parcelleLignesExclues`, indexé par _id :
  // une renumérotation ferait glisser un décochage sur la ligne voisine.
  const rows = [
    { _id: 0, idu: 'Z0068', surface: 0.24, situation: 'plantee' },
    { _id: 1, idu: 'Z0068', surface: 0.02, situation: 'plantee' },
    { _id: 2, idu: 'Z0069', surface: 0.13, situation: 'arrachee' }
  ];
  const apres = rows.filter(r => r._id !== 0);
  assert.deepStrictEqual(apres.map(r => r._id), [1, 2]);
  // ... et le compteur ne recule pas non plus.
  assert.strictEqual(OAD.prochainIdRegistre(apres), 3);
});

test('ligneRegistreVierge : valeurs par défaut assumées, âge de 10 ans, ligne Plantée sans idu', () => {
  const l = OAD.ligneRegistreVierge(2026, 12);
  assert.strictEqual(l._id, 12);
  assert.strictEqual(l.idu, '', 'idu vide : c\'est un identifiant CIVC, l\'outil n\'en invente pas');
  assert.strictEqual(l.commune, '');
  assert.strictEqual(l.cepage, 'CHARDONNAY B');
  assert.strictEqual(l.anneePlant, 2016, 'campagne − 10');
  assert.strictEqual(OAD.ageRegistre(l.anneePlant, 2026), 10);
  assert.strictEqual(l.surface, 0);
  assert.strictEqual(l.tauxManquant, 0);
  assert.strictEqual(l.situation, 'plantee');
  // Une ligne vierge n'apporte aucune surface : elle ne peut donc pas, à elle
  // seule, faire sortir l'écran 1 de son état bloquant.
  assert.strictEqual(OAD.agregerRegistreExploitation([l], 2026).surfTot, 0);
});

test('resoudreParcelleIdu : la parcelle désignée est conservée tant qu\'une ligne Plantée la porte', () => {
  const rows = [
    { _id: 0, idu: 'Z0068', situation: 'plantee' },
    { _id: 1, idu: 'Z0069', situation: 'plantee' }
  ];
  assert.strictEqual(OAD.resoudreParcelleIdu(rows, 'Z0069'), 'Z0069');
});

test('re-sélection automatique : supprimer la parcelle désignée retombe sur la première ligne Plantée restante', () => {
  const rows = [
    { _id: 0, idu: 'Z0068', situation: 'plantee' },
    { _id: 1, idu: 'Z0069', situation: 'plantee' },
    { _id: 2, idu: 'Z0157', situation: 'plantee' }
  ];
  const apres = rows.filter(r => r.idu !== 'Z0069');
  assert.strictEqual(OAD.resoudreParcelleIdu(apres, 'Z0069'), 'Z0068',
    'même règle qu\'au chargement initial : la première ligne Plantée restante');
  // Une ligne du même idu subsiste ailleurs dans le registre → rien ne bouge.
  const multi = [
    { _id: 0, idu: 'Z0068', situation: 'plantee' },
    { _id: 1, idu: 'Z0068', situation: 'plantee' }
  ];
  assert.strictEqual(OAD.resoudreParcelleIdu(multi.filter(r => r._id !== 1), 'Z0068'), 'Z0068');
});

test('resoudreParcelleIdu : plus aucune ligne Plantée → null, sans exception (registre vide ou tout arraché)', () => {
  assert.doesNotThrow(() => {
    assert.strictEqual(OAD.resoudreParcelleIdu([], 'Z0068'), null);
    assert.strictEqual(OAD.resoudreParcelleIdu(undefined, 'Z0068'), null);
    assert.strictEqual(OAD.resoudreParcelleIdu([{ _id: 0, idu: 'Z0068', situation: 'arrachee' }], 'Z0068'), null,
      'une ligne Arrachée ne peut pas être la parcelle désignée');
    assert.strictEqual(OAD.resoudreParcelleIdu([], null), null);
  });
});

test('surfTot = 0 (registre vide) : construireScenarios ne divise pas par la surface — pas de NaN, pas d\'exception', () => {
  // Garde-fou déjà présent dans simulerReserveKg (`surfProd === 0 ? 0 : …`),
  // au même titre que celui de trajectoireAge sur surfRest (section 10). Ce
  // test le FIGE : l'état bloquant de l'écran 1 (prompt B8) est un garde-fou
  // d'interface, il ne doit pas être la seule chose qui empêche le NaN.
  let sc;
  assert.doesNotThrow(() => { sc = OAD.construireScenarios({ ...INP_A, surfTot: 0, surfParc: 0 }); });
  const nombresFinis = (lignes) => lignes.every(l =>
    Object.keys(l).every(k => typeof l[k] !== 'number' || Number.isFinite(l[k])));
  ['arrachage', 'complantation', 'statuquo'].forEach(nom => {
    assert.ok(nombresFinis(sc[nom].kg), `couche kg du scénario ${nom} : aucun NaN ni Infinity`);
    assert.ok(nombresFinis(sc[nom].eur), `couche € du scénario ${nom} : aucun NaN ni Infinity`);
  });
  assert.strictEqual(sc.arrachage.kg[0].stockHa, 0,
    'stock par hectare sur une exploitation de 0 ha : 0, pas une division par zéro');
});

test('la saisie manuelle a bien disparu de l\'interface : plus de bouton, défaut sur le registre', () => {
  assert.ok(/sourceParcellaire:\s*'registre'/.test(INDEX_HTML),
    'le défaut de sourceParcellaire doit être « registre » — la saisie manuelle n\'existe plus');
  assert.ok(!/setSourceManuel/.test(INDEX_HTML),
    'le bouton « Saisie manuelle » et son gestionnaire doivent avoir disparu');
  assert.ok(!/!modeRegistre/.test(INDEX_HTML),
    'plus aucune branche « hors mode registre » ne doit subsister dans le gabarit');
});

section('20. Synthèse du registre pour le bandeau replié (prompt 3)');

test('synthetiseRegistre : nombre de lignes, surface totale, cépages distincts triés', () => {
  const rows = [
    { idu: 'A', cepage: 'CHARDONNAY B', surface: 0.05, situation: 'plantee' },
    { idu: 'B', cepage: 'MEUNIER N', surface: 0.21, situation: 'arrachee' },
    { idu: 'C', cepage: 'CHARDONNAY B', surface: 0.14, situation: 'plantee' },
    { idu: 'D', cepage: 'PINOT NOIR N', surface: 0.10, situation: 'plantee' }
  ];
  const r = OAD.synthetiseRegistre(rows);
  assert.strictEqual(r.nbLignes, 4);
  assert.ok(Math.abs(r.surfaceTotale - 0.5) < 1e-9,
    'la surface totale compte les lignes Arrachée, comme agregerRegistreExploitation : '
    + 'le bandeau doit annoncer la même surface que le champ « Surface totale » au-dessus de lui');
  assert.deepStrictEqual(r.cepages, ['CHARDONNAY B', 'MEUNIER N', 'PINOT NOIR N'],
    'cépages dédoublonnés et triés — un ordre stable évite que le bandeau se réécrive '
    + 'à chaque frappe dans une cellule sans rapport');
});

test('synthetiseRegistre : registre vide, cellules en cours de saisie, cépage absent', () => {
  assert.deepStrictEqual(OAD.synthetiseRegistre([]), { nbLignes: 0, surfaceTotale: 0, cepages: [] });
  assert.deepStrictEqual(OAD.synthetiseRegistre(undefined), { nbLignes: 0, surfaceTotale: 0, cepages: [] });
  // Une cellule que l'utilisateur est en train de vider porte '' ou '0,' :
  // elle ne doit ni rendre la surface NaN, ni ajouter un cépage vide.
  const r = OAD.synthetiseRegistre([
    { idu: 'A', cepage: '', surface: '', situation: 'plantee' },
    { idu: 'B', cepage: '   ', surface: '0,', situation: 'plantee' },
    { idu: 'C', cepage: 'MEUNIER N', surface: 0.3, situation: 'plantee' }
  ]);
  assert.strictEqual(r.nbLignes, 3);
  assert.ok(Number.isFinite(r.surfaceTotale) && Math.abs(r.surfaceTotale - 0.3) < 1e-9);
  assert.deepStrictEqual(r.cepages, ['MEUNIER N']);
});

test("le registre de l'étape 1 est replié par défaut, hors instantané localStorage", () => {
  assert.ok(/registreOuvert:\s*false/.test(INDEX_HTML),
    "state.registreOuvert doit exister et valoir false au chargement — c'est tout l'objet du prompt 3");
  const ecriture = INDEX_HTML.match(/function ecrireInstantane[\s\S]{0,600}?\n\}/);
  assert.ok(ecriture && !/registreOuvert/.test(ecriture[0]),
    "l'état d'ouverture du volet ne doit pas entrer dans l'instantané localStorage");
});

section('21. Phases de la parcelle renouvelée (prompts 5 et 7)');

test('anneeRetourProduction : repos + 3, exactement le returnYear de simulerReserveKg', () => {
  assert.strictEqual(OAD.anneeRetourProduction(1), 4);
  assert.strictEqual(OAD.anneeRetourProduction(2), 5);
  assert.strictEqual(OAD.anneeRetourProduction(3), 6);
  // Le chiffre de tête « Retour en production » ne doit jamais annoncer une
  // autre année que celle où le moteur remet la parcelle en production.
  [1, 2, 3].forEach(repos => {
    const sc = OAD.construireScenarios({ ...INP_A, repos, nbSortie: OAD.nbSortiePourRepos(repos) });
    const retour = OAD.anneeRetourProduction(repos);
    assert.strictEqual(sc.arrachage.kg[retour - 1].recolteParcelle, 0,
      `année ${retour - 1} : la parcelle ne produit pas encore`);
    assert.ok(sc.arrachage.kg[retour].recolteParcelle > 0,
      `année ${retour} : la parcelle produit`);
  });
});

test('phasesParcelle : découpe conforme à la convention de simulerReserveKg', () => {
  assert.deepStrictEqual(OAD.phasesParcelle(3, 10), [
    { id: 'arrachage', lib: 'arrachage', debut: 0, fin: 1 },
    { id: 'repos', lib: 'repos du sol', debut: 1, fin: 3 },
    { id: 'plantier', lib: 'plantier', debut: 3, fin: 6 },
    { id: 'production', lib: 'en production', debut: 6, fin: 11 }
  ]);
  // repos = 1 : la plantation a lieu dès l'année 1, il n'y a aucune année de
  // sol nu après celle de l'arrachage — le segment de durée nulle disparaît
  // plutôt que de produire une bande de largeur zéro à l'écran.
  const p1 = OAD.phasesParcelle(1, 10);
  assert.deepStrictEqual(p1.map(x => x.id), ['arrachage', 'plantier', 'production']);
  assert.strictEqual(p1[1].debut, 1);
  assert.strictEqual(p1[2].debut, 4);
});

test('phaseParAnnee : un identifiant par année, sur toute la largeur de l\'axe', () => {
  assert.deepStrictEqual(OAD.phaseParAnnee(3, 10),
    ['arrachage', 'repos', 'repos', 'plantier', 'plantier', 'plantier',
     'production', 'production', 'production', 'production', 'production']);
  assert.strictEqual(OAD.phaseParAnnee(2, 10).length, 11,
    'autant d\'entrées que de colonnes d\'année : la frise doit s\'aligner sur la graduation');
  // Horizon plus court que la transition : rien ne dépasse, rien ne manque.
  assert.strictEqual(OAD.phaseParAnnee(3, 4).length, 5);
  assert.deepStrictEqual(OAD.phasesParcelle(3, 4).map(x => x.id),
    ['arrachage', 'repos', 'plantier']);
});

section('22. Trésorerie cumulée exposée par le moteur (prompt 7)');

test('tresorerieCumulee : mêmes valeurs que le cumul assemblé jusqu\'ici dans index.html', () => {
  const sc = OAD.construireScenarios(INP_A);
  const fv = INP_A.fv;
  // Reproduction littérale de l'ancien code d'index.html, avant qu'il ne soit
  // remplacé par l'appel au moteur. C'est le seul but de ce test : figer que
  // le déplacement n'a rien changé au chiffre.
  const cum = a => { let acc = 0; return a.map(x => (acc += x)); };
  ['1', 'exp', 'prop'].forEach(vue => {
    const ancienEnsemble = cum(sc.arrachage.eur.map(row => {
      if (vue === '1') return row.cashNet;
      const p = OAD.repartir(row, fv);
      return vue === 'exp' ? p.exp : p.prop;
    }));
    assert.deepStrictEqual(OAD.tresorerieCumulee(sc.arrachage, fv, vue).cumulee, ancienEnsemble,
      `vue ${vue} — trésorerie de l'ensemble de l'exploitation`);

    const ancienParcelle = cum(sc.arrachage.eur.map(row => {
      if (vue === '1') return row.venteRaisinParcelle + row.cashRI - row.coutsParcelle;
      const p = OAD.repartir({ ...row, venteRaisinReste: 0, coutsReste: 0 }, fv);
      return vue === 'exp' ? p.exp : p.prop;
    }));
    assert.deepStrictEqual(
      OAD.tresorerieCumulee(sc.arrachage, fv, vue, { parcelleSeule: true }).cumulee, ancienParcelle,
      `vue ${vue} — parcelle seule`);
  });
});

test('tresorerieCumulee : le cumul est bien le cumul de l\'annuelle, et rien n\'est muté', () => {
  const sc = OAD.construireScenarios(INP_A);
  const avant = JSON.stringify(sc.arrachage.eur);
  const r = OAD.tresorerieCumulee(sc.arrachage, INP_A.fv, '1', { parcelleSeule: true });
  assert.strictEqual(r.cumulee.length, sc.arrachage.eur.length);
  r.cumulee.forEach((v, t) => {
    const attendu = r.annuelle.slice(0, t + 1).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(v - attendu) < 1e-6, `cumul de l'année ${t}`);
  });
  assert.strictEqual(JSON.stringify(sc.arrachage.eur), avant,
    'tresorerieCumulee ne doit muter ni le scénario ni ses lignes');
});

section('23. Écran de résultats en onglets (prompts 8 et 9)');

test("les cinq blocs sont devenus cinq onglets, et « Bloc N » a disparu", () => {
  assert.ok(!/Bloc [1-5] ·/.test(INDEX_HTML),
    'les intitulés « Bloc 1 » à « Bloc 5 » numérotaient l\'ordre du code : ils ne doivent plus être affichés');
  assert.strictEqual((INDEX_HTML.match(/role="tabpanel"/g) || []).length, 5,
    'cinq panneaux, un par onglet');
  assert.ok(/role="tablist"/.test(INDEX_HTML) && /role="tab"/.test(INDEX_HTML),
    'la barre d\'onglets doit être annoncée aux technologies d\'assistance');
  ['Coût, poste par poste', 'Réserve individuelle', "Main d'œuvre et charges",
   'Ce qui est replanté', 'Rajeunissement du vignoble'].forEach(lib => {
    assert.ok(INDEX_HTML.indexOf(lib) >= 0, 'libellé d\'onglet présent : ' + lib);
  });
});

test("l'onglet actif est un état d'interface, hors instantané localStorage", () => {
  assert.ok(/ongletResultat:\s*0/.test(INDEX_HTML),
    'state.ongletResultat doit exister et démarrer sur le premier onglet');
  const ecriture = INDEX_HTML.match(/function ecrireInstantane[\s\S]{0,600}?\n\}/);
  assert.ok(ecriture && !/ongletResultat/.test(ecriture[0]),
    "l'onglet actif ne doit pas entrer dans l'instantané localStorage");
});

test('prompt 9 : les graphiques sont ouverts par défaut, leurs boutons de repli conservés', () => {
  assert.ok(/stockChartOuvert:\s*true/.test(INDEX_HTML) && /ageChartOuvert:\s*true/.test(INDEX_HTML),
    "l'information la plus lisible ne doit plus être celle qui est cachée");
  assert.ok(/toggleStockChart/.test(INDEX_HTML) && /toggleAgeChart/.test(INDEX_HTML),
    'les boutons de repli restent : ouvert par défaut ne veut pas dire imposé');
});

section('24. Panneau « Hypothèses » (prompt 10)');

test('les 36 contrôles liés à state.v sont toujours présents, une fois et une seule', () => {
  const cles = ['volco', 'prixKg', 'campagne', 'riPct', 'coutSurfaceProdHaAn', 'coutRdtParKg',
    'tauxHoraire', 'ecartRang', 'ecartPied', 'rendEstime', 'regime', 'nbRangs', 'loyerHa',
    'partRecolte', 'partCouts', 'cepage', 'calcaireActif', 'profondeurSol', 'drainageSol',
    'materiel', 'porteGreffe', 'typeTaille', 'nbFils', 'espPiquet', 'anneePleineProd',
    'repos', 'coutArrachageHa', 'coutPlant', 'coutPalissageHa', 'coutProtectionHa',
    'irrigation', 'coutIrrigHa', 'coutReposHaAn', 'coutPlantierHaAn', 'sequence', 'declinSQ'];
  cles.forEach(k => {
    const n = (INDEX_HTML.match(new RegExp('on\\.' + k + ' \\}\\}', 'g')) || []).length;
    assert.strictEqual(n, 1, 'le contrôle « ' + k + ' » doit rester saisissable, exactement une fois');
  });
});

test("le panneau Hypothèses est un état d'interface ; ses valeurs restent dans state.v", () => {
  assert.ok(/hypothesesOuvert:\s*false/.test(INDEX_HTML),
    'state.hypothesesOuvert doit exister et démarrer fermé');
  const ecriture = INDEX_HTML.match(/function ecrireInstantane[\s\S]{0,600}?\n\}/);
  assert.ok(ecriture && !/hypothesesOuvert/.test(ecriture[0]),
    "l'ouverture du panneau ne doit pas entrer dans l'instantané localStorage");
  assert.ok(/id="hypotheses-ouvrir"/.test(INDEX_HTML) && /id="hypotheses-fermer"/.test(INDEX_HTML),
    'le panneau doit avoir un point d\'entrée permanent et un bouton de fermeture, pour la discipline de focus');
});

test('reprendre les valeurs de référence ne porte que sur les postes préréglés', () => {
  const bloc = INDEX_HTML.match(/const HYPOTHESES_SECTIONS = \{[\s\S]*?\};/);
  assert.ok(bloc, 'les sections du panneau doivent être déclarées en un seul endroit');
  ['surfArr', 'ageParc', 'rendEstime', 'volco', 'prixKg', 'repos'].forEach(k => {
    assert.ok(bloc[0].indexOf("'" + k + "'") < 0,
      'une saisie qui décrit la parcelle ou le projet (' + k + ') ne doit jamais être remise '
      + 'à zéro par « Reprendre les valeurs de référence »');
  });
});

section('25. Parcours en trois temps (prompt 11)');

test('le parcours compte trois temps, et state.step ne dépasse plus 2', () => {
  assert.ok(/const labels = \['La parcelle', 'Le projet', 'La trajectoire'\]/.test(INDEX_HTML),
    'trois temps, nommés par le moment d\'entretien auquel ils correspondent');
  assert.ok(/aSuivant: s\.step < 2/.test(INDEX_HTML) && /step: Math\.min\(2, st\.step \+ 1\)/.test(INDEX_HTML),
    'la navigation doit être bornée à 2, pas à 4');
  assert.ok(/allerResultats: \(\) => this\.setState\(\{ step: 2 \}\)/.test(INDEX_HTML),
    'le raccourci « aller aux résultats » doit viser le temps 3');
  assert.ok(!/SUR 5</.test(INDEX_HTML), 'plus aucun « ÉTAPE N SUR 5 » à l\'écran');
});

test("l'instantané localStorage ne contient pas step : aucune migration nécessaire", () => {
  const ecriture = INDEX_HTML.match(/function ecrireInstantane[\s\S]{0,600}?\n\}/);
  assert.ok(ecriture, 'ecrireInstantane doit exister');
  assert.ok(!/\bstep\b/.test(ecriture[0]),
    "step n'entre pas dans l'instantané — un instantané écrit par la version à cinq "
    + "étapes se recharge donc tel quel, sans valeur de step à ramener dans 0..2");
});

test('les cinq écrans deviennent cinq sections réparties sur trois temps', () => {
  assert.ok(/estEtape0: s\.step === 0, estEtape1: s\.step === 0, estEtape2: s\.step === 1,/.test(INDEX_HTML)
    && /estEtape3: s\.step === 1, estEtape4: s\.step === 2,/.test(INDEX_HTML),
    'exploitation + parcelle sur le temps 1, plantation + coûts sur le temps 2, résultats sur le temps 3');
  // Les onze repères pointent vers un temps, plus vers un écran sur cinq :
  // un repère qui viserait l'étape 3 emmènerait désormais hors du parcours.
  const bloc = INDEX_HTML.match(/const REPERES_CHEMIN_COURT = \[[\s\S]*?\];/)[0];
  const etapes = (bloc.match(/etape: (\d)/g) || []).map(x => +x.slice(-1));
  assert.strictEqual(etapes.length, 11, 'onze repères');
  assert.ok(etapes.every(e => e >= 0 && e <= 2), 'aucun repère ne doit viser un temps inexistant');
});

section('26. Densité et bornes AOC, mètres de rang (prompt 12)');

test('conformiteDensiteAOC : bornes 8 000 / 10 000 pieds/ha, inclusives', () => {
  assert.deepStrictEqual(OAD.conformiteDensiteAOC(9000),
    { densite: 9000, ok: true, sens: null, min: 8000, max: 10000 });
  assert.strictEqual(OAD.conformiteDensiteAOC(8000).ok, true, 'la borne basse est incluse');
  assert.strictEqual(OAD.conformiteDensiteAOC(10000).ok, true, 'la borne haute est incluse');
  assert.strictEqual(OAD.conformiteDensiteAOC(7999).sens, 'sous');
  assert.strictEqual(OAD.conformiteDensiteAOC(10001).sens, 'au-dessus');
  // `sens` existe pour que l'écran puisse dire CE QUI CLOCHE, pas seulement
  // « non conforme ». Le contrôle ne bloque pas la saisie.
  assert.strictEqual(OAD.conformiteDensiteAOC(0).sens, 'sous');
});

test('la densité par défaut de l\'outil tombe bien dans les bornes AOC', () => {
  // écart rang 1,00 m × écart pied 1,10 m -> 9 090 pieds/ha
  const g = OAD.geometrieAgronomique(1, 1, 1.10, 100);
  assert.strictEqual(g.densite, 9091);
  assert.strictEqual(OAD.conformiteDensiteAOC(g.densite).ok, true);
});

test('metresDeRang : nombre de rangs × longueur de rang déduite', () => {
  const g = OAD.geometrieAgronomique(1, 1, 1.10, 100);
  assert.ok(Math.abs(OAD.metresDeRang(g) - g.nbRangs * g.L) < 1e-9);
  assert.ok(Math.abs(OAD.metresDeRang(g) - 10000) < 1e-6,
    '1 ha à 1 m d\'écart entre rangs : 10 000 m de rang, quel que soit le nombre de rangs');
  assert.strictEqual(OAD.metresDeRang(null), 0, 'pas de géométrie, pas de longueur — et pas d\'exception');
});

test('le schéma de parcelle est branché, et le volet « Ajuster » vidé a disparu', () => {
  assert.ok(/schemaParcelle\(d\)/.test(INDEX_HTML),
    'le schéma est construit en React.createElement, pas dans le gabarit');
  assert.ok(/\{\{ schemaParcelle \}\}/.test(INDEX_HTML), 'et il est bien affiché');
  assert.ok(/\{\{ densiteTxt \}\}/.test(INDEX_HTML),
    'la ligne de vérification de densité doit être à l\'écran');
  assert.ok(!/ajusterOuvert2/.test(INDEX_HTML),
    'un volet « Ajuster » qui n\'a plus rien à contenir ne reste pas à l\'écran, '
    + 'et ses valeurs dérivées non plus');
  assert.ok(/for="f-nbRangs"/.test(INDEX_HTML),
    'le nombre de rangs reste saisissable — remonté dans la carte Géométrie');
});

section('27. Thème sombre de projection (prompt 13)');

test('aucune couleur littérale ne subsiste dans le gabarit', () => {
  const debut = INDEX_HTML.indexOf('</helmet>');
  const fin = INDEX_HTML.indexOf('</x-dc>');
  const gabarit = INDEX_HTML.slice(debut, fin);
  const litterales = (gabarit.match(/#[0-9a-fA-F]{3,6}\b/g) || [])
    .filter(c => c.toLowerCase() !== '#000');
  assert.deepStrictEqual(litterales, [],
    'toutes les couleurs du gabarit passent par un jeton var(--…) ; seul #000, '
    + 'dans la fiche imprimée, reste littéral — on n\'imprime pas un aplat sombre');
});

test('les jetons sont déclarés sur :root et basculés par data-theme', () => {
  assert.ok(/:root\{[\s\S]*?--encre:/.test(INDEX_HTML), 'le thème clair est le défaut, sur :root');
  assert.ok(/:root\[data-theme="sombre"\]\{/.test(INDEX_HTML),
    'le thème sombre redéfinit les mêmes jetons sous un attribut de la racine');
  assert.ok(/document\.documentElement\.setAttribute\('data-theme'/.test(INDEX_HTML),
    "l'attribut est posé depuis le composant : rien dans <x-dc> ne peut atteindre <html>");
  // Les deux thèmes doivent définir exactement les mêmes jetons, sinon un
  // basculement laisse une couleur du thème clair sur un fond sombre.
  const clair = INDEX_HTML.match(/:root\{([\s\S]*?)\}/)[1];
  const sombre = INDEX_HTML.match(/:root\[data-theme="sombre"\]\{([\s\S]*?)\}/)[1];
  const jetons = t => (t.match(/--[a-z0-9-]+:/g) || []).sort();
  assert.deepStrictEqual(jetons(sombre), jetons(clair),
    'chaque jeton du thème clair doit avoir sa valeur sombre, et réciproquement');
});

test('le thème entre dans l\'instantané localStorage, le mode clair reste le défaut', () => {
  const ecriture = INDEX_HTML.match(/function ecrireInstantane[\s\S]{0,700}?\n\}/);
  assert.ok(ecriture && /theme/.test(ecriture[0]),
    'on ne veut pas rebasculer le thème à chaque ouverture en salle');
  assert.ok(/instantane\.theme === THEMES\.sombre\) \? THEMES\.sombre : THEMES\.clair/.test(INDEX_HTML),
    'un instantané antérieur à ce prompt, ou porteur d\'une valeur inconnue, retombe sur le clair');
});

section('28. Deux sorties d\'impression (prompt 14)');

test('deux sorties distinctes, désignées par data-print sur la racine', () => {
  assert.ok(/class="print-remise"/.test(INDEX_HTML) && /class="print-sheet"/.test(INDEX_HTML),
    'la remise au vigneron et la fiche d\'audit sont deux blocs distincts');
  assert.ok(/imprimerRemise/.test(INDEX_HTML) && /imprimerAudit/.test(INDEX_HTML),
    'deux boutons, deux publics');
  assert.ok(!/imprimerFiche/.test(INDEX_HTML), 'le bouton unique d\'avant a disparu');
  assert.ok(/:root\[data-print="vigneron"\] \.print-remise/.test(INDEX_HTML)
    && /:root:not\(\[data-print="vigneron"\]\) \.print-sheet/.test(INDEX_HTML),
    'une sortie à la fois ; sans attribut (Ctrl+P au clavier) c\'est la fiche exhaustive');
});

test('la remise au vigneron tient sur une page, en vectoriel et en couleur', () => {
  const bloc = INDEX_HTML.match(/:root\[data-print="vigneron"\] \.print-remise \{[\s\S]*?\}/)[0];
  assert.ok(/page-break-inside:avoid/.test(bloc) && /break-inside:avoid/.test(bloc),
    'une seule page, c\'est sa contrainte de conception');
  assert.ok(/print-color-adjust:exact/.test(bloc),
    'la frise est son contenu : en niveaux de gris elle ne dit plus rien');
  assert.ok(/@page \{ size: A4 portrait/.test(INDEX_HTML), 'A4 portrait');
  // La frise est un SVG construit en React, jamais une image : elle s'imprime
  // donc en vectoriel sans qu'on ait rien à demander.
  const remise = INDEX_HTML.slice(INDEX_HTML.indexOf('class="print-remise"'));
  assert.ok(remise.indexOf('{{ friseTrajectoire }}') >= 0
    && remise.indexOf('{{ friseTrajectoire }}') < remise.indexOf('class="print-sheet"'),
    'la frise doit être présente dans la sortie remise');
});

test('la synthèse imprimée est assemblée des mêmes morceaux que celle de l\'écran', () => {
  const debut = INDEX_HTML.indexOf('out.syntheseTxt =');
  assert.ok(debut > 0, "la version texte plat de la synthèse doit exister");
  const bloc = INDEX_HTML.slice(debut, debut + 900);
  ['syntheseCouvTxt', 'syntheseCouvSuffixTxt', 'syntheseAbsorptionTxt',
   'syntheseStockLeadTxt', 'syntheseStockTailTxt', 'syntheseHorizonTxt',
   'reserveReelleTxt', 'investTxt', 'effortNetTxt', 'stockMinTxt'].forEach(k => {
    assert.ok(bloc.indexOf('out.' + k) >= 0,
      'la fiche remise au vigneron ne doit pas raconter autre chose que l\'écran : ' + k);
  });
});

// ----------------------------------------------------------------------
// Bilan
// ----------------------------------------------------------------------

console.log(`\n${passed} ok, ${failed} FAIL, ${skipped} skip`);
if (failed > 0) process.exit(1);
