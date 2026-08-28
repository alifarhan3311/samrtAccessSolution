import React, { useState } from 'react';

export default function AtmInstallationForm() {
  const [form, setForm] = useState({
    terminalId: '', date: '', newTerminalId: '', oldTerminalId: '',
    locationName: '', locationStreet: '', locationCity: '', locationPostalCode: '',
    contactPersonName: '', phone: '', email: '',
    chequePayableTo: '', mailingStreet: '', mailingCity: '', mailingPostalCode: '',
    machineOwnershipMH: '', machineOwnershipStore: '', machineOwnershipRent: '',
    atmSurcharge: '', merchant: '',
    cashLoadByMH: '', cashLoadByOther: '',
    machineModel: '', machineSerialNo: '',
    communicationInternet: '', communicationDPL: '', communicationPowerline: '',
    safeCode: '', masterCode: '', pinpadModel: '', pinpadCode: '',
    installationDate: '', timeOfActivation: '', installedBy: '',
    atmSignTopHeader: '', atmSignLed: '', atmSignSticker: '',
    boltToGroundYes: '', boltToGroundNo: '',
    machineVacuumedYes: '', machineVacuumedNo: '',
    reviewedBy: '', reviewedDate: '', assignedTo: '', atmAgent: '',
    commissionSplit: '', officeAtmSerial: '', remarks: ''
  });

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [searchId, setSearchId] = useState('');

  const set = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.terminalId) return setMsg({ text: 'Terminal ID is required to save.', type: 'error' });
    setLoading(true); setMsg({ text: '', type: '' });
    try {
      const res = await fetch('/api/atm/installation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save');
      setMsg({ text: 'Terminal registered and form saved successfully!', type: 'success' });
    } catch (err) { setMsg({ text: err.message, type: 'error' }); }
    finally { setLoading(false); }
  };

  const handleSearch = async () => {
    if (!searchId) return;
    setLoading(true); setMsg({ text: '', type: '' });
    try {
      const res = await fetch(`/api/atm/installation/${encodeURIComponent(searchId)}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Form not found');
      if (data.date) data.date = data.date.split('T')[0];
      if (data.installationDate) data.installationDate = data.installationDate.split('T')[0];
      if (data.reviewedDate) data.reviewedDate = data.reviewedDate.split('T')[0];
      setForm(prev => ({ ...prev, ...data }));
      setMsg({ text: 'Form loaded successfully.', type: 'success' });
    } catch (err) { setMsg({ text: err.message, type: 'error' }); }
    finally { setLoading(false); }
  };

  const R = ({ label, name, type = 'text', placeholder = '' }) => (
    <div className="form-row">
      <div className="form-label">{label}</div>
      <div className="form-value">
        <input type={type} name={name} value={form[name]} onChange={set} placeholder={placeholder} />
      </div>
    </div>
  );

  return (
    <div className="print-area">
      {/* Top Bar */}
      <div className="atm-top-bar no-print">
        <div className="search-group">
          <input type="text" placeholder="Search by Terminal ID..." value={searchId}
            onChange={e => setSearchId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()} />
          <button className="atm-btn load" onClick={handleSearch} disabled={loading}>
            Load Existing
          </button>
        </div>
        <div className="action-group">
          <button className="atm-btn primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving...' : '✓ Submit & Register'}
          </button>
          <button className="atm-btn secondary" onClick={() => window.print()}>
            🖨 Print / PDF
          </button>
        </div>
      </div>

      {/* Notification */}
      {msg.text && <div className={`atm-notify ${msg.type}`}>{msg.text}</div>}

      {/* Form Body */}
      <div className="atm-form-body">
        <div className="sheet-title">ATM INFORMATION SHEET</div>

        {/* Header Info */}
        <div className="form-grid">
          <div className="form-row split">
            <div>
              <div className="form-label">Terminal ID</div>
              <div className="form-value"><input type="text" name="terminalId" value={form.terminalId} onChange={set} placeholder="e.g. T-1001" /></div>
            </div>
            <div>
              <div className="form-label">Date</div>
              <div className="form-value"><input type="date" name="date" value={form.date} onChange={set} /></div>
            </div>
          </div>
          <div className="form-row split">
            <div>
              <div className="form-label">New Terminal ID</div>
              <div className="form-value"><input type="text" name="newTerminalId" value={form.newTerminalId} onChange={set} /></div>
            </div>
            <div>
              <div className="form-label">Old Terminal ID</div>
              <div className="form-value"><input type="text" name="oldTerminalId" value={form.oldTerminalId} onChange={set} /></div>
            </div>
          </div>
        </div>

        {/* LOCATION INFORMATION */}
        <div className="sheet-section-title">Location Information</div>
        <div className="form-grid">
          <R label="Location Name" name="locationName" />
          <div className="form-row">
            <div className="form-label">Location Address</div>
            <div className="form-address-stack">
              <div className="address-line">
                <span>Street</span>
                <input type="text" name="locationStreet" value={form.locationStreet} onChange={set} />
              </div>
              <div className="address-line">
                <span>City</span>
                <input type="text" name="locationCity" value={form.locationCity} onChange={set} />
              </div>
              <div className="address-line">
                <span>Postal</span>
                <input type="text" name="locationPostalCode" value={form.locationPostalCode} onChange={set} />
              </div>
            </div>
          </div>
          <R label="Contact Person" name="contactPersonName" />
          <R label="Phone" name="phone" type="tel" />
          <R label="Email" name="email" type="email" />
        </div>

        {/* COMMISSION INFORMATION */}
        <div className="sheet-section-title">Commission Information</div>
        <div className="form-grid">
          <R label="Cheque Payable To" name="chequePayableTo" />
          <div className="form-row">
            <div className="form-label">Mailing Address</div>
            <div className="form-address-stack">
              <div className="address-line">
                <span>Street</span>
                <input type="text" name="mailingStreet" value={form.mailingStreet} onChange={set} />
              </div>
              <div className="address-line">
                <span>City</span>
                <input type="text" name="mailingCity" value={form.mailingCity} onChange={set} />
              </div>
              <div className="address-line">
                <span>Postal</span>
                <input type="text" name="mailingPostalCode" value={form.mailingPostalCode} onChange={set} />
              </div>
            </div>
          </div>
          <div className="form-row">
            <div className="form-label">Machine Ownership</div>
            <div className="form-value">
              <div className="multi-inline">
                <div className="inline-pair"><span>MH:</span><input type="text" name="machineOwnershipMH" value={form.machineOwnershipMH} onChange={set} /></div>
                <div className="inline-pair"><span>Store:</span><input type="text" name="machineOwnershipStore" value={form.machineOwnershipStore} onChange={set} /></div>
                <div className="inline-pair"><span>Rent:</span><input type="text" name="machineOwnershipRent" value={form.machineOwnershipRent} onChange={set} /></div>
              </div>
            </div>
          </div>
          <R label="ATM Surcharge" name="atmSurcharge" />
          <R label="Merchant" name="merchant" />
        </div>

        {/* SECURE INFORMATION */}
        <div className="sheet-section-title">Secure Information</div>
        <div className="form-grid">
          <div className="form-row">
            <div className="form-label">Cash Load By</div>
            <div className="form-value">
              <div className="multi-inline">
                <div className="inline-pair"><span>MH:</span><input type="text" name="cashLoadByMH" value={form.cashLoadByMH} onChange={set} /></div>
                <div className="inline-pair"><span>Other:</span><input type="text" name="cashLoadByOther" value={form.cashLoadByOther} onChange={set} /></div>
              </div>
            </div>
          </div>
          <R label="Machine Model" name="machineModel" />
          <R label="Machine Serial No" name="machineSerialNo" />
          <div className="form-row">
            <div className="form-label">Communication</div>
            <div className="form-value">
              <div className="multi-inline">
                <div className="inline-pair"><span>Internet:</span><input type="text" name="communicationInternet" value={form.communicationInternet} onChange={set} /></div>
                <div className="inline-pair"><span>DPL:</span><input type="text" name="communicationDPL" value={form.communicationDPL} onChange={set} /></div>
                <div className="inline-pair"><span>Powerline:</span><input type="text" name="communicationPowerline" value={form.communicationPowerline} onChange={set} /></div>
              </div>
            </div>
          </div>
          <R label="Safe Code" name="safeCode" />
          <R label="Master Code" name="masterCode" />
          <R label="Pinpad Model" name="pinpadModel" />
          <R label="Pinpad Code" name="pinpadCode" />
        </div>

        {/* INSTALLATION INFORMATION */}
        <div className="sheet-section-title">Installation Information</div>
        <div className="form-grid">
          <R label="Installation Date" name="installationDate" type="date" />
          <R label="Time of Activation" name="timeOfActivation" type="time" />
          <R label="Installed By" name="installedBy" />
          <div className="form-row">
            <div className="form-label">ATM Sign</div>
            <div className="form-value">
              <div className="multi-inline">
                <div className="inline-pair"><span>Top Header:</span><input type="text" name="atmSignTopHeader" value={form.atmSignTopHeader} onChange={set} /></div>
                <div className="inline-pair"><span>LED:</span><input type="text" name="atmSignLed" value={form.atmSignLed} onChange={set} /></div>
                <div className="inline-pair"><span>Sticker:</span><input type="text" name="atmSignSticker" value={form.atmSignSticker} onChange={set} /></div>
              </div>
            </div>
          </div>
          <div className="form-row">
            <div className="form-label">Bolt to Ground</div>
            <div className="form-value">
              <div className="multi-inline">
                <div className="inline-pair"><span>Yes:</span><input type="text" name="boltToGroundYes" value={form.boltToGroundYes} onChange={set} /></div>
                <div className="inline-pair"><span>No:</span><input type="text" name="boltToGroundNo" value={form.boltToGroundNo} onChange={set} /></div>
              </div>
            </div>
          </div>
          <div className="form-row">
            <div className="form-label">Machine Vacuumed</div>
            <div className="form-value">
              <div className="multi-inline">
                <div className="inline-pair"><span>Yes:</span><input type="text" name="machineVacuumedYes" value={form.machineVacuumedYes} onChange={set} /></div>
                <div className="inline-pair"><span>No:</span><input type="text" name="machineVacuumedNo" value={form.machineVacuumedNo} onChange={set} /></div>
              </div>
            </div>
          </div>
        </div>

        {/* OFFICE USE ONLY */}
        <div className="sheet-section-title">Office Use Only</div>
        <div className="form-grid">
          <div className="form-row split">
            <div>
              <div className="form-label">Reviewed By</div>
              <div className="form-value"><input type="text" name="reviewedBy" value={form.reviewedBy} onChange={set} /></div>
            </div>
            <div>
              <div className="form-label">Date</div>
              <div className="form-value"><input type="date" name="reviewedDate" value={form.reviewedDate} onChange={set} /></div>
            </div>
          </div>
          <R label="Assigned To" name="assignedTo" />
          <div className="form-row split">
            <div>
              <div className="form-label">ATM Agent</div>
              <div className="form-value"><input type="text" name="atmAgent" value={form.atmAgent} onChange={set} /></div>
            </div>
            <div>
              <div className="form-label">Commission Split</div>
              <div className="form-value"><input type="text" name="commissionSplit" value={form.commissionSplit} onChange={set} /></div>
            </div>
          </div>
          <R label="Office ATM Serial" name="officeAtmSerial" />
          <div className="form-row">
            <div className="form-label" style={{alignItems:'flex-start',paddingTop:12}}>Remarks</div>
            <div className="form-value">
              <textarea name="remarks" value={form.remarks} onChange={set} placeholder="Any additional notes..."></textarea>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
