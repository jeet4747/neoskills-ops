'use strict';
const ExcelJS = require('exceljs');
const { Resvg } = require('@resvg/resvg-js');

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const STATUS_TEXT = {
  punch_in: 'Working',
  punch_out: 'Worked',
  on_break: 'On Break',
  on_leave: 'On Leave',
  early_logout: 'Early Logout',
};

const INDIGO = 'FF4F46E5';
const INDIGO_LIGHT = 'FFEEF2FF';
const EMERALD = 'FF059669';
const GRAY = 'FF6B7280';
const BORDER_COLOR = 'FFE5E7EB';

const thinBorder = {
  top: { style: 'thin', color: { argb: BORDER_COLOR } },
  left: { style: 'thin', color: { argb: BORDER_COLOR } },
  bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
  right: { style: 'thin', color: { argb: BORDER_COLOR } },
};

const pad2 = (n) => String(n).padStart(2, '0');

function fmtDateObj(d) {
  if (!d) return '';
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
}

function fmtTime(t) {
  if (!t) return '';
  const x = new Date(t);
  let h = x.getHours();
  const m = pad2(x.getMinutes());
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
}

function minutesToTime(mins) {
  if (mins === null || mins === undefined) return '';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  const ap = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 || 12;
  return `${hh}:${pad2(m)} ${ap}`;
}

function monthLabel(month) {
  const [y, m] = month.split('-').map(Number);
  return `${MONTH_NAMES[(m || 1) - 1]} ${y}`;
}

function escXml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function workedMinutesOf(r, todayStr) {
  if (!r.punch_in) return null;
  const rowDate = fmtDateObj(r.date);
  let end = null;
  if (r.punch_out) end = new Date(r.punch_out);
  else if (rowDate === todayStr) end = new Date();
  if (!end) return null;
  const mins = Math.round((end - new Date(r.punch_in)) / 60000) - (Number(r.total_break_minutes) || 0);
  return Math.max(0, mins);
}

function barChartPng(title, items, color) {
  if (!items.length) return null;
  const data = items.slice(0, 10);
  const W = 780;
  const rowH = 36;
  const top = 64;
  const left = 190;
  const right = 110;
  const H = top + data.length * rowH + 18;
  const max = Math.max(1, ...data.map((d) => d.value));
  let body = '';
  data.forEach((d, i) => {
    const y = top + i * rowH;
    const bw = Math.max(6, Math.round((W - left - right) * (d.value / max)));
    body += `<text x="${left - 12}" y="${y + 21}" text-anchor="end" font-size="14" fill="#374151">${escXml(d.label)}</text>`;
    body += `<rect x="${left}" y="${y + 4}" width="${bw}" height="24" rx="6" fill="${color}"/>`;
    body += `<text x="${left + bw + 9}" y="${y + 21}" font-size="13" font-weight="bold" fill="${color}">${escXml(d.display)}</text>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
<rect width="${W}" height="${H}" fill="#ffffff"/>
<text x="18" y="34" font-size="18" font-weight="bold" fill="#111827">${escXml(title)}</text>
<line x1="18" y1="46" x2="${W - 18}" y2="46" stroke="#e5e7eb" stroke-width="1"/>
${body}
</svg>`;
  const resvg = new Resvg(svg, { fitTo: { mode: 'zoom', value: 2 }, font: { loadSystemFonts: true, defaultFontFamily: 'Helvetica' } });
  return resvg.render().asPng();
}

function sheetNameFor(name, used) {
  let base = String(name || 'Staff').replace(/[\\/*?:[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Staff';
  let candidate = base;
  let i = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` ${i++}`;
    candidate = base.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function styleHeaderRow(row, startCol, endCol) {
  for (let c = startCol; c <= endCol; c += 1) {
    const cell = row.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INDIGO } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = thinBorder;
  }
}

function sectionHeader(ws, range, text) {
  ws.mergeCells(range);
  const cell = ws.getCell(range.split(':')[0]);
  cell.value = text;
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INDIGO_LIGHT } };
  cell.font = { bold: true, size: 11, color: { argb: INDIGO } };
  cell.alignment = { vertical: 'middle' };
}

function tryDataBar(ws, ref, color) {
  try {
    ws.addConditionalFormatting({
      ref,
      rules: [{ type: 'dataBar', cfvo: [{ type: 'min' }, { type: 'max' }], color: { argb: color }, gradient: true }],
    });
  } catch { /* data bars are cosmetic — never fail the export over them */ }
}

async function buildAttendanceWorkbook(month, rows, users) {
  const todayStr = fmtDateObj(new Date());
  const wb = new ExcelJS.Workbook();
  wb.creator = 'NeoOps';
  wb.created = new Date();

  // ---------- per-user stats ----------
  const stats = new Map();
  const ensure = (id, name, role) => {
    if (!stats.has(id)) {
      stats.set(id, {
        id, name, role: role || '',
        present: 0, leave: 0, calls: 0, noms: 0, brk: 0, hours: 0,
        missingLogout: 0, loginMins: [], records: [],
      });
    }
    return stats.get(id);
  };
  for (const u of users) ensure(u.id, u.name, u.role);
  for (const r of rows) {
    const s = ensure(r.user_id, r.name, r.role);
    s.records.push(r);
    if (r.status === 'on_leave') s.leave += 1;
    if (r.punch_in) {
      s.present += 1;
      const pi = new Date(r.punch_in);
      s.loginMins.push(pi.getHours() * 60 + pi.getMinutes());
      if (!r.punch_out) {
        if (fmtDateObj(r.date) < todayStr) s.missingLogout += 1;
      }
    }
    s.calls += Number(r.connected_calls) || 0;
    s.noms += Number(r.nominations) || 0;
    s.brk += Number(r.total_break_minutes) || 0;
    const wm = workedMinutesOf(r, todayStr);
    if (wm !== null) s.hours += wm / 60;
  }
  const all = [...stats.values()];
  const byCalls = [...all].sort((a, b) => b.calls - a.calls || b.hours - a.hours);
  const byHours = [...all].sort((a, b) => b.hours - a.hours || b.calls - a.calls);

  const totalCalls = all.reduce((t, s) => t + s.calls, 0);
  const totalHours = all.reduce((t, s) => t + s.hours, 0);
  const totalLeave = all.reduce((t, s) => t + s.leave, 0);
  const totalBreak = all.reduce((t, s) => t + s.brk, 0);
  const totalMissing = all.reduce((t, s) => t + s.missingLogout, 0);
  const staff = all.length;

  // ---------- Analysis sheet ----------
  const a = wb.addWorksheet('Analysis', { views: [{ state: 'frozen', ySplit: 1 }] });
  [2, 24, 14, 14, 14, 14, 14, 14, 18].forEach((w, i) => { a.getColumn(i + 1).width = w; });

  a.mergeCells('B2:I2');
  a.getCell('B2').value = `Attendance Report — ${monthLabel(month)}`;
  a.getCell('B2').font = { bold: true, size: 18, color: { argb: 'FF111827' } };
  a.getRow(2).height = 26;
  a.mergeCells('B3:I3');
  a.getCell('B3').value = `NeoSkill Learning Solutions · Generated ${fmtDateObj(new Date())}`;
  a.getCell('B3').font = { size: 10, color: { argb: GRAY } };

  sectionHeader(a, 'B5:I5', 'KEY METRICS');
  const metricLabels = ['Staff', 'Connected Calls', 'Working Hours', 'Calls / Person', 'Hours / Person', 'Leave Days', 'Break (h)', 'Missing Logouts'];
  const metricValues = [
    staff,
    totalCalls,
    Math.round(totalHours * 10) / 10,
    Math.round((totalCalls / Math.max(1, staff)) * 10) / 10,
    Math.round((totalHours / Math.max(1, staff)) * 10) / 10,
    totalLeave,
    Math.round((totalBreak / 60) * 10) / 10,
    totalMissing,
  ];
  const mRow = a.getRow(6);
  const vRow = a.getRow(7);
  metricLabels.forEach((label, i) => {
    const c = i + 2;
    const lc = mRow.getCell(c);
    lc.value = label;
    lc.font = { size: 9, color: { argb: GRAY } };
    lc.alignment = { horizontal: 'center' };
    lc.border = thinBorder;
    const vc = vRow.getCell(c);
    vc.value = metricValues[i];
    vc.font = { bold: true, size: 15, color: { argb: INDIGO } };
    vc.alignment = { horizontal: 'center', vertical: 'middle' };
    vc.border = thinBorder;
    vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
  });
  a.getRow(7).height = 24;

  sectionHeader(a, 'B9:D9', 'TOP CONNECTED CALLS');
  sectionHeader(a, 'F9:H9', 'TOP WORKING HOURS');
  const lHdr = a.getRow(10);
  ['Rank', 'Name', 'Calls'].forEach((t, i) => { lHdr.getCell(2 + i).value = t; });
  ['Rank', 'Name', 'Hours'].forEach((t, i) => { lHdr.getCell(6 + i).value = t; });
  styleHeaderRow(lHdr, 2, 4);
  styleHeaderRow(lHdr, 6, 8);
  const topN = Math.min(10, byCalls.length);
  for (let i = 0; i < topN; i += 1) {
    const r = a.getRow(11 + i);
    r.getCell(1).value = null;
    r.getCell(2).value = i + 1;
    r.getCell(3).value = byCalls[i].name;
    r.getCell(4).value = byCalls[i].calls;
    r.getCell(6).value = i + 1;
    r.getCell(7).value = byHours[i].name;
    r.getCell(8).value = Math.round(byHours[i].hours * 10) / 10;
    for (const c of [2, 3, 4, 6, 7, 8]) {
      r.getCell(c).border = thinBorder;
      r.getCell(c).alignment = { horizontal: c === 3 || c === 7 ? 'left' : 'center' };
    }
    r.getCell(4).font = { bold: true, color: { argb: INDIGO } };
    r.getCell(8).font = { bold: true, color: { argb: EMERALD } };
    r.getCell(8).numFmt = '0.0';
  }
  const listEnd = 10 + topN;
  tryDataBar(a, `D11:D${listEnd}`, INDIGO);
  tryDataBar(a, `H11:H${listEnd}`, EMERALD);

  const secRow = listEnd + 2;
  sectionHeader(a, `B${secRow}:I${secRow}`, 'FULL ANALYSIS — EVERYONE THIS MONTH');
  const fHdr = a.getRow(secRow + 1);
  ['Name', 'Role', 'Days Present', 'Leave Days', 'No Logout', 'Calls', 'Hours', 'Avg Login'].forEach((t, i) => {
    fHdr.getCell(2 + i).value = t;
  });
  styleHeaderRow(fHdr, 2, 9);
  let fr = secRow + 2;
  for (const s of byCalls) {
    const r = a.getRow(fr);
    r.getCell(2).value = s.name;
    r.getCell(3).value = s.role;
    r.getCell(4).value = s.present;
    r.getCell(5).value = s.leave;
    r.getCell(6).value = s.missingLogout;
    r.getCell(7).value = s.calls;
    r.getCell(8).value = Math.round(s.hours * 10) / 10;
    r.getCell(9).value = s.loginMins.length
      ? minutesToTime(Math.round(s.loginMins.reduce((t, m) => t + m, 0) / s.loginMins.length))
      : '';
    r.getCell(8).numFmt = '0.0';
    for (let c = 2; c <= 9; c += 1) {
      r.getCell(c).border = thinBorder;
      if (c >= 4) r.getCell(c).alignment = { horizontal: 'center' };
    }
    r.getCell(7).font = { bold: true, color: { argb: INDIGO } };
    r.getCell(8).font = { bold: true, color: { argb: EMERALD } };
    fr += 1;
  }
  const fullEnd = fr - 1;
  if (fullEnd >= secRow + 2) {
    tryDataBar(a, `G${secRow + 2}:G${fullEnd}`, INDIGO);
    tryDataBar(a, `H${secRow + 2}:H${fullEnd}`, EMERALD);
  }

  // ---------- charts ----------
  const rowsFor = (px) => Math.ceil(px / 26) + 1;
  let chartRow = fullEnd + 3;
  try {
    const callsChart = barChartPng(
      `Top 10 — Connected Calls (${monthLabel(month)})`,
      byCalls.filter((s) => s.calls > 0).slice(0, 10).map((s) => ({ label: s.name.slice(0, 20), value: s.calls, display: String(s.calls) })),
      '#4F46E5'
    );
    if (callsChart) {
      const H = 64 + Math.min(10, byCalls.filter((s) => s.calls > 0).length) * 36 + 18;
      const id = wb.addImage({ buffer: callsChart, extension: 'png' });
      a.addImage(id, { tl: { col: 1.2, row: chartRow - 1 + 0.2 }, ext: { width: 780, height: H } });
      chartRow += rowsFor(H) + 1;
    }
    const hoursChart = barChartPng(
      `Top 10 — Working Hours (${monthLabel(month)})`,
      byHours.filter((s) => s.hours > 0).slice(0, 10).map((s) => ({ label: s.name.slice(0, 20), value: s.hours, display: `${Math.round(s.hours * 10) / 10}h` })),
      '#059669'
    );
    if (hoursChart) {
      const H = 64 + Math.min(10, byHours.filter((s) => s.hours > 0).length) * 36 + 18;
      const id = wb.addImage({ buffer: hoursChart, extension: 'png' });
      a.addImage(id, { tl: { col: 1.2, row: chartRow - 1 + 0.2 }, ext: { width: 780, height: H } });
    }
  } catch { /* charts are cosmetic — workbook still valid without them */ }

  // ---------- one sheet per person ----------
  const used = new Set(['analysis']);
  for (const s of byCalls) {
    const ws = wb.addWorksheet(sheetNameFor(s.name, used), {
      views: [{ state: 'frozen', ySplit: 7 }],
    });
    [13, 10, 11, 11, 11, 11, 9, 12, 13, 30].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

    ws.mergeCells('A1:J1');
    ws.getCell('A1').value = `${s.name} — Monthly Attendance, ${monthLabel(month)}`;
    ws.getCell('A1').font = { bold: true, size: 15, color: { argb: 'FF111827' } };
    ws.getRow(1).height = 22;
    ws.mergeCells('A2:J2');
    ws.getCell('A2').value = `Role: ${s.role || '-'} · Generated ${fmtDateObj(new Date())}`;
    ws.getCell('A2').font = { size: 10, color: { argb: GRAY } };

    const labels = ['Days Present', 'Leave Days', 'Working Hours', 'Connected Calls', 'Break (min)', 'Nominations', 'Avg Login'];
    const values = [
      s.present,
      s.leave,
      Math.round(s.hours * 10) / 10,
      s.calls,
      s.brk,
      s.noms,
      s.loginMins.length ? minutesToTime(Math.round(s.loginMins.reduce((t, m) => t + m, 0) / s.loginMins.length)) : '—',
    ];
    labels.forEach((label, i) => {
      const c = i + 1;
      const lcell = ws.getRow(4).getCell(c);
      lcell.value = label;
      lcell.font = { size: 9, color: { argb: GRAY } };
      lcell.alignment = { horizontal: 'center' };
      lcell.border = thinBorder;
      const vcell = ws.getRow(5).getCell(c);
      vcell.value = values[i];
      vcell.font = { bold: true, size: 13, color: { argb: INDIGO } };
      vcell.alignment = { horizontal: 'center', vertical: 'middle' };
      vcell.border = thinBorder;
      vcell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      if (i === 2) vcell.numFmt = '0.0';
    });
    ws.getRow(5).height = 22;

    const hdr = ws.getRow(7);
    ['Date', 'Day', 'Login', 'Logout', 'Worked (h)', 'Break (min)', 'Calls', 'Nominations', 'Status', 'Notes'].forEach((t, i) => {
      hdr.getCell(i + 1).value = t;
    });
    styleHeaderRow(hdr, 1, 10);
    ws.autoFilter = { from: 'A7', to: 'J7' };

    const records = [...s.records].sort((x, y) => new Date(x.date) - new Date(y.date));
    let rowIdx = 8;
    let hoursTotal = 0;
    let brkTotal = 0;
    let callsTotal = 0;
    let nomsTotal = 0;
    for (const rec of records) {
      const d = rec.date instanceof Date ? rec.date : new Date(rec.date);
      const wm = workedMinutesOf(rec, todayStr);
      const row = ws.getRow(rowIdx);
      row.getCell(1).value = d;
      row.getCell(1).numFmt = 'yyyy-mm-dd';
      row.getCell(2).value = DAY_NAMES[d.getDay()];
      row.getCell(3).value = fmtTime(rec.punch_in);
      row.getCell(4).value = fmtTime(rec.punch_out);
      row.getCell(5).value = wm === null ? '' : Math.round((wm / 60) * 10) / 10;
      row.getCell(5).numFmt = '0.0';
      row.getCell(6).value = Number(rec.total_break_minutes) || 0;
      row.getCell(7).value = Number(rec.connected_calls) || 0;
      row.getCell(8).value = Number(rec.nominations) || 0;
      row.getCell(9).value = STATUS_TEXT[rec.status] || (rec.punch_in ? 'Working' : '');
      row.getCell(10).value = rec.summary || '';
      for (let c = 1; c <= 10; c += 1) {
        row.getCell(c).border = thinBorder;
        row.getCell(c).alignment = { horizontal: c >= 2 && c <= 9 ? 'center' : 'left', vertical: 'middle' };
      }
      row.getCell(10).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      if (rec.status === 'on_leave') {
        for (let c = 1; c <= 10; c += 1) row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAF5FF' } };
      } else if (d.getDay() === 0 || d.getDay() === 6) {
        for (let c = 1; c <= 10; c += 1) row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      }
      if (wm !== null) hoursTotal += wm / 60;
      brkTotal += Number(rec.total_break_minutes) || 0;
      callsTotal += Number(rec.connected_calls) || 0;
      nomsTotal += Number(rec.nominations) || 0;
      rowIdx += 1;
    }
    if (!records.length) {
      ws.mergeCells(`A${rowIdx}:J${rowIdx}`);
      const empty = ws.getRow(rowIdx).getCell(1);
      empty.value = 'No attendance records this month.';
      empty.font = { italic: true, color: { argb: GRAY } };
      empty.alignment = { horizontal: 'center' };
      rowIdx += 1;
    } else {
      const t = ws.getRow(rowIdx);
      t.getCell(1).value = 'TOTAL';
      t.getCell(5).value = Math.round(hoursTotal * 10) / 10;
      t.getCell(5).numFmt = '0.0';
      t.getCell(6).value = brkTotal;
      t.getCell(7).value = callsTotal;
      t.getCell(8).value = nomsTotal;
      for (let c = 1; c <= 10; c += 1) {
        const cell = t.getCell(c);
        cell.font = { bold: true, color: { argb: 'FF111827' } };
        cell.border = {
          top: { style: 'medium', color: { argb: INDIGO } },
          bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
          left: { style: 'thin', color: { argb: BORDER_COLOR } },
          right: { style: 'thin', color: { argb: BORDER_COLOR } },
        };
        if (c >= 2 && c <= 9) cell.alignment = { horizontal: 'center' };
      }
      t.getCell(1).alignment = { horizontal: 'left' };
    }
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

module.exports = { buildAttendanceWorkbook };
