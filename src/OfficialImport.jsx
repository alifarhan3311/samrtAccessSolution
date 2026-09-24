import React, { useRef, useState } from 'react';
import LoadingSpinner from './LoadingSpinner.jsx';

const formatBytes = bytes => bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function SingleImportSection({ title, subtitle, badge, placeholderName }) {
  const inputRef = useRef();
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  function choose(candidate) {
    setError('');
    setResult(null);
    if (!candidate) return;
    if (!/\.(xls|xlsx)$/i.test(candidate.name)) {
      return setError('Please select a valid XLS or XLSX workbook.');
    }
    if (candidate.size > 10 * 1024 * 1024) {
      return setError('File is larger than the 10 MB upload limit.');
    }
    setFile(candidate);
  }

  function drop(e) {
    e.preventDefault();
    setDragging(false);
    choose(e.dataTransfer.files?.[0]);
  }

  async function send() {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/imports', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: fd
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Import failed');
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="import-shell" style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <span style={{ fontSize: '10px', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', background: '#dce8ca', color: '#163b34', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
            {badge}
          </span>
          <h2 style={{ font: '700 20px Manrope', margin: '6px 0 2px', color: '#163b34' }}>{title}</h2>
          <p style={{ margin: 0, fontSize: '13px', color: '#6f7b73' }}>{subtitle}</p>
        </div>
        <small style={{ background: '#f4f7f2', border: '1px solid #e2e8e3', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, color: '#2d574e' }}>
          📄 Expected File: {placeholderName}
        </small>
      </div>

      <div
        className={`drop-zone ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
        style={{ minHeight: file ? '110px' : '170px' }}
        onDragEnter={e => { e.preventDefault(); setDragging(true); }}
        onDragOver={e => e.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
        onClick={() => !file && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          hidden
          type="file"
          accept=".xls,.xlsx"
          onChange={e => choose(e.target.files?.[0])}
        />
        {file ? (
          <>
            <div className="file-badge">XLS</div>
            <div className="file-info">
              <b>{file.name}</b>
              <small>{formatBytes(file.size)} · File selected & ready</small>
            </div>
            <button
              type="button"
              className="remove-file"
              onClick={e => {
                e.stopPropagation();
                setFile(null);
                setResult(null);
                if (inputRef.current) inputRef.current.value = '';
              }}
            >
              Remove
            </button>
          </>
        ) : (
          <>
            <div className="upload-cloud" style={{ width: '48px', height: '48px', fontSize: '22px', marginBottom: '8px' }}>↑</div>
            <h3 style={{ fontSize: '16px' }}>{dragging ? 'Drop file here' : `Drag & drop ${placeholderName} here`}</h3>
            <p style={{ fontSize: '12px' }}>or <button type="button">browse from computer</button></p>
            <small>XLS or XLSX · maximum 10 MB</small>
          </>
        )}
      </div>

      {error && <div className="import-error"><span>!</span>{error}</div>}

      <button
        className="run-import"
        disabled={!file || loading}
        onClick={send}
        style={{ marginTop: '16px' }}
      >
        {loading ? (
          <><i></i>Importing {title}...</>
        ) : (
          <>Run Import for {title} <span>→</span></>
        )}
      </button>

      {loading && <LoadingSpinner text={`Parsing workbook & synchronizing ${title} records...`} />}

      {result && (
        <section className="import-success" style={{ marginTop: '16px' }}>
          <div className="success-title">
            <span>✓</span>
            <div>
              <b>{title} imported successfully</b>
              <p>Official terminal records updated.</p>
            </div>
          </div>
          <div className="import-results">
            {[
              ['imported', 'Imported'],
              ['new', 'New'],
              ['updated', 'Updated'],
              ['removed', 'No longer present'],
              ['unchanged', 'Unchanged']
            ].map(([key, label]) => (
              <div key={key}>
                <small>{label}</small>
                <strong>{result[key]}</strong>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default function OfficialImport() {
  return (
    <main className="import-page">
      <section className="import-intro">
        <div className="import-icon">⇅</div>
        <div>
          <p className="eyebrow">CONTROLLED SYNCHRONIZATION</p>
          <h1>Official Data Sync</h1>
          <p>Upload official terminal status and management files to synchronize ATM fleet records safely.</p>
        </div>
      </section>

      <div className="safety" style={{ marginBottom: '24px' }}>
        <span>✓</span>
        <div>
          <b>Your internal records are protected</b>
          <p>Official status layer and communication timestamps are updated by Terminal ID. Manual assignments remain untouched.</p>
        </div>
      </div>

      <SingleImportSection
        badge="Format 1 — Status File"
        title="Canada Terminal Status Workbook"
        subtitle="Syncs Status, Cash Balance, Wish Amount, City, Agent, Last Communication, etc."
        placeholderName="Canada Terminal Status.xlsx"
      />

      <SingleImportSection
        badge="Format 2 — Management File"
        title="Terminal Management Workbook"
        subtitle="Syncs Cassette Values, Cassette Counts, Dispensed Amount, Last Settled Time, etc."
        placeholderName="TerminalManagement.xls"
      />

      <p className="import-footnote">All imports are securely logged with administrator, date, time and source filename.</p>
    </main>
  );
}
