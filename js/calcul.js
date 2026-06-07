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
  return calcIndice({
    valeurs: {
      surface:      pv(p, 'surface_ss_parcelle'),
      productivite: pv(p, 'productivite_moyenne'),
      manquants:    pv(p, 'taux_manquant'),
      enroulement:  pv(p, 'enroulement'),
      courtNoue:    pv(p, 'court_noue')
    },
    pond:             { pp: S.pond.pp, pm: S.pond.pm, pv: S.pond.pv, ppr: S.pond.ppr, pd: S.pond.pd },
    riExploitation:   getRI(p.num_civc),
    surfExploitation: getSurf(p.num_civc),
    communeEnFD:      !!communeFD(),
    fdDist:           getFdDist(p)
  });
}

function iColor(I) {
  if (I >= 70) return '#A6322B';
  if (I >= 50) return '#BD6A2C';
  if (I >= 30) return '#B08A22';
  return '#5E7A41';
}
function iLabel(I) {
  if (I >= 70) return 'Prioritaire';
  if (I >= 50) return 'Élevé';
  if (I >= 30) return 'Modéré';
  return 'Faible';
}
