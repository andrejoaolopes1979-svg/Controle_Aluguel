/* ============================================================
   Testes da lógica de conciliação de backup (Node.js)
   Executar: node --test test/
   ============================================================ */
const { test } = require('node:test');
const assert = require('node:assert');

const memory = {};
global.localStorage = {
  getItem: (k) => (k in memory ? memory[k] : null),
  setItem: (k, v) => { memory[k] = String(v); },
  removeItem: (k) => { delete memory[k]; }
};

const {
  reconcile,
  decideSync,
  hasData,
  readLocalSnapshot,
  LS_PAYMENTS,
  LS_HISTORY,
  LS_SAVED_AT
} = require('../app.js');

const payment = { id: '1', tipo: 'Casa', unidade: 'U-1', valor: 1200, data: '2026-01-10', pagamento: 'Pix', banco: 'Itaú' };
const hist = { entries: [{ tipo: 'Casa', unidade: 'U-1', pagamento: 'Pix', banco: 'Itaú' }] };

function empty() {
  return { payments: null, history: null, savedAt: null };
}

test('migração inicial: localStorage legado preenche o IndexedDB', () => {
  const r = reconcile({ payments: [payment], history: null, savedAt: null }, null);
  assert.strictEqual(r.source, 'local');
  assert.strictEqual(r.payments.length, 1);
  assert.strictEqual(r.payments[0].tipo, 'Casa');
  assert.strictEqual(decideSync(r, null), 'idb');
});

test('localStorage limpo restaura do IndexedDB', () => {
  const idb = { payments: [payment], history: hist, savedAt: 2000 };
  const r = reconcile(empty(), idb);
  assert.strictEqual(r.source, 'idb');
  assert.strictEqual(r.payments[0].unidade, 'U-1');
  assert.strictEqual(r.savedAt, 2000);
  assert.strictEqual(decideSync(r, idb), 'local');
});

test('IndexedDB limpo restaura do localStorage', () => {
  const r = reconcile({ payments: [payment], history: hist, savedAt: 2000 }, null);
  assert.strictEqual(r.source, 'local');
  assert.strictEqual(decideSync(r, null), 'idb');
});

test('local mais novo vence e sincroniza o IndexedDB', () => {
  const local = { payments: [payment], history: hist, savedAt: 2000 };
  const idb = { payments: [], history: { entries: [] }, savedAt: 1000 };
  const r = reconcile(local, idb);
  assert.strictEqual(r.source, 'local');
  assert.strictEqual(decideSync(r, idb), 'idb');
});

test('IndexedDB mais novo vence e sincroniza o localStorage', () => {
  const local = { payments: [], history: { entries: [] }, savedAt: 1000 };
  const idb = { payments: [payment], history: hist, savedAt: 2000 };
  const r = reconcile(local, idb);
  assert.strictEqual(r.source, 'idb');
  assert.strictEqual(decideSync(r, idb), 'local');
});

test('timestamps iguais não exigem sincronização', () => {
  const data = { payments: [payment], history: hist, savedAt: 2000 };
  const r = reconcile(data, data);
  assert.strictEqual(r.source, 'local');
  assert.strictEqual(decideSync(r, data), 'none');
});

test('nenhuma fonte → estado vazio', () => {
  const r = reconcile(empty(), null);
  assert.strictEqual(r.source, 'none');
  assert.deepStrictEqual(r.payments, []);
  assert.deepStrictEqual(r.history, { entries: [] });
});

test('deleção total (array vazio) prevalece sobre backup antigo', () => {
  const r = reconcile(
    { payments: [], history: { entries: [] }, savedAt: 3000 },
    { payments: [payment], history: hist, savedAt: 1000 }
  );
  assert.strictEqual(r.source, 'local');
  assert.deepStrictEqual(r.payments, []);
});

test('hasData distingue vazio de estado limpo', () => {
  assert.strictEqual(hasData(empty()), false);
  assert.strictEqual(hasData({ payments: [], history: { entries: [] }, savedAt: 2000 }), true);
  assert.strictEqual(hasData({ payments: [payment], history: hist, savedAt: null }), true);
});

test('readLocalSnapshot lê as três chaves', () => {
  memory[LS_PAYMENTS] = JSON.stringify([payment]);
  memory[LS_HISTORY] = JSON.stringify(hist);
  memory[LS_SAVED_AT] = '2000';
  const snap = readLocalSnapshot();
  assert.strictEqual(snap.payments.length, 1);
  assert.strictEqual(snap.history.entries.length, 1);
  assert.strictEqual(snap.savedAt, 2000);
});

test('readLocalSnapshot tolera localStorage inválido', () => {
  memory[LS_PAYMENTS] = 'não é json';
  memory[LS_HISTORY] = null;
  delete memory[LS_SAVED_AT];
  const snap = readLocalSnapshot();
  assert.strictEqual(snap.payments, null);
  assert.strictEqual(snap.history, null);
  assert.strictEqual(snap.savedAt, null);
});