import React, { useState } from 'react';

export default function AtmRemovalForm({ initialData = null, readOnly = false }) {
  const [form, setForm] = useState(initialData || {
    terminalId: '', date: '', time: '',
    locationName: '', address: '',
    reasonForRemoval: '', machineModelNo: '', machineSerialNo: '',
    cashInCassette: '', rejectBin: '', totalNumberOfBills: '',
    inventoryNumber: '', removedBy: '', receiverSignature: '', dateReceived: ''
  });

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [searchId, setSearchId] = useState('');

  const set = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.terminalId) return setMsg({ text: 'Terminal ID is required to save.', type: 'error' });
    setLoading(true); setMsg({ text: '', type: '' });
    try {
      const res = await fetch('/api/atm/removal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save');
      setMsg({ text: 'Removal form saved successfully!', type: 'success' });
    } catch (err) { setMsg({ text: err.message, type: 'error' }); }
    finally { setLoading(false); }
  };

  const handleSearch = async () => {
    if (!searchId) return;
    setLoading(true); setMsg({ text: '', type: '' });
    try {
      let res = await fetch(`/api/atm/timeline/${encodeURIComponent(searchId)}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const timelineData = await res.json();
      
      const existingRemoval = timelineData.find(evt => evt.type === 'AtmRemoval');
      
      if (existingRemoval) {
        let data = existingRemoval.data;
        if (data.date) data.date = data.date.split('T')[0];
        if (data.dateReceived) data.dateReceived = data.dateReceived.split('T')[0];
        setForm(prev => ({ ...prev, ...data }));
        setMsg({ text: 'Removal form loaded successfully.', type: 'success' });
      } else {
        const baseRes = await fetch(`/api/atm/installation/${encodeURIComponent(searchId)}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (baseRes.ok) {
          const baseData = await baseRes.json();
          setForm(prev => ({
            ...prev,
            terminalId: searchId,
            locationName: baseData.locationName || '',
            address: baseData.locationStreet || baseData.address || '',
            machineModelNo: baseData.machineModel || '',
            machineSerialNo: baseData.machineSerialNo || ''
          }));
          setMsg({ text: 'No existing removal found. Pre-filled with terminal data.', type: 'success' });
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
        <title>ATM REMOVAL FORM - ${form.terminalId || 'Form'}</title>
        <style>
          @page { size: letter portrait; margin: 25mm 20mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; color: #000; background: #fff; font-size: 13px; line-height: 1.5; }
          .header { text-align: center; margin-bottom: 40px; }
          .header h2 { font-size: 22px; font-weight: bold; letter-spacing: 1px; }
          .pdf-row { display: flex; align-items: flex-end; margin-bottom: 18px; }
          .pdf-label { font-weight: bold; white-space: nowrap; margin-right: 8px; text-transform: uppercase; }
          .pdf-val { flex: 1; border-bottom: 1px solid #000; min-height: 18px; padding: 0 5px; font-family: 'Times New Roman', serif; font-size: 14px;}
          .box-input { border: 2px solid #000; min-height: 25px; min-width: 250px; padding: 2px 5px; font-family: 'Times New Roman', serif; font-size: 14px;}
          .spacer { height: 25px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>ATM REMOVAL FORM</h2>
        </div>

        <div class="pdf-row">
          <span class="pdf-label" style="width: 150px;">DATE:</span>
          <span class="pdf-val" style="margin-right: 20px;">${form.date || ''}</span>
          <span class="pdf-label" style="width: 100px;">TIME:</span>
          <span class="pdf-val">${form.time || ''}</span>
        </div>

        <div class="pdf-row">
          <span class="pdf-label" style="width: 150px;">TERMINAL ID:</span>
          <span class="pdf-val" style="margin-right: 20px;">${form.terminalId || ''}</span>
          <span class="pdf-label" style="width: 150px;">LOCATION NAME:</span>
          <span class="pdf-val">${form.locationName || ''}</span>
        </div>

        <div class="pdf-row">
          <span class="pdf-label" style="width: 150px;">ADDRESS:</span>
          <span class="pdf-val">${form.address || ''}</span>
        </div>

        <div class="pdf-row" style="align-items: center; margin-bottom: 25px;">
          <span class="pdf-label" style="width: 220px;">REASON FOR REMOVAL:</span>
          <div class="box-input">${form.reasonForRemoval || ''}</div>
        </div>

        <div class="pdf-row">
          <span class="pdf-label" style="width: 220px;">MACHINE MODEL NO.</span>
          <span class="pdf-val">${form.machineModelNo || ''}</span>
        </div>

        <div class="pdf-row">
          <span class="pdf-label" style="width: 220px;">MACHINE SERIAL NO.</span>
          <span class="pdf-val">${form.machineSerialNo || ''}</span>
        </div>

        <div class="pdf-row">
          <span class="pdf-label" style="width: 220px;">CASH IN ATM CASSETTE: $</span>
          <span class="pdf-val" style="margin-right: 20px; flex: 0.5;">${form.cashInCassette || ''}</span>
          <span class="pdf-label" style="width: 120px;">REJECT BIN: $</span>
          <span class="pdf-val" style="flex: 0.5;">${form.rejectBin || ''}</span>
        </div>

        <div class="pdf-row">
          <span class="pdf-label" style="width: 220px;">TOTAL NUMBER OF BILL: $</span>
          <span class="pdf-val" style="flex: 0.5;">${form.totalNumberOfBills || ''}</span>
          <span style="flex: 1;"></span>
        </div>

        <div class="spacer"></div>
        <div class="spacer"></div>

        <div class="pdf-row">
          <span class="pdf-label" style="width: 220px;">INVENTORY NUMBER:</span>
          <span class="pdf-val">${form.inventoryNumber || ''}</span>
        </div>

        <div class="spacer"></div>

        <div class="pdf-row">
          <span class="pdf-label" style="width: 220px;">REMOVED BY:</span>
          <span class="pdf-val">${form.removedBy || ''}</span>
        </div>

        <div class="spacer"></div>

        <div class="pdf-row">
          <span class="pdf-label" style="width: 220px;">RECEIVER SIGNATURE:</span>
          <span class="pdf-val">${form.receiverSignature || ''}</span>
        </div>

        <div class="spacer"></div>

        <div class="pdf-row">
          <span class="pdf-label" style="width: 220px;">DATE RECEIVED:</span>
          <span class="pdf-val" style="flex: 0.5;">${form.dateReceived || ''}</span>
          <span style="flex: 1;"></span>
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

      <div className="atm-form-body" style={{ background: '#fff', color: '#000', padding: '40px', fontFamily: 'Arial, sans-serif', fontSize: '13px', maxWidth: '850px', margin: '0 auto', border: '1px solid #ccc', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        
        <div style={{ textAlign: 'center', margin: '40px 0', letterSpacing: '1px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold' }}>ATM REMOVAL FORM</h2>
        </div>

        <style>{`
          .pdf-input {
            border: none; border-bottom: 1px solid #000; background: transparent; outline: none;
            font-family: 'Times New Roman', serif; font-size: 15px; padding: 0 4px; color: #000;
          }
          .pdf-input:focus { border-bottom: 2px solid #000; }
          .pdf-row { display: flex; align-items: flex-end; margin-bottom: 24px; gap: 8px; }
          .pdf-label { font-weight: bold; white-space: nowrap; text-transform: uppercase; font-size: 13px; }
          .box-input {
            border: 2px solid #000; background: transparent; outline: none; padding: 6px;
            font-family: 'Times New Roman', serif; font-size: 15px; min-width: 300px;
          }
          .box-input:focus { box-shadow: 0 0 0 2px rgba(0,0,0,0.1); }
        `}</style>

        <div className="pdf-row">
          <span className="pdf-label" style={{ width: '160px' }}>DATE:</span>
          <input className="pdf-input" style={{ width: '200px', marginRight: '20px' }} type="date" name="date" value={form.date} onChange={set} />
          <span className="pdf-label" style={{ width: '120px' }}>TIME:</span>
          <input className="pdf-input" style={{ width: '150px' }} type="time" name="time" value={form.time} onChange={set} />
        </div>

        <div className="pdf-row">
          <span className="pdf-label" style={{ width: '160px' }}>TERMINAL ID:</span>
          <input className="pdf-input" style={{ width: '200px', marginRight: '20px' }} type="text" name="terminalId" value={form.terminalId} onChange={set} required />
          <span className="pdf-label" style={{ width: '120px' }}>LOCATION NAME:</span>
          <input className="pdf-input" style={{ flex: 1 }} type="text" name="locationName" value={form.locationName} onChange={set} />
        </div>

        <div className="pdf-row">
          <span className="pdf-label" style={{ width: '160px' }}>ADDRESS:</span>
          <input className="pdf-input" style={{ flex: 1 }} type="text" name="address" value={form.address} onChange={set} />
        </div>

        <div className="pdf-row" style={{ alignItems: 'center' }}>
          <span className="pdf-label" style={{ width: '220px' }}>REASON FOR REMOVAL:</span>
          <input className="box-input" type="text" name="reasonForRemoval" value={form.reasonForRemoval} onChange={set} />
        </div>

        <div className="pdf-row">
          <span className="pdf-label" style={{ width: '220px' }}>MACHINE MODEL NO.</span>
          <input className="pdf-input" style={{ flex: 1 }} type="text" name="machineModelNo" value={form.machineModelNo} onChange={set} />
        </div>

        <div className="pdf-row">
          <span className="pdf-label" style={{ width: '220px' }}>MACHINE SERIAL NO.</span>
          <input className="pdf-input" style={{ flex: 1 }} type="text" name="machineSerialNo" value={form.machineSerialNo} onChange={set} />
        </div>

        <div className="pdf-row">
          <span className="pdf-label" style={{ width: '220px' }}>CASH IN ATM CASSETTE: $</span>
          <input className="pdf-input" style={{ width: '150px', marginRight: '20px' }} type="number" step="0.01" name="cashInCassette" value={form.cashInCassette} onChange={set} />
          <span className="pdf-label" style={{ width: '120px' }}>REJECT BIN: $</span>
          <input className="pdf-input" style={{ width: '150px' }} type="number" step="0.01" name="rejectBin" value={form.rejectBin} onChange={set} />
        </div>

        <div className="pdf-row">
          <span className="pdf-label" style={{ width: '220px' }}>TOTAL NUMBER OF BILL: $</span>
          <input className="pdf-input" style={{ width: '150px' }} type="number" step="1" name="totalNumberOfBills" value={form.totalNumberOfBills} onChange={set} />
        </div>

        <div style={{ height: '30px' }}></div>

        <div className="pdf-row">
          <span className="pdf-label" style={{ width: '220px' }}>INVENTORY NUMBER:</span>
          <input className="pdf-input" style={{ flex: 1 }} type="text" name="inventoryNumber" value={form.inventoryNumber} onChange={set} />
        </div>

        <div style={{ height: '20px' }}></div>

        <div className="pdf-row">
          <span className="pdf-label" style={{ width: '220px' }}>REMOVED BY:</span>
          <input className="pdf-input" style={{ flex: 1 }} type="text" name="removedBy" value={form.removedBy} onChange={set} />
        </div>

        <div style={{ height: '20px' }}></div>

        <div className="pdf-row">
          <span className="pdf-label" style={{ width: '220px' }}>RECEIVER SIGNATURE:</span>
          <input className="pdf-input" style={{ flex: 1 }} type="text" name="receiverSignature" value={form.receiverSignature} onChange={set} />
        </div>

        <div style={{ height: '20px' }}></div>

        <div className="pdf-row">
          <span className="pdf-label" style={{ width: '220px' }}>DATE RECEIVED:</span>
          <input className="pdf-input" style={{ width: '200px' }} type="date" name="dateReceived" value={form.dateReceived} onChange={set} />
        </div>
      </div>
    </div>
  );
}
