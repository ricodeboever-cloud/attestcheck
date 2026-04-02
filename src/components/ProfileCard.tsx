import React from 'react';
import { motion } from 'motion/react';
import { useApp } from '../context/AppContext';
import { OR, ORL, ORBG, ORPL, S, RANKS, getRankInfo } from '../constants';

const ProfileCard: React.FC = () => {
  const { currentUser, showProfile, setShowProfile, progression } = useApp();
  
  if (!currentUser || !showProfile) return null;
  
  const xp = currentUser.xp || 0;
  const rank = getRankInfo(xp);
  const nextRank = RANKS.find(r => r.min > xp);
  const progress = nextRank ? ((xp - rank.min) / (nextRank.min - rank.min)) * 100 : 100;

  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:1200,
      display:"flex", alignItems:"center", justifyContent:"center", padding:20,
      backdropFilter:"blur(6px)"
    }} onClick={() => setShowProfile(false)}>
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        style={{...S.card, width:"100%", maxWidth:400, position:"relative", textAlign: "center", marginBottom: 0}}
        onClick={e => e.stopPropagation()}
      >
        <button 
          style={{position:"absolute", top:16, right:16, background:"none", border:"none", fontSize:24, cursor:"pointer", color:"#8B6242"}}
          onClick={() => setShowProfile(false)}
        >✕</button>

        <div style={{ fontSize: 64, marginBottom: 16 }}>{rank.name.split(' ')[1]}</div>
        <h2 style={S.h2}>{currentUser.naam}</h2>
        <p style={{...S.sub, fontWeight: 800, color: rank.color, fontSize: 16, marginBottom: 20 }}>
          {rank.name}
        </p>

        <div style={{ background: ORBG, borderRadius: 20, padding: 20, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14, fontWeight: 800 }}>
            <span>XP Voortgang</span>
            <span>{xp} XP</span>
          </div>
          <div style={{ width: "100%", height: 12, background: ORPL, borderRadius: 10, overflow: "hidden" }}>
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              style={{ height: "100%", background: `linear-gradient(90deg, ${OR}, ${ORL})` }}
            />
          </div>
          {nextRank && (
            <p style={{ fontSize: 11, color: "#8B6242", marginTop: 8, fontWeight: 700 }}>
              Nog {nextRank.min - xp} XP tot {nextRank.name}
            </p>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ background: "#F8FAFC", padding: 12, borderRadius: 16 }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>📈</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B" }}>Metingen</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#1E293B" }}>{progression.length}</div>
          </div>
          <div style={{ background: "#F8FAFC", padding: 12, borderRadius: 16 }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>🎯</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B" }}>Focus Doelen</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#1E293B" }}>
              {currentUser.focusPoints?.filter((p: any) => p.completed).length || 0}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ProfileCard;
