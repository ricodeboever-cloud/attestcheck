import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { motion } from 'motion/react';
import { OR, S } from '../constants';

const Welcome: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{textAlign:"center",paddingTop:60}}>
      <div style={{fontSize:76,marginBottom:12}}>📊</div>
      <h1 style={{fontSize:38,fontWeight:900,color:OR,margin:"0 0 6px"}}>RapportRadar</h1>
      <p style={{...S.sub,fontSize:16,marginBottom:40,lineHeight:1.7}}>
        Ontdek welk attest je op dit moment zou krijgen! 🎓
      </p>
      <button style={S.btn} onClick={()=>navigate("/register")}>🌟 Nieuw account aanmaken</button>
      <button style={S.btnSec} onClick={()=>navigate("/login")}>Ik heb al een account</button>
    </div>
  );
};

export default Welcome;
