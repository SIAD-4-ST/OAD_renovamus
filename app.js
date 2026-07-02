/* UI maquette v1.1 — géométrie, motif FD, faire-valoir, écran 4 remanié. */
(function () {
  const $ = id => document.getElementById(id);
  const EC = 3440;
  let vueFV = '1';

  const fmtE = v => (v < 0 ? '−' : '') + Math.abs(Math.round(v)).toLocaleString('fr-FR') + ' €';
  const fmtE0 = v => (v < 0 ? '−' : '') + Math.abs(Math.round(v / 100) * 100).toLocaleString('fr-FR') + ' €';
  const fmtKg = v => Math.round(v).toLocaleString('fr-FR');

  function geometrie() {
    const L = +$('geoL').value, W = +$('geoW').value, eR = +$('ecartRang').value, eP = +$('ecartPied').value;
    const densite = Math.round(10000 / (eR * eP));
    const nbRangs = Math.max(1, Math.floor(W / eR));
    const piedsRang = Math.max(1, Math.floor(L / eP));
    const surf = +(L * W / 10000).toFixed(4);
    const pieds = nbRangs * piedsRang;
    const vsl = eR >= 1.5;                       // conduite semi-large si rangs larges
    const aoc = { rang: eR <= 2.0, pied: eP >= 0.7 && eP <= 1.5, somme: (eR + eP) <= 3.0 };
    return { L, W, eR, eP, densite, nbRangs, piedsRang, surf, pieds, vsl, aoc };
  }

  function sequenceFn(nom) {
    const m = 12296.6;
    if (nom === 'creux34') return t => (t === 3 || t === 4) ? m - EC : m;
    if (nom === 'creux1') return t => (t === 1) ? m - EC : m;
    return null;
  }

  function lireEntrees() {
    const plafond = 10000, riPct = +$('riPct').value, g = geometrie();
    const sanitaire = $('motif').value === 'sanitaire';
    const penaliteVSL = +$('penaliteVSL').value / 100;
    const materielVoltis = $('materiel').value === 'voltis';
    const fDens = g.vsl ? (1 - penaliteVSL) : 1;
    const fMat = materielVoltis ? 1.0 : 1.0;        // Voltis ≤5 % : effet global négligeable (badge)
    return {
      geo: g, sanitaire,
      surfTot: +$('surfTot').value, surfParc: g.surf,
      ageMoy: +$('ageMoy').value, ageParc: +$('ageParc').value,
      repos: sanitaire ? 3 : 1, nbSortie: sanitaire ? 5 : 3, volSortieArr: 9000,
      plafond, volco: +$('volco').value, rendMean: 12296.6, reserveInit: plafond * riPct / 100, horizon: 10,
      ramp: $('ramp').value.split(',').map(Number), rendYearFn: sequenceFn($('sequence').value),
      rendFactorProjet: fDens * fMat,
      rendEstime: +$('rendEstime').value, manquants: +$('manquants').value / 100,
      declinSQ: +$('declinSQ').value / 100, densite: g.densite,
      coutArrachageHa: +$('coutArrachageHa').value, coutPrepaHa: +$('coutPrepaHa').value,
      coutPlant: +$('coutPlant').value, coutPalissageHa: +$('coutPalissageHa').value,
      irrigation: $('irrigation').value === '1', coutIrrigHa: +$('coutIrrigHa').value,
      coutEntreplant: +$('coutEntreplant').value, survie: +$('survie').value / 100,
      entreeProd: +$('entreeProd').value,
      prixKg: +$('prixKg').value,
      fv: {
        regime: $('regime').value,
        loyerAn: (+$('loyerHa').value) * (+$('surfTot').value),
        partRecolte: +$('partRecolte').value / 100, partCouts: +$('partCouts').value / 100
      }
    };
  }

  function majFaireValoir() {
    const r = $('regime').value;
    $('wrapLoyer').hidden = r !== 'fermage';
    $('wrapPartR').hidden = r !== 'metayage';
    $('wrapPartC').hidden = r !== 'metayage';
  }

  function serieRepartie(sc, inp) {
    // renvoie la série de trésorerie annuelle selon la vue faire-valoir
    return sc.eur.map(row => {
      if (vueFV === '1') return row.cashNet;
      const p = OAD.repartir(row, inp.fv);
      return vueFV === 'exp' ? p.exp : p.prop;
    });
  }
  const cumSerie = arr => { let s = 0; return arr.map(v => (s += v)); };

  function calculer() {
    const inp = lireEntrees(), g = inp.geo;
    $('riPctLbl').textContent = $('riPct').value + ' %';
    $('riKgLbl').textContent = fmtKg(inp.reserveInit);

    // --- Synthèse plantation + conséquences ---
    $('syDens').textContent = fmtKg(g.densite) + ' pieds/ha';
    $('syRangs').textContent = g.nbRangs;
    $('syLong').textContent = g.L.toFixed(0) + ' m';
    $('syPieds').textContent = fmtKg(g.pieds) + ' pieds';
    $('sySurf').textContent = g.surf.toFixed(3) + ' ha';
    $('syMode').textContent = g.vsl ? 'Vigne semi-large (VSL)' : 'Traditionnelle';
    const aocOK = g.aoc.rang && g.aoc.pied && g.aoc.somme;
    const ac = $('aocCheck'); ac.className = 'aoc ' + (aocOK ? 'ok' : 'ko');
    ac.textContent = aocOK ? '✓ Écartements conformes (rang ≤ 2,00 m · pied 0,70–1,50 m · somme ≤ 3,00 m — CDC 2025)'
      : '⚠ Hors cahier des charges : ' + [!g.aoc.rang ? 'rang > 2,00 m' : '', !g.aoc.pied ? 'pied hors 0,70–1,50 m' : '', !g.aoc.somme ? 'somme > 3,00 m' : ''].filter(Boolean).join(' · ');
    const conseq = [];
    if (g.vsl) conseq.push(['VSL', `rendement −${$('penaliteVSL').value} % (branché sur VolCo) · empreinte réduite · sensible gel−, grêle+`]);
    else conseq.push(['Traditionnelle', 'rendement de référence · empreinte et coûts standard']);
    if ($('materiel').value === 'voltis') conseq.push(['Voltis (VIFA)', '≤ 5 % de l\'encépagement · +10 % d\'assemblage max · convention INAO/ODG obligatoire · statut provisoire · maturité +8 j']);
    if ($('irrigation').value === '1') conseq.push(['⚠ Irrigation', 'interdite en AOC Champagne (CDC) ; seul l\'arrosage d\'installation des jeunes plants peut être toléré — à vérifier']);
    $('conseq').innerHTML = conseq.map(c => `<span class="badge" title="${c[1]}"><b>${c[0]}</b></span><div class="src" style="margin:.1rem 0 .5rem">${c[1]}</div>`).join('');

    majFaireValoir();
    $('fvHint').textContent = inp.fv.regime === 'propriete' ? '100 % exploitant'
      : inp.fv.regime === 'fermage' ? `loyer ${fmtE(inp.fv.loyerAn)}/an au propriétaire`
      : `${$('partRecolte').value} % récolte / ${$('partCouts').value} % coûts au propriétaire`;

    const sc = OAD.construireScenarios(inp);
    const arr = cumSerie(serieRepartie(sc.arrachage, inp));
    const compl = cumSerie(serieRepartie(sc.complantation, inp));
    const sq = cumSerie(serieRepartie(sc.statuquo, inp));
    const arrSansRI = cumSerie(sc.arrachage.eur.map(row => {
      if (vueFV === '1') return row.cashSansRI;
      const p = OAD.repartir({ ...row, cashRI: 0 }, inp.fv); // sans mobilisation de la sortie arrachage
      return vueFV === 'exp' ? p.exp : p.prop;
    }));

    // --- KPI ---
    let creux = { v: Infinity, t: 0 };
    arr.forEach((v, t) => { const d = v - sq[t]; if (d < creux.v) creux = { v: d, t }; });
    const coutsTot = sc.arrachage.eur.reduce((s, r) => s + r.couts, 0);
    const riValo = sc.arrachage.eur.reduce((s, r) => s + r.cashRI, 0);
    const couv = coutsTot > 0 ? riValo / coutsTot : 0;
    const stockMin = Math.min(...sc.arrachage.kg.map(r => r.stockHa));
    const tMin = sc.arrachage.kg.find(r => r.stockHa === stockMin).t;
    const ageApres = (inp.ageMoy * inp.surfTot - inp.ageParc * inp.surfParc) / inp.surfTot;
    const gainAge = inp.ageMoy - ageApres;

    $('kpis').innerHTML = `
      <div class="kpi" style="--k:var(--alerte)"><div class="lib">Creux de trésorerie vs statu quo</div>
        <div class="val" style="color:var(--alerte)">${fmtE0(creux.v)}</div><div class="det">au plus bas en année ${creux.t}</div></div>
      <div class="kpi" style="--k:var(--or)"><div class="lib">Coûts couverts (réserve)</div>
        <div class="val">${Math.round(couv * 100)} %</div><div class="det">${fmtE0(riValo)} sortie RI / ${fmtE0(coutsTot)} coûts</div></div>
      <div class="kpi" style="--k:var(--vigne)"><div class="lib">Réserve : point bas</div>
        <div class="val">${fmtKg(stockMin)}<span style="font-size:.85rem"> kg/ha</span></div><div class="det">année ${tMin} · plafond 10 000</div></div>
      <div class="kpi" style="--k:var(--ardoise)"><div class="lib">Âge moyen : effet immédiat</div>
        <div class="val">−${gainAge.toFixed(1)} an${gainAge >= 2 ? 's' : ''}</div><div class="det">${inp.ageMoy} → ${ageApres.toFixed(1)} ans · trajectoire pluriannuelle en v2</div></div>`;

    // --- Synthèse phrase ---
    $('synthese').innerHTML = `Sur dix ans, l'<b>arrachage-replantation</b> creuse la trésorerie de <b>${fmtE0(creux.v)}</b> au plus bas (année ${creux.t}), dont <b>${Math.round(couv * 100) + ' %'}</b> des coûts absorbés par la sortie de réserve, et rajeunit l'exploitation de <b>${gainAge.toFixed(1)} an${gainAge >= 2 ? 's' : ''}</b>. La réserve descend à <b>${fmtKg(stockMin)} kg/ha</b> en année ${tMin}${stockMin < 4000 ? ' — coussin réduit, vigilance en cas de petite récolte' : ''}.`;

    // --- Graphiques ---
    const series = [
      { pts: sq, c: 'var(--ardoise)', w: 2, nom: 'statu quo' },
      { pts: compl, c: 'var(--vigne)', w: 2, nom: 'complantation' },
      { pts: arr, c: 'var(--or)', w: 2.6, nom: 'arrachage' }
    ];
    if ($('toggleSansRI').checked) series.push({ pts: arrSansRI, c: '#C9BB94', w: 2, dash: '5 4', nom: 'sans RI' });
    $('chartTreso').innerHTML = chart(series, {
      fmt: fmtE0, annot: [{ serie: arr, t: creux.t, label: 'creux ' + fmtE0(creux.v), c: 'var(--alerte)' }],
      yTitle: '€ cumulés', xTitle: 'année'
    });
    $('lectureTreso').textContent = $('toggleSansRI').checked
      ? 'La bande entre la courbe pleine et la pointillée est ce que la sortie de réserve « arrachage » injecte : elle transforme un trou brutal en pente amortie.'
      : 'Cochez l\'option ci-dessus pour visualiser ce que la réserve amortit.';

    $('chartStock').innerHTML = chart([
      { pts: sc.statuquo.kg.map(r => r.stockHa), c: 'var(--ardoise)', w: 2 },
      { pts: sc.complantation.kg.map(r => r.stockHa), c: 'var(--vigne)', w: 2 },
      { pts: sc.arrachage.kg.map(r => r.stockHa), c: 'var(--or)', w: 2.6 }
    ], { fmt: v => fmtKg(v), y0: 0, ref: { v: 10000, label: 'plafond 10 000' },
      annot: [{ serie: sc.arrachage.kg.map(r => r.stockHa), t: tMin, label: fmtKg(stockMin), c: 'var(--or)' }],
      yTitle: 'kg/ha', xTitle: 'année' });
    $('lectureStock').textContent = 'L\'arrachage puise dans la réserve (sortie « arrachage ») puis la reconstitue ; le statu quo la maintient. Le point bas mesure votre exposition à une petite récolte pendant le renouvellement.';

    // --- Tables ---
    $('tableDetail').innerHTML = '<table><tr><th>t</th><th>Surf. prod</th><th>Récolte</th><th>VolCo vendu</th><th>Mise rés.</th><th>Sortie insuff.</th><th>Sortie arr.</th><th>Stock kg/ha</th><th>Cash net</th></tr>' +
      sc.arrachage.kg.map((r, i) => `<tr><td>${r.t}</td><td>${r.surfProd.toFixed(2)}</td><td>${fmtKg(r.recolte)}</td><td>${fmtKg(r.volcoVendu)}</td><td>${fmtKg(r.mise)}</td><td>${fmtKg(r.sortieInsuff)}</td><td>${fmtKg(r.sortieArr)}</td><td>${fmtKg(r.stockHa)}</td><td>${fmtE(sc.arrachage.eur[i].cashNet)}</td></tr>`).join('') + '</table>';
    const magA = OAD.manqueAGagner(sc.arrachage, sc.statuquo, inp.prixKg);
    const magC = OAD.manqueAGagner(sc.complantation, sc.statuquo, inp.prixKg);
    $('tableMaG').innerHTML = '<table><tr><th>t</th><th>Arrachage</th><th>Complantation</th><th>Statu quo</th></tr>' +
      magA.map((v, i) => `<tr><td>${i}</td><td>${fmtE(v)}</td><td>${fmtE(magC[i])}</td><td>0 € <span style="color:var(--lie)">(invariant)</span></td></tr>`).join('') + '</table>';
  }

  /* Chart SVG : multi-séries, axe zéro, ligne de référence, annotation de point. */
  function chart(series, opt = {}) {
    const W = 760, H = 300, mL = 78, mR = 16, mT = 16, mB = 40;
    const all = series.flatMap(s => s.pts);
    let yMin = Math.min(0, ...all), yMax = Math.max(0, ...all);
    if (opt.y0 !== undefined) yMin = Math.min(yMin, opt.y0);
    if (opt.ref) yMax = Math.max(yMax, opt.ref.v);
    const pad = (yMax - yMin) * 0.08 || 1; yMin -= pad; yMax += pad;
    const n = series[0].pts.length - 1;
    const X = t => mL + (W - mL - mR) * t / n;
    const Y = v => mT + (H - mT - mB) * (1 - (v - yMin) / (yMax - yMin));
    const path = p => p.map((v, t) => (t ? 'L' : 'M') + X(t).toFixed(1) + ',' + Y(v).toFixed(1)).join(' ');
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img">`;
    for (let i = 0; i <= 4; i++) {
      const v = yMin + (yMax - yMin) * i / 4, y = Y(v);
      s += `<line x1="${mL}" x2="${W - mR}" y1="${y}" y2="${y}" stroke="#EDEAE1"/>`;
      s += `<text x="${mL - 8}" y="${y + 4}" text-anchor="end" font-size="10.5" fill="#8B8E8A" font-family="JetBrains Mono">${(opt.fmt || (x => x))(v).replace(' €', '')}</text>`;
    }
    s += `<line x1="${mL}" x2="${W - mR}" y1="${Y(0)}" y2="${Y(0)}" stroke="#20291F" stroke-width="1"/>`;
    if (opt.ref) {
      const y = Y(opt.ref.v);
      s += `<line x1="${mL}" x2="${W - mR}" y1="${y}" y2="${y}" stroke="#A97F26" stroke-width="1" stroke-dasharray="2 3"/>`;
      s += `<text x="${W - mR}" y="${y - 5}" text-anchor="end" font-size="10" fill="#A97F26">${opt.ref.label}</text>`;
    }
    for (let t = 0; t <= n; t++)
      s += `<text x="${X(t)}" y="${H - mB + 16}" text-anchor="middle" font-size="10.5" fill="#8B8E8A" font-family="JetBrains Mono">${t}</text>`;
    if (opt.xTitle) s += `<text x="${(mL + W - mR) / 2}" y="${H - 4}" text-anchor="middle" font-size="10.5" fill="#5C6157">${opt.xTitle}</text>`;
    if (opt.yTitle) s += `<text transform="translate(16,${(mT + H - mB) / 2}) rotate(-90)" text-anchor="middle" font-size="10.5" fill="#5C6157">${opt.yTitle}</text>`;
    for (const se of series)
      s += `<path d="${path(se.pts)}" fill="none" stroke="${se.c}" stroke-width="${se.w}"${se.dash ? ` stroke-dasharray="${se.dash}"` : ''} stroke-linejoin="round"/>`;
    for (const a of (opt.annot || [])) {
      const x = X(a.t), y = Y(a.serie[a.t]);
      s += `<circle cx="${x}" cy="${y}" r="4" fill="${a.c}"/>`;
      const anchor = a.t > n * 0.7 ? 'end' : 'start', dx = anchor === 'end' ? -8 : 8;
      s += `<text x="${x + dx}" y="${y - 8}" text-anchor="${anchor}" font-size="11" font-weight="600" fill="${a.c}">${a.label}</text>`;
    }
    return s + '</svg>';
  }

  document.querySelectorAll('#vueFV button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('#vueFV button').forEach(x => x.classList.remove('actif'));
    b.classList.add('actif'); vueFV = b.dataset.fv; calculer();
  }));
  document.querySelectorAll('input,select').forEach(el => el.addEventListener('input', calculer));
  majFaireValoir();
  calculer();
})();
