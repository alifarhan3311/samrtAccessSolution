import React, { useState } from 'react';
import AtmInstallationForm from './AtmInstallationForm.jsx';
import AtmAgreementForm from './AtmAgreementForm.jsx';
import AtmRemovalForm from './AtmRemovalForm.jsx';
import './atm-forms.css';

import AssignTerminal from './AssignTerminal.jsx';

export default function AtmForms() {
  const [activeModal, setActiveModal] = useState(null);
  const [viewingForm, setViewingForm] = useState(null);
  const [searchId, setSearchId] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [timelineData, setTimelineData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!searchId.trim()) return;
    setLoading(true);
    setError('');
    setTimelineData(null);
    try {
      const res = await fetch(`/api/atm/timeline/${encodeURIComponent(searchId.trim())}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error fetching timeline');
      setTimelineData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
    return (
      <div key={i} className="timeline-item">
        <div className="timeline-dot"></div>
        <div className="timeline-content">
          <div className="timeline-header">
            <h4>{event.title}</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="timeline-date">{new Date(event.date).toLocaleDateString()} {new Date(event.date).toLocaleTimeString()}</span>
              {['ATM Installation', 'ATM Agreement', 'ATM Removal'].includes(event.title) && (
                <button 
                  title="View / Download PDF"
                  className="atm-view-btn"
                  onClick={() => {
                    setViewingForm(event.data);
                    if (event.title === 'ATM Installation') setActiveModal('installation');
                    if (event.title === 'ATM Agreement') setActiveModal('agreement');
                    if (event.title === 'ATM Removal') setActiveModal('removal');
                  }}
                >
                  👁️
                </button>
              )}
            </div>
          </div>
          <div className="timeline-body">
            {event.data.locationName && <p><strong>Location:</strong> {event.data.locationName}</p>}
            {event.data.reason && <p><strong>Reason:</strong> {event.data.reason}</p>}
            {event.data.remarks && <p><strong>Remarks:</strong> {event.data.remarks}</p>}
            <p className="timeline-author">Created By: {event.data.createdBy?.name || 'Unknown'}</p>
          </div>
        </div>
      </div>
    );
  };

  const filteredTimeline = timelineData ? timelineData.filter(evt => {
    if (filterType === 'All') return true;
    if (filterType === 'Installation' && evt.title === 'ATM Installation') return true;
    if (filterType === 'Agreement' && evt.title === 'ATM Agreement') return true;
    if (filterType === 'Removal' && evt.title === 'ATM Removal') return true;
    if (filterType === 'Setup' && evt.title === 'ATM Setup') return true;
    return false;
  }) : null;

  return (
    <div className="atm-forms-container">
      {/* Top Action Buttons */}
      <div className="atm-actions-header">
        <h2>Smart Access ATM Forms</h2>
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

      {/* Main Timeline Search View */}
      <div className="atm-timeline-view">
        <div className="atm-search-box">
          <input 
            type="text" 
            placeholder="Search Terminal ID (e.g. CA101618) to view timeline..." 
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch} disabled={loading}>
            {loading ? 'Searching...' : '🔍 Search Timeline'}
          </button>
        </div>
        
        {error && <div className="atm-error-msg">{error}</div>}

        {timelineData && (
          <div className="timeline-results">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>Timeline for Terminal: {searchId.toUpperCase()}</h3>
              <select 
                value={filterType} 
                onChange={e => setFilterType(e.target.value)} 
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #dce2dd', background: '#fff', fontWeight: 600, color: '#32443e', outline: 'none' }}
              >
                <option value="All">All Events</option>
                <option value="Installation">ATM Installation</option>
                <option value="Agreement">ATM Agreement</option>
                <option value="Removal">ATM Removal</option>
                <option value="Setup">ATM Setup</option>
              </select>
            </div>
            {filteredTimeline.length === 0 ? (
              <p className="no-timeline-data">No {filterType !== 'All' ? filterType : ''} records found for this Terminal ID.</p>
            ) : (
              <div className="timeline-list">
                {filteredTimeline.map((evt, i) => renderTimelineEvent(evt, i))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Overlay */}
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
