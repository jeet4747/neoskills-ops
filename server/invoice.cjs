const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const LOGO_PATH = path.join(__dirname, '../public/logo/nsl-logo-cropped.png');
const STAMP_PATH = path.join(__dirname, 'assets/stamp.png');
const FONT_PATH = path.join(__dirname, 'assets/fonts/DejaVuSans.ttf');
const FONT_BOLD_PATH = path.join(__dirname, 'assets/fonts/DejaVuSans-Bold.ttf');
const { getBrand } = require('./brands.cjs');

const DEFAULT_BRAND = {
  ...getBrand('neoskills'),
  tagline: 'NeoOps — Sales Command Center',
};

const CURRENCY = '₹';

const PAYMENT_MODE_LABELS = {
  cash: 'Cash',
  upi: 'UPI',
  bank: 'Bank Transfer',
  card: 'Card',
  cheque: 'Cheque',
  other: 'Other',
};

function toWords(num) {
  num = Math.round(Number(num) || 0);
  if (num === 0) return 'Zero Rupees Only';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (n) => (n < 20 ? a[n] : b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : ''));
  const three = (n) => (n < 100 ? two(n) : a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + two(n % 100) : ''));

  let words = '';
  if (num >= 10000000) { words += three(Math.floor(num / 10000000)) + ' Crore '; num %= 10000000; }
  if (num >= 100000) { words += three(Math.floor(num / 100000)) + ' Lakh '; num %= 100000; }
  if (num >= 1000) { words += three(Math.floor(num / 1000)) + ' Thousand '; num %= 1000; }
  if (num > 0) words += three(num);
  return words.trim() + ' Rupees Only';
}

function formatINR(n) {
  const value = Number(n) || 0;
  const s = value.toFixed(2);
  const parts = s.split('.');
  let int = parts[0];
  let lastThree = int.substring(int.length - 3);
  const other = int.substring(0, int.length - 3);
  if (other !== '') lastThree = ',' + lastThree;
  return other.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree + '.' + parts[1];
}

function generateInvoice(data) {
  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
  doc.registerFont('DejaVu', FONT_PATH);
  doc.registerFont('DejaVu-Bold', FONT_BOLD_PATH);
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));

  const brand = { ...getBrand(data.company), ...(data.brand || {}) };
  const W = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const margin = doc.page.margins.left;
  const dark = '#111827';
  const midGray = '#4b5563';
  const lightGray = '#f3f4f6';
  const borderGray = '#d1d5db';
  const positive = '#047857';
  const warning = '#b45309';

  const items = (data.items || []).map((it) => ({
    description: it.description || data.course_name || 'Course Fee',
    qty: Number(it.qty) || 1,
    rate: Number(it.rate) || 0,
    amount: Number(it.amount) || 0,
  }));
  if (!items.length) {
    items.push({ description: data.course_name || 'Course Fee', qty: 1, rate: Number(data.total_amount) || 0, amount: Number(data.total_amount) || 0 });
  }

  const subtotal = data.subtotal != null ? Number(data.subtotal) : items.reduce((s, i) => s + i.amount, 0);
  const discount = Number(data.discount) || 0;
  const taxRate = Number(data.tax_rate) || 0;
  const taxAmount = data.tax_amount != null ? Number(data.tax_amount) : ((subtotal - discount) * taxRate) / 100;
  const totalAmount = Number(data.total_amount) != null && data.total_amount !== '' ? Number(data.total_amount) : (subtotal - discount + taxAmount);
  const receivedAmount = Number(data.received_amount) || 0;
  const balanceAmount = data.balance_amount != null ? Number(data.balance_amount) : Math.max(0, totalAmount - receivedAmount);

  let y = margin;

  // ---------- Header band ----------
  doc.rect(0, 0, doc.page.width, 96).fill(lightGray);

  if (fs.existsSync(LOGO_PATH)) {
    doc.image(LOGO_PATH, margin, y + 30, { fit: [115, 40], align: 'left' });
  }

  const brandX = margin + 130;
  doc.fillColor(dark).font('DejaVu-Bold').fontSize(16).text(brand.name, brandX, y + 16);
  doc.font('DejaVu').fontSize(8).fillColor(midGray);
  doc.text(brand.address, brandX, y + 36, { width: W - 140, lineGap: 2 });
  doc.text(`Mobile: ${brand.phone}    PAN Number: ${brand.pan}`, { lineGap: 2 });
  doc.text(`Email: ${brand.contact}`, { lineGap: 2 });
  doc.text(brand.website, { lineGap: 2 });

  // ---------- Title + meta ----------
  y += 108;
  doc.fillColor(dark).font('DejaVu-Bold').fontSize(18).text('TAX INVOICE / RECEIPT', margin, y);
  doc.font('DejaVu').fontSize(9).fillColor(midGray).text(`Receipt No.: ${data.receipt_number || '—'}`, margin, y + 24);
  doc.text(`Date: ${data.date || data.invoice_date || '—'}`, margin, y + 38);

  const metaX = margin + W - 220;
  const metaValX = margin + W - 180;
  const metaRows = [];
  if (data.payment_mode) metaRows.push(['Payment Mode:', PAYMENT_MODE_LABELS[data.payment_mode] || String(data.payment_mode).toUpperCase()]);
  if (data.transaction_id) metaRows.push(['Transaction ID:', data.transaction_id]);
  metaRows.forEach(([label, val], i) => {
    doc.font('DejaVu-Bold').fontSize(9).fillColor(dark).text(label, metaX, y + 24 + i * 14);
    doc.font('DejaVu').fontSize(9).fillColor(midGray).text(val, metaValX, y + 24 + i * 14, { width: 180, align: 'right' });
  });

  y += 66;
  doc.moveTo(margin, y).lineTo(margin + W, y).strokeColor(borderGray).lineWidth(1).stroke();
  y += 14;

  // ---------- Bill To ----------
  doc.font('DejaVu-Bold').fontSize(9).fillColor(dark).text('BILL TO', margin, y);
  doc.font('DejaVu-Bold').fontSize(11).fillColor(dark).text(data.student_name || data.customer_name || '—', margin, y + 16);
  doc.font('DejaVu').fontSize(8.5).fillColor(midGray);
  const custLines = [];
  if (data.student_phone || data.customer_phone) custLines.push(`Mobile: ${data.student_phone || data.customer_phone}`);
  if (data.student_email || data.customer_email) custLines.push(`Email: ${data.student_email || data.customer_email}`);
  if (data.student_city || data.customer_city) custLines.push(`City: ${data.student_city || data.customer_city}`);
  custLines.forEach((line, i) => doc.text(line, margin, y + 32 + i * 11));
  if (data.course_name) {
    doc.font('DejaVu-Bold').fontSize(9).fillColor(dark).text('Course:', margin, y + 32 + custLines.length * 11 + 6);
    doc.font('DejaVu').fontSize(9).fillColor(midGray).text(data.course_name, margin, y + 32 + custLines.length * 11 + 20);
    y = y + 32 + custLines.length * 11 + 20 + 26;
  } else {
    y = y + 32 + custLines.length * 11 + 10;
  }

  // ---------- Items table ----------
  const tableTop = y;
  const descX = margin + 10;
  const qtyX = margin + 250;
  const rateX = margin + 330;
  const amountX = margin + W - 75;
  const colW = 70;

  doc.rect(margin, y, W, 26).fill(dark);
  doc.fillColor('#ffffff').font('DejaVu-Bold').fontSize(8);
  doc.text('DESCRIPTION', descX, y + 8);
  doc.text('QTY.', qtyX, y + 8, { width: 60, align: 'right' });
  doc.text('RATE', rateX, y + 8, { width: 100, align: 'right' });
  doc.text('AMOUNT', amountX, y + 8, { width: colW, align: 'right' });
  y += 26;

  let rowIndex = 0;
  for (const item of items) {
    const rowH = 34;
    if (rowIndex % 2 === 0) doc.rect(margin, y, W, rowH).fill('#fafafa');
    doc.font('DejaVu').fontSize(9).fillColor(dark);
    doc.text(item.description, descX, y + 10, { width: 220 });
    doc.text(String(item.qty), qtyX, y + 10, { width: 60, align: 'right' });
    doc.text(CURRENCY + formatINR(item.rate), rateX, y + 10, { width: 100, align: 'right' });
    doc.text(CURRENCY + formatINR(item.amount), amountX, y + 10, { width: colW, align: 'right' });
    y += rowH;
    rowIndex += 1;
  }

  doc.moveTo(margin, y).lineTo(margin + W, y).strokeColor(borderGray).lineWidth(1).stroke();
  y += 10;

  // ---------- Summary ----------
  const summaryX = margin + W - 220;
  const valueX = margin + W - 120;
  const summaryLines = [];
  summaryLines.push(['SUBTOTAL', CURRENCY + formatINR(subtotal)]);
  if (discount > 0) summaryLines.push(['DISCOUNT', '- ' + CURRENCY + formatINR(discount)]);
  if (taxRate > 0) summaryLines.push(['TAX (' + taxRate + '%)', CURRENCY + formatINR(taxAmount)]);

  for (const [label, val] of summaryLines) {
    doc.font('DejaVu').fontSize(9).fillColor(midGray).text(label, summaryX, y, { width: 130, align: 'left' });
    doc.font('DejaVu').fontSize(9).fillColor(dark).text(val, valueX, y, { width: 120, align: 'right' });
    y += 16;
  }

  doc.rect(summaryX - 8, y - 4, 228, 22).fill(lightGray);
  doc.font('DejaVu-Bold').fontSize(10).fillColor(dark).text('TOTAL AMOUNT', summaryX, y, { width: 130, align: 'left' });
  doc.text(CURRENCY + formatINR(totalAmount), valueX, y, { width: 120, align: 'right' });
  y += 28;

  doc.rect(summaryX - 8, y - 4, 228, 22).fill('#ecfdf5');
  doc.font('DejaVu-Bold').fontSize(9).fillColor(positive).text('Received Amount', summaryX, y, { width: 130, align: 'left' });
  doc.text(CURRENCY + formatINR(receivedAmount), valueX, y, { width: 120, align: 'right' });
  y += 28;

  if (balanceAmount > 0) {
    doc.rect(summaryX - 8, y - 4, 228, 22).fill('#fffbeb');
    doc.font('DejaVu-Bold').fontSize(9).fillColor(warning).text('Balance', summaryX, y, { width: 130, align: 'left' });
    doc.text(CURRENCY + formatINR(balanceAmount), valueX, y, { width: 120, align: 'right' });
    y += 28;
  }

  // ---------- Amount in words ----------
  doc.font('DejaVu-Bold').fontSize(8).fillColor(dark).text('Total Amount (in words)', margin, y + 4);
  doc.font('DejaVu').fontSize(8).fillColor(midGray).text(toWords(receivedAmount || totalAmount), margin, y + 18, { width: W - 220, lineGap: 2 });

  y += 44;

  // ---------- Payment / Bank details ----------
  if (data.bank_account_name || data.bank_name) {
    doc.font('DejaVu-Bold').fontSize(9).fillColor(dark).text('PAYMENT DETAILS', margin, y);
    const bankLines = [];
    if (data.bank_account_name) bankLines.push(`Account Name: ${data.bank_account_name}`);
    if (data.bank_name) bankLines.push(`Bank: ${data.bank_name}`);
    if (data.bank_account_number) bankLines.push(`Account No.: ${data.bank_account_number}`);
    if (data.bank_ifsc) bankLines.push(`IFSC: ${data.bank_ifsc}`);
    doc.font('DejaVu').fontSize(8.5).fillColor(midGray);
    bankLines.forEach((line, i) => doc.text(line, margin, y + 14 + i * 12));
    y += 16 + bankLines.length * 12;
  }

  if (data.notes) {
    doc.font('DejaVu-Bold').fontSize(9).fillColor(dark).text('NOTES', margin, y + 6);
    doc.font('DejaVu').fontSize(8).fillColor(midGray).text(data.notes, margin, y + 20, { width: W - 240, lineGap: 2 });
    y += 46;
  }

  // ---------- Terms + signature ----------
  const bottomY = Math.max(y, doc.page.height - 120);
  doc.font('DejaVu-Bold').fontSize(8).fillColor(dark).text('TERMS AND CONDITIONS', margin, bottomY);
  doc.font('DejaVu').fontSize(7).fillColor(midGray);
  doc.text('1. Goods once sold will not be taken back or exchanged.', margin, bottomY + 12, { width: W - 240, lineGap: 2 });
  doc.text('2. All disputes are subject to Pune jurisdiction only.', margin, bottomY + 26, { width: W - 240, lineGap: 2 });

  const signY = doc.page.height - 120;
  doc.moveTo(summaryX, signY + 18).lineTo(summaryX + 180, signY + 18).strokeColor(borderGray).lineWidth(1).stroke();
  try {
    doc.image(STAMP_PATH, summaryX + 40, signY + 8, { width: 100, height: 100 });
  } catch (e) {
    /* stamp optional */
  }
  doc.font('DejaVu').fontSize(8).fillColor(midGray).text('AUTHORISED SIGNATORY', summaryX, signY + 22, { width: 180, align: 'center' });

  doc.end();
  return new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

module.exports = { generateInvoice, toWords, formatINR };
