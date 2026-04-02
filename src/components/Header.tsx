import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { OR, ORBG, ORPL, ORD, getRankInfo } from '../constants';

const Header: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, logout, setShowFeedback, setShowProfile } = useApp();

  const geenHeader = ["/", "/login", "/register", "/welcome"];
  if (geenHeader.includes(location.pathname) || !currentUser) return null;

  return (
    <div style={{
      width:"100%", maxWidth:460, padding:"16px 16px 0", display:"flex", 
      justifyContent:"space-between", alignItems:"center", gap:12, zIndex:100, position:"relative"
    }}>
      <div style={{display:"flex", gap:8}}>
        <button 
          onClick={() => setShowFeedback(true)}
          style={{
            background:"white", border:`1px solid ${ORPL}`, borderRadius:20, 
            padding:"5px 10px", fontSize:12, fontWeight:700, color:ORD, cursor:"pointer"
          }}
        >💡 Feedback</button>
        <button 
          onClick={() => setShowProfile(true)}
          style={{
            background:ORBG, border:`1px solid ${ORPL}`, borderRadius:20, 
            padding:"5px 12px", fontSize:12, fontWeight:800, color:ORD, cursor:"pointer",
            display: "flex", alignItems: "center", gap: 6
          }}
        >
          <span>👋 {currentUser.naam}</span>
          <span style={{ background: OR, color: "white", padding: "2px 6px", borderRadius: 8, fontSize: 10 }}>
            {getRankInfo(currentUser.xp || 0).name.split(' ')[0]}
          </span>
        </button>
      </div>
      <button onClick={async () => { await logout(); navigate("/"); }} style={{
        background:"none",border:`1.5px solid #E5E7EB`,borderRadius:10,
        color:"#8B6242",fontSize:11,fontWeight:700,cursor:"pointer",padding:"5px 8px",fontFamily:"inherit",
        display:"flex", alignItems:"center", gap:4
      }}>Uitloggen 🚪</button>
    </div>
  );
};

export default Header;
