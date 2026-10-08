// Programme v2 — objectif : physique type "David Laid" (V athlétique et sec).
// Pour : perte de gras, niveau intermédiaire, 3 séances salle de 1h30
// (≈ 60 min muscu + 30 min tapis incliné), cardio dehors les autres jours.
//
// Priorités esthétiques (ce qui crée le "V") :
//   • dorsaux larges : tirage vertical à CHAQUE séance (≈13 séries/sem + rowings)
//   • deltoïdes latéraux : élévations à chaque séance (≈11 séries/sem) → carrure
//   • haut des pecs : incliné en priorité (≈7 séries/sem sur 13 pour les pecs)
//   • bras : biceps/triceps 2x/sem en superset
//   • taille fine : abdos droits uniquement, pas d'obliques chargés
//   • jambes : volume de maintien/progression athlétique (≈7 séries quadriceps, 9 ischios)
//
// Effort : s'arrêter 1–2 reps avant l'échec sur les polyarticulaires (RIR 1–2) ;
// isolation : dernière série jusqu'à l'échec technique.
// Supersets (champ ss) : on enchaîne les 2 exercices, repos après le 2e → gain ~10 min.
// Progression "double" : toutes les séries au haut de la fourchette → +inc kg la fois suivante.

const RIR_HEAVY = 'Arrête-toi 1–2 reps avant l\'échec (technique parfaite).';
const RIR_ISO = 'Dernière série jusqu\'à l\'échec technique.';
const TAPIS = { type: 'tapis', minutes: 30, note: 'Tapis incliné 10–12 %, 5–5,5 km/h, sans tenir les barres.' };

export const PROGRAM_VERSION = 2;

export const DEFAULT_PROGRAM = {
  version: PROGRAM_VERSION,
  days: [
    {
      id: 'A',
      name: 'Séance A — Haut des pecs / Jambes',
      short: 'A',
      kind: 'gym',
      exercises: [
        { id: 'squat', name: 'Squat barre', sets: 4, repMin: 5, repMax: 8, rest: 150, inc: 5, rir: RIR_HEAVY, tip: 'Descends au moins cuisses parallèles, dos gainé.' },
        { id: 'incline_bench', name: 'Développé incliné barre', sets: 4, repMin: 6, repMax: 10, rest: 150, inc: 2.5, rir: RIR_HEAVY, tip: 'Banc à 30°. Le haut des pecs donne l\'effet "torse plein".' },
        { id: 'pullup', name: 'Tractions (ou tirage vertical)', sets: 3, repMin: 6, repMax: 10, rest: 120, inc: 2.5, rir: RIR_HEAVY, tip: 'Prise large, tire les coudes vers les hanches. Charge = lest (0 au poids du corps) ou poids à la machine.' },
        { id: 'rdl', name: 'Soulevé de terre roumain', sets: 3, repMin: 8, repMax: 10, rest: 120, inc: 5, rir: RIR_HEAVY, tip: 'Fesses en arrière, barre collée aux jambes.' },
        { id: 'lateral', name: 'Élévations latérales haltères', sets: 3, repMin: 12, repMax: 20, rest: 15, inc: 1, ss: 'A1', rir: RIR_ISO, tip: 'Monte jusqu\'à l\'horizontale, coudes légèrement fléchis, sans élan.' },
        { id: 'cable_fly_low', name: 'Écarté poulie bas → haut', sets: 3, repMin: 12, repMax: 15, rest: 75, inc: 2.5, ss: 'A1', rir: RIR_ISO, tip: 'Mains qui remontent vers le menton : cible le haut des pecs.' },
        { id: 'oh_triceps', name: 'Extension triceps au-dessus de la tête (poulie)', sets: 3, repMin: 10, repMax: 15, rest: 15, inc: 2.5, ss: 'A2', rir: RIR_ISO, tip: 'Étire bien le triceps en bas.' },
        { id: 'leg_raise', name: 'Relevés de jambes suspendu', sets: 3, repMin: 10, repMax: 15, rest: 60, inc: 0, ss: 'A2', rir: RIR_ISO, tip: 'Enroule le bassin, pas d\'élan. Charge 0 = poids du corps.' },
      ],
      cardio: TAPIS,
    },
    {
      id: 'B',
      name: 'Séance B — Dos / Épaules',
      short: 'B',
      kind: 'gym',
      exercises: [
        { id: 'deadlift', name: 'Soulevé de terre', sets: 3, repMin: 4, repMax: 6, rest: 180, inc: 5, rir: RIR_HEAVY, tip: 'Dos neutre, pousse le sol avec les jambes. Jamais à l\'échec.' },
        { id: 'pulldown', name: 'Tirage vertical prise large', sets: 4, repMin: 8, repMax: 12, rest: 120, inc: 2.5, rir: RIR_HEAVY, tip: 'Le muscle n°1 du V : contrôle la remontée.' },
        { id: 'ohp', name: 'Développé épaules haltères assis', sets: 3, repMin: 8, repMax: 12, rest: 120, inc: 2, rir: RIR_HEAVY, tip: 'Dossier presque vertical, ne cambre pas.' },
        { id: 'chest_row', name: 'Rowing buste appuyé', sets: 3, repMin: 8, repMax: 12, rest: 90, inc: 2, rir: RIR_HEAVY, tip: 'Épaisseur du dos, sans fatiguer les lombaires.' },
        { id: 'lateral_cable', name: 'Élévations latérales poulie', sets: 4, repMin: 12, repMax: 20, rest: 15, inc: 1.25, ss: 'B1', rir: RIR_ISO, tip: 'Tension constante, une main à la fois.' },
        { id: 'face_pull', name: 'Face pull', sets: 3, repMin: 15, repMax: 20, rest: 60, inc: 2.5, ss: 'B1', rir: RIR_ISO, tip: 'Arrière d\'épaule + posture : ouvre la carrure.' },
        { id: 'curl', name: 'Curl incliné haltères', sets: 3, repMin: 10, repMax: 15, rest: 15, inc: 1, ss: 'B2', rir: RIR_ISO, tip: 'Banc à 45°, bras en arrière : étirement maximal du biceps.' },
        { id: 'pushdown', name: 'Extension triceps poulie', sets: 3, repMin: 10, repMax: 15, rest: 60, inc: 2.5, ss: 'B2', rir: RIR_ISO, tip: '' },
      ],
      cardio: TAPIS,
    },
    {
      id: 'C',
      name: 'Séance C — Pecs / Full body',
      short: 'C',
      kind: 'gym',
      exercises: [
        { id: 'bench', name: 'Développé couché', sets: 3, repMin: 6, repMax: 10, rest: 150, inc: 2.5, rir: RIR_HEAVY, tip: 'Omoplates serrées, barre au bas des pecs.' },
        { id: 'pulldown_n', name: 'Tirage vertical prise neutre', sets: 3, repMin: 8, repMax: 12, rest: 90, inc: 2.5, rir: RIR_HEAVY, tip: 'Étire les dorsaux en haut, serre en bas.' },
        { id: 'bulgarian', name: 'Fentes bulgares', sets: 3, repMin: 8, repMax: 12, rest: 90, inc: 2, rir: RIR_HEAVY, tip: 'Reps par jambe. Jambes athlétiques + gros brûleur de calories.' },
        { id: 'leg_curl', name: 'Leg curl', sets: 3, repMin: 10, repMax: 15, rest: 75, inc: 2.5, rir: RIR_ISO, tip: '' },
        { id: 'lateral_cable', name: 'Élévations latérales poulie', sets: 4, repMin: 12, repMax: 20, rest: 15, inc: 1.25, ss: 'C1', rir: RIR_ISO, tip: '' },
        { id: 'incline_db', name: 'Développé incliné haltères', sets: 3, repMin: 8, repMax: 12, rest: 75, inc: 2, ss: 'C1', rir: RIR_ISO, tip: '2e dose de haut des pecs de la semaine.' },
        { id: 'hammer', name: 'Curl marteau', sets: 3, repMin: 10, repMax: 15, rest: 15, inc: 1, ss: 'C2', rir: RIR_ISO, tip: 'Épaissit le bras vu de face.' },
        { id: 'cable_crunch', name: 'Crunch à la poulie', sets: 3, repMin: 10, repMax: 15, rest: 60, inc: 2.5, ss: 'C2', rir: RIR_ISO, tip: 'Abdos visibles une fois sec. Pas d\'obliques chargés (taille fine).' },
      ],
      cardio: TAPIS,
    },
    {
      id: 'Z2',
      name: 'Cardio — Endurance (zone 2)',
      short: 'Z2',
      kind: 'cardio',
      cardio: { type: 'marche', minutes: 45, note: 'Marche rapide ou footing très léger : tu dois pouvoir parler en phrases complètes. Brûle du gras sans fatiguer tes jambes pour la salle.' },
    },
    {
      id: 'INCL',
      name: 'Cardio — Marche inclinée / vélo',
      short: 'Z2',
      kind: 'cardio',
      cardio: { type: 'marche', minutes: 40, note: 'Marche en côte, tapis incliné ou vélo, allure facile. Remplace les intervalles : même résultat sur le gras, zéro impact sur tes jambes pour la séance C.' },
    },
    {
      id: 'LONG',
      name: 'Cardio — Sortie longue',
      short: 'LONG',
      kind: 'cardio',
      cardio: { type: 'marche', minutes: 60, note: 'Marche rapide, vélo ou rando 60 min tranquille. Fait pour être facile.' },
    },
    {
      id: 'HIIT',
      name: 'Cardio — Intervalles (option)',
      short: 'INT',
      kind: 'cardio',
      cardio: { type: 'intervalles', minutes: 30, note: 'Option quand tu seras sous ~90 kg. 10 min échauffement → 8 × (30 s vite / 90 s lent) → 5 min retour au calme. Jamais la veille d\'une séance jambes.' },
    },
    {
      id: 'REST',
      name: 'Repos actif',
      short: 'OFF',
      kind: 'rest',
      cardio: { type: 'marche', minutes: 20, note: 'Petite marche + 10 min d\'étirements. La récup fait partie du programme.' },
    },
  ],
  // 0 = dimanche … 6 = samedi
  week: { 1: 'A', 2: 'Z2', 3: 'B', 4: 'INCL', 5: 'C', 6: 'LONG', 0: 'REST' },
};

export const CARDIO_TYPES = [
  { id: 'tapis', label: 'Tapis incliné' },
  { id: 'marche', label: 'Marche rapide' },
  { id: 'course', label: 'Course' },
  { id: 'intervalles', label: 'Intervalles' },
  { id: 'velo', label: 'Vélo' },
  { id: 'autre', label: 'Autre' },
];
