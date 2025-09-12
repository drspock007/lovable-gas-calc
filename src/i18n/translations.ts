export interface Translation {
  common: {
    calculate: string;
    clear: string;
    export: string;
    mode: string;
    inputs: string;
    results: string;
    explanation: string;
    units: string;
    value: string;
    error: string;
    required: string;
  };
  calculator: {
    title: string;
    subtitle: string;
    modes: {
      calculateDiameter: string;
      calculateTime: string;
    };
    inputs: {
      pressure1: string;
      pressure2: string;
      volume: string;
      temperature: string;
      molecularWeight: string;
      time: string;
      diameter: string;
      gasType: string;
    };
    units: {
      bar: string;
      psi: string;
      pa: string;
      liter: string;
      m3: string;
      ft3: string;
      celsius: string;
      kelvin: string;
      fahrenheit: string;
      mm: string;
      inch: string;
      second: string;
      minute: string;
      hour: string;
    };
    results: {
      calculatedDiameter: string;
      calculatedTime: string;
      massFlowRate: string;
      explanation: string;
    };
    errors: {
      invalidPressure: string;
      invalidVolume: string;
      invalidTemperature: string;
      invalidMolecularWeight: string;
      calculationError: string;
    };
  };
}

export const translations: Record<string, Translation> = {
  en: {
    common: {
      calculate: "Calculate",
      clear: "Clear",
      export: "Export",
      mode: "Mode",
      inputs: "Inputs",
      results: "Results",
      explanation: "Explanation",
      units: "Units",
      value: "Value",
      error: "Error",
      required: "Required",
    },
    calculator: {
      title: "Gas Transfer Calculator",
      subtitle: "Calculate orifice diameter or transfer time for gas in rigid vessels",
      modes: {
        calculateDiameter: "Calculate Orifice Diameter",
        calculateTime: "Calculate Transfer Time",
      },
      inputs: {
        pressure1: "Initial Pressure",
        pressure2: "Final Pressure", 
        volume: "Vessel Volume",
        temperature: "Temperature",
        molecularWeight: "Molecular Weight",
        time: "Transfer Time",
        diameter: "Orifice Diameter",
        gasType: "Gas Type",
      },
      units: {
        bar: "bar",
        psi: "psi",
        pa: "Pa",
        liter: "L",
        m3: "m³",
        ft3: "ft³",
        celsius: "°C",
        kelvin: "K",
        fahrenheit: "°F",
        mm: "mm",
        inch: "in",
        second: "s",
        minute: "min",
        hour: "h",
      },
      results: {
        calculatedDiameter: "Required Orifice Diameter",
        calculatedTime: "Transfer Time",
        massFlowRate: "Mass Flow Rate",
        explanation: "The calculation is based on choked flow through an orifice.",
      },
      errors: {
        invalidPressure: "Pressure must be positive",
        invalidVolume: "Volume must be positive",
        invalidTemperature: "Temperature must be above absolute zero",
        invalidMolecularWeight: "Molecular weight must be positive",
        calculationError: "Calculation failed. Please check your inputs.",
      },
    },
  },
  fr: {
    common: {
      calculate: "Calculer",
      clear: "Effacer",
      export: "Exporter",
      mode: "Mode",
      inputs: "Entrées",
      results: "Résultats",
      explanation: "Explication",
      units: "Unités",
      value: "Valeur",
      error: "Erreur",
      required: "Requis",
    },
    calculator: {
      title: "Calculateur de Transfert de Gaz",
      subtitle: "Calculer le diamètre d'orifice ou le temps de transfert pour gaz dans réservoirs rigides",
      modes: {
        calculateDiameter: "Calculer le Diamètre d'Orifice",
        calculateTime: "Calculer le Temps de Transfert",
      },
      inputs: {
        pressure1: "Pression Initiale",
        pressure2: "Pression Finale",
        volume: "Volume du Réservoir",
        temperature: "Température",
        molecularWeight: "Masse Moléculaire",
        time: "Temps de Transfert",
        diameter: "Diamètre d'Orifice",
        gasType: "Type de Gaz",
      },
      units: {
        bar: "bar",
        psi: "psi",
        pa: "Pa",
        liter: "L",
        m3: "m³",
        ft3: "ft³",
        celsius: "°C",
        kelvin: "K",
        fahrenheit: "°F",
        mm: "mm",
        inch: "po",
        second: "s",
        minute: "min",
        hour: "h",
      },
      results: {
        calculatedDiameter: "Diamètre d'Orifice Requis",
        calculatedTime: "Temps de Transfert",
        massFlowRate: "Débit Massique",
        explanation: "Le calcul est basé sur l'écoulement bloqué à travers un orifice.",
      },
      errors: {
        invalidPressure: "La pression doit être positive",
        invalidVolume: "Le volume doit être positif",
        invalidTemperature: "La température doit être au-dessus du zéro absolu",
        invalidMolecularWeight: "La masse moléculaire doit être positive",
        calculationError: "Échec du calcul. Veuillez vérifier vos entrées.",
      },
    },
  },
  it: {
    common: {
      calculate: "Calcola",
      clear: "Cancella",
      export: "Esporta",
      mode: "Modalità",
      inputs: "Input",
      results: "Risultati",
      explanation: "Spiegazione",
      units: "Unità",
      value: "Valore",
      error: "Errore",
      required: "Richiesto",
    },
    calculator: {
      title: "Calcolatore Trasferimento Gas",
      subtitle: "Calcola diametro orifizio o tempo di trasferimento per gas in recipienti rigidi",
      modes: {
        calculateDiameter: "Calcola Diametro Orifizio",
        calculateTime: "Calcola Tempo di Trasferimento",
      },
      inputs: {
        pressure1: "Pressione Iniziale",
        pressure2: "Pressione Finale",
        volume: "Volume Recipiente",
        temperature: "Temperatura",
        molecularWeight: "Peso Molecolare",
        time: "Tempo di Trasferimento",
        diameter: "Diametro Orifizio",
        gasType: "Tipo di Gas",
      },
      units: {
        bar: "bar",
        psi: "psi",
        pa: "Pa",
        liter: "L",
        m3: "m³",
        ft3: "ft³",
        celsius: "°C",
        kelvin: "K",
        fahrenheit: "°F",
        mm: "mm",
        inch: "in",
        second: "s",
        minute: "min",
        hour: "h",
      },
      results: {
        calculatedDiameter: "Diametro Orifizio Richiesto",
        calculatedTime: "Tempo di Trasferimento",
        massFlowRate: "Portata Massica",
        explanation: "Il calcolo si basa sul flusso bloccato attraverso un orifizio.",
      },
      errors: {
        invalidPressure: "La pressione deve essere positiva",
        invalidVolume: "Il volume deve essere positivo",
        invalidTemperature: "La temperatura deve essere sopra lo zero assoluto",
        invalidMolecularWeight: "Il peso molecolare deve essere positivo",
        calculationError: "Calcolo fallito. Controlla i tuoi input.",
      },
    },
  },
};