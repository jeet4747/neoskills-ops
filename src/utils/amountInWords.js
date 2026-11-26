const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const UNITS = { INR: 'Rupees', USD: 'Dollars', EUR: 'Euros', GBP: 'Pounds' };

function below100(n) {
  if (n < 20) return ONES[n] || '';
  return [TENS[Math.floor(n / 10)], ONES[n % 10]].filter(Boolean).join(' ');
}

function below1000(n) {
  const parts = [];
  if (n >= 100) parts.push(`${below100(Math.floor(n / 100))} Hundred`);
  if (n % 100) parts.push(below100(n % 100));
  return parts.filter(Boolean).join(' ');
}

function indianWords(n) {
  n = Math.floor(n);
  if (!n) return 'Zero';
  const scales = [['Crore', 10000000], ['Lakh', 100000], ['Thousand', 1000], ['', 1]];
  const out = [];
  for (const [name, value] of scales) {
    const q = Math.floor(n / value);
    if (q) out.push(`${below1000(q)}${name ? ` ${name}` : ''}`);
    n %= value;
  }
  return out.join(' ');
}

export function amountInWords(value, currency = 'INR') {
  const n = Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  const whole = Math.floor(Math.abs(n));
  const paise = Math.round((Math.abs(n) - whole) * 100);
  const unit = UNITS[currency] || 'Units';
  const fraction = paise ? ` and ${below100(paise)} Paise` : '';
  return `${indianWords(whole)} ${unit}${fraction} Only`;
}
