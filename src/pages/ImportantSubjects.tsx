import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { OR, S, ORPL, ORD, ORL } from '../constants';

const ImportantSubjects: React.FC = () => {
  const navigate = useNavigate();
  const { vakken, setVakken } = useApp();

  const toggleHoofdvak = (id: string) => {
    setVakken(vakken.map(v => v.id === id ? { ...v, isHoofdvak: !v.isHoofdvak } : v));
  };

  return (
    <div>
      <button style={S.back} onClick={()=>navigate("/grades")}>← Terug</button>
      <div style={S.card}>
        <h2 style={S.h2}>Stap 2: Hoofdvakken ⭐</h2>
        <p style={{...S.sub, marginBottom:20}}>Selecteer de vakken die het zwaarst doorwegen in je richting.</p>
        
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:24}}>
          {vakken.map(v => (
            <button 
              key={v.id} 
              onClick={()=>toggleHoofdvak(v.id)}
              style={{
                background: v.isHoofdvak ? `linear-gradient(135deg, ${OR}, ${ORL})` : "white",
                color: v.isHoofdvak ? "white" : ORD,
                border: `2px solid ${v.isHoofdvak ? OR : ORPL}`,
                borderRadius: 16, padding: "14px 10px", fontSize: 13, fontWeight: 800,
                cursor: "pointer", transition: "all .2s", textAlign: "center",
                boxShadow: v.isHoofdvak ? `0 6px 16px ${OR}44` : "0 2px 8px rgba(0,0,0,0.05)"
              }}
            >
              <div style={{fontSize:18, marginBottom:4}}>{v.isHoofdvak ? "⭐" : "📖"}</div>
              {v.naam || "Naamloos vak"}
            </button>
          ))}
        </div>

        <button style={S.btn} onClick={()=>navigate("/behavior")}>
          Volgende Stap ➡️
        </button>
      </div>
    </div>
  );
};

export default ImportantSubjects;
