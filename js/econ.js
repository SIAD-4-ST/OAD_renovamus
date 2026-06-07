/* ════════════════════════════════════════════════════════════
   ECON — Bilan économique du renouvellement (mono-parcelle)
   Fonctions pures : aucun DOM, stockage local, ni global carto.
   Dépend de coeur.js (projeterReserve, dimensionnerPlantation).
   ════════════════════════════════════════════════════════════ */

var REFERENTIEL_ECO = {
  prixKgRaisin:            7.0,  // €/kg — moyenne Champagne ~6,2–7,45 (presse 2024) ; CRU-DÉPENDANT, à recaler
  coutArrachageHa:         3500, // €/ha — PLACEHOLDER À SOURCER, ne pas utiliser tel quel
  aidePlantationHa:        5600, // €/ha — FranceAgriMer restructuration 2025-2026
  aidePalissageHa:         2500, // €/ha — FranceAgriMer restructuration 2025-2026
  coefReductionAide:       1.0,  // 1.0 = enveloppe non saturée ; <1 si coefficient appliqué
  indemnitePerteRecetteHa: 2000  // €/ha — PLACEHOLDER À SOURCER ; UNIQUEMENT si replantation NON anticipée
};

// Vue mono-parcelle ; la RI exploitation est supposée mobilisable en totalité —
// NE PAS sommer les bilans de plusieurs parcelles d'une même exploitation (double comptage de la RI).
function calculerBilanRenouvellement(params) {
  var sim        = params.simulation;
  var eco        = params.eco;

  var surfTot    = sim.surfTot;
  var surfArr    = sim.surfArr;
  var volco      = sim.volco;
  var dureeRepos = sim.dureeRepos;
  var anticipe   = sim.anticipe;
  var horizon    = sim.horizon !== undefined ? sim.horizon : 10;

  var anneePlantation;
  if (params.timing && params.timing.anneePlantation !== undefined) {
    anneePlantation = params.timing.anneePlantation;
  } else {
    anneePlantation = anticipe ? 0 : dureeRepos;
  }

  var proj  = projeterReserve(sim);
  var plant = dimensionnerPlantation(params.plantation);

  var flux  = [];
  var cumul = 0;

  for (var t = 0; t <= horizon; t++) {
    var coutArr  = (t === 0) ? surfArr * eco.coutArrachageHa : 0;
    var coutCouv = (t >= 1 && t <= dureeRepos && dureeRepos > 0)
      ? plant.budget.couvert / dureeRepos
      : 0;
    var coutPlan = (t === anneePlantation)
      ? (plant.budget.vegetal + plant.budget.palissage + plant.budget.preparation)
      : 0;
    var manque   = Math.max(0, surfTot * volco - proj.rows[t].vc) * eco.prixKgRaisin;
    var sortieRI = proj.rows[t].sarr * eco.prixKgRaisin;
    var aidePlan = (t === anneePlantation)
      ? (eco.aidePlantationHa + eco.aidePalissageHa) * surfArr * eco.coefReductionAide
      : 0;
    var indem    = (!anticipe && t === anneePlantation)
      ? eco.indemnitePerteRecetteHa * surfArr
      : 0;

    var net = sortieRI + aidePlan + indem - coutArr - coutCouv - coutPlan - manque;
    cumul  += net;

    flux.push({
      t:              t,
      coutArrachage:  coutArr,
      coutCouvert:    coutCouv,
      coutPlantation: coutPlan,
      manqueAGagner:  manque,
      sortieRI_euros: sortieRI,
      aides:          aidePlan + indem,
      net:            net,
      cumul:          cumul
    });
  }

  var totalCouts = flux.reduce(function(s, r) {
    return s + r.coutArrachage + r.coutCouvert + r.coutPlantation;
  }, 0);
  var totalRI    = flux.reduce(function(s, r) { return s + r.sortieRI_euros; }, 0);
  var totalAides = flux.reduce(function(s, r) { return s + r.aides; }, 0);

  var cumulVals = flux.map(function(r) { return r.cumul; });
  var minCumul  = Math.min.apply(null, cumulVals);
  var idxMin    = cumulVals.indexOf(minCumul);

  return {
    flux: flux,
    indicateurs: {
      coutRenouvellement:  totalCouts,
      couvertureRI:        totalCouts > 0 ? totalRI    / totalCouts : 0,
      couvertureAides:     totalCouts > 0 ? totalAides / totalCouts : 0,
      besoinTresorerieMax: Math.max(0, -minCumul),
      anneeBesoinMax:      flux[idxMin].t,
      resteACharge10ans:   -flux[flux.length - 1].cumul
    }
  };
}
