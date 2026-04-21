import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { OR, ORBG, ORPL, ORD, S, getRankInfo } from '../constants';

import SmileyIcon from '../components/SmileyIcon';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { 
    currentUser, 
    school, 
    jaar, 
    richting, 
    setVakken, 
    setGedragAntw, 
    setNederlandsAntw, 
    setScore, 
    setFbData, 
    setReportImage,
    setShowSettings,
    toggleFocusPoint
  } = useApp();

  const xp = currentUser?.xp || 0;
  const rank = getRankInfo(xp);

  const startNieuweAnalyse = () => {
    setVakken([]);
    setGedragAntw({});
    setNederlandsAntw({});
    setScore(null);
    setFbData(null);
    setReportImage(null);
    navigate("/grades");
  };

  return (
    <div style={{paddingTop:10}}>
      {/* XP & Rank Card */}
      <div style={{...S.card, padding: 20, marginBottom: 16, background: `linear-gradient(135deg, white, ${ORBG})`}}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 40 }}>{rank.name.split(' ')[1]}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#8B6242", textTransform: "uppercase", letterSpacing: 0.5 }}>Huidige Rang</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: rank.color }}>{rank.name}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: OR }}>{xp}</div>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#8B6242" }}>XP PUNTEN</div>
          </div>
        </div>
      </div>

      {/* Focus Checklist */}
      {currentUser?.focusPoints && currentUser.focusPoints.length > 0 && (
        <div style={{...S.card, padding: 20, marginBottom: 16}}>
          <h3 style={{...S.h2, fontSize: 18, marginBottom: 12, display: "flex", alignItems: "center", gap: 8}}>
            <span>🎯</span> Focus Checklist
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {currentUser.focusPoints.map((p: any) => (
              <div 
                key={p.id} 
                onClick={() => toggleFocusPoint(p.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                  background: p.completed ? "#F0FDF4" : "#F8FAFC",
                  borderRadius: 16, cursor: "pointer", transition: "all .2s",
                  border: `1px solid ${p.completed ? "#DCFCE7" : "transparent"}`
                }}
              >
                <div style={{
                  width: 24, height: 24, borderRadius: 8, border: `2px solid ${p.completed ? "#22C55E" : ORPL}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: p.completed ? "#22C55E" : "white", color: "white", fontSize: 14
                }}>
                  {p.completed && "✓"}
                </div>
                <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: p.completed ? "#166534" : "#2D1B00", textDecoration: p.completed ? "line-through" : "none" }}>
                  {p.text}
                </div>
                {!p.completed && <div style={{ fontSize: 10, fontWeight: 800, color: OR }}>+{p.xpValue} XP</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{...S.card, textAlign:"center", padding:30}}>
        <div style={{marginBottom:16}}>
          <SmileyIcon size={80} />
        </div>
        <h1 style={S.h2}>Welkom terug, {currentUser?.naam}!</h1>
        <p style={{...S.sub, fontSize:16, marginBottom:24, fontWeight: 700, color: ORD}}>
          Krijg direct inzicht in jouw verwachte attest! 🎓
        </p>
        
        <div style={{background:ORBG, borderRadius:16, padding:18, marginBottom:24, textAlign:"left", border:`1px solid ${ORPL}`}}>
          <p style={{fontWeight:800, color:ORD, marginBottom:10, fontSize:14}}>📝 Jouw Profiel:</p>
          <div style={{display:"grid", gap:8, fontSize:14, color:"#5D3D1A"}}>
            <div>🏫 <strong>School:</strong> {school || "Niet ingesteld"}</div>
            <div>📅 <strong>Jaar:</strong> {jaar || "Niet ingesteld"}</div>
            <div>🚀 <strong>Richting:</strong> {richting || "Niet ingesteld"}</div>
          </div>
        </div>

        <button style={S.btn} onClick={startNieuweAnalyse}>
          Voorspel mijn Attest <SmileyIcon size={20} style={{marginLeft:8}} />
        </button>

        <button style={S.btn} onClick={() => navigate("/progression")}>
          Mijn Progressie 📈
        </button>
        
        <button style={S.btnSec} onClick={()=>setShowSettings(true)}>
          Profiel Aanpassen ⚙️
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
