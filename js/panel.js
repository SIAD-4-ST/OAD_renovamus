var SORT_FNS = {
  I:    function(a, b) { return calcI(b).I - calcI(a).I; },
  surf: function(a, b) { return pv(b.properties, 'surface_ss_parcelle') - pv(a.properties, 'surface_ss_parcelle'); },
  age:  function(a, b) { return a.properties.anneeplant - b.properties.anneeplant; },
  manq: function(a, b) { return pv(b.properties, 'taux_manquant') - pv(a.properties, 'taux_manquant'); }
};

function setSort(v) { S.sort = v; refreshStyles(); }

function buildList(feats) {
  var sorted = feats.slice().sort(SORT_FNS[S.sort] || SORT_FNS.I);
  document.getElementById('list-count').textContent = sorted.length + (sorted.length > 1 ? ' parcelles' : ' parcelle');
  var el = document.getElementById('pl');
  if (!sorted.length) {
    el.innerHTML = '<div class="empty-st"><div class="ei">◈</div>' +
      (S.commune ? 'Aucune parcelle\ndans cette sélection.' : 'Sélectionnez une commune\npour afficher les parcelles.').replace(/\n/g, '<br>') + '</div>';
    return;
  }
  el.innerHTML = sorted.map(function(f) {
    var p = f.properties, r = calcI(f), I = r.I, col = iColor(I);
    var dist = getFdDist(p);
    var tag = communeFD() ? (dist !== null
        ? '<span class="pl-tag t-dist">' + dist + ' m</span>'
        : '<span class="pl-tag t-fd">FD ?</span>') : '';
    return '<div class="pl-item' + (p.idu === S.selIdu ? ' active' : '') + '" onclick="selectById(\'' + p.idu + '\')">' +
      '<div class="pl-badge" style="background:' + col + '14;color:' + col + ';border-color:' + col + '44">' + I.toFixed(0) + '<span class="bl">' + iLabel(I).slice(0,4) + '</span></div>' +
      '<div class="pl-info">' +
        '<div class="pl-idu"><span class="mono">' + p.idu + '</span>' + tag + '</div>' +
        '<div class="pl-meta">' + p.cepage + ' · ' + (ANNEE - p.anneeplant) + ' ans · ' + pv(p, 'surface_ss_parcelle') + ' ha · ' + p.lieu_dit + '</div>' +
      '</div>' +
      (S.mode === 'vign' ? '<button class="pl-sim" onclick="event.stopPropagation();selectById(\'' + p.idu + '\');openSimModal(\'' + p.idu + '\')">SIM</button>' : '') +
    '</div>';
  }).join('');
}

function selectById(idu) {
  var f = PARCELLES_GEOJSON.features.find(function(f) { return f.properties.idu === idu; });
  if (f) selectFeat(f);
}
function selectFeat(feat) {
  S.selIdu = feat.properties.idu;
  refreshStyles();
  openPanel(feat);
  try { map.fitBounds(L.geoJSON(feat).getBounds().pad(0.4)); } catch(e) {}
}
function goSim() {}

// ───────────── Simulation en modale ─────────────
function simControlsHTML(idu) {
  return '<div class="sim-grid sim-modal-grid">' +
    '<div class="si"><label>Type d\'arrachage</label><select class="fi-input" id="s-type"><option value="Classique">Classique (1 an repos)</option><option value="Sanitaire">Sanitaire FD (3 ans)</option></select></div>' +
    '<div class="si"><label>Replantation</label><select class="fi-input" id="s-mode"><option value="Classique">Classique</option><option value="Anticip\u00e9e">Anticip\u00e9e</option></select></div>' +
    '<div class="si"><label>VolCo (kg/ha)</label><input type="number" class="fi-input" id="s-volco" value="9000" step="500" min="0"></div>' +
    '<div class="si"><label>Rendement agro (kg/ha)</label><input type="number" class="fi-input" id="s-rend" value="15500" step="500" min="0"></div>' +
  '</div>' +
  '<button class="run-btn" onclick="runSim(\'' + idu + '\')">Recalculer la simulation</button>' +
  '<div id="sim-out" style="display:none">' +
    '<div class="sim-kpis" id="sim-kpis"></div>' +
    '<div class="chart-card">' +
      '<div class="chart-cap">' +
        '<span><i class="cc-line"></i>Stock RI (kg/ha)</span>' +
        '<span><i class="cc-plaf"></i>Plafond 10 000</span>' +
        '<span><i class="cc-bar"></i>Sortie r\u00e9serve</span>' +
      '</div>' +
      '<div class="chart-wrap"><canvas class="sim-cvs" id="sim-cvs" height="180"></canvas></div>' +
    '</div>' +
    '<div class="sim-tw"><table class="sim-t" id="sim-t"></table></div>' +
    '<div class="chart-card" id="eco-out" style="display:none"></div>' +
  '</div>';
}

function openSimModal(idu) {
  var f = PARCELLES_GEOJSON.features.find(function(f) { return f.properties.idu === idu; });
  if (!f) return;
  var p = f.properties;
  document.getElementById('sim-modal-sub').textContent = p.idu + ' \u00b7 ' + p.cepage + ' \u00b7 ' + p.lieu_dit + ' \u00b7 ' + p.num_civc;
  document.getElementById('sim-modal-body').innerHTML = simControlsHTML(idu);
  document.getElementById('sim-modal').style.display = 'flex';
  document.body.classList.add('modal-open');
  runSim(idu); // r\u00e9sultats imm\u00e9diats avec param\u00e8tres par d\u00e9faut
}
function closeSimModal() {
  document.getElementById('sim-modal').style.display = 'none';
  document.body.classList.remove('modal-open');
}
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeSimModal();
});

function cb(lbl, val, col, pond) {
  var w = Math.min(100, Math.max(0, val)).toFixed(0);
  return '<div class="cb-row"><div class="cb-lbl">' + lbl + ' <small style="opacity:.4">×' + pond + '</small></div>' +
    '<div class="cb-bg"><div class="cb-fill" style="width:' + w + '%;background:' + col + '"></div></div>' +
    '<div class="cb-val">' + w + '</div></div>';
}
function dgi(lbl, val, cls, fs) {
  return '<div><div class="dg-l">' + lbl + '</div><div class="dg-v ' + (cls || '') + '" style="' + (fs ? 'font-size:' + fs : '') + '">' + val + '</div></div>';
}

function openPanel(feat) {
  var p = feat.properties, r = calcI(feat), I = r.I, sc = r.sc;
  var col = iColor(I), age = ANNEE - p.anneeplant;
  var ri = getRI(p.num_civc), isTech = S.mode === 'tech';
  var hasFD = communeFD();
  var dist = getFdDist(p);

  document.getElementById('ph-title').textContent = p.idu;
  document.getElementById('ph-sub').textContent = p.cepage + ' — ' + p.lieu_dit + ' — ' + p.num_civc;

  var fdBlock = hasFD && !isTech ? (
    '<div class="fd-panel-block">' +
      '<div class="fd-panel-title">Commune en zone FD — distance au foyer</div>' +
      '<div class="fd-panel-desc">' +
        'La commune ' + COMMUNES[S.commune].nom + ' présente un foyer FD déclaré. ' +
        'Renseignez la distance entre cette parcelle et la parcelle contaminée la plus proche.' +
      '</div>' +
      '<div class="fd-dist-row">' +
        '<label>Distance au foyer</label>' +
        '<input type="number" class="fd-dist-input" id="fd-dist-inp" min="0" step="10" ' +
          'placeholder="ex. 250" value="' + (dist !== null ? dist : '') + '"' +
          ' onchange="saveFdDist(\'' + p.idu + '\',this.value)">' +
        '<span class="fd-dist-unit">mètres</span>' +
      '</div>' +
      (dist !== null ? '<div class="fd-score-note">Score FD : <b class="mono">' + sc.fd.toFixed(0) + '/100</b> — intégré à l\'indice viroses</div>' : '') +
    '</div>'
  ) : (hasFD && isTech && dist !== null ?
    '<div class="fd-tech-note">Distance au foyer FD : <b>' + dist + ' m</b></div>' : '');

  var saisie = isTech ? '' :
    '<div class="ps-sec vign-only">' +
      '<div class="ps-t">Saisie terrain</div>' +
      fdBlock +
      '<div class="fg">' +
        '<div class="fi"><label>Taux manquants (%)</label><input type="number" class="fi-input" min="0" max="100" value="' + pv(p, 'taux_manquant') + '" onchange="terr(\'' + p.idu + '\',\'taux_manquant\',this.value)"></div>' +
        '<div class="fi"><label>Productivité (kg/ha)</label><input type="number" class="fi-input" min="0" max="25000" step="100" value="' + pv(p, 'productivite_moyenne') + '" onchange="terr(\'' + p.idu + '\',\'productivite_moyenne\',this.value)"></div>' +
        '<div class="fi"><label>Enroulement (0–3)</label><select class="fi-input" onchange="terr(\'' + p.idu + '\',\'enroulement\',this.value)">' + '0,1,2,3'.split(',').map(function(v) { return '<option value="' + v + '"' + (pv(p, 'enroulement') == v ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select></div>' +
        '<div class="fi"><label>Court-noué (0–3)</label><select class="fi-input" onchange="terr(\'' + p.idu + '\',\'court_noue\',this.value)">' + '0,1,2,3'.split(',').map(function(v) { return '<option value="' + v + '"' + (pv(p, 'court_noue') == v ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select></div>' +
        '<div class="fi"><label>Réserve exploit. (kg/ha)</label><input type="number" class="fi-input" min="0" max="10000" step="100" value="' + ri + '" onchange="terrRI(\'' + p.num_civc + '\',this.value)"></div>' +
      '</div>' +
      '<button class="save-btn" onclick="toast(\'Données terrain enregistrées\')">Enregistrer la saisie</button>' +
    '</div>';

  var simCta = isTech ? '' :
    '<div class="ps-sec vign-only">' +
      '<div class="detail-actions">' +
        '<button class="sim-cta" onclick="openSimModal(\'' + p.idu + '\')">' +
          '<span class="sim-cta-bars"><i></i><i></i><i></i><i></i></span>' +
          '<span class="sim-cta-tx"><b>Simuler la réserve individuelle</b><small>Projection du stock RI sur 10 ans — arrachage &amp; replantation</small></span>' +
          '<span class="sim-cta-go">Ouvrir →</span>' +
        '</button>' +
        '<button class="plant-cta" onclick="openPlantModal(\'' + p.idu + '\')">' +
          '<span class="plant-cta-rows"><i></i><i></i><i></i></span>' +
          '<span class="sim-cta-tx"><b>Préparer la plantation</b><small>Matériel végétal, palissage, aménagements &amp; couvert au repos</small></span>' +
          '<span class="plant-cta-go">Concevoir →</span>' +
        '</button>' +
      '</div>' +
    '</div>';

  var virosesLbl = hasFD ? 'Viroses + FD' : 'Viroses';
  var sumPond = Object.values(S.pond).reduce(function(a, b) { return a + b; }, 0);

  document.getElementById('pb').innerHTML =
    '<div class="ps-sec">' +
      '<div class="ps-t">Indice d\'arrachage</div>' +
      '<div class="idx-head">' +
        '<div class="idx-num" style="color:' + col + '">' + I.toFixed(0) + '<small>/100</small></div>' +
        '<div class="idx-meta">' +
          '<div class="idx-lbl" style="color:' + col + '">' + iLabel(I) + '</div>' +
          '<div class="idx-hint">Pondération active · Σ=' + sumPond + (hasFD ? ' · <span class="fd-flag">FD intégrée aux viroses</span>' : '') + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="idx-gauge"><div class="idx-marker" style="left:calc(' + Math.min(100, Math.max(0, I)) + '% - 1.5px)"></div></div>' +
      '<div class="idx-scale"><span>0</span><span>30</span><span>50</span><span>70</span><span>100</span></div>' +
      '<div class="cb-rows">' +
        cb('Proportion surf.', sc.prop, '#1C2C49', S.pond.pp) +
        cb('Taux manquants', sc.manq, '#BD6A2C', S.pond.pm) +
        cb(virosesLbl, hasFD ? Math.min(100, (sc.viro + sc.fd) / 2) : sc.viro, '#A6322B', S.pond.pv) +
        cb('Productivité', sc.prod, '#9A7B3D', S.pond.ppr) +
        cb('Déficit réserve', sc.defr, '#5E7A41', S.pond.pd) +
      '</div>' +
    '</div>' +
    simCta +
    '<div class="ps-sec">' +
      '<div class="ps-t">Données parcellaires</div>' +
      '<div class="dg">' +
        dgi('Cépage', p.cepage) +
        dgi('Âge', age + ' ans (' + p.anneeplant + ')', age >= 35 ? 'danger' : age >= 25 ? 'warn' : '') +
        dgi('Surface', pv(p, 'surface_ss_parcelle') + ' ha') +
        dgi('Proportion surf.', ((pv(p, 'surface_ss_parcelle') / getSurf(p.num_civc)) * 100).toFixed(1) + ' %') +
        dgi('Productivité', pv(p, 'productivite_moyenne').toLocaleString('fr') + ' kg/ha', pv(p, 'productivite_moyenne') < 8000 ? 'danger' : pv(p, 'productivite_moyenne') < 11000 ? 'warn' : '') +
        dgi('Manquants', pv(p, 'taux_manquant') + ' %', pv(p, 'taux_manquant') > 20 ? 'danger' : pv(p, 'taux_manquant') > 10 ? 'warn' : '') +
        dgi('Enroulement', pv(p, 'enroulement') + ' / 3', pv(p, 'enroulement') >= 2 ? 'danger' : pv(p, 'enroulement') >= 1 ? 'warn' : '') +
        dgi('Court-noué', pv(p, 'court_noue') + ' / 3', pv(p, 'court_noue') >= 2 ? 'danger' : pv(p, 'court_noue') >= 1 ? 'warn' : '') +
        (hasFD && dist !== null ? dgi('Dist. foyer FD', dist + ' m', dist < 200 ? 'danger' : dist < 600 ? 'warn' : '') : '') +
      '</div>' +
    '</div>' +
    '<div class="ps-sec">' +
      '<div class="ps-t">Exploitation</div>' +
      '<div class="dg">' +
        dgi('N° CIVC', p.num_civc) +
        dgi('Réserve RI', ri.toLocaleString('fr') + ' kg/ha', ri < 5000 ? 'danger' : ri < 7500 ? 'warn' : 'ok') +
        dgi('Surface totale', getSurf(p.num_civc) + ' ha') +
        dgi('Taux remplissage', Math.round(ri / 100) + ' %') +
      '</div>' +
    '</div>' +
    saisie;

  document.getElementById('panel-list').style.display = 'none';
  var det = document.getElementById('panel-detail');
  det.style.display = 'flex';
  det.style.flexDirection = 'column';
  document.getElementById('ph-back').style.display = '';
}

function closePanel() {
  document.getElementById('panel-detail').style.display = 'none';
  document.getElementById('panel-list').style.display = '';
  document.getElementById('ph-back').style.display = 'none';
  var com = S.commune && COMMUNES[S.commune];
  document.getElementById('ph-title').textContent = com ? com.nom : '—';
  document.getElementById('ph-sub').textContent = com ? com.appellation : 'Sélectionnez une commune';
  S.selIdu = null;
  refreshStyles();
}

function saveFdDist(idu, val) {
  ovSet(idu, 'fd_dist', val === '' ? null : +val);
  refreshStyles();
  updateScoreDisplay();
}

function updateScoreDisplay() {
  if (!S.selIdu) return;
  var feat = PARCELLES_GEOJSON.features.find(function(f) { return f.properties.idu === S.selIdu; });
  if (!feat) return;
  var r = calcI(feat), I = r.I, sc = r.sc, col = iColor(I);
  var num = document.querySelector('.idx-num');
  if (num) { num.style.color = col; num.innerHTML = I.toFixed(0) + '<small>/100</small>'; }
  var lbl = document.querySelector('.idx-lbl');
  if (lbl) { lbl.textContent = iLabel(I); lbl.style.color = col; }
  var mk = document.querySelector('.idx-marker');
  if (mk) { mk.style.left = 'calc(' + Math.min(100, Math.max(0, I)) + '% - 1.5px)'; }
  var fills = document.querySelectorAll('.cb-fill');
  var hasFD = communeFD();
  var vals = [sc.prop, sc.manq, hasFD ? Math.min(100, (sc.viro + sc.fd) / 2) : sc.viro, sc.prod, sc.defr];
  fills.forEach(function(f, i) { if (vals[i] !== undefined) f.style.width = Math.min(100, vals[i]).toFixed(0) + '%'; });
}
