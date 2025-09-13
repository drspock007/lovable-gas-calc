export const translations = {
  fr: {
    // App & Navigation
    appTitle: 'Calculateur de Transfert de Gaz',
    appSubtitle: 'Écoulement capillaire et orifice pour vases rigides',
    
    // Mode Selection
    process: 'Processus',
    blowdown: 'Vidange',
    filling: 'Remplissage',
    solveFor: 'Calculer',
    DfromT: 'D depuis t',
    TfromD: 't depuis D',
    
    // Field Labels
    vesselVolume: 'Volume du réservoir',
    startPressure: 'Pression initiale (P₁)',
    targetPressure: 'Pression finale (P₂)',
    supplyPressure: 'Pression d\'alimentation (Pₛ)',
    temperature: 'Température',
    orificeLength: 'Épaisseur de paroi',
    orificeDiameter: 'Diamètre d\'orifice',
    transferTime: 'Temps de transfert',
    gasType: 'Type de gaz',
    customGas: 'Gaz personnalisé',
    
    // Gas Properties
    gasProperties: 'Propriétés du gaz',
    molecularWeight: 'Masse molaire (M)',
    specificGasConstant: 'Constante spécifique (R)',
    heatCapacityRatio: 'Rapport γ = Cp/Cv',
    dynamicViscosity: 'Viscosité dynamique (μ)',
    gasName: 'Nom du gaz',
    
    // Advanced Options
    advancedOptions: 'Options avancées',
    convergenceTolerance: 'Tolérance de convergence (ε)',
    regime: 'Régime thermodynamique',
    isothermal: 'Isotherme',
    adiabatic: 'Adiabatique',
    dischargeCoefficient: 'Coefficient de décharge (Cd)',
    viscosityOverride: 'Remplacer viscosité',
    numericTolerance: 'Tolérance numérique',
    
    // Units
    units: {
      Pa: 'Pa', bar: 'bar', kPa: 'kPa', MPa: 'MPa', psi: 'psi',
      m3: 'm³', liter: 'L', gallon: 'gal',
      kelvin: 'K', celsius: '°C', fahrenheit: '°F',
      m: 'm', mm: 'mm', cm: 'cm', inch: 'in',
      second: 's', minute: 'min', hour: 'h',
    },
    
    // Tooltips
    tooltips: {
      vesselVolume: 'Volume interne du réservoir. Plus grand = plus long à vider/remplir.',
      startPressure: 'Pression absolue au début du processus. Attention aux fuites !',
      targetPressure: 'Pression absolue visée. Ne jamais atteindre exactement (ε évite l\'infini).',
      supplyPressure: 'Pression de la source d\'alimentation. Doit être > P₂ pour remplir.',
      temperature: 'Température du gaz (supposée constante en isotherme). Affecte densité et viscosité.',
      orificeLength: 'Épaisseur de paroi ou longueur du chemin de fuite. Capillaire si L/D ≥ 10.',
      orificeDiameter: 'Diamètre du trou. Plus grand = plus rapide (mais attention à la cavitation !).',
      transferTime: 'Durée du processus. Courts temps = hauts débits = risque de non-idéalité.',
      epsilon: 'On s\'arrête à P_f = P₂·(1±ε) pour éviter l\'infini mathématique. 1% par défaut.',
      dischargeCoefficient: 'Coefficient de perte de charge (0.6-0.8 typique). Dépend de la géométrie.',
      molecularWeight: 'Masse molaire en kg/mol. Plus lourd = plus lent.',
      specificGasConstant: 'R = 8.314 / M. Calculé automatiquement.',
      heatCapacityRatio: 'γ = Cp/Cv. Monoatomique ≈1.67, diatomique ≈1.4, polyatomique ≈1.3.',
      dynamicViscosity: 'Viscosité à la température de service. Affecte les pertes en capillaire.',
    },
    
    // Actions
    calculate: 'Calculer',
    clear: 'Effacer',
    copy: 'Copier',
    share: 'Partager',
    export: 'Exporter',
    exportCSV: 'Exporter CSV',
    exportPDF: 'Exporter PDF',
    
    // Results
    results: 'Résultats',
    primaryResult: 'Résultat principal',
    modelVerdict: 'Verdict du modèle',
    diagnostics: 'Diagnostics',
    warnings: 'Avertissements',
    noResults: 'Pas encore de résultats',
    clickCalculate: 'Cliquez sur Calculer pour voir les résultats',
    
    // Verdicts & Rationales
    verdicts: {
      capillary: 'Capillaire',
      orifice: 'Orifice',
      both: 'Les deux modèles',
      inconclusive: 'Inconclusif',
      
      capillaryValid: 'Capillaire: Re={Re}, L/D={LD}. Écoulement laminaire validé.',
      orificeValid: 'Orifice: {flowType}. Modèle compressible approprié.',
      bothValid: 'Les deux modèles valides. {chosenModel} sélectionné (résidu: {residual}%).',
      neitherValid: 'Ni capillaire ni orifice parfaitement valide. Vérifiez vos paramètres.',
      onlyCapillary: 'Seul le modèle capillaire converge. {validity}.',
      onlyOrifice: 'Seul le modèle orifice converge. {flowType}.',
      
      choked: 'étranglé jusqu\'à {Pstar} bar',
      subsonic: 'subsonique',
      valid: 'Valide',
      invalid: 'Invalide',
    },
    
    // Physics Explanations
    equations: {
      title: 'Équations physiques',
      capillaryTitle: 'Modèle capillaire (Poiseuille)',
      orificeTitle: 'Modèle orifice (compressible)',
      assumptions: 'Hypothèses',
      capillaryAssumptions: '• Écoulement laminaire (Re ≤ 2000)\n• Géométrie capillaire (L/D ≥ 10)\n• Régime isotherme\n• Gaz parfait',
      orificeAssumptions: '• Écoulement compressible\n• Orifice mince (L/D < 10)\n• Détente isentropique\n• Possibilité d\'étranglement',
    },
    
    // Safety
    safety: {
      title: 'Avertissement de sécurité',
      disclaimer: 'Ces calculs sont fournis à titre indicatif. Les systèmes sous pression présentent des risques. Consultez un ingénieur qualifié pour les applications critiques. Vérifiez toujours par l\'expérience.',
    },
  },
  
  en: {
    // App & Navigation
    appTitle: 'Gas Transfer Calculator',
    appSubtitle: 'Capillary and orifice flow for rigid vessels',
    
    // Mode Selection
    process: 'Process',
    blowdown: 'Blowdown',
    filling: 'Filling',
    solveFor: 'Solve For',
    DfromT: 'D from t',
    TfromD: 't from D',
    
    // Field Labels
    vesselVolume: 'Vessel Volume',
    startPressure: 'Initial Pressure (P₁)',
    targetPressure: 'Final Pressure (P₂)',
    supplyPressure: 'Supply Pressure (Pₛ)',
    temperature: 'Temperature',
    orificeLength: 'Wall Thickness',
    orificeDiameter: 'Orifice Diameter',
    transferTime: 'Transfer Time',
    gasType: 'Gas Type',
    customGas: 'Custom Gas',
    
    // Gas Properties
    gasProperties: 'Gas Properties',
    molecularWeight: 'Molecular Weight (M)',
    specificGasConstant: 'Specific Gas Constant (R)',
    heatCapacityRatio: 'Heat Capacity Ratio γ = Cp/Cv',
    dynamicViscosity: 'Dynamic Viscosity (μ)',
    gasName: 'Gas Name',
    
    // Advanced Options
    advancedOptions: 'Advanced Options',
    convergenceTolerance: 'Convergence Tolerance (ε)',
    regime: 'Thermodynamic Regime',
    isothermal: 'Isothermal',
    adiabatic: 'Adiabatic',
    dischargeCoefficient: 'Discharge Coefficient (Cd)',
    viscosityOverride: 'Override Viscosity',
    numericTolerance: 'Numeric Tolerance',
    
    // Units
    units: {
      Pa: 'Pa', bar: 'bar', kPa: 'kPa', MPa: 'MPa', psi: 'psi',
      m3: 'm³', liter: 'L', gallon: 'gal',
      kelvin: 'K', celsius: '°C', fahrenheit: '°F',
      m: 'm', mm: 'mm', cm: 'cm', inch: 'in',
      second: 's', minute: 'min', hour: 'h',
    },
    
    // Tooltips
    tooltips: {
      vesselVolume: 'Internal volume of the vessel. Larger = longer to empty/fill.',
      startPressure: 'Absolute pressure at process start. Watch out for leaks!',
      targetPressure: 'Target absolute pressure. Never reach exactly (ε avoids infinity).',
      supplyPressure: 'Supply source pressure. Must be > P₂ for filling.',
      temperature: 'Gas temperature (assumed constant in isothermal). Affects density and viscosity.',
      orificeLength: 'Wall thickness or leak path length. Capillary if L/D ≥ 10.',
      orificeDiameter: 'Hole diameter. Larger = faster (but beware of cavitation!).',
      transferTime: 'Process duration. Short times = high flow rates = risk of non-ideal behavior.',
      epsilon: 'Stop at P_f = P₂·(1±ε) to avoid mathematical infinity. 1% default.',
      dischargeCoefficient: 'Pressure loss coefficient (0.6-0.8 typical). Depends on geometry.',
      molecularWeight: 'Molecular weight in kg/mol. Heavier = slower.',
      specificGasConstant: 'R = 8.314 / M. Calculated automatically.',
      heatCapacityRatio: 'γ = Cp/Cv. Monatomic ≈1.67, diatomic ≈1.4, polyatomic ≈1.3.',
      dynamicViscosity: 'Viscosity at operating temperature. Affects capillary losses.',
    },
    
    // Actions
    calculate: 'Calculate',
    clear: 'Clear',
    copy: 'Copy',
    share: 'Share',
    export: 'Export',
    exportCSV: 'Export CSV',
    exportPDF: 'Export PDF',
    
    // Results
    results: 'Results',
    primaryResult: 'Primary Result',
    modelVerdict: 'Model Verdict',
    diagnostics: 'Diagnostics',
    warnings: 'Warnings',
    noResults: 'No results yet',
    clickCalculate: 'Click Calculate to see results',
    
    // Verdicts & Rationales
    verdicts: {
      capillary: 'Capillary',
      orifice: 'Orifice',
      both: 'Both Models',
      inconclusive: 'Inconclusive',
      
      capillaryValid: 'Capillary: Re={Re}, L/D={LD}. Laminar flow validated.',
      orificeValid: 'Orifice: {flowType}. Compressible model appropriate.',
      bothValid: 'Both models valid. {chosenModel} selected (residual: {residual}%).',
      neitherValid: 'Neither capillary nor orifice perfectly valid. Check your parameters.',
      onlyCapillary: 'Only capillary model converges. {validity}.',
      onlyOrifice: 'Only orifice model converges. {flowType}.',
      
      choked: 'choked until {Pstar} bar',
      subsonic: 'subsonic',
      valid: 'Valid',
      invalid: 'Invalid',
    },
    
    // Physics Explanations
    equations: {
      title: 'Physical Equations',
      capillaryTitle: 'Capillary Model (Poiseuille)',
      orificeTitle: 'Orifice Model (Compressible)',
      assumptions: 'Assumptions',
      capillaryAssumptions: '• Laminar flow (Re ≤ 2000)\n• Capillary geometry (L/D ≥ 10)\n• Isothermal regime\n• Perfect gas',
      orificeAssumptions: '• Compressible flow\n• Thin orifice (L/D < 10)\n• Isentropic expansion\n• Possible choking',
    },
    
    // Safety
    safety: {
      title: 'Safety Warning',
      disclaimer: 'These calculations are provided for guidance only. Pressurized systems present risks. Consult a qualified engineer for critical applications. Always verify experimentally.',
    },
  },
  
  it: {
    // App & Navigation
    appTitle: 'Calcolatore Trasferimento Gas',
    appSubtitle: 'Flusso capillare e orifizio per recipienti rigidi',
    
    // Mode Selection
    process: 'Processo',
    blowdown: 'Svuotamento',
    filling: 'Riempimento',
    solveFor: 'Calcola',
    DfromT: 'D da t',
    TfromD: 't da D',
    
    // Field Labels
    vesselVolume: 'Volume del recipiente',
    startPressure: 'Pressione iniziale (P₁)',
    targetPressure: 'Pressione finale (P₂)',
    supplyPressure: 'Pressione di alimentazione (Pₛ)',
    temperature: 'Temperatura',
    orificeLength: 'Spessore parete',
    orificeDiameter: 'Diametro orifizio',
    transferTime: 'Tempo di trasferimento',
    gasType: 'Tipo di gas',
    customGas: 'Gas personalizzato',
    
    // Gas Properties
    gasProperties: 'Proprietà del gas',
    molecularWeight: 'Peso molecolare (M)',
    specificGasConstant: 'Costante specifica (R)',
    heatCapacityRatio: 'Rapporto γ = Cp/Cv',
    dynamicViscosity: 'Viscosità dinamica (μ)',
    gasName: 'Nome del gas',
    
    // Advanced Options
    advancedOptions: 'Opzioni avanzate',
    convergenceTolerance: 'Tolleranza convergenza (ε)',
    regime: 'Regime termodinamico',
    isothermal: 'Isotermico',
    adiabatic: 'Adiabatico',
    dischargeCoefficient: 'Coefficiente scarico (Cd)',
    viscosityOverride: 'Sovrascrivi viscosità',
    numericTolerance: 'Tolleranza numerica',
    
    // Units
    units: {
      Pa: 'Pa', bar: 'bar', kPa: 'kPa', MPa: 'MPa', psi: 'psi',
      m3: 'm³', liter: 'L', gallon: 'gal',
      kelvin: 'K', celsius: '°C', fahrenheit: '°F',
      m: 'm', mm: 'mm', cm: 'cm', inch: 'in',
      second: 's', minute: 'min', hour: 'h',
    },
    
    // Tooltips
    tooltips: {
      vesselVolume: 'Volume interno del recipiente. Più grande = più tempo per svuotare/riempire.',
      startPressure: 'Pressione assoluta all\'inizio del processo. Attenzione alle perdite!',
      targetPressure: 'Pressione assoluta obiettivo. Mai raggiungere esattamente (ε evita infinito).',
      supplyPressure: 'Pressione della sorgente. Deve essere > P₂ per riempire.',
      temperature: 'Temperatura del gas (supposta costante in isotermico). Influenza densità e viscosità.',
      orificeLength: 'Spessore parete o lunghezza percorso perdita. Capillare se L/D ≥ 10.',
      orificeDiameter: 'Diametro del foro. Più grande = più veloce (ma attenti alla cavitazione!).',
      transferTime: 'Durata del processo. Tempi brevi = alte portate = rischio comportamento non-ideale.',
      epsilon: 'Si ferma a P_f = P₂·(1±ε) per evitare infinito matematico. 1% predefinito.',
      dischargeCoefficient: 'Coefficiente perdita pressione (0.6-0.8 tipico). Dipende dalla geometria.',
      molecularWeight: 'Peso molecolare in kg/mol. Più pesante = più lento.',
      specificGasConstant: 'R = 8.314 / M. Calcolato automaticamente.',
      heatCapacityRatio: 'γ = Cp/Cv. Monoatomico ≈1.67, diatomico ≈1.4, poliatomico ≈1.3.',
      dynamicViscosity: 'Viscosità alla temperatura operativa. Influenza perdite capillari.',
    },
    
    // Actions
    calculate: 'Calcola',
    clear: 'Cancella',
    copy: 'Copia',
    share: 'Condividi',
    export: 'Esporta',
    exportCSV: 'Esporta CSV',
    exportPDF: 'Esporta PDF',
    
    // Results
    results: 'Risultati',
    primaryResult: 'Risultato principale',
    modelVerdict: 'Verdetto del modello',
    diagnostics: 'Diagnostici',
    warnings: 'Avvertimenti',
    noResults: 'Nessun risultato ancora',
    clickCalculate: 'Clicca Calcola per vedere i risultati',
    
    // Verdicts & Rationales
    verdicts: {
      capillary: 'Capillare',
      orifice: 'Orifizio',
      both: 'Entrambi i modelli',
      inconclusive: 'Inconclusivo',
      
      capillaryValid: 'Capillare: Re={Re}, L/D={LD}. Flusso laminare validato.',
      orificeValid: 'Orifizio: {flowType}. Modello comprimibile appropriato.',
      bothValid: 'Entrambi i modelli validi. {chosenModel} selezionato (residuo: {residual}%).',
      neitherValid: 'Né capillare né orifizio perfettamente validi. Controlla i parametri.',
      onlyCapillary: 'Solo modello capillare converge. {validity}.',
      onlyOrifice: 'Solo modello orifizio converge. {flowType}.',
      
      choked: 'strozzato fino a {Pstar} bar',
      subsonic: 'subsonico',
      valid: 'Valido',
      invalid: 'Non valido',
    },
    
    // Physics Explanations
    equations: {
      title: 'Equazioni fisiche',
      capillaryTitle: 'Modello capillare (Poiseuille)',
      orificeTitle: 'Modello orifizio (comprimibile)',
      assumptions: 'Ipotesi',
      capillaryAssumptions: '• Flusso laminare (Re ≤ 2000)\n• Geometria capillare (L/D ≥ 10)\n• Regime isotermico\n• Gas perfetto',
      orificeAssumptions: '• Flusso comprimibile\n• Orifizio sottile (L/D < 10)\n• Espansione isentropica\n• Possibile strozzamento',
    },
    
    // Safety
    safety: {
      title: 'Avvertimento di sicurezza',
      disclaimer: 'Questi calcoli sono forniti solo a scopo indicativo. I sistemi pressurizzati presentano rischi. Consulta un ingegnere qualificato per applicazioni critiche. Verifica sempre sperimentalmente.',
    },
  },
};