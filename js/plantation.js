/* ════════════════════════════════════════════════════════════
   PLANTATION — Configurateur de plantation parcellaire
   Le vigneron conçoit sa future plantation : matériel végétal,
   densité, palissage, aménagements, couverture au repos.
   Synthèse (métré + budget indicatif) recalculée en direct.
   ════════════════════════════════════════════════════════════ */

var PLANT_CTX = { idu: null, surf: 1 };

var PLANT_OPT = {
  cepage:    ['Chardonnay', 'Pinot Noir', 'Pinot Meunier', 'Pinot Blanc', 'Arbane', 'Petit Meslier'],
  pg:        ['41 B', 'SO4', '3309 C', '161-49 C', 'Fercal', 'Riparia Gloire'],
  planttype: ['Greffé-soudé · racines nues', 'Plant en pot (motte)'],
  clone:     ['Clone certifié', 'Sélection massale', 'Mélange clonal'],
  palissage: ['Simple relevable', 'Double relevable', 'Lyre / U'],
  piquet:    ['Acacia (bois)', 'Métal galvanisé', 'Composite recyclé'],
  fils:      ['1 paire releveuse', '2 paires releveuses'],
  orient:    ['Nord–Sud', 'Est–Ouest', 'Selon la pente'],
  enherb:    ['Enherbement total', '1 rang sur 2', 'Travail du sol'],
  couvert:   ['Engrais vert (légumineuses)', 'Graminées', 'Crucifères (moutarde)', 'Mélange multi-espèces', 'Jachère nue']
};

function _pv(id) { var e = document.getElementById(id); return e ? e.value : ''; }
function _set(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; }
function _eur(v) { return Math.round(v / 100) * 100 < 1000 ? Math.round(v) + ' €' : (Math.round(v / 100) * 100).toLocaleString('fr') + ' €'; }
function _eurRange(v) {
  var lo = Math.round(v * 0.88 / 100) * 100, hi = Math.round(v * 1.12 / 100) * 100;
  return lo.toLocaleString('fr') + ' – ' + hi.toLocaleString('fr') + ' €';
}

function psel(id, label, opts, def) {
  return '<div class="fi"><label>' + label + '</label><select class="fi-input" id="' + id + '" onchange="recalcPlant()">' +
    opts.map(function(o) { return '<option' + (o === def ? ' selected' : '') + '>' + o + '</option>'; }).join('') +
    '</select></div>';
}
function prange(id, label, min, max, step, def, valId) {
  return '<div class="pcfg"><div class="pcfg-lbl"><span>' + label + '</span><b id="' + valId + '">—</b></div>' +
    '<input type="range" class="pl-range" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + def + '" oninput="recalcPlant()"></div>';
}
function pgroup(t, inner) { return '<div class="pcfg-group"><div class="pcfg-h">' + t + '</div>' + inner + '</div>'; }
function srow(label, id) { return '<div class="synth-row"><span>' + label + '</span><b id="' + id + '">—</b></div>'; }

function plantModalBodyHTML(p) {
  var config =
    '<div class="plant-config">' +
      pgroup('Matériel végétal',
        '<div class="fg">' +
          psel('pl-cepage', 'Cépage', PLANT_OPT.cepage, p.cepage) +
          psel('pl-pg', 'Porte-greffe', PLANT_OPT.pg, '41 B') +
          psel('pl-planttype', 'Type de plant', PLANT_OPT.planttype, PLANT_OPT.planttype[0]) +
          psel('pl-clone', 'Origine', PLANT_OPT.clone, PLANT_OPT.clone[0]) +
        '</div>') +
      pgroup('Densité &amp; écartement',
        prange('pl-rang', 'Écartement entre rangs', 1.0, 1.5, 0.05, 1.5, 'rang-val') +
        prange('pl-pied', 'Écartement entre pieds', 0.9, 1.3, 0.05, 0.95, 'pied-val') +
        '<div class="pcfg-hint">Réglementation AOC : rang + pied ≤ 2,50 m, écartement entre rangs ≤ 1,50 m.</div>') +
      pgroup('Palissage',
        '<div class="fg">' +
          psel('pl-palissage', 'Type', PLANT_OPT.palissage, PLANT_OPT.palissage[0]) +
          psel('pl-piquet', 'Piquets', PLANT_OPT.piquet, PLANT_OPT.piquet[1]) +
          psel('pl-fils', 'Fils releveurs', PLANT_OPT.fils, PLANT_OPT.fils[1]) +
        '</div>' +
        prange('pl-hauteur', 'Hauteur de palissage', 1.0, 1.4, 0.05, 1.2, 'haut-val')) +
      pgroup('Aménagements',
        '<div class="fg">' +
          psel('pl-orient', 'Orientation des rangs', PLANT_OPT.orient, PLANT_OPT.orient[0]) +
          psel('pl-enherb', 'Inter-rang', PLANT_OPT.enherb, PLANT_OPT.enherb[1]) +
        '</div>' +
        prange('pl-tourniere', 'Largeur de tournière', 4, 8, 0.5, 6, 'tour-val')) +
      pgroup('Couverture au repos',
        psel('pl-couvert', 'Type de couvert', PLANT_OPT.couvert, PLANT_OPT.couvert[0]) +
        prange('pl-duree', 'Durée du repos avant plantation', 1, 5, 1, 2, 'duree-val')) +
    '</div>';

  var synth =
    '<aside class="plant-synth">' +
      '<div class="synth-h">Synthèse plantation</div>' +
      '<div class="plant-schema" id="pl-schema"></div>' +
      '<div class="synth-grp">' +
        srow('Densité', 'sy-dens') +
        srow('Pieds à planter', 'sy-pieds') +
        srow('Plants à commander', 'sy-cmd') +
        srow('Longueur de rang', 'sy-ml') +
        srow('Nombre de rangs', 'sy-rangs') +
        srow('Piquets', 'sy-piquets') +
        srow('Fil releveur', 'sy-fil') +
        srow('Couvert au repos', 'sy-couvert') +
      '</div>' +
      '<div class="synth-h" style="margin-top:15px">Budget indicatif</div>' +
      '<div class="synth-grp">' +
        srow('Matériel végétal', 'sy-bud-veg') +
        srow('Palissage', 'sy-bud-pal') +
        srow('Couvert (repos)', 'sy-bud-couv') +
        srow('Prépa. &amp; plantation', 'sy-bud-prep') +
      '</div>' +
      '<div class="synth-total"><span>Total estimé</span><b id="sy-bud-total">—</b></div>' +
      '<div class="synth-note">Estimation indicative, hors aides et main-d’œuvre interne. À affiner avec devis fournisseurs.</div>' +
      '<button class="save-btn" onclick="toast(\'Projet de plantation enregistré\')">Enregistrer ce projet</button>' +
    '</aside>';

  return '<div class="plant-layout">' + config + synth + '</div>';
}

function openPlantModal(idu) {
  var f = PARCELLES_GEOJSON.features.find(function(f) { return f.properties.idu === idu; });
  if (!f) return;
  var p = f.properties;
  PLANT_CTX.idu = idu;
  PLANT_CTX.surf = pv(p, 'surface_ss_parcelle');
  document.getElementById('plant-modal-sub').textContent =
    p.idu + ' · ' + PLANT_CTX.surf + ' ha · ' + p.lieu_dit + ' · ' + p.num_civc;
  document.getElementById('plant-modal-body').innerHTML = plantModalBodyHTML(p);
  document.getElementById('plant-modal').style.display = 'flex';
  document.body.classList.add('modal-open');
  recalcPlant();
}
function closePlantModal() {
  var m = document.getElementById('plant-modal');
  if (m) m.style.display = 'none';
  if (!document.getElementById('sim-modal') || document.getElementById('sim-modal').style.display === 'none')
    document.body.classList.remove('modal-open');
}

function updateSchema(rang, pied) {
  var el = document.getElementById('pl-schema');
  if (!el) return;
  var px = 30, py = 30 * (pied / rang);
  el.style.backgroundImage =
    'repeating-linear-gradient(90deg, rgba(28,44,73,.30) 0 1.5px, transparent 1.5px ' + px.toFixed(1) + 'px),' +
    'repeating-linear-gradient(0deg, rgba(154,123,61,.30) 0 1px, transparent 1px ' + py.toFixed(1) + 'px)';
}

function recalcPlant() {
  var surf = PLANT_CTX.surf;
  var rang = parseFloat(_pv('pl-rang')) || 1.5;
  var pied = parseFloat(_pv('pl-pied')) || 0.95;
  var haut = parseFloat(_pv('pl-hauteur')) || 1.2;
  var tour = parseFloat(_pv('pl-tourniere')) || 6;
  var duree = parseInt(_pv('pl-duree')) || 2;

  _set('rang-val', rang.toFixed(2).replace('.', ',') + ' m');
  _set('pied-val', pied.toFixed(2).replace('.', ',') + ' m');
  _set('haut-val', haut.toFixed(2).replace('.', ',') + ' m');
  _set('tour-val', tour.toFixed(1).replace('.', ',') + ' m');
  _set('duree-val', duree + ' an' + (duree > 1 ? 's' : ''));

  var m2 = surf * 10000;
  var dens = Math.round(10000 / (rang * pied));
  var pieds = Math.round(dens * surf);
  var cmd = Math.ceil(pieds * 1.05);
  var ml = Math.round(m2 / rang);
  var cote = Math.sqrt(m2);
  var nbRangs = Math.max(1, Math.round(cote / rang));
  var paires = _pv('pl-fils').indexOf('2') > -1 ? 2 : 1;
  var piquets = Math.round(ml / 5) + nbRangs;
  var fil = Math.round(ml * (2 * paires + 1));

  var pt = _pv('pl-planttype');
  var prixPlant = pt.indexOf('pot') > -1 ? 2.6 : 1.8;
  var budVeg = cmd * prixPlant;

  var piq = _pv('pl-piquet');
  var basePal = piq.indexOf('Métal') > -1 ? 3.0 : piq.indexOf('Composite') > -1 ? 3.6 : 2.4;
  var pal = _pv('pl-palissage');
  var palFactor = pal.indexOf('Lyre') > -1 ? 1.4 : pal.indexOf('Double') > -1 ? 1.2 : 1.0;
  var budPal = ml * (basePal + (paires === 2 ? 0.5 : 0)) * palFactor;

  var couv = _pv('pl-couvert');
  var cPrice = couv.indexOf('légum') > -1 ? 260 : couv.indexOf('Gramin') > -1 ? 190 :
               couv.indexOf('Crucif') > -1 ? 210 : couv.indexOf('Mélange') > -1 ? 300 : 40;
  var budCouv = surf * cPrice * duree;
  var budPrep = surf * 3800;
  var total = budVeg + budPal + budCouv + budPrep;

  _set('sy-dens', dens.toLocaleString('fr') + ' pieds/ha');
  _set('sy-pieds', pieds.toLocaleString('fr') + ' pieds');
  _set('sy-cmd', cmd.toLocaleString('fr') + ' plants');
  _set('sy-ml', ml.toLocaleString('fr') + ' ml');
  _set('sy-rangs', '≈ ' + nbRangs);
  _set('sy-piquets', piquets.toLocaleString('fr'));
  _set('sy-fil', fil.toLocaleString('fr') + ' m');
  _set('sy-couvert', couv.split(' ')[0] + ' · ' + duree + ' an' + (duree > 1 ? 's' : ''));

  _set('sy-bud-veg', _eur(budVeg));
  _set('sy-bud-pal', _eur(budPal));
  _set('sy-bud-couv', _eur(budCouv));
  _set('sy-bud-prep', _eur(budPrep));
  _set('sy-bud-total', _eurRange(total));

  updateSchema(rang, pied);
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closePlantModal();
});
