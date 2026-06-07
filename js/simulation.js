function runSim(idu) {
  var feat = PARCELLES_GEOJSON.features.find(function(f) { return f.properties.idu === idu; });
  if (!feat) return;
  var p = feat.properties, ex = getEx(p.num_civc) || { surface_totale: 1 };
  var typeArr = document.getElementById('s-type').value;
  var modeRep = document.getElementById('s-mode').value;
  var volco = +document.getElementById('s-volco').value || 9000;
  var rend = +document.getElementById('s-rend').value || 15500;
  var surfTot = ex.surface_totale, surfArr = pv(p, 'surface_ss_parcelle');
  var riInit = getRI(p.num_civc), plaf = 10000, volAn = 9000;
  var repos = typeArr === 'Sanitaire' ? 3 : 1, sortie = typeArr === 'Sanitaire' ? 5 : 3;
  var antic = modeRep === 'Anticipée';

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
  for (var t = 0; t <= 10; t++) {
    var s = sp(t), rec = s * rend, vc = s * volco, deb = stk;
    var exc = rec - vc, mise = exc > 0 ? Math.min(exc, plaf * surfTot - deb) : 0;
    var def = exc < 0 ? -exc : 0, sins = Math.min(def, deb + mise), aft = deb + mise - sins;
    var sarr = (!antic && t >= 1 && t <= sortie) ? Math.min(volAn * surfArr, aft) : 0;
    stk = Math.max(0, aft - sarr);
    var sha = surfTot > 0 ? stk / surfTot : 0;
    rows.push({ t: t, ph: ph(t), rec: Math.round(rec), vc: Math.round(vc), mise: Math.round(mise), sins: Math.round(sins), sarr: Math.round(sarr), fin: Math.round(stk), sha: Math.round(sha), tx: +(sha / plaf).toFixed(3) });
  }

  var minHA = Math.min.apply(null, rows.map(function(r) { return r.sha; }));
  var annMin = rows.find(function(r) { return r.sha === minHA; }).t;
  var cov = typeArr === 'Sanitaire' ? .98 : .84;

  document.getElementById('sim-out').style.display = '';
  document.getElementById('sim-kpis').innerHTML =
    '<div class="sim-kpi"><div class="sk-l">Stock min.</div><div class="sk-v">' + minHA.toLocaleString('fr') + '</div><div class="sk-u">kg/ha · an ' + annMin + '</div></div>' +
    '<div class="sim-kpi"><div class="sk-l">Couverture frais</div><div class="sk-v" style="color:' + (cov >= .95 ? 'var(--vert)' : 'var(--orange)') + '">' + Math.round(cov * 100) + '%</div><div class="sk-u">par sorties RI</div></div>' +
    '<div class="sim-kpi"><div class="sk-l">Stock an 10</div><div class="sk-v">' + rows[rows.length - 1].sha.toLocaleString('fr') + '</div><div class="sk-u">kg/ha</div></div>';

  drawChart(rows);

  var rc = function(ha) { return ha < 4000 ? 'ri-low' : ha < 7500 ? 'ri-med' : 'ri-ok'; };
  document.getElementById('sim-t').innerHTML =
    '<thead><tr><th>An</th><th>Phase</th><th>Récolte</th><th>Mise RI</th><th>S.Arr.</th><th>Stock kg/ha</th><th>Tx RI</th></tr></thead><tbody>' +
    rows.map(function(r) {
      return '<tr><td>' + r.t + '</td><td style="font-size:8px">' + r.ph + '</td><td>' + r.rec.toLocaleString('fr') + '</td><td style="color:var(--vert)">' + (r.mise > 0 ? '+' + r.mise.toLocaleString('fr') : '-') + '</td><td style="color:var(--rouge)">' + (r.sarr > 0 ? '-' + r.sarr.toLocaleString('fr') : '-') + '</td><td class="' + rc(r.sha) + '">' + r.sha.toLocaleString('fr') + '</td><td class="' + rc(r.sha) + '">' + (r.tx * 100).toFixed(0) + '%</td></tr>';
    }).join('') + '</tbody>';
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
