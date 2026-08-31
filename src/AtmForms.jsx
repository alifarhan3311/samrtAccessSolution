import React, { useState, useRef } from 'react';
import AtmInstallationForm from './AtmInstallationForm.jsx';
import AtmAgreementForm from './AtmAgreementForm.jsx';
import AtmRemovalForm from './AtmRemovalForm.jsx';
import AssignTerminal from './AssignTerminal.jsx';
import './atm-forms.css';

export default function AtmForms() {
  const [activeModal, setActiveModal] = useState(null);
  const [viewingForm, setViewingForm] = useState(null);
  const [previewImageUrl, setPreviewImageUrl] = useState(null);

  // Search & Filter State
  const [searchId, setSearchId] = useState('');
  const [searchedTerminalId, setSearchedTerminalId] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [timelineData, setTimelineData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Upload Form State (Left Column)
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState({ text: '', type: '' });
  const [uploadForm, setUploadForm] = useState({
    terminalId: '',
    formType: 'installation',
    date: () => {
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      return now.toISOString().slice(0, 16);
    },
    locationName: '',
    remarks: ''
  });

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setFilePreview(ev.target?.result);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadMsg({ text: 'Please select a document image or PDF file to upload.', type: 'error' });
      return;
    }
    if (!uploadForm.terminalId.trim()) {
      setUploadMsg({ text: 'Please provide the Terminal ID.', type: 'error' });
      return;
    }

    setIsUploading(true);
    setUploadMsg({ text: '', type: '' });

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('terminalId', uploadForm.terminalId.trim().toUpperCase());
      formData.append('formType', uploadForm.formType);
      formData.append('date', uploadForm.date);
      if (uploadForm.locationName) formData.append('locationName', uploadForm.locationName);
      if (uploadForm.remarks) formData.append('remarks', uploadForm.remarks);

      const res = await fetch('/api/atm/upload-form', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload failed');

      setUploadMsg({ text: 'Form document uploaded & linked to timeline successfully!', type: 'success' });
      
      const targetTermId = uploadForm.terminalId.trim().toUpperCase();
      // Reset upload inputs
      setSelectedFile(null);
      setFilePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setUploadForm(prev => ({
        ...prev,
        locationName: '',
        remarks: ''
      }));

      // Automatically search and refresh timeline for this terminal
      setSearchId(targetTermId);
      fetchTimelineFor(targetTermId);

      setTimeout(() => setUploadMsg({ text: '', type: '' }), 5000);
    } catch (err) {
      setUploadMsg({ text: err.message, type: 'error' });
    } finally {
      setIsUploading(false);
    }
  };

  const fetchTimelineFor = async (idToSearch) => {
    if (!idToSearch.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/atm/timeline/${encodeURIComponent(idToSearch.trim())}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error fetching timeline');
      setTimelineData(data);
      setSearchedTerminalId(idToSearch.trim());
    } catch (err) {
      setError(err.message);
      setTimelineData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchTimelineFor(searchId);
  };

  const renderModalContent = () => {
    const props = { initialData: viewingForm, readOnly: !!viewingForm };
    switch (activeModal) {
      case 'installation': return <AtmInstallationForm {...props} />;
      case 'agreement': return <AtmAgreementForm {...props} />;
      case 'removal': return <AtmRemovalForm {...props} />;
      case 'setup': return <AssignTerminal initialData={viewingForm} readOnly={!!viewingForm} />;
      default: return null;
    }
  };

  const renderTimelineEvent = (event, i) => {
    const hasDoc = Boolean(event.data.documentUrl || event.data.documentFile?.url);
    const docUrl = event.data.documentUrl || event.data.documentFile?.url;
    const isImage = event.data.documentFile?.mimeType?.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(docUrl || '');

    const handleViewForm = () => {
      if (hasDoc) {
        if (isImage) {
          setPreviewImageUrl(docUrl);
        } else {
          window.open(docUrl, '_blank');
        }
      } else {
        setViewingForm(event.data);
        if (event.title === 'ATM Installation') setActiveModal('installation');
        else if (event.title === 'ATM Agreement') setActiveModal('agreement');
        else if (event.title === 'ATM Removal') setActiveModal('removal');
        else if (event.title === 'ATM Setup & Location' || event.title === 'ATM Setup') setActiveModal('setup');
      }
    };

    return (
      <div key={i} className="timeline-item">
        <div className="timeline-dot"></div>
        <div className="timeline-content">
          <div className="timeline-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h4>{event.title}</h4>
              <span className={hasDoc ? 'timeline-doc-badge' : 'timeline-digital-badge'}>
                {hasDoc ? '📎 Physical Scan' : '💻 System Form'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="timeline-date">
                {new Date(event.date).toLocaleDateString()} {new Date(event.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              
              <button 
                title={hasDoc ? "View Uploaded Scanned Form" : "View Digital Form Details"}
                className="timeline-view-action-btn"
                onClick={handleViewForm}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span>View Form</span>
              </button>
            </div>
          </div>
          <div className="timeline-body">
            {event.data.locationName && <p><strong>Location / Business:</strong> {event.data.locationName}</p>}
            {event.data.customerName && <p><strong>Customer / Owner:</strong> {event.data.customerName}</p>}
            {event.data.reasonForRemoval && <p><strong>Reason for Removal:</strong> {event.data.reasonForRemoval}</p>}
            {event.data.remarks && <p><strong>Remarks / Notes:</strong> {event.data.remarks}</p>}
            <p className="timeline-author">Created / Uploaded By: {event.data.createdBy?.name || 'System'}</p>
          </div>
        </div>
      </div>
    );
  };

  const filteredTimeline = timelineData ? timelineData.filter(evt => {
    // 1. Form Type filter
    if (filterType !== 'All') {
      if (filterType === 'Installation' && evt.title !== 'ATM Installation') return false;
      if (filterType === 'Agreement' && evt.title !== 'ATM Agreement') return false;
      if (filterType === 'Removal' && evt.title !== 'ATM Removal') return false;
      if (filterType === 'Setup' && evt.title !== 'ATM Setup & Location') return false;
    }

    // 2. Date Range filters
    const evtDate = new Date(evt.date);
    if (fromDate) {
      const from = new Date(fromDate + 'T00:00:00');
      if (evtDate < from) return false;
    }
    if (toDate) {
      const to = new Date(toDate + 'T23:59:59.999');
      if (evtDate > to) return false;
    }

    return true;
  }) : [];

  return (
    <div className="atm-forms-container">
      {/* Top Header Actions */}
      <div className="atm-actions-header">
        <div>
          <h2>Smart Access ATM Forms</h2>
          <p className="atm-eyebrow-sub">Physical Form Scanning, Document Uploads & Full Lifecycle Timeline</p>
        </div>
        <div className="atm-buttons-group">
          <button className="atm-action-btn" onClick={() => setActiveModal('installation')}>
            ➕ ATM Installation Form
          </button>
          <button className="atm-action-btn" onClick={() => setActiveModal('agreement')}>
            📝 ATM Agreement Form
          </button>
          <button className="atm-action-btn" onClick={() => setActiveModal('removal')}>
            🚫 ATM Removal Form
          </button>
          <button className="atm-action-btn" onClick={() => setActiveModal('setup')}>
            📍 ATM Setup & Location Form
          </button>
        </div>
      </div>

      {/* Main 2-Column Split Grid */}
      <div className="atm-main-grid">
        {/* ── LEFT COLUMN: Upload Scanned Form Document Card ── */}
        <div className="atm-upload-card">
          <div className="atm-card-header">
            <div className="atm-card-icon">📤</div>
            <div>
              <h3>Upload Form Document</h3>
              <p>Upload physical picture or PDF scan of installation, agreement, or removal.</p>
            </div>
          </div>

          <form onSubmit={handleUploadSubmit} className="atm-upload-form">
            <div className="atm-form-group">
              <label>Terminal ID *</label>
              <input 
                type="text" 
                placeholder="e.g. CA101618" 
                value={uploadForm.terminalId}
                onChange={e => setUploadForm({ ...uploadForm, terminalId: e.target.value.toUpperCase() })}
                required
              />
            </div>

            <div className="atm-form-group">
              <label>Form Type *</label>
              <select 
                value={uploadForm.formType} 
                onChange={e => setUploadForm({ ...uploadForm, formType: e.target.value })}
                required
              >
                <option value="installation">ATM Installation Form</option>
                <option value="agreement">ATM Agreement Form</option>
                <option value="removal">ATM Removal Form</option>
                <option value="setup">ATM Setup & Location Form</option>
              </select>
            </div>

            <div className="atm-form-group">
              <label>Form Execution Date & Time *</label>
              <input 
                type="datetime-local" 
                value={uploadForm.date}
                onChange={e => setUploadForm({ ...uploadForm, date: e.target.value })}
                required
              />
            </div>

            <div className="atm-form-group">
              <label>Location / Business Name (Optional)</label>
              <input 
                type="text" 
                placeholder="e.g. VICTORIA MART" 
                value={uploadForm.locationName}
                onChange={e => setUploadForm({ ...uploadForm, locationName: e.target.value })}
              />
            </div>

            <div className="atm-form-group">
              <label>Remarks / Notes (Optional)</label>
              <input 
                type="text" 
                placeholder="e.g. Signed on site by merchant" 
                value={uploadForm.remarks}
                onChange={e => setUploadForm({ ...uploadForm, remarks: e.target.value })}
              />
            </div>

            <div className="atm-form-group">
              <label>Select Form Picture or PDF Scan *</label>
              <div 
                className={`atm-file-dropzone ${selectedFile ? 'has-file' : ''}`}
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  style={{ display: 'none' }} 
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleFileChange}
                />
                {selectedFile ? (
                  <div className="atm-file-selected">
                    {filePreview ? (
                      <img src={filePreview} alt="Preview" className="atm-file-thumb" />
                    ) : (
                      <span className="atm-file-icon">📄</span>
                    )}
                    <div className="atm-file-info">
                      <strong>{selectedFile.name}</strong>
                      <small>{(selectedFile.size / 1024).toFixed(1)} KB</small>
                    </div>
                    <button 
                      type="button" 
                      className="atm-file-remove" 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setSelectedFile(null); 
                        setFilePreview(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      title="Remove file"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="atm-dropzone-prompt">
                    <span style={{ fontSize: '32px' }}>📁</span>
                    <p><strong>Click to browse file</strong> or drag & drop</p>
                    <small>Supports JPG, PNG, WebP & PDF up to 8MB</small>
                  </div>
                )}
              </div>
            </div>

            {uploadMsg.text && (
              <div className={`atm-upload-msg ${uploadMsg.type}`}>
                {uploadMsg.text}
              </div>
            )}

            <button 
              type="submit" 
              className="atm-submit-upload-btn" 
              disabled={isUploading || !selectedFile || !uploadForm.terminalId}
            >
              {isUploading ? 'Uploading & Processing Document...' : '📤 Upload Form Document'}
            </button>
          </form>
        </div>

        {/* ── RIGHT COLUMN: Search Bar, Date Range Filters & Timeline ── */}
        <div className="atm-timeline-panel">
          <div className="atm-search-bar-wrap">
            <div className="atm-search-input-group">
              <input 
                type="text" 
                placeholder="Search Terminal ID (e.g. CA101618)..." 
                value={searchId}
                onChange={(e) => setSearchId(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button onClick={handleSearch} disabled={loading} className="atm-search-action-btn">
                {loading ? 'Searching...' : '🔍 Search Timeline'}
              </button>
            </div>

            {/* Date Range & Type Filters */}
            <div className="atm-filter-row">
              <div className="atm-filter-item">
                <label>From Date:</label>
                <input 
                  type="date" 
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                />
              </div>
              <div className="atm-filter-item">
                <label>To Date:</label>
                <input 
                  type="date" 
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                />
              </div>
              <div className="atm-filter-item">
                <label>Form Type:</label>
                <select 
                  value={filterType} 
                  onChange={e => setFilterType(e.target.value)}
                >
                  <option value="All">All Events</option>
                  <option value="Installation">Installation</option>
                  <option value="Agreement">Agreement</option>
                  <option value="Removal">Removal</option>
                  <option value="Setup">Setup & Location</option>
                </select>
              </div>
              {(fromDate || toDate || filterType !== 'All') && (
                <button 
                  className="atm-clear-filter-btn"
                  onClick={() => { setFromDate(''); setToDate(''); setFilterType('All'); }}
                  title="Reset date and type filters"
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>

          {error && <div className="atm-error-msg">{error}</div>}

          {/* Search Placeholder / Empty State */}
          {!timelineData && !loading && (
            <div className="atm-search-placeholder">
              <span style={{ fontSize: '48px' }}>🔎</span>
              <h3>Search Terminal Timeline</h3>
              <p>Enter any Terminal ID on the right search box or upload a new form scan on the left to inspect complete lifecycle history.</p>
            </div>
          )}

          {/* Timeline Results */}
          {timelineData && (
            <div className="timeline-results">
              <div className="timeline-results-header">
                <h3>Timeline: {searchedTerminalId || searchId}</h3>
                <span className="timeline-count-badge">
                  {filteredTimeline.length} Record{filteredTimeline.length === 1 ? '' : 's'} Found
                </span>
              </div>

              {filteredTimeline.length === 0 ? (
                <div className="no-timeline-box">
                  <p className="no-timeline-data">No records matching the selected date range or form type filters.</p>
                </div>
              ) : (
                <div className="timeline-list">
                  {filteredTimeline.map((evt, i) => renderTimelineEvent(evt, i))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Image Preview Lightbox Modal */}
      {previewImageUrl && (
        <div className="atm-modal-overlay" onClick={() => setPreviewImageUrl(null)}>
          <div className="atm-image-lightbox" onClick={e => e.stopPropagation()}>
            <button className="atm-lightbox-close" onClick={() => setPreviewImageUrl(null)}>✕ Close</button>
            <img src={previewImageUrl} alt="Full Form Scan" />
          </div>
        </div>
      )}

      {/* Digital Form Data Modal Overlay */}
      {activeModal && (
        <div className="atm-modal-overlay">
          <div className="atm-modal-container">
            <button className="atm-modal-close" onClick={() => { setActiveModal(null); setViewingForm(null); }}>✖ Close</button>
            <div className="atm-modal-body">
              {renderModalContent()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

