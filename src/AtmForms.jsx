import React, { useState } from 'react';
import AtmInstallationForm from './AtmInstallationForm.jsx';
import AtmAgreementForm from './AtmAgreementForm.jsx';
import AtmRemovalForm from './AtmRemovalForm.jsx';
import './atm-forms.css';

export default function AtmForms() {
  const [activeTab, setActiveTab] = useState('installation');

  const tabs = [
    { id: 'installation', label: 'ATM Installation Form' },
    { id: 'agreement', label: 'ATM Agreement Form' },
    { id: 'removal', label: 'ATM Removal' }
  ];

  return (
    <div className="atm-forms-container">
      <div className="atm-tab-bar">
        {tabs.map(t => (
          <div
            key={t.id}
            className={`atm-tab ${activeTab === t.id ? 'atm-tab-active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </div>
        ))}
      </div>

      <div className="atm-forms-content">
        {activeTab === 'installation' && <AtmInstallationForm />}
        {activeTab === 'agreement' && <AtmAgreementForm />}
        {activeTab === 'removal' && <AtmRemovalForm />}
      </div>
    </div>
  );
}
