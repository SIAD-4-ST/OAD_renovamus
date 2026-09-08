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
// Section 8 bis — Faire-valoir porté par le registre parcellaire.
//
// Le régime de faire-valoir se saisissait dans un bloc à part, au bas du
// temps 1, et valait pour toute la parcelle désignée. C'était une
// approximation : une exploitation possède telle parcelle et loue telle
// autre. Il est désormais une propriété de CHAQUE ligne du registre, portée
// par la colonne `mode_explo` que le format d'export CIVC prévoyait déjà
// sans que rien ne la lise. Le régime qui entre dans le calcul en est
// dérivé — dominant en surface parmi les lignes retenues.
// ----------------------------------------------------------------------

test('normaliserRegimeFv : code CIVC, libellé en toutes lettres et clé interne désignent la même chose', () => {
  ['FD', 'fd', 'P', 'Propriété', 'propriete', 'faire-valoir direct'].forEach(x =>
    assert.strictEqual(OAD.normaliserRegimeFv(x), 'propriete', `« ${x} » doit valoir propriete`));
  ['FE', 'fer', 'Fermage', 'fermage', 'FERMAGE'].forEach(x =>
    assert.strictEqual(OAD.normaliserRegimeFv(x), 'fermage', `« ${x} » doit valoir fermage`));
  ['MET', 'Métayage', 'metayage', 'METAYAGE'].forEach(x =>
    assert.strictEqual(OAD.normaliserRegimeFv(x), 'metayage', `« ${x} » doit valoir metayage`));
});

test('faire-valoir absent, vide ou inconnu → propriété : à défaut d’information, aucun prélèvement inventé', () => {
  [undefined, null, '', '   ', 'XYZ', 0].forEach(x =>
    assert.strictEqual(OAD.normaliserRegimeFv(x), 'propriete'));
  // Le jeu de test historique ne porte aucun `modeExplo` : il doit continuer
  // à produire exactement le résultat d'avant ce chantier, régime compris.
  const lignes = REGISTRE_TEST.filter(r => r.idu === 'Z0068' && r.situation === 'plantee');
  const a = OAD.agregerRegistreParcelle(lignes, CAMPAGNE_TEST);
  assert.strictEqual(a.regime, 'propriete');
  assert.strictEqual(a.regimeMixte, false);
});

test('le régime retenu est le dominant EN SURFACE, pas en nombre de lignes', () => {
  // Deux lignes en fermage (0,02 ha à elles deux) contre une en métayage
  // (0,30 ha) : c'est le métayage qui commande, parce que c'est lui qui porte
  // les flux que `repartir` découpe entre exploitant et propriétaire.
  const lignes = [
    { cepage: 'CHARDONNAY B', anneePlant: 2000, surface: 0.01, tauxManquant: 0, modeExplo: 'FE' },
    { cepage: 'CHARDONNAY B', anneePlant: 2000, surface: 0.01, tauxManquant: 0, modeExplo: 'FE' },
    { cepage: 'CHARDONNAY B', anneePlant: 2000, surface: 0.30, tauxManquant: 0, modeExplo: 'MET' }
  ];
  const a = OAD.agregerRegistreParcelle(lignes, CAMPAGNE_TEST);
  assert.strictEqual(a.regime, 'metayage');
  assert.strictEqual(a.regimeMixte, true, 'une sélection à régimes mêlés doit être signalée, pas tue');
});

test('sélection homogène : aucun signalement de faire-valoir mixte', () => {
  const lignes = [
    { cepage: 'CHARDONNAY B', anneePlant: 2000, surface: 0.10, tauxManquant: 0, modeExplo: 'FE' },
    { cepage: 'CHARDONNAY B', anneePlant: 2000, surface: 0.20, tauxManquant: 0, modeExplo: 'fermage' }
  ];
  const a = OAD.agregerRegistreParcelle(lignes, CAMPAGNE_TEST);
  assert.strictEqual(a.regime, 'fermage');
  assert.strictEqual(a.regimeMixte, false, '« FE » et « fermage » sont le même régime écrit deux fois');
});

test('sélection vide → propriété, sans exception ni régime fantôme', () => {
  const a = OAD.agregerRegistreParcelle([], CAMPAGNE_TEST);
  assert.strictEqual(a.regime, 'propriete');
  assert.strictEqual(a.regimeMixte, false);
});

test('égalité parfaite de surface : le régime retenu est stable d’un rendu à l’autre', () => {
  // Deux régimes à surface strictement égale ne doivent pas faire dépendre le
  // résultat de l'ordre des lignes : l'utilisateur verrait le régime changer
  // en réordonnant son registre sans rien y corriger.
  const a = { cepage: 'C', anneePlant: 2000, surface: 0.5, tauxManquant: 0, modeExplo: 'FE' };
  const b = { cepage: 'C', anneePlant: 2000, surface: 0.5, tauxManquant: 0, modeExplo: 'MET' };
  assert.strictEqual(OAD.agregerRegistreParcelle([a, b], CAMPAGNE_TEST).regime,
    OAD.agregerRegistreParcelle([b, a], CAMPAGNE_TEST).regime);
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

 /* Le CODE seul, commentaires retirés. Plusieurs tests portent sur ce qui est
    ÉCRIT ET EXÉCUTÉ, jamais sur le fichier entier : les commentaires du dépôt
    citent volontairement les noms et les blocs supprimés, pour documenter les
    arbitrages successifs, et un test qui lirait le fichier brut échouerait sur
    sa propre documentation. Déclaré ici, juste sous INDEX_HTML, parce que les
    sections 28 et suivantes en ont besoin. */
const CODE_SANS_COMMENTAIRES = INDEX_HTML
  .replace(/\/\*[\s\S]*?\*\//g, ' ')      // blocs /* … */ (script)
  .replace(/^[ \t]*\/\/.*$/gm, ' ')       // lignes // … (script)
  .replace(/<!--[\s\S]*?-->/g, ' ');      // commentaires HTML (template)

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

section("23. Écran de résultats par thème et par année (refonte du 08/09/2026)");

/* Cette section figeait le contraire : « les cinq blocs sont devenus cinq
   onglets ». Les onglets sont supprimés, et les attentes sont inversées
   VOLONTAIREMENT — ce n’est pas une mise à jour silencieuse d’un chiffre
   attendu, c’est un arbitrage daté (README §18bis / §19ter).

   POURQUOI. Les cinq onglets rangeaient l’écran par BLOC DE CODE (« Coût,
   poste par poste », « Réserve individuelle », « Main d’œuvre et charges »,
   « Ce qui est replanté », « Rajeunissement du vignoble ») et n’en montraient
   qu’un à la fois. Un conseiller ne peut pas expliquer une trajectoire en
   dépliant cinq onglets l’un après l’autre, et rien à l’écran ne disait qu’il
   en restait quatre. Le contenu est réparti par THÈME — six thèmes, ceux des
   six pistes de la frise — et tout est visible d’un seul défilement. */
test("les cinq onglets ont disparu, avec leur état et leur navigation clavier", () => {
  assert.ok(!/role="tablist"/.test(INDEX_HTML) && !/role="tabpanel"/.test(INDEX_HTML),
    "plus aucun jeu d’onglets à l’écran de résultats");
  // Sur le CODE, pas sur le fichier : les commentaires citent volontairement
  // l'ancien nom pour documenter ce qui le remplace (même procédé qu'aux
  // chantiers C2 et C3).
  assert.ok(!/ongletResultat/.test(CODE_SANS_COMMENTAIRES),
    "l’état de l’onglet actif est supprimé, pas seulement masqué");
  assert.ok(!/ongletsClavier|onglet-btn-|onglet-panneau-/.test(CODE_SANS_COMMENTAIRES),
    "la navigation clavier des onglets disparaît avec eux");
  // Le contenu, lui, ne disparaît pas : chaque onglet a un point de chute.
  ["poste par poste", "Entretien — le détail par régime de travail",
   "Surface renouvelée", "Détail annuel par thème"].forEach(ancre => {
    assert.ok(INDEX_HTML.indexOf(ancre) >= 0,
      "le contenu de l’ancien onglet doit rester à l’écran : " + ancre);
  });
});

test("l’année retenue est un état d’interface, hors instantané localStorage", () => {
  assert.ok(/anneeFrise:\s*0/.test(INDEX_HTML),
    "state.anneeFrise doit exister et démarrer sur l’année 0, celle de l’arrachage");
  const ecriture = INDEX_HTML.match(/function ecrireInstantane[\s\S]{0,600}?\n\}/);
  assert.ok(ecriture && !/anneeFrise/.test(ecriture[0]),
    "l’année retenue ne doit pas entrer dans l’instantané localStorage — c’est de la navigation, comme l’étape courante et les volets");
  assert.ok(/this\.setState\(\{ anneeFrise: t \}\)/.test(INDEX_HTML),
    "l’axe de la frise et la matrice écrivent le même état : une seule année retenue à l’écran");
});

/* Suppression du 08/09/2026 — la carte « Ce que le renouvellement produit » a
   quitté le temps 3 sur demande explicite : ses trois KPI (écart d'âge, réserve
   à l'horizon, réserve minimale) doublonnaient les chiffres de tête et la carte
   de thème « Réserve », et les deux graphiques repliables du prompt 9 qu'elle
   portait sont partis avec elle. Le test du prompt 9 (« ouverts par défaut,
   boutons de repli conservés ») n'a donc plus d'objet ; il devient le garde-fou
   de la suppression, pour qu'un chantier ultérieur ne réintroduise pas la carte
   sans décision. Ce qui reste vrai et testé ailleurs : la réserve à l'horizon et
   son plancher restent affichés — dans la phrase de synthèse et sur la fiche
   d'audit (voir ADJACENCE, section 32). */
test("la carte « Ce que le renouvellement produit » et ses deux graphiques ont quitté le temps 3", () => {
  assert.ok(!/Ce que le renouvellement produit/.test(CODE_SANS_COMMENTAIRES),
    'le titre de la carte ne doit plus être rendu (les mentions restantes sont des commentaires historiques)');
  for (const nom of ['chartStock', 'chartAge', 'ageLegendItems',
                     'stockChartOuvert', 'ageChartOuvert', 'toggleStockChart', 'toggleAgeChart',
                     'kpiReserveHorizon', 'kpiReserveMin', 'kpiEcartAge']) {
    assert.ok(!new RegExp(nom).test(CODE_SANS_COMMENTAIRES),
      '« ' + nom + ' » est parti avec la carte : ni état, ni exposition au gabarit, ni construction dans renderVals()');
  }
});

section('24. Panneau « Hypothèses » (prompt 10)');

/* 36 → 35 : `campagne` a été retiré des saisies. La campagne de référence des
   âges du registre est désormais toujours l'année en cours (CAMPAGNE_COURANTE
   dans index.html) ; le champ « Campagne de référence » du temps 1, dernier
   occupant du volet « Ajuster » de cet écran, a disparu avec lui. Ce n'est pas
   une perte de contrôle à rattraper mais une simplification demandée : le test
   suivant garde la porte fermée.

   35 → 34 : `regime` a quitté `state.v` à son tour (prompt « faire-valoir au
   registre »). Le régime de faire-valoir ne se saisit plus dans un bloc au bas
   du temps 1, valable pour toute la parcelle : il est porté par CHAQUE ligne du
   registre parcellaire (colonne « Faire-valoir », `mode_explo` du format CIVC),
   et celui qui entre dans le calcul en est dérivé — dominant en surface parmi
   les lignes retenues, comme la surface et l'âge le sont déjà. Ce n'est donc pas
   un contrôle perdu mais un contrôle déplacé, et rendu plus fin ; le test qui
   suit vérifie qu'il n'est pas rouvert ailleurs. `loyerHa`, `partRecolte` et
   `partCouts` restent des saisies : ce sont des montants, pas un régime. */
/* 33 → 32 : `declinSQ` n'est plus SAISISSABLE (refonte du temps 3, 08/09/2026).
   Le volet « Hypothèses de comparaison » qui le portait a été retiré avec le
   différentiel et la cascade, seuls affichages qu'il pilotait : un champ dont
   on ne voit plus l'effet est un champ qui invite à régler au hasard.

   Ce n'est PAS un contrôle déplacé, comme l'étaient `regime` et `materiel` :
   c'est un contrôle SUPPRIMÉ. La clé reste dans `state.v` et dans `inp` — le
   moteur la lit pour bâtir `sc.reference`, dont dépend `reserveHorizon`, encore
   affichée — et la fiche d'audit continue d'en donner la valeur, marquée
   « NON SAISISSABLE ». Le test ci-dessous garde les deux portes : celle du
   champ, fermée, et celle de l'état, ouverte. */
test('les 32 contrôles liés à state.v sont toujours présents, une fois et une seule', () => {
  const cles = ['volco', 'prixKg', 'riPct', 'coutSurfaceProdHaAn', 'coutRdtParKg',
    'tauxHoraire', 'ecartRang', 'ecartPied', 'rendEstime', 'nbRangs', 'loyerHa',
    'partRecolte', 'partCouts', 'cepage', 'calcaireActif', 'profondeurSol', 'drainageSol',
    'porteGreffe', 'typeTaille', 'nbFils', 'espPiquet', 'anneePleineProd',
    'repos', 'coutArrachageHa', 'coutPlant', 'coutPalissageHa', 'coutProtectionHa',
    'irrigation', 'coutIrrigHa', 'coutReposHaAn', 'coutPlantierHaAn', 'sequence'];
  cles.forEach(k => {
    const n = (INDEX_HTML.match(new RegExp('on\\.' + k + ' \\}\\}', 'g')) || []).length;
    assert.strictEqual(n, 1, 'le contrôle « ' + k + ' » doit rester saisissable, exactement une fois');
  });
  assert.ok(!/on\.declinSQ \}\}/.test(INDEX_HTML) && !/id="f-declinSQ"/.test(INDEX_HTML),
    'declinSQ ne doit plus être saisissable : le champ a été retiré avec le différentiel qu\'il pilotait');
  const defautsDecl = INDEX_HTML.match(/const V_DEFAUTS = \{[\s\S]*?\n\};/);
  assert.ok(defautsDecl && /\bdeclinSQ:/.test(defautsDecl[0]),
    'declinSQ reste dans V_DEFAUTS : le moteur la lit, elle n\'est simplement plus saisie');
  assert.ok(/declinSQ: \(\+v\.declinSQ \|\| 0\) \/ 100/.test(INDEX_HTML),
    'declinSQ doit continuer d\'être passée au moteur, dans `inp`');
  assert.ok(/NON SAISISSABLE/.test(INDEX_HTML),
    'la fiche d\'audit doit dire que ce paramètre n\'est plus saisissable, sans quoi son lecteur cherchera un champ qui n\'existe plus');
  assert.ok(!/on\.regime \}\}/.test(INDEX_HTML) && !/id="f-regime"/.test(INDEX_HTML),
    'le régime de faire-valoir ne doit pas rouvrir un champ global : il se corrige au registre, ligne par ligne');
  const defauts = INDEX_HTML.match(/const V_DEFAUTS = \{[\s\S]*?\n\};/);
  assert.ok(defauts && !/\bregime:/.test(defauts[0]),
    'rien à persister sous `regime` : la valeur est dérivée du registre à chaque rendu');
  /* 34 → 33 : `materiel` a quitté state.v à son tour (chantier « matériel
     végétal en une seule liste »). Le sélecteur « vinifera / Voltis » et le
     sélecteur « cépage » vivaient côte à côte sans qu'aucun ne contraigne
     l'autre : rien n'empêchait de retenir « vinifera » ET « Voltis ». Il n'y a
     plus qu'une liste — les 11 variétés plantables — portée par `cepage`, et la
     NATURE du matériel (vinifera / VIFA) en est dérivée par la table VARIETES.
     Ce n'est donc pas un contrôle perdu mais deux contrôles fusionnés, et une
     incohérence rendue impossible. Comme `regime`, le test qui suit vérifie
     qu'il n'est pas rouvert ailleurs. */
  assert.ok(!/on\.materiel \}\}/.test(INDEX_HTML) && !/id="f-materiel"/.test(INDEX_HTML),
    'la nature du matériel végétal ne doit pas rouvrir un champ à elle : elle se déduit de la variété');
  assert.ok(defauts && !/\bmateriel:/.test(defauts[0]),
    'rien à persister sous `materiel` : la valeur est dérivée de la variété à chaque rendu');
  assert.ok(/const VARIETES = \[/.test(INDEX_HTML) && /vifa: true/.test(INDEX_HTML),
    'la table des variétés, et le drapeau VIFA dont la nature du matériel est dérivée');
});

/* Suite de la section 8 bis — faire-valoir porté par le registre. Ces deux
   tests-ci lisent le gabarit : ils vivent donc après la déclaration de
   INDEX_HTML, et non auprès des tests de moteur de la section 8 bis. */
test('le faire-valoir est branché au registre dans le gabarit, et nulle part ailleurs', () => {
  assert.ok(/<div class="th wide">Faire-valoir<\/div>/.test(INDEX_HTML),
    'la colonne « Faire-valoir » doit exister dans le registre parcellaire');
  assert.ok(/r\.regimeFv \}\}/.test(INDEX_HTML) && /r\.onRegimeFv \}\}/.test(INDEX_HTML),
    'la cellule doit être saisissable ligne par ligne');
  assert.ok(/majCelluleRegistre\(r\._id, 'modeExplo'/.test(INDEX_HTML),
    'la saisie doit écrire dans la colonne mode_explo du registre, pas dans un état parallèle');
  assert.ok(/regimeParcRegistreTxt/.test(INDEX_HTML) && /regimeMixteTxt/.test(INDEX_HTML),
    'le temps 1 doit afficher le régime dérivé et signaler une sélection mixte');
  assert.ok(!/Faire-valoir de la parcelle<\/h3>/.test(INDEX_HTML),
    'le bloc « Faire-valoir de la parcelle » du bas du temps 1 a disparu : la saisie est au registre');
  assert.ok(/fv: \{ regime: regimeParcelle,/.test(INDEX_HTML),
    'le moteur doit recevoir le régime dérivé du registre, jamais une saisie globale');
});

test('le jeu de registre d’exemple renseigne mode_explo sur toutes ses lignes', () => {
  const csv = INDEX_HTML.match(/const REGISTRE_EXEMPLE_CSV = `([^`]*)`/)[1];
  const lignes = csv.trim().split('\n');
  const iMode = lignes[0].split(';').indexOf('mode_explo');
  assert.ok(iMode >= 0, 'la colonne mode_explo doit rester au format');
  lignes.slice(1).forEach((l, i) => {
    const val = l.split(';')[iMode].trim();
    assert.ok(val.length > 0, `ligne ${i + 1} : mode_explo ne doit plus être vide`);
    assert.strictEqual(OAD.normaliserRegimeFv(val), 'propriete',
      `ligne ${i + 1} : l'exemple reste en faire-valoir direct — un fermage inventé changerait le résultat par défaut`);
  });
});

test("la campagne de référence n'est plus une saisie : toujours l'année en cours", () => {
  assert.ok(/const CAMPAGNE_COURANTE = new Date\(\)\.getFullYear\(\);/.test(INDEX_HTML),
    "la campagne doit être une constante dérivée de l'horloge, en un seul endroit");
  assert.ok(!/on\.campagne/.test(INDEX_HTML) && !/id="f-campagne"/.test(INDEX_HTML),
    'aucun champ de saisie ne doit rouvrir le paramétrage de la campagne');
  const defauts = INDEX_HTML.match(/const V_DEFAUTS = \{[\s\S]*?\n\};/);
  assert.ok(defauts && !/\bcampagne:/.test(defauts[0]),
    "la campagne ne doit pas revenir dans V_DEFAUTS : rien à persister ni à restaurer");
  assert.ok(!/ajusterOuvert1|toggleAjuster1|ajusterResume1|ajusterChevron1/.test(INDEX_HTML),
    "le volet « Ajuster » du temps 1 était vide sans elle : il ne reste pas à l'écran");
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
  // La borne a déménagé : tout changement de temps passe désormais par
  // allerEtape(), qui borne à 0..2 en un seul endroit et remonte la page en
  // haut. C'est là que le plafond 2 doit être vérifié, plus dans chaque appelant.
  assert.ok(/aSuivant: s\.step < 2/.test(INDEX_HTML)
    && /Math\.max\(0, Math\.min\(2, n\)\)/.test(INDEX_HTML),
    'la navigation doit être bornée à 2, pas à 4');
  assert.ok(/allerResultats: \(\) => this\.allerEtape\(2\)/.test(INDEX_HTML),
    'le raccourci « aller aux résultats » doit viser le temps 3');
  assert.ok(!/SUR 5</.test(INDEX_HTML), 'plus aucun « ÉTAPE N SUR 5 » à l\'écran');
});

test('changer de temps ramène la page en haut', () => {
  const meth = INDEX_HTML.match(/allerEtape\(n\) \{[\s\S]*?\n  \}/);
  assert.ok(meth, 'allerEtape doit exister');
  assert.ok(/window\.scrollTo\(\{ top: 0/.test(meth[0]),
    'arriver au milieu du temps atteint, à la hauteur laissée sur le précédent, '
    + 'cache son titre et ne signale pas le changement d’écran');
  assert.ok(/setState\(\{ step: cible \}, \(\) =>/.test(meth[0]),
    'le défilement doit être demandé après le rendu, sinon il porte sur l’ancien écran');
  // Tous les chemins de navigation, y compris les pavés de la barre latérale :
  // un seul d'entre eux qui appellerait setState directement rouvrirait le trou.
  assert.ok(!/setState\(\{ step: i \}\)/.test(INDEX_HTML)
    && !/setState\(st => \(\{ step:/.test(INDEX_HTML),
    'précédent, suivant et les pavés de la barre latérale passent tous par allerEtape');
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

// Attente inversée volontairement : le thème par défaut passe de clair à
// SOMBRE (demande « mode sombre par défaut »). L'outil est d'abord montré au
// vidéoprojecteur ; le clair devient le choix explicite. Le repli reste écrit
// en dur plutôt qu'en `||` : un instantané ancien, ou porteur d'une valeur
// inconnue, doit retomber sur le défaut, pas sur n'importe quoi.
test('le thème entre dans l\'instantané localStorage, le mode sombre est le défaut', () => {
  const ecriture = INDEX_HTML.match(/function ecrireInstantane[\s\S]{0,700}?\n\}/);
  assert.ok(ecriture && /theme/.test(ecriture[0]),
    'on ne veut pas rebasculer le thème à chaque ouverture en salle');
  assert.ok(/instantane\.theme === THEMES\.clair\) \? THEMES\.clair : THEMES\.sombre/.test(INDEX_HTML),
    'un instantané sans thème, ou porteur d\'une valeur inconnue, retombe sur le sombre');
  assert.ok(/<html data-theme="sombre">/.test(INDEX_HTML),
    'le thème est posé dès le document : pas d\'éclair de fond crème avant React');
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
  //
  // Refonte du 08/09/2026 : la remise porte la VARIANTE COMPACTE de la frise
  // (`friseTrajectoireImprimee`), pas celle de l'écran. Deux raisons, et la
  // première est un vrai piège : la feuille d'impression masque tous les
  // `button`, or l'axe des années est devenu un jeu de onze boutons — imprimée
  // telle quelle, la frise perdrait sa graduation, donc son axe de temps. La
  // seconde est la contrainte d'une seule page, avec six pistes au lieu de
  // trois. Les deux rendus sortent de la MÊME fonction et du MÊME jeu de
  // données : ils ne peuvent pas raconter deux trajectoires différentes.
  const remise = INDEX_HTML.slice(INDEX_HTML.indexOf('class="print-remise"'));
  const finRemise = remise.indexOf('class="print-sheet"');
  assert.ok(remise.indexOf('{{ friseTrajectoireImprimee }}') >= 0
    && remise.indexOf('{{ friseTrajectoireImprimee }}') < finRemise,
    'la frise doit être présente dans la sortie remise');
  assert.ok(remise.slice(0, finRemise).indexOf('{{ friseTrajectoire }}') < 0,
    "la remise ne doit pas rendre la frise interactive : ses boutons d'axe seraient masqués à l'impression");
  assert.ok(/out\.friseTrajectoireImprimee = this\.friseTrajectoire\(\{ \.\.\.donneesFrise, compact: true \}\)/.test(INDEX_HTML),
    'la variante papier doit sortir de la même fonction et du même jeu de données que celle de l\'écran');
  assert.ok(/const graduation = compact/.test(INDEX_HTML),
    "en variante papier, l'axe des années doit redevenir du texte : la feuille d'impression masque les boutons");
});

test('la synthèse imprimée est assemblée des mêmes morceaux que celle de l\'écran', () => {
  const debut = INDEX_HTML.indexOf('out.syntheseTxt =');
  assert.ok(debut > 0, "la version texte plat de la synthèse doit exister");
  const bloc = INDEX_HTML.slice(debut, debut + 900);
  // chantier C3 : `effortNetTxt` remplacé par `syntheseSoldeTxt` (solde signé,
  // libellé sans « à financer »), et `reserveHorizonTxt` s'y ajoute — la
  // contrainte d'adjacence vaut aussi dans la phrase de synthèse, où un solde
  // négatif énoncé seul se lirait comme un excédent.
  //
  // Refonte du 08/09/2026 : `syntheseAbsorptionTxt` (« résorbé d'ici dix ans »)
  // et `syntheseHorizonTxt` (« le statu quo reste devant en trésorerie
  // cumulée ») sortent de la liste. Les deux commentaient des séries cumulées
  // en euros retirées de l'écran ; une phrase qui commente un graphique absent
  // ne se vérifie plus. Retrait volontaire, pas oubli — voir README §19ter.
  ['syntheseCouvTxt', 'syntheseCouvSuffixTxt',
   'syntheseStockLeadTxt', 'syntheseStockTailTxt',
   'reserveReelleTxt', 'investTxt', 'syntheseSoldeTxt', 'reserveHorizonTxt',
   'stockMinTxt'].forEach(k => {
    assert.ok(bloc.indexOf('out.' + k) >= 0,
      'la fiche remise au vigneron ne doit pas raconter autre chose que l\'écran : ' + k);
  });
  for (const k of ['syntheseAbsorptionTxt', 'syntheseHorizonTxt']) {
    assert.ok(!new RegExp('out\\.' + k).test(CODE_SANS_COMMENTAIRES),
      `${k} doit avoir disparu du code, pas seulement de la phrase : il lisait un cumul en euros retiré de l'écran`);
  }
});


// ----------------------------------------------------------------------
// Section 29 — Composition du vignoble : part arrachée / plantée et
// surface par classe d'âge (graphique du temps 1).
//
// Ce que ces tests figent, ce sont les deux CONVENTIONS de découpage, les
// seules qui puissent produire un graphique faux sans lever d'exception :
// les classes d'âge ignorent les lignes Arrachée, et les bornes sont
// fermées à gauche, ouvertes à droite.
// ----------------------------------------------------------------------

section('29. Composition du vignoble — part arrachée et classes d\'âge (temps 1)');

test('repartirRegistreParAge : plantée/arrachée sur la surface totale, classes sur la seule surface plantée', () => {
  const r = OAD.repartirRegistreParAge(REGISTRE_TEST, CAMPAGNE_TEST);
  const { surfTot } = OAD.agregerRegistreExploitation(REGISTRE_TEST, CAMPAGNE_TEST);
  assertClose(r.surfTot, surfTot, 1e-9,
    'le graphique doit annoncer la même surface totale que le champ affiché au-dessus de lui');
  assertClose(r.surfArrachee, 0.47, 1e-9);   // Z0068 0,21 + Z0069 0,13 + Z0157 0,13
  assertClose(r.surfPlantee, 1.03, 1e-9);
  assertClose(r.partArrachee + r.partPlantee, 1, 1e-9);
  // Les lignes Arrachée n'entrent dans AUCUNE classe d'âge : une parcelle
  // arrachée n'a plus d'âge de vigne, la ranger dans « 0 à 10 ans » la ferait
  // passer pour un jeune plantier.
  const sommeClasses = r.classes.reduce((s, c) => s + c.surface, 0);
  assertClose(sommeClasses, r.surfPlantee, 1e-9,
    'la somme des classes vaut exactement la surface plantée, jamais la surface totale');
  assertClose(r.classes[0].surface, 0.05, 1e-9);   // 2019 -> 7 ans
  assertClose(r.classes[1].surface, 0.18, 1e-9);   // 2010 x3 (0,12+0,04+0) -> 16 ans, 2006 -> 20 ans (0,02)
  assertClose(r.classes[2].surface, 0, 1e-9);      // aucune vigne de 30 à 50 ans dans ce registre
  assertClose(r.classes[3].surface, 0.80, 1e-9);   // 1951/1954 -> 72 et 75 ans
});

test('bornes de classe fermées à gauche, ouvertes à droite — aucune surface comptée deux fois ni perdue', () => {
  // Une ligne exactement sur chaque borne : 0, 10, 30 et 50 ans.
  const surLesBornes = [0, 10, 30, 50].map((age, i) => ({
    idu: 'B' + i, cepage: 'CHARDONNAY B', anneePlant: CAMPAGNE_TEST - age,
    surface: 1, tauxManquant: 0, situation: 'plantee'
  }));
  const r = OAD.repartirRegistreParAge(surLesBornes, CAMPAGNE_TEST);
  assert.deepStrictEqual(r.classes.map(c => c.surface), [1, 1, 1, 1],
    'une vigne de 10 ans tout juste est « 10 à 30 », pas « 0 à 10 » : sinon la première '
    + 'classe compte deux lignes et la deuxième aucune');
  assertClose(r.classes.reduce((s, c) => s + c.part, 0), 1, 1e-9);
});

test('registre vide, cellule en cours de saisie, année de plantation dans le futur', () => {
  const vide = OAD.repartirRegistreParAge([], CAMPAGNE_TEST);
  assert.strictEqual(vide.surfTot, 0);
  assert.strictEqual(vide.partPlantee, 0, 'surface nulle -> parts à 0, jamais NaN (0/0)');
  assert.deepStrictEqual(vide.classes.map(c => c.surface), [0, 0, 0, 0]);
  assert.deepStrictEqual(OAD.repartirRegistreParAge(undefined, CAMPAGNE_TEST).classes.map(c => c.part),
    [0, 0, 0, 0]);
  // Année de plantation postérieure à la campagne : âge négatif. La ligne
  // tombe dans la première classe plutôt que d'être perdue — sans quoi la
  // somme des classes cesserait de valoir la surface plantée, et le
  // graphique afficherait des proportions fausses.
  const futur = OAD.repartirRegistreParAge([
    { idu: 'F', cepage: 'CHARDONNAY B', anneePlant: CAMPAGNE_TEST + 3, surface: 0.4, situation: 'plantee' }
  ], CAMPAGNE_TEST);
  assertClose(futur.classes[0].surface, 0.4, 1e-9);
  assertClose(futur.classes.reduce((s, c) => s + c.surface, 0), futur.surfPlantee, 1e-9);
});

test('le graphique de composition est branché au temps 1', () => {
  assert.ok(/\{\{ graphExploitation \}\}/.test(INDEX_HTML),
    'le graphique doit être monté dans le gabarit, pas seulement calculé');
  assert.ok(/OAD\.repartirRegistreParAge\(/.test(INDEX_HTML),
    'la répartition vient du moteur, pas d\'un comptage refait dans index.html');
  // Le graphique doit être DANS la section du temps 1, avant le volet
  // « Ajuster » : c'est une lecture de l'exploitation, pas un réglage.
  const t1 = INDEX_HTML.indexOf('TEMPS 1 · VOTRE EXPLOITATION');
  const t1bis = INDEX_HTML.indexOf('TEMPS 1 · LA PARCELLE DÉSIGNÉE');
  const graph = INDEX_HTML.indexOf('{{ graphExploitation }}');
  assert.ok(graph > t1 && graph < t1bis,
    'le graphique décrit toute l\'exploitation : il appartient à la première section, pas à la parcelle');
});

// ----------------------------------------------------------------------
// Section 30 — Assiette de surface : registre vs production (prompt B9)
//
// `surfTot` compte toutes les lignes du registre, Plantée et Arrachée. Ce
// n'est PAS l'assiette réglementaire du rendement commercialisable ni du
// plafond de réserve individuelle : celle-ci exclut les parcelles en repos et
// les plantiers. Le moteur consomme désormais `surfProdTot` pour tout ce qui
// est production, VolCo, plafond et stock de réserve.
//
// Décisions figées ici (prompt B9, ne pas rouvrir dans ce lot) :
//   D1 — surfTot garde sa définition ; surfProd est un champ AJOUTÉ.
//   D2 — seuil d'entrée en production = 3 ans, constante nommée, « à valider ».
//   D3 — chargesEntretien reste assis sur surfTot (limite assumée, testée plus bas).
//   D4 — pas d'écrêtement du stock quand la surface en production diminue
//        (point réglementaire non tranché, limite assumée, testée plus bas).
// ----------------------------------------------------------------------

section('30. Assiette de surface — registre vs production (prompt B9)');

// Registre témoin : 1 ha en production, 0,5 ha de plantier (planté il y a un
// et deux ans, sous le seuil de 3 ans), 0,5 ha en repos. surfTot = 2 ha,
// surfProd = 1 ha : le rapport surfProd/surfTot vaut exactement 0,5, ce qui
// rend les tests de sensibilité lisibles à l'œil nu.
const REGISTRE_B9 = [
  { idu: 'P1', cepage: 'CHARDONNAY B', anneePlant: 1998, surface: 0.60, tauxManquant: 4, situation: 'plantee' },
  { idu: 'P2', cepage: 'MEUNIER N',    anneePlant: 2015, surface: 0.40, tauxManquant: 4, situation: 'plantee' },
  { idu: 'J1', cepage: 'CHARDONNAY B', anneePlant: CAMPAGNE_TEST - 1, surface: 0.30, tauxManquant: 0, situation: 'plantee' },
  { idu: 'J2', cepage: 'CHARDONNAY B', anneePlant: CAMPAGNE_TEST - 2, surface: 0.20, tauxManquant: 0, situation: 'plantee' },
  { idu: 'R1', cepage: 'MEUNIER N',    anneePlant: 1960, surface: 0.50, tauxManquant: 0, situation: 'arrachee' }
];

test('agregerRegistreExploitation : surfTot = surfProd + surfPlantier + surfRepos (invariant de partition)', () => {
  [REGISTRE_B9, REGISTRE_TEST, []].forEach((reg, i) => {
    const a = OAD.agregerRegistreExploitation(reg, CAMPAGNE_TEST);
    assertClose(a.surfProd + a.surfPlantier + a.surfRepos, a.surfTot, 1e-9,
      `registre #${i} : la partition doit reconstituer exactement la surface au registre`);
  });
});

test('surfProd exclut les lignes Arrachée', () => {
  const a = OAD.agregerRegistreExploitation(REGISTRE_B9, CAMPAGNE_TEST);
  assertClose(a.surfRepos, 0.50, 1e-9, 'la ligne R1 est en repos');
  // Gonfler la seule ligne Arrachée ne doit rien changer à l'assiette de production.
  const gonfle = REGISTRE_B9.map(r => r.situation === 'arrachee' ? { ...r, surface: 12 } : r);
  const b = OAD.agregerRegistreExploitation(gonfle, CAMPAGNE_TEST);
  assertClose(b.surfProd, a.surfProd, 1e-9, 'surfProd ne bouge pas quand la surface en repos change');
  assert.ok(b.surfTot > a.surfTot, 'surfTot, lui, augmente : les deux grandeurs sont bien distinctes');
});

test("surfProd exclut les lignes Plantée sous le seuil d'entrée en production", () => {
  const a = OAD.agregerRegistreExploitation(REGISTRE_B9, CAMPAGNE_TEST);
  assertClose(a.surfTot, 2.00, 1e-9);
  assertClose(a.surfProd, 1.00, 1e-9, 'seules P1 et P2 ont trois ans révolus');
  assertClose(a.surfPlantier, 0.50, 1e-9, 'J1 (1 an) et J2 (2 ans) sont des plantiers');
  // Le seuil est fermé à gauche : une vigne de 3 ans tout juste EST en production.
  const surSeuil = OAD.agregerRegistreExploitation(
    [{ idu: 'S', cepage: 'CHARDONNAY B', anneePlant: CAMPAGNE_TEST - OAD.SEUIL_ENTREE_PRODUCTION,
       surface: 1, tauxManquant: 0, situation: 'plantee' }], CAMPAGNE_TEST);
  assertClose(surSeuil.surfProd, 1, 1e-9, 'âge = seuil exactement -> en production');
  assertClose(surSeuil.surfPlantier, 0, 1e-9);
  assert.strictEqual(OAD.SEUIL_ENTREE_PRODUCTION, 3, 'seuil documenté « à valider » — CDC AOC Champagne');
});

test('registre sans Arrachée ni plantier : surfProd === surfTot (non-régression)', () => {
  const propre = REGISTRE_B9.filter(r => r.situation === 'plantee'
    && CAMPAGNE_TEST - r.anneePlant >= OAD.SEUIL_ENTREE_PRODUCTION);
  const a = OAD.agregerRegistreExploitation(propre, CAMPAGNE_TEST);
  assertClose(a.surfProd, a.surfTot, 1e-9);
  assertClose(a.surfPlantier, 0, 1e-9);
  assertClose(a.surfRepos, 0, 1e-9);
});

// Une ligne Plantée sans année de plantation exploitable retombe sur
// `|| campagne` (âge 0) et se classe donc en plantier. Comportement HÉRITÉ,
// documenté et volontairement non corrigé dans ce lot (prompt B9, étape 1) :
// ce test le fige pour qu'une correction future soit un choix, pas un effet
// de bord.
test('ligne sans année de plantation : âge 0, donc classée en plantier (comportement hérité figé)', () => {
  const a = OAD.agregerRegistreExploitation(
    [{ idu: 'X', cepage: 'CHARDONNAY B', anneePlant: '', surface: 0.8, tauxManquant: 0, situation: 'plantee' }],
    CAMPAGNE_TEST);
  assertClose(a.surfPlantier, 0.8, 1e-9);
  assertClose(a.surfProd, 0, 1e-9);
});

// ---- Simulation : les quatre points de substitution --------------------

test('simulerReserveKg : le stock initial est calculé sur surfProdTot, pas sur surfTot', () => {
  const base = { surfTot: 10, surfArr: 0, repos: 1, nbSortie: 3, volSortieArr: 9000,
    plafond: 10000, volco: 9000, rendMean: 12296.6, reserveInit: 7500, optInsuff: true,
    horizon: 3, scenario: 'statuquo' };
  const avecProd = OAD.simulerReserveKg({ ...base, surfProdTot: 6 });
  const sansProd = OAD.simulerReserveKg(base);
  assertClose(avecProd[0].stockDebut, 7500 * 6, 1e-6, 'assiette = surface en production');
  assertClose(sansProd[0].stockDebut, 7500 * 10, 1e-6, 'repli : surfTot quand surfProdTot est absent');
});

test('simulerReserveKg : VolCo et plafond de mise suivent surfProdTot', () => {
  const base = { surfTot: 10, surfArr: 2, repos: 1, nbSortie: 3, volSortieArr: 9000,
    plafond: 10000, volco: 9000, rendMean: 12296.6, reserveInit: 7500, optInsuff: true,
    horizon: 5, scenario: 'statuquo' };
  const r = OAD.simulerReserveKg({ ...base, surfProdTot: 6 });
  r.forEach(row => {
    assertClose(row.surfProd, 6, 1e-9, `t=${row.t} : l'assiette productive est surfProdTot`);
    assertClose(row.volcoCible, 6 * 9000, 1e-6, `t=${row.t}`);
    // Marge de mise = (plafond − stock/ha) × surface en production : le stock
    // ramené à l'assiette ne dépasse donc jamais le plafond.
    assert.ok(row.stockFin / 6 <= 10000 + 1e-6, `t=${row.t} : stock/ha borné par le plafond sur l'assiette`);
  });
  // surfRest se mesure aussi sur l'assiette de production : 6 − 2 = 4 ha.
  const arr = OAD.simulerReserveKg({ ...base, surfProdTot: 6, scenario: 'arrachage', rampProfile: [1] });
  assertClose(arr[0].surfProd, 4, 1e-9, "année 0 : le bloc arraché sort de l'assiette");
});

// ---- Repli et garde-fou ------------------------------------------------

test('construireScenarios : repli surfProdTot ?? surfTot — parité stricte avec les fixtures existantes', () => {
  // Critère d'acceptation 2 : comparaison des SORTIES par exécution, pas une
  // simple assertion sur un paramètre. Les deux appels ne diffèrent que par la
  // présence explicite de surfProdTot, égal à surfTot.
  const sansChamp = OAD.construireScenarios(INP_A);
  const avecChampEgal = OAD.construireScenarios({ ...INP_A, surfProdTot: INP_A.surfTot });
  assert.deepStrictEqual(avecChampEgal, sansChamp,
    "surfProdTot = surfTot doit reproduire à l'identique le comportement antérieur au prompt B9");
});

test('invariance : registre sans repos ni plantier, résultats strictement identiques (critère 2)', () => {
  // Registre « propre » : aucune ligne Arrachée, aucune ligne sous le seuil.
  // L'assiette dérivée vaut alors surfTot, et TOUS les résultats numériques
  // doivent être strictement identiques à ceux d'avant le lot (= appel sans
  // surfProdTot). Vérification par exécution et comparaison des sorties.
  const propre = REGISTRE_B9.filter(r => r.situation === 'plantee'
    && CAMPAGNE_TEST - r.anneePlant >= OAD.SEUIL_ENTREE_PRODUCTION);
  const a = OAD.agregerRegistreExploitation(propre, CAMPAGNE_TEST);
  const inp = { ...INP_A, surfTot: a.surfTot, surfParc: 0.3 };
  assert.deepStrictEqual(
    OAD.construireScenarios({ ...inp, surfProdTot: a.surfProd }),
    OAD.construireScenarios(inp));
});

test('sensibilité : repos et plantiers rabattent stock initial, VolCo et plafond (critère 3)', () => {
  const a = OAD.agregerRegistreExploitation(REGISTRE_B9, CAMPAGNE_TEST);
  const inp = { ...INP_A, surfTot: a.surfTot, surfParc: 0.3 };
  const avant = OAD.construireScenarios(inp);                                  // assiette = surfTot (pré-B9)
  const apres = OAD.construireScenarios({ ...inp, surfProdTot: a.surfProd });  // assiette = surface en production
  const ratio = a.surfProd / a.surfTot;
  assert.ok(ratio < 1, 'le registre témoin porte bien du repos et des plantiers');

  const kAvant = avant.arrachage.kg[0], kApres = apres.arrachage.kg[0];
  assert.ok(kApres.stockDebut < kAvant.stockDebut, 'le stock de réserve initial doit diminuer');
  assertClose(kApres.stockDebut / kAvant.stockDebut, ratio, 1e-9,
    'et diminuer exactement dans le rapport surfProd / surfTot');

  // VolCo annuel et assiette du plafond de mise : même rapport, sur toutes les
  // années du scénario de référence (assiette constante, donc rapport pur).
  avant.reference.kg.forEach((row, t) => {
    const rowApres = apres.reference.kg[t];
    assert.ok(rowApres.volcoCible < row.volcoCible, `t=${t} : le VolCo doit diminuer`);
    assertClose(rowApres.volcoCible / row.volcoCible, ratio, 1e-9, `t=${t} : VolCo`);
    assertClose(rowApres.surfProd / row.surfProd, ratio, 1e-9, `t=${t} : assiette du plafond de mise`);
  });
});

test('construireScenarios : surfParc > surfProdTot lève une erreur explicite', () => {
  const a = OAD.agregerRegistreExploitation(REGISTRE_B9, CAMPAGNE_TEST);
  // 1,20 ha : sous surfTot (2 ha) — donc accepté avant le prompt B9 — mais
  // au-dessus de l'assiette de production (1 ha). Une parcelle candidate à
  // l'arrachage est nécessairement en production.
  assert.throws(
    () => OAD.construireScenarios({ ...INP_A, surfTot: a.surfTot, surfProdTot: a.surfProd, surfParc: 1.2 }),
    (err) => /surfParc/.test(err.message) && /surfProdTot/.test(err.message) && /surfTot au registre/.test(err.message),
    'le message doit nommer les deux assiettes, pas seulement celle qui bloque');
  // Sans surfProdTot, le repli redonne l'ancienne borne : 1,2 ha < 2 ha passe.
  assert.doesNotThrow(() => OAD.construireScenarios({ ...INP_A, surfTot: a.surfTot, surfParc: 1.2 }));
});

// ---- Limites assumées, parkées par décision ----------------------------

test("LIMITE ASSUMÉE : chargesEntretien facture le reste de l'exploitation sur surfTot, plantiers et repos inclus (lot ultérieur)", () => {
  // Décision D3 (prompt B9) : une seule sémantique change à la fois. Les
  // charges d'entretien continuent de facturer le « reste » au taux « vigne en
  // production » sur surfTot − surfParc, plantiers et parcelles en repos
  // compris. Ce test FIGE la limite : le jour où le lot suivant la corrige, il
  // devra le faire tomber explicitement, pas la voir passer en silence.
  const inp = { ...INP_A, surfTot: 2, surfProdTot: 1, surfParc: 0.3,
    coutSurfaceProdHaAn: 1000, coutReposHaAn: 0, coutPlantierHaAn: 0, coutRdtParKg: 0 };
  const rows = OAD.simulerReserveKg({ surfTot: 2, surfProdTot: 1, surfArr: 0.3, repos: 1,
    nbSortie: 3, volSortieArr: 9000, plafond: 10000, volco: 9000, rendMean: 12296.6,
    reserveInit: 7500, optInsuff: true, horizon: 2, scenario: 'arrachage', rampProfile: [1] });
  const ce = OAD.chargesEntretien('arrachage', rows, inp);
  // surfTot − surfParc = 1,70 ha facturés à 1 000 €/ha, et non
  // surfProdTot − surfParc = 0,70 ha : l'écart EST la limite documentée.
  assertClose(ce.reste[0], 1700, 1e-6,
    'les charges du reste restent assises sur surfTot (D3) — à corriger dans un lot ultérieur');
});

test("LIMITE ASSUMÉE : le stock de réserve n'est pas écrêté quand la surface en production diminue (point réglementaire non tranché)", () => {
  // Décision D4 (prompt B9). Stock de départ au plafond sur 10 ha, puis
  // arrachage de 5 ha : le stock ramené à l'assiette résiduelle dépasse le
  // plafond, et le moteur le CONSERVE — il se contente de ne plus rien mettre
  // en réserve. Comportement maintenu tel quel, à faire trancher par le
  // service Appellation/Vendanges avant modélisation d'un écrêtement.
  const rows = OAD.simulerReserveKg({ surfTot: 10, surfProdTot: 10, surfArr: 5, repos: 1,
    nbSortie: 0, volSortieArr: 0, plafond: 10000, volco: 9000, rendMean: 12296.6,
    reserveInit: 10000, optInsuff: false, horizon: 2, scenario: 'arrachage', rampProfile: [1] });
  assertClose(rows[0].stockDebut, 100000, 1e-6, 'stock de départ = plafond × 10 ha');
  assertClose(rows[0].surfProd, 5, 1e-9, 'assiette réduite de moitié après arrachage');
  assertClose(rows[0].mise, 0, 1e-9, 'plus aucune marge de mise : le plafond est dépassé');
  assert.ok(rows[0].stockFin >= 100000 - 1e-6,
    "le stock existant n'est pas rogné — TODO D4, point réglementaire non tranché");
  assert.ok(rows[0].stockHa > 10000, "le stock ramené à l'assiette dépasse donc le plafond");
});

// ---- Interface : les deux surfaces sont nommées et distinguées ---------

test('index.html : le moteur reçoit surfProdTot, dérivé du registre', () => {
  assert.ok(/surfProdTot:/.test(INDEX_HTML),
    "inp doit porter surfProdTot, sans quoi le repli ramène l'assiette à surfTot");
  assert.ok(/agregExploitation\.surfProd\b/.test(INDEX_HTML),
    "l'assiette vient de l'agrégat du moteur, pas d'un comptage refait dans index.html");
});

test('écran des hypothèses : deux surfaces, deux origines distinctes et non ambiguës (critère 5)', () => {
  assert.ok(/Surface totale de l'exploitation/.test(INDEX_HTML));
  assert.ok(/Surface en production/.test(INDEX_HTML),
    'la surface en production doit figurer en propre dans la fiche des hypothèses');
  assert.ok(/lignes Plantée d'âge ≥ 3 ans/.test(INDEX_HTML),
    "son origine doit dire la règle de dérivation, pas seulement « dérivé du registre »");
  const apresReserve = INDEX_HTML.slice(INDEX_HTML.indexOf("{ lib: 'Réserve individuelle initiale'"));
  assert.ok(/surface en production/.test(apresReserve.slice(0, 400)),
    "la conversion de la réserve initiale en kg doit annoncer l'assiette qu'elle utilise");
});

test('temps 1 : la décomposition du registre est à l\'écran, chaque surface étiquetée', () => {
  assert.ok(/registreSurfProdTxt/.test(INDEX_HTML), 'la surface en production est affichée au temps 1');
  assert.ok(/registreHorsProdTxt/.test(INDEX_HTML),
    'plantiers et repos sont nommés : deux surfaces à l\'écran ne se distinguent que par leur libellé');
});

// ----------------------------------------------------------------------
// Section 31 — chantier C2 : la fiche d'audit documente la VRAIE composition
// de l'investissement d'arrachage. Le test ne porte pas sur la chaîne
// d'affichage (fragile, et elle changerait au moindre remaniement de libellé)
// mais fige numériquement la composition elle-même : si un chantier futur
// ajoute, retire ou déplace un terme de `invArr`, ce test casse, et le
// commentaire posé au-dessus de `printKpiRows` dans index.html rappelle qu'il
// faut alors reprendre la formule affichée.
// ----------------------------------------------------------------------

section('31. Composition de l\'investissement d\'arrachage (chantier C2)');

// Les quatre postes de l'engagement à t=repos sont non nuls SIMULTANÉMENT
// (protection ajoutée au chantier P8, irrigation activée) : une omission de
// l'un d'eux ne peut pas passer inaperçue derrière un zéro.
const INP_C2_INVEST = { ...INP_A, declinSQ: 0, coutProtectionHa: 10330, irrigation: true };

test('C2 — composition de l\'investissement arrachage', () => {
  const inp = INP_C2_INVEST;
  const sc = OAD.construireScenarios(inp);
  // Décalque littéral du bloc `invArr` de construireScenarios : arrachage à
  // t=0, installation à t=repos. AUCUN terme de préparation du sol (coutPrepaHa,
  // supprimé au chantier P3 — double emploi avec coutArrachageHa, forfait MHCS
  // tout compris).
  const attenduAn0 = inp.surfParc * inp.coutArrachageHa;
  const attenduAnRepos = inp.surfParc * (inp.densite * inp.coutPlant + inp.coutPalissageHa
    + inp.coutProtectionHa + (inp.irrigation ? inp.coutIrrigHa : 0));
  assertClose(sc.arrachage.investissement, attenduAn0 + attenduAnRepos, 1e-6,
    "l'investissement total est exactement la somme des deux engagements");
  // …et chaque engagement tombe bien sur son année (INP_A a ses 4 taux de
  // charges d'entretien à 0 : coutsParcelle n'est alimenté que par invArr).
  assertClose(sc.arrachage.eur[0].coutsParcelle, attenduAn0, 1e-6,
    'an. 0 : arrachage seul');
  assertClose(sc.arrachage.eur[inp.repos].coutsParcelle, attenduAnRepos, 1e-6,
    'an. repos : plants + palissage + protection + irrigation');
});

test('C2 — chaque poste de l\'installation pèse exactement son montant dans le total', () => {
  const base = INP_C2_INVEST;
  const S = base.surfParc;
  // Sensibilité poste par poste : +1 unité sur chaque paramètre doit déplacer
  // l'investissement total de son coefficient exact, ni plus ni moins.
  const ref = OAD.construireScenarios(base).arrachage.investissement;
  const delta = (patch) => OAD.construireScenarios({ ...base, ...patch }).arrachage.investissement - ref;
  assertClose(delta({ coutArrachageHa: base.coutArrachageHa + 1 }), S, 1e-6, 'coutArrachageHa : × S');
  assertClose(delta({ coutPlant: base.coutPlant + 1 }), S * base.densite, 1e-6, 'coutPlant : × S × densité');
  assertClose(delta({ coutPalissageHa: base.coutPalissageHa + 1 }), S, 1e-6, 'coutPalissageHa : × S');
  assertClose(delta({ coutProtectionHa: base.coutProtectionHa + 1 }), S, 1e-6, 'coutProtectionHa : × S');
  assertClose(delta({ coutIrrigHa: base.coutIrrigHa + 1 }), S, 1e-6, 'coutIrrigHa : × S (irrigation activée)');
  assertClose(delta({ irrigation: false }), -S * base.coutIrrigHa, 1e-6,
    'irrigation désactivée : le poste disparaît entièrement');
});

test('C2 — la fiche d\'audit ne cite plus coûtPrepaHa et cite coûtProtectionHa', () => {
  // On isole la SEULE chaîne `formule:` de l'entrée investissement : les
  // commentaires alentour citent volontairement coutPrepaHa pour expliquer son
  // retrait (chantier P3), et ne doivent pas faire échouer le test.
  const bloc = INDEX_HTML.slice(INDEX_HTML.indexOf('out.printKpiRows = ['));
  const entree = bloc.slice(0, bloc.indexOf("{ lib: 'Amortisseur de réserve'"));
  const m = entree.match(/formule:\s*"([^"]*)"/);
  assert.ok(m, "l'entrée investissement de printKpiRows doit porter une chaîne `formule:`");
  const formuleInvest = m[1];
  assert.ok(!/coûtPrepaHa/.test(formuleInvest),
    'coutPrepaHa a été supprimé au chantier P3 : la fiche ne doit plus le citer');
  assert.ok(/coûtProtectionHa/.test(formuleInvest),
    'coutProtectionHa (chantier P8, 10 000 €/ha par défaut) doit figurer dans la formule');
  for (const terme of ['coûtArrachageHa', 'densité × coûtPlant', 'coûtPalissageHa', 'coûtIrrigHa']) {
    assert.ok(formuleInvest.includes(terme), `terme manquant dans la formule affichée : ${terme}`);
  }
});

// ----------------------------------------------------------------------
// Section 32 — chantier C3 : solde investissement/réserve déclampé, et
// réserve à l'horizon (kg/ha).
//
// Deux défauts corrigés ensemble parce qu'ils ne doivent jamais s'afficher
// l'un sans l'autre :
//   (a) `Math.max(0, invest − reserveReelle)` écrasait à zéro toute la région
//       où la réserve couvre l'investissement — le cas dominant ;
//   (b) le stock de réserve consommé n'a aucun coût dans le modèle (assumé,
//       README §19) mais c'est DIRECTIONNEL : la contrepartie physique du
//       déstockage doit donc être exposée, en kg/ha et jamais en euros.
// ----------------------------------------------------------------------

section("32. Solde investissement / réserve et réserve à l'horizon (chantier C3)");

// Cas (a) — réserve excédentaire. Aux paramètres canoniques, la réserve
// mobilisée dépasse largement l'investissement : c'est ce cas-là que
// l'ancien clamp affichait « 0 € », donc « gratuit ».
const INP_C3_EXCEDENT = { ...INP_A, declinSQ: 0 };

// Cas (b) — réserve insuffisante. `volco` relevé au-dessus du rendement moyen
// supprime tout surplus commercialisable : plus rien n'alimente la mise en
// réserve, et le stock disponible pour la sortie « arrachage » se réduit à ce
// que porte `reserveInit` (le curseur riPct de l'interface, converti par
// index.html en `reserveInit = 10000 × riPct/100`). riPct bas ⇒ solde positif.
const INP_C3_RI_BAS = { ...INP_A, declinSQ: 0, volco: 12500, reserveInit: 1000 }; // riPct = 10 %

test('C3 — solde non clampé, cas réserve excédentaire', () => {
  const sc = OAD.construireScenarios(INP_C3_EXCEDENT);
  const r = OAD.soldeInvestissementReserve(sc.arrachage);
  assert.ok(r.reserveMobilisee > r.invest,
    "préalable du cas : la réserve mobilisée doit dépasser l'investissement");
  assert.ok(r.solde < 0, `solde attendu strictement négatif, obtenu ${r.solde}`);
  // Le point du chantier : PAS zéro. L'ancienne formule rendait exactement 0 ici.
  assert.ok(Math.abs(r.solde) > 1,
    "le solde ne doit pas être écrasé à zéro : c'est précisément le défaut corrigé par C3");
  assertClose(r.solde, r.invest - r.reserveMobilisee, 1e-9,
    'solde = invest − reserveMobilisee, sans plancher');
});

test('C3 — solde, cas réserve insuffisante', () => {
  const sc = OAD.construireScenarios(INP_C3_RI_BAS);
  const r = OAD.soldeInvestissementReserve(sc.arrachage);
  assert.ok(r.reserveMobilisee > 0,
    'préalable du cas : une réserve est bien mobilisée, simplement pas assez');
  assert.ok(r.reserveMobilisee < r.invest, "préalable du cas : elle ne couvre pas l'investissement");
  assert.ok(r.solde > 0, `solde attendu strictement positif, obtenu ${r.solde}`);
  assertClose(r.solde, r.invest - r.reserveMobilisee, 1e-9);
});

// Critère d'acceptation du chantier, énoncé tel quel : « en faisant varier
// riPct de 0 à 100 %, le KPI de solde varie de façon continue et monotone sur
// toute la plage. Aujourd'hui il est plat à 0 sur la majeure partie. »
test("C3 — CRITÈRE D'ACCEPTATION : le solde est monotone et non plat quand riPct varie de 0 à 100 %", () => {
  const PLAFOND = 10000;   // kg/ha — conversion riPct → reserveInit faite par index.html
  const soldes = [];
  for (let riPct = 0; riPct <= 100; riPct += 5) {
    const sc = OAD.construireScenarios({ ...INP_C3_RI_BAS, reserveInit: PLAFOND * riPct / 100 });
    soldes.push(OAD.soldeInvestissementReserve(sc.arrachage).solde);
  }
  // Monotone décroissant (au sens large : plus de réserve ⇒ solde plus bas).
  for (let i = 1; i < soldes.length; i++) {
    assert.ok(soldes[i] <= soldes[i - 1] + 1e-9,
      `rupture de monotonie entre riPct=${(i - 1) * 5} % (${soldes[i - 1]}) et riPct=${i * 5} % (${soldes[i]})`);
  }
  // …et STRICTEMENT décroissant sur la majeure partie de la plage : c'est ce
  // qui distingue le nouveau comportement de l'ancien.
  const strictes = soldes.slice(1).filter((v, i) => v < soldes[i] - 1e-9).length;
  assert.ok(strictes >= soldes.length - 3,
    `le solde doit bouger sur presque toute la plage, ${strictes}/${soldes.length - 1} pas strictement décroissants`);
  // Démonstration explicite du défaut corrigé : l'ANCIENNE formule clampée
  // était plate à 0 sur plus de la moitié de la plage, sur ce même jeu.
  const ancienClampe = soldes.map(v => Math.max(0, v));
  const platsAZero = ancienClampe.filter(v => v === 0).length;
  assert.ok(platsAZero > soldes.length / 2,
    'ce jeu doit bien reproduire le défaut historique (clamp plat à 0 sur la majeure partie), sinon le test ne prouve rien');
  // Le solde change bien de signe : les deux régimes sont couverts.
  assert.ok(soldes[0] > 0 && soldes[soldes.length - 1] < 0,
    'la plage doit traverser le zéro, sans quoi la monotonie ne prouve rien');
});

test('C3 — reserveHorizon lit stockHa à t = horizon sur les deux scénarios', () => {
  const inp = INP_C3_EXCEDENT;
  const sc = OAD.construireScenarios(inp);
  const rh = OAD.reserveHorizon(sc.arrachage, sc.reference, inp.horizon);
  assertClose(rh.arrachageKgHa, sc.arrachage.kg[inp.horizon].stockHa, 1e-9);
  assertClose(rh.referenceKgHa, sc.reference.kg[inp.horizon].stockHa, 1e-9);
  assertClose(rh.ecartKgHa, rh.arrachageKgHa - rh.referenceKgHa, 1e-9);
});

test("C3 — reserveHorizon expose bien l'écart quand la réserve n'est pas saturée", () => {
  // Sur INP_C3_RI_BAS à riPct = 100 %, l'arrachage a consommé sa réserve et ne
  // l'a pas reconstituée à l'horizon, contrairement à la référence : les deux
  // nombres diffèrent. C'est exactement le régime que le solde en euros, seul,
  // ne sait pas distinguer d'une réserve saturée.
  const inp = { ...INP_C3_RI_BAS, reserveInit: 10000 };
  const sc = OAD.construireScenarios(inp);
  const rh = OAD.reserveHorizon(sc.arrachage, sc.reference, inp.horizon);
  assert.ok(rh.referenceKgHa > rh.arrachageKgHa,
    "la référence doit conserver plus de stock que l'arrachage sur ce jeu");
  assert.ok(rh.ecartKgHa < 0, 'ecartKgHa = arrachage − référence, donc négatif ici');
});

// Garde-fou, sur le modèle de celui de la section 12 pour trajectoireAge : la
// règle « le stock de réserve n'est JAMAIS monétisé » est structurelle, pas
// une convention d'écriture. reserveHorizon ne reçoit aucun paramètre
// monétaire ; faire varier le prix du kg ne doit donc rien pouvoir changer.
test('C3 — GARDE-FOU : reserveHorizon ne produit aucun euro', () => {
  const base = INP_C3_RI_BAS;
  const scRef = OAD.construireScenarios({ ...base, prixKg: 7 });
  const scCher = OAD.construireScenarios({ ...base, prixKg: 999999 });
  const rhRef = OAD.reserveHorizon(scRef.arrachage, scRef.reference, base.horizon);
  const rhCher = OAD.reserveHorizon(scCher.arrachage, scCher.reference, base.horizon);
  assert.deepStrictEqual(rhCher, rhRef,
    "prixKg ne doit avoir aucun effet sur la réserve à l'horizon (indicateur physique, jamais monétisé — README §19)");
  // …et le résultat ne porte AUCUNE clé qui puisse passer pour un montant.
  assert.deepStrictEqual(Object.keys(rhRef).sort(), ['arrachageKgHa', 'ecartKgHa', 'referenceKgHa'],
    'reserveHorizon ne doit exposer que des kg/ha — aucune clé monétaire, même « indicative »');
});

// Les commentaires de `index.html` citent volontairement les anciens noms pour
// documenter le renommage (même procédé qu'au chantier C2) : les assertions
// ci-dessous portent donc sur le CODE et sur les LIBELLÉS RENDUS, jamais sur le
// fichier entier, sans quoi la documentation du chantier ferait échouer le test
// qui la garde.

test("C3 — la vue n'écrase plus le solde par un Math.max(0, …) et appelle le moteur", () => {
  assert.ok(/OAD\.soldeInvestissementReserve\(/.test(INDEX_HTML),
    'le solde doit venir du moteur, pas être recalculé dans la vue');
  assert.ok(/OAD\.reserveHorizon\(/.test(INDEX_HTML),
    "la réserve à l'horizon doit venir du moteur");
  assert.ok(!/Math\.max\(0,\s*invest\s*-\s*reserveReelle\)/.test(INDEX_HTML),
    'le clamp à zéro doit avoir disparu de la vue');
  assert.ok(!/effortNet/.test(CODE_SANS_COMMENTAIRES),
    'plus aucune occurrence de « effortNet » dans le code : le renommage doit être complet (variables, état, clés de sortie, interpolations du template)');
});

test("C3 — vocabulaire : ni « à financer » sur ce KPI, ni « excédent / gain / bénéfice » sur le cas négatif", () => {
  assert.ok(!/effort net à financer/i.test(CODE_SANS_COMMENTAIRES),
    "« à financer » disparaît de ce KPI : aucun coût de financement n'est modélisé");
  assert.ok(INDEX_HTML.includes('Investissement net de la réserve'),
    'le nouveau libellé doit être affiché');
  // Le cas négatif est un déstockage, jamais un profit.
  // Suppression du 08/09/2026 : l'ancre de fin était l'affectation
  // out.kpiReserveMin, partie avec la carte « Ce que le renouvellement
  // produit ». La tranche s'arrête désormais à la construction suivante,
  // out.reserveHorizonTxt — même portée utile : l'objet du solde signé, et lui
  // seul.
  const bloc = CODE_SANS_COMMENTAIRES.slice(CODE_SANS_COMMENTAIRES.indexOf('out.kpiSoldeReserve = {'),
    CODE_SANS_COMMENTAIRES.indexOf('out.reserveHorizonTxt ='));
  assert.ok(bloc.length > 0 && bloc.length < 4000, 'la tranche analysée doit bien encadrer les KPI du solde');
  for (const mot of ['excédent', 'excedent', 'bénéfice', 'benefice']) {
    assert.ok(!new RegExp(mot, 'i').test(bloc),
      `vocabulaire interdit sur le cas négatif : « ${mot} » — c'est un déstockage, pas un profit`);
  }
  assert.ok(/réserve mobilisée au-delà de l'investissement/i.test(CODE_SANS_COMMENTAIRES),
    'le cas négatif doit porter sa formulation dédiée');
});

// Contrainte d'adjacence, point 8 du chantier : « il ne doit exister aucun état
// de l'interface où le solde s'affiche sans elle ». Le test la vérifie
// structurellement.
//
// MISE À JOUR chantier C5 : le cartouche « solde investissement / réserve » a
// quitté l'écran — la réserve mobilisée et l'investissement y sont devenus deux
// TERMES de la cascade, et laisser vivre en parallèle un solde partiel
// recréerait les montants épars que C5 supprime. La contrainte d'adjacence ne
// disparaît pas pour autant : elle se DÉPLACE sur la cascade, qui est
// l'endroit où la réserve est désormais monétisée. La réserve à l'horizon en
// kg/ha est rendue immédiatement sous la cascade, dans le même bloc.
// Le solde signé reste calculé et reste sur la fiche d'audit (C3), où il est
// suivi de la même ligne en kg/ha.
// MISE À JOUR refonte du 08/09/2026 : la cascade a quitté l'écran avec le
// différentiel qu'elle décomposait. La contrainte d'adjacence ne disparaît pas
// pour autant — elle se déplace une seconde fois, sur le bloc « ce que le
// renouvellement produit », le seul endroit de l'écran où la réserve est
// désormais chiffrée. Ce qu'elle interdit reste le même : un état de
// l'interface où la réserve À L'HORIZON s'afficherait sans le PLANCHER
// traversé pour l'atteindre. Une réserve reconstituée à 4 500 kg/ha lue seule
// ne dit pas qu'on est passé par 1 200.
// MISE À JOUR suppression du 08/09/2026 : ce bloc a été retiré à son tour. La
// contrainte se déplace une TROISIÈME fois, sur la PHRASE DE SYNTHÈSE du temps
// 3, qui porte les deux grandeurs dans la même phrase — reserveHorizonTxt puis
// stockMinTxt, sans conditionnel entre eux. La règle n'est pas relâchée : c'est
// l'ancre du test (a) qui change, pas ce qu'il interdit.
test("C3/C5 — ADJACENCE : la réserve à l'horizon n'est jamais rendue sans le plancher de la transition", () => {
  // (a) À l'écran : les deux grandeurs sont dans la même phrase de synthèse, le
  //     plancher après l'horizon, sans conditionnel entre eux.
  const iReserve = INDEX_HTML.indexOf('{{ reserveHorizonTxt }}');
  const iMin = INDEX_HTML.indexOf('{{ stockMinTxt }}', iReserve);
  assert.ok(iReserve > 0, "la réserve à l'horizon doit être rendue par le template");
  assert.ok(iMin > iReserve,
    'le plancher de la transition doit être rendu APRÈS la réserve à l’horizon, dans la même phrase');
  const entre = INDEX_HTML.slice(iReserve, iMin);
  assert.ok(!/<sc-if/.test(entre),
    "aucun conditionnel entre la réserve à l'horizon et le plancher de la transition");
  // La cascade, elle, ne doit pas être revenue par une porte dérobée.
  assert.ok(!/cascadeRows|cascadeLib|cascadeIntroTxt/.test(CODE_SANS_COMMENTAIRES),
    "la cascade différentielle ne doit pas réapparaître à l'écran du temps 3");

  // (b) Sur la fiche d'audit : le solde signé est immédiatement suivi de la
  //     réserve à l'horizon, en kg/ha.
  const rows = INDEX_HTML.slice(INDEX_HTML.indexOf('out.printKpiRows = ['));
  // Le libellé et la valeur du solde viennent de out.kpiSoldeReserve : une seule
  // définition, partagée par le chiffre de tête et la fiche (chantier C5).
  const iSolde = rows.indexOf('out.kpiSoldeReserve.lib');
  const iResAudit = rows.indexOf('Réserve à ${inp.horizon} ans (kg/ha)');
  assert.ok(iSolde > 0 && iResAudit > iSolde,
    "sur la fiche d'audit, la réserve à l'horizon suit immédiatement le solde signé");

  // (c) Le commentaire de contrainte doit rester : c'est lui qui empêche une
  //     session ultérieure de séparer les deux « pour aérer la mise en page ».
  assert.ok(/adjacence/i.test(INDEX_HTML),
    'la contrainte doit rester écrite dans le fichier');
});

test("C3 — la réserve à l'horizon n'est jamais convertie en euros dans la vue", () => {
  // Ancrage sur l'AFFECTATION, pas sur la simple mention du nom : les
  // commentaires d'adjacence citent la réserve bien plus haut dans le fichier,
  // et une tranche partant de là engloberait tout l'écran.
  // Suppression du 08/09/2026 : les deux anciennes ancres (out.kpiReserveHorizon
  // et out.kpiReserveMin) sont parties avec la carte. La seule construction de
  // la réserve à l'horizon dans la vue est désormais out.reserveHorizonTxt ; la
  // lecture se fait sur le code SANS COMMENTAIRES, sans quoi les blocs
  // d'historique intercalés jusqu'à l'ancre de fin ramèneraient leurs « € ».
  const debut = CODE_SANS_COMMENTAIRES.indexOf('out.reserveHorizonTxt =');
  const fin = CODE_SANS_COMMENTAIRES.indexOf('const RENDEMENT_BUTOIR_2026');
  assert.ok(debut > 0 && fin > debut, "les deux ancres doivent exister, dans cet ordre");
  const bloc = CODE_SANS_COMMENTAIRES.slice(debut, fin);
  assert.ok(/kg\/ha/.test(bloc), 'la ligne doit être libellée en kg/ha');
  assert.ok(!/fmtE0?\(/.test(bloc),
    "aucun formatage monétaire sur cette ligne — même entre parenthèses, même « indicatif »");
  assert.ok(!/€/.test(bloc), "aucun symbole € sur la réserve à l'horizon");
});

// ----------------------------------------------------------------------
// Section 33 — chantier C4 : différentiel par rapport à « ne rien faire ».
//
// Un simulateur d'IMPACT dont tous les chiffres sont absolus ne mesure aucun
// impact. Le différentiel existait déjà dans le code (`creux`,
// `manqueAGagner`) mais avait été retiré de l'écran au chantier P6 : basculer
// le test de résistance climatique — la variable qui décide de tout — ne
// faisait bouger aucun des deux KPI de tête.
//
// Ce que C4 rétablit : un POINT DE RÉFÉRENCE ARITHMÉTIQUE sur une ligne.
// Ce que C4 ne rétablit PAS : le contrefactuel comme SCÉNARIO CONFIGURABLE
// (aucune colonne, aucune seconde courbe, aucun champ de saisie).
// ----------------------------------------------------------------------

section("33. Différentiel par rapport à ne rien faire (chantier C4)");

// Fixture à l'échelle de l'interface — 10 ha d'exploitation, 1 ha renouvelé,
// charges d'entretien calibrées (défauts UI). Elle diffère volontairement
// d'INP_A, dont la parcelle pèse 30 % de l'exploitation : à cette échelle-là,
// l'opération domine la trésorerie et le différentiel ne change jamais de
// signe. Les ordres de grandeur cités dans le prompt du chantier ont été
// mesurés sur les valeurs par défaut RENDUES par l'interface (densité,
// palissage et protection y sont dérivés d'une géométrie que ce fichier de
// test ne reconstruit pas) ; ce que les tests figent ici, ce sont les valeurs
// de CETTE fixture et, surtout, le comportement : changement de signe et écart
// de plusieurs dizaines de milliers d'euros entre les deux paramétrages.
const INP_C4 = {
  surfTot: 10, surfProdTot: 10, surfParc: 1, repos: 1, nbSortie: 3,
  volSortieArr: OAD.VOL_SORTIE_ARRACHAGE, plafond: 10000, volco: 9000,
  rendMean: 12296.6, reserveInit: 7500, horizon: 10, rendYearFn: null,
  ramp: OAD.rampeLineaire(5), rendFactorProjet: 1, rendEstime: 10500,
  manquants: 0.15, declinSQ: 0.01, densite: 8264,
  coutArrachageHa: 22500, coutPlant: 2.10, coutPalissageHa: 12000,
  coutProtectionHa: 10000, irrigation: false, coutIrrigHa: 5000,
  coutEntreplant: 4.5, survie: 0.5, entreeProd: 7, prixKg: 7,
  coutSurfaceProdHaAn: 11400, coutRdtParKg: 1.52,
  coutReposHaAn: 0, coutPlantierHaAn: 8000,
  fv: { regime: 'propriete', loyerAn: 3000, partRecolte: 0.33, partCouts: 0.33 }
};
// Vendange dégradée : rendMean = moyenne − écart-type régional (12 296,6 − 3 440).
const INP_C4_DEGRADE = { ...INP_C4, rendMean: 12296.6 - 3440 };

test('C4 — différentiel = soustraction des deux trésoreries', () => {
  const inp = INP_C4;
  const sc = OAD.construireScenarios(inp);
  // Sur les trois régimes de faire-valoir et les trois vues : la fonction ne
  // doit RIEN faire d'autre qu'une soustraction terme à terme.
  for (const regime of ['propriete', 'fermage', 'metayage']) {
    const fv = { ...inp.fv, regime };
    for (const vue of ['1', 'exp', 'prop']) {
      const opt = { parcelleSeule: true };
      const d = OAD.differentielTresorerie(sc.arrachage, sc.reference, fv, vue, opt);
      const a = OAD.tresorerieCumulee(sc.arrachage, fv, vue, opt);
      const r = OAD.tresorerieCumulee(sc.reference, fv, vue, opt);
      for (let t = 0; t < d.cumule.length; t++) {
        assertClose(d.cumule[t], a.cumulee[t] - r.cumulee[t], 1e-6, `${regime}/${vue} cumulé t=${t}`);
        assertClose(d.annuel[t], a.annuelle[t] - r.annuelle[t], 1e-6, `${regime}/${vue} annuel t=${t}`);
      }
      assertClose(d.aHorizon, d.cumule[d.cumule.length - 1], 1e-9,
        `${regime}/${vue} : aHorizon est le dernier élément de cumule`);
    }
  }
});

// LE test le plus important de l'outil : il documente le comportement que
// l'écran ne montrait pas du tout avant ce chantier.
test('C4 — le différentiel change de signe selon rendMean', () => {
  const calc = (inp) => {
    const sc = OAD.construireScenarios(inp);
    return OAD.differentielTresorerie(sc.arrachage, sc.reference, inp.fv, '1', { parcelleSeule: true }).aHorizon;
  };
  const nominal = calc(INP_C4);
  const degrade = calc(INP_C4_DEGRADE);
  // Valeurs figées sur cette fixture (chantier C4). Toute dérive volontaire
  // d'une formule du moteur les déplacera : les mettre à jour en citant le
  // chantier responsable, jamais en silence.
  assertClose(nominal, 10840.250926, 1e-4, 'différentiel à 10 ans, vendange nominale');
  assertClose(degrade, -162017.794169, 1e-4, 'différentiel à 10 ans, vendange dégradée');
  // Ce que ces deux nombres racontent, et que l'écran taisait :
  assert.ok(nominal > 0 && degrade < 0,
    'le différentiel doit changer de SIGNE entre les deux paramétrages');
  assert.ok(Math.abs(nominal - degrade) > 50000,
    `les deux mondes doivent être séparés de plusieurs dizaines de milliers d'euros, obtenu ${Math.abs(nominal - degrade)}`);
});

test("C4 — le différentiel est bien celui de la PARCELLE SEULE, pas de l'exploitation", () => {
  // Vérification du choix de convention (point 4 du chantier) : sur
  // l'exploitation entière, le revenu du reste du domaine noie l'effet de
  // l'opération. Les deux différentiels doivent donc être nettement distincts.
  const inp = INP_C4_DEGRADE;
  const sc = OAD.construireScenarios(inp);
  const parcelle = OAD.differentielTresorerie(sc.arrachage, sc.reference, inp.fv, '1', { parcelleSeule: true }).aHorizon;
  const exploitation = OAD.differentielTresorerie(sc.arrachage, sc.reference, inp.fv, '1', {}).aHorizon;
  assert.ok(Math.abs(parcelle - exploitation) > 1,
    "parcelle seule et exploitation entière ne doivent pas donner le même chiffre, sinon la convention ne se voit pas");
});

/* Les trois tests qui suivaient lisaient le GABARIT et le SCRIPT : ils
   vérifiaient que la ligne différentielle était rendue, qu'aucun sc-if ne
   pouvait la masquer selon son signe, et qu'aucune formulation évaluative ne
   l'accompagnait. Ils sont remplacés par leur inverse, VOLONTAIREMENT et pour
   une raison datée (refonte du temps 3, 08/09/2026, README §18bis / §19ter) :
   la ligne a quitté l'écran, et avec elle la cascade qui la décomposait.

   Ce n'est pas un revirement sur l'arbitrage de C4. C4 avait raison sur son
   terrain : un simulateur d'impact a besoin d'un point de référence
   arithmétique, et `differentielTresorerie` reste exportée, testée et juste —
   les tests de moteur ci-dessus continuent de la couvrir en entier. Ce qui a
   changé, c'est l'écran : le temps 3 est désormais organisé par THÈME et par
   ANNÉE, et un cumul différentiel sur dix ans n'y a pas de colonne où se
   poser. Il ne se lisait, de fait, qu'adossé à la piste de trésorerie, retirée
   pour illisibilité.

   Ce que les tests ci-dessous gardent verrouillé, c'est la porte : ni piste de
   trésorerie, ni cascade, ni saisie du contrefactuel ne doivent revenir sur
   cet écran sans un nouvel arbitrage. */
test('C4 — le différentiel et sa cascade ont quitté l\'écran, et le moteur les garde intacts', () => {
  // (a) Plus aucun appel dans la vue : c'est le retrait, pas un masquage.
  assert.ok(!/OAD\.differentielTresorerie\(/.test(CODE_SANS_COMMENTAIRES),
    'la vue ne doit plus appeler le différentiel');
  assert.ok(!/OAD\.cascadeDifferentielle\(/.test(CODE_SANS_COMMENTAIRES),
    'la vue ne doit plus appeler la cascade');
  assert.ok(!/OAD\.tresorerieCumulee\(/.test(CODE_SANS_COMMENTAIRES),
    'la vue ne doit plus appeler la trésorerie cumulée');
  // (b) Plus aucune interpolation de ces grandeurs dans le gabarit.
  for (const cle of ['differentielLib', 'differentielTxt', 'differentielDet',
                     'cascadeRows', 'cascadeLib', 'kpiPointBas', 'creuxTxt',
                     'printCascadeRows']) {
    assert.ok(!new RegExp('\\{\\{\\s*' + cle).test(INDEX_HTML),
      `« ${cle} » ne doit plus être rendu par le gabarit`);
  }
  // (c) Le moteur, lui, garde les trois fonctions — exportées et marquées.
  ['tresorerieCumulee', 'differentielTresorerie', 'cascadeDifferentielle'].forEach(f => {
    assert.strictEqual(typeof OAD[f], 'function', `${f} reste exportée`);
  });
  const MOTEUR = require('fs').readFileSync(path.join(__dirname, '..', 'moteur-oad.js'), 'utf8');
  ['tresorerieCumulee', 'differentielTresorerie'].forEach(f => {
    const i = MOTEUR.indexOf('function ' + f);
    const avant = MOTEUR.slice(Math.max(0, i - 3000), i);
    assert.ok(/@deprecated/.test(avant),
      `${f} doit porter la marque @deprecated qui dit qu'elle n'est plus affichée`);
  });
});

test("C4 — aucune saisie du contrefactuel ne subsiste, et le paramètre reste lu par le moteur", () => {
  // `declinSQ` était la seule saisie relative au scénario de référence. Le
  // volet qui la portait ne pilotait plus que du différentiel : il part avec
  // lui. La VALEUR, elle, reste — `sc.reference` en dépend, et `reserveHorizon`
  // s'y compare toujours à l'écran.
  assert.strictEqual((INDEX_HTML.match(/id="f-declinSQ"/g) || []).length, 0,
    'plus aucun champ de saisie du contrefactuel');
  assert.ok(!/Hypothèses de comparaison/.test(CODE_SANS_COMMENTAIRES),
    'le volet « Hypothèses de comparaison » a été retiré avec le chiffre qu\'il pilotait');
  assert.ok(/declinSQ: \(\+v\.declinSQ \|\| 0\) \/ 100/.test(INDEX_HTML),
    'le moteur doit continuer de recevoir le déclin supposé, via `inp`');
  // Et le contrefactuel reste un scénario NON CONFIGURABLE, comme depuis C4 :
  // aucune colonne, aucune seconde courbe de statu quo hors trajectoire d'âge.
  assert.ok(!/list="\{\{ *(sq|statuquo)/i.test(INDEX_HTML),
    'aucune colonne « statu quo » dans un tableau');
});

test("C4 — INTERDICTIONS : le différentiel ne remonte pas dans les chiffres de tête", () => {
  // Cette interdiction-ci survit intacte à la refonte : les trois chiffres de
  // 36 px restent `teteRetour`, `teteEffort` et `teteAge`.
  for (const tete of ['out.teteRetour', 'out.teteEffort', 'out.teteAge']) {
    const i = INDEX_HTML.indexOf(tete + ' = {');
    assert.ok(i > 0, `${tete} doit exister`);
    const bloc = INDEX_HTML.slice(i, i + 700);
    assert.ok(!/diffTreso|differentiel/i.test(bloc),
      `${tete} doit rester inchangé : le différentiel ne monte pas dans les chiffres de tête`);
  }
  assert.ok(!/chart\w*\s*=\s*[^;]*diffTreso/i.test(INDEX_HTML),
    'aucun graphique ne doit consommer le différentiel : pas de seconde courbe');
  // Trois N1 à l'ÉCRAN. La sortie « remise au vigneron » réutilise la même
  // classe pour ses trois cartouches (ramenés à 28 px pour tenir sur une
  // page) : on borne donc le décompte au gabarit d'écran, avant la page
  // imprimée, sinon on compterait deux fois les mêmes trois chiffres.
  const ecran = INDEX_HTML.slice(0, INDEX_HTML.indexOf('class="print-remise"'));
  assert.strictEqual((ecran.match(/class="n1"/g) || []).length, 3,
    'trois chiffres de 36 px à l\'écran, pas un de plus');
});

// ----------------------------------------------------------------------
// Section 34 — chantier C5 : la cascade, décomposition EXACTE du différentiel.
//
// Le point de ce chantier n'est pas d'ajouter des chiffres, c'est d'en avoir
// UN qui ordonne les autres. La contrainte qui en découle est dure : la
// cascade doit SOMMER au différentiel de C4, à l'euro près, sur tous les jeux
// d'entrées et tous les régimes de faire-valoir.
//
// Une cascade qui ne tombe pas juste est PIRE que six chiffres épars : elle
// donne l'apparence de la rigueur. C'est pourquoi le moteur lève une exception
// au-delà de 1 € d'écart, et pourquoi ces tests balaient large.
// ----------------------------------------------------------------------

section('34. Cascade différentielle (chantier C5)');

// Les quatre jeux d'entrées demandés par le chantier.
const JEUX_C5 = {
  'défauts': INP_C4,
  'vendange dégradée': INP_C4_DEGRADE,
  'riPct bas': { ...INP_C4, reserveInit: 500, volco: 12500 },
  'repos = 3': { ...INP_C4, repos: 3, nbSortie: OAD.nbSortiePourRepos(3) }
};
const REGIMES_C5 = ['propriete', 'fermage', 'metayage'];
const VUES_C5 = ['1', 'exp', 'prop'];

test('C5 — la cascade somme au différentiel', () => {
  let combinaisons = 0;
  for (const [nomJeu, inp] of Object.entries(JEUX_C5)) {
    const sc = OAD.construireScenarios(inp);
    for (const regime of REGIMES_C5) {
      const fv = { ...inp.fv, regime };
      for (const vue of VUES_C5) {
        const c = OAD.cascadeDifferentielle(sc.arrachage, sc.reference, inp, fv, vue);
        const somme = c.termes.reduce((s, t) => s + t.montant, 0);
        // Tolérance 1 € (celle du chantier) — en pratique l'écart est nul au
        // flottant près, la marge couvre l'accumulation sur 11 années.
        assertClose(somme, c.total, 1,
          `${nomJeu} / ${regime} / vue ${vue} : Σ termes ≠ total`);
        // …et le total EST bien le différentiel de C4, pas un autre calcul.
        const d = OAD.differentielTresorerie(sc.arrachage, sc.reference, fv, vue, { parcelleSeule: true });
        assertClose(c.total, d.aHorizon, 1e-6,
          `${nomJeu} / ${regime} / vue ${vue} : le total de la cascade doit être le différentiel de C4`);
        assert.strictEqual(c.termes.length, 4, 'la cascade compte exactement quatre termes');
        combinaisons++;
      }
    }
  }
  assert.strictEqual(combinaisons, 36, '4 jeux × 3 régimes × 3 vues');
});

test("C5 — fermage : le loyer s'annule dans le différentiel", () => {
  // `repartir` retranche loyerAn à l'exploitant et le verse au propriétaire,
  // à l'identique dans les deux scénarios : il disparaît de la soustraction.
  // Il n'y a donc PAS de cinquième terme de loyer dans la cascade — et une
  // session ultérieure qui en ajouterait un ferait échouer ce test.
  const inp = INP_C4;
  const sc = OAD.construireScenarios(inp);
  const totalPour = (loyerAn, vue) => OAD.cascadeDifferentielle(
    sc.arrachage, sc.reference, inp, { ...inp.fv, regime: 'fermage', loyerAn }, vue).total;
  for (const vue of VUES_C5) {
    const ref = totalPour(3000, vue);
    for (const loyer of [0, 12000, 99999]) {
      assertClose(totalPour(loyer, vue), ref, 1e-9,
        `vue ${vue} : le total de la cascade ne doit pas dépendre de loyerAn (loyer = ${loyer})`);
    }
  }
  // Corollaire : côté propriétaire, un fermage ne produit AUCUN différentiel.
  assertClose(totalPour(3000, 'prop'), 0, 1e-9,
    "en fermage, la part propriétaire du différentiel est nulle : le loyer est le même dans les deux scénarios");
});

test('C5 — métayage : chaque terme hérite du coefficient de repartir()', () => {
  // Vérification directe de la linéarité invoquée en commentaire dans le
  // moteur : termes « réserve » et « recettes » en (1 − partRecolte) côté
  // exploitant, termes « investissement » et « charges » en (1 − partCouts).
  const inp = INP_C4;
  const sc = OAD.construireScenarios(inp);
  const fvM = { ...inp.fv, regime: 'metayage', partRecolte: 0.33, partCouts: 0.33 };
  const ens = OAD.cascadeDifferentielle(sc.arrachage, sc.reference, inp, fvM, '1');
  const exp = OAD.cascadeDifferentielle(sc.arrachage, sc.reference, inp, fvM, 'exp');
  const prop = OAD.cascadeDifferentielle(sc.arrachage, sc.reference, inp, fvM, 'prop');
  const par = (c, id) => c.termes.find(t => t.id === id).montant;
  for (const id of ['reserve', 'recettes']) {
    assertClose(par(exp, id), (1 - fvM.partRecolte) * par(ens, id), 1e-6, `exp/${id}`);
    assertClose(par(prop, id), fvM.partRecolte * par(ens, id), 1e-6, `prop/${id}`);
  }
  for (const id of ['investissement', 'charges']) {
    assertClose(par(exp, id), (1 - fvM.partCouts) * par(ens, id), 1e-6, `exp/${id}`);
    assertClose(par(prop, id), fvM.partCouts * par(ens, id), 1e-6, `prop/${id}`);
  }
  // Conservation : exploitant + propriétaire = ensemble, terme à terme.
  for (const id of ['investissement', 'reserve', 'recettes', 'charges']) {
    assertClose(par(exp, id) + par(prop, id), par(ens, id), 1e-6, `conservation sur ${id}`);
  }
});

test('C5 — les signes attendus des quatre termes', () => {
  const inp = INP_C4;
  const sc = OAD.construireScenarios(inp);
  const c = OAD.cascadeDifferentielle(sc.arrachage, sc.reference, inp, inp.fv, '1');
  const par = id => c.termes.find(t => t.id === id).montant;
  assert.ok(par('investissement') < 0, "l'investissement est un décaissement : négatif");
  assert.ok(par('reserve') > 0, 'la réserve mobilisée entre en trésorerie : positif');
  assert.ok(par('recettes') < 0, 'la parcelle ne produit pas pendant la transition : négatif à 10 ans');
  assert.ok(par('charges') > 0, "les charges d'entretien évitées pendant la transition : positif");
});

// L'assertion interne du moteur est le garde-fou central du chantier : sans
// elle, une cascade fausse dériverait en silence.
test('C5 — GARDE-FOU : une cascade qui ne somme pas lève une exception', () => {
  const inp = INP_C4;
  const sc = OAD.construireScenarios(inp);
  // On fabrique une référence incohérente : ses coûts de parcelle sont amputés,
  // si bien que le total (calculé sur les séries) ne peut plus correspondre aux
  // termes (calculés sur chargesEntretien).
  const scRefTruque = {
    ...sc.reference,
    eur: sc.reference.eur.map(r => ({ ...r, coutsParcelle: r.coutsParcelle + 50000 }))
  };
  assert.throws(
    () => OAD.cascadeDifferentielle(sc.arrachage, scRefTruque, inp, inp.fv, '1'),
    /ne somme pas au différentiel/,
    'le moteur doit casser bruyamment, pas dériver en silence');
});

// Non-régression documentaire : les deux quantités retirées de la fiche d'audit
// ne se recomposent PAS avec le différentiel — c'est la raison du chantier, et
// ce test la mesure plutôt que de la croire sur parole.
test("C5 — l'empilement historique NE se recompose PAS avec le différentiel (raison du chantier)", () => {
  const inp = INP_C4_DEGRADE;
  const sc = OAD.construireScenarios(inp);
  const invest = sc.arrachage.investissement;
  const reserve = sc.arrachage.eur.reduce((a, r) => a + r.cashRI, 0);
  const chArr = OAD.chargesEntretien('arrachage', sc.arrachage.kg, inp);
  const chSQ = OAD.chargesEntretien('statuquo', sc.reference.kg, inp);
  const returnYear = 3 + inp.repos;
  let chargesEvitees = 0;
  for (let t = 0; t < returnYear; t++) {
    chargesEvitees += Math.max(0, (chSQ.parcelle[t] || 0) - (chArr.parcelle[t] || 0));
  }
  const mag = OAD.manqueAGagner(sc.arrachage, sc.reference, inp.prixKg).reduce((a, v) => a + v, 0);
  const empilement = -invest + reserve + chargesEvitees - mag;
  const differentiel = OAD.differentielTresorerie(
    sc.arrachage, sc.reference, inp.fv, '1', { parcelleSeule: true }).aHorizon;
  assert.ok(Math.abs(empilement - differentiel) > 1000,
    `l'empilement historique doit s'écarter nettement du différentiel (écart obtenu : ${Math.abs(empilement - differentiel).toFixed(0)} €) — `
    + "s'il tombait juste, le chantier C5 n'aurait pas lieu d'être");
  // …tandis que la cascade, elle, tombe juste.
  const c = OAD.cascadeDifferentielle(sc.arrachage, sc.reference, inp, inp.fv, '1');
  assertClose(c.termes.reduce((a, t) => a + t.montant, 0), differentiel, 1,
    'la cascade, elle, somme exactement au différentiel');
});

test('C5 — manqueAGagner reste exportée et marquée @deprecated', () => {
  assert.strictEqual(typeof OAD.manqueAGagner, 'function',
    'la fonction reste exportée pour compatibilité');
  const MOTEUR = require('fs').readFileSync(path.join(__dirname, '..', 'moteur-oad.js'), 'utf8');
  const i = MOTEUR.indexOf('function manqueAGagner');
  const avant = MOTEUR.slice(Math.max(0, i - 1400), i);
  assert.ok(/@deprecated chantier C5/.test(avant),
    'elle doit porter la marque @deprecated citant le chantier');
  assert.ok(/cascadeDifferentielle/.test(avant),
    'et renvoyer explicitement à la cascade qui la remplace');
});

test("C5 — l'écran et la fiche d'audit ne portent plus les montants épars", () => {
  // Écran : plus de bloc « Manque à gagner », plus de cartouches en euros
  // concurrents. Ces interdictions-ci survivent intactes à la refonte du
  // 08/09/2026 — c'est la cascade qui les remplaçait qui est partie, pas le
  // problème qu'elle résolvait.
  assert.ok(!/\{\{ magRows \}\}/.test(INDEX_HTML) && !/list="\{\{ magRows \}\}"/.test(INDEX_HTML),
    'le tableau « manque à gagner » ne doit plus être rendu à l\'écran');
  assert.ok(!/\{\{ kpiAmortisseur\./.test(INDEX_HTML),
    '« Réserve mobilisée » ne doit pas redevenir un cartouche');
  assert.ok(!/\{\{ kpiSoldeReserve\./.test(INDEX_HTML),
    'le solde investissement/réserve reste porté par le chiffre de tête et la fiche d\'audit, pas par un cartouche de plus');
  assert.ok(!/\{\{ kpiInvestTotal\./.test(INDEX_HTML),
    '« investissement brut » est le total de son propre tableau, plus un KPI concurrent');
  // Fiche d'audit : ni les deux entrées non recomposables, ni la cascade qui
  // les avait remplacées. Le détail annuel y est désormais la matrice par
  // thème, construite une seule fois et partagée avec l'écran.
  const rows = INDEX_HTML.slice(INDEX_HTML.indexOf('out.printKpiRows = ['));
  assert.ok(!/lib: 'Charges évitées en transition'/.test(rows),
    "« Charges évitées » retirée de la fiche : non recomposable avec le différentiel");
  assert.ok(!/printCascadeRows/.test(CODE_SANS_COMMENTAIRES),
    'la cascade a quitté la fiche avec le différentiel qu\'elle décomposait');
  const feuille = INDEX_HTML.slice(INDEX_HTML.indexOf('class="print-sheet"'));
  assert.ok(feuille.indexOf('{{ matriceRows }}') > 0,
    "la fiche d'audit doit porter la matrice annuelle par thème");
  assert.ok(!/\{\{ r\.cashNet \}\}/.test(INDEX_HTML),
    "la colonne « cash net » de l'ancien détail annuel ne doit pas survivre dans la fiche");
});

test('C5 — la réserve en kg/ha reste affichée, et hors de toute somme en euros', () => {
  // La réserve à l'horizon n'est ni un terme d'une somme, ni un montant : elle
  // reste visible à l'écran, en kilos. Le point bas de trésorerie, lui, est
  // parti avec la série cumulée dont il était l'extremum (refonte 08/09/2026).
  // Suppression du 08/09/2026 : elle n'est plus portée par un cartouche de KPI
  // mais par la phrase de synthèse du temps 3. Elle reste affichée, en kilos.
  assert.ok(/\{\{ reserveHorizonTxt \}\}/.test(INDEX_HTML),
    "la réserve à l'horizon reste affichée");
  assert.ok(!/\{\{ kpiPointBas/.test(INDEX_HTML),
    "le point bas de trésorerie a quitté l'écran avec la piste qui le portait");
  // Le garde-fou du moteur, lui, ne bouge pas : la cascade reste incapable
  // d'absorber un stock ou un extremum, quand bien même on la rappellerait.
  const MOTEUR = require('fs').readFileSync(path.join(__dirname, '..', 'moteur-oad.js'), 'utf8');
  const bloc = MOTEUR.slice(MOTEUR.indexOf('function cascadeDifferentielle'));
  const corps = bloc.slice(0, bloc.indexOf('\n}'));
  for (const mot of ['pointBas', 'creux', 'stockHa', 'reserveHorizon']) {
    assert.ok(!new RegExp(mot).test(corps),
      `« ${mot} » ne doit pas entrer dans la cascade : ce n'est pas un terme d'une somme`);
  }
});

// ----------------------------------------------------------------------
// Section 35 — chantier C7 : bloc « hypothèses non modélisées » sur la fiche
// d'audit, et robustesse de l'année du creux de réserve.
//
// Une fiche d'audit qui ne dit pas ce qu'elle NE calcule PAS n'est pas
// auditable : le lecteur ne peut pas savoir où s'arrête la garantie.
// ----------------------------------------------------------------------

section("35. Hypothèses non modélisées et robustesse de tMin (chantier C7)");

test('C7 — tMin robuste', () => {
  // L'ancienne écriture était `kg.find(r => r.stockHa === stockMin).t`, une
  // ÉGALITÉ DE FLOTTANTS. On rejoue ici la logique retenue (reduce sur le
  // minimum) sur une série comportant des valeurs très proches, dont deux que
  // l'arithmétique flottante ne rend pas exactement égales à leur propre
  // minimum recalculé.
  const creuxDe = (serie) => serie.reduce((min, r) => (r.stockHa < min.stockHa ? r : min), serie[0]);

  // (a) Cas nominal : le minimum est unique et bien identifié.
  const s1 = [9000, 7000, 4514.333333, 4514.333334, 6000, 8000].map((v, t) => ({ t, stockHa: v }));
  const c1 = creuxDe(s1);
  assert.strictEqual(c1.t, 2, "l'année du minimum doit être 2");
  assertClose(c1.stockHa, 4514.333333, 1e-9);

  // (b) Valeurs très proches (écart au dernier bit) : aucune exception, et
  //     l'année rendue est bien celle du plus petit.
  const base = 0.1 + 0.2;                 // 0.30000000000000004
  const s2 = [1, base, 0.3, base, 2].map((v, t) => ({ t, stockHa: v }));
  const c2 = creuxDe(s2);
  assert.strictEqual(c2.t, 2, '0,3 est strictement inférieur à 0.1 + 0.2 : année 2');

  // (c) Ex æquo exacts : la PREMIÈRE occurrence est retenue (comportement
  //     stable et documenté, identique à celui de l'ancien `find`).
  const s3 = [5, 3, 3, 9].map((v, t) => ({ t, stockHa: v }));
  assert.strictEqual(creuxDe(s3).t, 1, 'en cas d\'ex æquo, la première année gagne');

  // (d) Le cas qui cassait l'ancienne écriture : un minimum recalculé par une
  //     autre voie (ici une somme flottante) n'est pas bit-à-bit égal à la
  //     valeur présente dans la série. `find` rendrait undefined, puis lèverait.
  const serieArrondie = [0.7, 0.1 + 0.2 + 0.4, 0.9].map((v, t) => ({ t, stockHa: v }));
  const minRecalcule = Math.min(...serieArrondie.map(r => r.stockHa));
  const parEgalite = serieArrondie.find(r => r.stockHa === (0.1 + 0.2 + 0.4 + 0) * 1.0000000000000002);
  assert.strictEqual(parEgalite, undefined,
    'démonstration : une égalité de flottants peut ne rien trouver');
  // …alors que le reduce, lui, rend toujours une ligne.
  const c4 = creuxDe(serieArrondie);
  assert.ok(c4 && typeof c4.t === 'number', 'le reduce rend toujours une ligne valide');
  assertClose(c4.stockHa, minRecalcule, 1e-12);

  // (e) La vue utilise bien cette écriture, plus l'égalité de flottants.
  //     On lit le CODE sans les commentaires : celui du chantier C7 cite
  //     volontairement l'ancienne expression pour expliquer ce qui la remplace.
  assert.ok(!/find\(r => r\.stockHa === stockMin\)/.test(CODE_SANS_COMMENTAIRES),
    "l'égalité de flottants doit avoir disparu du code de index.html");
  assert.ok(/reduce\(\s*\r?\n?\s*\(min, r\) => \(r\.stockHa < min\.stockHa \? r : min\)/.test(INDEX_HTML),
    'le minimum et son année doivent être trouvés par comparaison, en un seul passage');
});

test("C7 — la fiche d'audit porte les six omissions structurantes", () => {
  const i = INDEX_HTML.indexOf('out.printLimitesRows = [');
  assert.ok(i > 0, 'le bloc doit exister dans le script');
  const bloc = INDEX_HTML.slice(i, INDEX_HTML.indexOf('];', i));
  const attendus = [
    'Aucune actualisation.',
    "Aucune valeur terminale d'actif.",
    'Aucun coût de financement.',
    'Aucun échéancier de paiement.',
    'Prix du raisin unique et constant.',
    'Rendement butoir non modélisé.'
  ];
  for (const titre of attendus) {
    assert.ok(bloc.includes(titre), `omission manquante sur la fiche : « ${titre} »`);
  }
  // Exactement six, ni plus ni moins : le chantier les énumère.
  const nb = (bloc.match(/\{ titre:/g) || []).length;
  assert.strictEqual(nb, 6, 'six omissions, telles qu\'énumérées par le chantier C7');
  // …et le bloc est rendu par le template de la fiche d'audit.
  assert.ok(/list="\{\{ printLimitesRows \}\}"/.test(INDEX_HTML),
    'le bloc doit être rendu dans la sortie « fiche d\'audit »');
  const feuille = INDEX_HTML.slice(INDEX_HTML.indexOf('class="print-sheet"'));
  assert.ok(feuille.indexOf('{{ printLimitesRows }}') > 0,
    "il doit se trouver dans la feuille d'audit, pas dans la remise au vigneron");
});

test("C7 — l'échéancier est mentionné avec ses valeurs de campagne, datées", () => {
  // Point 4 : obligatoire, parce que le point bas de trésorerie est présenté
  // dans un contexte de financement. Sans lui, le lecteur croit lire une
  // trésorerie datée alors que le modèle raisonne en année pleine.
  const i = INDEX_HTML.indexOf('out.printLimitesRows = [');
  const bloc = INDEX_HTML.slice(i, INDEX_HTML.indexOf('];', i));
  assert.ok(/année pleine/.test(bloc), 'la convention de temps doit être dite explicitement');
  assert.ok(/25 %/.test(bloc) && /2 200 kg\/ha/.test(bloc) && /5 décembre/.test(bloc),
    "l'échéancier 2026 doit être cité : 25 % du volume commercialisable au 5 décembre");
  assert.ok(/à revérifier à chaque campagne/.test(bloc),
    'une valeur annuelle doit porter son avertissement de péremption');
  assert.ok(/15 500 kg\/ha|RENDEMENT_BUTOIR_2026/.test(bloc + INDEX_HTML.slice(Math.max(0, i - 400), i)),
    'le rendement butoir 2026 doit être cité avec sa valeur');
});

test("C7 — le bloc ne promet aucun module de financement", () => {
  const i = INDEX_HTML.indexOf('out.printLimitesRows = [');
  const bloc = INDEX_HTML.slice(i, INDEX_HTML.indexOf('];', i));
  // Il dit ce qui n'est pas fait ; il n'annonce pas que ce sera fait.
  for (const mot of ['prochainement', 'à venir', 'sera ajouté', 'future version', 'bientôt']) {
    assert.ok(!new RegExp(mot, 'i').test(bloc),
      `le bloc constate une limite, il ne promet rien : « ${mot} »`);
  }
});

// ----------------------------------------------------------------------
// Section 36 — refonte du temps 3 : six thèmes sur un axe d'années
// (arbitrage du 08/09/2026, README §18bis et §19ter).
//
// L'écran de résultats se lisait en cinq onglets rangés par bloc de code, et
// sa frise portait une piste de trésorerie cumulée négative dans la
// quasi-totalité des configurations. Il se lit désormais par THÈME et par
// ANNÉE : six pistes, six cartes, un panneau d'année, une matrice.
//
// Ce que cette section verrouille, ce sont les DEUX invariants qui peuvent
// devenir faux sans lever d'exception — les postes d'investissement qui ne
// somment plus au total du moteur, et les deux chemins du déblocage en euros
// qui divergent — plus la porte fermée sur la trésorerie.
// ----------------------------------------------------------------------

section("36. Temps 3 par thème et par année (refonte du 08/09/2026)");

test("les postes d'investissement par année somment à sc.arrachage.investissement", () => {
  /* La piste « Investissements » de la frise et la carte du thème 5 empilent
     quatre postes (cinq avec l'arrosage), datés en année 0 puis en année
     `repos`. Le TOTAL affiché, lui, vient du moteur. Si la décomposition de la
     vue s'écarte de `invArr`, l'écran montre une pile dont la hauteur ne
     correspond à aucun total — sans que rien ne casse.
     On rejoue ici la décomposition d'index.html, terme à terme. */
  const jeux = [
    ['défauts', INP_A],
    ['repos = 3', INP_B_REPOS3],
    ['avec arrosage', { ...INP_A, irrigation: true, coutIrrigHa: 5000 }],
    ['stress climatique', INP_C_STRESS]
  ];
  for (const [nom, inp] of jeux) {
    const sc = OAD.construireScenarios(inp);
    const S = inp.surfParc;
    // `|| 0` sur la protection : même repli que `invArr` dans le moteur, dont
    // cette décomposition doit être le décalque exact (chantier C2). Les
    // fixtures antérieures au chantier P8 ne portent pas ce poste.
    const postes = [
      { t: 0, montant: S * inp.coutArrachageHa },
      { t: inp.repos, montant: S * inp.densite * inp.coutPlant },
      { t: inp.repos, montant: S * inp.coutPalissageHa },
      { t: inp.repos, montant: S * (inp.coutProtectionHa || 0) }
    ];
    if (inp.irrigation) postes.push({ t: inp.repos, montant: S * inp.coutIrrigHa });
    // Somme des postes, et somme des colonnes d'année : les deux doivent
    // valoir le total du moteur, sans quoi la pile aurait perdu une colonne.
    const parPoste = postes.reduce((a, p) => a + p.montant, 0);
    const parAnnee = sc.arrachage.kg
      .map(r => postes.filter(p => p.t === r.t).reduce((a, p) => a + p.montant, 0))
      .reduce((a, v) => a + v, 0);
    assertClose(parPoste, sc.arrachage.investissement, 1e-6,
      `${nom} — la somme des postes doit être l'investissement du moteur`);
    assertClose(parAnnee, sc.arrachage.investissement, 1e-6,
      `${nom} — répartie sur les colonnes d'année, elle doit tomber sur le même total`);
  }
  // …et la vue ne déclare la liste qu'UNE fois, partagée par le tableau, la
  // carte et la piste : deux listes du même fait finissent par diverger.
  assert.ok(/const POSTES_INVEST = \[/.test(INDEX_HTML),
    'les postes doivent être déclarés en un seul endroit');
  assert.ok(/out\.investLignes = POSTES_INVEST\.map/.test(INDEX_HTML),
    'le tableau poste par poste doit dériver de cette liste, pas la redéclarer');
  assert.ok(/const investPostes = POSTES_INVEST\.map/.test(INDEX_HTML),
    'la piste de la frise doit dériver de la même liste');
});

test("les deux chemins du déblocage en euros ne peuvent pas diverger", () => {
  /* Le thème 3 affiche `sortieArr × prixKg`, tandis que la couche euro du
     moteur produit `cashRI`. Ce sont deux écritures du MÊME fait
     (coucheEuro : `cashRI = sortieArr × prixKg`) : si elles divergeaient, la
     frise et la matrice montreraient un montant que le moteur ne connaît pas.
     Le test balaie plusieurs paramétrages, dont un où la réserve est trop
     basse pour servir tous les déblocages. */
  const jeux = [
    ['défauts', INP_A],
    ['repos = 3', INP_B_REPOS3],
    ['stress climatique', INP_C_STRESS],
    ['réserve initiale basse', { ...INP_A, reserveInit: 500, volco: 12500 }],
    ['prix élevé', { ...INP_A, prixKg: 9.4 }]
  ];
  for (const [nom, inp] of jeux) {
    const sc = OAD.construireScenarios(inp);
    const parKg = sc.arrachage.kg.reduce((a, r) => a + r.sortieArr * inp.prixKg, 0);
    const parEuro = sc.arrachage.eur.reduce((a, r) => a + r.cashRI, 0);
    assertClose(parKg, parEuro, 1e-6,
      `${nom} — Σ sortieArr × prixKg doit égaler Σ cashRI`);
    // Année par année aussi, pas seulement en somme : une compensation entre
    // deux années passerait à travers un test sur le seul total.
    sc.arrachage.kg.forEach((r, i) => {
      assertClose(r.sortieArr * inp.prixKg, sc.arrachage.eur[i].cashRI, 1e-6,
        `${nom} — année ${r.t}`);
    });
  }
  // Et la vue lit bien cette formule-là, pas une autre.
  assert.ok(/const deblocEur = kgRows\.map\(r => r\.sortieArr \* inp\.prixKg\)/.test(INDEX_HTML),
    'le déblocage en euros doit être sortieArr × prixKg, la même écriture que cashRI');
});

test("le gabarit du temps 3 ne porte plus de trésorerie, ni à l'écran ni à l'impression", () => {
  /* Critère de la refonte : le mot ne doit plus apparaître dans l'écran du
     temps 3 ni dans les deux sorties d'impression. On lit le gabarit SANS ses
     commentaires — ceux-ci documentent volontairement ce qui a été retiré et
     pourquoi, et un test qui lirait le fichier brut échouerait sur sa propre
     documentation (même procédé qu'aux chantiers C2, C3 et C5). */
  const debut = CODE_SANS_COMMENTAIRES.indexOf('</helmet>');
  const fin = CODE_SANS_COMMENTAIRES.indexOf('</x-dc>');
  assert.ok(debut > 0 && fin > debut, 'le gabarit doit être délimitable');
  const gabarit = CODE_SANS_COMMENTAIRES.slice(debut, fin);
  assert.ok(!/trésorerie/i.test(gabarit),
    'plus aucune occurrence de « trésorerie » dans le gabarit — écran et sorties d\'impression comprises');
  // Ni appel au moteur sur ces deux fonctions, où que ce soit dans le code.
  assert.ok(!/tresorerieCumulee|differentielTresorerie/.test(CODE_SANS_COMMENTAIRES),
    'la vue ne doit plus appeler tresorerieCumulee ni differentielTresorerie');
  // La frise porte bien SIX pistes, dont aucune de cumul en euros. On lit le
  // CODE de la fonction (commentaires retirés), borné à son accolade fermante
  // — le fichier est en CRLF, d'où le \r? de la borne.
  const frise = CODE_SANS_COMMENTAIRES.slice(
    CODE_SANS_COMMENTAIRES.indexOf('friseTrajectoire(d) {'));
  const finCorps = frise.search(/\r?\n {2}\}\r?\n/);
  assert.ok(finCorps > 0, 'la fonction friseTrajectoire doit être délimitable');
  const corps = frise.slice(0, finCorps);
  ['piste1', 'piste2', 'piste3', 'piste4', 'piste5', 'piste6'].forEach(p => {
    assert.ok(new RegExp('const ' + p + ' =').test(corps), 'la frise doit porter ' + p);
  });
  assert.ok(!/treso|pointBas/i.test(corps),
    'aucune piste de la frise ne doit lire une série de trésorerie ou son point bas');
  assert.ok(!/const piste7 =/.test(corps),
    'six pistes, pas sept : une piste de plus est un thème de plus, qui se décide, pas qui s\'ajoute');
});

test("la frise, le panneau d'année et la matrice lisent la même année retenue", () => {
  // Une seule année sélectionnée à l'écran : l'axe et la matrice écrivent le
  // même état, et les six pistes le lisent. Deux sélections concurrentes
  // donneraient une frise qui souligne une année et un panneau qui en détaille
  // une autre — faux sans jamais lever.
  assert.ok(/anneeSel, boutonsAnnee/.test(INDEX_HTML),
    'la frise doit recevoir l’année retenue et les boutons de l’axe');
  const occurrences = (INDEX_HTML.match(/setState\(\{ anneeFrise: t \}\)/g) || []).length;
  assert.strictEqual(occurrences, 2,
    'deux points d’écriture, un pour l’axe et un pour la matrice, et pas un troisième état parallèle');
  assert.ok(/const anneeSel = Math\.max\(0, Math\.min\(inp\.horizon, \+s\.anneeFrise \|\| 0\)\)/.test(INDEX_HTML),
    'l’année retenue doit être bornée à l’horizon : un changement de paramétrage ne doit jamais laisser une sélection hors axe');
  // Le panneau et la matrice sont bien rendus, et la matrice sert les deux
  // sorties (écran et fiche d'audit) depuis une seule construction.
  assert.ok(/list="\{\{ anneePanneau \}\}"/.test(INDEX_HTML),
    'le panneau de l’année retenue doit être rendu');
  assert.strictEqual((INDEX_HTML.match(/list="\{\{ matriceRows \}\}"/g) || []).length, 2,
    'la matrice doit être rendue deux fois — à l’écran et sur la fiche d’audit — depuis la même construction');
  assert.strictEqual((INDEX_HTML.match(/out\.matriceRows = /g) || []).length, 1,
    'une seule construction de la matrice : l’écran et l’imprimé ne doivent pas pouvoir diverger');
});

test("phaseParAnnee couvre les onze années sans trou — déjà figé en §21", () => {
  /* Ce test ne duplique pas la section 21, il vérifie que la garantie qu'elle
     pose est bien celle dont la frise dépend : une entrée par colonne d'année,
     aucune valeur absente, sur toutes les durées de repos offertes à l'écran.
     Sans elle, une piste s'afficherait décalée d'une colonne par rapport aux
     cinq autres. */
  [1, 2, 3].forEach(repos => {
    const phases = OAD.phaseParAnnee(repos, 10);
    assert.strictEqual(phases.length, 11,
      `repos = ${repos} : onze colonnes d'année, comme la graduation de la frise`);
    phases.forEach((p, t) => {
      assert.ok(['arrachage', 'repos', 'plantier', 'production'].includes(p),
        `repos = ${repos}, année ${t} : phase inconnue « ${p} »`);
    });
    // Chaque année de phaseParAnnee retombe bien dans un segment de
    // phasesParcelle : les deux découpes, celle des segments et celle des
    // colonnes, doivent raconter la même chronologie.
    const segs = OAD.phasesParcelle(repos, 10);
    phases.forEach((p, t) => {
      const seg = segs.find(sg => t >= sg.debut && t < sg.fin);
      assert.ok(seg && seg.id === p,
        `repos = ${repos}, année ${t} : la colonne et le segment doivent désigner la même phase`);
    });
  });
  // Et la vue lit bien les deux, sans en recomposer une troisième.
  assert.ok(/OAD\.phaseParAnnee\(inp\.repos, inp\.horizon\)/.test(INDEX_HTML),
    'la phase par année doit venir du moteur');
  assert.ok(/const segmentsFrise = OAD\.phasesParcelle\(inp\.repos, inp\.horizon\)/.test(INDEX_HTML),
    'les segments doivent venir du moteur, et non être redécoupés dans la vue');
});

// ----------------------------------------------------------------------
// Bilan
// ----------------------------------------------------------------------

console.log(`\n${passed} ok, ${failed} FAIL, ${skipped} skip`);
if (failed > 0) process.exit(1);
