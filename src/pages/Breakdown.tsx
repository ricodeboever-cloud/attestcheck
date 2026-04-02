import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { OR, S, ORBG, ORPL, ORD, ORL } from '../constants';
import { motion } from 'motion/react';

const Breakdown: React.FC = () => {
  const navigate = useNavigate();
  const { fbData, selectedAttest, setSelectedAttest } = useApp();

  if (!fbData) return null;

  const current = fbData.attests[selectedAttest || fbData.predictedAttest];

  return (
    <div style={{ paddingBottom: 40 }}>
      <button style={S.back} onClick={() => navigate("/results")}>← Terug naar resultaat</button>
      
      <div style={{...S.card, padding:24, marginBottom:20, background:`linear-gradient(135deg, white, ${ORBG})`}}>
        <div style={{textAlign:"center", marginBottom:24}}>
          <div style={{fontSize:48, marginBottom:12}}>{current.emoji}</div>
          <h2 style={{...S.h2, color: current.status === 'behaald' ? "#166534" : (current.status === 'mogelijk' ? "#854D0E" : "#991B1B")}}>
            {current.title}
          </h2>
          <div style={{
            display:"inline-block", padding:"4px 12px", borderRadius:20, fontSize:12, fontWeight:900,
            background: current.status === 'behaald' ? "#DCFCE7" : (current.status === 'mogelijk' ? "#FEF3C7" : "#FEE2E2"),
            color: current.status === 'behaald' ? "#166534" : (current.status === 'mogelijk' ? "#854D0E" : "#991B1B"),
            textTransform:"uppercase", letterSpacing:1
          }}>
            {current.status}
          </div>
        </div>

        <div style={{display:"flex", gap:8, marginBottom:24}}>
          {["A", "B", "C"].map((a: any) => (
            <button 
              key={a}
              onClick={() => setSelectedAttest(a)}
              style={{
                flex:1, padding:"10px 0", borderRadius:12, fontSize:14, fontWeight:900,
                border: `2px solid ${selectedAttest === a ? OR : ORPL}`,
                background: selectedAttest === a ? OR : "white",
                color: selectedAttest === a ? "white" : ORD,
                cursor:"pointer", transition:"all .2s"
              }}
            >Attest {a}</button>
          ))}
        </div>

        <div style={{background:"white", borderRadius:20, padding:20, border:`1px solid ${ORPL}`, marginBottom:24}}>
          <h3 style={{fontSize:14, fontWeight:900, color:ORD, marginBottom:10, textTransform:"uppercase"}}>Analyse:</h3>
          <p style={{fontSize:15, color:"#5D3D1A", lineHeight:1.6, margin:0}}>{current.description}</p>
        </div>

        <div style={{marginBottom:24}}>
          <h3 style={{fontSize:14, fontWeight:900, color:ORD, marginBottom:12, textTransform:"uppercase"}}>Actieplan:</h3>
          <div style={{display:"flex", flexDirection:"column", gap:10}}>
            {current.actionPlan.map((step, i) => (
              <div key={i} style={{display:"flex", gap:12, alignItems:"flex-start"}}>
                <div style={{width:24, height:24, borderRadius:8, background:OR, color:"white", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:900, flexShrink:0}}>{i+1}</div>
                <p style={{fontSize:14, color:"#5D3D1A", margin:0, fontWeight:700}}>{step}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{background:"#F8FAFC", borderRadius:20, padding:20, border:"1px solid #E2E8F0"}}>
          <h3 style={{fontSize:14, fontWeight:900, color:"#475569", marginBottom:8, textTransform:"uppercase"}}>Gevolgen:</h3>
          <p style={{fontSize:14, color:"#64748B", lineHeight:1.6, margin:0}}>{current.consequences}</p>
        </div>
      </div>

      <div style={{...S.card, background:OR, border:"none", padding:24, textAlign:"center"}}>
        <div style={{fontSize:32, marginBottom:12}}>💡</div>
        <p style={{fontSize:18, fontWeight:900, color:"white", lineHeight:1.4, margin:0}}>
          "{fbData.motivation}"
        </p>
      </div>

      <button style={S.btn} onClick={() => navigate("/dashboard")}>
        Terug naar Dashboard 🏠
      </button>
    </div>
  );
};

export default Breakdown;
