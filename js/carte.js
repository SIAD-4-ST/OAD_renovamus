var map = L.map('map', { center: [47.5, 3.5], zoom: 7, zoomControl: true });

L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: '© Esri, Maxar', maxZoom: 19
}).addTo(map);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
  attribution: '© CARTO', subdomains: 'abcd', maxZoom: 20, opacity: 0.9
}).addTo(map);

var geoLayer = null;

function featStyle(feat) {
  var r = calcI(feat), I = r.I;
  var dist = getFdDist(feat.properties);
  var hasDist = communeFD() && dist !== null && dist >= 0;
  var sel = feat.properties.idu === S.selIdu;
  return {
    fillColor: iColor(I), fillOpacity: sel ? 0.90 : 0.75,
    color: hasDist ? '#C9A84C' : (sel ? '#ffffff' : '#222'),
    weight: hasDist ? 3 : (sel ? 3 : 1.5),
    dashArray: hasDist ? '5 3' : null,
  };
}

function buildMap() {
  var feats = PARCELLES_GEOJSON.features.filter(function(f) {
    return f.properties.commune === S.commune &&
           (!S.civc || f.properties.num_civc === S.civc);
  });
  if (geoLayer) map.removeLayer(geoLayer);

  if (!S.commune) {
    document.getElementById('map-n').textContent = '0';
    document.getElementById('ph-title').textContent = '—';
    document.getElementById('ph-sub').textContent = 'Sélectionnez une commune';
    buildList([]);
    return;
  }

  geoLayer = L.geoJSON({ type: 'FeatureCollection', features: feats }, {
    style: featStyle,
    onEachFeature: function(feat, layer) {
      layer.bindTooltip(makeTip(feat), { sticky: true, opacity: .97 });
      layer.on('click', function() { selectFeat(feat); });
    }
  }).addTo(map);

  if (feats.length) { try { map.fitBounds(geoLayer.getBounds().pad(0.15)); } catch(e) {} }

  document.getElementById('map-n').textContent = feats.length;
  document.getElementById('map-commune').textContent = COMMUNES[S.commune]
    ? COMMUNES[S.commune].nom + ' (' + COMMUNES[S.commune].dept + ')' : '—';
  if (!S.selIdu) {
    var com = COMMUNES[S.commune];
    document.getElementById('ph-title').textContent = com ? com.nom : '—';
    document.getElementById('ph-sub').textContent = com ? com.appellation : '—';
  }
  buildList(feats);
}

function makeTip(feat) {
  var p = feat.properties, r = calcI(feat), I = r.I;
  var dist = getFdDist(p);
  var distTxt = '';
  if (communeFD()) {
    distTxt = dist !== null
      ? '<br>📍 Dist. foyer FD : <b>' + dist + ' m</b>'
      : '<br><span style="color:#E17055">⚠ Distance FD non renseignée</span>';
  }
  return '<div style="font:12px \'DM Sans\',sans-serif;line-height:1.5;background:rgba(255,255,255,.97);color:#1a1a2e;padding:7px 10px;border-radius:6px;border:1px solid rgba(201,168,76,.5);box-shadow:0 2px 8px rgba(0,0,0,.2)">' +
    '<b style="color:#C9A84C">' + p.idu + '</b><br>' +
    p.lieu_dit + ' · ' + p.cepage + ' · ' + (ANNEE - p.anneeplant) + ' ans<br>' +
    'Indice : <b style="color:' + iColor(I) + '">' + I + '</b> — ' + iLabel(I) +
    distTxt + '</div>';
}

function refreshStyles() {
  if (!geoLayer) return;
  geoLayer.eachLayer(function(l) { l.setStyle(featStyle(l.feature)); });
  var feats = PARCELLES_GEOJSON.features.filter(function(f) {
    return f.properties.commune === S.commune && (!S.civc || f.properties.num_civc === S.civc);
  });
  buildList(feats);
}
