# Le Système — mon app sport style Solo Leveling

App web installable sur le téléphone (PWA) : quêtes quotidiennes, XP / niveaux / rangs E→S,
suivi des séances avec charges, suggestions de charge automatiques, minuteur de repos, cardio, stats et graphiques,
nutrition, synchro en ligne.

## Ton programme (objectif : V athlétique et sec, type David Laid)

| Jour | Séance |
|---|---|
| Lundi | **A — Haut des pecs / Jambes** : squat, développé incliné, tractions, SDT roumain, superset élévations latérales + écarté bas→haut, superset triceps + relevés de jambes · puis 30 min tapis incliné |
| Mardi | Cardio endurance (zone 2), 45 min |
| Mercredi | **B — Dos / Épaules** : soulevé de terre, tirage large, développé haltères, rowing appuyé, superset élévations poulie + face pull, superset curl incliné + triceps · puis 30 min tapis incliné |
| Jeudi | Marche inclinée / vélo, 40 min (remplace les intervalles) |
| Vendredi | **C — Pecs / Full body** : développé couché, tirage neutre, fentes bulgares, leg curl, superset élévations + incliné haltères, superset curl marteau + crunch poulie · puis 30 min tapis incliné |
| Samedi | Sortie longue, 60 min tranquille |
| Dimanche | Repos actif |

**Volume par semaine** : dorsaux ~13 séries (tirage vertical à chaque séance), deltoïdes latéraux ~11, pecs ~13
(dont la moitié pour le haut), bras ~6 chacun + travail indirect, quadriceps ~7, ischios ~9, abdos 6.
Pas d'obliques chargés, pour garder une taille fine.

**Effort** : 1–2 reps avant l'échec sur les gros exercices, dernière série à l'échec sur l'isolation (affiché dans l'app).

**Supersets** : l'app bascule automatiquement entre les 2 exercices et ne lance le repos qu'après le 2e.

**Semaine allégée** : l'app la propose toute seule si ta force baisse 2 séances de suite sur 2 gros exercices,
ou après 7 semaines. Pendant 7 jours : mêmes charges, 1/3 de séries en moins.

**Progression** : quand tu fais le haut de la fourchette de reps sur toutes les séries, l'app propose d'ajouter du poids.

---|---|
| Lundi | **A — Pecs / Jambes** (squat, développé couché, SDT roumain, incliné haltères, écarté poulie, élévations, triceps) + 30 min tapis incliné |
| Mardi | Cardio dehors — endurance zone 2, 45 min |
| Mercredi | **B — Dos / Épaules** (soulevé de terre, tirage, militaire, rowing, leg curl, face pull, biceps) + 30 min tapis incliné |
| Jeudi | Cardio dehors — intervalles, 35 min |
| Vendredi | **C — Full body volume** (incliné barre, presse, rowing, fentes bulgares, dips, tirage, relevés de jambes) + 30 min tapis incliné |
| Samedi | Cardio dehors — sortie longue, 60 min tranquille |
| Dimanche | Repos actif (marche + étirements) |

Tout est modifiable dans l'onglet **Profil** (jours, exercices, séries, reps, repos).

**Progression :** quand tu fais le haut de la fourchette de reps sur toutes les séries, l'app te propose
automatiquement d'ajouter du poids à la séance suivante. Sinon, elle te dit de viser +1 rep.

**Nutrition :** calculée à partir de ton profil (calories + protéines) et
recalculée au fil de tes pesées. L'onglet Stats te dit si tu perds trop vite / trop lentement.

---

## 1. Tester sur ton PC

Dans ce dossier :

```bash
python -m http.server 5173
```

Puis ouvre http://localhost:5173

## 2. Mettre en ligne (gratuit) — GitHub Pages

1. Crée un compte sur https://github.com puis un dépôt (repository) public, ex. `systeme`.
2. Envoie les fichiers de ce dossier dans le dépôt (bouton **Add file → Upload files**, glisse tout le contenu du dossier).
3. Dans le dépôt : **Settings → Pages → Branch : `main` / root → Save**.
4. Après 1 minute ton app est en ligne sur `https://TON-PSEUDO.github.io/systeme/`.

> Alternative encore plus simple : https://app.netlify.com/drop → glisse le dossier → lien direct.

**Pour une mise à jour :** renvoie les fichiers modifiés, et change `VERSION` dans `sw.js` (ex. `sl-v2`).

## 3. Installer sur le téléphone

- **Android (Chrome)** : ouvre le lien → menu ⋮ → **Installer l'application**.
- **iPhone (Safari)** : ouvre le lien → bouton Partager → **Sur l'écran d'accueil**.

L'app s'ouvre en plein écran comme une vraie app et marche **hors ligne** (à la salle sans réseau, par exemple).

## 4. Synchro en ligne (même données sur tel + PC)

1. Crée un compte gratuit sur https://supabase.com → **New project**.
2. Dans le projet : **SQL Editor** → colle le contenu de `supabase.sql` → **Run**.
3. **Project Settings → API** : copie **Project URL** et la clé **anon public**.
4. Dans l'app : onglet **Profil → Synchronisation en ligne** → colle les deux → **Créer mon compte**.
   (Ou mets-les dans `config.js` avant la mise en ligne pour ne pas avoir à les retaper sur chaque appareil.)
5. Sur ton 2ᵉ appareil, connecte-toi avec le même email / mot de passe.

Astuce : dans Supabase → **Authentication → Providers → Email**, tu peux désactiver « Confirm email »
pour ne pas avoir à cliquer sur un lien de confirmation.

Le point en haut à droite indique l'état : vert = synchronisé, jaune = hors ligne, rouge = erreur.

## Ce que j'ai volontairement laissé de côté

Les apps payantes (Fitbod ~96 $/an, Strong, Hevy Pro…) vendent surtout : générateur IA de séances,
fil social / followers, bibliothèque de 1 600 exercices en vidéo, montres connectées, coaching « premium ».
Pour toi c'est du bruit : tu as un programme fixe et adapté, ce qui compte c'est **noter tes charges vite,
progresser chaque semaine, faire ton cardio et tenir ta nutrition**. L'app fait exactement ça, sans pub ni abonnement.

## Fichiers

- `index.html`, `styles.css` — interface
- `js/program.js` — ton programme par défaut
- `js/store.js` — données, XP, niveaux, quêtes, suggestions de charge, nutrition
- `js/app.js` — écrans et interactions
- `js/charts.js` — graphiques
- `js/sync.js`, `config.js`, `supabase.sql` — synchro en ligne
- `sw.js`, `manifest.webmanifest`, `icons/` — installation et mode hors ligne
