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

## Écran 2 — dimensionnement palissage (nouveau)
Le coût de palissage n'est plus un forfait : `coutPalissage(geo, prix, opt)`
(moteur.js) le **dérive de la géométrie** et **préremplit** le champ coût
(choix A), éditable — dès que l'utilisateur le modifie, le préremplissage
s'arrête (bouton ↻ pour reprendre la valeur dérivée).
- Prix unitaires : classeur **LutEnVi 2025** (feuille « Coût hectare
  d'installation ») — instantané à réactualiser (acier volatil). Le fil est
  ramené à 0,132 €/m **par fil** (LutEnVi : 0,528 €/m pour 4 fils groupés ÷ 4).
- Piquets intermédiaires : règle `longueur_rang / espacement` (choix B),
  espacement **éditable, défaut 6 m**. ⚠ Divergence assumée : LutEnVi posait
  ~1 piquet tous les 4 pieds (≈ 4,3 m) ; à 6 m le nombre de piquets est
  **~30 % plus faible** (repère affiché dans l'UI).
- Nombre de fils : fonction du **type de taille** (choix C, `FILS_PAR_TAILLE`),
  éditable — mapping taille→fils **non figé par le guide, à confirmer**.
- Affichage pur (n'alimente pas le calcul) : fiche conseil **porte-greffe**
  (Guide 2025, p. 38-39) et diamètre de **fil porteur** (p. 37).
Tests palissage : T18 (pricing = Σ qté×prix), T19 (règle B monotone),
T20 (choix C monotone), T21 (parité pricing LutEnVi ±5 %).

## Parité classeur (inchangée)
min 5 021,8 kg/ha en t=3 ; final 10 000 ; Σ sortie arrachage 8 100 kg ;
Σ mise 12 850 kg. Stock initial assis sur la surface totale pour les trois
scénarios (divergence assumée vs classeur — voir historique).

## À caler avant tout usage réel
Prix du raisin, coûts (arrachage/prépa/plants/palissage/entreplants),
pénalité VSL, montée en charge, survie et délai de complantation,
et les paramètres réglementaires (sortie 9 000 ×3/×5 depuis le 30/10/2024,
plafond 10 000, Voltis 5 %). Source de vérité : cahier des charges AOC Champagne.
