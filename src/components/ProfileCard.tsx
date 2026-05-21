import React from 'react';
import { motion } from 'motion/react';
import { useApp } from '../context/AppContext';
import { ORBG, ORPL, S } from '../constants';

const ProfileCard: React.FC = () => {
  const { currentUser, showProfile, setShowProfile } = useApp();
  
  if (!currentUser || !showProfile) return null;
  
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

        <div style={{ fontSize: 64, marginBottom: 12 }}>👤</div>
        <h2 style={S.h2}>{currentUser.naam}</h2>
        {currentUser.email && (
          <p style={{...S.sub, fontSize: 13, marginBottom: 20, color: "#8B6242" }}>{currentUser.email}</p>
        )}

        <div style={{ background: ORBG, borderRadius: 20, padding: 20, textAlign: "left" }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: "#2D1B00", marginBottom: 12 }}>School & Profiel Details</h3>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {currentUser.school && (
              <div style={{ borderBottom: `1px solid ${ORPL}`, paddingBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#8B6242", display: "block" }}>SCHOOL</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#2D1B00" }}>{currentUser.school}</span>
              </div>
            )}
            {currentUser.richting && (
              <div style={{ borderBottom: `1px solid ${ORPL}`, paddingBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#8B6242", display: "block" }}>STUDIERICHTING</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#2D1B00" }}>{currentUser.richting}</span>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {currentUser.jaar && (
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#8B6242", display: "block" }}>JAAR / GRAAD</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#2D1B00" }}>{currentUser.jaar}</span>
                </div>
              )}
              {currentUser.leeftijd && (
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#8B6242", display: "block" }}>LEEFTIJD</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#2D1B00" }}>{currentUser.leeftijd} jaar</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ProfileCard;
