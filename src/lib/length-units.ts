export type LengthUnit = 'm'|'mm'|'cm';
const LEN_TO_SI: Record<LengthUnit, number> = { m:1, cm:1e-2, mm:1e-3 };
export const LENGTH_LABEL: Record<LengthUnit,string> = { m:'m', cm:'cm', mm:'mm' };
export function toSI_Length(v:number,u:LengthUnit){return v*LEN_TO_SI[u];}
export function fromSI_Length(vSI:number,u:LengthUnit){return vSI/LEN_TO_SI[u];}

// A single **formatter** to avoid UI drift
export function formatLength(vSI:number,u:LengthUnit, sig=3){
const v = fromSI_Length(vSI,u);
return Number.isFinite(v) ? Number(v.toPrecision(sig)) : NaN;
}