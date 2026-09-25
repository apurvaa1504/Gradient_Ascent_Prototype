import React, { useState } from 'react';
import { otecTheme } from './otec-theme';
import { SectionCard, KpiCard, ThresholdBar, StatusBadge, InfoTooltip } from './components/SharedComponents';
import { Activity } from 'lucide-react';

export default function OtecApp() {
  const [activeTab, setActiveTab] = useState("Today's Operations");

  const tabs = ["Today's Operations", "Site Explorer", "Future Site Ranking"];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: otecTheme.colors.bg, color: otecTheme.colors.textMain, fontFamily: 'sans-serif' }}>
      {/* Top Header Bar */}
      <header style={{ 
        backgroundColor: otecTheme.colors.panel, 
        borderBottom: `1px solid ${otecTheme.colors.border}`,
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '24px', height: '24px', backgroundColor: otecTheme.colors.accentTeal, color: otecTheme.colors.bg, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Activity size={16} />
              </div>
              <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', tracking: 'wide' }}>OTEC Intelligence Platform</h1>
            </div>
            <p style={{ margin: '4px 0 0 32px', fontSize: '12px', color: otecTheme.colors.textSecondary }}>
              From daily AI-reconstructed ocean profiles to clean-energy, freshwater, and site-selection decisions.
            </p>
          </div>
          
          <nav style={{ display: 'flex', gap: '8px' }}>
            {tabs.map(tab => {
              const isActive = activeTab === tab;
              return (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: isActive ? `2px solid ${otecTheme.colors.accentTeal}` : '2px solid transparent',
                    color: isActive ? otecTheme.colors.textMain : otecTheme.colors.textSecondary,
                    padding: '8px 12px',
                    fontSize: '13px',
                    fontWeight: isActive ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {tab}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Hero Strip */}
      <div style={{ 
        backgroundColor: 'rgba(47, 184, 201, 0.05)', 
        borderBottom: `1px solid ${otecTheme.colors.border}`,
        padding: '12px 24px',
        fontSize: '13px',
        color: otecTheme.colors.accentTeal,
        fontWeight: 500
      }}>
        Satellites see the ocean's surface. Our AI reconstructs the temperature beneath it—turning daily ocean conditions into energy, freshwater, and site-selection intelligence.
      </div>

      {/* Main Content Area */}
      <main style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>
        {activeTab === "Today's Operations" && (
          <div>
             <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>Today's Operations</h2>
             {/* Shell placeholder for tab 1 */}
          </div>
        )}
        
        {activeTab === "Site Explorer" && (
          <div>
             <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>Site Explorer</h2>
             {/* Shell placeholder for tab 2 */}
          </div>
        )}
        
        {activeTab === "Future Site Ranking" && (
          <div>
             <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>Future Site Ranking</h2>
             {/* Shell placeholder for tab 3 */}
          </div>
        )}
      </main>
    </div>
  );
}
