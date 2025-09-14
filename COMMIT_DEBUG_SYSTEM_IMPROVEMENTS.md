# Amélioration du système de debug exploitable

## Objectif
Rendre le debug réellement exploitable avec un contexte global persistant et des informations de debug riches.

## Corrections apportées

### 1. Pipeline Time from Diameter amélioré
**Fichier :** `src/lib/pipeline-time-from-d.ts`
**Changements :**
- ✅ Logging console conditionnel avec emoji 🔵 pour success, 🔴 pour erreur
- ✅ Debug note enrichi avec `{diameterRaw, diameterUnit, parsed, D_SI_m, A_SI_m2, model, t_SI_s, inputs_SI, success}`
- ✅ Gestion d'erreur avec debug note détaillé pour diamètres invalides

### 2. Affichage DevDump amélioré  
**Fichiers :** 
- `src/components/ResultsTimeFromD.tsx` - Affichage du DevDump
- `src/components/ResultsCard.tsx` - DevDump dans les résultats principaux
- `src/components/DevDump.tsx` - Ajout du `data-testid` pour les tests

**Changements :**
- ✅ DevDump affiché sous les résultats avec "Time-from-D Debug" ou "Computation Debug"
- ✅ Affichage conditionnel basé sur le contexte debug global

### 3. Contexte debug global déjà existant
**Fichier :** `src/lib/debug-context.tsx` (déjà présent)
- ✅ Persistance localStorage avec clé "debugMode"
- ✅ Hook `useDebug()` disponible globalement
- ✅ Toggle UI branché dans `src/components/DevPanel.tsx`

### 4. Statut du bouton avec debug
**Fichier :** `src/components/BottomActionBar.tsx` (déjà corrigé précédemment)
- ✅ Affichage de `disabled=true/false, reason=<…>` sous le bouton quand debug ON

## Tests ajoutés

### Tests unitaires - `src/lib/__tests__/debug-pipeline-integration.test.ts`
- ✅ Debug note détaillé quand debug activé
- ✅ Pas de debug note quand debug désactivé  
- ✅ Logging console conditionnel
- ✅ Gestion d'erreur avec debug info
- ✅ Critères d'acceptation : D=9µm ⇒ t≈175s (±15%), D=5µm ⇒ t≈540s (±20%)

### Tests E2E - `tests/debug-system-functionality.spec.ts`
- ✅ Persistance du toggle debug après reload
- ✅ DevDump visible avec champs requis en mode "Time from Diameter"
- ✅ Statut bouton avec disabled/reason
- ✅ Logging console en mode debug

## Critères d'acceptation validés

- [x] Le toggle se souvient de l'état après reload (localStorage)
- [x] Un calcul "Time from Diameter" affiche le DevDump avec {diameterRaw, diameterUnit, parsed, D_SI_m, A_SI_m2, model, t_SI_s}
- [x] Logging console des points clés (parse diamètre, unités, D_SI, A_SI, t) en Debug
- [x] Affichage `disabled=true/false, reason=<…>` sous le bouton
- [x] DevDump JSON sous les résultats avec inputs SI, outputs SI, debugNote

## Architecture

```
DebugProvider (localStorage)
    ↓
useDebug() hook
    ↓
┌─ DevPanel (toggle UI)
├─ BottomActionBar (button status)  
├─ pipeline-time-from-d.ts (logging + debugNote)
└─ DevDump (affichage conditionnel)
```

## Fichiers modifiés
- `src/lib/pipeline-time-from-d.ts` - Pipeline avec debug enrichi
- `src/components/ResultsCard.tsx` - DevDump dans résultats 
- `src/components/DevDump.tsx` - testid pour tests
- `src/lib/__tests__/debug-pipeline-integration.test.ts` - Tests unitaires
- `tests/debug-system-functionality.spec.ts` - Tests E2E