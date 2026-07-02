# OAD Renouvellement — maquette v1.1

Ouvrir `index.html` dans un navigateur (aucun serveur). Tests : `node tests.js` (17 invariants).

## Nouveautés v1.1
- **Rendement des leviers → VolCo** : la conduite (VSL) porte une pénalité de
  rendement branchée sur la récolte, donc sur le VolCo. Effet volontairement
  réaliste : en année normale, le coussin au-dessus du VolCo + le plafond
  absorbent une pénalité modérée (elle est quasi invisible) ; elle ne mord la
  vente que sous stress (petite récolte). Le badge « conséquences » l'affiche.
- **Motif d'arrachage → commutation sanitaire** : « Sanitaire (FD) » bascule
  automatiquement repos = 3 ans et sortie de réserve = 5 ans (au lieu de 1 / 3).
- **Faire-valoir** : propriété / fermage (loyer fixe) / métayage (part de
  récolte + part de coûts éditables). Répartition appliquée aux € seuls, total
  conservé (tests T8–T9). La sortie arrachage est partagée en métayage (bailleur
  à métayage nature).
- **Géométrie de plantation** : densité, nombre de rangs et surface dérivés de
  longueur × largeur et des écartements, avec contrôle du cahier des charges homologué le 31/07/2025
  (rang ≤ 2,00 m ; pied 0,70–1,50 m ; somme ≤ 3,00 m). Règle spécifique de
  forte pente (allées, ≤ 2,30 m) non modélisée. Irrigation interdite en AOC :
  la ferti-irrigation porte désormais un avertissement réglementaire.
- **Écran 4 remanié** : phrase de synthèse, KPI colorés, graphiques annotés
  (creux repéré, plafond de réserve), guides de lecture.
- **Étiquettes conséquences** sourcées et éditables (pénalité VSL, Voltis :
  cap 5 % encépagement + 10 % assemblage, convention INAO/ODG, statut provisoire).

## Parité classeur (inchangée)
min 5 021,8 kg/ha en t=3 ; final 10 000 ; Σ sortie arrachage 8 100 kg ;
Σ mise 12 850 kg. Stock initial assis sur la surface totale pour les trois
scénarios (divergence assumée vs classeur — voir historique).

## À caler avant tout usage réel
Prix du raisin, coûts (arrachage/prépa/plants/palissage/entreplants),
pénalité VSL, montée en charge, survie et délai de complantation,
et les paramètres réglementaires (sortie 9 000 ×3/×5 depuis le 30/10/2024,
plafond 10 000, Voltis 5 %). Source de vérité : cahier des charges AOC Champagne.
