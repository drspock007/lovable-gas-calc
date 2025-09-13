import { ComputeOutputs, ComputeInputs } from './physics';
import { useI18n } from '@/i18n/context';

export interface ExportData {
  timestamp: string;
  inputs: ComputeInputs;
  outputs: ComputeOutputs;
  metadata: {
    language: string;
    version: string;
    url: string;
  };
}

/**
 * Export calculation results to CSV format
 */
export const exportToCSV = (
  inputs: ComputeInputs,
  outputs: ComputeOutputs,
  language: string
): void => {
  const timestamp = new Date().toISOString();
  
  // Prepare data rows
  const headers = [
    'Timestamp',
    'Process', 
    'SolveFor',
    'Volume_m3',
    'P1_Pa',
    'P2_Pa', 
    'Ps_Pa',
    'Temperature_K',
    'Length_m',
    'Diameter_m',
    'Time_s',
    'Gas_Name',
    'Gas_M',
    'Gas_R', 
    'Gas_gamma',
    'Gas_mu',
    'Cd',
    'Epsilon',
    'Regime',
    'Result_D_m',
    'Result_t_s',
    'Verdict',
    'Re',
    'LD_Ratio',
    'Mach',
    'Choked',
    'P_transition_Pa',
    't_sonic_s',
    't_subsonic_s',
    'Rationale',
    'Warnings_Count',
    'Language'
  ];
  
  const row = [
    timestamp,
    inputs.process,
    inputs.solveFor,
    inputs.V,
    inputs.P1,
    inputs.P2,
    inputs.Ps || '',
    inputs.T,
    inputs.L,
    inputs.D || '',
    inputs.t || '',
    inputs.gas.name,
    inputs.gas.M,
    inputs.gas.R,
    inputs.gas.gamma,
    inputs.gas.mu,
    inputs.Cd || 0.62,
    inputs.epsilon || 0.01,
    inputs.regime || 'isothermal',
    outputs.D || '',
    outputs.t || '',
    outputs.verdict,
    outputs.diagnostics.Re || '',
    outputs.diagnostics['L/D'] || '',
    outputs.diagnostics.Mach || '',
    outputs.diagnostics.choked || '',
    outputs.diagnostics.P_transition || '',
    outputs.diagnostics.t_sonic || '',
    outputs.diagnostics.t_subsonic || '',
    outputs.diagnostics.rationale || '',
    outputs.warnings.length,
    language
  ];
  
  // Convert to CSV
  const csvContent = [
    headers.join(','),
    row.map(val => {
      // Escape commas and quotes in string values
      if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(',')
  ].join('\n');
  
  // Download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `gas-transfer-${timestamp.split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

/**
 * Export calculation results to PDF format
 */
export const exportToPDF = async (
  inputs: ComputeInputs,
  outputs: ComputeOutputs,
  language: string
): Promise<void> => {
  // Dynamic import to reduce bundle size
  const { jsPDF } = await import('jspdf');
  
  const doc = new jsPDF();
  const timestamp = new Date().toISOString();
  
  // Title based on language
  const titles = {
    fr: 'Calcul de Transfert de Gaz',
    en: 'Gas Transfer Calculation',
    it: 'Calcolo Trasferimento Gas'
  };
  
  const title = titles[language as keyof typeof titles] || titles.en;
  
  // PDF Content
  let yPosition = 20;
  const lineHeight = 7;
  const leftMargin = 20;
  
  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, leftMargin, yPosition);
  yPosition += lineHeight * 1.5;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date(timestamp).toLocaleString()}`, leftMargin, yPosition);
  yPosition += lineHeight * 2;
  
  // Inputs Section
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Input Parameters', leftMargin, yPosition);
  yPosition += lineHeight;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const inputLines = [
    `Process: ${inputs.process}`,
    `Solve For: ${inputs.solveFor}`,
    `Volume: ${inputs.V} m³`,
    `Initial Pressure: ${inputs.P1} Pa`,
    `Final Pressure: ${inputs.P2} Pa`,
    inputs.Ps ? `Supply Pressure: ${inputs.Ps} Pa` : null,
    `Temperature: ${inputs.T} K`,
    `Length: ${inputs.L} m`,
    inputs.D ? `Diameter: ${inputs.D} m` : null,
    inputs.t ? `Time: ${inputs.t} s` : null,
    `Gas: ${inputs.gas.name} (M=${inputs.gas.M}, γ=${inputs.gas.gamma})`,
    `Discharge Coefficient: ${inputs.Cd || 0.62}`,
    `Convergence Tolerance: ${inputs.epsilon || 0.01}`,
    `Regime: ${inputs.regime || 'isothermal'}`
  ].filter(Boolean);
  
  inputLines.forEach(line => {
    doc.text(line!, leftMargin, yPosition);
    yPosition += lineHeight;
  });
  
  yPosition += lineHeight;
  
  // Results Section
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Results', leftMargin, yPosition);
  yPosition += lineHeight;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const resultLines = [
    `Model Verdict: ${outputs.verdict}`,
    outputs.D ? `Calculated Diameter: ${outputs.D.toExponential(3)} m` : null,
    outputs.t ? `Calculated Time: ${outputs.t.toFixed(1)} s` : null,
    outputs.diagnostics.rationale ? `Rationale: ${outputs.diagnostics.rationale}` : null
  ].filter(Boolean);
  
  resultLines.forEach(line => {
    doc.text(line!, leftMargin, yPosition);
    yPosition += lineHeight;
  });
  
  yPosition += lineHeight;
  
  // Diagnostics Section
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Diagnostics', leftMargin, yPosition);
  yPosition += lineHeight;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const diagnosticLines = [
    outputs.diagnostics.Re ? `Reynolds Number: ${(outputs.diagnostics.Re as number).toFixed(0)}` : null,
    outputs.diagnostics['L/D'] ? `L/D Ratio: ${(outputs.diagnostics['L/D'] as number).toFixed(1)}` : null,
    outputs.diagnostics.Mach ? `Mach Number: ${(outputs.diagnostics.Mach as number).toFixed(3)}` : null,
    outputs.diagnostics.choked !== undefined ? `Choked Flow: ${outputs.diagnostics.choked ? 'Yes' : 'No'}` : null,
    outputs.diagnostics.P_transition ? `Transition Pressure: ${(outputs.diagnostics.P_transition as number).toFixed(0)} Pa` : null
  ].filter(Boolean);
  
  diagnosticLines.forEach(line => {
    doc.text(line!, leftMargin, yPosition);
    yPosition += lineHeight;
  });
  
  // Warnings Section
  if (outputs.warnings.length > 0) {
    yPosition += lineHeight;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Warnings', leftMargin, yPosition);
    yPosition += lineHeight;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    outputs.warnings.forEach(warning => {
      doc.text(`• ${warning}`, leftMargin, yPosition);
      yPosition += lineHeight;
    });
  }
  
  // Footer
  yPosition = 280;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text('Generated by Gas Transfer Calculator - Lovable', leftMargin, yPosition);
  
  // Save the PDF
  doc.save(`gas-transfer-${timestamp.split('T')[0]}.pdf`);
};

/**
 * Serialize inputs to URL parameters for sharing
 */
export const serializeInputsToURL = (inputs: ComputeInputs): string => {
  const params = new URLSearchParams();
  
  // Core parameters
  params.set('process', inputs.process);
  params.set('solveFor', inputs.solveFor);
  params.set('V', inputs.V.toString());
  params.set('P1', inputs.P1.toString());
  params.set('P2', inputs.P2.toString());
  params.set('T', inputs.T.toString());
  params.set('L', inputs.L.toString());
  
  // Optional parameters
  if (inputs.Ps) params.set('Ps', inputs.Ps.toString());
  if (inputs.D) params.set('D', inputs.D.toString());
  if (inputs.t) params.set('t', inputs.t.toString());
  if (inputs.Cd) params.set('Cd', inputs.Cd.toString());
  if (inputs.epsilon) params.set('epsilon', inputs.epsilon.toString());
  if (inputs.regime) params.set('regime', inputs.regime);
  
  // Gas properties (use known gas names or serialize custom)
  const knownGases = ['air', 'N2', 'O2', 'CH4', 'CO2', 'He'];
  const gasName = knownGases.find(name => 
    inputs.gas.name.toLowerCase().includes(name.toLowerCase())
  );
  
  if (gasName) {
    params.set('gas', gasName);
  } else {
    // Custom gas - serialize properties
    params.set('gas', 'custom');
    params.set('gasName', inputs.gas.name);
    params.set('gasM', inputs.gas.M.toString());
    params.set('gasGamma', inputs.gas.gamma.toString());
    params.set('gasMu', inputs.gas.mu.toString());
  }
  
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
};

/**
 * Deserialize URL parameters to inputs
 */
export const deserializeInputsFromURL = (): Partial<ComputeInputs> | null => {
  const params = new URLSearchParams(window.location.search);
  
  if (!params.has('process') || !params.has('solveFor')) {
    return null; // Not a shared calculation
  }
  
  try {
    const inputs: Partial<ComputeInputs> = {
      process: params.get('process') as 'blowdown' | 'filling',
      solveFor: params.get('solveFor') as 'DfromT' | 'TfromD',
      V: parseFloat(params.get('V') || '0'),
      P1: parseFloat(params.get('P1') || '0'),
      P2: parseFloat(params.get('P2') || '0'),
      T: parseFloat(params.get('T') || '0'),
      L: parseFloat(params.get('L') || '0'),
    };
    
    // Optional parameters
    if (params.has('Ps')) inputs.Ps = parseFloat(params.get('Ps')!);
    if (params.has('D')) inputs.D = parseFloat(params.get('D')!);
    if (params.has('t')) inputs.t = parseFloat(params.get('t')!);
    if (params.has('Cd')) inputs.Cd = parseFloat(params.get('Cd')!);
    if (params.has('epsilon')) inputs.epsilon = parseFloat(params.get('epsilon')!);
    if (params.has('regime')) inputs.regime = params.get('regime') as 'isothermal' | 'adiabatic';
    
    // Gas handling
    const gasType = params.get('gas');
    if (gasType === 'custom') {
      inputs.gas = {
        name: params.get('gasName') || 'Custom Gas',
        M: parseFloat(params.get('gasM') || '0'),
        R: 8.314462618 / parseFloat(params.get('gasM') || '1'),
        gamma: parseFloat(params.get('gasGamma') || '1.4'),
        mu: parseFloat(params.get('gasMu') || '18.1e-6'),
      };
    }
    // For known gases, we'll let the component handle it
    
    return inputs;
  } catch (error) {
    console.warn('Failed to deserialize inputs from URL:', error);
    return null;
  }
};

/**
 * Share calculation via Web Share API or clipboard
 */
export const shareCalculation = async (
  inputs: ComputeInputs,
  t: (key: string) => string
): Promise<void> => {
  const shareUrl = serializeInputsToURL(inputs);
  const shareData = {
    title: t('appTitle'),
    text: t('appSubtitle'),
    url: shareUrl,
  };
  
  try {
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      await navigator.share(shareData);
    } else {
      // Fallback to clipboard
      await navigator.clipboard.writeText(shareUrl);
      return; // Will be handled by calling component for toast
    }
  } catch (error) {
    // Fallback to clipboard if sharing fails
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch (clipboardError) {
      throw new Error('Sharing and clipboard both failed');
    }
  }
};