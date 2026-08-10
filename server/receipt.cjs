const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { getBrand } = require('./brands.cjs');

const BRAND = {
  ...getBrand('neoskills'),
  tagline: 'NeoOps — Sales Command Center',
};
const LOGO_PATH = path.join(__dirname, '../public/logo/nsl-logo-cropped.png');
const STAMP_PATH = path.join(__dirname, 'assets/stamp.png');
const FONT_PATH = path.join(__dirname, 'assets/fonts/DejaVuSans.ttf');
const FONT_BOLD_PATH = path.join(__dirname, 'assets/fonts/DejaVuSans-Bold.ttf');

const CURRENCY = '₹';

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

function pad(txt, len) {
  return String(txt).padEnd(len);
}

function generateReceipt(data) {
  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
  doc.registerFont('DejaVu', FONT_PATH);
  doc.registerFont('DejaVu-Bold', FONT_BOLD_PATH);
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));

  const W = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const margin = doc.page.margins.left;
  const dark = '#111827';
  const midGray = '#4b5563';
  const lightGray = '#f3f4f6';
  const borderGray = '#d1d5db';
  const accent = '#111827';
  const positive = '#047857';
  const warning = '#b45309';

  let y = margin;
  const brand = { ...getBrand(data.company), ...(data.brand || {}) };

  // ---------- Top header ----------
  doc.rect(0, 0, doc.page.width, 92).fill(lightGray);
  doc.fillColor(dark).font('DejaVu-Bold').fontSize(10).text('BILL OF SUPPLY', margin, y + 12);
  doc.rect(margin + 90, y + 12, 150, 20).fill('#ffffff').strokeColor(borderGray).lineWidth(1).stroke();
  doc.fillColor(midGray).font('DejaVu').fontSize(7).text('ORIGINAL FOR RECIPIENT', margin + 92, y + 16, { width: 146, align: 'center' });

  if (fs.existsSync(LOGO_PATH)) {
    doc.image(LOGO_PATH, margin, y + 38, { fit: [115, 42], align: 'left' });
  }

  const brandX = margin + 120;
  doc.fillColor(dark).font('DejaVu-Bold').fontSize(16).text(brand.name, brandX, y + 16);
  doc.font('DejaVu').fontSize(8).fillColor(midGray);
  doc.text(brand.address, brandX, y + 36, { width: W - 120, lineGap: 2 });
  doc.text(`Mobile: ${brand.phone}    PAN Number: ${brand.pan}`, { continued: false, lineGap: 2 });
  doc.text(`Email: ${brand.contact}`, { lineGap: 2 });
  doc.text(brand.website, { lineGap: 2 });

  y += 110;
  doc.moveTo(margin, y).lineTo(margin + W, y).strokeColor(borderGray).lineWidth(1).stroke();
  y += 12;

  const invoiceDate = data.invoice_date || data.date || '—';
  const dueDate = data.due_date || data.date || '—';
  const billToLines = [data.student_name || '—'];
  if (data.student_phone) billToLines.push(`Mobile: ${data.student_phone}`);
  if (data.student_email) billToLines.push(`Email: ${data.student_email}`);
  if (data.student_city) billToLines.push(`City: ${data.student_city}`);

  doc.font('DejaVu-Bold').fontSize(9).fillColor(dark).text('Invoice No.:', margin, y);
  doc.font('DejaVu').fontSize(9).fillColor(midGray).text(data.receipt_number || '—', margin, y + 12);

  doc.font('DejaVu-Bold').fontSize(9).fillColor(dark).text('Invoice Date:', margin + 210, y);
  doc.font('DejaVu').fontSize(9).fillColor(midGray).text(invoiceDate, margin + 210, y + 12);

  doc.font('DejaVu-Bold').fontSize(9).fillColor(dark).text('Due Date:', margin + 390, y);
  doc.font('DejaVu').fontSize(9).fillColor(midGray).text(dueDate, margin + 390, y + 12);

  y += 42;
  doc.font('DejaVu-Bold').fontSize(9).fillColor(dark).text('BILL TO', margin, y);
  doc.font('DejaVu').fontSize(9).fillColor(dark).text(billToLines[0], margin, y + 14);
  doc.font('DejaVu').fontSize(8).fillColor(midGray);
  billToLines.slice(1).forEach((line, index) => {
    doc.text(line, margin, y + 28 + index * 11);
  });

  y += 65;

  // ---------- Services table header ----------
  doc.rect(margin, y, W, 26).fill(dark);
  doc.fillColor('#ffffff').font('DejaVu-Bold').fontSize(8);
  doc.text('SERVICES', margin + 10, y + 8);
  doc.text('QTY.', margin + 250, y + 8, { width: 60, align: 'right' });
  doc.text('RATE', margin + 330, y + 8, { width: 100, align: 'right' });
  doc.text('AMOUNT', margin + W - 75, y + 8, { width: 70, align: 'right' });

  y += 26;
  doc.strokeColor(borderGray).lineWidth(1).moveTo(margin, y).lineTo(margin + W, y).stroke();

  const serviceDescription = data.course_name || 'Course Fee';
  const lineAmount = Number(data.total_amount) || 0;

  doc.font('DejaVu').fontSize(9).fillColor(dark);
  doc.text(serviceDescription, margin + 10, y + 8);
  doc.text('1', margin + 250, y + 8, { width: 60, align: 'right' });
  doc.text(CURRENCY + formatINR(lineAmount), margin + 330, y + 8, { width: 100, align: 'right' });
  doc.text(CURRENCY + formatINR(lineAmount), margin + W - 75, y + 8, { width: 70, align: 'right' });

  y += 34;
  doc.moveTo(margin, y).lineTo(margin + W, y).strokeColor(borderGray).lineWidth(1).stroke();

  const summaryX = margin + W - 220;
  const valueX = margin + W - 120;
  y += 10;
  doc.font('DejaVu').fontSize(9).fillColor(midGray).text('SUBTOTAL', summaryX, y, { width: 130, align: 'left' });
  doc.font('DejaVu').fontSize(9).fillColor(dark).text(CURRENCY + formatINR(lineAmount), valueX, y, { width: 120, align: 'right' });

  y += 16;
  doc.font('DejaVu-Bold').fontSize(9).fillColor(dark).text('TOTAL AMOUNT', summaryX, y, { width: 130, align: 'left' });
  doc.text(CURRENCY + formatINR(lineAmount), valueX, y, { width: 120, align: 'right' });

  y += 16;
  doc.font('DejaVu').fontSize(9).fillColor(midGray).text('Received Amount', summaryX, y, { width: 130, align: 'left' });
  doc.font('DejaVu-Bold').fontSize(9).fillColor(dark).text(CURRENCY + formatINR(data.total_paid || 0), valueX, y, { width: 120, align: 'right' });

  y += 16;
  doc.font('DejaVu-Bold').fontSize(9).fillColor(midGray).text('Balance', summaryX, y, { width: 130, align: 'left' });
  doc.font('DejaVu-Bold').fontSize(9).fillColor(dark).text(CURRENCY + formatINR(data.total_pending || 0), valueX, y, { width: 120, align: 'right' });

  y += 34;
  doc.font('DejaVu-Bold').fontSize(8).fillColor(dark).text('TERMS AND CONDITIONS', margin, y);
  doc.font('DejaVu').fontSize(7).fillColor(midGray);
  doc.text('1. Goods once sold will not be taken back or exchanged.', margin, y + 12, { width: W - 240, lineGap: 2 });
  doc.text('2. All disputes are subject to Pune jurisdiction only.', margin, y + 26, { width: W - 240, lineGap: 2 });

  doc.font('DejaVu-Bold').fontSize(8).fillColor(dark).text('Total Amount (in words)', summaryX, y);
  doc.font('DejaVu').fontSize(8).fillColor(midGray).text(toWords(lineAmount), summaryX, y + 12, { width: 220, align: 'right' });

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

module.exports = { generateReceipt, toWords, formatINR };
