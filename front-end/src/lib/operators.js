// Single source of truth for toll operators: code, English name and a STABLE
// colour used identically across Overview, Analytics, Map and Forecast.
export const OPERATORS = [
  { code: 'AM', label: 'Meridian Motorways', color: '#13315c' },
  { code: 'EG', label: 'Northern Corridor', color: '#12a5b8' },
  { code: 'GE', label: 'Gulf Crossing', color: '#7c4dff' },
  { code: 'KO', label: 'Central Routes', color: '#2f9e44' },
  { code: 'MO', label: 'Southern Link', color: '#ad6800' },
  { code: 'NAO', label: 'Metro Ring', color: '#0b7285' },
  { code: 'NO', label: 'Eastern Roads', color: '#e5484d' },
  { code: 'OO', label: 'Western Corridor', color: '#f2a900' },
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
