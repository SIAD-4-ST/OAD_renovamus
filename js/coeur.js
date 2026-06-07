function projeterReserve(params) {
  var surfTot = params.surfTot;
  var surfArr = params.surfArr;
  var riInit  = params.riInit;
  var volco   = params.volco;
  var rend    = params.rend;
  var plaf    = params.plafondRI;
  var volAn   = params.sortieAnnuelleParHa;
  var repos   = params.dureeRepos;
  var sortie  = params.finSortie;
  var antic   = params.anticipe;
  var horizon = params.horizon !== undefined ? params.horizon : 10;

  function sp(t) {
    if (antic) return surfTot;
    if (t <= repos) return surfTot - surfArr;
    if (t === repos + 1) return surfTot - surfArr * .7;
    if (t === repos + 2) return surfTot - surfArr * .3;
    return surfTot;
  }
  function ph(t) {
    if (antic || t === 0) return t === 0 ? 'Initial' : 'Production';
    if (t <= repos) return 'Repos';
    if (t === repos + 1) return '1ère feuille';
    if (t === repos + 2) return '2ème feuille';
    return 'Production';
  }

  var rows = [], stk = riInit * surfTot;
  for (var t = 0; t <= horizon; t++) {
    var s = sp(t), rec = s * rend, vc = s * volco, deb = stk;
    var exc = rec - vc, mise = exc > 0 ? Math.min(exc, plaf * surfTot - deb) : 0;
    var def = exc < 0 ? -exc : 0, sins = Math.min(def, deb + mise), aft = deb + mise - sins;
    var sarr = (!antic && t >= 1 && t <= sortie) ? Math.min(volAn * surfArr, aft) : 0;
    stk = Math.max(0, aft - sarr);
    var sha = surfTot > 0 ? stk / surfTot : 0;
    rows.push({ t: t, ph: ph(t), rec: Math.round(rec), vc: Math.round(vc), mise: Math.round(mise), sins: Math.round(sins), sarr: Math.round(sarr), fin: Math.round(stk), sha: Math.round(sha), tx: +(sha / plaf).toFixed(3) });
  }

  var stockMin = Math.min.apply(null, rows.map(function(r) { return r.sha; }));
  var anneeStockMin = rows.find(function(r) { return r.sha === stockMin; }).t;

  return { rows: rows, stockMin: stockMin, anneeStockMin: anneeStockMin };
}

// params: { valeurs:{surface,productivite,manquants,enroulement,courtNoue},
//           pond:{pp,pm,pv,ppr,pd}, riExploitation, surfExploitation }
function calcIndice(params) {
  var v   = params.valeurs;
  var pp  = params.pond.pp, pm = params.pond.pm, pvi = params.pond.pv,
      ppr = params.pond.ppr, pd = params.pond.pd;
  var tot = pp + pm + pvi + ppr + pd;
  if (!tot) return { I: 0, sc: { prop: 0, manq: 0, viro: 0, prod: 0, defr: 0 } };

  var part    = Math.min(1, v.surface / params.surfExploitation);
  var sc_prop = Math.max(0, 100 - part * 100);
  var sc_manq = Math.min(100, v.manquants);
  var sc_viro = Math.min(100, ((v.enroulement + v.courtNoue) / 6) * 100);
  var sc_prod = Math.min(100, Math.max(0, ((12000 - v.productivite) / 12000) * 100));
  var sc_defr = Math.min(100, Math.max(0, ((10000 - params.riExploitation) / 10000) * 100));

  var I = (pp * sc_prop + pm * sc_manq + pvi * sc_viro + ppr * sc_prod + pd * sc_defr) / tot;
  return { I: +I.toFixed(1), sc: { prop: sc_prop, manq: sc_manq, viro: sc_viro, prod: sc_prod, defr: sc_defr } };
}

function dimensionnerPlantation(params) {
  var surf          = params.surf;
  var rang          = params.rang;
  var pied          = params.pied;
  var paires        = params.paires;
  var prixPlant     = params.prixPlant;
  var basePal       = params.basePal;
  var palFactor     = params.palFactor;
  var cPriceCouvert = params.cPriceCouvert;
  var dureeCouvert  = params.dureeCouvert;
  var prixPrepHa    = params.prixPrepHa;
  var margePlants   = params.margePlants;

  var m2              = surf * 10000;
  var densite         = Math.round(10000 / (rang * pied));
  var pieds           = Math.round(densite * surf);
  var plantsACommander = Math.ceil(pieds * margePlants);
  var ml              = Math.round(m2 / rang);
  var cote            = Math.sqrt(m2);
  var nbRangs         = Math.max(1, Math.round(cote / rang));
  var piquets         = Math.round(ml / 5) + nbRangs;
  var filReleveur     = Math.round(ml * (2 * paires + 1));

  var vegetal     = plantsACommander * prixPlant;
  var palissage   = ml * (basePal + (paires === 2 ? 0.5 : 0)) * palFactor;
  var couvert     = surf * cPriceCouvert * dureeCouvert;
  var preparation = surf * prixPrepHa;
  var total       = vegetal + palissage + couvert + preparation;

  return {
    metrics: { densite: densite, pieds: pieds, plantsACommander: plantsACommander, ml: ml, nbRangs: nbRangs, piquets: piquets, filReleveur: filReleveur },
    budget:  { vegetal: vegetal, palissage: palissage, couvert: couvert, preparation: preparation, total: total }
  };
}
