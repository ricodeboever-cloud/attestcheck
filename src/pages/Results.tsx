import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { OR, S, ORBG, ORPL, ORD, ORL, CONFIG } from '../constants';
import { motion, AnimatePresence } from 'motion/react';

const Results: React.FC = () => {
  const navigate = useNavigate();
  const { 
    score, 
    getAttest, 
    fbData, 
    fbLoad, 
    fbError, 
    vraagFeedback, 
    saveTodayScore, 
    saveSuccess, 
    hasApiKey, 
    checkApiKey 
  } = useApp();

  const [anim, setAnim] = useState(0);

  useEffect(() => {
    if (score !== null) {
      const timer = setTimeout(() => setAnim(score), 500);
      return () => clearTimeout(timer);
    }
  }, [score]);

  if (score === null) return null;

  const attest = getAttest(score);

  const Speedo = ({ val }: { val: number }) => {
    const getSpeedoState = (v: number) => {
      if (v >= CONFIG.attestA_drempel) return { label: "UITSTEKEND", color: "#22C55E", bg: "#F0FDF4" };
      if (v >= CONFIG.attestB_drempel) return { label: "VOLDOENDE", color: "#F59E0B", bg: "#FFFBEB" };
      return { label: "OPGEPAST", color: "#EF4444", bg: "#FEF2F2" };
    };

    const state = getSpeedoState(val);
    const rotation = (val / 100) * 180 - 90;

    const RadarGauge = () => {
      const segments = 50;
      const radius = 85;
      return (
        <svg viewBox="0 0 200 140" style={{ width: "100%", height: "auto" }}>
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#EF4444" />
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#22C55E" />
            </linearGradient>
          </defs>
          {Array.from({ length: segments }).map((_, i) => {
            const angle = (i / (segments - 1)) * Math.PI;
            const x1 = 100 - Math.cos(angle) * (radius - 10);
            const y1 = 120 - Math.sin(angle) * (radius - 10);
            const x2 = 100 - Math.cos(angle) * radius;
            const y2 = 120 - Math.sin(angle) * radius;
            const isActive = (i / segments) * 100 <= val;
            return (
              <line
                key={i}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={isActive ? "url(#gaugeGradient)" : "#E2E8F0"}
                strokeWidth="3"
                strokeLinecap="round"
                style={{ transition: "stroke 0.5s ease" }}
              />
            );
          })}
          <motion.g
            initial={{ rotate: -90 }}
            animate={{ rotate: rotation }}
            transition={{ type: "spring", stiffness: 50, damping: 15 }}
            style={{ originX: "100px", originY: "120px" }}
          >
            <line x1="100" y1="120" x2="100" y2="45" stroke="#1E293B" strokeWidth="4" strokeLinecap="round" />
            <circle cx="100" cy="120" r="8" fill="#1E293B" />
          </motion.g>
          <motion.g>
            <motion.circle cx="100" cy="100" r="50" fill="white" animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }} />
            <text x="100" y="95" textAnchor="middle" style={{ fontSize: 28, fill: state.color, fontWeight: 900 }}>{val}%</text>
            <text x="100" y="115" textAnchor="middle" style={{ fontSize: 8, fill: "#64748B", fontWeight: 800, textTransform: "uppercase" }}>Score</text>
          </motion.g>
        </svg>
      );
    };

    return (
      <div style={{ height: 380, width: "100%", background: "radial-gradient(circle at center, #F8FAFC 0%, #E2E8F0 100%)", borderRadius: 32, marginBottom: 24, position: "relative", overflow: "hidden", border: "1px solid #CBD5E1", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "100%", height: "100%", position: "relative", zIndex: 1 }}><RadarGauge /></div>
        <div style={{ position: "absolute", bottom: 24, left: 0, right: 0, textAlign: "center", pointerEvents: "none" }}>
          <AnimatePresence mode="wait">
            <motion.div key={state.label} initial={{ y: 20, opacity: 0, scale: 0.8 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -20, opacity: 0, scale: 0.8 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} style={{ fontSize: 24, fontWeight: 900, color: state.color, textTransform: "uppercase", letterSpacing: 4 }}>{state.label}</motion.div>
          </AnimatePresence>
        </div>
      </div>
    );
  };

  return (
    <div>
      <button style={S.back} onClick={()=>navigate("/behavior")}>← Terug</button>
      <div style={S.card}>
        <div style={{textAlign:"center",marginBottom:16}}>
          <h2 style={S.h2}>Jouw Resultaat</h2>
        </div>
        
        <Speedo val={anim}/>

        {!fbData && (
          <div style={{textAlign:"center",background:`${attest.kleur}14`,border:`2px solid ${attest.kleur}44`, borderRadius:16,padding:"16px 20px",marginBottom:16}}>
            <div style={{fontSize:22,fontWeight:900,color:attest.kleur,marginBottom:8}}>{attest.emoji} {attest.label}</div>
            <p style={{fontSize:14,color:"#5D3D1A",margin:0,lineHeight:1.6}}>{attest.tekst}</p>
          </div>
        )}
        
        {fbLoad && !fbData && (
          <div style={{textAlign:"center", padding:20, background:ORBG, borderRadius:16, marginBottom:20}}>
            <div style={{fontSize:30, marginBottom:10, animation:"spin 2s linear infinite"}}>⏳</div>
            <p style={{...S.sub, fontWeight:800, color:ORD}}>De AI Coach analyseert je rapport...</p>
          </div>
        )}

        {fbError && (
          <div style={{background:"#FEF2F2", border:"1px solid #FEE2E2", padding:16, borderRadius:16, marginBottom:20, textAlign:"center"}}>
            <p style={{color:"#B91C1C", fontSize:14, fontWeight:700, marginBottom:12}}>{fbError}</p>
            {!hasApiKey && (
              <button style={{...S.btn, background:"#B91C1C"}} onClick={checkApiKey}>API Key Instellen 🔑</button>
            )}
            <button style={S.btnSec} onClick={vraagFeedback}>Opnieuw Proberen 🔄</button>
          </div>
        )}

        {!fbData && !fbLoad && !fbError && (
          <button style={{...S.btn, marginBottom:12}} onClick={vraagFeedback}>
            Vraag AI Feedback & Analyse ✨
          </button>
        )}

        {fbData && (
          <button style={{...S.btn, marginBottom:12}} onClick={()=>navigate("/breakdown")}>
            Bekijk Volledige Analyse 💎
          </button>
        )}

        <button style={{...S.btnSec, opacity:saveSuccess?0.6:1}} onClick={saveTodayScore} disabled={saveSuccess}>
          {saveSuccess ? "Score Opgeslagen ✅" : "Sla Score Op in Dagboek 📔"}
        </button>
      </div>
    </div>
  );
};

export default Results;
