var map = L.map('map', { center: [47.5, 3.5], zoom: 7, zoomControl: true });

// Fond clair (Plan) par défaut + fond satellite optionnel
var baseLight = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
  attribution: '© OpenStreetMap, © CARTO', subdomains: 'abcd', maxZoom: 20
});
var baseSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: '© Esri, Maxar', maxZoom: 19
});
var satLabels = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
  attribution: '© CARTO', subdomains: 'abcd', maxZoom: 20, opacity: 0.9
});
baseLight.addTo(map);

function setBase(which) {
  map.removeLayer(baseLight); map.removeLayer(baseSat); map.removeLayer(satLabels);
  if (which === 'sat') { baseSat.addTo(map); satLabels.addTo(map); }
  else { baseLight.addTo(map); }
  document.getElementById('ml-plan').classList.toggle('active', which !== 'sat');
  document.getElementById('ml-sat').classList.toggle('active', which === 'sat');
  if (geoLayer) geoLayer.bringToFront();
}

var geoLayer = null;
var IS_SAT = false;

function featStyle(feat) {
  var r = calcI(feat), I = r.I;
  var dist = getFdDist(feat.properties);
  var hasDist = communeFD() && dist !== null && dist >= 0;
  var sel = feat.properties.idu === S.selIdu;
  var stroke = map.hasLayer(baseSat) ? '#ffffff' : '#3B382F';
  return {
    fillColor: iColor(I), fillOpacity: sel ? 0.88 : 0.66,
    color: hasDist ? '#9A7B3D' : (sel ? '#1A1916' : stroke),
    weight: hasDist ? 3 : (sel ? 2.5 : 1),
    opacity: map.hasLayer(baseSat) ? 0.9 : 0.55,
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
      layer.bindTooltip(makeTip(feat), { sticky: true, opacity: 1, className: 'oad-tip' });
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
      ? '<div style="margin-top:6px;padding-top:6px;border-top:1px solid #E4DECF;color:#9A7B3D;font-size:10.5px">Dist. foyer FD : <b style="font-family:\'IBM Plex Mono\',monospace">' + dist + ' m</b></div>'
      : '<div style="margin-top:6px;padding-top:6px;border-top:1px solid #E4DECF;color:#BD6A2C;font-size:10.5px">Distance FD non renseignée</div>';
  }
  return '<div style="font-family:Archivo,sans-serif;font-size:12px;line-height:1.55;padding:9px 12px;min-width:160px">' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-weight:600;font-size:12px;color:#1A1916;letter-spacing:-.01em">' + p.idu + '</div>' +
    '<div style="color:#746F62;font-size:10.5px;margin:3px 0 7px">' + p.lieu_dit + ' · ' + p.cepage + ' · ' + (ANNEE - p.anneeplant) + ' ans</div>' +
    '<div style="display:flex;align-items:center;gap:7px"><span style="width:10px;height:10px;border-radius:3px;background:' + iColor(I) + '"></span>' +
    '<b style="font-family:\'IBM Plex Mono\',monospace;color:' + iColor(I) + ';font-size:13px">' + I + '</b>' +
    '<span style="color:#3B382F;font-weight:600">' + iLabel(I) + '</span></div>' +
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
