(function () {
  const HISTORY_KEY = 'infloww_history';
  const HUBSTAFF_KEY = 'infloww_hubstaff';
  const SHEET_URL_KEY = 'infloww_sheet_url';
  const HISTORY_VER_KEY = 'infloww_history_ver';
  const HISTORY_VER = 4;

  const COLUMNS = [
    { key: 'employee', label: 'Employees', type: 'text' },
    { key: 'duration', label: 'Duration', type: 'hours', hasAvg: true },
    { key: 'sales', label: 'Sales', type: 'currency', hasAvg: true },
    { key: 'directMessagesSent', label: 'Direct messages sent', type: 'number' },
    { key: 'directPpvsSent', label: 'Direct PPVs sent', type: 'number' },
    { key: 'goldenRatio', label: 'Golden ratio', type: 'percent', hasAvg: true },
    { key: 'ppvsUnlocked', label: 'PPVs unlocked', type: 'number' },
    { key: 'unlockRate', label: 'Unlock rate', type: 'percent' },
    { key: 'fansChatted', label: 'Fans chatted', type: 'number' },
    { key: 'fansWhoSpentMoney', label: 'Fans who spent money', type: 'number' },
    { key: 'fanCvr', label: 'Fan CVR', type: 'percent', hasAvg: true },
    { key: 'responseTime', label: 'Response time', type: 'time', hasAvg: true },
    { key: 'clockedHours', label: 'Clocked hours', type: 'hours' },
    { key: 'salesPerHour', label: 'Sales per hour', type: 'currency', hasAvg: true },
    { key: 'characterCount', label: 'Character count', type: 'number' },
    { key: 'messagesSentPerHour', label: 'Messages sent per hour', type: 'decimal', hasAvg: true },
  ];

  const DATA_KEYS = [
    'sales', 'directMessagesSent', 'directPpvsSent', 'goldenRatio',
    'ppvsUnlocked', 'unlockRate', 'fansChatted', 'fansWhoSpentMoney',
    'fanCvr', 'responseTime', 'clockedHours', 'salesPerHour',
    'characterCount', 'messagesSentPerHour',
  ];

  const INFLOWW_ALIASES = {
    employee: ['employee', 'employees', 'name', 'chatter', 'model', 'empleado', 'nombre'],
    date: ['date', 'fecha', 'day', 'dia', 'period', 'periodo'],
    sales: ['sales', 'revenue', 'earnings', 'ingresos', 'ventas', 'total sales', 'net', 'gross'],
    directMessagesSent: ['direct messages sent', 'dm sent', 'mensajes directos', 'mensajes enviados'],
    directPpvsSent: ['direct ppvs sent', 'ppvs sent', 'ppv sent', 'ppvs directos enviados'],
    goldenRatio: ['golden ratio', 'ratio dorado', 'gr'],
    ppvsUnlocked: ['ppvs unlocked', 'ppv unlocked', 'ppvs desbloqueados', 'unlocked ppvs', 'unlocked'],
    unlockRate: ['unlock rate', 'tasa de desbloqueo', 'tasa desbloqueo'],
    fansChatted: ['fans chatted', 'fans chateados', 'chatted fans', 'chatted'],
    fansWhoSpentMoney: ['fans who spent money', 'fans que gastaron', 'spending fans', 'fans who spent', 'spent money'],
    fanCvr: ['fan cvr', 'cvr', 'fan conversion', 'tasa conversion'],
    responseTime: ['response time', 'tiempo de respuesta', 'avg response time', 'response', 'resp time'],
    clockedHours: ['clocked hours', 'horas clockeadas', 'logged hours', 'horas registradas'],
    characterCount: ['character count', 'caracteres', 'char count', 'characters', 'total characters'],
    messagesSentPerHour: ['messages sent per hour', 'mensajes por hora', 'msg per hour', 'messages/hour', 'msg/hr'],
    salesPerHour: ['sales per hour', 'ventas por hora', 'revenue per hour', '$/hr'],
    group: ['group', 'grupo', 'team', 'equipo'],
  };

  const HUBSTAFF_ALIASES = {
    employee: ['member', 'user', 'employee', 'name', 'usuario', 'miembro', 'employees'],
    date: ['date', 'fecha', 'day', 'start date'],
    hours: ['hours', 'time', 'duration', 'tracked', 'time tracked', 'total time', 'hours worked', 'horas', 'tiempo'],
  };

  const SUM_KEYS = ['sales', 'directMessagesSent', 'directPpvsSent', 'ppvsUnlocked',
    'fansChatted', 'fansWhoSpentMoney', 'characterCount', 'clockedHours'];
  const DERIVED_RATE_KEYS = ['goldenRatio', 'unlockRate', 'fanCvr', 'responseTime',
    'salesPerHour', 'messagesSentPerHour'];

  // ── State ──
  let hubstaffRaw = null;
  let currentPeriod = 'current';
  let customFrom = null;
  let customTo = null;
  let sortKey = 'sales';
  let sortDir = 'desc';
  let hideInactive = false;
  let showAvg = true;
  let compactView = false;
  let calYear, calMonth;
  let pickPhase = 0, pickStart = null;
  let calOpen = false;

  // ── DOM ──
  const $ = (id) => document.getElementById(id);
  const fileInfloww = $('fileInfloww');
  const fileHubstaff = $('fileHubstaff');
  const labelInfloww = $('labelInfloww');
  const labelHubstaff = $('labelHubstaff');
  const controlsBar = $('controlsBar');
  const periodButtons = $('periodButtons');
  const calSection = $('calSection');
  const calMonth0El = $('calMonth0');
  const calMonth1El = $('calMonth1');
  const calPrevBtn = $('calPrev');
  const calNextBtn = $('calNext');
  const calHint = $('calHint');
  const toggleCalBtn = $('toggleCal');
  const sortColumn = $('sortColumn');
  const btnDesc = $('btnDesc');
  const btnAsc = $('btnAsc');
  const btnAlpha = $('btnAlpha');
  const hideInactiveCheck = $('hideInactive');
  const toggleAvgCheck = $('toggleAvg');
  const toggleCompactCheck = $('toggleCompact');
  const periodInfo = $('periodInfo');
  const lastUpdateEl = $('lastUpdate');
  const historyInfo = $('historyInfo');
  const clearHistoryBtn = $('clearHistory');
  const emptyState = $('emptyState');
  const tableSection = $('tableSection');
  const tableHead = $('tableHead');
  const tableBody = $('tableBody');
  const tableFoot = $('tableFoot');

  // ── CSV Parsing ──
  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) return { headers: [], rows: [] };
    const delimiter = (text.match(/;/g) || []).length > (text.match(/,/g) || []).length ? ';' : ',';
    const headers = parseLine(lines[0], delimiter);
    const rows = [];
    for (let i = 1; i < lines.length; i++) rows.push(parseLine(lines[i], delimiter));
    return { headers, rows };
  }

  function parseLine(line, d) {
    const result = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') inQ = !inQ;
      else if (!inQ && c === d) { result.push(clean(cur)); cur = ''; }
      else cur += c;
    }
    result.push(clean(cur));
    return result;
  }

  function clean(v) {
    const s = String(v || '').trim();
    return s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1).replace(/""/g, '"') : s;
  }

  function normalizeHeader(h) {
    return String(h || '').toLowerCase().replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function findCol(headers, aliases, used) {
    const norm = headers.map(normalizeHeader);
    for (const alias of aliases) {
      const i = norm.findIndex((h, idx) => h === alias && (!used || !used.has(idx)));
      if (i !== -1) return i;
    }
    for (const alias of aliases) {
      const i = norm.findIndex((h, idx) => (h.includes(alias) || alias.includes(h)) && (!used || !used.has(idx)));
      if (i !== -1) return i;
    }
    return -1;
  }

  function buildMap(headers, aliasesObj) {
    const map = {};
    const used = new Set();
    for (const [key, aliases] of Object.entries(aliasesObj)) {
      const idx = findCol(headers, aliases, used);
      if (idx !== -1) { map[key] = idx; used.add(idx); }
    }
    return map;
  }

  // ── Number / Time Parsing ──
  function parseNum(v) {
    if (v == null || v === '' || v === '-') return NaN;
    const s = String(v).replace(/[$%,]/g, '').replace(/\s/g, '').replace(',', '.');
    return parseFloat(s);
  }

  function parseHours(v) {
    if (v == null || v === '' || v === '-') return NaN;
    const s = String(v).trim().replace(/,/g, '.');
    const hmin = s.match(/^(\d+)h\s*(\d+)\s*min/i);
    if (hmin) return parseInt(hmin[1]) + parseInt(hmin[2]) / 60;
    const hOnly = s.match(/^(\d+)h$/i);
    if (hOnly) return parseInt(hOnly[1]);
    const minOnly = s.match(/^(\d+)\s*min$/i);
    if (minOnly) return parseInt(minOnly[1]) / 60;
    const hm = s.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
    if (hm) return parseInt(hm[1]) + parseInt(hm[2]) / 60 + (hm[3] ? parseInt(hm[3]) / 3600 : 0);
    const n = parseFloat(s);
    if (!isNaN(n)) return n;
    return NaN;
  }

  function parseResponseTime(v) {
    if (v == null || v === '' || v === '-') return NaN;
    const s = String(v).trim();
    const mSec = s.match(/^(\d+)m\s*(\d+)\s*s$/i);
    if (mSec) return parseInt(mSec[1]) * 60 + parseInt(mSec[2]);
    const mOnly = s.match(/^(\d+)m$/i);
    if (mOnly) return parseInt(mOnly[1]) * 60;
    const sOnly = s.match(/^(\d+)\s*s$/i);
    if (sOnly) return parseInt(sOnly[1]);
    const hms = s.match(/^(\d+):(\d{2}):(\d{2})$/);
    if (hms) return parseInt(hms[1]) * 3600 + parseInt(hms[2]) * 60 + parseInt(hms[3]);
    const ms = s.match(/^(\d+):(\d{2})$/);
    if (ms) return parseInt(ms[1]) * 60 + parseInt(ms[2]);
    const n = parseFloat(s.replace(/,/g, '.'));
    if (!isNaN(n)) return n;
    return NaN;
  }

  // ── Date Utilities ──
  function parseDate(s) {
    if (!s) return null;
    const str = String(s).trim();
    const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return str.slice(0, 10);
    const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dmy) {
      const a = parseInt(dmy[1]), b = parseInt(dmy[2]), y = dmy[3];
      if (a > 12) return `${y}-${String(b).padStart(2,'0')}-${String(a).padStart(2,'0')}`;
      return `${y}-${String(a).padStart(2,'0')}-${String(b).padStart(2,'0')}`;
    }
    const d = new Date(str);
    if (!isNaN(d)) {
      const yy = d.getFullYear(), mm = String(d.getMonth()+1).padStart(2,'0'), dd = String(d.getDate()).padStart(2,'0');
      return `${yy}-${mm}-${dd}`;
    }
    return null;
  }

  function parseFullDatetime(s) {
    if (!s) return null;
    var str = String(s).trim();
    var m = str.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/);
    if (m) return m[1] + 'T' + m[2];
    var d = parseDate(str);
    return d || null;
  }

  function parsePeriodString(str) {
    if (!str) return null;
    const s = String(str).trim();
    const parts = s.split(/\s+-\s+/);
    if (parts.length === 2) {
      const start = parseFullDatetime(parts[0]);
      const end = parseFullDatetime(parts[1]);
      if (start && end) return { start, end };
    }
    const single = parseFullDatetime(s);
    if (single) return { start: single, end: single };
    return null;
  }

  function getMondayUTC(offsetWeeks) {
    const now = new Date();
    const utcToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const day = utcToday.getUTCDay();
    const diff = (day + 6) % 7;
    const monday = new Date(utcToday.getTime() - diff * 86400000 + (offsetWeeks || 0) * 7 * 86400000);
    return monday;
  }

  function toDateStr(d) {
    const yy = d.getUTCFullYear(), mm = String(d.getUTCMonth()+1).padStart(2,'0'), dd = String(d.getUTCDate()).padStart(2,'0');
    return `${yy}-${mm}-${dd}`;
  }

  function addDays(dateStr, n) {
    return toDateStr(new Date(new Date(dateStr + 'T00:00:00Z').getTime() + n * 86400000));
  }

  function getDateRange() {
    if (currentPeriod === 'current') {
      const mon = getMondayUTC(0);
      const nextMon = new Date(mon.getTime() + 7 * 86400000);
      return { from: toDateStr(mon), to: toDateStr(nextMon) };
    }
    if (currentPeriod === 'previous') {
      const mon = getMondayUTC(-1);
      const nextMon = new Date(mon.getTime() + 7 * 86400000);
      return { from: toDateStr(mon), to: toDateStr(nextMon) };
    }
    if (currentPeriod === 'custom' && customFrom && customTo) {
      if (customFrom === customTo) {
        return { from: customFrom, to: addDays(customTo, 1) };
      }
      return { from: customFrom, to: customTo };
    }
    return null;
  }

  // ── History Storage ──
  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function saveHistory(records) {
    try {
      const json = JSON.stringify(records);
      localStorage.setItem(HISTORY_KEY, json);
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        alert('El almacenamiento local está lleno. Considera borrar datos antiguos.');
      }
    }
  }

  function mergeIntoHistory(parsedData) {
    const map = buildMap(parsedData.headers, INFLOWW_ALIASES);
    const dateIdx = map.date;
    const employeeIdx = map.employee;
    if (employeeIdx == null) return 0;

    const now = new Date().toISOString();
    const newRecords = [];

    for (const row of parsedData.rows) {
      const name = (row[employeeIdx] || '').trim();
      if (!name) continue;

      let period = dateIdx != null ? parsePeriodString(row[dateIdx]) : null;
      if (!period) period = { start: 'unknown', end: 'unknown' };

      const values = {};
      for (const key of DATA_KEYS) {
        if (map[key] != null) values[key] = row[map[key]] || '';
      }
      const grp = map.group != null ? (row[map.group] || '').trim() : '';

      newRecords.push({
        periodStart: period.start,
        periodEnd: period.end,
        uploadedAt: now,
        employee: name,
        group: grp,
        values: values,
      });
    }

    const history = loadHistory();

    for (const rec of newRecords) {
      const idx = history.findIndex(
        (r) => r.employee === rec.employee && r.periodStart === rec.periodStart && r.periodEnd === rec.periodEnd
      );
      if (idx !== -1) {
        if (rec.uploadedAt >= history[idx].uploadedAt) history[idx] = rec;
      } else {
        history.push(rec);
      }
    }

    saveHistory(history);
    return newRecords.length;
  }

  function queryHistory(from, to) {
    const history = loadHistory();
    if (!from || !to) return history;
    return history.filter((r) => r.periodEnd >= from && r.periodEnd < to);
  }

  function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
  }

  function getHistoryStats() {
    const history = loadHistory();
    if (!history.length) return null;
    const periods = new Set(history.map((r) => `${r.periodStart}_${r.periodEnd}`));
    const dates = history.map((r) => r.periodStart).filter((d) => d !== 'unknown').sort();
    return {
      totalRecords: history.length,
      periodCount: periods.size,
      earliest: dates[0] || null,
      latest: dates[dates.length - 1] || null,
    };
  }

  // ── Data Processing ──
  function processData() {
    const range = getDateRange();
    const employees = {};

    const records = range ? queryHistory(range.from, range.to) : loadHistory();

    for (const rec of records) {
      const key = rec.employee.toLowerCase();
      if (!employees[key]) employees[key] = { name: rec.employee, group: '', inflowwRows: [], hubstaffHours: 0 };
      if (rec.group) employees[key].group = rec.group;
      const synRow = [];
      const synMap = {};
      let i = 0;
      for (const [k, v] of Object.entries(rec.values)) {
        synRow.push(v);
        synMap[k] = i++;
      }
      employees[key].inflowwRows.push({ row: synRow, map: synMap });
    }

    if (hubstaffRaw) {
      const map = buildMap(hubstaffRaw.headers, HUBSTAFF_ALIASES);
      const dateIdx = map.date;
      const rows = range ? filterRows(hubstaffRaw.rows, dateIdx, range) : hubstaffRaw.rows;

      for (const row of rows) {
        const name = map.employee != null ? (row[map.employee] || '').trim() : '';
        if (!name) continue;
        const key = name.toLowerCase();
        if (!employees[key]) employees[key] = { name, inflowwRows: [], hubstaffHours: 0 };
        const h = parseHours(row[map.hours]);
        if (!isNaN(h)) employees[key].hubstaffHours += h;
      }
    }

    const result = [];
    for (const emp of Object.values(employees)) {
      result.push(computeMetrics(emp));
    }
    return result;
  }

  function filterRows(rows, dateIdx, range) {
    if (!range || dateIdx == null || dateIdx < 0) return rows;
    return rows.filter((r) => {
      const d = parseDate(r[dateIdx]);
      return d && d >= range.from && d < range.to;
    });
  }

  function computeMetrics(emp) {
    const m = { employee: emp.name, group: emp.group || '' };
    const sums = {};
    for (const k of SUM_KEYS) sums[k] = { total: 0, count: 0 };
    const rateVals = {};
    for (const k of DERIVED_RATE_KEYS) rateVals[k] = [];

    for (const { row, map } of emp.inflowwRows) {
      for (const k of SUM_KEYS) {
        if (map[k] == null) continue;
        const v = k === 'clockedHours' ? parseHours(row[map[k]]) : parseNum(row[map[k]]);
        if (!isNaN(v)) { sums[k].total += v; sums[k].count++; }
      }
      for (const k of DERIVED_RATE_KEYS) {
        if (map[k] == null) continue;
        const v = k === 'responseTime' ? parseResponseTime(row[map[k]]) : parseNum(row[map[k]]);
        if (!isNaN(v)) rateVals[k].push(v);
      }
    }

    m.duration = emp.hubstaffHours || NaN;
    for (const k of SUM_KEYS) m[k] = sums[k].count ? sums[k].total : NaN;
    for (const k of DERIVED_RATE_KEYS) m[k] = rateVals[k].length === 1 ? rateVals[k][0] : NaN;

    return m;
  }

  // ── Sorting ──
  function sortData(data) {
    const copy = [...data];
    if (sortDir === 'alpha') {
      copy.sort((a, b) => a.employee.localeCompare(b.employee, 'es'));
      return copy;
    }
    const mult = sortDir === 'asc' ? 1 : -1;
    copy.sort((a, b) => {
      const va = a[sortKey], vb = b[sortKey];
      const na = isNaN(va) ? -Infinity : va;
      const nb = isNaN(vb) ? -Infinity : vb;
      return (na - nb) * mult;
    });
    return copy;
  }

  // ── Formatting ──
  function fmt(value, type) {
    if (value == null || isNaN(value)) return '—';
    switch (type) {
      case 'currency': return '$' + roundDisplay(value, 2);
      case 'number': return Math.round(value).toLocaleString('en-US');
      case 'decimal': return roundDisplay(value, 2);
      case 'percent': return roundDisplay(value, 2) + '%';
      case 'hours': return fmtHoursDisplay(value);
      case 'time': return fmtTimeDisplay(value);
      default: return String(value);
    }
  }

  function roundDisplay(n, dp) {
    const factor = Math.pow(10, dp);
    return String(Math.round(n * factor) / factor);
  }

  function fmtHoursDisplay(h) {
    if (isNaN(h)) return '—';
    const totalMin = Math.floor(h * 60);
    const hrs = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  }

  function fmtTimeDisplay(totalSeconds) {
    if (isNaN(totalSeconds)) return '—';
    const total = Math.floor(totalSeconds);
    const m = Math.floor(total / 60);
    const s = total % 60;
    if (m === 0) return `${s}s`;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // ── Rendering ──
  function render() {
    const stats = getHistoryStats();
    const hasData = (stats && stats.totalRecords > 0) || hubstaffRaw;
    controlsBar.hidden = !hasData;
    if (!hasData) showCalendar(false);

    updateHistoryInfo(stats);

    if (!hasData) {
      emptyState.hidden = false;
      emptyState.querySelector('h2').textContent = 'Sin datos aún';
      emptyState.querySelector('p').innerHTML = 'Sube el <strong>CSV de Infloww</strong> y el <strong>CSV de Hubstaff</strong> para ver las estadísticas por empleado.';
      tableSection.hidden = true;
      periodInfo.textContent = '';
      lastUpdateEl.textContent = '';
      return;
    }

    if (calOpen) renderCalendar();

    const data = processData();
    if (!data.length) {
      emptyState.hidden = false;
      emptyState.querySelector('h2').textContent = 'Sin datos para este periodo';
      emptyState.querySelector('p').innerHTML = 'No se encontraron registros en el rango seleccionado. Prueba con otro periodo.';
      tableSection.hidden = true;
      updatePeriodInfo();
      return;
    }

    const filtered = hideInactive ? data.filter((r) => r.directMessagesSent > 0 && !isNaN(r.directMessagesSent)) : data;
    if (!filtered.length) {
      emptyState.hidden = false;
      emptyState.querySelector('h2').textContent = 'Sin datos visibles';
      emptyState.querySelector('p').innerHTML = 'Todos los empleados fueron ocultados por el filtro. Desmarca "Ocultar sin mensajes" para verlos.';
      tableSection.hidden = true;
      updatePeriodInfo();
      return;
    }
    emptyState.hidden = true;
    tableSection.hidden = false;
    tableSection.querySelector('.table-wrap').classList.toggle('compact-mode', compactView);
    const sorted = sortData(filtered);
    if (compactView) { renderCompact(sorted); } else { renderTable(sorted); }
    updatePeriodInfo();
    lastUpdateEl.textContent = 'Última actualización: ' + new Date().toLocaleString('es');
  }

  function updateHistoryInfo(stats) {
    if (!historyInfo) return;
    if (!stats || !stats.totalRecords) {
      historyInfo.hidden = true;
      return;
    }
    historyInfo.hidden = false;
    const fmtDate = (s) => {
      if (!s) return '';
      var ds = s.length > 10 ? s.slice(0, 10) : s;
      const d = new Date(ds + 'T00:00:00Z');
      return d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    };
    const periodWord = stats.periodCount === 1 ? 'periodo' : 'periodos';
    let text = `Base de datos: ${stats.totalRecords} registros · ${stats.periodCount} ${periodWord}`;
    if (stats.earliest && stats.latest) {
      text += ` · ${fmtDate(stats.earliest)} — ${fmtDate(stats.latest)}`;
    }
    historyInfo.querySelector('.history-text').textContent = text;
  }

  function renderTable(data) {
    let headHtml = '<tr>';
    for (const col of COLUMNS) {
      const isActive = sortKey === col.key && sortDir !== 'alpha';
      const arrow = isActive ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
      const cls = isActive ? 'th-active' : '';
      headHtml += `<th class="${cls}" data-key="${col.key}">${escapeHtml(col.label)}${arrow}</th>`;
    }
    headHtml += '</tr>';

    if (showAvg) {
      const avgs = computeAverages(data);
      headHtml += '<tr class="avg-row">';
      for (const col of COLUMNS) {
        if (col.key === 'employee') {
          headHtml += `<th class="avg-label">Promedio</th>`;
        } else if (col.hasAvg && avgs[col.key] != null) {
          const cls = col.type === 'currency' ? 'cell-currency' : '';
          headHtml += `<th class="${cls}">${fmt(avgs[col.key], col.type)}</th>`;
        } else {
          headHtml += '<th></th>';
        }
      }
      headHtml += '</tr>';
    }
    tableHead.innerHTML = headHtml;

    let bodyHtml = '';
    for (const row of data) {
      bodyHtml += '<tr>';
      for (const col of COLUMNS) {
        const val = row[col.key];
        const display = col.type === 'text' ? escapeHtml(val || '') : fmt(val, col.type);
        const cls = col.type === 'currency' ? 'cell-currency' : '';
        bodyHtml += `<td class="${cls}">${display}</td>`;
      }
      bodyHtml += '</tr>';
    }
    tableBody.innerHTML = bodyHtml;
    tableFoot.innerHTML = '';
  }

  function computeAverages(data) {
    const avgs = {};
    for (const col of COLUMNS) {
      if (!col.hasAvg) continue;
      const vals = data.map((r) => r[col.key]).filter((v) => !isNaN(v));
      avgs[col.key] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    }
    return avgs;
  }

  const COMPACT_BONUS = [60, 40, 30, 20, 15, 12, 10, 6, 4, 3];
  const COMPACT_JACKPOT = [75, 50, 37, 25, 19, 14, 11, 8, 6, 5];

  const RANK_MEDALS = ['🥇', '🥈', '🥉'];
  const COMPACT_VISIBLE = 12;

  function renderCompact(data) {
    const ranked = [...data].sort((a, b) => {
      const va = isNaN(a.sales) ? -Infinity : a.sales;
      const vb = isNaN(b.sales) ? -Infinity : b.sales;
      return vb - va;
    });
    const totalSales = ranked.reduce((s, r) => s + (isNaN(r.sales) ? 0 : r.sales), 0);

    let headHtml = '<tr class="compact-total"><th colspan="5">TOTAL SALES <span class="compact-total-val">' + fmt(totalSales, 'currency') + '</span></th></tr>';
    headHtml += '<tr><th>Ranking</th><th>Top Chatters</th><th>Sales</th>';
    headHtml += '<th class="compact-bonus-head">$$ BONUS $$</th>';
    headHtml += '<th class="compact-jackpot-head">JACKPOT +$50k total sales BONUS $$</th></tr>';
    tableHead.innerHTML = headHtml;

    function buildRow(i, r) {
      const name = (r.employee || '').split(' ')[0];
      const hasBonus = i < COMPACT_BONUS.length;
      const bonus = hasBonus ? '$' + COMPACT_BONUS[i].toFixed(2) : 'Keep pushing';
      const jackpot = hasBonus ? '$' + COMPACT_JACKPOT[i].toFixed(2) : 'Keep pushing';
      const medal = i < RANK_MEDALS.length ? ' ' + RANK_MEDALS[i] : '';
      let row = '<tr>';
      row += `<td class="compact-rank">${i + 1}${medal}</td>`;
      row += `<td class="compact-name">${escapeHtml(name)}</td>`;
      row += `<td class="cell-currency">${fmt(r.sales, 'currency')}</td>`;
      row += `<td class="${hasBonus ? 'compact-bonus' : 'compact-keep'}">${bonus}</td>`;
      row += `<td class="${hasBonus ? 'compact-jackpot' : 'compact-keep'}">${jackpot}</td>`;
      row += '</tr>';
      return row;
    }

    let bodyHtml = '';
    const mainCount = Math.min(ranked.length, COMPACT_VISIBLE);
    for (let i = 0; i < mainCount; i++) bodyHtml += buildRow(i, ranked[i]);
    tableBody.innerHTML = bodyHtml;

    if (ranked.length > COMPACT_VISIBLE) {
      const extra = ranked.slice(COMPACT_VISIBLE);
      let footHtml = '<tr class="compact-toggle-row"><td colspan="5">';
      footHtml += '<details class="compact-details"><summary class="compact-summary">Ver ' + extra.length + ' más</summary>';
      footHtml += '<table class="compact-extra-table">';
      for (let i = 0; i < extra.length; i++) footHtml += buildRow(COMPACT_VISIBLE + i, extra[i]);
      footHtml += '</table></details></td></tr>';
      tableFoot.innerHTML = footHtml;
    } else {
      tableFoot.innerHTML = '';
    }
  }

  function updatePeriodInfo() {
    const range = getDateRange();
    if (!range) { periodInfo.textContent = ''; return; }
    const fmtDate = (s) => {
      const d = new Date(s + 'T00:00:00Z');
      return d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    };
    var inclEnd = addDays(range.to, -1);
    if (range.from === inclEnd) {
      periodInfo.textContent = fmtDate(range.from);
    } else {
      periodInfo.textContent = `${fmtDate(range.from)} — ${fmtDate(inclEnd)}`;
    }
  }

  // ── Calendar ──
  function showCalendar(show) {
    calOpen = show != null ? show : !calOpen;
    calSection.hidden = !calOpen;
    if (calOpen) renderCalendar();
  }

  function initCalendar() {
    const range = getDateRange();
    if (range) {
      const d = new Date(range.from + 'T00:00:00Z');
      calYear = d.getUTCFullYear();
      calMonth = d.getUTCMonth();
    } else {
      const now = new Date();
      calYear = now.getUTCFullYear();
      calMonth = now.getUTCMonth() - 1;
      if (calMonth < 0) { calMonth = 11; calYear--; }
    }
  }

  function renderCalendar() {
    let range = null;
    if (pickPhase === 1 && pickStart) {
      range = { from: pickStart, to: addDays(pickStart, 1) };
    } else if (currentPeriod !== 'all') {
      range = getDateRange();
    }
    calMonth0El.innerHTML = buildMonthHtml(calYear, calMonth, range);
    let ny = calYear, nm = calMonth + 1;
    if (nm > 11) { nm = 0; ny++; }
    calMonth1El.innerHTML = buildMonthHtml(ny, nm, range);
  }

  function buildMonthHtml(year, month, range) {
    const first = new Date(Date.UTC(year, month, 1));
    const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const dow = (first.getUTCDay() + 6) % 7;
    const mName = first.toLocaleDateString('es', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const now = new Date();
    const todayStr = toDateStr(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())));

    let h = '<div class="cal-month-title">' + mName + '</div><div class="cal-grid">';
    ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'].forEach(function (d) { h += '<div class="cal-wday">' + d + '</div>'; });
    for (let i = 0; i < dow; i++) h += '<div class="cal-cell"></div>';

    for (let d = 1; d <= days; d++) {
      var ds = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      var c = ['cal-cell', 'cal-day'];
      if (ds === todayStr) c.push('today');
      if (range && range.from && range.to) {
        var inclEnd = addDays(range.to, -1);
        if (range.from === inclEnd && ds === range.from) c.push('range-single');
        else if (ds === range.from) c.push('range-start');
        else if (ds === inclEnd) c.push('range-end');
        else if (ds > range.from && ds < inclEnd) c.push('in-range');
      }
      h += '<div class="' + c.join(' ') + '" data-date="' + ds + '"><span>' + d + '</span></div>';
    }
    h += '</div>';
    return h;
  }

  function navCalToRange() {
    const range = getDateRange();
    if (range) {
      const d = new Date(range.from + 'T00:00:00Z');
      calYear = d.getUTCFullYear();
      calMonth = d.getUTCMonth();
    } else {
      const now = new Date();
      calYear = now.getUTCFullYear();
      calMonth = now.getUTCMonth() - 1;
      if (calMonth < 0) { calMonth = 11; calYear--; }
    }
    renderCalendar();
  }

  function handleCalClick(e) {
    const dayEl = e.target.closest('.cal-day');
    if (!dayEl) return;
    e.preventDefault();
    e.stopPropagation();
    const date = dayEl.dataset.date;
    if (!date) return;

    if (currentPeriod !== 'custom') {
      periodButtons.querySelectorAll('.btn-chip').forEach(function (b) { b.classList.remove('active'); });
      periodButtons.querySelector('[data-period="custom"]').classList.add('active');
      currentPeriod = 'custom';
    }

    if (pickPhase === 0) {
      pickStart = date;
      pickPhase = 1;
      hoverDate = null;
      calHint.hidden = false;
      var fmtD = new Date(date + 'T00:00:00Z').toLocaleDateString('es', { day: 'numeric', month: 'short', timeZone: 'UTC' });
      calHint.textContent = 'Inicio: ' + fmtD + ' \u00b7 Selecciona la fecha de fin';
      renderCalendar();
    } else {
      var from = pickStart, to = date;
      if (from > to) { var tmp = from; from = to; to = tmp; }
      customFrom = from;
      customTo = to;
      pickPhase = 0;
      pickStart = null;
      hoverDate = null;
      calHint.hidden = true;
      render();
    }
  }

  var hoverDate = null;
  function handleCalHover(e) {
    if (pickPhase !== 1) return;
    var dayEl = e.target.closest('.cal-day');
    var date = dayEl ? dayEl.dataset.date : null;
    if (date === hoverDate) return;
    hoverDate = date;
    var from = pickStart, to = date || pickStart;
    if (from > to) { var tmp = from; from = to; to = tmp; }
    var range = { from: from, to: addDays(to, 1) };
    calMonth0El.innerHTML = buildMonthHtml(calYear, calMonth, range);
    var ny = calYear, nm = calMonth + 1;
    if (nm > 11) { nm = 0; ny++; }
    calMonth1El.innerHTML = buildMonthHtml(ny, nm, range);
  }

  // ── Sort Column Dropdown ──
  function populateSortDropdown() {
    sortColumn.innerHTML = '';
    for (const col of COLUMNS) {
      if (col.key === 'employee') continue;
      const opt = document.createElement('option');
      opt.value = col.key;
      opt.textContent = col.label;
      if (col.key === sortKey) opt.selected = true;
      sortColumn.appendChild(opt);
    }
  }

  // ── File Reading ──
  function readFile(file) {
    const isCSV = /\.csv$/i.test(file.name);
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          if (isCSV) {
            resolve(parseCSV(e.target.result));
          } else if (isExcel && typeof XLSX !== 'undefined') {
            const wb = XLSX.read(e.target.result, { type: 'array' });
            const sheet = wb.Sheets[wb.SheetNames[0]];
            const csvText = XLSX.utils.sheet_to_csv(sheet);
            resolve(parseCSV(csvText));
          } else {
            reject(new Error('Formato no soportado.'));
          }
        } catch (err) { reject(err); }
      };
      reader.onerror = () => reject(new Error('Error al leer el archivo.'));
      isExcel ? reader.readAsArrayBuffer(file) : reader.readAsText(file, 'UTF-8');
    });
  }

  // ── Hubstaff Storage ──
  function saveHubstaff() {
    try {
      if (hubstaffRaw) localStorage.setItem(HUBSTAFF_KEY, JSON.stringify(hubstaffRaw));
    } catch (e) {}
  }

  function loadHubstaff() {
    try {
      const raw = localStorage.getItem(HUBSTAFF_KEY);
      if (raw) hubstaffRaw = JSON.parse(raw);
    } catch (e) {}
  }

  // ── Google Sheets ──
  function getSheetCsvUrl(url) {
    const u = (url || '').trim();
    if (u.includes('/export?') && u.includes('format=csv')) return u;
    if (u.includes('/pub?') && u.includes('output=csv')) return u;
    const idMatch = u.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (idMatch) return `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv&gid=0`;
    return u;
  }

  function fetchSheet(url) {
    return fetch(getSheetCsvUrl(url), { mode: 'cors' })
      .then((r) => { if (!r.ok) throw new Error('No se pudo cargar.'); return r.text(); })
      .then((text) => parseCSV(text));
  }

  // ── Events ──
  fileInfloww.addEventListener('change', () => {
    const f = fileInfloww.files[0];
    if (!f) return;
    readFile(f).then((d) => {
      const count = mergeIntoHistory(d);
      labelInfloww.textContent = f.name;
      render();
      if (count > 0) {
        const stats = getHistoryStats();
        const msg = `${count} registros agregados a la base de datos (${stats.totalRecords} total).`;
        labelInfloww.textContent = f.name + ' ✓';
        console.log(msg);
      }
    }).catch((e) => alert(e.message));
    fileInfloww.value = '';
  });

  fileHubstaff.addEventListener('change', () => {
    const f = fileHubstaff.files[0];
    if (!f) return;
    readFile(f).then((d) => { hubstaffRaw = d; labelHubstaff.textContent = f.name; saveHubstaff(); render(); })
      .catch((e) => alert(e.message));
    fileHubstaff.value = '';
  });

  periodButtons.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-period]');
    if (!btn) return;
    periodButtons.querySelectorAll('.btn-chip').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentPeriod = btn.dataset.period;
    pickPhase = 0;
    pickStart = null;
    if (currentPeriod === 'custom') {
      calHint.hidden = false;
      calHint.textContent = 'Selecciona la fecha de inicio';
      showCalendar(true);
    } else {
      calHint.hidden = true;
      navCalToRange();
      showCalendar(true);
      render();
    }
  });

  hideInactiveCheck.addEventListener('change', () => {
    hideInactive = hideInactiveCheck.checked;
    render();
  });

  toggleAvgCheck.addEventListener('change', () => {
    showAvg = toggleAvgCheck.checked;
    render();
  });

  toggleCompactCheck.addEventListener('change', () => {
    compactView = toggleCompactCheck.checked;
    render();
  });

  sortColumn.addEventListener('change', () => {
    sortKey = sortColumn.value;
    if (sortDir === 'alpha') { sortDir = 'desc'; updateDirButtons(); }
    render();
  });

  [btnDesc, btnAsc, btnAlpha].forEach((btn) => {
    btn.addEventListener('click', () => {
      sortDir = btn.dataset.dir;
      updateDirButtons();
      render();
    });
  });

  function updateDirButtons() {
    [btnDesc, btnAsc, btnAlpha].forEach((b) => b.classList.remove('active'));
    const active = sortDir === 'asc' ? btnAsc : sortDir === 'alpha' ? btnAlpha : btnDesc;
    active.classList.add('active');
  }

  tableHead.addEventListener('click', (e) => {
    const th = e.target.closest('th');
    if (!th) return;
    const key = th.dataset.key;
    if (key === 'employee') { sortDir = 'alpha'; }
    else if (sortKey === key) { sortDir = sortDir === 'desc' ? 'asc' : 'desc'; }
    else { sortKey = key; sortDir = 'desc'; }
    sortColumn.value = sortKey;
    updateDirButtons();
    render();
  });

  toggleCalBtn.addEventListener('click', () => showCalendar());

  calMonth0El.addEventListener('mousedown', handleCalClick);
  calMonth1El.addEventListener('mousedown', handleCalClick);
  calMonth0El.addEventListener('mouseover', handleCalHover);
  calMonth1El.addEventListener('mouseover', handleCalHover);
  calPrevBtn.addEventListener('click', () => {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar();
  });
  calNextBtn.addEventListener('click', () => {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
  });

  document.addEventListener('mousedown', (e) => {
    if (!calOpen) return;
    if (calSection.contains(e.target) || toggleCalBtn.contains(e.target) || e.target.closest('#periodButtons')) return;
    showCalendar(false);
  });

  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => {
      if (!confirm('¿Borrar todo el historial de Infloww? Esta acción no se puede deshacer.')) return;
      clearHistory();
      render();
    });
  }

  // ── Google Sheets Export ──
  const GSHEET_CID_KEY = 'infloww_gsheet_client_id';
  const GSHEET_ID_KEY = 'infloww_gsheet_id';
  const exportBtn = $('exportSheets');
  const gsheetLink = $('gsheetLink');
  const gsheetSetup = $('gsheetSetup');
  const gsheetClientIdInput = $('gsheetClientId');
  const saveGsheetClientIdBtn = $('saveGsheetClientId');
  let gAccessToken = null;

  (function initGsheetLink() {
    const sid = localStorage.getItem(GSHEET_ID_KEY);
    if (sid) {
      gsheetLink.href = 'https://docs.google.com/spreadsheets/d/' + sid;
      gsheetLink.style.display = '';
    }
  })();

  const savedCid = localStorage.getItem(GSHEET_CID_KEY);
  if (savedCid) gsheetClientIdInput.value = savedCid;

  saveGsheetClientIdBtn.addEventListener('click', () => {
    const cid = gsheetClientIdInput.value.trim();
    if (!cid) { alert('Pega tu Client ID.'); return; }
    localStorage.setItem(GSHEET_CID_KEY, cid);
    gsheetSetup.classList.add('collapsed');
    startExport();
  });

  exportBtn.addEventListener('click', () => {
    const cid = localStorage.getItem(GSHEET_CID_KEY);
    if (!cid) {
      gsheetSetup.classList.toggle('collapsed');
      return;
    }
    startExport();
  });

  function startExport() {
    const cid = localStorage.getItem(GSHEET_CID_KEY);
    if (!cid) return;
    if (typeof google === 'undefined' || !google.accounts) {
      alert('Google Identity Services no se ha cargado. Recarga la página.');
      return;
    }
    exportBtn.disabled = true;
    exportBtn.textContent = 'Autenticando...';
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: cid,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      callback: (resp) => {
        if (resp.error) {
          alert('Error de autenticación: ' + resp.error);
          resetExportBtn();
          return;
        }
        gAccessToken = resp.access_token;
        doExport();
      },
      error_callback: (err) => {
        console.error('OAuth error:', err);
        alert('No se pudo autenticar. Asegúrate de permitir el popup y que el Client ID sea correcto.');
        resetExportBtn();
      },
    });
    try {
      tokenClient.requestAccessToken();
    } catch (e) {
      console.error('Token request failed:', e);
      alert('Error al iniciar autenticación: ' + e.message);
      resetExportBtn();
    }
  }

  async function sheetsApi(path, method, body) {
    const base = 'https://sheets.googleapis.com/v4/spreadsheets';
    const res = await fetch(base + path, {
      method: method || 'GET',
      headers: {
        'Authorization': 'Bearer ' + gAccessToken,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error('Sheets API error ' + res.status + ': ' + t);
    }
    return res.json();
  }

  function numOrDash(v) { return isNaN(v) ? '' : v; }
  function intOrDash(v) { return isNaN(v) ? '' : Math.round(v); }
  function pctOrDash(v) { return isNaN(v) ? '' : v / 100; }
  function hoursToSerial(h) { return isNaN(h) || h === 0 ? '' : h / 24; }
  function secsToSerial(s) { return isNaN(s) ? '' : s / 86400; }

  function fmtClockedExport(hours) {
    if (isNaN(hours)) return '';
    const totalMin = Math.round(hours * 60);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return m > 0 ? h + 'h ' + m + 'min' : h + 'h';
  }

  function buildEmployeeRow(r, rowNum) {
    return [
      r.employee,
      hoursToSerial(r.duration),
      numOrDash(r.sales),
      intOrDash(r.directMessagesSent),
      intOrDash(r.directPpvsSent),
      pctOrDash(r.goldenRatio),
      intOrDash(r.ppvsUnlocked),
      pctOrDash(r.unlockRate),
      intOrDash(r.fansChatted),
      intOrDash(r.fansWhoSpentMoney),
      pctOrDash(r.fanCvr),
      secsToSerial(r.responseTime),
      fmtClockedExport(r.clockedHours),
      hoursToSerial(r.duration) ? '=C' + rowNum + '/B' + rowNum + '/24' : '',
      intOrDash(r.characterCount),
      numOrDash(r.messagesSentPerHour),
    ];
  }

  function extractTeamName(group) {
    if (!group) return '';
    return group.replace(/^team\s+/i, '').trim().toUpperCase();
  }

  async function doExport() {
    try {
      exportBtn.textContent = 'Preparando datos...';
      const data = processData();
      if (!data.length) { alert('No hay datos para exportar.'); resetExportBtn(); return; }

      const sorted = [...data].sort((a, b) => a.employee.localeCompare(b.employee, 'es'));
      const teams = {};
      for (const r of sorted) {
        const tn = extractTeamName(r.group);
        if (tn) {
          if (!teams[tn]) teams[tn] = [];
          teams[tn].push(r);
        }
      }
      const teamNames = Object.keys(teams).sort();

      const sheetTitles = ['By employee', 'TL BONUSES', ...teamNames, 'HUBSTAFF HOURS'];

      exportBtn.textContent = 'Creando hoja...';
      const today = new Date().toLocaleDateString();
      const baseTitle = 'KPI Dashboard Export – ' + today;
      const lastDate = localStorage.getItem('infloww_export_date');
      let ver = parseInt(localStorage.getItem('infloww_export_ver') || '0', 10);
      if (lastDate === today) {
        ver++;
      } else {
        ver = 0;
      }
      localStorage.setItem('infloww_export_date', today);
      localStorage.setItem('infloww_export_ver', String(ver));
      const title = ver > 0 ? baseTitle + ' - ver' + ver : baseTitle;
      const createBody = {
        properties: { title },
        sheets: sheetTitles.map((t) => ({ properties: { title: t } })),
      };
      const created = await sheetsApi('', 'POST', createBody);
      let spreadsheetId = created.spreadsheetId;
      localStorage.setItem(GSHEET_ID_KEY, spreadsheetId);

      exportBtn.textContent = 'Escribiendo datos...';

      const HEADERS = [
        'Employees', 'Duration', 'Sales', 'Direct messages sent', 'Direct PPVs sent',
        'Golden ratio', 'PPVs unlocked', 'Unlock rate', 'Fans chatted',
        'Fans who spent money', 'Fan CVR', 'Response time (based on clocked hours)',
        'Clocked hours', 'Sales per hour', 'Character count', 'Messages sent per hour',
      ];
      const dataStart = 4;
      const dataEnd = dataStart + sorted.length - 1;
      const avgCols = { B: true, C: true, F: true, K: true, L: true, N: true, P: true };

      const byEmpRows = [];
      byEmpRows.push(HEADERS);
      const avgRow = ['AVERAGE'];
      for (let c = 1; c < HEADERS.length; c++) {
        const col = String.fromCharCode(65 + c);
        avgRow.push(avgCols[col] ? '=AVERAGE(' + col + dataStart + ':' + col + dataEnd + ')' : '');
      }
      byEmpRows.push(avgRow);

      const scoreRow = ['SCORE POINTS', '', '', '', '',
        '=IF(F2>=4%,1,0)', '', '=IF(H2>=45%,1,0)', '', '',
        '=IF(K2>=10%,3,IF(K2>=9%,2,IF(K2>=8%,1,0)))', '2', '', '1', '', ''];
      byEmpRows.push(scoreRow);

      for (let i = 0; i < sorted.length; i++) {
        byEmpRows.push(buildEmployeeRow(sorted[i], dataStart + i));
      }

      const valueRanges = [];
      valueRanges.push({ range: "'By employee'!A1", values: byEmpRows });

      const tlRows = [];
      let tlRow = 1;
      for (const tn of teamNames) {
        const teamData = teams[tn];
        const teamAvgSph = teamData.reduce((s, r) => s + (isNaN(r.salesPerHour) ? 0 : r.salesPerHour), 0) / teamData.length;
        const cvrs = teamData.filter((r) => !isNaN(r.fanCvr));
        const teamAvgCvr = cvrs.length ? cvrs.reduce((s, r) => s + r.fanCvr / 100, 0) / cvrs.length : 0;
        const rts = teamData.filter((r) => !isNaN(r.responseTime));
        const avgRtSec = rts.length ? rts.reduce((s, r) => s + r.responseTime, 0) / rts.length : 0;
        const teamAvgRt = rts.length ? secsToSerial(avgRtSec) : '-';

        tlRows.push([tn, '', '']);
        tlRows.push(['METRICS', 'CURRENT', 'BONUS']);
        tlRows.push(['Team Avg. $/hr', Math.round(teamAvgSph * 100) / 100, 0]);
        tlRows.push(['Fan CVR', teamAvgCvr, 0]);
        tlRows.push(['Avg. Reply Time', teamAvgRt, 0]);
        tlRows.push(['TOTAL:', '', '=SUM(D' + (tlRow + 1) + ':D' + (tlRow + 3) + ')']);
        tlRows.push([]);
        tlRow += 7;
      }
      valueRanges.push({ range: "'TL BONUSES'!B2", values: tlRows });

      for (const tn of teamNames) {
        const teamData = [...teams[tn]].sort((a, b) => (isNaN(b.sales) ? -Infinity : b.sales) - (isNaN(a.sales) ? -Infinity : a.sales));
        const teamRows = [];
        teamRows.push(HEADERS);
        for (let i = 0; i < teamData.length; i++) {
          teamRows.push(buildEmployeeRow(teamData[i], i + 2));
        }
        const lastRow = teamData.length + 1;
        const avgTeam = [];
        for (let c = 0; c < HEADERS.length; c++) {
          const col = String.fromCharCode(65 + c);
          if (col === 'K' || col === 'N' || col === 'P') {
            avgTeam.push('=AVERAGE(' + col + '2:' + col + lastRow + ')');
          } else {
            avgTeam.push('');
          }
        }
        teamRows.push(avgTeam);
        valueRanges.push({ range: "'" + tn + "'!A1", values: teamRows });
      }

      if (hubstaffRaw) {
        const hMap = buildMap(hubstaffRaw.headers, HUBSTAFF_ALIASES);
        const hRows = [['Organization', 'Time Zone', 'Member', 'TOTAL HOURS', 'Activity', 'Spent total', 'Currency']];
        const range = getDateRange();
        const dateIdx = hMap.date;
        const rows = range ? filterRows(hubstaffRaw.rows, dateIdx, range) : hubstaffRaw.rows;
        for (const row of rows) {
          const name = hMap.employee != null ? (row[hMap.employee] || '').trim() : '';
          if (!name) continue;
          hRows.push([
            'Chatting Wizard ENG',
            'UTC',
            name,
            fmtDurationExport(parseHours(row[hMap.hours])),
            row[4] || '',
            row[5] || '',
            row[6] || 'USD',
          ]);
        }
        valueRanges.push({ range: "'HUBSTAFF HOURS'!A1", values: hRows });
      } else {
        valueRanges.push({ range: "'HUBSTAFF HOURS'!A1", values: [['Organization', 'Time Zone', 'Member', 'TOTAL HOURS', 'Activity', 'Spent total', 'Currency'], ['(No hay datos de Hubstaff cargados)']] });
      }

      await sheetsApi('/' + spreadsheetId + '/values:batchUpdate', 'POST', {
        valueInputOption: 'USER_ENTERED',
        data: valueRanges,
      });

      exportBtn.textContent = 'Aplicando formato...';

      const meta = await sheetsApi('/' + spreadsheetId + '?fields=sheets.properties', 'GET');
      const sheetIdMap = {};
      for (const s of meta.sheets) sheetIdMap[s.properties.title] = s.properties.sheetId;

      const fmtReqs = [];

      function rgb(hex) {
        const r = parseInt(hex.slice(0, 2), 16) / 255;
        const g = parseInt(hex.slice(2, 4), 16) / 255;
        const b = parseInt(hex.slice(4, 6), 16) / 255;
        return { red: r, green: g, blue: b };
      }
      const WHITE = { red: 1, green: 1, blue: 1 };
      const BLACK = { red: 0, green: 0, blue: 0 };
      const defaultFont = { fontFamily: 'Nunito', fontSize: 10 };

      function cellFmt(sid, r1, r2, c1, c2, fmt) {
        const fields = Object.keys(fmt).map(k => 'userEnteredFormat.' + k).join(',');
        fmtReqs.push({ repeatCell: {
          range: { sheetId: sid, startRowIndex: r1, endRowIndex: r2, startColumnIndex: c1, endColumnIndex: c2 },
          cell: { userEnteredFormat: fmt }, fields,
        }});
      }

      function applyNumberFormats(sid, totalRows) {
        const colFormats = [
          { col: 1, fmt: '[h]:mm:ss' },
          { col: 2, fmt: '$#,##0.00' },
          { col: 3, fmt: '#,##0' },
          { col: 4, fmt: '#,##0' },
          { col: 5, fmt: '0.00%' },
          { col: 6, fmt: '#,##0' },
          { col: 7, fmt: '0.00%' },
          { col: 8, fmt: '#,##0' },
          { col: 9, fmt: '#,##0' },
          { col: 10, fmt: '0.00%' },
          { col: 11, fmt: '[h]:mm:ss' },
          null,
          { col: 13, fmt: '$#,##0.00' },
          { col: 14, fmt: '#,##0' },
          { col: 15, fmt: '0.00' },
        ];
        for (const cf of colFormats) {
          if (!cf) continue;
          cellFmt(sid, 1, totalRows, cf.col, cf.col + 1, {
            numberFormat: { type: cf.fmt.includes('$') ? 'CURRENCY' : cf.fmt.includes('%') ? 'PERCENT' : cf.fmt.includes(':') ? 'TIME' : 'NUMBER', pattern: cf.fmt },
          });
        }
      }

      function applyMainSheetFormat(sid, headerRow, avgRow, scoreRow, dataStart, dataEnd, totalCols) {
        cellFmt(sid, 0, dataEnd, 0, totalCols, {
          textFormat: Object.assign({}, defaultFont, { foregroundColor: BLACK }),
          horizontalAlignment: 'CENTER',
          verticalAlignment: 'MIDDLE',
        });

        cellFmt(sid, headerRow, headerRow + 1, 0, totalCols, {
          backgroundColor: rgb('F1C232'),
          textFormat: Object.assign({}, defaultFont, { bold: true, foregroundColor: rgb('5B0F00') }),
          horizontalAlignment: 'CENTER',
        });

        if (avgRow >= 0) {
          cellFmt(sid, avgRow, avgRow + 1, 0, 1, {
            backgroundColor: rgb('FF9900'),
            textFormat: Object.assign({}, defaultFont, { bold: true, foregroundColor: WHITE }),
          });
          cellFmt(sid, avgRow, avgRow + 1, 1, totalCols, {
            backgroundColor: rgb('FFFF00'),
            textFormat: Object.assign({}, defaultFont, { bold: true }),
          });
        }

        if (scoreRow >= 0) {
          cellFmt(sid, scoreRow, scoreRow + 1, 0, 1, {
            backgroundColor: rgb('1155CC'),
            textFormat: Object.assign({}, defaultFont, { bold: true, foregroundColor: WHITE }),
          });
          cellFmt(sid, scoreRow, scoreRow + 1, 1, totalCols, {
            backgroundColor: rgb('00FFFF'),
            textFormat: Object.assign({}, defaultFont, { bold: true }),
          });
        }

        cellFmt(sid, dataStart, dataEnd, 0, 1, {
          textFormat: Object.assign({}, defaultFont, { bold: false }),
          horizontalAlignment: 'LEFT',
        });

        cellFmt(sid, dataStart, dataEnd, 1, 2, {
          backgroundColor: rgb('EFEFEF'),
          textFormat: Object.assign({}, defaultFont, { bold: true, foregroundColor: rgb('B45F06') }),
        });

        const cyanCols = [10, 13, 15];
        for (const ci of cyanCols) {
          cellFmt(sid, headerRow, headerRow + 1, ci, ci + 1, {
            backgroundColor: rgb('00FFFF'),
            textFormat: Object.assign({}, defaultFont, { bold: true, foregroundColor: rgb('5B0F00') }),
          });
        }

        cellFmt(sid, dataStart, dataEnd, 2, 3, {
          backgroundColor: rgb('D9EAD3'),
        });

        fmtReqs.push({
          updateBorders: {
            range: { sheetId: sid, startRowIndex: headerRow, endRowIndex: dataEnd, startColumnIndex: 0, endColumnIndex: totalCols },
            top: { style: 'SOLID', width: 1, color: rgb('999999') },
            bottom: { style: 'SOLID', width: 1, color: rgb('999999') },
            left: { style: 'SOLID', width: 1, color: rgb('999999') },
            right: { style: 'SOLID', width: 1, color: rgb('999999') },
            innerHorizontal: { style: 'SOLID', width: 1, color: rgb('D9D9D9') },
            innerVertical: { style: 'SOLID', width: 1, color: rgb('D9D9D9') },
          },
        });

        fmtReqs.push({ autoResizeDimensions: { dimensions: { sheetId: sid, dimension: 'COLUMNS', startIndex: 0, endIndex: totalCols } } });

        fmtReqs.push({ updateDimensionProperties: {
          range: { sheetId: sid, dimension: 'ROWS', startIndex: 0, endIndex: dataEnd },
          properties: { pixelSize: 24 }, fields: 'pixelSize',
        }});
      }

      const byEmpSid = sheetIdMap['By employee'];
      if (byEmpSid != null) {
        const totalRows = 3 + sorted.length;
        applyNumberFormats(byEmpSid, totalRows);
        applyMainSheetFormat(byEmpSid, 0, 1, 2, 3, totalRows, 16);
      }

      for (const tn of teamNames) {
        const sid = sheetIdMap[tn];
        if (sid == null) continue;
        const cnt = teams[tn].length;
        const totalRows = 1 + cnt + 1;
        applyNumberFormats(sid, totalRows);
        applyMainSheetFormat(sid, 0, -1, -1, 1, 1 + cnt, 16);

        cellFmt(sid, 1 + cnt, 1 + cnt + 1, 10, 16, {
          backgroundColor: rgb('FFFF00'),
          textFormat: Object.assign({}, defaultFont, { bold: true }),
        });
      }

      const tlSid = sheetIdMap['TL BONUSES'];
      if (tlSid != null) {
        let offset = 1;
        for (let ti = 0; ti < teamNames.length; ti++) {
          cellFmt(tlSid, offset, offset + 1, 1, 4, {
            backgroundColor: rgb('D9D2E9'),
            textFormat: Object.assign({}, defaultFont, { bold: true, foregroundColor: rgb('20124D') }),
          });
          cellFmt(tlSid, offset + 1, offset + 2, 1, 4, {
            backgroundColor: rgb('8E7CC3'),
            textFormat: Object.assign({}, defaultFont, { bold: true, foregroundColor: WHITE }),
          });
          cellFmt(tlSid, offset + 5, offset + 6, 1, 4, {
            backgroundColor: rgb('FFE599'),
            textFormat: Object.assign({}, defaultFont, { bold: true }),
          });
          fmtReqs.push({
            updateBorders: {
              range: { sheetId: tlSid, startRowIndex: offset, endRowIndex: offset + 6, startColumnIndex: 1, endColumnIndex: 4 },
              top: { style: 'SOLID', width: 1, color: rgb('999999') },
              bottom: { style: 'SOLID', width: 1, color: rgb('999999') },
              left: { style: 'SOLID', width: 1, color: rgb('999999') },
              right: { style: 'SOLID', width: 1, color: rgb('999999') },
              innerHorizontal: { style: 'SOLID', width: 1, color: rgb('D9D9D9') },
              innerVertical: { style: 'SOLID', width: 1, color: rgb('D9D9D9') },
            },
          });
          offset += 7;
        }
        fmtReqs.push({ autoResizeDimensions: { dimensions: { sheetId: tlSid, dimension: 'COLUMNS', startIndex: 0, endIndex: 5 } } });
      }

      const hSid = sheetIdMap['HUBSTAFF HOURS'];
      if (hSid != null) {
        cellFmt(hSid, 0, 1, 0, 7, {
          backgroundColor: rgb('F1C232'),
          textFormat: Object.assign({}, defaultFont, { bold: true, foregroundColor: rgb('5B0F00') }),
          horizontalAlignment: 'CENTER',
        });
        fmtReqs.push({
          updateBorders: {
            range: { sheetId: hSid, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 7 },
            bottom: { style: 'SOLID', width: 2, color: rgb('B45F06') },
          },
        });
        fmtReqs.push({ autoResizeDimensions: { dimensions: { sheetId: hSid, dimension: 'COLUMNS', startIndex: 0, endIndex: 7 } } });
      }

      if (fmtReqs.length > 0) {
        await sheetsApi('/' + spreadsheetId + ':batchUpdate', 'POST', { requests: fmtReqs });
      }

      const sheetUrl = 'https://docs.google.com/spreadsheets/d/' + spreadsheetId;
      gsheetLink.href = sheetUrl;
      gsheetLink.style.display = '';
      window.open(sheetUrl, '_blank');
      resetExportBtn();
    } catch (err) {
      console.error(err);
      alert('Error al exportar: ' + err.message);
      resetExportBtn();
    }
  }

  function resetExportBtn() {
    exportBtn.disabled = false;
    exportBtn.textContent = 'Exportar a Google Sheets';
  }

  // ── Init ──
  (function migrateHistory() {
    var ver = parseInt(localStorage.getItem(HISTORY_VER_KEY)) || 0;
    if (ver < HISTORY_VER) {
      localStorage.removeItem(HISTORY_KEY);
      localStorage.setItem(HISTORY_VER_KEY, String(HISTORY_VER));
    }
  })();

  populateSortDropdown();
  loadHubstaff();
  initCalendar();
  render();
})();
