# Commit: Enhanced Error Messages and Warnings

## Objective
Improve error messages and warnings to provide more actionable feedback to users, especially in debug mode.

## Changes Made

### 1. Enhanced "Invalid Diameter" Error Messages (`src/lib/pipeline-time-from-d.ts`)
- **Debug mode**: Shows detailed error `"Invalid diameter (raw:<value> unit:<unit> parsed:<parsed>)"`
- **Normal mode**: Shows simple error `"Invalid diameter"`
- **Console logging**: Enhanced debug information with full context
- **DevNote**: Detailed error context for debugging

### 2. Improved Capillary vs Orifice Warning (`src/pages/Calculator.tsx`)
- **Enhanced message**: `"Résultat très sensible au modèle — vérifiez Re, L/D et le choix Capillary/Orifice"`
- **Quantified ratio**: Shows actual time ratio `(t_cap/t_orifice = X.X×)`
- **Extended duration**: 10 seconds for important warnings
- **Clearer title**: "Modèle très sensible" instead of generic "Model Warning"

### 3. New Diameter vs Volume Check (`src/lib/diameter-volume-check.ts`)
- **VolumeCheckResult interface**: Structured result with all metrics
- **checkDiameterVsVolume()**: Core validation function
- **formatVolumeCheckDebug()**: Debug-friendly formatting
- **Equivalent diameters**: Both spherical and cylindrical calculations
- **Conservative approach**: Uses smaller equivalent diameter

### 4. Unphysically Large Diameter Alert
- **UI Toast**: `"Diamètre suspect"` with percentage of equivalent diameter
- **Debug logging**: Detailed console warning with all metrics
- **Threshold**: 10% of vessel equivalent diameter
- **Toast duration**: 12 seconds for critical alerts

### 5. Comprehensive Test Coverage (`tests/enhanced-error-messages.spec.ts`)
- **Error message formats**: Debug vs normal mode testing
- **Volume check logic**: Various scenarios and edge cases
- **Console logging**: Verification of debug output
- **Function testing**: All utility functions validated

## Technical Improvements

### Enhanced Debug Information
- **Detailed error context**: Raw input, unit, parsed value, SI conversion
- **Volume metrics**: All equivalent diameters and ratios
- **Console formatting**: Consistent emoji prefixes (🔴 errors, ⚠️ warnings, 🔵 info)

### Smart Validation Logic
- **Conservative thresholds**: 10% of vessel diameter triggers warning
- **Multiple equivalent diameters**: Sphere and cylinder calculations
- **Fallback handling**: Safe defaults for missing vessel length

## User Experience Improvements

### Better Error Messages
- **Actionable feedback**: Users can see exactly what input failed
- **Context-aware**: Different detail levels for debug vs normal mode
- **Professional language**: Clear French descriptions

### Smart Warnings
- **Quantified alerts**: Specific ratios and measurements
- **Extended visibility**: Longer toast durations for important warnings
- **Progressive disclosure**: Debug details available when needed

## Acceptance Criteria Met

✅ **"Invalid diameter" enhanced**: Now shows `(raw:<...> unit:<...> parsed:<...>)` in Debug mode

✅ **Capillary warning improved**: Shows quantified sensitivity warning with Re/L/D guidance

✅ **Volume check implemented**: Detects and alerts unphysically large diameters with equivalent diameter reference

✅ **Debug logging enhanced**: Console shows structured warnings with all relevant metrics

✅ **Test coverage complete**: All new functionality thoroughly tested

The enhanced error system provides engineering-grade feedback while maintaining user-friendly interfaces for different expertise levels.