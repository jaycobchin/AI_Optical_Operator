import { useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { Users, Target, TrendingUp, CheckCircle2 } from 'lucide-react';
import { Brand, Spinner, Empty, ErrorBox, Badge, Status, Modal, PageHeading, Metric, OpportunityTable, RevenueChart, Stepper } from './components';
import { api, post, TYPES, money, number, date, type Session, type Dashboard, type Opportunity, type Campaign } from './lib';
import './styles.css';

function useRemote<T>(path: string, revision = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    api<T>(path).then(value => { if (active) setData(value); }).catch(error => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [path, revision]);
  return { data, error, loading };
}

function useAction() {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function run(action: () => Promise<void>) {
    setBusy(true); setError('');
    try { await action(); } catch (error) { setError(error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  return { busy, error, run };
}

function Login({ onLogin }: { onLogin: (session: Session) => void }) {
  const { data: config } = useRemote<{ demo: boolean; signup: boolean }>('/config');
  const [register, setRegister] = useState(false), [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [name, setName] = useState(''), [practice, setPractice] = useState('');
  const action = useAction();
  function submit(event: FormEvent) {
    event.preventDefault();
    void action.run(async () => onLogin(await post<Session>(register ? '/auth/register' : '/auth/login', { email, password, ...(register ? { name, practice } : {}) })));
  }
  return <main className="login-layout"><section className="login-intro"><Brand/><div><p className="eyebrow">A clearer view of your practice</p><h1>Good data.<br/>Thoughtful action.</h1><p>Find the patients who need a follow-up. Review the evidence, approve a message, and see what happens next.</p></div><p>Eye-care ready. Optical first.</p></section>
    <section className="login-form"><form onSubmit={submit}><h2>{register ? 'Create your practice' : 'Welcome back'}</h2><p>Sign in to your practice workspace.</p><ErrorBox message={action.error}/>
      {register && <><label>Your name<input required minLength={2} value={name} onChange={event => setName(event.target.value)}/></label><label>Practice name<input required minLength={2} value={practice} onChange={event => setPractice(event.target.value)}/></label></>}
      <label>Email<input type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)}/></label>
      <label>Password<input type="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength={register ? 12 : 1} value={password} onChange={event => setPassword(event.target.value)}/></label>
      <button className="primary" disabled={action.busy}>{action.busy ? 'Please wait…' : register ? 'Create practice' : 'Sign in'}</button>
      {config?.signup && <button type="button" className="text-link" onClick={() => setRegister(!register)}>{register ? 'Back to sign in' : 'Create a practice'}</button>}
      {config?.demo && <aside className="demo-note">Synthetic demo<br/><strong>owner@demo.optical</strong><br/>Password: OpticalDemo2026!</aside>}
    </form></section></main>;
}

function Overview({ onReview }: { onReview: () => void }) {
  const { data, error } = useRemote<Dashboard>('/dashboard');
  if (!data) return error ? <ErrorBox message={error}/> : <Spinner/>;
  return <><PageHeading eyebrow="Daily briefing" title="Your practice, in focus" description="Turn the next opportunity into a thoughtful patient conversation."><button className="primary" onClick={onReview}>Review opportunities</button></PageHeading>
    <div className="metrics"><Metric label="Open opportunities" value={number(data.open)} detail={`${data.highPriority} high priority`} icon={<Target size={18}/>}/><Metric label="Potential revenue" value={money(data.potentialRevenue)} detail="Estimate · counted once per patient" icon={<TrendingUp size={18}/>}/><Metric label="Contactable patients" value={number(data.health.contactable)} detail={`${number(data.health.patients)} patients in your practice`} icon={<Users size={18}/>}/><Metric label="Attributed revenue" value={money(data.totals.revenue)} detail="Recorded campaign purchases" icon={<CheckCircle2 size={18}/>}/></div>
    <div className="overview-grid"><section className="card"><h2>Where to focus</h2><p>Review evidence and consent before approving outreach.</p>{data.opportunities.length ? data.opportunities.map(group => <button className="segment" key={group.type} onClick={onReview}><span><Badge tone={TYPES[group.type].color}>{TYPES[group.type].short}</Badge><span className="cell-subtitle">{TYPES[group.type].description}</span></span><strong>{number(group.count)}</strong></button>) : <Empty title="Ready for your data" description="Import practice records to find opportunities."/>}</section>
      <section className="card"><h2>Campaign revenue</h2><p>Attributed purchases over the last 14 days.</p><RevenueChart data={data.trend}/><div className="summary-row"><span>{data.totals.delivered} delivered</span><span>{data.totals.appointments} appointments</span><span>{data.totals.purchases} purchases</span></div><h3>Data health</h3><p>{data.health.noConsent} patients without recorded marketing consent · {data.health.missingContact} without valid contact details.</p><p>Last import: {date(data.health.lastImport, true)}</p></section></div>
  </>;
}

function OpportunityReview({ id, manage, onClose, onChanged }: { id: string; manage: boolean; onClose: () => void; onChanged: () => void }) {
  const { data, error } = useRemote<Opportunity & { explanation: { summary: string } }>(`/opportunities/${id}`);
  const [message, setMessage] = useState(''), [channel, setChannel] = useState('whatsapp');
  const action = useAction();
  const act = (choice: string) => action.run(async () => { await post(`/opportunities/${id}/action`, { action: choice, message, channel }); onChanged(); onClose(); });
  return <Modal title={data?.patient.name || 'Opportunity'} subtitle={data ? TYPES[data.type].label : undefined} onClose={onClose} wide>
    <ErrorBox message={error || action.error}/>{!data ? !error && <Spinner/> : <><div className="summary-row"><Badge tone="blue">Score {data.score} / 100</Badge><Status status={data.status}/><span>Rule {data.rule_version}</span></div><p>{data.explanation.summary}</p>
      <h3>Evidence</h3><dl className="evidence">{data.evidence.map((item, index) => <div key={index}><dt>{item.field.replaceAll('_', ' ')}</dt><dd>{String(item.value)}<small>Source: {item.source_id}</small></dd></div>)}</dl><p className="muted">Calculated {date(data.calculated_at, true)} · {Math.round(data.confidence * 100)}% data confidence</p>
      <div className="section-heading"><h3>Patient message</h3><button disabled={action.busy} onClick={() => void action.run(async () => { const draft = await post<{ text: string }>(`/opportunities/${id}/draft`, {}); setMessage(draft.text); })}>Generate draft</button></div>
      <label>Patient message<textarea rows={5} maxLength={1600} value={message} onChange={event => setMessage(event.target.value)}/></label><label>Channel<select value={channel} onChange={event => setChannel(event.target.value)}><option value="whatsapp">WhatsApp</option><option value="sms">SMS</option><option value="email">Email</option></select></label>
      <p>Review and edit the message before approval. Queued messages use the mock provider in Campaigns.</p>
      {manage && data.status === 'new' ? <div className="actions"><button className="primary" disabled={action.busy || message.trim().length < 20} onClick={() => void act('approve')}>Approve &amp; queue</button><button disabled={action.busy} onClick={() => void act('snooze')}>Snooze 7 days</button><button disabled={action.busy} onClick={() => void act('dismiss')}>Dismiss</button></div> : <p>An owner or manager can approve open opportunities.</p>}
    </>}
  </Modal>;
}

function Opportunities({ manage }: { manage: boolean }) {
  const [search, setSearch] = useState(''), [type, setType] = useState(''), [page, setPage] = useState(1), [revision, setRevision] = useState(0), [selected, setSelected] = useState<string | null>(null);
  const { data, error, loading } = useRemote<{ items: Opportunity[]; total: number }>(`/opportunities?status=new&search=${encodeURIComponent(search)}&type=${type}&page=${page}`, revision);
  const action = useAction();
  return <><PageHeading title="Opportunities" description="Patient follow-ups backed by recorded evidence.">{manage && <button disabled={action.busy} onClick={() => void action.run(async () => { await post('/opportunities/analyse'); setRevision(value => value + 1); })}>Run analysis</button>}</PageHeading><ErrorBox message={error || action.error}/>
    <section className="card"><div className="filters"><label>Search patients<input type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }}/></label><label>Opportunity type<select value={type} onChange={event => { setType(event.target.value); setPage(1); }}><option value="">All types</option>{Object.entries(TYPES).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label></div>
      {loading ? <Spinner/> : data?.items.length ? <OpportunityTable items={data.items} onSelect={setSelected}/> : !error && <Empty title="No matching opportunities" description="Try a different filter or import more practice data."/>}
      {data && <div className="pagination"><span>{number(data.total)} opportunities</span><button disabled={page === 1 || loading} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page}</span><button disabled={page * 20 >= data.total || loading} onClick={() => setPage(page + 1)}>Next</button></div>}
    </section>{selected && <OpportunityReview key={selected} id={selected} manage={manage} onClose={() => setSelected(null)} onChanged={() => setRevision(value => value + 1)}/>}
  </>;
}

type Connector = { id: string; name: string; status: string; reason: string | null; entities: string[]; capabilities: { fileImport: boolean; liveRead: boolean } };
type Field = { key: string; label: string; required: boolean };
type Inspection = { id: string; filename: string; total: number; headers: string[]; fields: Field[]; mapping: Record<string, string>; confidence: Record<string, number>; preview: Record<string, string>[] };
type Validation = { valid: number; invalid: number; duplicates: number; updates: number; unmapped: string[]; rows: { row: number; errors: string[]; warnings: string[] }[] };
type ImportHistory = { imports: { id: string; filename: string; committed_at: string; report: { imported: number; updated: number; skipped: number } }[] };

function DataPage({ manage }: { manage: boolean }) {
  const [revision, setRevision] = useState(0);
  const { data: connectors, error: connectorError } = useRemote<Connector[]>('/connectors');
  const { data: history, error: historyError } = useRemote<ImportHistory>('/data', revision);
  const [connectorId, setConnectorId] = useState('generic-csv'), [entity, setEntity] = useState('patients'), [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<Inspection | null>(null), [mapping, setMapping] = useState<Record<string, string>>({}), [report, setReport] = useState<Validation | null>(null);
  const [approved, setApproved] = useState(false), [includeDuplicates, setIncludeDuplicates] = useState(false), [notice, setNotice] = useState('');
  const action = useAction();
  const selected = connectors?.find(connector => connector.id === connectorId);
  function reset() { setInspection(null); setReport(null); setApproved(false); setIncludeDuplicates(false); }
  function inspect(event: FormEvent) {
    event.preventDefault(); if (!file) return;
    void action.run(async () => {
      const body = new FormData(); body.set('file', file); body.set('entity', entity); body.set('connector', connectorId);
      const result = await api<Inspection>('/imports/inspect', { method: 'POST', body });
      setInspection(result); setMapping(result.mapping); setReport(null); setApproved(false); setNotice('');
    });
  }
  return <><PageHeading title="Practice data" description="Review mappings and data quality before importing records."><a className="button" href="/api/data/template">Download sample CSV</a></PageHeading>
    <ErrorBox message={connectorError || historyError || action.error}/>{notice && <div className="notice" role="status">{notice}</div>}
    <div className="connector-grid">{connectors?.map(connector => <section className="card" key={connector.id}><div className="section-heading"><h2>{connector.name}</h2><Badge tone={connector.status === 'available' ? 'green' : 'amber'}>{connector.status === 'available' ? 'Available' : 'Unavailable'}</Badge></div><p>{connector.reason || 'Import patients, transactions, appointments, visits and orders. Existing source IDs update matching records.'}</p></section>)}</div>
    {manage ? <section className="card import-card"><h2>Import records</h2><Stepper step={report ? 2 : inspection ? 1 : 0} labels={['Upload', 'Map columns', 'Review & approve']}/>
      {!inspection ? <form onSubmit={inspect}><div className="filters"><label>Source<select value={connectorId} onChange={event => { setConnectorId(event.target.value); setEntity('patients'); }}>{connectors?.map(connector => <option key={connector.id} value={connector.id} disabled={connector.status !== 'available' || !connector.capabilities.fileImport}>{connector.name}</option>)}</select></label><label>Record type<select value={entity} onChange={event => setEntity(event.target.value)}>{selected?.entities.map(item => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select></label></div><label>CSV or XLSX file<input type="file" accept=".csv,.xlsx" required onChange={event => setFile(event.target.files?.[0] || null)}/></label><p>Up to 5 MB. Import patients before their related records.</p><button className="primary" disabled={!file || action.busy || !selected?.capabilities.fileImport}>Inspect file</button></form> : <>
        <div className="section-heading"><h3>{inspection.filename} · {inspection.total} rows</h3><button disabled={action.busy} onClick={reset}>Choose another file</button></div>
        <div className="mapping-grid">{inspection.fields.map(field => <label key={field.key}>{field.label}{field.required ? ' *' : ''}<select disabled={action.busy} value={mapping[field.key] || ''} onChange={event => { setMapping({ ...mapping, [field.key]: event.target.value }); setReport(null); setApproved(false); }}><option value="">Not mapped</option>{inspection.headers.map(header => <option key={header} value={header}>{header}</option>)}</select><small>{mapping[field.key] && mapping[field.key] === inspection.mapping[field.key] ? `${Math.round(inspection.confidence[field.key] * 100)}% header match · confirm with preview` : 'Review source column'}</small></label>)}</div>
        <details><summary>Preview first {inspection.preview.length} rows</summary><div className="table-scroll"><table><thead><tr>{inspection.headers.map(header => <th key={header}>{header}</th>)}</tr></thead><tbody>{inspection.preview.map((row, index) => <tr key={index}>{inspection.headers.map(header => <td key={header}>{row[header]}</td>)}</tr>)}</tbody></table></div></details>
        <button disabled={action.busy} onClick={() => void action.run(async () => { setReport(await post<Validation>(`/imports/${inspection.id}/validate`, { mapping })); setApproved(false); })}>Validate mapping</button>
        {report && <div className="import-review"><h3>{report.valid} valid · {report.invalid} invalid · {report.duplicates} duplicate candidates</h3><p>{report.updates} existing records will be updated. Invalid rows are skipped. Duplicate candidates are skipped unless you choose to retain separate records.</p>{report.unmapped.length > 0 && <p>Unmapped columns: {report.unmapped.join(', ')}</p>}
          {report.rows.some(row => row.errors.length || row.warnings.length) && <ul>{report.rows.filter(row => row.errors.length || row.warnings.length).slice(0, 20).map(row => <li key={row.row}>Row {row.row}: {[...row.errors, ...row.warnings].join('; ')}</li>)}</ul>}
          {report.duplicates > 0 && <label className="checkbox"><input type="checkbox" checked={includeDuplicates} onChange={event => { setIncludeDuplicates(event.target.checked); setApproved(false); }}/>Keep reviewed duplicate candidates as separate patients.</label>}
          <label className="checkbox"><input type="checkbox" checked={approved} onChange={event => setApproved(event.target.checked)}/>I have reviewed the preview and approve importing valid rows.</label>
          <button className="primary" disabled={!approved || action.busy || report.valid === 0} onClick={() => void action.run(async () => { const result = await post<{ imported: number; updated: number; skipped: number }>(`/imports/${inspection.id}/commit`, { approved: true, includeDuplicates }); setNotice(`${result.imported} imported · ${result.updated} updated · ${result.skipped} skipped`); reset(); setFile(null); setRevision(value => value + 1); })}>Approve &amp; import</button>
        </div>}
      </>}
    </section> : <p>An owner or manager can import practice data.</p>}
    <section className="card"><h2>Import history</h2>{history?.imports.length ? <div className="table-scroll"><table><thead><tr><th>File</th><th>Date</th><th>Imported</th><th>Updated</th><th>Skipped</th></tr></thead><tbody>{history.imports.map(item => <tr key={item.id}><td>{item.filename}</td><td>{date(item.committed_at, true)}</td><td>{item.report.imported}</td><td>{item.report.updated}</td><td>{item.report.skipped}</td></tr>)}</tbody></table></div> : <p>No imports yet.</p>}</section>
  </>;
}

function CampaignReview({ id, manage, onClose, onChanged }: { id: string; manage: boolean; onClose: () => void; onChanged: () => void }) {
  const [revision, setRevision] = useState(0), [template, setTemplate] = useState('');
  const { data, error } = useRemote<Campaign>(`/campaigns/${id}`, revision);
  const action = useAction();
  useEffect(() => { if (data) setTemplate(data.template); }, [data]);
  const changed = () => { setRevision(value => value + 1); onChanged(); };
  return <Modal title={data?.name || 'Campaign'} onClose={onClose} wide><ErrorBox message={error || action.error}/>{!data ? !error && <Spinner/> : <>
    <div className="summary-row"><Status status={data.status}/><span>{data.recipients} recipients</span><span>{data.delivered} delivered</span><span>{money(data.revenue)} attributed revenue</span></div>
    <label>Campaign message<textarea rows={5} value={template} readOnly={data.status !== 'draft'} onChange={event => setTemplate(event.target.value)}/></label>
    <div className="actions">{data.status === 'draft' && <button disabled={action.busy || template === data.template || template.trim().length < 20} onClick={() => void action.run(async () => { await api(`/campaigns/${id}`, { method: 'PATCH', body: JSON.stringify({ template }) }); changed(); })}>Save message</button>}
      {manage && data.status === 'draft' && <button className="primary" disabled={action.busy || template !== data.template} onClick={() => void action.run(async () => { await post(`/campaigns/${id}/approve`); changed(); })}>Approve campaign</button>}
      {manage && data.status === 'approved' && <button className="primary" disabled={action.busy} onClick={() => void action.run(async () => { await post(`/campaigns/${id}/send`); changed(); })}>Send with mock provider</button>}
    </div><p>Mock delivery records a simulated send. No SMS, WhatsApp or email is sent externally.</p>
    <h3>Recipients and outcomes</h3>{data.messages?.map(message => <article key={message.id} className="recipient"><div className="section-heading"><strong>{message.patient.name}</strong><Status status={message.status}/></div><p>{message.body}</p>{message.exclusion_reason && <p>{message.exclusion_reason}</p>}
      <div className="actions">{message.events.filter(event => event.type !== 'delivered').map(event => <Badge key={event.type} tone="green">{event.type}</Badge>)}
        {message.status === 'delivered' && <>{['reply', 'appointment'].filter(type => !message.events.some(event => event.type === type)).map(type => <button key={type} disabled={action.busy} onClick={() => void action.run(async () => { await post(`/communications/${message.id}/outcomes`, { type }); changed(); })}>Record {type}</button>)}
          {!message.events.some(event => event.type === 'purchase') && message.transactions.length > 0 && <label>Link purchase<select value="" disabled={action.busy} onChange={event => { const transaction_id = event.target.value; if (transaction_id) void action.run(async () => { await post(`/communications/${message.id}/outcomes`, { type: 'purchase', transaction_id }); changed(); }); }}><option value="">Choose recorded purchase</option>{message.transactions.map(purchase => <option key={purchase.id} value={purchase.id}>{date(purchase.date, true)} · {money(purchase.total)} · {purchase.category}</option>)}</select></label>}
        </>}
      </div></article>)}
  </>}</Modal>;
}

function Campaigns({ manage }: { manage: boolean }) {
  const [revision, setRevision] = useState(0), [selected, setSelected] = useState<string | null>(null);
  const { data, error } = useRemote<Campaign[]>('/campaigns', revision);
  return <><PageHeading title="Campaigns" description="Approved outreach and recorded outcomes."><a className="button" href="/api/analytics/export">Export results</a></PageHeading><ErrorBox message={error}/>
    <section className="card">{!data ? !error && <Spinner/> : data.length ? <div className="table-scroll"><table><thead><tr><th>Campaign</th><th>Status</th><th>Recipients</th><th>Delivered</th><th>Purchases</th><th>Revenue</th></tr></thead><tbody>{data.map(campaign => <tr key={campaign.id}><td><button className="table-link" onClick={() => setSelected(campaign.id)}>{campaign.name}</button><span className="cell-subtitle">{campaign.channel} · {date(campaign.created_at, true)}</span></td><td><Status status={campaign.status}/></td><td>{campaign.recipients}</td><td>{campaign.delivered}</td><td>{campaign.purchases}</td><td>{money(campaign.revenue)}</td></tr>)}</tbody></table></div> : <Empty title="Your first follow-up starts here" description="Review an opportunity and approve its message to create a campaign."/>}</section>
    {selected && <CampaignReview key={selected} id={selected} manage={manage} onClose={() => setSelected(null)} onChanged={() => setRevision(value => value + 1)}/>}
  </>;
}

function App() {
  const [session, setSession] = useState<Session | null>(null), [loading, setLoading] = useState(true), [tab, setTab] = useState('Overview');
  const action = useAction();
  useEffect(() => {
    let active = true;
    api<Session>('/auth/me').then(value => { if (active) setSession(value); }).catch(() => {}).finally(() => { if (active) setLoading(false); });
    const expired = () => { setSession(null); setTab('Overview'); };
    window.addEventListener('session-expired', expired);
    return () => { active = false; window.removeEventListener('session-expired', expired); };
  }, []);
  if (loading) return <Spinner/>;
  if (!session) return <Login onLogin={value => { setSession(value); setTab('Overview'); }}/>;
  const manage = ['owner', 'manager'].includes(session.user.role);
  return <div className="app"><aside className="sidebar"><Brand/><div className="practice-name">{session.practice.name}<small>{session.user.role} workspace</small></div><nav aria-label="Main navigation">{['Overview', 'Opportunities', 'Campaigns', 'Data'].map(item => <button key={item} className={tab === item ? 'active' : ''} aria-current={tab === item ? 'page' : undefined} onClick={() => setTab(item)}>{item}</button>)}</nav><div className="sidebar-bottom"><Badge tone="green">v0.2 · Mock communications</Badge><p>{session.user.name}</p><button disabled={action.busy} onClick={() => void action.run(async () => { await post('/auth/logout'); setSession(null); })}>Sign out</button></div></aside>
    <main className="workspace"><header className="topbar"><span>{session.practice.name}</span><span>{session.demo ? 'Synthetic demo data' : 'Practice workspace'}</span></header><div className="page"><ErrorBox message={action.error}/>{tab === 'Overview' ? <Overview onReview={() => setTab('Opportunities')}/> : tab === 'Opportunities' ? <Opportunities manage={manage}/> : tab === 'Data' ? <DataPage manage={manage}/> : <Campaigns manage={manage}/>}</div></main>
  </div>;
}

createRoot(document.getElementById('root')!).render(<App/>);
