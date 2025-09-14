# Commit: Unified Model Selection System

## Objective
Ensure consistent model selection between "Diameter from Time" and "Time from Diameter" calculations.

## Changes Made

### 1. Physics Engine (`src/lib/physics.ts`)
- Modified `computeDfromT` to respect `inputs.modelSelection` when provided
- Added forced model selection logic before auto-detection
- When model is forced, still validate assumptions and provide warnings if model may not be optimal
- Maintains existing auto-detection behavior when no model selection is provided

### 2. Calculator Logic (`src/pages/Calculator.tsx`)
- Ensured `modelSelection` is passed to both calculation paths
- Added model suggestion toast for "Diameter from Time" calculations
- Unified toast messages for both modes ("Suggestion de modèle")
- Both modes now show suggestions when auto-detection recommends different model

### 3. Test Coverage (`tests/unified-model-selection.spec.ts`)
- Tests that both modes respect user model selection
- Round-trip tests with forced models (orifice and capillary)
- Debug output consistency verification
- Model forcing validation with accuracy requirements (±5%)

## Acceptance Criteria Met

✅ **Single model selector used by both modes**: The `modelSelection` from UI is now enforced in both `computeDfromT` and `computeTimeFromDiameter`

✅ **Auto-detection suggestions without override**: When auto-detection suggests a different model, a toast is shown but user selection is preserved

✅ **Consistent DevDump model**: Debug output shows the actually used model (forced by user) in both calculation modes

✅ **Round-trip tests pass with same model**: Tests verify ±5% accuracy when using the same model for both D→t and t→D calculations

## Model Selection Priority
1. **User Selection (Highest)**: `modelSelection` parameter forces the chosen model
2. **Auto-Detection (Fallback)**: When no user selection, existing smart auto-detection logic applies
3. **Validation Warnings**: Even with forced selection, warnings are shown if model assumptions are not met

This ensures users have full control over model selection while still benefiting from expert system recommendations.