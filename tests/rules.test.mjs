import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePatient, DEFAULT_SETTINGS } from '../packages/rules/index.mjs';
const now = new Date('2026-09-26T04:00:00Z');
const base = { id: 'p1', source_id: 'POS-001', name: 'Test Patient', status: 'active', phone: '+6581234567', marketing_consent: 1, last_exam: '2026-09-01', last_purchase: '2026-09-01', lifetime_value: 80000, last_total: 24000, cl_interval: 90 };
test('overdue recall is evidence-backed; recent and inactive records are excluded', () => {
  const overdue = evaluatePatient({ ...base, last_exam: '2024-01-01' }, DEFAULT_SETTINGS, now).find(x => x.type === 'OVERDUE_RECALL');
  assert.ok(overdue); assert.ok(overdue.evidence.length); assert.equal(overdue.rule_version, '1.0.0');
  assert.equal(overdue.score, Object.values(overdue.components).reduce((a, b) => a + b, 0));
  assert.ok(!evaluatePatient(base, DEFAULT_SETTINGS, now).some(x => x.type === 'OVERDUE_RECALL'));
  assert.deepEqual(evaluatePatient({ ...base, status: 'inactive' }, DEFAULT_SETTINGS, now), []);
});
test('contact lens rule needs a recorded interval and no later replenishment', () => {
  assert.ok(evaluatePatient({ ...base, last_cl_purchase: '2026-01-01' }, DEFAULT_SETTINGS, now).some(x => x.type === 'CL_REPLENISHMENT'));
  assert.ok(!evaluatePatient({ ...base, last_cl_purchase: '2026-09-01' }, DEFAULT_SETTINGS, now).some(x => x.type === 'CL_REPLENISHMENT'));
  assert.ok(!evaluatePatient({ ...base, last_cl_purchase: '2026-01-01', cl_interval: null }, DEFAULT_SETTINGS, now).some(x => x.type === 'CL_REPLENISHMENT'));
});
test('rebooked appointments are suppressed; recent follow-ups and uncollected orders are detected', () => {
  const p = { ...base, missed_date: '2026-09-20', rebooked_date: '2026-10-02', order_date: '2026-08-01', order_status: 'ready', last_purchase: '2026-09-15' };
  const types = evaluatePatient(p, DEFAULT_SETTINGS, now).map(x => x.type);
  assert.ok(!types.includes('MISSED_APPOINTMENT')); assert.ok(types.includes('RECENT_PURCHASE')); assert.ok(types.includes('UNCOLLECTED_ORDER'));
});
 