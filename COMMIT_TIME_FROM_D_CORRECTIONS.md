# Pipeline "Time from Diameter" Corrections

## Problème résolu
Le calcul "Time from Diameter" donnait des temps absurdes à cause d'une conversion d'unités incorrecte pour les micromètres (µm).

## Corrections apportées

### 1. Corrections des conversions d'unités (src/lib/length-units.ts)
- ✅ Ajout du type `"µm"` avec facteur correct 1e-6 m 
- ✅ Correction de `normalizeLengthUnit()` pour retourner `"µm"` au lieu de `"mm"`
- ✅ Ajout du label "µm" dans `LENGTH_LABEL`

**Avant**: µm → mm unit (1e-3 m) ❌  
**Après**: µm → µm unit (1e-6 m) ✅

### 2. Pipeline cohérent (src/lib/pipeline-time-from-d.ts)  
- ✅ Utilise le modèle sélectionné par l'utilisateur (`modelOverride`) sans auto-switch
- ✅ Expose les résultats requis: `{model, D_SI_m, A_SI_m2, t_SI_s, debugNote}`
- ✅ Pipeline unique: UI → D_SI → A_SI → t_SI via les MÊMES fonctions que "Diameter from Time"
- ✅ Gestion d'erreur cohérente avec `devNote` structuré

### 3. Affichage résultats (src/components/ResultsTimeFromD.tsx)
- ✅ Affiche le temps depuis `result.t_SI_s` (source unique de vérité)
- ✅ Affiche le modèle utilisé
- ✅ Pas de recalcul UI, conversion d'unités pure (s/min/h)

## Tests d'acceptance
- ✅ D=9µm → t≈175s ±15% (preset Gio)
- ✅ D=5µm → t≈540s ±20% (preset Gio) 
- ✅ Round-trip D→t→D avec précision ±5%
- ✅ Respect du modèle utilisateur (orifice/capillary)
- ✅ Gestion erreur "Invalid diameter" avec debug complet
- ✅ Scaling t ∝ 1/A vérifié

## Fichiers modifiés
```
src/lib/length-units.ts                    - Correction facteurs µm 
src/lib/pipeline-time-from-d.ts            - Pipeline cohérent + résultats exposés
src/components/ResultsTimeFromD.tsx        - Affichage du modèle
tests/length-units-corrections.spec.ts     - Tests unitaires conversions
tests/time-from-d-roundtrip.spec.ts       - Tests round-trip
tests/time-from-d-acceptance.spec.ts      - Tests d'acceptance complets
```

## Definition of Done ✅
- [x] Code corrigé avec conversions d'unités centralisées
- [x] Tests unitaires et d'acceptance passent
- [x] Pipeline cohérent entre "Time from D" et "Diameter from Time" 
- [x] Debug complet via `DevDump` quand `debugMode` activé
- [x] Pas de recalculs UI, source unique de vérité depuis moteur SI
- [x] Message de commit: "fix: correct µm unit conversion in time-from-diameter pipeline"