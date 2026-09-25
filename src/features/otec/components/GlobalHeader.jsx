import React from 'react';
import { NavLink } from 'react-router-dom';
import { Thermometer } from 'lucide-react';

export default function GlobalHeader({ depthLabel = '15 Depths (0–1000m)', subLabel, floating = false }) {
  return <header className={`shared-header${floating ? ' shared-header-floating' : ''}`}>
    <NavLink to="/" end className="shared-brand">
      <span className="shared-brand-mark"><Thermometer size={17} /></span>
      <span><b>OCEANEMBED</b><small>AI SUBSURFACE OCEAN 3D RECONSTRUCTION</small></span>
    </NavLink>
    <span className="shared-subtitle">{subLabel || 'AI Subsurface Ocean 3D Reconstruction'}</span>
    <div className="shared-domain"><span>North Indian Ocean (5°N–30°N, 45°E–105°E)</span><span>{depthLabel}</span><span className="event">SIH 2026 · PS-26066</span></div>
    <nav className="shared-nav" aria-label="OceanEmbed pages">
      <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>Ocean Map</NavLink>
      <NavLink to="/tchp" className={({ isActive }) => isActive ? 'active' : ''}>TCHP Intelligence</NavLink>
      <NavLink to="/otec" className={({ isActive }) => isActive ? 'active' : ''}>OTEC Intelligence</NavLink>
    </nav>
  </header>;
}
