import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase,tenantStore } from '../database/db.mjs';
import { inspectFile,validateImport,commitImport } from '../connectors/generic-csv/index.mjs';
function fixture() { const db=openDatabase(':memory:'); db.prepare('INSERT INTO practices(id,name,created_at) VALUES(?,?,?)').run('a','A','2026-09-26'); return {db,store:tenantStore(db,'a')}; }
test('CSV mapping surfaces invalid dates, duplicate candidates and no consent', async () => {
  const {db,store}=fixture();
  const file=await inspectFile(Buffer.from('Patient ID,Full Name,Mobile,Last Exam,Consent\np1,Alex Tan,81234567,2024-01-01,yes\np2,Alex Tan,81234567,2024-01-01,no\np3,Bad Date,81234567,2026-02-31,yes'),'patients.csv','patients');
  const report=validateImport(store,file.rows,file.mapping,'patients');
  assert.equal(report.valid,2); assert.equal(report.invalid,1); assert.equal(report.duplicates,1);
  const result=commitImport(store,{...file,entity:'patients'},null,false);
  assert.equal(result.imported,1); assert.equal(store.all('patients').length,1);
  const again=commitImport(store,{...file,entity:'patients'},null,false); assert.equal(again.updated,1); assert.equal(store.all('patients').length,1); db.close();
});
test('duplicate candidates can be retained as separate identities, never merged', () => {
  const {db,store}=fixture(); const rows=[{id:'p1',name:'Alex Tan',phone:'81234567'},{id:'p2',name:'Alex Tan',phone:'81234567'}];
  commitImport(store,{filename:'family.csv',entity:'patients',rows,mapping:{source_id:'id',name:'name',phone:'phone'}},null,true);
  assert.equal(store.all('patients').length,2); assert.equal(store.all('patients')[0].marketing_consent,0); db.close();
});
test('transaction refresh is idempotent and cannot bind to a different tenant patient', () => {
  const {db,store}=fixture(); const file={filename:'transactions.csv',entity:'transactions',rows:[{id:'t1',patient:'missing',date:'2026-01-01',total:'100'}],mapping:{source_id:'id',patient_source_id:'patient',date:'date',total:'total'}};
  assert.equal(validateImport(store,file.rows,file.mapping,file.entity).invalid,1); commitImport(store,file,null,false); assert.equal(store.all('transactions').length,0); db.close();
});
test('invalid CSV headers and formulas are rejected before ingestion', async () => {
  await assert.rejects(() => inspectFile(Buffer.from('name,name\nA,B'),'bad.csv','patients'),/duplicate/i);
});
