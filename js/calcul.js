function getEx(civc) {
  return EXPLOITATIONS.find(function(e) { return e.num_civc === civc; });
}
function getRI(civc) {
  var ov = ovGet(civc, 'ri');
  return ov !== undefined ? +ov : (getEx(civc) || { niveau_reserve: 8000 }).niveau_reserve;
}
function getSurf(civc) {
  return (getEx(civc) || { surface_totale: 1 }).surface_totale;
}
function pv(p, k) {
  var ov = ovGet(p.idu, k);
  return ov !== undefined ? +ov : +p[k];
}
function getFdDist(p) {
  var ov = ovGet(p.idu, 'fd_dist');
  return ov !== undefined ? +ov : (p.distance_foyer_fd_m !== null ? p.distance_foyer_fd_m : null);
}
function communeFD() {
  return S.commune && COMMUNES[S.commune] && COMMUNES[S.commune].fd;
}

function calcI(feat) {
  var p = feat.properties;
  var pp = S.pond.pp, pm = S.pond.pm, pvi = S.pond.pv, ppr = S.pond.ppr, pd = S.pond.pd;
  var tot = pp + pm + pvi + ppr + pd;
  if (!tot) return { I: 0, sc: { prop: 0, manq: 0, viro: 0, prod: 0, defr: 0, fd: 0 } };

  var surf = pv(p, 'surface_ss_parcelle'), prod = pv(p, 'productivite_moyenne');
  var manq = pv(p, 'taux_manquant'), enr = pv(p, 'enroulement'), cn = pv(p, 'court_noue');
  var ri = getRI(p.num_civc), stot = getSurf(p.num_civc);

  var sc_prop = Math.min(100, surf / stot * 100);
  var sc_manq = Math.min(100, manq);
  var sc_viro = Math.min(100, (enr + cn) / 6 * 100);
  var sc_prod = Math.min(100, prod / 12000 * 100);
  var sc_defr = ri > 0 ? Math.min(100, Math.max(0, (10000 - ri) / ri * 100)) : 100;

  var sc_fd = 0;
  if (communeFD()) {
    var dist = getFdDist(p);
    if (dist !== null && dist >= 0) sc_fd = Math.min(100, Math.max(0, (1000 - dist) / 1000 * 100));
  }

  var viroses_eff = communeFD() ? Math.min(100, (sc_viro + sc_fd) / 2) : sc_viro;

  var I = (pp * sc_prop + pm * sc_manq + pvi * viroses_eff + ppr * sc_prod + pd * sc_defr) / tot;
  return { I: +I.toFixed(1), sc: { prop: sc_prop, manq: sc_manq, viro: sc_viro, prod: sc_prod, defr: sc_defr, fd: sc_fd } };
}

function iColor(I) {
  if (I >= 70) return '#D63031';
  if (I >= 50) return '#E17055';
  if (I >= 30) return '#F9CA24';
  return '#00B894';
}
function iLabel(I) {
  if (I >= 70) return 'Prioritaire';
  if (I >= 50) return 'Élevé';
  if (I >= 30) return 'Modéré';
  return 'Faible';
}
