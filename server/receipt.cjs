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

function pad(txt, len) {
  return String(txt).padEnd(len);
}

function generateReceipt(data) {
  const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));

  const W = doc.page.width - 48 * 2;
  const margin = 48;

  const primary = '#1e3a8a';
  const accent = '#f59e0b';
  const gray = '#4b5563';
  const light = '#e5e7eb';

  // ---------- Header ----------
  doc.rect(0, 0, doc.page.width, 110).fill(primary);
  doc.fillColor('#ffffff');
  doc.rect(0, 110, doc.page.width, 3).fill(accent);

  doc.font('Helvetica-Bold').fontSize(26).text(BRAND.name, margin, 30, { continued: true });
  doc.font('Helvetica').fontSize(10).fillColor('#93c5fd').text('   ' + BRAND.tagline, { lineBreak: false });
  doc.fillColor('#ffffff').fontSize(9).font('Helvetica');
  doc.text(BRAND.address, margin, 58);
  doc.text(BRAND.contact, margin, 70);

  doc.font('Helvetica-Bold').fontSize(13).text('PAYMENT RECEIPT', margin, 40, { align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor('#bfdbfe').text('Official Tax Receipt', margin, 56, { align: 'right' });

  let y = 132;

  // ---------- Receipt meta row ----------
  doc.fillColor(gray).fontSize(9).font('Helvetica');
  doc.text(`Receipt No: ${data.receipt_number}`, margin, y);
  doc.text(`Date: ${data.date}`, margin, y + 13);
  doc.text(`Payment Status: ${data.payment_status}`, margin, y + 26);
  doc.text(`Mode: ${data.payment_mode_label}`, margin, y + 39);

  doc.text(`Enrollment ID: ${data.enrollment_id}`, margin + W - 150, y, { width: 150, align: 'right' });
  doc.text(`Batch: ${data.batch_name || '—'}`, margin + W - 150, y + 13, { width: 150, align: 'right' });
  doc.text(`Course: ${data.course_name}`, margin + W - 150, y + 26, { width: 150, align: 'right' });
  doc.text(`Category: ${data.category || '—'}`, margin + W - 150, y + 39, { width: 150, align: 'right' });

  y += 62;

  // ---------- Student box ----------
  doc.roundedRect(margin, y, W, 78, 6).strokeColor(light).lineWidth(1).stroke();
  doc.fillColor(primary).font('Helvetica-Bold').fontSize(9).text('RECEIVED FROM', margin + 14, y + 10);
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(13).text(data.student_name, margin + 14, y + 26);
  doc.fillColor(gray).font('Helvetica').fontSize(9.5);
  doc.text(`Phone: ${data.student_phone || '—'}`, margin + 14, y + 46);
  doc.text(`Email: ${data.student_email || '—'}`, margin + 14, y + 59);
  if (data.student_city) doc.text(`City: ${data.student_city}`, margin + W - 120, y + 46, { width: 106, align: 'right' });

  y += 96;

  // ---------- Fee summary table ----------
  const drawRow = (label, value, opts = {}) => {
    doc.font('Helvetica').fontSize(9.5);
    doc.fillColor('#111827').text(label, margin + 14, y + 8);
    doc.fillColor('#111827').text(value, margin + W - 130, y + 8, { width: 116, align: 'right' });
    if (opts.bold) {
      doc.font('Helvetica-Bold');
      doc.text(label, margin + 14, y + 8);
      doc.text(value, margin + W - 130, y + 8, { width: 116, align: 'right' });
    }
    y += opts.height || 22;
  };

  doc.roundedRect(margin, y, W, 150, 6).fillColor('#f8fafc').fill().strokeColor(light).lineWidth(1).stroke();
  doc.fillColor(primary).font('Helvetica-Bold').fontSize(9).text('FEE BREAKDOWN', margin + 14, y + 10);

  y += 28;
  doc.fillColor('#111827').font('Helvetica').fontSize(9.5);
  doc.text('Training Fee', margin + 14, y);
  doc.text(CURRENCY + ' ' + formatINR(data.training_fee), margin + W - 130, y, { width: 116, align: 'right' });

  y += 20;
  doc.text('Exam / Certification Fee', margin + 14, y);
  doc.text(CURRENCY + ' ' + formatINR(data.exam_fee), margin + W - 130, y, { width: 116, align: 'right' });

  y += 20;
  doc.text('Support Included', margin + 14, y);
  doc.text(data.support_included ? 'Yes' : 'No', margin + W - 130, y, { width: 116, align: 'right' });

  y += 20;
  doc.moveTo(margin + 14, y).lineTo(margin + W - 14, y).strokeColor(light).lineWidth(1).stroke();
  y += 20;
  doc.font('Helvetica-Bold').fontSize(10.5).text('Total Course Fee', margin + 14, y);
  doc.text(CURRENCY + ' ' + formatINR(data.total_amount), margin + W - 130, y, { width: 116, align: 'right' });

  y += 24;
  doc.font('Helvetica').fontSize(9.5).fillColor('#047857').text('Total Amount Paid', margin + 14, y);
  doc.fillColor('#047857').font('Helvetica-Bold').text(CURRENCY + ' ' + formatINR(data.total_paid), margin + W - 130, y, { width: 116, align: 'right' });

  y += 20;
  doc.fillColor('#b45309').font('Helvetica').fontSize(9.5).text('Balance Pending', margin + 14, y);
  doc.fillColor('#b45309').font('Helvetica-Bold').text(CURRENCY + ' ' + formatINR(data.total_pending), margin + W - 130, y, { width: 116, align: 'right' });

  y += 34;

  // ---------- Amount in words ----------
  doc.roundedRect(margin, y, W, 30, 5).fillColor('#fef3c7').stroke();
  doc.fillColor('#92400e').font('Helvetica-Bold').fontSize(9).text('Amount Received (in words)', margin + 14, y + 9);
  doc.font('Helvetica').fontSize(9).text(toWords(data.amount_paid), margin + W - 190, y + 9, { width: 176, align: 'right' });
  y += 46;

  // ---------- Payment details table ----------
  doc.fillColor(primary).font('Helvetica-Bold').fontSize(10).text('Payment Details', margin, y);
  y += 18;

  doc.roundedRect(margin, y, W, 20, 4).fillColor('#f1f5f9').stroke();
  doc.fillColor('#334155').font('Helvetica-Bold').fontSize(8.5);
  doc.text(pad('Date', 16) + pad('Mode', 16) + pad('Txn ID', 20) + pad('Bank Account', 24) + pad('Amount', 16) + 'Status', margin + 12, y + 6);

  y += 26;
  doc.font('Helvetica').fontSize(9).fillColor('#111827');
  (data.payments || []).forEach((p) => {
    doc.text(
      pad(p.date, 16) + pad(p.mode_label, 16) + pad((p.transaction_id || '—'), 20) + pad((p.bank_account_name || '—'), 24) + pad(CURRENCY + formatINR(p.amount_paid), 16) + p.status_label,
      margin + 12, y
    );
    y += 18;
  });

  y += 18;

  // ---------- Notes + signatures ----------
  doc.font('Helvetica-Bold').fontSize(10).fillColor(primary).text('Notes', margin, y);
  y += 18;
  doc.font('Helvetica').fontSize(8.5).fillColor(gray);
  doc.text('1. This receipt is auto-generated by NeoOps. The transaction is subject to final approval by the operations team.', margin, y);
  doc.text('2. Retain this receipt for your records. For any discrepancy, contact ' + BRAND.contact + '.', margin, y + 12);

  const sigY = doc.page.height - 120;
  doc.font('Helvetica').fontSize(9).fillColor('#111827').text('Received by (Sales):', margin, sigY);
  doc.font('Helvetica-Bold').fontSize(10).text(data.salesperson_name, margin, sigY + 16);
  doc.moveTo(margin, sigY + 30).lineTo(margin + 160, sigY + 30).strokeColor(light).lineWidth(1).stroke();
  doc.font('Helvetica').fontSize(8).fillColor(gray).text('Signature & Date', margin, sigY + 34);

  doc.font('Helvetica').fontSize(9).fillColor('#111827').text('Authorized Signatory:', margin + W - 170, sigY);
  doc.moveTo(margin + W - 170, sigY + 30).lineTo(margin + W - 10, sigY + 30).strokeColor(light).lineWidth(1).stroke();
  doc.font('Helvetica').fontSize(8).fillColor(gray).text('For ' + BRAND.name, margin + W - 170, sigY + 34);

  // ---------- Footer ----------
  const footerY = doc.page.height - 50;
  doc.fillColor(primary).rect(0, footerY, doc.page.width, 50).fill();
  doc.fillColor('#93c5fd').font('Helvetica').fontSize(8).text(
    BRAND.name + ' | ' + BRAND.tagline + ' | ' + BRAND.contact,
    0, footerY + 18, { align: 'center', width: doc.page.width }
  );

  doc.end();
  return new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

module.exports = { generateReceipt, toWords, formatINR };
