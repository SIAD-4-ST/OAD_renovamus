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
  coutArrachageHa: 4500,
  coutPrepaHa: 3500,
  coutPlant: 1.8,
  coutPalissageHa: 13116,
  irrigation: false,
  coutIrrigHa: 5000,
  coutEntreplant: 4.5,
  survie: 0.5,
  entreeProd: 7,
  prixKg: 7,
  coutSurfaceHaAn: 0,
  coutRdtParKg: 0,
  coefRepos: 0,
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

test('(a) cas base (défauts UI)', () => {
  const sc = OAD.construireScenarios(INP_A);
  assert.deepStrictEqual(snapshotScenarios(sc), {
    arrachage: { investissement: 10797, cashRITotal: 56700, cumulCashNet10: 663303, stockFin10: 10000, stockHaMin: 4622 },
    complantation: { investissement: 3347, cashRITotal: 0, cumulCashNet10: 689653, stockFin10: 10000 },
    statuquo: { investissement: 0, cashRITotal: 0, cumulCashNet10: 693000, stockFin10: 10000 }
  });
});

test('(b) motif sanitaire (repos=3, nbSortie=5)', () => {
  const sc = OAD.construireScenarios(INP_B_SANITAIRE);
  assert.deepStrictEqual(snapshotScenarios(sc), {
    arrachage: { investissement: 10797, cashRITotal: 94500, cumulCashNet10: 663303, stockFin10: 10000, stockHaMin: 3837 },
    complantation: { investissement: 3347, cashRITotal: 0, cumulCashNet10: 689653, stockFin10: 10000 },
    statuquo: { investissement: 0, cashRITotal: 0, cumulCashNet10: 693000, stockFin10: 10000 }
  });
});

test('(c) stress rendYearFn années 3-4 (creux régional)', () => {
  const sc = OAD.construireScenarios(INP_C_STRESS);
  assert.deepStrictEqual(snapshotScenarios(sc), {
    arrachage: { investissement: 10797, cashRITotal: 56700, cumulCashNet10: 659777, stockFin10: 10000, stockHaMin: 0 },
    complantation: { investissement: 3347, cashRITotal: 0, cumulCashNet10: 689653, stockFin10: 10000 },
    statuquo: { investissement: 0, cashRITotal: 0, cumulCashNet10: 693000, stockFin10: 10000 }
  });
});

test('(d) métayage 33/33 — construireScenarios identique à (a), fv ignoré par le moteur kg/€', () => {
  const sc = OAD.construireScenarios(INP_D_METAYAGE);
  assert.deepStrictEqual(snapshotScenarios(sc), {
    arrachage: { investissement: 10797, cashRITotal: 56700, cumulCashNet10: 663303, stockFin10: 10000, stockHaMin: 4622 },
    complantation: { investissement: 3347, cashRITotal: 0, cumulCashNet10: 689653, stockFin10: 10000 },
    statuquo: { investissement: 0, cashRITotal: 0, cumulCashNet10: 693000, stockFin10: 10000 }
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
  assert.strictEqual(Math.round(cumExp), 610349);
  assert.strictEqual(Math.round(cumProp), 52954);
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
const INP_E_CHARGES = { ...INP_A, declinSQ: 0, coutSurfaceHaAn: 1200, coutRdtParKg: 0.15 };
const SC_E = OAD.construireScenarios(INP_E_CHARGES);

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
// Bilan
// ----------------------------------------------------------------------

console.log(`\n${passed} ok, ${failed} FAIL, ${skipped} skip`);
if (failed > 0) process.exit(1);
