# PilotageH — version autonome

Cette version reprend le principe de l'application PilotageH fournie dans les sources, mais supprime les dépendances Base44.

## Architecture
- React + Vite
- Recharts
- Lucide React
- SheetJS (`xlsx`) pour les imports/exports Excel
- jsPDF pour le PDF
- `localStorage` pour le stockage local
- Aucun backend, aucun compte Base44, aucun crédit Base44

## Alimentation
Un seul fichier Excel est attendu, avec les colonnes :
1. `Affaire`
2. `Métier`
3. `Heures consommées`
4. `Budget à date`
5. `Budget alloué`

Une colonne `Date` est facultative. Elle permet l'analyse temporelle.

Les 17 métiers autorisés sont :
Mécanique, Fluide, Mesure, Electricité, Contrôle commande, Activité spécifique,
Indus Nuc, Indus Conv, Indus Elec, Montage Nuc, Montage Conv, Montage Elec,
Architecte, Pilotage, Transverse, MERI, Essais.

## Formules
- Consommation réelle = Heures consommées / Budget alloué × 100
- Consommation à date = Budget à date / Budget alloué × 100
- Écart heures = Heures consommées − Budget à date
- Écart points = Consommation réelle − Consommation à date
- Vert : écart points ≤ seuil vert
- Orange : seuil vert < écart points ≤ seuil orange
- Rouge : écart points > seuil orange

## Installation
Prérequis : Node.js récent.

```bash
npm install
npm run dev
```

Puis ouvrir l'adresse affichée par Vite.

Pour générer une version de production :
```bash
npm run build
```

Le dossier `dist/` obtenu peut être déployé sur un hébergement statique.

## Important
Les données sont stockées dans le navigateur. Elles ne sont pas synchronisées entre plusieurs PC/navigateurs. Pour un usage multi-utilisateur ou une base centralisée, il faudra ajouter un backend/base de données.
