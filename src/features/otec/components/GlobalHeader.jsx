import React from 'react';
import { NavLink } from 'react-router-dom';
import { Thermometer } from 'lucide-react';

export default function GlobalHeader({ depthLabel, subLabel, floating = false }) {
  return <header className={`shared-header${floating ? ' shared-header-floating' : ''}`}>
    <NavLink to="/" end className="shared-brand">
      <span className="shared-brand-mark"><Thermometer size={17} /></span>
      <span><b>OCEANEMBED</b><small></small></span>
    </NavLink>
    <span className="shared-subtitle">{subLabel || ''}</span>
    <div className="shared-domain"><span></span><span>{depthLabel}</span><span className="event"></span></div>
    <nav className="shared-nav" aria-label="OceanEmbed pages">
      <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>Ocean Map</NavLink>
      <NavLink to="/tchp" className={({ isActive }) => isActive ? 'active' : ''}>TCHP Intelligence</NavLink>
      <NavLink to="/otec" className={({ isActive }) => isActive ? 'active' : ''}>OTEC Intelligence</NavLink>
    </nav>
  </header>;
}
