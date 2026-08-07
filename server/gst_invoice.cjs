const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { formatINR, toWords } = require('./invoice.cjs');

const LOGO_PATH = path.join(__dirname, '../public/logo/nsl-logo-cropped.png');
const FONT_PATH = path.join(__dirname, 'assets/fonts/DejaVuSans.ttf');
const FONT_BOLD_PATH = path.join(__dirname, 'assets/fonts/DejaVuSans-Bold.ttf');

const CURRENCY = '₹';
const DARK = '#111827';
const GRAY = '#4b5563';
const BG = '#f3f4f6';
const BORDER = '#d1d5db';

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function generateGstInvoice(data) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  doc.registerFont('DV', FONT_PATH);
  doc.registerFont('DVB', FONT_BOLD_PATH);

  const chunks = [];
  doc.on('data', (c) => chunks.push(c));

  const W = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const m = doc.page.margins.left;

  const items = (data.items || []).map((it, i) => ({
    no: i + 1,
    description: it.description || '',
    participants: Number(it.participants) || 1,
    unit_price: Number(it.unit_price) || 0,
    amount: Number(it.amount) || 0,
  }));

  let y = m;

  // ---------- Header band ----------
  doc.rect(0, 0, doc.page.width, 118).fill(BG);
  if (fs.existsSync(LOGO_PATH)) {
    doc.image(LOGO_PATH, m, 26, { fit: [110, 40], align: 'left' });
  }
  doc.font('DVB').fontSize(16).fillColor(DARK).text(data.entity_name || 'NeoSkills', m + 125, 22);
  doc.font('DV').fontSize(8).fillColor(GRAY);
  doc.text(data.supplier_address || '', m + 125, 46, { width: W - 170, lineGap: 2 });
  doc.font('DVB').fontSize(9.5).fillColor(DARK).text('TAX INVOICE', doc.page.width - m - 180, 22, { width: 180, align: 'right' });

  y = 130;

  // ---------- Meta row ----------
  doc.font('DV').fontSize(9).fillColor(GRAY).text(`Invoice Date: ${fmtDate(data.invoice_date)}`, m, y);
  doc.text(`Reference: ${data.reference || ''}`, m, y + 14);
  doc.font('DVB').fontSize(9.5).fillColor(DARK).text(`Invoice No.: ${data.invoice_number || ''}`, doc.page.width - m - 230, y, { width: 230, align: 'right' });

  y += 42;
  doc.moveTo(m, y).lineTo(m + W, y).strokeColor(BORDER).lineWidth(1).stroke();

  // ---------- Billed To ----------
  y += 12;
  doc.font('DVB').fontSize(9).fillColor(DARK).text('BILLED TO', m, y);
  doc.font('DV').fontSize(9).fillColor(GRAY).text(`GST Number: ${data.supplier_gstin || ''}`, m, y + 4, { width: W, align: 'right' });
  doc.font('DVB').fontSize(10).fillColor(DARK).text(data.student_name || '', m, y + 14);

  const rows = [
    ['Company:', data.company],
    ['Location:', data.location],
    ['City / State:', data.state ? `${data.city || ''}, ${data.state}` : data.city],
    ['GSTN Number:', data.customer_gstin],
  ];
  let rowY = y + 14 + 16;
  for (const [lab, val] of rows) {
    doc.font('DV').fontSize(9).fillColor(GRAY).text(lab, m, rowY, { width: 110 });
    doc.font('DVB').fontSize(9).fillColor(DARK).text(val || '', m + 110, rowY, { width: W - 150 });
    rowY += 14;
  }
  y = rowY + 16;

  // ---------- Line items table ----------
  const col = {
    no: m + 8,
    desc: m + 34,
    units: m + W - 260,
    price: m + W - 165,
    amt: m + W - 72,
  };
  doc.rect(m, y, W, 24).fill(DARK);
  doc.fillColor('#ffffff').font('DVB').fontSize(8);
  doc.text('Sr.No', col.no, y + 8, { width: 24 });
  doc.text('DESCRIPTION', col.desc, y + 8);
  doc.text('NO. OF PARTICIPANTS', col.units, y + 8, { width: 90, align: 'right' });
  doc.text('UNIT PRICE (₹)', col.price, y + 8, { width: 90, align: 'right' });
  doc.text('AMOUNT (₹)', col.amt, y + 8, { width: 70, align: 'right' });
  y += 24;

  items.forEach((it, idx) => {
    const rh = 32;
    if (idx % 2 === 0) doc.rect(m, y, W, rh).fill('#fafafa');
    doc.fillColor(DARK).font('DVB').fontSize(8.5).text(String(it.no), col.no, y + 12, { width: 24 });
    doc.font('DV').fontSize(8.5).text(it.description, col.desc, y + 12, { width: col.units - col.desc - 6 });
    doc.text(String(it.participants), col.units, y + 12, { width: 90, align: 'right' });
    doc.text(CURRENCY + formatINR(it.unit_price), col.price, y + 12, { width: 90, align: 'right' });
    doc.font('DVB').text(CURRENCY + formatINR(it.amount), col.amt, y + 12, { width: 70, align: 'right' });
    y += rh;
  });
  doc.moveTo(m, y).lineTo(m + W, y).strokeColor(BORDER).lineWidth(1).stroke();
  y += 12;

  // ---------- Summary ----------
  const sx = m + W - 240;
  const vx = m + W - 96;
  const line = (label, value) => {
    doc.font('DV').fontSize(9).fillColor(GRAY).text(label, sx, y, { width: 130 });
    doc.font('DVB').fontSize(9).fillColor(DARK).text(value, vx, y, { width: 90, align: 'right' });
    y += 16;
  };

  line('Sub-Total', CURRENCY + formatINR(data.subtotal || 0));
  if (data.gst_type === 'cgst_sgst') {
    line(`C.G.S.T (${data.cgst_rate}%)`, CURRENCY + formatINR(data.cgst || 0));
    line(`S.G.S.T (${data.sgst_rate}%)`, CURRENCY + formatINR(data.sgst || 0));
  } else if (data.gst_type === 'igst') {
    line(`I.G.S.T (${data.igst_rate}%)`, CURRENCY + formatINR(data.igst || 0));
  } else {
    line('I.G.S.T (0%) — Export / Zero Rated', CURRENCY + formatINR(0));
  }

  doc.font('DVB').fontSize(11).fillColor(DARK).text('Total', sx, y, { width: 130 });
  doc.text(CURRENCY + formatINR(data.total_amount || 0), vx, y, { width: 90, align: 'right' });
  y += 24;

  const ro = Number(data.round_off) || 0;
  doc.font('DV').fontSize(7.5).fillColor(GRAY).text(
    `Round Off: ${ro > 0 ? '+' : ''}${CURRENCY}${formatINR(ro)}`,
    sx, y - 20, { width: 150, align: 'left' }
  );

  // ---------- Amount in words ----------
  doc.font('DVB').fontSize(8).fillColor(DARK).text(`Total Cost In Words (${CURRENCY}):`, m, y + 4);
  doc.font('DV').fontSize(8).fillColor(GRAY).text(toWords(data.total_amount || 0), m, y + 16, { width: W - 210, lineGap: 2 });
  y += 42;

  // ---------- For / Bank details + POC ----------
  doc.moveTo(m, y).lineTo(m + W, y).strokeColor(BORDER).lineWidth(1).stroke();
  y += 10;
  doc.font('DVB').fontSize(9).fillColor(DARK).text('For', m, y);
  doc.moveTo(m + 30, y + 4).lineTo(m + 106, y + 4).strokeColor(BORDER).lineWidth(1).stroke();
  doc.font('DV').fontSize(8.5).fillColor(GRAY);
  const bank = [
    `Account Name: ${data.bank_account_name || ''}`,
    `Account No.: ${data.bank_account_number || ''}`,
    `IFSC Code: ${data.bank_ifsc || ''}`,
    `Type: ${data.bank_account_type || ''}`,
  ];
  bank.forEach((line2, i) => doc.text(line2, m, y + 12 + i * 12));
  if (data.poc) doc.font('DVB').fontSize(10).fillColor(DARK).text(data.poc, m + W - 120, y + 12, { width: 120, align: 'right' });
  y += 12 + bank.length * 12 + 10;

  // ---------- Footer line ----------
  doc.moveTo(m, y).lineTo(m + W, y).strokeColor(BORDER).lineWidth(1).stroke();
  y += 8;
  doc.font('DVB').fontSize(8).fillColor(DARK).text(data.entity_name || 'NeoSkills', m, y);
  doc.font('DV').fontSize(8).fillColor(GRAY);
  doc.text(`${data.phone || ''}`, m, y + 10);
  doc.text(`GST Number ${data.supplier_gstin || ''}   Invoice Subject ${data.jurisdiction || ''}   Pan Card Number: ${data.pan || ''}`, m, y + 20);
  doc.text(`HSN/SAC: ${data.sac || ''}${data.sac_description ? `: ${data.sac_description}` : ''}`, m, y + 30);
  y += 46;

  // ---------- Terms & Compliance ----------
  const termsTop = Math.min(y + 6, doc.page.height - 170);
  doc.font('DVB').fontSize(8.5).fillColor(DARK).text('TERMS & COMPLIANCE', m, termsTop);
  const terms = Array.isArray(data.terms) ? data.terms : data.terms ? JSON.parse(data.terms) : [];
  terms.forEach((t, i) => {
    doc.font('DV').fontSize(7.5).fillColor(GRAY).text(`${i + 1}. ${t}`, m, termsTop + 14 + i * 12, { width: W - 200, lineGap: 2 });
  });

  doc.end();
  return new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

module.exports = { generateGstInvoice };