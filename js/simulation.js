function runSim(idu) {
  var feat = PARCELLES_GEOJSON.features.find(function(f) { return f.properties.idu === idu; });
  if (!feat) return;
  var p = feat.properties, ex = getEx(p.num_civc) || { surface_totale: 1 };
  var typeArr = document.getElementById('s-type').value;
  var modeRep = document.getElementById('s-mode').value;
  var volco = +document.getElementById('s-volco').value || 9000;
  var rend = +document.getElementById('s-rend').value || 15500;
  var surfTot = ex.surface_totale, surfArr = pv(p, 'surface_ss_parcelle');
  var riInit = getRI(p.num_civc);
  var dureeRepos = typeArr === 'Sanitaire' ? 3 : 1;
  var anticipe = modeRep === 'Anticipée';

  var simParams = {
    surfTot:             surfTot,
    surfArr:             surfArr,
    riInit:              riInit,
    volco:               volco,
    rend:                rend,
    plafondRI:           10000,
    sortieAnnuelleParHa: 9000,
    dureeRepos:          dureeRepos,
    finSortie:           typeArr === 'Sanitaire' ? 5 : 3,
    anticipe:            anticipe,
    horizon:             10
  };

  var proj = projeterReserve(simParams);
  var rows = proj.rows, minHA = proj.stockMin, annMin = proj.anneeStockMin;

  var plantationParams = {
    surf: surfArr,
    rang: 1.5, pied: 0.95, paires: 2,
    prixPlant: 1.8,
    basePal: 3.0,
    palFactor: 1.0,
    cPriceCouvert: 260,
    dureeCouvert: dureeRepos,
    prixPrepHa: 3800, margePlants: 1.05
  };
  var bilan = calculerBilanRenouvellement({
    simulation: simParams,
    plantation: plantationParams,
    eco: REFERENTIEL_ECO,
    timing: { anneePlantation: anticipe ? 0 : dureeRepos }
  });

  var couv = bilan.indicateurs.couvertureRI;
  var couvPct = Math.round(couv * 100);
  var couvStyle = couv >= 0.9 ? 'color:var(--vert)' : couv >= 0.5 ? 'color:var(--orange)' : '';

  document.getElementById('sim-out').style.display = '';
  document.getElementById('sim-kpis').innerHTML =
    '<div class="sim-kpi"><div class="sk-l">Stock min.</div><div class="sk-v">' + minHA.toLocaleString('fr') + '</div><div class="sk-u">kg/ha · an ' + annMin + '</div></div>' +
    '<div class="sim-kpi"><div class="sk-l">Couverture frais</div><div class="sk-v" style="' + couvStyle + '">' + couvPct + ' %</div><div class="sk-u">par sorties RI</div></div>' +
    '<div class="sim-kpi"><div class="sk-l">Stock an 10</div><div class="sk-v">' + rows[rows.length - 1].sha.toLocaleString('fr') + '</div><div class="sk-u">kg/ha</div></div>';

  drawChart(rows);

  var rc = function(ha) { return ha < 4000 ? 'ri-low' : ha < 7500 ? 'ri-med' : 'ri-ok'; };
  document.getElementById('sim-t').innerHTML =
    '<thead><tr><th>An</th><th>Phase</th><th>Récolte</th><th>Mise RI</th><th>S.Arr.</th><th>Stock kg/ha</th><th>Tx RI</th></tr></thead><tbody>' +
    rows.map(function(r) {
      return '<tr><td>' + r.t + '</td><td style="font-size:8px">' + r.ph + '</td><td>' + r.rec.toLocaleString('fr') + '</td><td style="color:var(--vert)">' + (r.mise > 0 ? '+' + r.mise.toLocaleString('fr') : '-') + '</td><td style="color:var(--rouge)">' + (r.sarr > 0 ? '-' + r.sarr.toLocaleString('fr') : '-') + '</td><td class="' + rc(r.sha) + '">' + r.sha.toLocaleString('fr') + '</td><td class="' + rc(r.sha) + '">' + (r.tx * 100).toFixed(0) + '%</td></tr>';
    }).join('') + '</tbody>';

  var ecoOut = document.getElementById('eco-out');
  if (!ecoOut) return;
  var eur = function(v) { return Math.round(v).toLocaleString('fr') + ' €'; };
  var negStyle = function(v) { return v < 0 ? ' style="color:var(--rouge)"' : ''; };

  var fluxRows = bilan.flux.map(function(r) {
    var couts = r.coutArrachage + r.coutCouvert + r.coutPlantation;
    return '<tr>' +
      '<td>' + r.t + '</td>' +
      '<td>' + eur(r.sortieRI_euros) + '</td>' +
      '<td>' + eur(r.aides) + '</td>' +
      '<td>' + eur(couts) + '</td>' +
      '<td>' + eur(r.manqueAGagner) + '</td>' +
      '<td' + negStyle(r.net) + '>' + eur(r.net) + '</td>' +
      '<td' + negStyle(r.cumul) + '>' + eur(r.cumul) + '</td>' +
    '</tr>';
  }).join('');

  ecoOut.style.display = '';
  ecoOut.innerHTML =
    '<div class="chart-cap" style="margin-bottom:.75rem"><b>Bilan économique du renouvellement — vue mono-parcelle</b></div>' +
    '<div class="sim-kpis">' +
      '<div class="sim-kpi"><div class="sk-l">Besoin de trésorerie</div><div class="sk-v">' + eur(bilan.indicateurs.besoinTresorerieMax) + '</div><div class="sk-u">an ' + bilan.indicateurs.anneeBesoinMax + '</div></div>' +
      '<div class="sim-kpi"><div class="sk-l">Couverture aides</div><div class="sk-v">' + Math.round(bilan.indicateurs.couvertureAides * 100) + ' %</div></div>' +
      '<div class="sim-kpi"><div class="sk-l">Reste à charge 10 ans</div><div class="sk-v">' + eur(bilan.indicateurs.resteACharge10ans) + '</div><div class="sk-u">investissement non encore amorti</div></div>' +
    '</div>' +
    '<div class="sim-tw"><table class="sim-t">' +
      '<thead><tr><th>An</th><th>Sorties RI</th><th>Aides</th><th>Coûts</th><th>Manque à gagner</th><th>Net</th><th>Cumul</th></tr></thead>' +
      '<tbody>' + fluxRows + '</tbody>' +
    '</table></div>' +
    '<p style="font-size:10px;opacity:.55;margin-top:.6rem;line-height:1.5">' +
      'Coût de plantation estimé sur configuration standard — affiner via le module Plantation. ' +
      'Coût d’arrachage et indemnité de perte de recettes : valeurs indicatives à confirmer (Comité Champagne / FranceAgriMer).' +
    '</p>';
}

function drawChart(rows) {
  var cvs = document.getElementById('sim-cvs');
  if (!cvs) return;
  var DPR = window.devicePixelRatio || 1, W = cvs.parentElement.clientWidth || 340, H = 158;
  cvs.width = W * DPR; cvs.height = H * DPR; cvs.style.width = W + 'px'; cvs.style.height = H + 'px';
  var ctx = cvs.getContext('2d'); ctx.scale(DPR, DPR);
  var P = { t: 10, r: 10, b: 26, l: 42 }, cw = W - P.l - P.r, ch = H - P.t - P.b, n = rows.length, MX = 12000;
  var xp = function(i) { return P.l + (i / (n - 1)) * cw; };
  var yp = function(v) { return P.t + ch - Math.min(1, Math.max(0, v / MX)) * ch; };
  ctx.clearRect(0, 0, W, H);

  // Grille horizontale
  [0, 2500, 5000, 7500, 10000].forEach(function(v) {
    var y = yp(v); ctx.strokeStyle = 'rgba(26,25,22,.07)'; ctx.lineWidth = 1; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(P.l, y); ctx.lineTo(P.l + cw, y); ctx.stroke();
    ctx.fillStyle = 'rgba(116,111,98,.85)'; ctx.font = "10px 'IBM Plex Mono',monospace"; ctx.textAlign = 'right';
    ctx.fillText((v / 1000) + 'k', P.l - 6, y + 3);
  });

  // Barres sortie réserve
  rows.forEach(function(r, i) {
    if (r.sarr > 0) {
      var bw = Math.max(5, cw / (n - 1) * .46);
      ctx.fillStyle = 'rgba(166,50,43,.30)';
      ctx.fillRect(xp(i) - bw / 2, yp(r.sarr), bw, (r.sarr / MX) * ch);
    }
  });

  // Aire sous la courbe (or)
  ctx.beginPath();
  rows.forEach(function(r, i) { i === 0 ? ctx.moveTo(xp(i), yp(r.sha)) : ctx.lineTo(xp(i), yp(r.sha)); });
  ctx.lineTo(xp(n - 1), yp(0)); ctx.lineTo(xp(0), yp(0)); ctx.closePath();
  var g = ctx.createLinearGradient(0, P.t, 0, P.t + ch);
  g.addColorStop(0, 'rgba(200,175,130,.30)'); g.addColorStop(1, 'rgba(200,175,130,.03)');
  ctx.fillStyle = g; ctx.fill();

  // Plafond réglementaire
  ctx.setLineDash([5, 4]); ctx.strokeStyle = 'rgba(154,123,61,.65)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(P.l, yp(10000)); ctx.lineTo(P.l + cw, yp(10000)); ctx.stroke(); ctx.setLineDash([]);

  // Courbe stock RI (marine)
  ctx.beginPath(); ctx.strokeStyle = '#1C2C49'; ctx.lineWidth = 2.2; ctx.lineJoin = 'round';
  rows.forEach(function(r, i) { i === 0 ? ctx.moveTo(xp(i), yp(r.sha)) : ctx.lineTo(xp(i), yp(r.sha)); });
  ctx.stroke();
  rows.forEach(function(r, i) {
    ctx.beginPath(); ctx.arc(xp(i), yp(r.sha), 3, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = 1.6; ctx.strokeStyle = '#1C2C49'; ctx.stroke();
  });

  // Axe X
  ctx.fillStyle = 'rgba(116,111,98,.85)'; ctx.font = "10px 'IBM Plex Mono',monospace"; ctx.textAlign = 'center';
  rows.forEach(function(r, i) { if (i % 2 === 0) ctx.fillText('a' + r.t, xp(i), H - P.b + 15); });
}
