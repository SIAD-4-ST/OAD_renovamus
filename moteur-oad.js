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

/* Charges d'entretien récurrentes — modèle à 3 volets : production / repos / plantier.
   - charge SURFACE, déclinée en trois taux (€/ha/an) selon la phase de la parcelle :
     coutSurfaceProdHaAn (vigne mature, en production — c'est aussi le taux appliqué au
     « reste » de l'exploitation, toujours en production), coutReposHaAn (jachère après
     arrachage) et coutPlantierHaAn (jeune vigne en formation, rampYears années après le
     repos). Ce découpage remplace l'ancienne hypothèse « établissement = charge pleine »
     (coefRepos appliqué uniquement pendant le repos, plein tarif dès la plantation) : le
     plantier a désormais son propre taux, distinct de la production.
   - charge RENDEMENT (coutRdtParKg, €/kg) : vendange, transport, prestations à la récolte ;
     proportionnelle aux kg réellement récoltés. Elle s'annule donc d'elle-même en repos et
     en plantier, puisque `recolte` exclut la parcelle non productive.
   Branchée PAR SCÉNARIO : seul le scénario arrachage traverse repos puis plantier ; statu
   quo et complantation restent en production sur toute la période. Neutre par défaut
   (coûts nuls ⇒ parité classeur préservée). */
function chargesEntretien(scenario, rowsKg, inp) {
  const csProd  = inp.coutSurfaceProdHaAn ?? inp.coutSurfaceHaAn ?? 0; // vigne en production
  const csRepos = inp.coutReposHaAn    || 0;   // sous-phase repos (arrachage)
  const csPlant = inp.coutPlantierHaAn || 0;   // sous-phase plantier en formation (arrachage)
  const cr      = inp.coutRdtParKg     || 0;
  const rampYears = inp.rampYears ?? (inp.ramp ? inp.ramp.length : 3);
  const surfRest = inp.surfTot - inp.surfParc, S = inp.surfParc;
  const parcelle = {}, reste = {};
  rowsKg.forEach(r => {
    let csParc;
    if (scenario === 'arrachage') {
      if (r.t < inp.repos)                     csParc = csRepos;  // repos
      else if (r.t < inp.repos + rampYears)    csParc = csPlant;  // plantier
      else                                     csParc = csProd;   // production
    } else {
      csParc = csProd;                                            // statu quo & complantation
    }
    const totParcelle = csParc * S       + cr * r.recolteParcelle;
    const totReste    = csProd * surfRest + cr * r.recolteReste;
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
  // chantier P3 : coutArrachageHa (MHCS) couvre désormais arrachage + évacuation des
  // souches + amendement calcaire + préparation du sol — un champ coutPrepaHa séparé
  // ferait double emploi, voir README §12 (journal d'arbitrages).
  const invArr = {};
  invArr[0] = S * inp.coutArrachageHa;
  // coutProtectionHa (tuteur + cache-plant, chantier P8) : ponctuel, comme
  // coutPalissageHa, mais un poste séparé — voir coutProtectionPlant()
  // ci-dessous pour les garde-fous anti-double-compte (MHCS plantier,
  // coutEntreplant complantation).
  invArr[inp.repos] = (invArr[inp.repos] || 0)
    + S * (dens * inp.coutPlant + inp.coutPalissageHa + (inp.coutProtectionHa || 0)
        + (inp.irrigation ? inp.coutIrrigHa : 0));
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
   Registre parcellaire — agrégation exploitation / parcelle désignée.
   Chantier 1 : source unique de surfTot, ageMoy, surfParc, ageParc.
   Lignes attendues (déjà normalisées par le parseur CSV, index.html) :
   { surface, anneePlant, situation: 'plantee'|'arrachee', tauxManquant, cepage }
   ===================================================================== */

function ageRegistre(anneePlant, campagne) {
  return campagne - anneePlant;
}

// surfTot = somme de TOUTES les lignes (Plantée + Arrachée) : une parcelle
// arrachée reste une surface de l'exploitation, en repos.
// ageMoy = moyenne pondérée par surface, EXCLUANT les lignes Arrachée du
// numérateur ET du dénominateur (une parcelle arrachée n'a plus d'âge de
// vigne). Aucune ligne Plantée -> ageMoy = 0 (dénominateur nul, pas de NaN).
function agregerRegistreExploitation(rows, campagne) {
  let surfTot = 0, sommePonderee = 0, surfPlantee = 0;
  rows.forEach(r => {
    const surf = +r.surface || 0;
    surfTot += surf;
    if (r.situation === 'plantee') {
      surfPlantee += surf;
      sommePonderee += ageRegistre(+r.anneePlant || campagne, campagne) * surf;
    }
  });
  return { surfTot, ageMoy: surfPlantee > 0 ? sommePonderee / surfPlantee : 0 };
}

// Agrégation de la parcelle désignée à partir d'un sous-ensemble de lignes
// sélectionnées (typiquement les lignes Plantée d'un même idu) : ageParc et
// tauxManquant pondérés par surface, même logique que l'exploitation.
// cepage = cépage de plus grande surface cumulée dans la sélection ;
// cepageMixte signale une sélection à cépages hétérogènes (l'UI n'a qu'un
// seul champ cépage, purement informatif — voir README §15).
function agregerRegistreParcelle(rows, campagne) {
  let surfParc = 0, sommeAge = 0, sommeManquant = 0;
  const surfParCepage = {};
  rows.forEach(r => {
    const surf = +r.surface || 0;
    surfParc += surf;
    sommeAge += ageRegistre(+r.anneePlant || campagne, campagne) * surf;
    sommeManquant += (+r.tauxManquant || 0) * surf;
    surfParCepage[r.cepage] = (surfParCepage[r.cepage] || 0) + surf;
  });
  const cepages = Object.keys(surfParCepage);
  const cepage = cepages.reduce((best, c) => surfParCepage[c] > (surfParCepage[best] || 0) ? c : best, cepages[0]);
  return {
    surfParc,
    ageParc: surfParc > 0 ? sommeAge / surfParc : 0,
    tauxManquant: surfParc > 0 ? sommeManquant / surfParc : 0,
    cepage: cepage || null,
    cepageMixte: cepages.length > 1
  };
}

/* =====================================================================
   Trajectoire d'âge moyen du vignoble — chantier P7, famille 2 (physique,
   non monétisé), symétrique du graphique de stock de réserve. Remplace le
   KPI ponctuel ageApres/gainAge (instantané : comptait la parcelle à l'âge
   0 dès t=0, y compris pendant le repos du sol, alors qu'aucune vigne n'y
   est encore replantée).

   Convention pendant le repos (arrachage, t < repos) — option B : la
   parcelle SORT du numérateur ET du dénominateur, même règle que
   agregerRegistreExploitation pour les lignes "Arrachée" (chantier 1,
   ci-dessus) : une parcelle sans vigne en terre n'a pas d'âge de vigne.

   Ancrage du redémarrage à 0 sur `repos` (replantation physique, date de
   invArr[repos]) et non sur `returnYear` (3+repos, entrée en production
   dans le modèle kg) : cet indicateur est un capital PHYSIQUE, découplé de
   la capacité de production — mélanger les deux réintroduirait un biais
   productif dans un indicateur pensé pour en être indépendant.

   Complantation : mix pondéré à deux générations de pieds sur la même
   parcelle — (1−manquants) de la surface continue de vieillir normalement
   (ageParc+t), `manquants` repart à l'âge t (entreplants plantés à t=0).

   Le "reste de l'exploitation" (hors parcelle) vieillit de +1 an/an, à
   l'identique dans les 3 scénarios (le temps passe pareil partout) — le
   principe de symétrie du projet veut que seule la parcelle diverge.

   Propriété structurelle qui en découle : l'écart d'âge avec le statu quo
   reste PLAT pendant le repos (les deux vieillissent au même rythme tant
   que rien n'est planté), fait un saut net à la replantation (t=repos),
   puis reste PLAT indéfiniment (aucune reconvergence naturelle, à la
   différence de la trésorerie) — l'écart d'âge, une fois acquis, se
   maintient jusqu'à un futur cycle de renouvellement.
   ===================================================================== */
function trajectoireAge(inp) {
  const { ageMoy, ageParc, surfTot, surfParc, manquants, repos, horizon } = inp;
  const surfRest = surfTot - surfParc;
  const ageResteInit = surfRest > 1e-9 ? (ageMoy * surfTot - ageParc * surfParc) / surfRest : 0;
  const moyenne = (ageParcelle, surfActive, t) => {
    const ageReste = ageResteInit + t;
    const surfActiveTot = surfRest + surfActive;
    return surfActiveTot > 1e-9 ? (ageReste * surfRest + ageParcelle * surfActive) / surfActiveTot : 0;
  };
  const statuquo = [], complantation = [], arrachage = [];
  for (let t = 0; t <= horizon; t++) {
    statuquo.push(moyenne(ageParc + t, surfParc, t));
    complantation.push(moyenne((1 - manquants) * (ageParc + t) + manquants * t, surfParc, t));
    arrachage.push(t < repos ? moyenne(0, 0, t) : moyenne(t - repos, surfParc, t));
  }
  return { statuquo, complantation, arrachage };
}

/* =====================================================================
   Coût de palissage dérivé de la géométrie — chantier P8.
   Sources mixtes, deux instantanés distincts :
   - amarre, piquet, fiche de tête, kit bout de route, crochet, fil :
     relevé fournisseur [SOURCE ET DATE DE RELEVÉ EXACTES À PRÉCISER —
     communiqué par l'utilisateur, non encore documenté formellement].
   - gripple, MO pose piquet : classeur LutEnVi 2025 (feuille « Coût
     hectare d'installation ») — conservés car sans équivalent dans le
     nouveau relevé (qui ne porte que sur la matière, pas la pose ni le
     tendeur de fil). Prix acier volatils, à réactualiser régulièrement,
     quelle que soit la source.
   Règle piquets intermédiaires = longueur_rang / espacement (choix B).
     Repère LutEnVi implicite : ~4,3 m (1 piquet tous les 4 pieds à 1,10 m,
     soit densité/4). Défaut ici 6 m, éditable → sous-chiffre ~30 % vs LutEnVi.
   Nombre de fils = fonction du type de taille (choix C), éditable.
   Le total est renvoyé en €/ha (surface parcelle) pour PRÉREMPLIR le
   champ coût palissage (choix A) sans l'imposer : l'utilisateur garde la main.

   Hypothèses de mapping du relevé (à confirmer) :
   - « piquet » (3,80 €, "selon espacement") = piquet intermédiaire
     uniquement ; la tête de rang est désormais couverte par la fiche de
     tête + le kit bout de route (2 items dédiés, 2 par rang chacun),
     qui remplacent l'ancien « piquet de tête » du modèle LutEnVi.
   - « crochet piquet inox » (1 par piquet) appliqué aux seuls piquets
     intermédiaires (même base que la ligne « piquet » ci-dessus) — la
     fiche de tête pourrait avoir sa propre fixation, non précisée par
     le relevé.
   - « MO pose piquet » (LutEnVi) continue de porter sur l'ensemble des
     poteaux plantés (intermédiaires + tête), qu'ils soient appelés
     « piquet » ou « fiche de tête ».
   ===================================================================== */
const PRIX_PALISSAGE = {
  piquet: 3.80,         // €/piquet intermédiaire — relevé fournisseur
  ficheTete: 5.98,      // €/fiche de tête en L galva, 2 par rang — relevé fournisseur
  kitBoutRoute: 3.88,   // €/kit bout de route, 2 par rang — relevé fournisseur
  amarre: 7.32,         // €/amarre 1200, 2 par rang — relevé fournisseur
  crochet: 0.26,        // €/crochet piquet inox, 1 par piquet intermédiaire — relevé fournisseur
  filML: 0.15,          // €/mètre linéaire PAR FIL — relevé fournisseur
  gripple: 1.826,       // €/gripple — LutEnVi 2025 (pas d'équivalent dans le nouveau relevé)
  moPosePiquet: 1.318   // €/piquet posé — LutEnVi 2025, dérivé (2 864,56 €/ha ÷ 2 174 piquets/ha)
};
// Nb de fils/rang par type de taille — hypothèse à confirmer (non figée par le guide).
const FILS_PAR_TAILLE = {
  guyot: 4, cordon: 4, arcure_simple: 4, arcure_double: 5
};

function coutPalissage(geo, prix, opt) {
  prix = Object.assign({}, PRIX_PALISSAGE, prix || {});
  opt = opt || {};
  const espacement = opt.espacementPiquet ?? 6;                 // m — choix B, éditable
  const nbFils = opt.nbFils ?? FILS_PAR_TAILLE[opt.typeTaille] ?? 4; // choix C
  const nbRangs = geo.nbRangs, Lrang = geo.L, surf = geo.surf;

  const interParRang = Math.max(0, Math.round(Lrang / espacement) - 1);
  const nbInter  = nbRangs * interParRang;
  const nbTete   = 2 * nbRangs;   // fiche de tête + kit bout de route + amarre : 2 par rang chacun
  const mlFils   = nbFils * nbRangs * Lrang;
  const nbGripple = nbFils * nbRangs;
  const nbPiquets = nbInter + nbTete; // base MO pose : tout poteau planté, tête ou intermédiaire

  const lignes = [
    ['Piquets intermédiaires',    nbInter,  prix.piquet,       nbInter  * prix.piquet],
    ['Fiches de tête en L galva', nbTete,   prix.ficheTete,    nbTete   * prix.ficheTete],
    ['Kits bout de route',        nbTete,   prix.kitBoutRoute, nbTete   * prix.kitBoutRoute],
    ['Amarres',                   nbTete,   prix.amarre,       nbTete   * prix.amarre],
    ['Crochets piquet inox',      nbInter,  prix.crochet,      nbInter  * prix.crochet],
    ['Fils (ml)',                 mlFils,   prix.filML,        mlFils   * prix.filML],
    ['Gripple',                   nbGripple, prix.gripple,     nbGripple * prix.gripple],
    ['MO pose piquets',           nbPiquets, prix.moPosePiquet, nbPiquets * prix.moPosePiquet]
  ];
  const totalParcelle = lignes.reduce((s, l) => s + l[3], 0);
  const totalHa = surf > 0 ? totalParcelle / surf : 0;
  return { lignes, totalParcelle, totalHa, espacement, nbFils,
           nbInter, nbTete, mlFils, nbGripple };
}

/* =====================================================================
   Coût de protection du jeune plant — tuteur + cache-plant — chantier P8.
   Poste ponctuel (achat matière, année `repos` — replantation physique),
   DISTINCT du palissage (structure du rang, ci-dessus) : ce ne sont pas
   des éléments de conduite du fil mais une protection individuelle du
   pied (casse, gibier, chocs d'entretien du sol).

   Anti-double-compte, deux garde-fous tranchés lors du chantier :
   1. Pas de recouvrement avec `coutPlantierHaAn` (MHCS, charge ANNUELLE
      récurrente de taille de formation + remplacement des plants morts,
      voir chargesEntretien ci-dessous) : celui-ci est une charge répétée
      chaque année du plantier, celui-ci un achat unique à la plantation.
      Pour éviter toute confusion, la ligne homonyme du détail par
      opération « plantier » de l'UI (REF_PLANTIER, index.html) a été
      recentrée sur la SEULE main d'œuvre de surveillance/relève de cette
      protection — jamais l'achat du matériel, compté ici.
   2. Volontairement PAS appliqué à la complantation (`invCompl`,
      ci-dessous) : `coutEntreplant` (prix d'achat de l'entreplant, saisi
      par l'utilisateur) est posé comme incluant déjà, par hypothèse,
      la protection du plant — hypothèse à vérifier auprès de la source
      utilisée pour ce prix, non un fait établi par ce chantier.

   Source des prix unitaires : relevé fournisseur [SOURCE ET DATE DE
   RELEVÉ EXACTES À PRÉCISER], même instantané que PRIX_PALISSAGE
   ci-dessus — prix acier volatils, à réactualiser.
   ===================================================================== */
const PRIX_PROTECTION_PLANT = {
  tuteurU: 0.77,     // €/pied — tuteur en U galvanisé — relevé fournisseur
  cachePlant: 0.48   // €/pied — cache-plant — relevé fournisseur
};

function coutProtectionPlant(densite, prix) {
  prix = Object.assign({}, PRIX_PROTECTION_PLANT, prix || {});
  const tuteurHa = densite * prix.tuteurU;
  const cachePlantHa = densite * prix.cachePlant;
  return { totalHa: tuteurHa + cachePlantHa, tuteurHa, cachePlantHa };
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

/* =====================================================================
   Référentiel temps de travaux & taux horaire — préremplissage opt-in et
   indicateur heures uniquement. Aucun branchement dans le moteur de calcul :
   ces constantes ne modifient ni chargesEntretien ni construireScenarios.
   ===================================================================== */

// Référentiel temps de travaux — travaux MANUELS sur la vigne.
// Source : Avenant n°217 à la CCT des exploitations viticoles de la Champagne
// délimitée (IDCC 8216), barème indicatif du travail à la tâche, étendu 08/09/2021.
// Unité : heures pour 1000 pieds (à multiplier par densité/1000 pour obtenir h/ha).
const REF_OPS_MANUEL = [
  { id: 'taille',     lib: 'Prétaille + taille',        h1000: 16,  src: 'Avenant 217' },
  { id: 'liage',      lib: 'Liage (charpentes + pieds)', h1000: 8.5, src: 'Avenant 217' },
  { id: 'ebourg',     lib: 'Ébourgeonnage / épamprage',  h1000: 4.5, src: 'Avenant 217' },
  { id: 'relevage',   lib: 'Relevage / palissage',       h1000: 14,  src: 'Avenant 217' },
  { id: 'rognage',    lib: 'Rognage (mécanisé + finition cisaille)', h1000: 2.5, src: 'Avenant 217' },
];

// Travaux MÉCANISÉS : temps tracteur, hors barème à la tâche. Temps à sourcer
// (fiches technico-éco Chambre d'agriculture Marne / données CUMA). Défaut 0 h,
// éditable. L'intrant associé est un coût € pur (engrais, phyto), à caler Cerfrance.
const REF_OPS_MECANISE = [
  { id: 'sol',        lib: 'Travaux du sol / désherbage', hHa: 0, intrantEuroHa: 0, src: 'à sourcer' },
  { id: 'ferti',      lib: 'Fertilisation (épandage)',    hHa: 0, intrantEuroHa: 0, src: 'à sourcer / engrais Cerfrance' },
  { id: 'traitements',lib: 'Traitements (application)',   hHa: 0, intrantEuroHa: 0, src: 'à sourcer / phyto Cerfrance' },
];

// Clé de conversion euros. SMIC 2026 = 11,88 €/h brut ; coût chargé permanent
// ≈ ×1,43. Éditable dans l'UI.
const TAUX_HORAIRE_DEFAUT = 17;      // €/h chargé (permanent) — src: SMIC 2026 chargé
const SMIC_2026_BRUT = 11.88;        // €/h — référence

// Propose le volet 1 (surface en production) à partir des opérations.
// Retourne le détail par opération + les totaux, pour affichage et bouton "reprendre".
function proposerVoletProduction(densite, tauxHoraire, opsManuel = REF_OPS_MANUEL, opsMeca = REF_OPS_MECANISE) {
  const manuel = opsManuel.map(o => {
    const hHa = o.h1000 * densite / 1000;
    return { id: o.id, lib: o.lib, hHa, euroHa: hHa * tauxHoraire, src: o.src, type: 'manuel' };
  });
  const meca = opsMeca.map(o => ({
    id: o.id, lib: o.lib, hHa: o.hHa || 0,
    euroHa: (o.hHa || 0) * tauxHoraire + (o.intrantEuroHa || 0),
    src: o.src, type: 'mecanise'
  }));
  const lignes = [...manuel, ...meca];
  return {
    lignes,
    totalEuroHa:   lignes.reduce((s, l) => s + l.euroHa, 0),
    totalHeuresHa: lignes.reduce((s, l) => s + l.hHa, 0),      // heures manuelles + mécanisées
    heuresManuellesHa: manuel.reduce((s, l) => s + l.hHa, 0),  // sert l'indicateur MO
  };
}

// Heures MANUELLES par année et par scénario, en h/ha, à partir du timing moteur.
// Année en production -> total manuel ; repos -> 0 ; plantier -> fraction de formation.
// fracFormation par défaut 0.35 (à caler), appliquée aux seules opérations de formation.
function heuresManuellesParAnnee(scenario, rowsKg, inp, opsManuel = REF_OPS_MANUEL, fracFormation = 0.35) {
  const densite = inp.densite, rampYears = inp.rampYears ?? (inp.ramp ? inp.ramp.length : 3);
  const hProd = opsManuel.reduce((s, o) => s + o.h1000 * densite / 1000, 0);
  return rowsKg.map(r => {
    if (scenario !== 'arrachage') return hProd;
    if (r.t < inp.repos) return 0;                              // repos : pas de vigne
    if (r.t < inp.repos + rampYears) return hProd * fracFormation; // plantier : formation réduite
    return hProd;                                               // production
  });
}

// Indicateur "MO économisée" (F6) : différentiel d'heures manuelles arrachage vs statu quo,
// sur la fenêtre de transition. Physique ; l'équivalent € n'est qu'indicatif (F7).
// euroIndicatifHa n'entre JAMAIS dans cashNet, la trésorerie ou un KPI financier —
// il ne doit être consommé que par l'affichage indicatif (F7).
function moEconomisee(scArr, scSQ, inp, tauxHoraire, opsManuel = REF_OPS_MANUEL, fracFormation = 0.35) {
  const hArr = heuresManuellesParAnnee('arrachage', scArr, inp, opsManuel, fracFormation);
  const hSQ  = heuresManuellesParAnnee('statuquo',  scSQ,  inp, opsManuel, fracFormation);
  const rampYears = inp.rampYears ?? (inp.ramp ? inp.ramp.length : 3);
  const fin = inp.repos + rampYears;
  let heuresHa = 0;
  for (let t = 0; t < Math.min(fin, hArr.length); t++) heuresHa += Math.max(0, hSQ[t] - hArr[t]);
  return { heuresHa, euroIndicatifHa: heuresHa * tauxHoraire }; // € indicatif, JAMAIS dans la trésorerie
}

if (typeof module !== 'undefined') module.exports =
  { simulerReserveKg, coucheEuro, repartir, cumul, construireScenarios, manqueAGagner,
    chargesEntretien, coutPalissage, PRIX_PALISSAGE, FILS_PAR_TAILLE,
    coutProtectionPlant, PRIX_PROTECTION_PLANT, preconPorteGreffe,
    REF_OPS_MANUEL, REF_OPS_MECANISE, TAUX_HORAIRE_DEFAUT, SMIC_2026_BRUT,
    proposerVoletProduction, heuresManuellesParAnnee, moEconomisee,
    ageRegistre, agregerRegistreExploitation, agregerRegistreParcelle, trajectoireAge };
if (typeof window !== 'undefined') window.OAD =
  { simulerReserveKg, coucheEuro, repartir, cumul, construireScenarios, manqueAGagner,
    chargesEntretien, coutPalissage, PRIX_PALISSAGE, FILS_PAR_TAILLE,
    coutProtectionPlant, PRIX_PROTECTION_PLANT, preconPorteGreffe,
    REF_OPS_MANUEL, REF_OPS_MECANISE, TAUX_HORAIRE_DEFAUT, SMIC_2026_BRUT,
    proposerVoletProduction, heuresManuellesParAnnee, moEconomisee,
    ageRegistre, agregerRegistreExploitation, agregerRegistreParcelle, trajectoireAge };

}
