import React, { useEffect, useState } from 'react';
import { backDestination, groupVisibleLinks } from './navigation.mjs';
import './navigation.css';

export function GroupedNavigation({ links, currentPath, onNavigate }) {
  const groups = groupVisibleLinks(links);
  const activeGroup = groups.find(group => group.keys.includes(currentPath));
  const [expanded, setExpanded] = useState(activeGroup?.id);
  useEffect(() => { setExpanded(activeGroup?.id); }, [activeGroup?.id]);
  return <nav aria-label="Main navigation" className="grouped-navigation">
    {groups.map(group => <div className="navigation-group" key={group.id}>
      <button type="button" className={`navigation-group-toggle ${activeGroup?.id === group.id ? 'current-group' : ''}`}
        aria-expanded={expanded === group.id} aria-controls={`nav-${group.id}`}
        onClick={() => setExpanded(expanded === group.id ? null : group.id)}>
        <span>{group.label}</span><span aria-hidden="true">{expanded === group.id ? '−' : '+'}</span>
      </button>
      <div id={`nav-${group.id}`} className="navigation-group-links" hidden={expanded !== group.id}>
        {group.links.map(link => <button type="button" key={link[0]} className={currentPath === link[0] ? 'active' : ''}
          aria-current={currentPath === link[0] ? 'page' : undefined} onClick={() => onNavigate(link[3])}>
          <i aria-hidden="true">{link[2]}</i>{link[1]}
        </button>)}
      </div>
    </div>)}
  </nav>;
}

export function PageNavigation({ links, currentPath, title, navigate }) {
  const group = groupVisibleLinks(links).find(item => item.keys.includes(currentPath));
  const fallback = group?.links.find(link => link[0] !== currentPath)?.[3]
    || links.find(link => link[0] !== currentPath)?.[3] || '/dashboard';
  return <div className="page-navigation">
    <div className="page-navigation-trail">
      <button type="button" className="navigation-back" onClick={() => navigate(backDestination(window.history.state?.idx, fallback))}>
        <span aria-hidden="true">←</span> Back
      </button>
      <nav aria-label="Breadcrumb" className="navigation-breadcrumb">
        <span>Smart Access</span><span aria-hidden="true">/</span><span>{group?.label || 'Operations'}</span>
        <span aria-hidden="true">/</span><strong aria-current="page">{title}</strong>
      </nav>
    </div>
    {group?.links.length > 1 && <nav aria-label={`${group.label} pages`} className="related-navigation">
      {group.links.map(link => <button type="button" key={link[0]} className={currentPath === link[0] ? 'selected' : ''}
        aria-current={currentPath === link[0] ? 'page' : undefined} onClick={() => navigate(link[3])}>{link[1]}</button>)}
    </nav>}
  </div>;
}
