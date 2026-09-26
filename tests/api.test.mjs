import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../apps/api/app.mjs';
import { openDatabase, tenantStore, passwordHash } from '../database/db.mjs';

test('authenticated connector import respects tenant, role, capability and approval boundaries', async () => {
  const db = openDatabase(':memory:');
  for (const tenant of ['a', 'b']) {
    db.prepare('INSERT INTO practices(id,name,created_at) VALUES(?,?,?)').run(tenant, tenant, '2026-09-26');
    for (const role of ['owner', 'staff']) tenantStore(db, tenant).insert('users', {
      id: `${tenant}-${role}`, email: `${role}@${tenant}.test`, name: role, role,
      password_hash: passwordHash('TestingPassword2026!'), created_at: '2026-09-26',
    });
  }
  const server = createApp({ db, demo: false }).listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = (path, cookie = '', body, method = 'POST') => fetch(base + path, {
      method: body === undefined ? 'GET' : method,
      headers: { Cookie: cookie, 'X-Requested-With': 'OpticalOperator', ...(body instanceof FormData || body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
    const login = async email => {
      const response = await request('/api/auth/login', '', { email, password: 'TestingPassword2026!' });
      assert.equal(response.status, 200);
      return response.headers.get('set-cookie').split(';')[0];
    };
    const a = await login('owner@a.test'), b = await login('owner@b.test'), staff = await login('staff@a.test');
    assert.equal((await request('/api/connectors')).status, 401);
    const connectors = await (await request('/api/connectors', a)).json();
    assert.equal(connectors.find(c => c.id === 'plato').status, 'unavailable');
    const upload = (cookie, connector = 'generic-csv') => {
      const body = new FormData(); body.set('connector', connector); body.set('entity', 'patients');
      body.set('file', new Blob(['Patient ID,Full Name,Consent,Mobile,Last Exam\np1,Alex Tan,yes,81234567,2024-01-01']), 'patients.csv');
      return request('/api/imports/inspect', cookie, body);
    };
    assert.equal((await upload(a, 'plato')).status, 409);
    assert.equal((await upload(a, 'unknown')).status, 400);
    assert.equal((await upload(staff)).status, 403);
    const inspected = await upload(a); assert.equal(inspected.status, 200);
    const file = await inspected.json();
    assert.equal((await request(`/api/imports/${file.id}/validate`, b, { mapping: file.mapping })).status, 404);
    const report = await request(`/api/imports/${file.id}/validate`, a, { mapping: file.mapping });
    assert.equal((await report.json()).valid, 1);
    assert.equal((await request(`/api/imports/${file.id}/commit`, a, { approved: false })).status, 400);
    assert.equal((await request(`/api/imports/${file.id}/commit`, b, { approved: true })).status, 404);
    const committed = await request(`/api/imports/${file.id}/commit`, a, { approved: true });
    assert.equal(committed.status, 200); assert.equal((await committed.json()).imported, 1);
    assert.equal(tenantStore(db, 'a').all('patients').length, 1);
    assert.equal(tenantStore(db, 'b').all('patients').length, 0);
    const list = await (await request('/api/opportunities', a)).json();
    const opportunity = list.items[0];
    assert.equal((await request(`/api/opportunities/${opportunity.id}`, b)).status, 404);
    const draft = await (await request(`/api/opportunities/${opportunity.id}/draft`, a, {})).json();
    const action = { action: 'approve', message: draft.text };
    assert.equal((await request(`/api/opportunities/${opportunity.id}/action`, staff, action)).status, 403);
    assert.equal(tenantStore(db, 'a').all('communications').length, 0);
    const approved = await (await request(`/api/opportunities/${opportunity.id}/action`, a, action)).json();
    assert.equal((await request(`/api/campaigns/${approved.campaign_id}/send`, b, {})).status, 404);
    const sent = await (await request(`/api/campaigns/${approved.campaign_id}/send`, a, {})).json();
    assert.equal(sent.provider, 'mock'); assert.equal(sent.delivered, 1);
    const answer = await (await request('/api/assistant', b, { question: 'How many patients?' })).json();
    assert.ok(!JSON.stringify(answer).includes('Alex Tan'));
    assert.ok(tenantStore(db, 'a').all('audit_events').some(event => event.action === 'import.committed'));
  } finally {
    await new Promise(resolve => server.close(resolve));
    db.close();
  }
});
