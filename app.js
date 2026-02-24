(function () {
  const STORAGE_KEY = 'infloww_kpi_data';
  const SHEET_URL_KEY = 'infloww_sheet_url';
  const NEXT_UPDATE_KEY = 'infloww_kpi_next_auto_update';
  const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
  const REFERENCE_UTC = Date.UTC(2020, 0, 1, 0, 0, 0, 0); // 12:00 AM UTC, referencia para "cada 2 días"
  const SCHEDULE_CHECK_MS = 60 * 1000; // comprobar cada minuto si toca actualizar

  const fileInfloww = document.getElementById('fileInfloww');
  const fileHubstaff = document.getElementById('fileHubstaff');
  const labelInfloww = document.getElementById('labelInfloww');
  const labelHubstaff = document.getElementById('labelHubstaff');
  const toggleSheetPanel = document.getElementById('toggleSheetPanel');
  const sheetPanel = document.getElementById('sheetPanel');
  const sheetUrlInput = document.getElementById('sheetUrl');
  const saveSheetUrlBtn = document.getElementById('saveSheetUrl');
  const lastUpdateEl = document.getElementById('lastUpdate');
  const nextUpdateEl = document.getElementById('nextUpdate');
  const emptyState = document.getElementById('emptyState');
  const kpiGrid = document.getElementById('kpiGrid');
  const tableSection = document.getElementById('tableSection');
  const dataTable = document.getElementById('dataTable');

  let sheetRefreshTimer = null;
  let inflowwData = null; // { headers, rows }
  let hubstaffData = null; // { headers, rows }

  const COLUMN_ALIASES = {
    earnings: ['earnings', 'revenue', 'ingresos', 'net', 'gross', 'amount'],
    subs: ['subs', 'subscriptions', 'suscripciones', 'subscribers'],
    clicks: ['clicks', 'click', 'clics'],
    claims: ['claims', 'claim', 'conversiones'],
    trials: ['trials', 'trial', 'free trial'],
  };

  const HUBSTAFF_COLUMN_ALIASES = {
    hours: ['hours', 'time', 'duration', 'tracked', 'time tracked', 'total time', 'hours worked', 'horas', 'tiempo'],
    pay: ['pay', 'amount', 'cost', 'paid', 'salary', 'pago', 'costo'],
  };

  function normalizeHeader(h) {
    return String(h || '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function findColumnIndex(headers, aliases) {
    const normalized = headers.map(normalizeHeader);
    for (const alias of aliases) {
      const i = normalized.findIndex((h) => h.includes(alias) || alias.includes(h));
      if (i !== -1) return i;
    }
    return -1;
  }

  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length === 0) return { headers: [], rows: [] };
    const delimiter = text.includes(';') ? ';' : ',';
    const headers = parseCSVLine(lines[0], delimiter);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      rows.push(parseCSVLine(lines[i], delimiter));
    }
    return { headers, rows };
  }

  function parseCSVLine(line, delimiter) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (!inQuotes && c === delimiter) {
        result.push(cleanCell(current));
        current = '';
      } else {
        current += c;
      }
    }
    result.push(cleanCell(current));
    return result;
  }

  function cleanCell(val) {
    const s = String(val || '').trim();
    if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1).replace(/""/g, '"');
    return s;
  }

  function parseNumber(val) {
    if (val === '' || val == null) return NaN;
    const s = String(val).replace(/,/g, '.').replace(/\s/g, '');
    const n = parseFloat(s);
    return isNaN(n) ? NaN : n;
  }

  /** Parsea horas en formato "1.5" o "1:30" (h:mm) */
  function parseHours(val) {
    if (val === '' || val == null) return NaN;
    const s = String(val).trim().replace(/,/g, '.');
    const num = parseFloat(s);
    if (!isNaN(num)) return num;
    const match = s.match(/^(\d+):(\d{2})$/);
    if (match) return parseInt(match[1], 10) + parseInt(match[2], 10) / 60;
    return NaN;
  }

  function buildColumnMap(headers, aliasesObj) {
    const map = {};
    for (const [key, aliases] of Object.entries(aliasesObj)) {
      const idx = findColumnIndex(headers, aliases);
      if (idx !== -1) map[key] = idx;
    }
    return map;
  }

  function computeInflowwKPIs(headers, rows) {
    const columnMap = buildColumnMap(headers, COLUMN_ALIASES);
    const kpis = {};
    const numeric = (key) => {
      const idx = columnMap[key];
      if (idx == null) return [];
      return rows.map((r) => parseNumber(r[idx])).filter((n) => !isNaN(n));
    };
    const sum = (arr) => arr.reduce((a, b) => a + b, 0);

    const earningsArr = numeric('earnings');
    const subsArr = numeric('subs');
    const clicksArr = numeric('clicks');
    const claimsArr = numeric('claims');

    if (earningsArr.length) kpis.earnings = sum(earningsArr);
    if (subsArr.length) kpis.subs = sum(subsArr);
    if (clicksArr.length) kpis.clicks = sum(clicksArr);
    if (claimsArr.length) kpis.claims = sum(claimsArr);
    if (clicksArr.length && subsArr.length) {
      const totalClicks = sum(clicksArr);
      kpis.conversionRate = totalClicks ? (sum(subsArr) / totalClicks) * 100 : 0;
    }
    if (clicksArr.length && claimsArr.length) {
      const totalClicks = sum(clicksArr);
      kpis.claimRate = totalClicks ? (sum(claimsArr) / totalClicks) * 100 : 0;
    }
    kpis.rowCount = rows.length;
    return kpis;
  }

  function computeHubstaffKPIs(headers, rows) {
    const columnMap = buildColumnMap(headers, HUBSTAFF_COLUMN_ALIASES);
    const kpis = {};
    const hoursIdx = columnMap.hours;
    const payIdx = columnMap.pay;
    if (hoursIdx != null) {
      const hoursArr = rows.map((r) => parseHours(r[hoursIdx])).filter((n) => !isNaN(n));
      if (hoursArr.length) kpis.totalHours = hoursArr.reduce((a, b) => a + b, 0);
    }
    if (payIdx != null) {
      const payArr = rows.map((r) => parseNumber(r[payIdx])).filter((n) => !isNaN(n));
      if (payArr.length) kpis.totalPay = payArr.reduce((a, b) => a + b, 0);
    }
    kpis.rowCount = rows.length;
    return kpis;
  }

  function renderKPIs(inflowwKpis, hubstaffKpis) {
    const cards = [];
    const fmtCurrency = (n) => (n == null || isNaN(n) ? '-' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }));
    const fmtNum = (n) => (n == null || isNaN(n) ? '-' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 }));
    const fmtPct = (n) => (n == null || isNaN(n) ? '-' : Number(n).toFixed(1) + '%');
    const fmtHours = (n) => (n == null || isNaN(n) ? '-' : Number(n).toFixed(1) + ' h');

    if (inflowwKpis) {
      if (inflowwKpis.earnings != null) cards.push({ label: 'Ingresos totales (Infloww)', value: fmtCurrency(inflowwKpis.earnings), currency: true });
      if (inflowwKpis.subs != null) cards.push({ label: 'Suscripciones', value: fmtNum(inflowwKpis.subs) });
      if (inflowwKpis.clicks != null) cards.push({ label: 'Clicks', value: fmtNum(inflowwKpis.clicks) });
      if (inflowwKpis.claims != null) cards.push({ label: 'Claims (trials)', value: fmtNum(inflowwKpis.claims) });
      if (inflowwKpis.conversionRate != null) cards.push({ label: 'Conversión (subs/clicks)', value: fmtPct(inflowwKpis.conversionRate) });
      if (inflowwKpis.claimRate != null) cards.push({ label: 'Tasa claims', value: fmtPct(inflowwKpis.claimRate) });
      if (inflowwKpis.rowCount != null) cards.push({ label: 'Filas Infloww', value: fmtNum(inflowwKpis.rowCount) });
    }

    if (hubstaffKpis) {
      if (hubstaffKpis.totalHours != null) cards.push({ label: 'Horas totales (Hubstaff)', value: fmtHours(hubstaffKpis.totalHours) });
      if (hubstaffKpis.totalPay != null) cards.push({ label: 'Pago total (Hubstaff)', value: fmtCurrency(hubstaffKpis.totalPay), currency: true });
      if (hubstaffKpis.rowCount != null) cards.push({ label: 'Registros Hubstaff', value: fmtNum(hubstaffKpis.rowCount) });
    }

    if (inflowwKpis && hubstaffKpis && inflowwKpis.earnings != null && hubstaffKpis.totalHours != null && hubstaffKpis.totalHours > 0) {
      const revPerHour = inflowwKpis.earnings / hubstaffKpis.totalHours;
      cards.push({ label: 'Ingresos por hora', value: fmtCurrency(revPerHour), currency: true });
    }

    if (cards.length === 0) {
      kpiGrid.hidden = true;
      emptyState.hidden = false;
      return;
    }

    kpiGrid.innerHTML = cards
      .map((c) => `<div class="kpi-card"><div class="kpi-label">${escapeHtml(c.label)}</div><div class="kpi-value ${c.currency ? 'currency' : ''}">${escapeHtml(c.value)}</div></div>`)
      .join('');
    kpiGrid.hidden = false;
    emptyState.hidden = true;
  }

  function renderTable(headers, rows, maxRows) {
    if (!headers || !rows.length) {
      tableSection.hidden = true;
      return;
    }
    const slice = rows.slice(0, maxRows == null ? 50 : maxRows);
    let html = '<thead><tr>' + headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('') + '</tr></thead><tbody>';
    for (const row of slice) {
      const cells = headers.map((_, i) => row[i] ?? '');
      html += '<tr>' + cells.map((c) => `<td>${escapeHtml(c)}</td>`).join('') + '</tr>';
    }
    html += '</tbody>';
    dataTable.innerHTML = html;
    tableSection.hidden = false;
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function setLastUpdate(date) {
    const d = date instanceof Date ? date : new Date();
    lastUpdateEl.textContent = 'Última actualización: ' + d.toLocaleString('es');
  }

  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        infloww: inflowwData ? { headers: inflowwData.headers, rows: inflowwData.rows } : null,
        hubstaff: hubstaffData ? { headers: hubstaffData.headers, rows: hubstaffData.rows } : null,
        at: new Date().toISOString(),
      }));
    } catch (e) {}
  }

  function render() {
    const inflowwKpis = inflowwData ? computeInflowwKPIs(inflowwData.headers, inflowwData.rows) : null;
    const hubstaffKpis = hubstaffData ? computeHubstaffKPIs(hubstaffData.headers, hubstaffData.rows) : null;

    if (!inflowwData && !hubstaffData) {
      emptyState.hidden = false;
      kpiGrid.hidden = true;
      tableSection.hidden = true;
      return;
    }

    renderKPIs(inflowwKpis, hubstaffKpis);
    if (inflowwData && inflowwData.rows.length) {
      renderTable(inflowwData.headers, inflowwData.rows);
    } else if (hubstaffData && hubstaffData.rows.length) {
      renderTable(hubstaffData.headers, hubstaffData.rows);
    } else {
      tableSection.hidden = true;
    }
    setLastUpdate(new Date());
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.infloww) inflowwData = data.infloww;
      if (data.hubstaff) hubstaffData = data.hubstaff;
      render();
    } catch (e) {}
  }

  function readFile(file) {
    const isCSV = /\.csv$/i.test(file.name);
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          if (isCSV) {
            resolve(parseCSV(text));
          } else if (isExcel && typeof XLSX !== 'undefined') {
            const wb = XLSX.read(e.target.result, { type: 'array' });
            const first = wb.Sheets[wb.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(first, { header: 1, defval: '' });
            const headers = data[0] || [];
            const rows = data.slice(1).map((r) => headers.map((_, i) => (r[i] != null ? String(r[i]) : '')));
            resolve({ headers, rows });
          } else {
            reject(new Error('Formato no soportado. Usa CSV o Excel (.xlsx, .xls).'));
          }
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
      if (isExcel) reader.readAsArrayBuffer(file);
      else reader.readAsText(file, 'UTF-8');
    });
  }

  function getSheetCsvUrl(url) {
    const u = (url || '').trim();
    if (u.includes('/export?') && u.includes('format=csv')) return u;
    if (u.includes('/pub?') && u.includes('output=csv')) return u;
    const idMatch = u.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (idMatch) return `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv&gid=0`;
    if (u.match(/\/d\/e\/([a-zA-Z0-9_-]+)/)) return u.split('?')[0] + '?output=csv';
    return u;
  }

  function fetchSheetAsCsv(url) {
    return fetch(getSheetCsvUrl(url), { mode: 'cors' })
      .then((r) => {
        if (!r.ok) throw new Error('No se pudo cargar la hoja. ¿Está publicada en la web?');
        return r.text();
      })
      .then((text) => parseCSV(text));
  }

  /** Próxima fecha 12:00 AM UTC en el ciclo "cada 2 días" (referencia: 2020-01-01 00:00 UTC). */
  function getNextScheduledTime() {
    let next = REFERENCE_UTC;
    const now = Date.now();
    while (next <= now) next += TWO_DAYS_MS;
    return next;
  }

  function getStoredNextUpdate() {
    const stored = localStorage.getItem(NEXT_UPDATE_KEY);
    const num = stored ? parseInt(stored, 10) : NaN;
    return !isNaN(num) ? num : getNextScheduledTime();
  }

  function setStoredNextUpdate(timestamp) {
    localStorage.setItem(NEXT_UPDATE_KEY, String(timestamp));
  }

  function updateNextUpdateDisplay() {
    if (!nextUpdateEl) return;
    const url = localStorage.getItem(SHEET_URL_KEY);
    if (!url) {
      nextUpdateEl.textContent = '';
      return;
    }
    const next = getStoredNextUpdate();
    const date = new Date(next);
    nextUpdateEl.textContent = 'Próxima actualización automática: ' + date.toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC (cada 2 días)';
  }

  function runScheduledRefresh() {
    const url = localStorage.getItem(SHEET_URL_KEY);
    if (!url) return;
    fetchSheetAsCsv(url)
      .then(({ headers, rows }) => {
        if (headers.length) {
          inflowwData = { headers, rows };
          saveToStorage();
          render();
        }
        const next = getNextScheduledTime();
        setStoredNextUpdate(next);
        updateNextUpdateDisplay();
      })
      .catch((err) => console.warn('Error al actualizar desde Google Sheets:', err));
  }

  function startSheetRefresh() {
    stopSheetRefresh();
    const url = localStorage.getItem(SHEET_URL_KEY);
    if (!url) return;
    let nextScheduled = getStoredNextUpdate();
    if (Date.now() >= nextScheduled) {
      runScheduledRefresh();
    } else {
      setStoredNextUpdate(nextScheduled);
    }
    updateNextUpdateDisplay();
    sheetRefreshTimer = setInterval(() => {
      if (Date.now() >= getStoredNextUpdate()) runScheduledRefresh();
    }, SCHEDULE_CHECK_MS);
  }

  function stopSheetRefresh() {
    if (sheetRefreshTimer) {
      clearInterval(sheetRefreshTimer);
      sheetRefreshTimer = null;
    }
  }

  fileInfloww.addEventListener('change', () => {
    const file = fileInfloww.files[0];
    if (!file) return;
    readFile(file)
      .then(({ headers, rows }) => {
        inflowwData = { headers, rows };
        labelInfloww.textContent = file.name;
        saveToStorage();
        render();
      })
      .catch((err) => alert(err.message));
    fileInfloww.value = '';
  });

  fileHubstaff.addEventListener('change', () => {
    const file = fileHubstaff.files[0];
    if (!file) return;
    readFile(file)
      .then(({ headers, rows }) => {
        hubstaffData = { headers, rows };
        labelHubstaff.textContent = file.name;
        saveToStorage();
        render();
      })
      .catch((err) => alert(err.message));
    fileHubstaff.value = '';
  });

  toggleSheetPanel.addEventListener('click', () => {
    sheetPanel.classList.toggle('collapsed');
  });

  saveSheetUrlBtn.addEventListener('click', () => {
    const url = sheetUrlInput.value.trim();
    if (!url) {
      alert('Escribe la URL de la Google Sheet.');
      return;
    }
    localStorage.setItem(SHEET_URL_KEY, url);
    sheetUrlInput.value = '';
    sheetPanel.classList.add('collapsed');
    startSheetRefresh();
    alert('URL guardada. Los datos de Infloww se actualizarán cada 5 minutos. Las horas de Hubstaff se actualizan solo al subir un nuevo CSV.');
  });

  loadFromStorage();
  const savedSheetUrl = localStorage.getItem(SHEET_URL_KEY);
  if (savedSheetUrl) {
    sheetUrlInput.value = savedSheetUrl;
    startSheetRefresh();
  }
})();
