const PDFDocument = require('pdfkit');

const BRAND = {
  name: 'NeoSkills',
  tagline: 'NeoOps — Sales Command Center',
  address: 'NeoSkills Learning Solution',
  contact: 'support@neoskills.co.in',
};

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

function generateReceipt(data) {
  const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));

  const W = doc.page.width - 50 * 2;
  const margin = 50;

  const primary = '#1e3a8a';
  const accent = '#f59e0b';
  const gray = '#4b5563';
  const light = '#e5e7eb';

  // ---------- Header ----------
  doc.rect(0, 0, doc.page.width, 96).fill(primary);
  doc.rect(0, 96, doc.page.width, 3).fill(accent);

  doc.fillColor('#ffffff');
  doc.font('Helvetica-Bold').fontSize(24).text(BRAND.name, margin, 26, { continued: true });
  doc.font('Helvetica').fontSize(10).fillColor('#93c5fd').text('   ' + BRAND.tagline, { lineBreak: false });
  doc.fillColor('#ffffff').fontSize(9).font('Helvetica');
  doc.text(BRAND.address, margin, 52);
  doc.text(BRAND.contact, margin, 64);

  doc.font('Helvetica-Bold').fontSize(13).text('PAYMENT RECEIPT', margin, 34, { align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor('#bfdbfe').text('NeoSkills Learning Solution', margin, 50, { align: 'right' });

  let y = 122;

  // ---------- Receipt meta ----------
  doc.fillColor(gray).fontSize(9).font('Helvetica');
  doc.text(`Receipt No: ${data.receipt_number}`, margin, y);
  doc.text(`Date: ${data.date}`, margin, y + 13);
  doc.text(`Payment Status: ${data.payment_status}`, margin, y + 26);

  doc.text(`Course: ${data.course_name}`, margin + W - 140, y, { width: 140, align: 'right' });
  doc.text(`Category: ${data.category || '—'}`, margin + W - 140, y + 13, { width: 140, align: 'right' });
  doc.text(`Batch: ${data.batch_name || '—'}`, margin + W - 140, y + 26, { width: 140, align: 'right' });

  y += 52;

  // ---------- Student box ----------
  doc.roundedRect(margin, y, W, 70, 6).strokeColor(light).lineWidth(1).stroke();
  doc.fillColor(primary).font('Helvetica-Bold').fontSize(9).text('RECEIVED FROM', margin + 14, y + 10);
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(13).text(data.student_name, margin + 14, y + 26);
  doc.fillColor(gray).font('Helvetica').fontSize(9.5);
  doc.text(`Phone: ${data.student_phone || '—'}`, margin + 14, y + 46);
  doc.text(`Email: ${data.student_email || '—'}`, margin + 14, y + 59);

  y += 88;

  // ---------- Fee breakdown ----------
  doc.roundedRect(margin, y, W, 128, 6).fillColor('#f8fafc').fill().strokeColor(light).lineWidth(1).stroke();
  doc.fillColor(primary).font('Helvetica-Bold').fontSize(9).text('FEE BREAKDOWN', margin + 14, y + 10);

  y += 28;
  const row = (label, value, opts = {}) => {
    doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts.bold ? 10.5 : 9.5);
    doc.fillColor(opts.color || '#111827').text(label, margin + 14, y);
    doc.fillColor(opts.color || '#111827').text(value, margin + W - 140, y, { width: 126, align: 'right' });
    y += 20;
  };

  row('Training Fee', CURRENCY + ' ' + formatINR(data.training_fee));
  row('Exam / Certification Fee', CURRENCY + ' ' + formatINR(data.exam_fee));
  doc.moveTo(margin + 14, y - 8).lineTo(margin + W - 14, y - 8).strokeColor(light).lineWidth(1).stroke();
  row('Total Course Fee', CURRENCY + ' ' + formatINR(data.total_amount), { bold: true });
  row('Amount Paid', CURRENCY + ' ' + formatINR(data.total_paid), { color: '#047857' });
  row('Pending Amount', CURRENCY + ' ' + formatINR(data.total_pending), { color: '#b45309' });

  y += 8;

  // ---------- Amount in words ----------
  doc.roundedRect(margin, y, W, 30, 5).fillColor('#fef3c7').stroke();
  doc.fillColor('#92400e').font('Helvetica-Bold').fontSize(9).text('Amount Received (in words)', margin + 14, y + 9);
  doc.font('Helvetica').fontSize(9).text(toWords(data.total_paid), margin + W - 190, y + 9, { width: 176, align: 'right' });

  // ---------- Signature ----------
  const sigY = doc.page.height - 100;
  doc.font('Helvetica').fontSize(9).fillColor('#111827').text('For ' + BRAND.name + ',', margin, sigY);
  doc.moveTo(margin + 110, sigY + 30).lineTo(margin + 260, sigY + 30).strokeColor('#9ca3af').lineWidth(1).stroke();
  doc.font('Helvetica').fontSize(8).fillColor(gray).text('Authorized Signatory', margin + 110, sigY + 34);

  // ---------- Footer ----------
  const footerY = doc.page.height - 44;
  doc.fillColor(primary).rect(0, footerY, doc.page.width, 44).fill();
  doc.fillColor('#93c5fd').font('Helvetica').fontSize(8).text(
    BRAND.name + ' | ' + BRAND.tagline + ' | ' + BRAND.contact,
    0, footerY + 16, { align: 'center', width: doc.page.width }
  );

  doc.end();
  return new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

module.exports = { generateReceipt, toWords, formatINR };
