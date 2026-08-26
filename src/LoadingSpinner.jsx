import React from 'react';
import './loader.css';

export function LoadingSpinner({ text = 'Loading operational data...', minHeight = 260 }) {
  return (
    <div className="global-loader-container" style={{ minHeight }}>
      <div className="loader-spinner-wrap">
        <div className="loader-pulse-glow"></div>
        <div className="loader-ring"></div>
        <div className="loader-brand-mark">S</div>
      </div>
      <div className="loader-text">
        <span>{text}</span>
        <span className="loader-dots">
          <span>.</span><span>.</span><span>.</span>
        </span>
      </div>
    </div>
  );
}

export function SkeletonRows({ count = 5 }) {
  return (
    <div style={{ width: '100%' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-table-row">
          <div className="skeleton-box skeleton-avatar"></div>
          <div style={{ flex: 1 }}>
            <div className="skeleton-box skeleton-line-long"></div>
            <div className="skeleton-box skeleton-line-short"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default LoadingSpinner;
