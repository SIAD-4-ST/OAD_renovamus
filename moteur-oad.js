if (typeof window === "undefined" || !window.OAD) {
/* =====================================================================
   OAD Renouvellement — moteur v1.1 (maquette)
   Couche kg (parité classeur) + couche € + 3 scénarios
   v1.1 : rendement des leviers -> VolCo ; répartition fermage/métayage
   ===================================================================== */

function simulerReserveKg(p) {
  const rows = [];
  const ramp = p.rampProfile || [1];
  const returnYear = 3 + p.repos;
  const surfRest = p.surfTot - p.surfArr;
  const fProjet = p.rendFactorProjet ?? 1;   // effet densité × matériel (VSL, Voltis…)
  let stockPrev = null;
  for (let t = 0; t <= p.horizon; t++) {
    const rendY = p.rendYearFn ? p.rendYearFn(t) : p.rendMean;
    let surfProd, recolteParcelle, recolteReste;
    if (p.scenario === 'arrachage') {
      const jeune = t >= returnYear;
      let f = 1;
      if (jeune) { const k = t - returnYear; f = k < ramp.length ? ramp[k] : 1; }
      surfProd = surfRest + (jeune ? p.surfArr : 0);
      // le rendement du bloc replanté porte le facteur projet -> alimente VolCo
      recolteReste = rendY * surfRest;
      recolteParcelle = jeune ? rendY * f * fProjet * p.surfArr : 0;
    } else {
      surfProd = p.surfTot;
      const rendParc = p.rendParcFn ? p.rendParcFn(t, rendY) : rendY;
      recolteReste = rendY * surfRest;
      recolteParcelle = rendParc * p.surfArr;
    }
    const recolte = recolteReste + recolteParcelle;
    const volco = surfProd * p.volco;
    const stockDebut = (t === 0) ? p.reserveInit * p.surfTot : stockPrev;
    const mise = Math.max(0, Math.min(recolte - volco,
      Math.max(0, (p.plafond - (surfProd === 0 ? 0 : stockDebut / surfProd)) * surfProd)));
    const deficit = Math.max(0, volco - recolte);
    const sortieInsuff = p.optInsuff ? Math.min(deficit, stockDebut) : 0;
    const sortieArr = (p.scenario === 'arrachage' && t >= 1 && t <= p.nbSortie)
      ? Math.min(p.volSortieArr * p.surfArr, Math.max(0, stockDebut - sortieInsuff))
      : 0;
    const stockFin = Math.max(0, stockDebut + mise - sortieInsuff - sortieArr);
    rows.push({ t, surfProd, rendY, recolte, recolteParcelle, recolteReste,
      volcoVendu: Math.min(recolte, volco) + sortieInsuff, volcoCible: volco,
      mise, deficit, sortieInsuff, sortieArr, stockDebut, stockFin,
      stockHa: surfProd === 0 ? 0 : stockFin / surfProd });
    stockPrev = stockFin;
  }
  return rows;
}

/* Décomposition parcelle / reste de l'exploitation — chantier 5.
   La part de récolte plafonnée par le VolCo est répartie au prorata de la
   récolte réelle de chacun (parcelle vs reste) : tant que le plafond n'est
   pas atteint, chacun vend l'intégralité de sa récolte ; le plafonnement,
   quand il joue, est donc partagé proportionnellement — aucune convention
   arbitraire n'est nécessaire dans le cas courant (recolte <= volco).
   `sortieInsuff` (déstockage de la réserve mutualisée) est en revanche
   TOUJOURS logé côté "reste" : le stock n'est jamais individualisé par
   parcelle dans simulerReserveKg, l'attribuer à la parcelle serait donc
   arbitraire — voir README §9/§10. */
function coucheEuro(rowsKg, eco) {
  return rowsKg.map(r => {
    const venduRecolte = Math.min(r.recolte, r.volcoCible);
    const ratioParcelle = r.recolte > 0 ? r.recolteParcelle / r.recolte : 0;
    const venduRecolteParcelle = venduRecolte * ratioParcelle;
    const venduRecolteReste = venduRecolte - venduRecolteParcelle;

    const venteRaisinParcelle = venduRecolteParcelle * eco.prixKg;
    const venteRaisinReste    = (venduRecolteReste + r.sortieInsuff) * eco.prixKg;
    const venteRaisin         = venteRaisinParcelle + venteRaisinReste;
    const cashRI              = r.sortieArr * eco.prixKg; // 100 % parcelle (sortieArr ~ surfArr)
    const coutsParcelle       = eco.coutsParcelleParAnnee[r.t] || 0;
    const coutsReste          = eco.coutsResteParAnnee[r.t] || 0;
    const couts                = coutsParcelle + coutsReste;
    return { t: r.t, venteRaisin, venteRaisinParcelle, venteRaisinReste,
             cashRI, couts, coutsParcelle, coutsReste,
             cashNet: venteRaisin + cashRI - couts,
             cashSansRI: venteRaisin - couts };
  });
}

/* Répartition faire-valoir — chantier 5 : le régime ne s'applique qu'aux
   flux ATTRIBUABLES À LA PARCELLE (venteRaisinParcelle, cashRI, coutsParcelle).
   Le reste de l'exploitation (venteRaisinReste, coutsReste — qui inclut la
   part mutualisée sortieInsuff, voir coucheEuro) reste 100 % exploitant,
   quel que soit le régime. Total conservé dans les 3 cas :
   exp + prop = revParcelle - coutsParcelle + resteNet = cashNet.
   propriété : tout à l'exploitant.
   fermage  : loyer fixe annuel versé au propriétaire ; le fermier porte
              les coûts et garde recettes + réserve de la parcelle.
   métayage : part de récolte (α) au propriétaire sur recettes + réserve
              mobilisée de la parcelle (la sortie arrachage concerne aussi
              le bailleur à métayage nature) ; part des coûts (β) au
              propriétaire, sur les coûts de la parcelle uniquement. */
function repartir(row, fv) {
  const revParcelle = row.venteRaisinParcelle + row.cashRI;
  const coutsParcelle = row.coutsParcelle;
  const resteNet = row.venteRaisinReste - row.coutsReste;
  if (fv.regime === 'propriete') return { exp: revParcelle - coutsParcelle + resteNet, prop: 0 };
  if (fv.regime === 'fermage') {
    return { exp: revParcelle - coutsParcelle - fv.loyerAn + resteNet, prop: fv.loyerAn };
  }
  const a = fv.partRecolte, b = fv.partCouts;
  return {
    prop: a * revParcelle - b * coutsParcelle,
    exp: (1 - a) * revParcelle - (1 - b) * coutsParcelle + resteNet
  };
}

function cumul(rows, key) { let s = 0; return rows.map(r => (s += (typeof key === 'function' ? key(r) : r[key]))); }

/* Charges d'entretien récurrentes — modèle (c) : décomposition surface / rendement.
   - charge SURFACE (coutSurfaceHaAn, €/ha/an) : sol, palissage, entretien indépendant
     du rendement ; persiste tant que la surface est gérée — Y COMPRIS la jeune vigne en
     établissement — et tombe au coefRepos pendant la jachère de la parcelle arrachée.
   - charge RENDEMENT (coutRdtParKg, €/kg) : vendange, transport, prestations à la récolte ;
     proportionnelle aux kg réellement récoltés. Elle s'annule donc d'elle-même en repos et
     en établissement, puisque `recolte` exclut la parcelle non productive.
   Branchée PAR SCÉNARIO : le différentiel inter-scénario capte « ce que l'arrachage évite »
   (la vendange de la parcelle pendant la transition, PAS sa charge de surface) sans aucun
   crédit additif. Neutre par défaut (coûts nuls ⇒ parité classeur préservée). */
function chargesEntretien(scenario, rowsKg, inp) {
  const cs = inp.coutSurfaceHaAn || 0, cr = inp.coutRdtParKg || 0;
  const coefRepos = inp.coefRepos ?? 0;
  const surfRest = inp.surfTot - inp.surfParc, S = inp.surfParc;
  const parcelle = {}, reste = {};
  rowsKg.forEach(r => {
    let surfGereeParcelle;
    if (scenario === 'arrachage') {
      const coefParc = (r.t < inp.repos) ? coefRepos : 1; // jachère réduite -> jeune vigne pleine
      surfGereeParcelle = coefParc * S;
    } else {
      surfGereeParcelle = S;                  // statu quo & complantation : parcelle gérée en plein
    }
    // recolteParcelle/recolteReste excluent déjà la parcelle non productive
    const totParcelle = cs * surfGereeParcelle + cr * r.recolteParcelle;
    const totReste     = cs * surfRest          + cr * r.recolteReste;
    if (totParcelle) parcelle[r.t] = (parcelle[r.t] || 0) + totParcelle;
    if (totReste)    reste[r.t]    = (reste[r.t]    || 0) + totReste;
  });
  return { parcelle, reste };
}

function construireScenarios(inp) {
  if (inp.surfParc > inp.surfTot + 1e-9) {
    throw new Error(`surfParc (${inp.surfParc} ha) > surfTot (${inp.surfTot} ha)`);
  }
  const base = {
    surfTot: inp.surfTot, surfArr: inp.surfParc, repos: inp.repos,
    nbSortie: inp.nbSortie, volSortieArr: inp.volSortieArr,
    plafond: inp.plafond, volco: inp.volco, rendMean: inp.rendMean,
    reserveInit: inp.reserveInit, optInsuff: true, horizon: inp.horizon,
    rendYearFn: inp.rendYearFn
  };
  const S = inp.surfParc, dens = inp.densite;
  const merge = (a, b) => { const m = { ...a }; for (const k in b) m[k] = (m[k] || 0) + b[k]; return m; };
  const somme = o => Object.values(o).reduce((s, v) => s + v, 0);

  // Coûts PONCTUELS d'investissement (arrachage + installation) — base de l'« effort net »
  const invArr = {};
  invArr[0] = S * inp.coutArrachageHa;
  invArr[inp.repos] = (invArr[inp.repos] || 0)
    + S * (inp.coutPrepaHa + dens * inp.coutPlant + inp.coutPalissageHa + (inp.irrigation ? inp.coutIrrigHa : 0));
  const scArr = simulerReserveKg({ ...base, scenario: 'arrachage',
    rampProfile: inp.ramp, rendFactorProjet: inp.rendFactorProjet });

  const nbPlants = S * dens * inp.manquants;
  const invCompl = { 0: nbPlants * inp.coutEntreplant / inp.survie };
  /* Chantier 6 — cohérence coût/rendement de la complantation.
     Avant ce chantier, double pénalité de survie : le coût achetait déjà
     1/survie plants pour compenser la casse et ARRIVER À COMBLER les
     manquants (d'où le ÷ survie ci-dessus), MAIS rendCible ne portait le
     gain de rendement qu'à hauteur de survie — comme si seuls survie % des
     manquants avaient réellement été comblés. On payait pour compenser la
     mortalité ET on en subissait quand même l'effet sur le rendement.
     Choix retenu — modèle A « on repique jusqu'à combler » : le coût reste
     ÷ survie (on rachète assez de plants pour combler 100 % des manquants
     malgré la casse), donc le rendement cible suppose ce comblement complet,
     pondéré seulement par un facteur de récupération : un entreplant, même
     installé, ne produit pas tout de suite comme le reste d'une parcelle
     déjà en place (enracinement/vigueur plus faibles). gainComblement =
     manquants × rendMean × facteur de récupération (0.8 — dire d'expert,
     à ajuster si besoin).
     Rejeté — modèle B « on plante une fois » : coût sans ÷ survie (pas de
     réachat des pieds morts) et rendement pondéré par survie (formule
     ex-existante). Rejeté car incohérent avec le champ "Coût par
     entreplant" existant dans l'UI, dont le calcul présuppose déjà un
     réachat implicite compensant la mortalité — voir README §12. */
  const FACTEUR_RECUP_ENTREPLANT = 0.8;
  const gainComblement = inp.manquants * inp.rendMean * FACTEUR_RECUP_ENTREPLANT;
  const rendCible = inp.rendEstime + gainComblement;
  const rendParcCompl = (t, rendY) => {
    const ratio = inp.rendEstime / inp.rendMean, ratioCible = rendCible / inp.rendMean;
    const prog = t >= inp.entreeProd ? Math.min(1, (t - inp.entreeProd + 1) / 3) : 0;
    return rendY * (ratio + (ratioCible - ratio) * prog);
  };
  const scCompl = simulerReserveKg({ ...base, scenario: 'complantation', rendParcFn: rendParcCompl });

  const rendParcSQ = (t, rendY) => rendY * (inp.rendEstime / inp.rendMean) * Math.pow(1 - inp.declinSQ, t);
  const scSQ = simulerReserveKg({ ...base, scenario: 'statuquo', rendParcFn: rendParcSQ });

  // Coûts totaux = investissement ponctuel (100 % parcelle) + charges d'entretien
  // récurrentes (modèle c), décomposées parcelle / reste — chantier 5.
  const ceArr  = chargesEntretien('arrachage',     scArr,  inp);
  const ceComp = chargesEntretien('complantation', scCompl, inp);
  const ceSQ   = chargesEntretien('statuquo',      scSQ,   inp);
  const coutsArrParcelle  = merge(invArr,   ceArr.parcelle);
  const coutsCompParcelle = merge(invCompl, ceComp.parcelle);
  const coutsSQParcelle   = ceSQ.parcelle;

  const eco = (cParcelle, cReste) => ({ prixKg: inp.prixKg,
    coutsParcelleParAnnee: cParcelle, coutsResteParAnnee: cReste });
  return {
    arrachage:     { kg: scArr,   eur: coucheEuro(scArr,   eco(coutsArrParcelle,  ceArr.reste)),  investissement: somme(invArr) },
    complantation: { kg: scCompl, eur: coucheEuro(scCompl, eco(coutsCompParcelle, ceComp.reste)), investissement: somme(invCompl) },
    statuquo:      { kg: scSQ,    eur: coucheEuro(scSQ,    eco(coutsSQParcelle,   ceSQ.reste)),    investissement: 0 }
  };
}

function manqueAGagner(scen, refSQ, prixKg) {
  return scen.kg.map((r, i) => Math.max(0, (refSQ.kg[i].volcoVendu - r.volcoVendu) * prixKg));
}

/* =====================================================================
   Coût de palissage dérivé de la géométrie
   Source des prix unitaires : classeur LutEnVi 2025 (feuille « Coût
   hectare d'installation ») — instantané à réactualiser (acier volatil).
   Règle piquets intermédiaires  = longueur_rang / espacement  (choix B).
     Repère LutEnVi implicite : ~4,3 m (1 piquet tous les 4 pieds à 1,10 m,
     soit densité/4). Défaut ici 6 m, éditable → sous-chiffre ~30 % vs LutEnVi.
   Nombre de fils = fonction du type de taille (choix C), éditable.
   Le total est renvoyé en €/ha (surface parcelle) pour PRÉREMPLIR le
   champ coût palissage (choix A) sans l'imposer : l'utilisateur garde la main.
   ===================================================================== */
const PRIX_PALISSAGE_LUTENVI = {
  piquetInter: 3.99,   // €/piquet
  piquetTete: 6,       // €/piquet
  amarre: 2.64,        // €/amarre
  filML: 0.132,        // €/mètre linéaire PAR FIL (LutEnVi : 0,528 €/m pour 4 fils groupés ÷ 4)
  gripple: 1.826,      // €/gripple
  moPosePiquet: 1.318  // €/piquet posé — dérivé LutEnVi (2 864,56 €/ha ÷ 2 174 piquets/ha)
};
// Nb de fils/rang par type de taille — hypothèse à confirmer (non figée par le guide).
const FILS_PAR_TAILLE = {
  guyot: 4, cordon: 4, arcure_simple: 4, arcure_double: 5
};

function coutPalissage(geo, prix, opt) {
  prix = Object.assign({}, PRIX_PALISSAGE_LUTENVI, prix || {});
  opt = opt || {};
  const espacement = opt.espacementPiquet ?? 6;                 // m — choix B, éditable
  const nbFils = opt.nbFils ?? FILS_PAR_TAILLE[opt.typeTaille] ?? 4; // choix C
  const nbRangs = geo.nbRangs, Lrang = geo.L, surf = geo.surf;

  const interParRang = Math.max(0, Math.round(Lrang / espacement) - 1);
  const nbInter  = nbRangs * interParRang;
  const nbTete   = 2 * nbRangs;
  const nbAmarre = 2 * nbRangs;
  const mlFils   = nbFils * nbRangs * Lrang;
  const nbGripple = nbFils * nbRangs;
  const nbPiquets = nbInter + nbTete;

  const lignes = [
    ['Piquets intermédiaires', nbInter,  prix.piquetInter,  nbInter  * prix.piquetInter],
    ['Piquets de tête',        nbTete,   prix.piquetTete,   nbTete   * prix.piquetTete],
    ['Amarres',                nbAmarre, prix.amarre,       nbAmarre * prix.amarre],
    ['Fils (ml)',              mlFils,   prix.filML,        mlFils   * prix.filML],
    ['Gripple',                nbGripple, prix.gripple,     nbGripple * prix.gripple],
    ['MO pose piquets',        nbPiquets, prix.moPosePiquet, nbPiquets * prix.moPosePiquet]
  ];
  const totalParcelle = lignes.reduce((s, l) => s + l[3], 0);
  const totalHa = surf > 0 ? totalParcelle / surf : 0;
  return { lignes, totalParcelle, totalHa, espacement, nbFils,
           nbInter, nbTete, nbAmarre, mlFils, nbGripple };
}

/* =====================================================================
   Arbre de décision porte-greffe — reproduction FIDÈLE du Guide pratique
   2025 (p. 39). INFORMATION, hors calcul économique. L'outil est un miroir
   de l'arbre officiel : il ne juge pas, il attribue à la source.
   ===================================================================== */
const ARBRE_PG_NOTES = {
  1: 'Situations gélives : préférer le 41 B.',
  2: '5 BB : uniquement sols superficiels, caillouteux et secs (vigueur maîtrisée par le milieu) ; intérêt en entreplantation dans les ronds de court-noué.',
  3: '161-49 C : dépérissements signalés depuis 2008, partout en France — déconseillé en l\u2019état actuel des connaissances (Guide 2025, renvoi 3).'
};
// [ calcaire ('>25'|'15-25'|'5-15'), profondeur ('<30'|'30-60'|'>60'), drainage ('sec'|'drainant'|'humide'|'*'), porte-greffes, renvois ]
const ARBRE_PG = [
  ['>25',   '<30',  '*',        ['41 B','333 EM'], []],
  ['>25',   '30-60','sec',      ['41 B','333 EM'], []],
  ['>25',   '30-60','drainant', ['Fercal','41 B'], [1]],
  ['>25',   '>60',  'drainant', ['Fercal','41 B'], [1]],
  ['>25',   '>60',  'humide',   ['Fercal'], []],
  ['15-25', '<30',  'sec',      ['41 B','5 BB','333 EM','140 Ru'], [2]],
  ['15-25', '<30',  'drainant', ['SO4','Fercal'], []],
  ['15-25', '30-60','sec',      ['420 A','SO4','RSB1','41 B','140 Ru','1103 P'], []],
  ['15-25', '30-60','drainant', ['420 A','Fercal','41 B','161-49 C'], [3]],
  ['15-25', '30-60','humide',   ['Fercal','SO4'], []],
  ['15-25', '>60',  'drainant', ['420 A','Fercal','41 B','161-49 C'], [3]],
  ['5-15',  '<30',  'sec',      ['41 B','RSB1','333 EM','110 R','140 Ru','1103 P'], []],
  ['5-15',  '<30',  'drainant', ['SO4','Gravesac','5C'], []],
  ['5-15',  '30-60','sec',      ['3309 C','SO4','Gravesac','RSB1'], []],
  ['5-15',  '30-60','drainant', ['101-14 MGt','3309 C','420 A','Gravesac','5C'], []],
  ['5-15',  '30-60','humide',   ['101-14 MGt','Gravesac'], []],
  ['5-15',  '>60',  'drainant', ['101-14 MGt','3309 C','420 A','Gravesac'], []]
];
function bandeCalcaire(pct) {
  if (pct == null || isNaN(pct)) return null;
  if (pct > 25) return '>25';
  if (pct >= 15) return '15-25';
  if (pct >= 5)  return '5-15';
  return '<5';
}
function preconPorteGreffe(calcairePct, profondeur, drainage) {
  const bande = bandeCalcaire(calcairePct);
  if (!bande || !profondeur) return { match: 'incomplet', pg: [], notes: [] };
  if (bande === '<5') return { match: 'hors-grille', pg: [], notes: [],
    msg: 'Calcaire actif < 5 % : hors de l\u2019arbre du guide (voir tableau porte-greffes p. 38).' };
  let r = ARBRE_PG.find(x => x[0] === bande && x[1] === profondeur && (x[2] === drainage || x[2] === '*'));
  if (r) return { match: 'exact', pg: r[3], notes: r[4].map(n => ARBRE_PG_NOTES[n]) };
  const proches = ARBRE_PG.filter(x => x[0] === bande && x[1] === profondeur);
  if (proches.length) {
    const pg = [...new Set(proches.flatMap(x => x[3]))];
    const notes = [...new Set(proches.flatMap(x => x[4]))].map(n => ARBRE_PG_NOTES[n]);
    return { match: 'approche', pg, notes,
      msg: 'Le guide ne distingue pas ce drainage à cette profondeur — porte-greffes des branches proches :' };
  }
  return { match: 'hors-grille', pg: [], notes: [],
    msg: 'Combinaison non couverte par l\u2019arbre du guide (voir tableau p. 38).' };
}

if (typeof module !== 'undefined') module.exports =
  { simulerReserveKg, coucheEuro, repartir, cumul, construireScenarios, manqueAGagner,
    chargesEntretien, coutPalissage, PRIX_PALISSAGE_LUTENVI, FILS_PAR_TAILLE, preconPorteGreffe };
if (typeof window !== 'undefined') window.OAD =
  { simulerReserveKg, coucheEuro, repartir, cumul, construireScenarios, manqueAGagner,
    chargesEntretien, coutPalissage, PRIX_PALISSAGE_LUTENVI, FILS_PAR_TAILLE, preconPorteGreffe };

}
