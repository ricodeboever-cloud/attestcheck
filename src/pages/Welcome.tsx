import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { motion } from 'motion/react';
import { OR, S } from '../constants';

import SmileyIcon from '../components/SmileyIcon';

const Welcome: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{textAlign:"center",paddingTop:60}}>
      <div style={{marginBottom:12}}>
        <SmileyIcon size={80} />
      </div>
      <h1 style={{fontSize:38,fontWeight:900,color:OR,margin:"0 0 6px"}}>RapportRadar</h1>
      <p style={{...S.sub,fontSize:18,marginBottom:40,lineHeight:1.6,fontWeight:800}}>
        Krijg direct een voorspelling van jouw attest op basis van je huidige cijfers. 🎓
      </p>
      <button style={S.btn} onClick={()=>navigate("/register")}>🌟 Nieuw account aanmaken</button>
      <button style={S.btnSec} onClick={()=>navigate("/login")}>Ik heb al een account</button>
    </div>
  );
};

export default Welcome;
