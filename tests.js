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

console.log('T18 — Palissage : total = Σ(quantité × prix unitaire)');
const geoRef = { nbRangs: 54, L: 168.35, surf: 1 };
const cpRef = M.coutPalissage(geoRef, null, { espacementPiquet: 4.3, nbFils: 4 });
check('somme des lignes = total parcelle',
  Math.abs(cpRef.lignes.reduce((s, l) => s + l[3], 0) - cpRef.totalParcelle) < 1e-6);
check('chaque ligne = qté × prix',
  cpRef.lignes.every(l => Math.abs(l[1] * l[2] - l[3]) < 1e-6));

console.log('T19 — Règle B : espacement plus court ⇒ plus de piquets ⇒ coût plus élevé');
const cp6 = M.coutPalissage(geoRef, null, { espacementPiquet: 6, nbFils: 4 });
const cp4 = M.coutPalissage(geoRef, null, { espacementPiquet: 4.3, nbFils: 4 });
check('coût(4,3 m) > coût(6 m)', cp4.totalHa > cp6.totalHa, `${cp4.totalHa.toFixed(0)} vs ${cp6.totalHa.toFixed(0)}`);
check('6 m sous-chiffre vs LutEnVi (< référence ~17 200 €/ha)', cp6.totalHa < 17200);

console.log('T20 — Choix C : plus de fils ⇒ coût plus élevé (fils + gripple)');
const cpF4 = M.coutPalissage(geoRef, null, { espacementPiquet: 6, nbFils: 4 });
const cpF5 = M.coutPalissage(geoRef, null, { espacementPiquet: 6, nbFils: 5 });
check('coût(5 fils) > coût(4 fils)', cpF5.totalHa > cpF4.totalHa);

console.log('T21 — Parité pricing LutEnVi (counts imposés → totaux attendus)');
// à espacement 4,3 m : ~2052 piquets interm (vs 2066 LutEnVi) ; on borne le total dérivé
check('total dérivé (4,3 m) proche référence LutEnVi ±5 %',
  Math.abs(cp4.totalHa - 17235) / 17235 < 0.05, `${cp4.totalHa.toFixed(0)} vs 17235`);

console.log('T22 — Arbre PG : branches exactes du guide (p. 39)');
const a1 = M.preconPorteGreffe(30, '<30', 'sec');   // >25 %, superficiel
check('>25 % / <30 cm → 41 B & 333 EM',
  a1.match === 'exact' && a1.pg.join('/') === '41 B/333 EM');
const a2 = M.preconPorteGreffe(20, '30-60', 'drainant'); // 15-25 %, 30-60, drainant
check('15-25 % / 30-60 / drainant contient 161-49 C', a2.pg.includes('161-49 C'));
check('… et porte le renvoi dépérissement (note 3)',
  a2.notes.some(n => /dépérissement|d\u00e9p\u00e9rissement/.test(n)));

console.log('T23 — Arbre PG : données manquantes ⇒ pas de verdict');
check('sans calcaire → incomplet', M.preconPorteGreffe(NaN, '30-60', 'sec').match === 'incomplet');
check('calcaire < 5 % → hors-grille (pas de PG imposé)',
  M.preconPorteGreffe(3, '30-60', 'drainant').match === 'hors-grille');

console.log('T24 — Arbre PG : drainage non distingué ⇒ branches proches (approché)');
const a3 = M.preconPorteGreffe(30, '<30', 'humide'); // >25 % superficiel : guide ne distingue pas → wildcard
check('>25 % / <30 cm / humide → exact via wildcard (41 B & 333 EM)',
  a3.pg.join('/') === '41 B/333 EM');

/* ---- Charges d'entretien récurrentes — modèle (c) surface / rendement ---- */
const inpCh = { ...inp, repos: 2, coutSurfaceHaAn: 2000, coutRdtParKg: 0.4, coefRepos: 0.3 };
const scCh = M.construireScenarios(inpCh);
const returnYear = 3 + inpCh.repos;

console.log('T25 — Charges neutres (coûts nuls) ⇒ parité préservée');
const scZero = M.construireScenarios({ ...inp, coutSurfaceHaAn: 0, coutRdtParKg: 0, coefRepos: 0.3 });
check('couts statu quo = 0 sans charges', scZero.statuquo.eur.every(r => r.couts === 0));
check('couts arrachage identiques au cas sans champs',
  scZero.arrachage.eur.every((r, i) => Math.abs(r.couts - sc.arrachage.eur[i].couts) < 1e-6));

console.log('T26 — Statu quo n\'est plus gratuit (corrige le biais)');
check('charge de surface + rendement chaque année', scCh.statuquo.eur.every(r => r.couts > 0));

const surfRest = inpCh.surfTot - inpCh.surfParc;

console.log('T27 — Établissement : charge de SURFACE pleine, charge de RENDEMENT nulle sur la parcelle');
const tEtab = inpCh.repos + 1; // établissement pur (planté, non productif, sans coût ponctuel)
const rEtab = scCh.arrachage.kg[tEtab];
check('recolte exclut la parcelle en établissement', Math.abs(rEtab.recolte - inp.rendMean * surfRest) < 1e-6);
check('couts établissement = surface pleine (reste + parcelle) + rendement du reste',
  Math.abs(scCh.arrachage.eur[tEtab].couts - (2000 * (surfRest + inpCh.surfParc) + 0.4 * rEtab.recolte)) < 1e-6);

console.log('T28 — Jachère : charge de surface réduite au coefRepos sur la parcelle');
const tJach = 1; // t < repos, sans coût ponctuel (l'arrachage est à t=0)
const rJach = scCh.arrachage.kg[tJach];
check('couts jachère = surface (reste + coefRepos·parcelle) + rendement du reste',
  Math.abs(scCh.arrachage.eur[tJach].couts - (2000 * (surfRest + inpCh.coefRepos * inpCh.surfParc) + 0.4 * rJach.recolte)) < 1e-6);

console.log('T29 — Différentiel honnête : en établissement, l\'arrachage évite la vendange de la parcelle');
const rdtParcSQ = 0.4 * (scCh.statuquo.kg[tEtab].recolte - inp.rendMean * surfRest);
check('la parcelle vendange au statu quo (charge rdt parcelle > 0)', rdtParcSQ > 0);
check('la parcelle ne vendange pas à l\'arrachage (recolte parcelle = 0)',
  Math.abs(scCh.arrachage.kg[tEtab].recolte - inp.rendMean * surfRest) < 1e-6);

console.log('T30 — Effort net = investissement ponctuel − réserve (l\'entretien n\'y entre pas)');
check('investissement arrachage exposé et > 0', scCh.arrachage.investissement > 0);
check('investissement statu quo = 0', scCh.statuquo.investissement === 0);
const invNu = inp.surfParc * (inp.coutArrachageHa + inp.coutPrepaHa + inp.densite * inp.coutPlant + inp.coutPalissageHa);
check('investissement = Σ coûts ponctuels (hors entretien)', Math.abs(scCh.arrachage.investissement - invNu) < 1e-6);

console.log(`\n${ok} ✓ / ${ko} ✗`);
process.exit(ko ? 1 : 0);
