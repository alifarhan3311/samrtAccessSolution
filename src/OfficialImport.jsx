import React, { useRef, useState } from 'react';

const formatBytes = bytes => bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function uploadWithProgress(file, token, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const fd = new FormData();
    fd.append('file', file);

    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 90));
      }
    });

    xhr.addEventListener('load', () => {
      onProgress(100);
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data.message || 'Import failed'));
      } catch {
        reject(new Error('Invalid server response'));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error')));
    xhr.open('POST', '/api/imports');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(fd);
  });
}

export default function OfficialImport() {
  const inputRef = useRef();
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [results, setResults] = useState([]);
  const [progress, setProgress] = useState({});
  const [fileStatus, setFileStatus] = useState({});

  function choose(candidates) {
    setErrors([]);
    setResults([]);
    if (!candidates || candidates.length === 0) return;
    const newFiles = Array.from(candidates);
    const valid = [];
    const errs = [];
    for (const f of newFiles) {
      if (!/\.(xls|xlsx)$/i.test(f.name)) {
        errs.push(`"${f.name}" is not a valid XLS/XLSX workbook.`);
        continue;
      }
      if (f.size > 10 * 1024 * 1024) {
        errs.push(`"${f.name}" is larger than the 10 MB limit.`);
        continue;
      }
      valid.push(f);
    }
    setErrors(errs);
    setFiles(prev => {
      const existingNames = new Set(prev.map(p => p.name));
      const toAdd = valid.filter(v => !existingNames.has(v.name));
      return [...prev, ...toAdd];
    });
  }

  function drop(e) {
    e.preventDefault();
    setDragging(false);
    choose(e.dataTransfer.files);
  }

  async function send() {
    if (files.length === 0) return;
    setLoading(true);
    setErrors([]);
    setResults([]);

    const initProgress = {};
    const initStatus = {};
    for (const f of files) {
      initProgress[f.name] = 0;
      initStatus[f.name] = 'pending';
    }
    setProgress(initProgress);
    setFileStatus(initStatus);

    const newResults = [];
    const newErrors = [];
    const token = localStorage.getItem('token');

    for (const file of files) {
      setFileStatus(prev => ({ ...prev, [file.name]: 'uploading' }));
      setProgress(prev => ({ ...prev, [file.name]: 0 }));
      try {
        const data = await uploadWithProgress(file, token, pct => {
          setProgress(prev => ({ ...prev, [file.name]: pct }));
        });
        setFileStatus(prev => ({ ...prev, [file.name]: 'done' }));
        newResults.push({ fileName: file.name, data });
      } catch (e) {
        setFileStatus(prev => ({ ...prev, [file.name]: 'error' }));
        newErrors.push(`${file.name}: ${e.message}`);
      }
    }

    setResults(newResults);
    setErrors(newErrors);
    setLoading(false);
    if (newErrors.length === 0) {
      setTimeout(() => setFiles([]), 1500);
    }
  }

  function removeFile(index) {
    const name = files[index]?.name;
    setFiles(prev => prev.filter((_, i) => i !== index));
    setProgress(prev => { const n = { ...prev }; delete n[name]; return n; });
    setFileStatus(prev => { const n = { ...prev }; delete n[name]; return n; });
    setResults([]);
  }

  const statusColor = { pending: '#aaa', uploading: '#183d36', done: '#2d8a4e', error: '#d32f2f' };
  const statusLabel = { pending: 'Waiting...', uploading: '', done: 'Done ✓', error: 'Failed ✕' };

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

      <div className="import-shell" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <span style={{ fontSize: '10px', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', background: '#dce8ca', color: '#163b34', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
              BATCH IMPORT
            </span>
            <h2 style={{ font: '700 20px Manrope', margin: '6px 0 2px', color: '#163b34' }}>Terminal Data Workbooks</h2>
            <p style={{ margin: 0, fontSize: '13px', color: '#6f7b73' }}>Upload both Status and Management files together to sync everything at once.</p>
          </div>
          <small style={{ background: '#f4f7f2', border: '1px solid #e2e8e3', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, color: '#2d574e' }}>
            📄 Expected Files: .xls or .xlsx
          </small>
        </div>

        <div
          className={`drop-zone ${dragging ? 'dragging' : ''} ${files.length > 0 ? 'has-file' : ''}`}
          style={{ minHeight: files.length > 0 ? 'auto' : '170px', padding: files.length > 0 ? '16px' : '40px' }}
          onDragEnter={e => { e.preventDefault(); setDragging(true); }}
          onDragOver={e => e.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={drop}
          onClick={(e) => {
            if (e.target.closest('.remove-file') || e.target.closest('button')) return;
            if (!loading) inputRef.current?.click();
          }}
        >
          <input ref={inputRef} hidden type="file" accept=".xls,.xlsx" multiple onChange={e => choose(e.target.files)} />
          {files.length > 0 ? (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {files.map((file, i) => {
                const pct = progress[file.name] ?? 0;
                const status = fileStatus[file.name] || 'pending';
                const isDone = status === 'done';
                const isError = status === 'error';
                const barColor = isError ? '#d32f2f' : isDone ? '#2d8a4e' : '#183d36';

                return (
                  <div key={i} style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e5e5e5', padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: loading ? '10px' : '0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="file-badge" style={{ margin: 0, flexShrink: 0 }}>XLS</div>
                        <div style={{ textAlign: 'left' }}>
                          <b style={{ display: 'block', fontSize: '13px', color: '#111', wordBreak: 'break-all' }}>{file.name}</b>
                          <small style={{ color: '#888' }}>{formatBytes(file.size)}</small>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                        {loading && (
                          <span style={{ fontSize: '12px', fontWeight: 700, color: statusColor[status], minWidth: '60px', textAlign: 'right' }}>
                            {status === 'uploading' ? `${pct}%` : statusLabel[status]}
                          </span>
                        )}
                        {!loading && (
                          <button type="button" className="remove-file" onClick={() => removeFile(i)}
                            style={{ background: 'transparent', border: 'none', color: '#d32f2f', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>
                            Remove
                          </button>
                        )}
                      </div>
                    </div>

                    {loading && (
                      <div style={{ background: '#f0f0f0', borderRadius: '999px', height: '6px', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${pct}%`,
                          background: barColor,
                          borderRadius: '999px',
                          transition: 'width 0.3s ease, background 0.3s ease'
                        }} />
                      </div>
                    )}
                  </div>
                );
              })}

              {!loading && (
                <div style={{ marginTop: '4px', fontSize: '13px', color: '#666', textAlign: 'center' }}>
                  <button type="button" style={{ background: 'none', border: 'none', color: '#2a5aaa', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => inputRef.current?.click()}>Add more files</button> or drop them here.
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="upload-cloud" style={{ width: '48px', height: '48px', fontSize: '22px', marginBottom: '8px' }}>↑</div>
              <h3 style={{ fontSize: '16px' }}>{dragging ? 'Drop files here' : 'Drag & drop Excel files here'}</h3>
              <p style={{ fontSize: '12px' }}>or <button type="button" style={{ background: 'none', border: 'none', color: '#2a5aaa', cursor: 'pointer', textDecoration: 'underline' }}>browse from computer</button></p>
              <small>XLS or XLSX · multiple allowed</small>
            </>
          )}
        </div>

        {errors.length > 0 && (
          <div className="import-error" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px', marginTop: '12px' }}>
            {errors.map((err, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span>!</span>{err}</div>
            ))}
          </div>
        )}

        <button className="run-import" disabled={files.length === 0 || loading} onClick={send} style={{ marginTop: '16px' }}>
          {loading ? (
            <><i></i>Processing {files.length} {files.length === 1 ? 'file' : 'files'}...</>
          ) : (
            <>Run Import for {files.length} {files.length === 1 ? 'File' : 'Files'} <span>→</span></>
          )}
        </button>

        {results.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
            {results.map((res, i) => (
              <section key={i} className="import-success" style={{ margin: 0 }}>
                <div className="success-title">
                  <span>✓</span>
                  <div>
                    <b>{res.fileName} imported successfully</b>
                    <p>Official terminal records updated.</p>
                  </div>
                </div>
                <div className="import-results">
                  {[['imported', 'Imported'], ['new', 'New'], ['updated', 'Updated'], ['removed', 'No longer present'], ['unchanged', 'Unchanged']].map(([key, label]) => (
                    <div key={key}><small>{label}</small><strong>{res.data[key] || 0}</strong></div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <p className="import-footnote">All imports are securely logged with administrator, date, time and source filename.</p>
    </main>
  );
}
