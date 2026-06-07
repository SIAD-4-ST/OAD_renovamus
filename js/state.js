var PARCELLES_GEOJSON = null;
var EXPLOITATIONS = [];

var S = {
  mode: 'vign', commune: '', civc: '', selIdu: null, sort: 'I',
  pond: { pp: 1, pm: 2, pv: 3, ppr: 2, pd: 2 },
  ov: {},
};

function lsLoad() {
  try { var d = localStorage.getItem(LS_KEY); if (d) S.ov = JSON.parse(d); } catch(e) {}
}
function lsSave() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(S.ov)); } catch(e) {}
}
function ovGet(id, k) { return S.ov[id + '|' + k]; }
function ovSet(id, k, v) { S.ov[id + '|' + k] = v; lsSave(); }
