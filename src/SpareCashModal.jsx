import React, { useState } from 'react';
const req = async(p, o={}) => {
  const r = await fetch('/api'+p, {
    credentials: 'include',
    ...o,
    headers: { 'Content-Type': 'application/json', ...o.headers }
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.message || 'Request failed');
  return d;
};
const money2 = v => '$' + Number(v||0).toLocaleString();

export default function SpareCashModal({ agents, onClose, onDispatch }) {
  const [form, setForm] = useState({ agentId: '', amount: '', dueAt: new Date().toISOString().split('T')[0], note: '' });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await req('/jobs/dispatch-spare', {
        method: 'POST',
        body: JSON.stringify({
          agentId: form.agentId,
          amount: Number(form.amount),
          dueAt: form.dueAt,
          note: form.note
        })
      });
      setMsg('Spare cash dispatched successfully!');
      setTimeout(() => {
        onDispatch();
        onClose();
      }, 1500);
    } catch (err) {
      setMsg(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 9999, padding: '20px'
    }}>
      <div style={{
        background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '500px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)', overflow: 'hidden'
      }}>
        <div style={{ padding: '16px 20px', background: '#f1f3ef', borderBottom: '1px solid #dce1dc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: '#183d36' }}>Dispatch Spare / Floating Cash</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>✖</button>
        </div>
        <form onSubmit={submit} style={{ padding: '20px' }}>
          <p style={{ marginTop: 0, fontSize: '14px', color: '#555' }}>
            Assign extra floating cash to an agent. This cash is not locked to any specific ATM and can be used as a buffer during their route.
          </p>

          <label style={{ display: 'block', marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Select Agent</div>
            <select required value={form.agentId} onChange={e => setForm({ ...form, agentId: e.target.value })} style={{ width: '100%', padding: '8px' }}>
              <option value="">Select agent...</option>
              {agents.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </label>

          <label style={{ display: 'block', marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Extra Cash Amount ($)</div>
            <input type="number" min="1" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} style={{ width: '100%', padding: '8px' }} />
          </label>

          <label style={{ display: 'block', marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Date</div>
            <input type="date" required value={form.dueAt} onChange={e => setForm({ ...form, dueAt: e.target.value })} style={{ width: '100%', padding: '8px' }} />
          </label>

          <label style={{ display: 'block', marginBottom: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Instructions / Notes (Optional)</div>
            <textarea rows="3" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} style={{ width: '100%', padding: '8px', resize: 'vertical' }} />
          </label>

          {msg && <div style={{ padding: '10px', background: msg.includes('success') ? '#d4edda' : '#f8d7da', color: msg.includes('success') ? '#155724' : '#721c24', borderRadius: '4px', marginBottom: '16px' }}>{msg}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 16px', background: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={submitting} style={{ padding: '8px 16px', background: '#183d36', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              {submitting ? 'Dispatching...' : 'Dispatch Extra Cash'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
