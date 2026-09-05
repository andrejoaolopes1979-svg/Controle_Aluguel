/* ============================================================
   Controle de Aluguel — app.js
   CRUD local de pagamentos (localStorage), gráfico e lista
   ============================================================ */

const PALETTE = ['#f97316', '#fb923c', '#f59e0b', '#fbbf24', '#fdba74', '#ea580c', '#d97706', '#c2410c', '#fde68a', '#fca5a5'];
const LS_PAYMENTS = 'aluguel_payments';
const LS_HISTORY = 'aluguel_history';

const $ = (id) => document.getElementById(id);
const moneyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtMoney = (v) => moneyFmt.format(Number(v) || 0);

let payments = [];
let chart = null;
let filters = { search: '', tipo: '', periodo: 0 };

/* ---------------- Inicialização ---------------- */
function init() {
  if (window.ChartDataLabels) Chart.register(ChartDataLabels);
  bindEvents();
  $('data').value = todayStr();
  loadLocal();
  renderAll();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
}

function bindEvents() {
  $('payment-form').addEventListener('submit', savePayment);
  $('valor').addEventListener('input', (e) => maskMoney(e.target));
  $('unidade-consumidora').addEventListener('change', () => {
    const info = unidadeMap()[$('unidade-consumidora').value.trim().toLowerCase()];
    if (info) {
      if (info.tipo) $('tipo-imovel').value = info.tipo;
      if (info.banco) $('banco').value = info.banco;
      if (info.pagamento) $('tipo-pagamento').value = info.pagamento;
    }
  });

  $('search').addEventListener('input', (e) => { filters.search = e.target.value; renderList(); });
  $('filter-btn').addEventListener('click', () => $('filter-options').classList.toggle('hidden'));
  $('filter-tipo').addEventListener('change', (e) => { filters.tipo = e.target.value; renderList(); });
  $('filter-periodo').addEventListener('change', (e) => { filters.periodo = Number(e.target.value) || 0; renderList(); });
  $('filter-clear').addEventListener('click', () => {
    filters = { search: '', tipo: '', periodo: 0 };
    $('search').value = '';
    $('filter-tipo').value = '';
    $('filter-periodo').value = '';
    renderList();
  });

  $('payment-list').addEventListener('click', (e) => {
    const btn = e.target.closest('.payment-delete');
    if (btn) deletePayment(btn.dataset.id, btn.dataset.tipo);
  });

  $('export-btn').addEventListener('click', exportData);
  $('import-file').addEventListener('change', importData);

  if ('serviceWorker' in navigator) {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      const btn = $('install-btn');
      btn.classList.remove('hidden');
      btn.addEventListener('click', () => { e.prompt(); btn.classList.add('hidden'); });
    });
  }
}

/* ---------------- Dados (localStorage) ---------------- */
function loadLocal() {
  payments = [];
  try {
    const raw = JSON.parse(localStorage.getItem(LS_PAYMENTS));
    if (Array.isArray(raw)) {
      payments = raw.map((p) => ({
        id: String(p.id || genId()),
        tipo: p.tipo || '',
        unidade: p.unidade || '',
        valor: Number(p.valor) || 0,
        data: p.data || '',
        pagamento: p.pagamento || '',
        banco: p.banco || ''
      }));
    }
  } catch { /* ignora */ }
  sortPayments();
}

function saveLocal() {
  localStorage.setItem(LS_PAYMENTS, JSON.stringify(payments));
}

function sortPayments() {
  payments.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function savePayment(e) {
  e.preventDefault();
  const tipo = $('tipo-imovel').value.trim();
  const unidade = $('unidade-consumidora').value.trim();
  const valor = parseMoney($('valor').value);
  const data = $('data').value;
  const pagamento = $('tipo-pagamento').value;
  const banco = $('banco').value.trim();

  if (!tipo || !unidade || !(valor > 0) || !data) {
    showToast('Preencha imóvel, unidade, valor e data.', true);
    return;
  }

  payments.push({ id: genId(), tipo, unidade, valor, data, pagamento, banco });
  sortPayments();
  saveLocal();
  addEntry({ tipo, unidade, pagamento, banco });
  clearForm();
  renderAll();
  showToast('Pagamento salvo!');
}

function deletePayment(id, tipo) {
  if (!confirm('Excluir este pagamento de ' + tipo + '?')) return;
  payments = payments.filter((p) => p.id !== id);
  saveLocal();
  renderAll();
  showToast('Pagamento excluído.');
}

/* ---------------- Backup (importar/exportar) ---------------- */
function exportData() {
  if (!payments.length) {
    showToast('Nenhum pagamento para exportar.', true);
    return;
  }
  const data = payments.map((p) => ({
    id: p.id,
    tipo: p.tipo,
    unidade: p.unidade,
    valor: p.valor,
    data: p.data,
    pagamento: p.pagamento,
    banco: p.banco
  }));
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `alugueis_backup_${todayStr()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('Backup exportado!');
}

function importData(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      const items = Array.isArray(imported) ? imported : (imported.pagamentos || null);
      if (!Array.isArray(items) || !items.length) {
        showToast('Arquivo JSON inválido ou vazio.', true);
        return;
      }

      const valid = items.filter((it) => it && it.tipo && it.unidade && Number(it.valor) > 0 && it.data);
      if (!valid.length) {
        showToast('Nenhum pagamento válido no arquivo.', true);
        return;
      }

      const msg = payments.length
        ? 'Importar ' + valid.length + ' pagamento(s)? Os dados atuais serão substituídos.'
        : 'Importar ' + valid.length + ' pagamento(s)?';
      if (!confirm(msg)) return;

      payments = valid.map((it) => ({
        id: /^[A-Za-z0-9_-]{1,64}$/.test(String(it.id)) ? String(it.id) : genId(),
        tipo: String(it.tipo),
        unidade: String(it.unidade),
        valor: Number(it.valor),
        data: String(it.data),
        pagamento: String(it.pagamento || 'Pix'),
        banco: String(it.banco || '')
      }));
      sortPayments();
      saveLocal();
      renderAll();
      showToast('Dados importados com sucesso!');
    } catch (err) {
      console.error(err);
      showToast('Erro ao processar arquivo JSON.', true);
    }
  };
  reader.readAsText(file, 'UTF-8');
}

/* ---------------- Renderização ---------------- */
function renderAll() {
  renderChart();
  renderList();
  updateDatalists();
  updateFilters();
}

function renderChart() {
  const canvas = $('chart-pie');
  const totalEl = $('chart-total');
  const emptyEl = $('chart-empty');

  const totals = {};
  payments.forEach((p) => {
    totals[p.tipo] = (totals[p.tipo] || 0) + p.valor;
  });
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0);

  totalEl.textContent = fmtMoney(total);

  if (!entries.length) {
    if (chart) { chart.destroy(); chart = null; }
    canvas.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    return;
  }

  canvas.classList.remove('hidden');
  emptyEl.classList.add('hidden');

  const labels = entries.map(([t]) => t);
  const data = entries.map(([, v]) => v);

  if (chart) chart.destroy();
  chart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: PALETTE,
        borderColor: '#1c1917',
        borderWidth: 3,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '58%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#e7e5e4',
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 14,
            font: { size: 12 }
          }
        },
        datalabels: {
          color: '#fff',
          backgroundColor: 'rgba(0, 0, 0, 0.55)',
          borderRadius: 6,
          padding: { top: 3, bottom: 3, left: 6, right: 6 },
          anchor: 'center',
          align: 'center',
          font: { weight: 'bold', size: 12 },
          formatter: (value) => {
            const pct = (value / total) * 100;
            if (pct < 4) return null;
            return (pct >= 10 ? Math.round(pct) : pct.toFixed(1)) + '%';
          }
        },
        tooltip: {
          backgroundColor: '#27272a',
          titleColor: '#fafafa',
          bodyColor: '#e7e5e4',
          borderColor: '#3f3f46',
          borderWidth: 1,
          callbacks: {
            label: (ctx) => {
              const v = data[ctx.dataIndex];
              return `${labels[ctx.dataIndex]}: ${fmtMoney(v)} (${((v / total) * 100).toFixed(1)}%)`;
            }
          }
        }
      }
    }
  });
}

function filteredPayments() {
  const { search, tipo, periodo } = filters;
  const term = search.trim().toLowerCase();
  let cutoff = '';
  if (periodo) {
    const d = new Date();
    d.setDate(d.getDate() - periodo);
    cutoff = d.toISOString().slice(0, 10);
  }
  return payments.filter((p) => {
    if (tipo && p.tipo !== tipo) return false;
    if (periodo && p.data < cutoff) return false;
    if (term) {
      const hay = (p.tipo + ' ' + p.unidade + ' ' + p.banco + ' ' + p.pagamento).toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  });
}

function renderList() {
  const list = $('payment-list');
  const emptyEl = $('list-empty');
  const items = filteredPayments();

  $('count-badge').textContent = payments.length;
  $('list-total').textContent = fmtMoney(items.reduce((s, p) => s + p.valor, 0));
  $('list-total-label').textContent = items.length === payments.length
    ? 'Total recebido:'
    : 'Total filtrado:';

  list.innerHTML = '';
  if (!items.length) {
    emptyEl.classList.remove('hidden');
    return;
  }
  emptyEl.classList.add('hidden');

  items.forEach((p) => {
    const li = document.createElement('li');
    li.className = 'payment-item';
    li.innerHTML = `
      <div class="payment-avatar">${escapeHtml((p.tipo || '?').charAt(0).toUpperCase())}</div>
      <div class="payment-info">
        <div class="p-title">${escapeHtml(p.tipo)}</div>
        <div class="p-sub">${escapeHtml([p.unidade, p.pagamento, p.banco].filter(Boolean).join(' · '))}</div>
      </div>
      <div class="payment-right">
        <div class="payment-value">${fmtMoney(p.valor)}</div>
        <div class="payment-date">${fmtDate(p.data)}</div>
      </div>
      <button class="payment-delete" data-id="${p.id}" data-tipo="${escapeHtml(p.tipo)}" aria-label="Excluir">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>`;
    list.appendChild(li);
  });
}

function updateDatalists() {
  const unidades = [];
  readHistory().entries.forEach((e) => {
    if (e.unidade && !unidades.includes(e.unidade)) unidades.push(e.unidade);
  });
  payments.forEach((p) => {
    if (p.unidade && !unidades.includes(p.unidade)) unidades.push(p.unidade);
  });

  const tipos = uniq(
    payments.map((p) => p.tipo).concat(readHistory().entries.map((e) => e.tipo))
  );
  const bancos = uniq(
    payments.map((p) => p.banco).concat(readHistory().entries.map((e) => e.banco))
  );

  fillDatalist($('lista-unidades'), unidades);
  fillDatalist($('lista-tipos'), tipos);
  fillDatalist($('lista-bancos'), bancos);
}

function updateFilters() {
  const sel = $('filter-tipo');
  const current = sel.value;
  const tipos = uniq(payments.map((p) => p.tipo));
  sel.innerHTML = '<option value="">Todos</option>' + tipos.map((t) =>
    `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
  sel.value = current;
}

function fillDatalist(el, values) {
  el.innerHTML = values.map((v) => `<option value="${escapeHtml(v)}"></option>`).join('');
}

/* ---------------- Memória / autocomplete ---------------- */
function readHistory() {
  try {
    const h = JSON.parse(localStorage.getItem(LS_HISTORY));
    if (h && Array.isArray(h.entries)) return h;
  } catch { /* ignora */ }
  return { entries: [] };
}

function addEntry(entry) {
  const h = readHistory();
  h.entries = [
    entry,
    ...h.entries.filter((e) => e.unidade !== entry.unidade || e.tipo !== entry.tipo)
  ].slice(0, 60);
  localStorage.setItem(LS_HISTORY, JSON.stringify(h));
}

function unidadeMap() {
  const map = {};
  readHistory().entries.forEach((e) => {
    if (e.unidade) map[e.unidade.toLowerCase()] = { tipo: e.tipo, pagamento: e.pagamento, banco: e.banco };
  });
  payments.forEach((p) => {
    if (p.unidade && !map[p.unidade.toLowerCase()]) {
      map[p.unidade.toLowerCase()] = { tipo: p.tipo, pagamento: p.pagamento, banco: p.banco };
    }
  });
  return map;
}

function clearForm() {
  ['tipo-imovel', 'unidade-consumidora', 'valor', 'banco'].forEach((id) => { $(id).value = ''; });
  $('tipo-pagamento').value = 'Pix';
  $('data').value = todayStr();
}

/* ---------------- Utilitários ---------------- */
function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function maskMoney(input) {
  const digits = input.value.replace(/\D/g, '');
  if (!digits) { input.value = ''; return; }
  const cents = parseInt(digits, 10);
  input.value = (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseMoney(str) {
  if (!str) return 0;
  const digits = String(str).replace(/\D/g, '');
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
}

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function uniq(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let toastTimer = null;
function showToast(text, isError) {
  const t = $('toast');
  t.textContent = text;
  t.className = 'toast' + (isError ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2600);
}

/* ---------------- Bootstrap ---------------- */
document.addEventListener('DOMContentLoaded', () => {
  init();
});