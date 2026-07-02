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
    let surfProd, recolte;
    if (p.scenario === 'arrachage') {
      const jeune = t >= returnYear;
      let f = 1;
      if (jeune) { const k = t - returnYear; f = k < ramp.length ? ramp[k] : 1; }
      surfProd = surfRest + (jeune ? p.surfArr : 0);
      // le rendement du bloc replanté porte le facteur projet -> alimente VolCo
      recolte = rendY * surfRest + (jeune ? rendY * f * fProjet * p.surfArr : 0);
    } else {
      surfProd = p.surfTot;
      const rendParc = p.rendParcFn ? p.rendParcFn(t, rendY) : rendY;
      recolte = rendY * surfRest + rendParc * p.surfArr;
    }
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
    rows.push({ t, surfProd, rendY, recolte,
      volcoVendu: Math.min(recolte, volco) + sortieInsuff, volcoCible: volco,
      mise, deficit, sortieInsuff, sortieArr, stockDebut, stockFin,
      stockHa: surfProd === 0 ? 0 : stockFin / surfProd });
    stockPrev = stockFin;
  }
  return rows;
}

function coucheEuro(rowsKg, eco) {
  return rowsKg.map(r => {
    const venteRaisin = r.volcoVendu * eco.prixKg;
    const cashRI      = r.sortieArr * eco.prixKg;
    const couts       = (eco.coutsParAnnee[r.t] || 0);
    return { t: r.t, venteRaisin, cashRI, couts,
             cashNet: venteRaisin + cashRI - couts,
             cashSansRI: venteRaisin - couts };
  });
}

/* Répartition faire-valoir — appliquée aux € seulement, total conservé.
   propriété : tout à l'exploitant.
   fermage  : loyer fixe annuel versé au propriétaire ; le fermier porte
              les coûts et garde recettes + réserve.
   métayage : part de récolte (α) au propriétaire sur recettes + réserve
              mobilisée (la sortie arrachage concerne aussi le bailleur à
              métayage nature) ; part des coûts (β) au propriétaire. */
function repartir(row, fv) {
  const rev = row.venteRaisin + row.cashRI;
  if (fv.regime === 'propriete') return { exp: rev - row.couts, prop: 0 };
  if (fv.regime === 'fermage') {
    return { exp: rev - row.couts - fv.loyerAn, prop: fv.loyerAn };
  }
  const a = fv.partRecolte, b = fv.partCouts;
  return {
    prop: a * rev - b * row.couts,
    exp: (1 - a) * rev - (1 - b) * row.couts
  };
}

function cumul(rows, key) { let s = 0; return rows.map(r => (s += (typeof key === 'function' ? key(r) : r[key]))); }

function construireScenarios(inp) {
  const base = {
    surfTot: inp.surfTot, surfArr: inp.surfParc, repos: inp.repos,
    nbSortie: inp.nbSortie, volSortieArr: inp.volSortieArr,
    plafond: inp.plafond, volco: inp.volco, rendMean: inp.rendMean,
    reserveInit: inp.reserveInit, optInsuff: true, horizon: inp.horizon,
    rendYearFn: inp.rendYearFn
  };
  const S = inp.surfParc, dens = inp.densite;

  const coutsArr = {};
  coutsArr[0] = S * inp.coutArrachageHa;
  coutsArr[inp.repos] = (coutsArr[inp.repos] || 0)
    + S * (inp.coutPrepaHa + dens * inp.coutPlant + inp.coutPalissageHa + (inp.irrigation ? inp.coutIrrigHa : 0));
  const scArr = simulerReserveKg({ ...base, scenario: 'arrachage',
    rampProfile: inp.ramp, rendFactorProjet: inp.rendFactorProjet });

  const nbPlants = S * dens * inp.manquants;
  const coutsCompl = { 0: nbPlants * inp.coutEntreplant / inp.survie };
  const rendCible = inp.rendEstime + (inp.rendMean - inp.rendEstime) * inp.survie;
  const rendParcCompl = (t, rendY) => {
    const ratio = inp.rendEstime / inp.rendMean, ratioCible = rendCible / inp.rendMean;
    const prog = t >= inp.entreeProd ? Math.min(1, (t - inp.entreeProd + 1) / 3) : 0;
    return rendY * (ratio + (ratioCible - ratio) * prog);
  };
  const scCompl = simulerReserveKg({ ...base, scenario: 'complantation', rendParcFn: rendParcCompl });

  const rendParcSQ = (t, rendY) => rendY * (inp.rendEstime / inp.rendMean) * Math.pow(1 - inp.declinSQ, t);
  const scSQ = simulerReserveKg({ ...base, scenario: 'statuquo', rendParcFn: rendParcSQ });

  const eco = c => ({ prixKg: inp.prixKg, coutsParAnnee: c });
  return {
    arrachage:     { kg: scArr,   eur: coucheEuro(scArr,   eco(coutsArr)) },
    complantation: { kg: scCompl, eur: coucheEuro(scCompl, eco(coutsCompl)) },
    statuquo:      { kg: scSQ,    eur: coucheEuro(scSQ,    eco({})) }
  };
}

function manqueAGagner(scen, refSQ, prixKg) {
  return scen.kg.map((r, i) => Math.max(0, (refSQ.kg[i].volcoVendu - r.volcoVendu) * prixKg));
}

if (typeof module !== 'undefined') module.exports =
  { simulerReserveKg, coucheEuro, repartir, cumul, construireScenarios, manqueAGagner };
if (typeof window !== 'undefined') window.OAD =
  { simulerReserveKg, coucheEuro, repartir, cumul, construireScenarios, manqueAGagner };
