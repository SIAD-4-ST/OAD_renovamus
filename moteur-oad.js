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
  // Chantier A3 : le champ UI qui alimentait inp.entreeProd (« Entrée en
  // production », panneau Complantation) a été renommé/repurposé pour piloter
  // la rampe de l'arrachage (v.anneePleineProd, OAD.rampeLineaire — voir plus
  // bas) ; index.html n'alimente donc plus inp.entreeProd. Défaut historique
  // (7 ans, ex-valeur par défaut du champ) conservé ici pour ne pas modifier
  // silencieusement ce calcul interne — la complantation reste calculée mais
  // non exposée dans l'interface (chantier A1). Voir README, journal
  // d'arbitrages « chantier A3 ».
  const entreeProdCompl = inp.entreeProd ?? 7;
  const rendParcCompl = (t, rendY) => {
    const ratio = inp.rendEstime / inp.rendMean, ratioCible = rendCible / inp.rendMean;
    const prog = t >= entreeProdCompl ? Math.min(1, (t - entreeProdCompl + 1) / 3) : 0;
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

  // Chantier A1 (note de cadrage du 24/07/2026) — suppression d'INTERFACE des
  // scénarios statu quo / complantation, PAS de calcul : voir README, journal
  // d'arbitrages « chantier A1 ». `reference` est l'ex-`statuquo`, conservé en
  // interne comme contre-factuel nécessaire aux différentiels de l'écran 5
  // (ex. « moins de travail/charges qu'une parcelle en production ») — il ne
  // doit JAMAIS être affiché comme un scénario au même titre qu'`arrachage`.
  const scenarioReference = { kg: scSQ, eur: coucheEuro(scSQ, eco(coutsSQParcelle, ceSQ.reste)), investissement: 0 };
  return {
    arrachage: { kg: scArr, eur: coucheEuro(scArr, eco(coutsArrParcelle, ceArr.reste)), investissement: somme(invArr) },
    // RÉFÉRENCE INTERNE — non affichable comme scénario, voir commentaire ci-dessus.
    reference: scenarioReference,
    // Alias de compatibilité vers `reference` (même objet) : conserve la clé
    // historique `statuquo` pour ne pas casser le code et les tests existants
    // qui la lisent encore. Chantier A1, 24/07/2026.
    statuquo: scenarioReference,
    // @deprecated chantier A1 (note de cadrage du 24/07/2026) — la complantation
    // n'est plus un scénario exposé dans l'interface, cf. README journal
    // d'arbitrages « chantier A1 ». Calcul conservé pour compatibilité ; ne pas
    // lire cette clé dans du code nouveau.
    complantation: { kg: scCompl, eur: coucheEuro(scCompl, eco(coutsCompParcelle, ceComp.reste)), investissement: somme(invCompl) }
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

// Synthèse du registre pour le bandeau replié de l'étape 1 — prompt 3.
//
// Le registre est refermé par défaut : le bandeau doit donc dire ce qu'il
// contient, sinon replier revient à cacher. Trois grandeurs suffisent à
// reconnaître son propre registre sans l'ouvrir : combien de lignes, quelle
// surface, quels cépages.
//
// `surfaceTotale` compte TOUTES les lignes, Plantée et Arrachée, exactement
// comme `agregerRegistreExploitation` : le bandeau doit annoncer la même
// surface que le champ « Surface totale » juste au-dessus de lui, sans quoi
// l'utilisateur lit deux chiffres contradictoires sur le même écran.
// `cepages` est dédoublonné et trié par ordre alphabétique — une liste de
// cépages n'a pas d'ordre naturel, et un ordre stable évite que le bandeau
// se réécrive à chaque frappe dans une cellule sans rapport.
function synthetiseRegistre(rows) {
  const lignes = rows || [];
  let surfaceTotale = 0;
  const vus = {};
  lignes.forEach(r => {
    surfaceTotale += +(r && r.surface) || 0;
    const c = String((r && r.cepage) || '').trim();
    if (c) vus[c] = true;
  });
  return { nbLignes: lignes.length, surfaceTotale, cepages: Object.keys(vus).sort() };
}

/* =====================================================================
   Édition manuelle du registre — prompt B8 (arbitrage du 01/09/2026).

   Le registre parcellaire est devenu la SEULE source des surfaces et des
   âges : la saisie manuelle a disparu des écrans 1 et 2. Il doit donc
   pouvoir se remplir à la main, sans export CSV du portail CIVC — d'où
   l'ajout et la suppression de lignes, jusqu'ici explicitement exclus.

   Ces trois fonctions portent la part CALCULABLE de cette édition
   (attribution des identifiants de ligne, re-désignation de la parcelle)
   pour qu'elle soit testable hors navigateur, comme le reste du moteur.
   Elles sont pures : aucune ne mute son argument.
   ===================================================================== */

// `_id` n'est plus la POSITION de la ligne dans la table (prompt B2) mais une
// IDENTITÉ : supprimer une ligne ne doit jamais renuméroter les autres, sans
// quoi `parcelleLignesExclues`, qui les indexe, désignerait silencieusement
// d'autres lignes que celles décochées. D'où ce compteur monotone : il ne
// réutilise jamais un identifiant libéré par une suppression.
// Registre vide -> 0. Les `_id` non numériques (registre bricolé à la main,
// instantané d'une version antérieure) sont ignorés, jamais comptés.
function prochainIdRegistre(rows) {
  return (rows || []).reduce((suivant, r) => {
    const id = Number(r && r._id);
    return Number.isFinite(id) && id >= suivant ? id + 1 : suivant;
  }, 0);
}

// Ligne ajoutée à la main. Valeurs par défaut ASSUMÉES, sans source (prompt
// B8) : `idu` et `commune` restent vides — ce sont des identifiants CIVC que
// le vigneron connaît, l'outil n'a pas à en inventer ; l'année de plantation
// place la ligne à 10 ans, âge où la question du renouvellement ne se pose pas
// encore, donc une valeur neutre qu'il faudra corriger. Les colonnes que le
// calcul n'utilise pas (num_civc, productivité, enroulement, court-noué) sont
// présentes à 0 pour que la ligne ait exactement la forme de celles que
// produit `parseRegistreCSV`.
function ligneRegistreVierge(campagne, id) {
  return {
    _id: id, idu: '', commune: '', numCivc: '', modeExplo: '',
    cepage: 'CHARDONNAY B', anneePlant: campagne - 10, surface: 0,
    productiviteMoyenne: 0, tauxManquant: 0, enroulement: 0, courtNoue: 0,
    situation: 'plantee'
  };
}

// Parcelle désignée (écran 2) après une édition du registre. L'idu courant est
// conservé tant qu'au moins une ligne Plantée le porte encore ; sinon on
// retombe sur la première ligne Plantée restante, exactement comme au
// chargement initial ; sinon `null` — jamais un idu fantôme, jamais
// `undefined`. Le registre sans aucune ligne Plantée est un cas normal (tout
// est arraché), pas une erreur.
function resoudreParcelleIdu(rows, iduActuel) {
  const plantees = (rows || []).filter(r => r && r.situation === 'plantee').map(r => r.idu);
  if (iduActuel !== null && iduActuel !== undefined && plantees.indexOf(iduActuel) >= 0) return iduActuel;
  return plantees.length ? plantees[0] : null;
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
  guyot: 4, cordon: 4, arcure_simple: 4, arcure_double: 5,
  chablis: 5 // chantier A5 — valeur communiquée par l'utilisateur (pas de référentiel documentaire fourni, à sourcer si besoin)
};

/* =====================================================================
   Largeur équivalente — chantier "réconciliation géométrie/registre"
   (option A). En mode registre, la surface directrice vient du registre
   parcellaire, pas du rectangle saisi : la largeur en est déduite,
   jamais l'inverse — la longueur de rang saisie par l'utilisateur n'est
   ni corrigée ni recalculée (voir README, journal d'arbitrages).
   ===================================================================== */
function largeurEquivalente(surfHa, longueurM) {
  if (!(surfHa > 0) || !(longueurM > 0)) return 0;
  return surfHa * 10000 / longueurM;
}

/* =====================================================================
   Géométrie agronomique — chantier A4. La longueur/largeur déclarées
   disparaissent : le vigneron saisit surface + écartement rangs + nombre
   de rangs + écartement pieds ; la longueur de rang est DÉDUITE (usage
   d'affichage seul, jamais réinjectée en saisie). Déplace vers le moteur
   une logique qui vivait jusqu'ici dans index.html (entorse à CLAUDE.md).

   Comptage des pieds : AGRONOMIQUE et lui seul (densité × surface,
   densité arrondie AVANT multiplication par la surface — continuité avec
   l'existant : 1,10 × 1,10 m → 8 264 pieds/ha). À ne JAMAIS confondre avec
   le comptage géométrique (nbRangs, L) que continue de lire coutPalissage()
   ci-dessous (piquets/fils) : les deux comptages ne coïncident pas
   exactement, ce n'est pas un bug — voir README, journal d'arbitrages
   « chantier A4 ».

   Aucun seuil de plausibilité sur la longueur de rang déduite (ni haut ni
   bas) : non arbitré à ce jour, volontairement absent d'ici.
   ===================================================================== */
function geometrieAgronomique(surf, eR, eP, nbRangs) {
  const densite = Math.round(10000 / (eR * eP)); // arrondi AVANT multiplication par la surface
  const L = (nbRangs > 0 && eR > 0) ? (surf * 10000) / (nbRangs * eR) : 0; // longueur de rang déduite — affichage seul
  const W = nbRangs * eR; // largeur du bloc déduite — auxiliaire d'affichage
  const pieds = Math.round(densite * surf); // comptage AGRONOMIQUE — seul comptage de pieds à planter
  // chantier B4 : le détecteur `vsl` (ex eR >= 1.5) et la pénalité de rendement
  // associée sont retirés de l'interface — voir README, journal « chantier B4 ».
  // Le hook `rendFactorProjet` de simulerReserveKg (§7) reste actif dans le
  // moteur, simplement plus alimenté depuis l'UI (vaut 1 par défaut).
  return {
    surf, eR, eP, nbRangs, densite, L, W, pieds,
    aoc: { rang: eR <= 2.0, pied: eP >= 0.7 && eP <= 1.5, somme: (eR + eP) <= 3.0 }
  };
}

/* Chantier A5 — catégorisation OBLIGATOIRE / OPTIONNEL des 8 lignes de
   palissage (règle métier, cf. README journal d'arbitrages « chantier A5 »).
   OBLIGATOIRES (piquets de tête, interpiquets, fils, et leurs accessoires
   structurellement indissociables — crochets, gripple, MO pose) : toujours
   comptées, jamais décochables. OPTIONNELS : « Kits bout de route »
   (= « kits de route / kits Boudrout » de la note de cadrage — même
   nomenclature que PRIX_PALISSAGE, reprise telle quelle, voir README pour
   le signalement de l'ambiguïté plutôt qu'un tranchage). « Écarteurs » et
   « autres », cités par la note de cadrage comme catégories optionnelles,
   n'ont pas d'équivalent parmi ces 8 lignes — aucun prix n'est inventé
   pour eux, catégories vides tant qu'une source ne les documente pas.
   Prix et quantités des 8 lignes INCHANGÉS par ce chantier. */
/* Densité de plantation et bornes AOC — prompt 12.

   `geometrieAgronomique` contrôlait déjà les ÉCARTEMENTS (rang <= 2,00 m,
   pied entre 0,70 et 1,50 m, somme <= 3,00 m). Elle ne disait rien de la
   DENSITÉ obtenue, qui est pourtant ce que le schéma de parcelle donne à voir
   et ce que le cahier des charges borne : 8 000 à 10 000 pieds/ha en
   Champagne. Le contrôle est ici, pas dans l'interface, parce que c'en est
   un : il compare un résultat de calcul à deux bornes réglementaires.

   Il n'est pas bloquant, et ne doit pas l'être : l'outil est pédagogique, il
   signale, il n'interdit pas. `ok` dit si la densité tient dans les bornes,
   `sens` dit de quel côté elle en sort — c'est ce qui permet à l'écran de
   dire CE QUI CLOCHE plutôt qu'un « non conforme » muet.
   ===================================================================== */
const DENSITE_AOC_MIN = 8000;   // pieds/ha — cahier des charges AOC Champagne
const DENSITE_AOC_MAX = 10000;  // pieds/ha

function conformiteDensiteAOC(densite) {
  const d = +densite || 0;
  const sens = d < DENSITE_AOC_MIN ? 'sous' : d > DENSITE_AOC_MAX ? 'au-dessus' : null;
  return { densite: d, ok: sens === null, sens, min: DENSITE_AOC_MIN, max: DENSITE_AOC_MAX };
}

// Mètres de rang du bloc entier : c'est cette longueur, et non la surface,
// qui commande le palissage (voir coutPalissage). Elle était recalculée à
// plusieurs endroits sous la forme `nbRangs * L` ; elle a désormais un nom.
function metresDeRang(geo) {
  if (!geo) return 0;
  return (+geo.nbRangs || 0) * (+geo.L || 0);
}

function coutPalissage(geo, prix, opt) {
  prix = Object.assign({}, PRIX_PALISSAGE, prix || {});
  opt = opt || {};
  const espacement = opt.espacementPiquet ?? 6;                 // m — choix B, éditable
  const nbFils = opt.nbFils ?? FILS_PAR_TAILLE[opt.typeTaille] ?? 4; // choix C
  // ids des lignes OPTIONNELLES décochées par l'appelant (index.html, via les
  // cases à cocher de l'UI) — vide par défaut : comportement historique
  // inchangé (toutes les lignes comptées) tant que rien n'est explicitement
  // exclu. Les lignes OBLIGATOIRES ignorent cette liste, quel qu'en soit le contenu.
  const optionnelsExclus = new Set(opt.optionnelsExclus || []);
  const nbRangs = geo.nbRangs, Lrang = geo.L, surf = geo.surf;

  const interParRang = Math.max(0, Math.round(Lrang / espacement) - 1);
  const nbInter  = nbRangs * interParRang;
  const nbTete   = 2 * nbRangs;   // fiche de tête + kit bout de route + amarre : 2 par rang chacun
  const mlFils   = nbFils * nbRangs * Lrang;
  const nbGripple = nbFils * nbRangs;
  const nbPiquets = nbInter + nbTete; // base MO pose : tout poteau planté, tête ou intermédiaire

  const lignesDef = [
    { id: 'piquetInter',  lib: 'Piquets intermédiaires',    qte: nbInter,   prixUnite: prix.piquet,       categorie: 'obligatoire' },
    { id: 'ficheTete',    lib: 'Fiches de tête en L galva', qte: nbTete,    prixUnite: prix.ficheTete,    categorie: 'obligatoire' },
    { id: 'kitBoutRoute', lib: 'Kits bout de route',        qte: nbTete,    prixUnite: prix.kitBoutRoute, categorie: 'optionnel' },
    { id: 'amarre',       lib: 'Amarres',                   qte: nbTete,    prixUnite: prix.amarre,       categorie: 'obligatoire' },
    { id: 'crochet',      lib: 'Crochets piquet inox',      qte: nbInter,   prixUnite: prix.crochet,      categorie: 'obligatoire' },
    { id: 'filML',        lib: 'Fils (ml)',                 qte: mlFils,    prixUnite: prix.filML,        categorie: 'obligatoire' },
    { id: 'gripple',      lib: 'Gripple',                   qte: nbGripple, prixUnite: prix.gripple,      categorie: 'obligatoire' },
    { id: 'moPosePiquet', lib: 'MO pose piquets',           qte: nbPiquets, prixUnite: prix.moPosePiquet, categorie: 'obligatoire' }
  ];
  const lignes = lignesDef.map(l => ({
    ...l,
    total: l.qte * l.prixUnite,
    inclus: l.categorie === 'obligatoire' || !optionnelsExclus.has(l.id)
  }));
  const totalParcelle = lignes.filter(l => l.inclus).reduce((s, l) => s + l.total, 0);
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
   Référentiel clones agréés — UNION de deux sources, chaque ligne portant
   son origine. INFORMATION, hors calcul économique : ce référentiel n'entre
   dans aucun `inp` et n'influence aucun scénario, exactement comme ARBRE_PG.

   Sources :
     - Guide pratique Viticulture durable en Champagne 2025, p. 42-44 ;
     - PlantGrape (INRAE / IFV / Institut Agro Montpellier), www.plantgrape.fr
       — RELEVÉ NON DATÉ, À CONFIRMER AVANT DIFFUSION.

   Les cellules vides le sont dans les sources : elles ne sont jamais comblées
   par interpolation ni par dire d'expert. Les surfaces de multiplication sont
   un relevé national, indication de disponibilité en pépinière — pas un
   rendement, pas une garantie d'approvisionnement.

   Copie de travail lisible : data/clones-champagne.json (même contenu). Le
   littéral ci-dessous en est la transcription — le projet n'a ni build ni
   dépendance, le navigateur ne peut pas charger le JSON.

   [ cepage, clone, sources, refAgronomiques, production, sucre, fertilite,
     typiciteChampagne, precocite, botrytis, multiplicationHa,
     remarqueGuide, remarquePlantGrape ]
   ===================================================================== */
const CLONES_CHAMPAGNE_ROWS = [
  ['Chardonnay', '75',  ['Guide 2025', 'PlantGrape'],               'Bourgogne; Champagne; Languedoc',              'Moyen à supérieur',   'Inférieure à moyenne',  'Moyenne',               '',            '',        '',                      '4.1',    'Production irrégulière, grappes plus lâches', 'Vigueur et production inégales suivant les régions. Maîtriser la production pour vins tranquilles. Peut être utilisé pour effervescents.'],
  ['Chardonnay', '76',  ['Guide 2025', 'PlantGrape'],               'Bourgogne; Champagne; Languedoc; Val-de-Loire', 'Moyen',               'Moyenne à supérieure',  'Moyenne',               '',            'Précoce', '',                      '16.18',  'Régulier, précoce', 'Clone apprécié pour sa régularité de production et la qualité des vins. Peut être utilisé pour effervescents.'],
  ['Chardonnay', '78',  ['Guide 2025', 'PlantGrape'],               'Bourgogne; Champagne; Val-de-Loire',           'Supérieur',           'Inférieure',            'Moyenne à supérieure',  '',            '',        '',                      '4.44',   'Peu expressif en surproduction', 'Clone productif, adapté à la production de vins effervescents.'],
  ['Chardonnay', '95',  ['Guide 2025', 'PlantGrape'],               'Bourgogne; Champagne; Languedoc',              'Moyen',               'Moyenne à supérieure',  'Moyenne',               '',            '',        '',                      '12.59',  'Régulier, plus vigoureux que le clone 76', 'Clone apprécié pour sa régularité, ses caractéristiques agronomiques et la qualité des vins. Peut être utilisé pour effervescents.'],
  ['Chardonnay', '96',  ['Guide 2025', 'PlantGrape'],               'Bourgogne; Champagne; Languedoc; Val-de-Loire', 'Moyen à supérieur',   'Moyenne à supérieure',  'Moyenne',               '',            'Précoce', '',                      '28.3',   'Régulier, précoce, vins plus acides', 'Production régulière, à maîtriser pour vins tranquilles. Peut être utilisé pour effervescents.'],
  ['Chardonnay', '118', ['Guide 2025', 'PlantGrape'],               'Bourgogne; Champagne',                         'Supérieur',           'Moyenne',               'Supérieure',            '',            '',        '',                      '2.19',   'Vins dilués en surproduction', 'Clone adapté à la production de vins effervescents.'],
  ['Chardonnay', '121', ['Guide 2025', 'PlantGrape'],               'Bourgogne; Champagne',                         'Moyen',               'Moyenne',               'Moyenne',               '',            '',        '',                      '3.42',   'RAS', 'Clone apprécié pour ses caractéristiques agronomiques et la qualité des vins. Peut être utilisé pour effervescents.'],
  ['Chardonnay', '124', ['Guide 2025', 'PlantGrape'],               'Bourgogne; Champagne',                         'Supérieur',           'Inférieure à moyenne',  'Supérieure',            '',            'Tardif',  '',                      '5.82',   'Plus tardif, meilleure remise à fruit en cas de gel de printemps', 'Maîtriser la production pour vins tranquilles. Peut être utilisé pour effervescents.'],
  ['Chardonnay', '130', ['Guide 2025', 'PlantGrape'],               'Bourgogne; Champagne; Languedoc',              'Moyen à supérieur',   'Moyenne',               'Moyenne à supérieure',  '',            '',        '',                      '4.09',   'Vins dilués en surproduction', 'Clone adapté à la production de vins effervescents.'],
  ['Chardonnay', '131', ['Guide 2025', 'PlantGrape'],               'Bourgogne; Champagne',                         'Moyen à supérieur',   'Moyenne à supérieure',  'Moyenne',               '',            '',        '',                      '4.02',   'Régulier, vins plus acides', 'Maîtriser la production pour vins tranquilles. Peut être utilisé pour effervescents.'],
  ['Chardonnay', '132', ['Guide 2025', 'PlantGrape'],               'Bourgogne; Champagne',                         'Supérieur',           'Inférieure à moyenne',  'Supérieure',            '',            'Précoce', '',                      '3.34',   'Précoce', 'Clone adapté à la production de vins effervescents.'],
  ['Pinot noir', '115', ['Guide 2025', 'PlantGrape (hors réf. Champagne)'], 'Bourgogne; Languedoc',                         'Inférieur à moyen',   'Moyenne à supérieure',  'Inférieure à moyenne',  '',            '',        '',                      '12.64',  'Régulier, port moins retombant, production inférieure aux clones 927 et 779', 'Clone apprécié pour sa régularité de production, ses caractéristiques agronomiques et la qualité des vins. Bonnes aptitudes à l\'élaboration de vins de garde.'],
  ['Pinot noir', '236', ['Guide 2025', 'PlantGrape'],               'Bourgogne; Champagne',                         'Supérieur',           'Inférieure',            'Supérieure',            'Assez typé',  '',        'Moyenne à supérieure',  '3.51',   'RAS', 'Clone considéré comme «assez typé» en Champagne.'],
  ['Pinot noir', '292', ['Guide 2025', 'PlantGrape'],               'Bourgogne; Champagne',                         'Supérieur',           'Inférieure à moyenne',  'Moyenne à supérieure',  'Peu typé',    '',        '',                      '3.96',   'RAS', 'Peut être utilisé pour effervescents mais considéré «peu typé» en Champagne.'],
  ['Pinot noir', '375', ['Guide 2025', 'PlantGrape'],               'Bourgogne; Champagne; Languedoc',              'Supérieur',           'Inférieure à moyenne',  'Moyenne à supérieure',  '',            '',        '',                      '3.92',   'RAS', 'Rendement à maîtriser. Peut être utilisé pour effervescents.'],
  ['Pinot noir', '386', ['Guide 2025', 'PlantGrape'],               'Bourgogne; Champagne; Languedoc',              'Moyen à supérieur',   'Inférieure à moyenne',  'Supérieure',            'Typé',        '',        '',                      '4.62',   'Pellicule plus épaisse, baies moins colorées', 'Baies charnues. Effervescents. Considéré «typé» en Champagne.'],
  ['Pinot noir', '388', ['Guide 2025', 'PlantGrape'],               'Champagne',                                    'Moyen à supérieur',   'Inférieure',            'Supérieure',            'Peu typé',    '',        '',                      '2.17',   'Vins dilués en cas de surproduction', 'Considéré «peu typé» en Champagne.'],
  ['Pinot noir', '389', ['Guide 2025', 'PlantGrape'],               'Champagne',                                    'Moyen à supérieur',   'Inférieure',            'Supérieure',            'Peu typé',    '',        '',                      '2.06',   'Vins dilués en cas de surproduction', 'Considéré «peu typé» en Champagne.'],
  ['Pinot noir', '521', ['Guide 2025', 'PlantGrape'],               'Champagne',                                    'Moyen à supérieur',   'Moyenne',               'Moyenne à supérieure',  'Typé',        '',        '',                      '1.59',   'Grappes plus petites mais plus nombreuses', 'Considéré «typé» en Champagne.'],
  ['Pinot noir', '665', ['Guide 2025', 'PlantGrape'],               'Champagne',                                    'Supérieur',           'Inférieure',            'Supérieure',            'Assez typé',  '',        'Moyenne à supérieure',  '1.37',   'RAS', 'Considéré «assez typé» en Champagne.'],
  ['Pinot noir', '666', ['Guide 2025', 'PlantGrape'],               'Champagne',                                    'Supérieur',           'Inférieure',            'Supérieure',            'Assez typé',  '',        '',                      '1.8',    'Régulier', 'Considéré «assez typé» en Champagne.'],
  ['Pinot noir', '668', ['Guide 2025', 'PlantGrape'],               'Champagne',                                    'Moyen à supérieur',   'Inférieure',            'Supérieure',            'Peu typé',    '',        '',                      '0.74',   'Vins dilués en cas de surproduction', 'Considéré «peu typé» en Champagne.'],
  ['Pinot noir', '743', ['Guide 2025', 'PlantGrape'],               'Champagne',                                    'Supérieur',           'Moyenne',               'Supérieure',            'Peu typé',    '',        '',                      '1.23',   'Tendance à faire des fourches', 'Considéré «peu typé» en Champagne.'],
  ['Pinot noir', '779', ['Guide 2025', 'PlantGrape'],               'Champagne',                                    'Moyen',               'Moyenne à supérieure',  'Moyenne à supérieure',  'Typé',        '',        '',                      '0.77',   'Régulier, apte à la production de vin rouge', 'Considéré «typé» en Champagne.'],
  ['Pinot noir', '780', ['Guide 2025', 'PlantGrape'],               'Champagne',                                    'Moyen à supérieur',   'Inférieure',            'Supérieure',            'Typé',        '',        '',                      '0.39',   'RAS', 'Considéré «typé» en Champagne.'],
  ['Pinot noir', '792', ['Guide 2025', 'PlantGrape'],               'Champagne',                                    'Moyen à supérieur',   'Moyenne',               'Moyenne à supérieure',  'Typé',        '',        '',                      '1.38',   'RAS', 'Considéré «typé» en Champagne.'],
  ['Pinot noir', '870', ['Guide 2025', 'PlantGrape'],               'Champagne',                                    'Moyen à supérieur',   'Moyenne',               'Moyenne à supérieure',  'Typé',        '',        '',                      '0.99',   'RAS', 'Considéré «typé» en Champagne.'],
  ['Pinot noir', '871', ['Guide 2025', 'PlantGrape'],               'Champagne',                                    'Supérieur',           'Inférieure',            'Moyenne à supérieure',  'Typé',        '',        '',                      '0.95',   'RAS', 'Considéré «typé» en Champagne.'],
  ['Pinot noir', '872', ['Guide 2025', 'PlantGrape'],               'Champagne',                                    'Moyen à supérieur',   'Moyenne',               'Moyenne à supérieure',  'Typé',        '',        '',                      '0.64',   'RAS', 'Considéré «typé» en Champagne.'],
  ['Pinot noir', '927', ['Guide 2025', 'PlantGrape'],               'Champagne',                                    'Moyen',               'Moyenne à supérieure',  'Moyenne à supérieure',  'Typé',        '',        '',                      '0.57',   'Régulier, apte à la production de vin rouge', 'Considéré «typé» en Champagne.'],
  ['Meunier',    '458', ['PlantGrape'],                             'Champagne',                                    'Irrégulier',          'Supérieure',            'Inférieure à moyenne',  '',            '',        '',                      '',       '', 'Mutations reverses fréquentes pouvant entraîner la disparition du caractère «meunier».'],
  ['Meunier',    '791', ['Guide 2025', 'PlantGrape'],               'Champagne',                                    'Supérieur',           'Inférieure',            'Supérieure',            '',            'Précoce', '',                      '1.05',   'Plus précoce, régulier', 'Clone plus précoce avec feuilles plus découpées.'],
  ['Meunier',    '817', ['Guide 2025', 'PlantGrape'],               'Champagne',                                    'Moyen',               'Moyenne',               'Moyenne',               '',            'Précoce', '',                      '1.75',   'Plus précoce, régulier', 'Clone plus précoce.'],
  ['Meunier',    '818', ['Guide 2025', 'PlantGrape'],               'Champagne',                                    'Moyen à supérieur',   'Moyenne',               'Moyenne',               '',            'Précoce', 'Moyenne à supérieure',  '1.26',   'Plus précoce, régulier', 'Clone plus précoce.'],
  ['Meunier',    '864', ['Guide 2025', 'PlantGrape'],               'Champagne',                                    'Moyen',               'Moyenne',               'Moyenne',               '',            '',        '',                      '0.63',   'Degré irrégulier', ''],
  ['Meunier',    '865', ['Guide 2025', 'PlantGrape'],               'Champagne',                                    'Moyen',               'Supérieure',            'Supérieure',            '',            '',        '',                      '1.7',    'RAS', ''],
  ['Meunier',    '900', ['Guide 2025', 'PlantGrape'],               'Champagne',                                    'Moyen',               'Supérieure',            'Moyenne',               '',            '',        'Moyenne à supérieure',  '1.58',   'Mutations réverses plus fréquentes', 'Mutations reverses possibles pouvant entraîner la disparition du caractère «meunier».'],
  ['Meunier',    '924', ['Guide 2025', 'PlantGrape'],               'Champagne',                                    'Moyen',               'Supérieure',            'Moyenne',               '',            '',        'Moyenne à supérieure',  '2.4',    'RAS', ''],
  ['Meunier',    '925', ['Guide 2025', 'PlantGrape (hors réf. Champagne)'], 'Val-de-Loire',                                 'Supérieur',           'Inférieure',            'Moyenne',               '',            '',        '',                      '0.65',   'RAS', ''],
  ['Meunier',    '977', ['Guide 2025', 'PlantGrape'],               'Champagne',                                    'Moyen',               'Supérieure',            'Supérieure',            '',            'Tardif',  '',                      '0.89',   'Plus tardif, régulier', 'Clone plus tardif.'],
  ['Meunier',    '978', ['Guide 2025', 'PlantGrape'],               'Champagne',                                    'Moyen à supérieur',   'Moyenne',               'Moyenne',               '',            '',        '',                      '0.88',   'RAS', ''],
  ['Meunier',    '983', ['Guide 2025', 'PlantGrape'],               'Champagne',                                    'Supérieur',           'Inférieure',            'Supérieure',            '',            '',        '',                      '0.16',   'Mutations réverses plus fréquentes', 'Mutations reverses possibles pouvant entraîner la disparition du caractère «meunier».']
];
const CLONES_CHAMPAGNE = CLONES_CHAMPAGNE_ROWS.map(r => Object.freeze({
  cepage: r[0], clone: r[1], sources: Object.freeze(r[2]), refAgronomiques: r[3],
  production: r[4], sucre: r[5], fertilite: r[6], typiciteChampagne: r[7],
  precocite: r[8], botrytis: r[9], multiplicationHa: r[10],
  remarqueGuide: r[11], remarquePlantGrape: r[12]
}));

// Lignes d'un cépage, triées par NUMÉRO de clone croissant (tri numérique, pas
// lexicographique : 75 avant 118). Jamais de tri par production — l'échelle
// PlantGrape est qualitative et un classement suggérerait un jugement que les
// sources ne portent pas.
function clonesParCepage(cepage) {
  return CLONES_CHAMPAGNE
    .filter(c => c.cepage === cepage)
    .sort((a, b) => Number(a.clone) - Number(b.clone));
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

/* =====================================================================
   Régimes de travail de l'arrachage — chantier B5, bloc 4 pédagogique
   de l'écran 5 (« ne pas surpromettre »). La note de cadrage demande de
   montrer que la parcelle renouvelée « reste entretenue mais représente
   un travail moins important » — vrai pendant le REPOS, douteux sur le
   PLANTIER (taille de formation, protection, remplacement des manquants,
   désherbage : du vrai travail, pas une économie), le seul poste où
   l'économie est franche étant la vendange. Segmenter en 3 fenêtres
   calendaires plutôt que d'agréger en un message unique est donc une
   décision métier — elle vit ici, pas dans index.html.

   Bornes identiques à celles de chargesEntretien (repos, repos+rampYears)
   pour ne pas introduire une deuxième découpe du calendrier qui
   diverge silencieusement de celle déjà utilisée pour les charges. Pour
   chaque fenêtre, moyenne heuresManuellesParAnnee (arrachage vs la MÊME
   fenêtre en référence statu quo, pour donner le repère "à quoi ça
   correspondrait si on ne touchait à rien") et signale si une récolte
   de la parcelle a lieu sur la fenêtre (vendangeActive) — la fenêtre
   "plantier" peut chevaucher le début de la production réelle
   (returnYear = 3+repos) selon la valeur de rampYears : ce n'est pas
   toujours vrai que "plantier ⇒ pas de vendange", d'où un calcul
   explicite plutôt qu'une hypothèse câblée en dur.
   ===================================================================== */
function regimesTravailArrachage(scArr, scSQ, inp, opsManuel = REF_OPS_MANUEL, fracFormation = 0.35) {
  const rampYears = inp.rampYears ?? (inp.ramp ? inp.ramp.length : 3);
  const hArr = heuresManuellesParAnnee('arrachage', scArr, inp, opsManuel, fracFormation);
  const hRef = heuresManuellesParAnnee('statuquo', scSQ, inp, opsManuel, fracFormation);
  const bornes = [
    { id: 'repos', lib: 'Repos du sol', debut: 0, fin: inp.repos },
    { id: 'plantier', lib: 'Jeune vigne en formation', debut: inp.repos, fin: inp.repos + rampYears },
    { id: 'production', lib: 'Vigne mature en production', debut: inp.repos + rampYears, fin: inp.horizon + 1 }
  ];
  const plafond = inp.horizon + 1;
  return bornes.map(b => {
    const debut = Math.max(0, Math.min(b.debut, plafond));
    const fin = Math.max(debut, Math.min(b.fin, plafond));
    const nbAnnees = fin - debut;
    let heuresArrSomme = 0, heuresRefSomme = 0, recolteSomme = 0;
    for (let t = debut; t < fin; t++) {
      heuresArrSomme += hArr[t];
      heuresRefSomme += hRef[t];
      recolteSomme += scArr[t].recolteParcelle;
    }
    return {
      id: b.id, lib: b.lib, nbAnnees,
      heuresHaAn: nbAnnees > 0 ? heuresArrSomme / nbAnnees : 0,
      heuresHaAnRef: nbAnnees > 0 ? heuresRefSomme / nbAnnees : 0,
      vendangeActive: recolteSomme > 1e-9
    };
  });
}

// Chantier A2 — uniformisation de l'arrachage (décision CIVC de juillet 2026,
// NON ENCORE PUBLIÉE à ce jour). Le motif classique/sanitaire disparaît : le
// vigneron choisit librement une durée de repos du sol de 1, 2 ou 3 ans, qui
// détermine mécaniquement le nombre de déblocages de réserve. Voir README,
// journal d'arbitrages « chantier A2 ». Statut réglementaire à rappeler côté
// UI tant que la décision CIVC n'est pas publiée.
// ⚠ ATTENTION — NE PAS CONFONDRE AVEC `VOLCO_CAMPAGNE`.
// VOL_SORTIE_ARRACHAGE vaut 9 000 kg/ha, et le VolCo de la campagne 2025 valait
// lui aussi 9 000 kg/ha : c'est une COÏNCIDENCE de chiffres, pas une égalité de
// nature. Le premier est le volume annuel débloqué de la réserve individuelle
// pendant la fenêtre d'arrachage (règle CIVC repos -> déblocages) ; le second
// est le volume commercialisable voté chaque année. Les deux ne se mettent pas
// à jour ensemble : le VolCo change à chaque campagne (8 800 en 2026), celui-ci
// non. Ne jamais dériver l'un de l'autre, ni les remplacer par une constante
// unique. Voir README §19.
/* =====================================================================
   Trésorerie cumulée d'un scénario — prompt 7.

   Cette série existait, mais elle était assemblée dans index.html (`serieRep`
   / `serieRepParcelle` / `cum`). Elle passe ici parce que la frise de
   trajectoire la dessine : une courbe et un tableau qui divergeraient d'un
   arrondi seraient impossibles à départager à l'écran.

   `vue` est la vue de faire-valoir affichée : '1' ensemble, 'exp' part
   exploitant, 'prop' part propriétaire.

   `parcelleSeule` neutralise le flux du reste de l'exploitation
   (venteRaisinReste et coutsReste à 0) pour répondre à « combien cette
   opération me coûte-t-elle à financer, et quand ». C'est nécessaire : sur la
   trésorerie de toute l'exploitation, le revenu du reste du domaine masque
   presque toujours l'effort propre à l'opération. Le procédé est le même que
   celui déjà employé pour simuler « sans réserve » (cashRI à 0) et
   `repartir()` est réutilisée telle quelle, sans règle nouvelle.

   Pure : ne mute ni `scen` ni ses lignes (l'objet passé à `repartir` est une
   copie).
   ===================================================================== */
function tresorerieCumulee(scen, fv, vue, opt) {
  const parcelleSeule = !!(opt && opt.parcelleSeule);
  let acc = 0;
  const annuelle = [], cumulee = [];
  (scen.eur || []).forEach(row => {
    let v;
    if (parcelleSeule) {
      if (vue === 'exp' || vue === 'prop') {
        const part = repartir({ ...row, venteRaisinReste: 0, coutsReste: 0 }, fv);
        v = vue === 'exp' ? part.exp : part.prop;
      } else {
        v = row.venteRaisinParcelle + row.cashRI - row.coutsParcelle;
      }
    } else if (vue === 'exp' || vue === 'prop') {
      const part = repartir(row, fv);
      v = vue === 'exp' ? part.exp : part.prop;
    } else {
      v = row.cashNet;
    }
    annuelle.push(v);
    acc += v;
    cumulee.push(acc);
  });
  return { annuelle, cumulee };
}

/* =====================================================================
   Phases de la parcelle renouvelée — prompts 5 et 7.

   Le temps est partout dans l'outil (« années 3-4 », « repos », « plantier »,
   « à 10 ans ») et n'était jamais dessiné. Pour le dessiner il faut d'abord
   le NOMMER, année par année, et une seule fois : ces deux fonctions portent
   la découpe, l'interface ne fait que la colorier.

   La découpe suit exactement la convention de `simulerReserveKg` (§7), elle
   ne la réinterprète pas :
     t = 0                      arrachage — le chantier lui-même, sol nu
     1 <= t < repos             repos du sol (vide si repos = 1)
     repos <= t < repos + 3     plantier — la vigne est en terre, elle ne
                                produit pas encore
     t >= repos + 3             en production
   `repos` est donc bien la durée pendant laquelle le sol reste nu, année
   d'arrachage comprise : la plantation a lieu à t = repos (c'est là que
   `construireScenarios` place invArr[repos]), et l'entrée en production à
   t = repos + 3 (`returnYear`, la 3e feuille).
   ===================================================================== */
const DELAI_PLANTIER = 3;   // années entre la plantation et la 3e feuille

// Année de retour en production, comptée depuis l'arrachage.
function anneeRetourProduction(repos) {
  return DELAI_PLANTIER + Math.max(0, +repos || 0);
}

// Segments de phase sur l'axe 0..horizon, bornes [debut, fin[ en années.
// Un segment de durée nulle (le repos quand repos = 1) n'est pas renvoyé :
// une bande de largeur zéro n'a rien à dire à l'écran.
function phasesParcelle(repos, horizon) {
  const r = Math.max(0, +repos || 0);
  const h = Math.max(0, +horizon || 0);
  const brut = [
    { id: 'arrachage',  lib: 'arrachage',      debut: 0,     fin: 1 },
    { id: 'repos',      lib: 'repos du sol',   debut: 1,     fin: r },
    { id: 'plantier',   lib: 'plantier',       debut: r,     fin: r + DELAI_PLANTIER },
    { id: 'production', lib: 'en production',  debut: r + DELAI_PLANTIER, fin: h + 1 }
  ];
  return brut
    .map(p => ({ ...p, debut: Math.min(p.debut, h + 1), fin: Math.min(p.fin, h + 1) }))
    .filter(p => p.fin > p.debut);
}

// La même découpe, ramenée à un identifiant de phase par année — c'est ce que
// consomment les pistes alignées sur l'axe des années (prompt 7).
function phaseParAnnee(repos, horizon) {
  const segs = phasesParcelle(repos, horizon);
  const h = Math.max(0, +horizon || 0);
  return Array.from({ length: h + 1 }, (_, t) => {
    const seg = segs.find(p => t >= p.debut && t < p.fin);
    return seg ? seg.id : 'production';
  });
}

const VOL_SORTIE_ARRACHAGE = 9000; // kg/ha/an, inchangé depuis avant ce chantier — voir README §19
const NB_SORTIE_PAR_REPOS = { 1: 3, 2: 4, 3: 5 }; // repos (ans) -> nb d'années de déblocage
function nbSortiePourRepos(repos) {
  const nbSortie = NB_SORTIE_PAR_REPOS[repos];
  if (nbSortie === undefined) {
    throw new Error(`nbSortiePourRepos: durée de repos non prévue (${repos}) — attendu 1, 2 ou 3 ans`);
  }
  return nbSortie;
}

/* =====================================================================
   Prompt A2 — constantes de campagne, sorties de `renderVals()`.

   Ces trois valeurs étaient câblées en dur dans la vue (index.html). Depuis
   l'arbitrage 8, l'écart-type régional pilote le SCÉNARIO PAR DÉFAUT de
   l'outil : une valeur non sourcée et non testable ne pouvait plus rester
   dans le rendu. Elles sont ici pour être lues par la vue, pas pour entrer
   dans `inp` autrement que via les champs existants.
   ===================================================================== */

// Plafond de la réserve individuelle. Non éditable dans l'UI.
const PLAFOND_RESERVE = 10000;        // kg/ha

// Rendement moyen régional de référence et son écart-type, utilisés par le
// test de résistance climatique (« mauvaise vendange » = moyenne − écart-type).
// Reprises telles quelles de `renderVals()`, où elles étaient non sourcées.
// assumé — provenance et période de calcul du couple (moyenne, écart-type) à
// documenter avant diffusion.
const REND_MOYEN_REGIONAL = 12296.6;  // kg/ha
const ECART_TYPE_REGIONAL = 3440;     // kg/ha

// Volume commercialisable de la campagne — VALEUR ANNUELLE, À REVÉRIFIER À
// CHAQUE CAMPAGNE. Campagne 2026 : 8 800 kg/ha, Bureau exécutif du Comité
// Champagne du 22/07/2026. Historique : 9 000 en 2025, 10 000 en 2024,
// 11 400 en 2023, 12 000 en 2022. Sert de valeur PAR DÉFAUT du champ VolCo ;
// l'utilisateur reste libre de la modifier. Voir aussi l'avertissement
// au-dessus de VOL_SORTIE_ARRACHAGE : les deux constantes sont distinctes.
const VOLCO_CAMPAGNE = 8800;          // kg/ha

/* =====================================================================
   Prompt A3 — interaction entre le test de résistance climatique et le VolCo.

   Le test de résistance force le rendement d'une vendange à
   REND_MOYEN_REGIONAL − ECART_TYPE_REGIONAL = 8 856,6 kg/ha. Ce que cette
   « mauvaise année » produit dépend entièrement du VolCo en vigueur :

     - VolCo 9 000 (campagne 2025) : 8 856,6 − 9 000 = −143,4 kg/ha,
       la mauvaise vendange est DÉFICITAIRE, elle puise dans la réserve ;
     - VolCo 8 800 (campagne 2026) : 8 856,6 − 8 800 = +56,6 kg/ha,
       la même mauvaise vendange devient EXCÉDENTAIRE, elle abonde la réserve.

   Autrement dit, le scénario par défaut de l'outil change de nature selon un
   champ que l'utilisateur peut modifier, sans que rien ne le signale. Cette
   fonction ne CHANGE pas ce comportement — `simulerReserveKg` est inchangé —
   elle le rend visible et testable. Voir README §19.
   ===================================================================== */
function stressEstDeficitaire(volco) {
  return (REND_MOYEN_REGIONAL - ECART_TYPE_REGIONAL) - volco < 0;
}

// Chantier A3 — remplace les paliers de montée en charge (sélecteur 30/60/100 %
// ou 50/80/100 %) par une rampe linéaire dérivée d'une seule saisie : l'année
// de pleine production, comptée depuis la plantation. L'année 3 est l'entrée
// en production (3e feuille), qui coïncide avec le premier millésime sans
// déblocage de réserve (`returnYear = 3 + repos`, §7) — c'est donc la borne
// basse de `anneePleineProd`. Voir README, journal d'arbitrages « chantier A3 ».
function rampeLineaire(anneePleineProd) {
  if (!(anneePleineProd >= 3)) {
    throw new Error(`rampeLineaire: anneePleineProd doit être ≥ 3 (reçu ${anneePleineProd})`);
  }
  const n = anneePleineProd - 2; // nombre de paliers annuels depuis l'entrée en production (année 3)
  return Array.from({ length: n }, (_, i) => (i + 1) / n);
}

if (typeof module !== 'undefined') module.exports =
  { simulerReserveKg, coucheEuro, repartir, cumul, construireScenarios, manqueAGagner,
    chargesEntretien, coutPalissage, PRIX_PALISSAGE, FILS_PAR_TAILLE, largeurEquivalente,
    coutProtectionPlant, PRIX_PROTECTION_PLANT, preconPorteGreffe,
    REF_OPS_MANUEL, REF_OPS_MECANISE, TAUX_HORAIRE_DEFAUT, SMIC_2026_BRUT,
    proposerVoletProduction, heuresManuellesParAnnee, moEconomisee, regimesTravailArrachage,
    ageRegistre, agregerRegistreExploitation, agregerRegistreParcelle, synthetiseRegistre, trajectoireAge,
    prochainIdRegistre, ligneRegistreVierge, resoudreParcelleIdu,
    nbSortiePourRepos, VOL_SORTIE_ARRACHAGE, rampeLineaire, geometrieAgronomique,
    DELAI_PLANTIER, anneeRetourProduction, phasesParcelle, phaseParAnnee, tresorerieCumulee,
    conformiteDensiteAOC, metresDeRang, DENSITE_AOC_MIN, DENSITE_AOC_MAX,
    CLONES_CHAMPAGNE, clonesParCepage,
    PLAFOND_RESERVE, REND_MOYEN_REGIONAL, ECART_TYPE_REGIONAL, VOLCO_CAMPAGNE,
    stressEstDeficitaire };
if (typeof window !== 'undefined') window.OAD =
  { simulerReserveKg, coucheEuro, repartir, cumul, construireScenarios, manqueAGagner,
    chargesEntretien, coutPalissage, PRIX_PALISSAGE, FILS_PAR_TAILLE, largeurEquivalente,
    coutProtectionPlant, PRIX_PROTECTION_PLANT, preconPorteGreffe,
    REF_OPS_MANUEL, REF_OPS_MECANISE, TAUX_HORAIRE_DEFAUT, SMIC_2026_BRUT,
    proposerVoletProduction, heuresManuellesParAnnee, moEconomisee, regimesTravailArrachage,
    ageRegistre, agregerRegistreExploitation, agregerRegistreParcelle, synthetiseRegistre, trajectoireAge,
    prochainIdRegistre, ligneRegistreVierge, resoudreParcelleIdu,
    nbSortiePourRepos, VOL_SORTIE_ARRACHAGE, rampeLineaire, geometrieAgronomique,
    DELAI_PLANTIER, anneeRetourProduction, phasesParcelle, phaseParAnnee, tresorerieCumulee,
    conformiteDensiteAOC, metresDeRang, DENSITE_AOC_MIN, DENSITE_AOC_MAX,
    CLONES_CHAMPAGNE, clonesParCepage,
    PLAFOND_RESERVE, REND_MOYEN_REGIONAL, ECART_TYPE_REGIONAL, VOLCO_CAMPAGNE,
    stressEstDeficitaire };

}
