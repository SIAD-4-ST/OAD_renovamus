function selectCommune(key) {
  S.commune = key; S.civc = ''; S.selIdu = null;
  closePanel();
  document.getElementById('sel-civc').value = '';
  document.getElementById('kpi-ex').style.display = 'none';

  var sel = document.getElementById('sel-civc');
  sel.innerHTML = '<option value="">— Toutes —</option>';
  EXPLOITATIONS.filter(function(e) { return e.commune === key; }).forEach(function(e) {
    var o = document.createElement('option');
    o.value = e.num_civc; o.textContent = e.num_civc + ' — ' + e.nom;
    sel.appendChild(o);
  });

  var info = document.getElementById('commune-info');
  if (key) {
    info.style.display = '';
    document.getElementById('commune-name-label').textContent = (COMMUNES[key] ? COMMUNES[key].nom : '—');
    document.getElementById('commune-appel').textContent = (COMMUNES[key] ? COMMUNES[key].appellation + ' · Dept. ' + COMMUNES[key].dept : '—');
    var feats = PARCELLES_GEOJSON.features.filter(function(f) { return f.properties.commune === key; });
    document.getElementById('kpi-nb').textContent = feats.length;
    var surfTot = feats.reduce(function(s, f) { return s + pv(f.properties, 'surface_ss_parcelle'); }, 0);
    document.getElementById('kpi-surf-c').textContent = surfTot.toFixed(2);
    var ageMoy = feats.length ? feats.reduce(function(s, f) { return s + (ANNEE - f.properties.anneeplant); }, 0) / feats.length : 0;
    document.getElementById('kpi-age').textContent = feats.length ? Math.round(ageMoy) + ' ans' : '—';
    var com = COMMUNES[key];
    map.setView(com.center, com.zoom);
  } else {
    info.style.display = 'none';
    map.setView([47.5, 3.5], 7);
  }

  buildMap();
}

function filterCIVC(civc) {
  S.civc = civc; S.selIdu = null; closePanel();
  var ex = getEx(civc), ks = document.getElementById('kpi-ex');
  if (ex) {
    ks.style.display = '';
    document.getElementById('kpi-surf').textContent = ex.surface_totale;
    document.getElementById('kpi-ri').textContent = getRI(civc).toLocaleString('fr');
  } else {
    ks.style.display = 'none';
  }
  buildMap();
}

function setMode(mode) {
  S.mode = mode;
  document.body.classList.toggle('tech-mode', mode === 'tech');
  document.getElementById('btn-vign').classList.toggle('active', mode === 'vign');
  document.getElementById('btn-tech').classList.toggle('active', mode === 'tech');
  buildMap();
}

var PMAP = [
  { id: 'pp',  sk: 'pp',  bid: 'pb-pp'  },
  { id: 'pm',  sk: 'pm',  bid: 'pb-pm'  },
  { id: 'pv',  sk: 'pv',  bid: 'pb-pv'  },
  { id: 'ppr', sk: 'ppr', bid: 'pb-ppr' },
  { id: 'pd',  sk: 'pd',  bid: 'pb-pd'  },
];
function initPond() {
  PMAP.forEach(function(m) {
    document.getElementById(m.id).addEventListener('change', function() {
      S.pond[m.sk] = Math.max(0, parseInt(this.value) || 0);
      updateBars(); refreshStyles(); updateScoreDisplay();
    });
  });
  updateBars();
}
function updateBars() {
  var vals = Object.values(S.pond), tot = vals.reduce(function(a, b) { return a + b; }, 0), mx = Math.max.apply(null, vals.concat([1]));
  document.getElementById('ptotal').textContent = tot;
  PMAP.forEach(function(m) { var b = document.getElementById(m.bid); if (b) b.style.width = ((S.pond[m.sk] / mx) * 100) + '%'; });
}

function terr(idu, k, v) { ovSet(idu, k, v); refreshStyles(); updateScoreDisplay(); }
function terrRI(civc, v) { ovSet(civc, 'ri', v); refreshStyles(); updateScoreDisplay(); }

function toast(msg) {
  var el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  setTimeout(function() { el.classList.remove('show'); }, 2800);
}

function init() {
  lsLoad();
  initPond();
  buildMap();
  console.log('OAD Arrachage v3 chargé —', PARCELLES_GEOJSON.features.length, 'parcelles');
}

PARCELLES_GEOJSON = DATA_PARCELLES;
EXPLOITATIONS = DATA_EXPLOITATIONS;
init();
