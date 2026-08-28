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

  const handlePrint = () => {
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>ATM INFORMATION SHEET - ${form.terminalId || 'Form'}</title>
        <style>
          @page {
            size: letter portrait;
            margin: 8mm 10mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: Arial, Helvetica, sans-serif;
            color: #000;
            background: #fff;
            font-size: 10px;
            line-height: 1.2;
            padding: 4px;
          }
          .sheet-container {
            border: 2px solid #000;
            width: 100%;
            margin: 0 auto;
          }
          .header-title {
            background-color: #f0f0f0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            text-align: center;
            font-size: 13px;
            font-weight: 900;
            padding: 4px;
            border-bottom: 2px solid #000;
            letter-spacing: 0.5px;
          }
          .section-banner {
            background-color: #f0f0f0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            text-align: center;
            font-size: 9.5px;
            font-weight: bold;
            padding: 3px;
            border-top: 1.5px solid #000;
            border-bottom: 1.5px solid #000;
            letter-spacing: 0.5px;
          }
          .table-row {
            display: flex;
            border-bottom: 1px solid #000;
            min-height: 20px;
            align-items: stretch;
          }
          .table-row:last-child {
            border-bottom: none;
          }
          .col-half {
            flex: 1;
            display: flex;
            align-items: center;
            padding: 2px 6px;
          }
          .col-half:first-child {
            border-right: 1px solid #000;
          }
          .label-fixed {
            width: 155px;
            flex-shrink: 0;
            font-weight: bold;
            font-size: 9px;
            padding: 2px 6px;
            display: flex;
            align-items: center;
            border-right: 1px solid #000;
          }
          .label-fixed.top-aligned {
            align-items: flex-start;
            padding-top: 4px;
          }
          .val-cell {
            flex: 1;
            padding: 2px 6px;
            font-size: 9.5px;
            display: flex;
            align-items: center;
            word-break: break-word;
          }
          .inline-subgroup {
            display: flex;
            align-items: center;
            flex: 1;
            padding: 0 4px;
          }
          .sub-label {
            font-weight: bold;
            font-size: 8.5px;
            margin-right: 4px;
          }
          .sub-val-line {
            flex: 1;
            border-bottom: 1px solid #333;
            min-height: 14px;
            display: flex;
            align-items: flex-end;
            padding: 0 4px;
            font-size: 9px;
            margin-right: 8px;
          }
          .sub-val-line:last-child {
            margin-right: 0;
          }
          .stacked-address {
            flex: 1;
            display: flex;
            flex-direction: column;
          }
          .address-subrow {
            display: flex;
            align-items: center;
            border-bottom: 1px solid #000;
            padding: 2px 6px;
            min-height: 19px;
          }
          .address-subrow:last-child {
            border-bottom: none;
          }
          .address-subrow .sub-label {
            width: 75px;
            flex-shrink: 0;
          }
          .remarks-area {
            min-height: 38px;
            align-items: flex-start;
            padding: 4px 6px;
          }
        </style>
      </head>
      <body>
        <div class="sheet-container">
          <div class="header-title">ATM INFORMATION SHEET</div>

          <!-- Top Terminal ID & Date -->
          <div class="table-row">
            <div class="col-half">
              <span class="sub-label" style="width: 80px;">Terminal ID:</span>
              <span class="val-cell">${form.terminalId || ''}</span>
            </div>
            <div class="col-half">
              <span class="sub-label" style="width: 50px;">Date:</span>
              <span class="val-cell">${form.date || ''}</span>
            </div>
          </div>

          <!-- New / Old Terminal ID -->
          <div class="table-row">
            <div class="col-half">
              <span class="sub-label" style="width: 80px;">Terminal ID:</span>
              <div class="inline-subgroup">
                <span class="sub-label">New:</span>
                <div class="sub-val-line">${form.newTerminalId || ''}</div>
              </div>
            </div>
            <div class="col-half">
              <div class="inline-subgroup">
                <span class="sub-label">Old:</span>
                <div class="sub-val-line">${form.oldTerminalId || ''}</div>
              </div>
            </div>
          </div>

          <!-- LOCATION INFORMATION -->
          <div class="section-banner">LOCATION INFORMATION</div>
          
          <div class="table-row">
            <div class="label-fixed">LOCATION NAME:</div>
            <div class="val-cell">${form.locationName || ''}</div>
          </div>

          <div class="table-row">
            <div class="label-fixed top-aligned">Location Address:</div>
            <div class="stacked-address">
              <div class="address-subrow">
                <span class="sub-label">Street:</span>
                <span class="val-cell">${form.locationStreet || ''}</span>
              </div>
              <div class="address-subrow">
                <span class="sub-label">City:</span>
                <span class="val-cell">${form.locationCity || ''}</span>
              </div>
              <div class="address-subrow">
                <span class="sub-label">Postal Code:</span>
                <span class="val-cell">${form.locationPostalCode || ''}</span>
              </div>
            </div>
          </div>

          <div class="table-row">
            <div class="label-fixed">Contact Person Name:</div>
            <div class="val-cell">${form.contactPersonName || ''}</div>
          </div>
          <div class="table-row">
            <div class="label-fixed">Phone:</div>
            <div class="val-cell">${form.phone || ''}</div>
          </div>
          <div class="table-row">
            <div class="label-fixed">Email:</div>
            <div class="val-cell">${form.email || ''}</div>
          </div>

          <!-- COMMISSION INFORMATION -->
          <div class="section-banner">COMMISSION INFORMATION</div>

          <div class="table-row">
            <div class="label-fixed">CHEQUE PAYBLE TO:</div>
            <div class="val-cell">${form.chequePayableTo || ''}</div>
          </div>

          <div class="table-row">
            <div class="label-fixed top-aligned">MAILING ADDRESS</div>
            <div class="stacked-address">
              <div class="address-subrow">
                <span class="sub-label">Street:</span>
                <span class="val-cell">${form.mailingStreet || ''}</span>
              </div>
              <div class="address-subrow">
                <span class="sub-label">City:</span>
                <span class="val-cell">${form.mailingCity || ''}</span>
              </div>
              <div class="address-subrow">
                <span class="sub-label">Postal Code:</span>
                <span class="val-cell">${form.mailingPostalCode || ''}</span>
              </div>
            </div>
          </div>

          <div class="table-row">
            <div class="label-fixed">Machine Owner Ship:</div>
            <div class="inline-subgroup">
              <span class="sub-label">MH:</span>
              <div class="sub-val-line">${form.machineOwnershipMH || ''}</div>
              <span class="sub-label">STORE OWNER:</span>
              <div class="sub-val-line">${form.machineOwnershipStore || ''}</div>
              <span class="sub-label">RENT:</span>
              <div class="sub-val-line">${form.machineOwnershipRent || ''}</div>
            </div>
          </div>

          <div class="table-row">
            <div class="label-fixed">ATM SURCHARGE</div>
            <div class="val-cell">${form.atmSurcharge || ''}</div>
          </div>

          <div class="table-row">
            <div class="label-fixed">MERCHANT</div>
            <div class="val-cell">${form.merchant || ''}</div>
          </div>

          <!-- SECURE INFORMATION -->
          <div class="section-banner">SECURE INFORMATION</div>

          <div class="table-row">
            <div class="label-fixed">CASH LOAD BY</div>
            <div class="inline-subgroup">
              <span class="sub-label">MH:</span>
              <div class="sub-val-line">${form.cashLoadByMH || ''}</div>
              <span class="sub-label">OTHER:</span>
              <div class="sub-val-line">${form.cashLoadByOther || ''}</div>
            </div>
          </div>

          <div class="table-row">
            <div class="label-fixed">MACHINE MODEL:</div>
            <div class="val-cell">${form.machineModel || ''}</div>
          </div>

          <div class="table-row">
            <div class="label-fixed">MACHINE SERIAL NO:</div>
            <div class="val-cell">${form.machineSerialNo || ''}</div>
          </div>

          <div class="table-row">
            <div class="label-fixed">COMMUNICATION</div>
            <div class="inline-subgroup">
              <span class="sub-label">INTERNET:</span>
              <div class="sub-val-line">${form.communicationInternet || ''}</div>
              <span class="sub-label">DPL:</span>
              <div class="sub-val-line">${form.communicationDPL || ''}</div>
              <span class="sub-label">POWERLINE ADAPTOR:</span>
              <div class="sub-val-line">${form.communicationPowerline || ''}</div>
            </div>
          </div>

          <div class="table-row">
            <div class="label-fixed">SAFE CODE:</div>
            <div class="val-cell">${form.safeCode || ''}</div>
          </div>

          <div class="table-row">
            <div class="label-fixed">MASTER CODE:</div>
            <div class="val-cell">${form.masterCode || ''}</div>
          </div>

          <div class="table-row">
            <div class="label-fixed">PINPAD MODEL:</div>
            <div class="val-cell">${form.pinpadModel || ''}</div>
          </div>

          <div class="table-row">
            <div class="label-fixed">PINPAD CODE:</div>
            <div class="val-cell">${form.pinpadCode || ''}</div>
          </div>

          <!-- INSTALLATION INFORMATION -->
          <div class="section-banner">INSTALLATION INFORMATION</div>

          <div class="table-row">
            <div class="label-fixed">INSTALLATION DATE:</div>
            <div class="val-cell">${form.installationDate || ''}</div>
          </div>

          <div class="table-row">
            <div class="label-fixed">TIME OF ACTIVATION:</div>
            <div class="val-cell">${form.timeOfActivation || ''}</div>
          </div>

          <div class="table-row">
            <div class="label-fixed">INSTALLED BY:</div>
            <div class="val-cell">${form.installedBy || ''}</div>
          </div>

          <div class="table-row">
            <div class="label-fixed">ATM SIGN</div>
            <div class="inline-subgroup">
              <span class="sub-label">TOP HEADER:</span>
              <div class="sub-val-line">${form.atmSignTopHeader || ''}</div>
              <span class="sub-label">LED SIGN:</span>
              <div class="sub-val-line">${form.atmSignLed || ''}</div>
              <span class="sub-label">STICKER ON SCREEN:</span>
              <div class="sub-val-line">${form.atmSignSticker || ''}</div>
            </div>
          </div>

          <div class="table-row">
            <div class="label-fixed">BOLT TO GROUND</div>
            <div class="inline-subgroup">
              <span class="sub-label">YES:</span>
              <div class="sub-val-line">${form.boltToGroundYes || ''}</div>
              <span class="sub-label">NO:</span>
              <div class="sub-val-line">${form.boltToGroundNo || ''}</div>
            </div>
          </div>

          <div class="table-row">
            <div class="label-fixed">MACHINE VACUUMED:</div>
            <div class="inline-subgroup">
              <span class="sub-label">YES:</span>
              <div class="sub-val-line">${form.machineVacuumedYes || ''}</div>
              <span class="sub-label">NO:</span>
              <div class="sub-val-line">${form.machineVacuumedNo || ''}</div>
            </div>
          </div>

          <!-- OFFICE USE ONLY -->
          <div class="section-banner">OFFICE USE ONLY</div>

          <div class="table-row">
            <div class="col-half">
              <span class="sub-label" style="width: 100px;">REVIEWED BY:</span>
              <span class="val-cell">${form.reviewedBy || ''}</span>
            </div>
            <div class="col-half">
              <span class="sub-label" style="width: 50px;">DATE:</span>
              <span class="val-cell">${form.reviewedDate || ''}</span>
            </div>
          </div>

          <div class="table-row">
            <div class="label-fixed">ASSIGNED TO:</div>
            <div class="val-cell">${form.assignedTo || ''}</div>
          </div>

          <div class="table-row">
            <div class="col-half">
              <span class="sub-label" style="width: 100px;">ATM AGENT:</span>
              <span class="val-cell">${form.atmAgent || ''}</span>
            </div>
            <div class="col-half">
              <span class="sub-label" style="width: 130px;">ANY COMMISSION SPLIT:</span>
              <span class="val-cell">${form.commissionSplit || ''}</span>
            </div>
          </div>

          <div class="table-row">
            <div class="label-fixed">OFFICE ATM SERIAL:</div>
            <div class="val-cell">${form.officeAtmSerial || ''}</div>
          </div>

          <div class="table-row">
            <div class="label-fixed top-aligned">REMARKS:</div>
            <div class="val-cell remarks-area">${form.remarks || ''}</div>
          </div>

        </div>
      </body>
      </html>
    `;

    // Create an invisible iframe for completely reliable printing
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(printContent);
    doc.close();

    iframe.contentWindow.focus();
    setTimeout(() => {
      iframe.contentWindow.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 250);
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
    <div className="atm-form-wrapper">
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
          <button className="atm-btn secondary" onClick={handlePrint}>
            🖨 Print / PDF
          </button>
        </div>
      </div>

      {/* Notification */}
      {msg.text && <div className={`atm-notify ${msg.type}`}>{msg.text}</div>}

      {/* Form Body on Screen */}
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
