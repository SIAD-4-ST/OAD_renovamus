function buildList(feats) {
  var sorted = feats.slice().sort(function(a, b) { return calcI(b).I - calcI(a).I; });
  document.getElementById('list-count').textContent = sorted.length + (sorted.length > 1 ? ' parcelles' : ' parcelle');
  var el = document.getElementById('pl');
  if (!sorted.length) {
    el.innerHTML = '<div class="empty-st"><div class="ei">🗺️</div>' +
      (S.commune ? 'Aucune parcelle.' : 'Sélectionnez<br>une commune.') + '</div>';
    return;
  }
  el.innerHTML = sorted.map(function(f) {
    var p = f.properties, r = calcI(f), I = r.I, col = iColor(I);
    var dist = getFdDist(p);
    var fdTag = communeFD() ? (dist !== null ? ' 📍' : ' ⚠️') : '';
    return '<div class="pl-item' + (p.idu === S.selIdu ? ' active' : '') + '" onclick="selectById(\'' + p.idu + '\')">' +
      '<div class="pl-badge" style="background:' + col + '22;color:' + col + ';border:1px solid ' + col + '55">' + I.toFixed(0) + '</div>' +
      '<div class="pl-info">' +
        '<div class="pl-idu">' + p.idu + fdTag + '</div>' +
        '<div class="pl-meta">' + p.cepage + ' · ' + (ANNEE - p.anneeplant) + ' ans · ' + pv(p, 'surface_ss_parcelle') + ' ha · ' + p.lieu_dit + '</div>' +
      '</div>' +
      (S.mode === 'vign' ? '<button class="pl-sim" onclick="event.stopPropagation();selectById(\'' + p.idu + '\');goSim()">SIM</button>' : '') +
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
function goSim() {
  setTimeout(function() {
    var el = document.getElementById('sim-sec');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }, 200);
}

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
      '<div class="fd-panel-title">⚠ Commune en zone FD — Distance au foyer</div>' +
      '<div style="font-size:10px;color:rgba(237,232,224,.5);margin-bottom:6px">' +
        'La commune ' + COMMUNES[S.commune].nom + ' présente un foyer FD déclaré. ' +
        'Renseignez la distance entre cette parcelle et la parcelle contaminée la plus proche.' +
      '</div>' +
      '<div class="fd-dist-row">' +
        '<label>Distance foyer FD :</label>' +
        '<input type="number" class="fd-dist-input" id="fd-dist-inp" min="0" step="10" ' +
          'placeholder="Ex: 250" value="' + (dist !== null ? dist : '') + '"' +
          ' onchange="saveFdDist(\'' + p.idu + '\',this.value)">' +
        '<span class="fd-dist-unit">mètres</span>' +
      '</div>' +
      (dist !== null ? '<div style="font-size:9px;margin-top:6px;color:rgba(237,232,224,.4)">Score FD : ' + sc.fd.toFixed(0) + '/100 (impact sur l\'indice viroses)</div>' : '') +
    '</div>'
  ) : (hasFD && isTech && dist !== null ?
    '<div style="font-size:10px;color:rgba(214,48,49,.8);background:rgba(214,48,49,.08);border:1px solid rgba(214,48,49,.2);border-radius:6px;padding:8px 10px;margin-bottom:8px">⚠ Dist. foyer FD : <b>' + dist + ' m</b></div>' : '');

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
      '<button class="save-btn" onclick="toast(\'✓ Données enregistrées\')">💾 Sauvegarder</button>' +
    '</div>';

  var sim = isTech ? '' :
    '<div class="ps-sec vign-only" id="sim-sec">' +
      '<div class="ps-t">Simulation — Réserve Individuelle</div>' +
      '<div class="sim-grid">' +
        '<div class="si"><label>Type arrachage</label><select class="fi-input" id="s-type"><option value="Classique">Classique (1 an repos)</option><option value="Sanitaire">Sanitaire FD (3 ans)</option></select></div>' +
        '<div class="si"><label>Replantation</label><select class="fi-input" id="s-mode"><option value="Classique">Classique</option><option value="Anticipée">Anticipée</option></select></div>' +
        '<div class="si"><label>VolCo (kg/ha)</label><input type="number" class="fi-input" id="s-volco" value="9000" step="500" min="0"></div>' +
        '<div class="si"><label>Rendement agro (kg/ha)</label><input type="number" class="fi-input" id="s-rend" value="15500" step="500" min="0"></div>' +
      '</div>' +
      '<button class="run-btn" onclick="runSim(\'' + p.idu + '\')">▶ Lancer la simulation</button>' +
      '<div id="sim-out" style="display:none">' +
        '<div class="sim-kpis" id="sim-kpis"></div>' +
        '<div class="chart-wrap"><canvas class="sim-cvs" id="sim-cvs" height="150"></canvas></div>' +
        '<div class="sim-tw"><table class="sim-t" id="sim-t"></table></div>' +
      '</div>' +
    '</div>';

  var virosesLbl = hasFD ? 'Viroses + FD' : 'Viroses';

  document.getElementById('pb').innerHTML =
    '<div class="ps-sec">' +
      '<div class="ps-t">Indice d\'arrachage [I]</div>' +
      '<div class="sc-wrap">' +
        '<div class="sc-ring" style="border-color:' + col + ';color:' + col + '"><span class="rn">' + I.toFixed(0) + '</span><span class="rd">/100</span></div>' +
        '<div><div class="sc-lbl" style="color:' + col + '">' + iLabel(I) + '</div>' +
        '<div class="sc-hint">Pondération active · Σ=' + Object.values(S.pond).reduce(function(a, b) { return a + b; }, 0) + (hasFD ? '<br>⚠ FD prise en compte dans viroses' : '') + '</div></div>' +
      '</div>' +
      '<div class="cb-rows">' +
        cb('Proportion surf.', sc.prop, '#4A90D9', S.pond.pp) +
        cb('Taux manquants', sc.manq, '#E17055', S.pond.pm) +
        cb(virosesLbl, hasFD ? Math.min(100, (sc.viro + sc.fd) / 2) : sc.viro, '#D63031', S.pond.pv) +
        cb('Productivité', sc.prod, '#A29BFE', S.pond.ppr) +
        cb('Déficit réserve', sc.defr, '#00CEC9', S.pond.pd) +
      '</div>' +
    '</div>' +
    '<div class="ps-sec">' +
      '<div class="ps-t">Données parcellaires</div>' +
      '<div class="dg">' +
        dgi('Lieu-dit', p.lieu_dit) +
        dgi('Cépage', p.cepage) +
        dgi('Âge', age + ' ans (' + p.anneeplant + ')', age >= 35 ? 'danger' : age >= 25 ? 'warn' : '') +
        dgi('Surface', pv(p, 'surface_ss_parcelle') + ' ha') +
        dgi('Mode', p.mode_explo, '', '11px') +
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
    saisie + sim;

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
  var ring = document.querySelector('.sc-ring');
  if (ring) { ring.style.borderColor = col; ring.style.color = col; ring.querySelector('.rn').textContent = I.toFixed(0); }
  var lbl = document.querySelector('.sc-lbl');
  if (lbl) { lbl.textContent = iLabel(I); lbl.style.color = col; }
  var fills = document.querySelectorAll('.cb-fill');
  var hasFD = communeFD();
  var vals = [sc.prop, sc.manq, hasFD ? Math.min(100, (sc.viro + sc.fd) / 2) : sc.viro, sc.prod, sc.defr];
  fills.forEach(function(f, i) { if (vals[i] !== undefined) f.style.width = Math.min(100, vals[i]).toFixed(0) + '%'; });
}
