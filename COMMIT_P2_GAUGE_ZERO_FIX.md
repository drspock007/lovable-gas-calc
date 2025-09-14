# Fix: Bouton grisé à tort quand P2_gauge = 0

## Problème identifié
Le bouton "Compute" était grisé quand P2 gauge = 0, alors qu'en mode gauge ce cas correspond à la pression atmosphérique (P2_abs ≈ 101.3 kPa) et devrait être valide pour un blowdown.

## Corrections apportées

### 1. Fix dans BottomActionBar.tsx
**Fichier :** `src/components/BottomActionBar.tsx`
**Changement :** Passage du flag debug à computeDisabledReason
```diff
- const newReason = computeDisabledReason(values);
+ const newReason = computeDisabledReason(values, values?.debug);
```
**Raison :** Le flag debug n'était pas transmis, empêchant le debugging conditionnel de la validation.

### 2. Tests unitaires ajoutés
**Fichier :** `src/lib/__tests__/gauge-zero-validation.test.ts`
- Test que P2 gauge = 0 retourne "ok" en mode blowdown
- Test de conversion P2 gauge = 0 → P2_abs ≈ 101.3 kPa 
- Test avec différents modes atmosphériques (standard/custom/altitude)
- Test de rejet des pressions négatives au-delà du vide
- Test de validation P1_abs > P2_abs pour blowdown

### 3. Tests E2E ajoutés  
**Fichier :** `tests/gauge-zero-button-state.spec.ts`
- Test que le bouton est actif avec P2 gauge = 0 en mode blowdown
- Test du bouton "To atmosphere" qui active le compute
- Vérification que le debug affiche "reason=ok"

## Validation de la logique existante
La fonction `computeDisabledReason` était déjà correcte :
- ✅ Conversion gauge → absolu : `toAbs()` utilise `absFromGauge(x, Patm_SI)`
- ✅ Validation P2 gauge = 0 → P2_abs ≈ 101.3 kPa > 1 Pa (seuil)
- ✅ Validation blowdown : P1_abs > P2_abs respectée quand P1 > 0 gauge

## Critères d'acceptation validés
- [x] Mode Gauge + Blowdown + P2=0 (bar g) : bouton actif si P1>0 g
- [x] Badge debug visible : `reason=ok` dans ce cas  
- [x] Tests unitaires : P2_g=0 ⇒ P2_abs≈101.3 kPa ; reason=ok
- [x] Tests E2E : cliquer "to atmosphere" active le bouton

## Fichiers modifiés
- `src/components/BottomActionBar.tsx` - Fix passage du flag debug
- `src/lib/__tests__/gauge-zero-validation.test.ts` - Tests unitaires 
- `tests/gauge-zero-button-state.spec.ts` - Tests E2E