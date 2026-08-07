const { toWords } = require('./invoice.cjs');

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function toD(n) {
  return Number(n) || 0;
}

// Given a GST-inclusive collected amount, back out taxable value and GST.
function splitInclusive(totalIncl, rate) {
  rate = toD(rate) || 18;
  const taxable = round2(toD(totalIncl) / (1 + rate / 100));
  const gst = round2(toD(totalIncl) - taxable);
  return { taxable, gst };
}

// Build the authoritative GST breakdown for a taxable amount.
//  - exportBill (state code '99' / outside India): zero-rated, no tax
//  - sameState (customer state == supplier state): CGST + SGST (rate split in half)
//  - otherwise: IGST at full rate
function buildGst({ taxable = 0, rate = 18, sameState = false, exportBill = false, inclusiveTotal = null }) {
  rate = toD(rate) || 18;
  let taxableV = round2(taxable);
  let gst = 0;

  if (inclusiveTotal != null && inclusiveTotal !== '') {
    const sp = splitInclusive(inclusiveTotal, rate);
    taxableV = sp.taxable;
    gst = sp.gst;
  } else if (!exportBill) {
    gst = round2(taxableV * (rate / 100));
  }

  const result = { rate, taxable: taxableV, cgstRate: 0, cgst: 0, sgstRate: 0, sgst: 0, igstRate: 0, igst: 0 };

  if (exportBill) {
    result.gst_type = 'zero';
  } else if (sameState) {
    const cgst = round2(gst / 2);
    const sgst = round2(gst - cgst);
    result.cgstRate = round2(rate / 2);
    result.cgst = cgst;
    result.sgstRate = round2(rate / 2);
    result.sgst = sgst;
    result.gst = gst;
    result.gst_type = 'cgst_sgst';
  } else {
    result.igstRate = rate;
    result.igst = gst;
    result.gst = gst;
    result.gst_type = 'igst';
  }

  const subtotal = round2(result.taxable);
  const sum = round2(subtotal + result.cgst + result.sgst + result.igst);
  const rounded = Math.round(sum);
  const roundOff = round2(rounded - sum);

  result.subtotal = subtotal;
  result.total_before_round = sum;
  result.round_off = roundOff;
  result.total = rounded;
  return result;
}

// Convert calendar date to Indian financial year label (e.g. "26-27" for Apr 2026 - Mar 2027)
function fiscalYearParts(date = new Date()) {
  const d = date ? new Date(date) : new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1; // 1-12
  const start = m >= 4 ? y : y - 1;
  return {
    start,
    shortStart: String(start).slice(2),
    shortEnd: String(start + 1).slice(2),
    label: `${String(start).slice(2)}-${String(start + 1).slice(2)}`,
  };
}

module.exports = { round2, splitInclusive, buildGst, fiscalYearParts, toWords };