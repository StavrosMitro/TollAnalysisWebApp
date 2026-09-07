import React from 'react';
import './BrowserFrame.css';

/**
 * Restrained browser chrome around a product screenshot.
 *   <BrowserFrame url="tollanalysis.app/map"><img ... /></BrowserFrame>
 */
export default function BrowserFrame({ url = 'tollanalysis.app', children, className }) {
  return (
    <figure className={`bframe${className ? ` ${className}` : ''}`}>
      <div className="bframe__bar">
        <span className="bframe__dots"><i /><i /><i /></span>
        <span className="bframe__url">{url}</span>
      </div>
      <div className="bframe__body">{children}</div>
    </figure>
  );
}
