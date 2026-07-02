const M = require('./moteur.js');
let ok = 0, ko = 0;
const check = (n, c, d) => c ? (ok++, console.log('  ✓', n)) : (ko++, console.log('  ✗', n, d ?? ''));

console.log('T1 — Parité classeur (facteurs neutres)');
const rowsP = M.simulerReserveKg({ scenario: 'arrachage', surfTot: 1, surfArr: 0.3, repos: 1,
  nbSortie: 3, volSortieArr: 9000, plafond: 10000, volco: 9000, rendMean: 12296.6,
  reserveInit: 5250, optInsuff: true, horizon: 10, rampProfile: [1], rendFactorProjet: 1 });
const minP = rowsP.reduce((a, r) => r.stockHa < a.v ? { v: r.stockHa, t: r.t } : a, { v: 1e12, t: -1 });
check('min ≈ 5021.8 @ 3', Math.abs(minP.v - 5021.8) < 0.5 && minP.t === 3, `${minP.v.toFixed(1)}@${minP.t}`);
check('final = 10000', Math.abs(rowsP[10].stockHa - 10000) < 0.5);
check('Σ arr = 8100', Math.abs(rowsP.reduce((s, r) => s + r.sortieArr, 0) - 8100) < 0.5);
check('Σ mise = 12850', Math.abs(rowsP.reduce((s, r) => s + r.mise, 0) - 12850) < 0.5);

const inp = { surfTot: 1, surfParc: 0.3, repos: 1, nbSortie: 3, volSortieArr: 9000, plafond: 10000,
  volco: 9000, rendMean: 12296.6, reserveInit: 7500, horizon: 10, ramp: [0.3, 0.6, 1], rendYearFn: null,
  rendEstime: 10500, manquants: 0.15, declinSQ: 0, densite: 8264, coutArrachageHa: 4500, coutPrepaHa: 3500,
  coutPlant: 1.4, coutPalissageHa: 12000, irrigation: false, coutIrrigHa: 5000, coutEntreplant: 4.5,
  survie: 0.5, entreeProd: 7, prixKg: 6.5, rendFactorProjet: 1 };
const sc = M.construireScenarios(inp);

console.log('T2 — Non-arrachage : MàG dérivé = 0, vente = VolCo plein');
check('MàG(SQ vs SQ)=0', M.manqueAGagner(sc.statuquo, sc.statuquo, inp.prixKg).every(v => v === 0));
check('vente t0 = VolCo plein', Math.abs(sc.statuquo.eur[0].venteRaisin - 9000 * 6.5) < 0.01);

console.log('T3 — Sortie arrachage nulle hors arrachage');
check('SQ Σ arr=0', sc.statuquo.kg.every(r => r.sortieArr === 0));
check('compl Σ arr=0', sc.complantation.kg.every(r => r.sortieArr === 0));

console.log('T4 — Sorties ≤ stock disponible');
check('arrachage', sc.arrachage.kg.every(r => r.sortieInsuff + r.sortieArr <= r.stockDebut + r.mise + 1e-9));

console.log('T5 — Ramp jeunes vignes : cash(ramp) ≤ cash(plat)');
const cR = M.cumul(sc.arrachage.eur, 'cashNet')[10];
const cF = M.cumul(M.construireScenarios({ ...inp, ramp: [1] }).arrachage.eur, 'cashNet')[10];
check('ramp ≤ plat', cR <= cF + 1e-6, `${cR.toFixed(0)} vs ${cF.toFixed(0)}`);

console.log('T6 — Stock initial identique ×3');
check('idem', sc.arrachage.kg[0].stockDebut === sc.statuquo.kg[0].stockDebut &&
  sc.complantation.kg[0].stockDebut === sc.statuquo.kg[0].stockDebut);

console.log('T7 — NOUVEAU : rendement projet -> VolCo (l\'effet mord la réserve, pas la vente en année normale)');
// Enseignement clé : en année normale, le coussin au-dessus du VolCo + le plafond
// absorbent une pénalité VSL modérée — elle est quasi invisible. L'effet n'apparaît
// que SOUS STRESS (mauvaise année), où il creuse davantage la réserve et finit par
// mordre la vente. Le moteur le reflète correctement ; c'est un gage de crédibilité.
const bad = t => (t === 4 || t === 5) ? 12296.6 - 3440 : 12296.6;
const minStress = f => Math.min(...M.construireScenarios({ ...inp, rendYearFn: bad, rendFactorProjet: f }).arrachage.kg.map(r => r.stockHa));
check('sous stress : rendement ↓ ⇒ creux de réserve plus profond', minStress(0.7) < minStress(1), `${minStress(0.7).toFixed(0)} vs ${minStress(1).toFixed(0)}`);
const revBad100 = M.cumul(M.construireScenarios({ ...inp, rendYearFn: bad, rendFactorProjet: 1 }).arrachage.eur, 'venteRaisin')[10];
const revBad60 = M.cumul(M.construireScenarios({ ...inp, rendYearFn: bad, rendFactorProjet: 0.6 }).arrachage.eur, 'venteRaisin')[10];
check('sous VolCo (mauvaise année) ⇒ vente <', revBad60 < revBad100, `${revBad60.toFixed(0)} vs ${revBad100.toFixed(0)}`);

console.log('T8 — NOUVEAU : répartition conserve le total (3 régimes)');
const row = sc.arrachage.eur[1];
for (const fv of [{ regime: 'propriete' }, { regime: 'fermage', loyerAn: 3000 },
                  { regime: 'metayage', partRecolte: 1 / 3, partCouts: 1 / 3 }]) {
  const r = M.repartir(row, fv);
  check(`total conservé (${fv.regime})`, Math.abs(r.exp + r.prop - row.cashNet) < 1e-9,
    `${(r.exp + r.prop).toFixed(2)} vs ${row.cashNet.toFixed(2)}`);
}

console.log('T9 — NOUVEAU : fermage ⇒ propriétaire = loyer chaque année');
check('prop = loyer', sc.arrachage.eur.every(r =>
  Math.abs(M.repartir(r, { regime: 'fermage', loyerAn: 3000 }).prop - 3000) < 1e-9));

console.log(`\n${ok} ✓ / ${ko} ✗`);
process.exit(ko ? 1 : 0);
