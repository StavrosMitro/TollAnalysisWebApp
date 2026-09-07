// Single source of truth for toll operators: code, English name and a STABLE
// colour used identically across Overview, Analytics, Map and Forecast.
export const OPERATORS = [
  { code: 'AM', label: 'Aegean Motorway', color: '#13315c' },
  { code: 'EG', label: 'Egnatia Odos', color: '#12a5b8' },
  { code: 'GE', label: 'Gefyra', color: '#7c4dff' },
  { code: 'KO', label: 'Kentriki Odos', color: '#2f9e44' },
  { code: 'MO', label: 'Moreas', color: '#ad6800' },
  { code: 'NAO', label: 'Naodos', color: '#0b7285' },
  { code: 'NO', label: 'Nea Odos', color: '#e5484d' },
  { code: 'OO', label: 'Olympia Odos', color: '#f2a900' },
];

export const OP_LABEL = Object.fromEntries(OPERATORS.map((o) => [o.code, o.label]));
export const OP_COLOR = Object.fromEntries(OPERATORS.map((o) => [o.code, o.color]));

export const operatorName = (code) => OP_LABEL[code] || code;
export const operatorColor = (code) => OP_COLOR[code] || 'var(--chart-axis)';

// Operator code from a toll id / station id (prefix), e.g. "NAO12" -> "NAO".
export const operatorOf = (value) => {
  const m = /^[A-Za-z]+/.exec(String(value || ''));
  return m ? m[0].toUpperCase() : '';
};
