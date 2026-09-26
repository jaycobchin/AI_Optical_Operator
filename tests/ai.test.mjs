import test from 'node:test';
import assert from 'node:assert/strict';
import { draftMessage, answerQuestion } from '../packages/ai/index.mjs';
test('provider output cannot introduce clinical claims, prices or unsupported facts', async () => {
  const draft = await draftMessage({ practice: { name: 'Test Optical' }, patient: { name: 'Aisha Tan' }, opportunity: { type: 'OVERDUE_RECALL' } }, { plan: async () => ({ tone: 'warm', message: 'You have glaucoma. Your lens costs $900.' }) });
  assert.ok(draft.text.includes('Aisha')); assert.ok(!/glaucoma|900/.test(draft.text));
});
test('language-provider failure falls back to a usable deterministic draft', async () => {
  const draft = await draftMessage({ practice: { name: 'Test Optical' }, patient: {}, opportunity: { type: 'CL_REPLENISHMENT' } }, { plan: async () => { throw Error('offline'); } });
  assert.equal(draft.fallback, true); assert.ok(!/undefined|null|in stock/.test(draft.text));
});
test('unavailable analytics are acknowledged without fabricated figures', () => {
  const answer = answerQuestion('What is my margin?', { revenue: [] });
  assert.match(answer.answer, /available|supported/i);
});
test('encounters and clinical records are excluded from language-provider context', async () => {
  let supplied;
  const draft = await draftMessage({
    practice: { name: 'Test Optical' }, patient: { name: 'Aisha Tan', clinical_records: [{ metadata: 'sensitive clinical content' }] },
    opportunity: { type: 'OVERDUE_RECALL', evidence: [{ value: 'sensitive clinical content' }] },
    encounters: [{ provider: 'Private clinician' }], clinical_records: [{ metadata: 'sensitive clinical content' }],
  }, { plan: async input => { supplied = input; return { tone: 'warm' }; } });
  assert.deepEqual(supplied, { type: 'OVERDUE_RECALL', tone: 'warm' });
  assert.ok(!/sensitive|Private clinician/.test(draft.text));
  assert.equal(draft.requires_human_approval, true);
});
