import React, { useState } from 'react';

export default function AtmAgreementForm({ initialData = null, readOnly = false }) {
  const [form, setForm] = useState(initialData || {
    terminalId: '', customerName: '', address: '', postalCode: '',
    telephone: '', email: '', fax: '', date: '', cellPhone: '',
    atmModelOrLocation: '', surchargeRate: '', remitAmount: '', remitTo: '',
    mhSignature: '', mhName: '', mhDesignation: '',
    customerSignature: '', customerNameOwner: '', customerDriversLic: '',
    customerTelephone: '', customerHomeAddress: '', remarks: ''
  });

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [searchId, setSearchId] = useState('');

  const set = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.terminalId) return setMsg({ text: 'Terminal ID is required to save.', type: 'error' });
    setLoading(true); setMsg({ text: '', type: '' });
    try {
      const res = await fetch('/api/atm/agreement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save');
      setMsg({ text: 'Agreement form saved successfully!', type: 'success' });
    } catch (err) { setMsg({ text: err.message, type: 'error' }); }
    finally { setLoading(false); }
  };

  const handleSearch = async () => {
    if (!searchId) return;
    setLoading(true); setMsg({ text: '', type: '' });
    try {
      // First try to fetch an existing agreement form
      let res = await fetch(`/api/atm/timeline/${encodeURIComponent(searchId)}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const timelineData = await res.json();
      
      const existingAgreement = timelineData.find(evt => evt.type === 'AtmAgreement');
      
      if (existingAgreement) {
        let data = existingAgreement.data;
        if (data.date) data.date = data.date.split('T')[0];
        setForm(prev => ({ ...prev, ...data }));
        setMsg({ text: 'Agreement loaded successfully.', type: 'success' });
      } else {
        // Fallback: try to pre-fill from terminal registry or installation form
        const baseRes = await fetch(`/api/atm/installation/${encodeURIComponent(searchId)}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (baseRes.ok) {
          const baseData = await baseRes.json();
          setForm(prev => ({
            ...prev,
            terminalId: searchId,
            customerName: baseData.locationName || '',
            address: baseData.locationStreet || baseData.address || '',
            telephone: baseData.phone || baseData.telephone || '',
            email: baseData.email || '',
            machineModelOrLocation: baseData.machineModel || ''
          }));
          setMsg({ text: 'No existing agreement found. Pre-filled with terminal data.', type: 'success' });
        } else {
          setForm(prev => ({ ...prev, terminalId: searchId }));
          setMsg({ text: 'No records found. Ready for new entry.', type: 'error' });
        }
      }
    } catch (err) { setMsg({ text: err.message, type: 'error' }); }
    finally { setLoading(false); }
  };

  const handlePrint = () => {
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>SALES MAINTENANCE REVENUE AGREEMENT - ${form.terminalId || 'Form'}</title>
        <style>
          @page { size: letter portrait; margin: 10mm 15mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Times New Roman', serif;
            color: #000; background: #fff;
            font-size: 11px; line-height: 1.3; padding: 0;
          }
          .header { text-align: center; margin-bottom: 20px; font-family: Arial, sans-serif;}
          .header h2 { font-size: 18px; font-weight: bold; letter-spacing: 1px; text-decoration: underline; margin-bottom: 10px; }
          .header h3 { font-size: 14px; font-weight: bold; }
          .info-grid { margin-bottom: 20px; display: grid; grid-template-columns: auto 1fr auto 1fr; gap: 8px 15px; align-items: end; }
          .info-line { display: flex; align-items: flex-end; }
          .info-label { font-weight: bold; margin-right: 5px; white-space: nowrap; }
          .info-val { flex: 1; border-bottom: 1px solid #000; min-height: 16px; padding: 0 5px; }
          
          .section-title { font-weight: bold; font-size: 12px; margin-bottom: 5px; text-decoration: underline; }
          .clauses { padding-left: 20px; margin-bottom: 20px; }
          .clause { display: flex; margin-bottom: 6px; text-align: justify; }
          .clause-letter { width: 25px; flex-shrink: 0; }
          .clause-text { flex: 1; }
          .blank { display: inline-block; border-bottom: 1px solid #000; min-width: 80px; text-align: center; font-weight: bold; }

          .network-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-family: Arial, sans-serif; font-size: 11px;}
          .network-table th, .network-table td { border: 2px solid #000; padding: 5px; text-align: center; font-weight: bold; }
          .network-table th { background: #f0f0f0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

          .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 30px; font-family: Arial, sans-serif; font-size: 13px; font-weight: bold;}
          .sig-box { display: flex; flex-direction: column; gap: 20px; }
          .sig-box h4 { margin-bottom: 15px; font-size: 14px; text-decoration: underline;}
          .sig-line { display: flex; align-items: flex-end; }
          .sig-label { width: 120px; }
          .sig-val { flex: 1; border-bottom: 1px solid #000; min-height: 20px; padding-left: 10px; font-weight: normal; font-size: 12px;}
          .disclaimer { font-weight: normal; font-size: 12px; margin-bottom: 10px; line-height: 1.4;}
        </style>
      </head>
      <body>
        <div class="header">
          <h2>SALES MAINTENANCE REVENUE AGREEMENT</h2>
          <h3>BETWEEN: MH ENTERPRISES O/A: CASH MACHINES referred as (MH) AND:</h3>
        </div>

        <div class="info-line" style="margin-bottom: 10px;">
          <span class="info-label">M/S:</span>
          <span class="info-val">${form.customerName || ''}</span>
          <span style="margin-left: 5px;">(herein after referred as the customer)</span>
        </div>

        <div class="info-grid">
          <span class="info-label">Address:</span><span class="info-val" style="grid-column: span 3;">${form.address || ''}</span>
          
          <span class="info-label">Postal:</span><span class="info-val">${form.postalCode || ''}</span>
          <span class="info-label">Telephone:</span><span class="info-val">${form.telephone || ''}</span>
          
          <span class="info-label">Email Address:</span><span class="info-val">${form.email || ''}</span>
          <span class="info-label">Fax:</span><span class="info-val">${form.fax || ''}</span>
          
          <span class="info-label">Cell Phone:</span><span class="info-val">${form.cellPhone || ''}</span>
          <span class="info-label">Date:</span><span class="info-val">${form.date || ''}</span>
        </div>

        <div class="section-title">1. MH COMMITMENT</div>
        <div class="clauses">
          <div class="clause"><div class="clause-letter">a)</div><div class="clause-text">MH will supply, commission and install at the customer's place and purchase ATM of <span class="blank">${form.atmModelOrLocation || '&nbsp;'}</span>.</div></div>
          <div class="clause"><div class="clause-letter">b)</div><div class="clause-text">MH will supply all applicable network services. Transaction data processing and monitoring of same;</div></div>
          <div class="clause"><div class="clause-letter">c)</div><div class="clause-text">MH will set the surcharge rate at $<span class="blank">${form.surchargeRate || '&nbsp;'}</span> per transaction and will collect all surcharges either by a direct deposit or by the 25th of the following month as it is requested; and will remit $<span class="blank">${form.remitAmount || '&nbsp;'}</span> to <span class="blank" style="min-width: 150px;">${form.remitTo || '&nbsp;'}</span>, by direct deposit.</div></div>
          <div class="clause"><div class="clause-letter">d)</div><div class="clause-text">MH shall use its best effort to ensure maximum network uptime, but shall not be responsible for any losses due to the network being down if such downtime is caused or contributed to by reasons beyond the control of MH.</div></div>
          <div class="clause"><div class="clause-letter">e)</div><div class="clause-text">MH will provide telephone help desk for technical support and cardholder inquiries; and a 5-year warranty, including no fees for account changes.</div></div>
        </div>

        <div class="section-title" style="margin-top: 40px;">4. Available net works: The following chart the networks, which can be processed and the corresponding status as to surcharging:</div>
        <table class="network-table">
          <tr>
            <th>NETWORK</th>
            <th>INTERAC</th>
            <th>AMERICAN EXPRESS</th>
            <th>CANADIAN VISA & MASTER CARD</th>
            <th>CIRRUS & AINT, MASTER CARD</th>
          </tr>
          <tr>
            <td>SURCHARGE</td>
            <td>YES</td>
            <td>YES</td>
            <td>YES</td>
            <td>NO</td>
          </tr>
        </table>

        <div class="signatures">
          <div class="sig-box">
            <h4>FOR MH ENTERPRISES INC</h4>
            <div class="sig-line"><div class="sig-label">Signature</div><div class="sig-val">${form.mhSignature || ''}</div></div>
            <div class="sig-line"><div class="sig-label">Name:</div><div class="sig-val">${form.mhName || ''}</div></div>
            <div class="sig-line"><div class="sig-label">Designation:</div><div class="sig-val">${form.mhDesignation || ''}</div></div>
          </div>
          <div class="sig-box">
            <h4>FOR THE CUSTOMER:</h4>
            <div class="disclaimer">I read and understand the conditions stated herein and fully agreed to abide them</div>
            <div class="sig-line"><div class="sig-label">Signature</div><div class="sig-val">${form.customerSignature || ''}</div></div>
            <div class="sig-line"><div class="sig-label">Name of Owner:</div><div class="sig-val">${form.customerNameOwner || ''}</div></div>
            <div class="sig-line"><div class="sig-label">Driver's Lic #:</div><div class="sig-val">${form.customerDriversLic || ''}</div></div>
            <div class="sig-line"><div class="sig-label">Telephone:</div><div class="sig-val">${form.customerTelephone || ''}</div></div>
            <div class="sig-line"><div class="sig-label">Home Address:</div><div class="sig-val">${form.customerHomeAddress || ''}</div></div>
          </div>
        </div>
      </body>
      </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(printContent);
    doc.close();

    iframe.contentWindow.focus();
    setTimeout(() => {
      iframe.contentWindow.print();
      setTimeout(() => { document.body.removeChild(iframe); }, 1000);
    }, 500);
  };

  return (
    <div className={`atm-form-wrapper ${readOnly ? 'readonly-mode' : ''}`}>
      {/* Top Bar */}
      <div className="atm-top-bar no-print">
        <div className="search-group" style={{ visibility: readOnly ? 'hidden' : 'visible' }}>
          <input 
            type="text" 
            placeholder="Search by Terminal ID..." 
            value={searchId}
            onChange={e => setSearchId(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button className="atm-btn load" onClick={handleSearch} disabled={loading}>
            Load Details
          </button>
        </div>
        <div className="action-group">
          {!readOnly && (
            <button className="atm-btn primary" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Saving...' : '✓ Save Form'}
            </button>
          )}
          <button className="atm-btn secondary" onClick={handlePrint}>
            🖨 Print / PDF
          </button>
        </div>
      </div>

      {/* Notification */}
      {msg.text && <div className={`atm-notify ${msg.type}`}>{msg.text}</div>}

      <div className="atm-form-body" style={{ background: '#fff', color: '#000', padding: '40px', fontFamily: '"Times New Roman", serif', fontSize: '14px', maxWidth: '850px', margin: '0 auto', border: '1px solid #ccc', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '20px', fontFamily: 'Arial, sans-serif' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 'bold', letterSpacing: '1px', textDecoration: 'underline', marginBottom: '10px' }}>SALES MAINTENANCE REVENUE AGREEMENT</h2>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold' }}>BETWEEN: MH ENTERPRISES O/A: CASH MACHINES referred as (MH) AND:</h3>
        </div>

        <style>{`
          .pdf-input {
            border: none;
            border-bottom: 1px solid #000;
            background: transparent;
            outline: none;
            font-family: inherit;
            font-size: inherit;
            padding: 0 4px;
            color: #000;
          }
          .pdf-input:focus { border-bottom: 2px solid #000; }
          .pdf-row { display: flex; align-items: flex-end; margin-bottom: 12px; gap: 8px; }
          .pdf-label { font-weight: bold; white-space: nowrap; }
          .pdf-clause { display: flex; margin-bottom: 8px; text-align: justify; line-height: 1.5; }
          .pdf-clause-letter { width: 30px; flex-shrink: 0; }
          .pdf-table { width: 100%; border-collapse: collapse; margin: 25px 0; font-family: Arial, sans-serif; font-size: 13px; }
          .pdf-table th, .pdf-table td { border: 2px solid #000; padding: 6px; text-align: center; font-weight: bold; }
          .pdf-table th { background: #f0f0f0; }
          .pdf-sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; }
          .pdf-sig-box { display: flex; flex-direction: column; gap: 18px; }
          .pdf-sig-box h4 { font-size: 16px; text-decoration: underline; margin-bottom: 10px; }
        `}</style>

        {/* Top Information Section */}
        <div className="pdf-row" style={{ marginTop: '30px' }}>
          <span className="pdf-label">Terminal ID:</span>
          <input className="pdf-input" style={{ width: '120px' }} type="text" name="terminalId" value={form.terminalId} onChange={set} required />
          <span style={{ fontStyle: 'italic', fontSize: '12px', color: '#666' }}>(Required for saving/timeline)</span>
        </div>

        <div className="pdf-row" style={{ marginTop: '20px' }}>
          <span className="pdf-label">M/S :</span>
          <input className="pdf-input" style={{ flex: 1 }} type="text" name="customerName" value={form.customerName} onChange={set} />
          <span>( herein after referred as the customer)</span>
        </div>

        <div className="pdf-row">
          <span className="pdf-label">Address:</span>
          <input className="pdf-input" style={{ flex: 1 }} type="text" name="address" value={form.address} onChange={set} />
          <span className="pdf-label">Postal:</span>
          <input className="pdf-input" style={{ width: '120px' }} type="text" name="postalCode" value={form.postalCode} onChange={set} />
          <span className="pdf-label">Telephone:</span>
          <input className="pdf-input" style={{ width: '150px' }} type="text" name="telephone" value={form.telephone} onChange={set} />
        </div>

        <div className="pdf-row">
          <span className="pdf-label">Email Address:</span>
          <input className="pdf-input" style={{ flex: 1 }} type="email" name="email" value={form.email} onChange={set} />
          <span className="pdf-label">Fax:</span>
          <input className="pdf-input" style={{ width: '150px' }} type="text" name="fax" value={form.fax} onChange={set} />
          <span className="pdf-label">Date:</span>
          <input className="pdf-input" style={{ width: '120px' }} type="date" name="date" value={form.date} onChange={set} />
        </div>

        <div className="pdf-row">
          <span className="pdf-label">Cell Phone:</span>
          <input className="pdf-input" style={{ width: '250px' }} type="text" name="cellPhone" value={form.cellPhone} onChange={set} />
        </div>

        {/* Clause 1 */}
        <div style={{ fontWeight: 'bold', fontSize: '15px', textDecoration: 'underline', marginTop: '30px', marginBottom: '10px' }}>
          1. MH COMMITMENT
        </div>
        
        <div className="pdf-clause">
          <div className="pdf-clause-letter">a)</div>
          <div>MH will supply, commission and install at the customer's place and purchase ATM of <input className="pdf-input" style={{ width: '200px', textAlign: 'center', fontWeight: 'bold' }} type="text" name="atmModelOrLocation" value={form.atmModelOrLocation} onChange={set} />.</div>
        </div>
        
        <div className="pdf-clause">
          <div className="pdf-clause-letter">b)</div>
          <div>MH will supply all applicable network services. Transaction data processing and monitoring of same;</div>
        </div>

        <div className="pdf-clause">
          <div className="pdf-clause-letter">c)</div>
          <div>MH will set the surcharge rate at $ <input className="pdf-input" style={{ width: '60px', textAlign: 'center', fontWeight: 'bold' }} type="number" step="0.01" name="surchargeRate" value={form.surchargeRate} onChange={set} /> per transaction and will collect all surcharges either by a direct deposit or by the 25th of the following month as it is requested; and will remit $ <input className="pdf-input" style={{ width: '80px', textAlign: 'center', fontWeight: 'bold' }} type="number" step="0.01" name="remitAmount" value={form.remitAmount} onChange={set} /> to <input className="pdf-input" style={{ width: '250px', textAlign: 'center', fontWeight: 'bold' }} type="text" name="remitTo" value={form.remitTo} onChange={set} />, by direct deposit.</div>
        </div>

        <div className="pdf-clause">
          <div className="pdf-clause-letter">d)</div>
          <div>MH shall use its best effort to ensure maximum network uptime, but shall not be responsible for any losses due to the network being down if such downtime is caused or contributed to by reasons beyond the control of MH.</div>
        </div>

        <div className="pdf-clause">
          <div className="pdf-clause-letter">e)</div>
          <div>MH will provide telephone help desk for technical support and cardholder inquiries; and a 5-year warranty, including no fees for account changes.</div>
        </div>

        {/* Network Table */}
        <div style={{ fontWeight: 'bold', fontSize: '14px', textDecoration: 'underline', marginTop: '40px' }}>
          4. Available net works: The following chart the networks, which can be processed and the corresponding status as to surcharging:
        </div>
        <table className="pdf-table">
          <thead>
            <tr>
              <th>NETWORK</th>
              <th>INTERAC</th>
              <th>AMERICAN EXPRESS</th>
              <th>CANADIAN VISA & MASTER CARD</th>
              <th>CIRRUS & AINT, MASTER CARD</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>SURCHARGE</td>
              <td>YES</td>
              <td>YES</td>
              <td>YES</td>
              <td>NO</td>
            </tr>
          </tbody>
        </table>

        {/* Signatures */}
        <div className="pdf-sig-grid">
          <div className="pdf-sig-box">
            <h4>FOR MH ENTERPRISES INC</h4>
            <div className="pdf-row"><span className="pdf-label" style={{width:'110px'}}>Signature</span><input className="pdf-input" style={{flex:1}} type="text" name="mhSignature" value={form.mhSignature} onChange={set} /></div>
            <div className="pdf-row"><span className="pdf-label" style={{width:'110px'}}>Name:</span><input className="pdf-input" style={{flex:1}} type="text" name="mhName" value={form.mhName} onChange={set} /></div>
            <div className="pdf-row"><span className="pdf-label" style={{width:'110px'}}>Designation:</span><input className="pdf-input" style={{flex:1}} type="text" name="mhDesignation" value={form.mhDesignation} onChange={set} /></div>
          </div>
          <div className="pdf-sig-box">
            <h4>FOR THE CUSTOMER:</h4>
            <div style={{ fontWeight: 'normal', fontSize: '13px', lineHeight: '1.4', marginBottom: '10px' }}>
              I read and understand the conditions stated herein<br/>and fully agreed to abide them
            </div>
            <div className="pdf-row"><span className="pdf-label" style={{width:'130px'}}>Signature</span><input className="pdf-input" style={{flex:1}} type="text" name="customerSignature" value={form.customerSignature} onChange={set} /></div>
            <div className="pdf-row"><span className="pdf-label" style={{width:'130px'}}>Name of Owner:</span><input className="pdf-input" style={{flex:1}} type="text" name="customerNameOwner" value={form.customerNameOwner} onChange={set} /></div>
            <div className="pdf-row"><span className="pdf-label" style={{width:'130px'}}>Driver's Lic #:</span><input className="pdf-input" style={{flex:1}} type="text" name="customerDriversLic" value={form.customerDriversLic} onChange={set} /></div>
            <div className="pdf-row"><span className="pdf-label" style={{width:'130px'}}>Telephone:</span><input className="pdf-input" style={{flex:1}} type="text" name="customerTelephone" value={form.customerTelephone} onChange={set} /></div>
            <div className="pdf-row"><span className="pdf-label" style={{width:'130px'}}>Home Address:</span><input className="pdf-input" style={{flex:1}} type="text" name="customerHomeAddress" value={form.customerHomeAddress} onChange={set} /></div>
          </div>
        </div>

        <div style={{ marginTop: '40px' }}>
          <span className="pdf-label">Additional Remarks:</span>
          <textarea className="pdf-input" style={{ width: '100%', minHeight: '60px', marginTop: '10px', resize: 'vertical' }} name="remarks" value={form.remarks} onChange={set} />
        </div>

      </div>
    </div>
  );
}
