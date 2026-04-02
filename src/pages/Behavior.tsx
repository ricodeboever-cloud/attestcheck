import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { OR, S, ORPL, ORD, CONFIG } from '../constants';

const Behavior: React.FC = () => {
  const navigate = useNavigate();
  const { 
    gedragAntw, setGedragAntw, 
    nederlandsAntw, setNederlandsAntw, 
    vakken, 
    setScore 
  } = useApp();

  const handleGedrag = (id: string, val: number) => {
    setGedragAntw({ ...gedragAntw, [id]: val });
  };

  const handleNed = (id: string, val: string) => {
    setNederlandsAntw({ ...nederlandsAntw, [id]: val });
  };

  const berekenScore = () => {
    const ingevuld = vakken.filter(v => v.punt !== "" && !isNaN(parseFloat(v.punt)));
    if (!ingevuld.length) return 0;
    
    let gew = 0, totGew = 0;
    ingevuld.forEach(v => {
      const p = (parseFloat(v.punt) / (parseFloat(v.maxPunt) || 100)) * 100;
      const w = v.isHoofdvak ? CONFIG.hoofdvakMultiplier : 1;
      gew += p * w;
      totGew += w;
    });
    const ps = totGew ? gew / totGew : 0;
    
    let gt = 0, ga = 0;
    CONFIG.gedragsVragen.forEach(v => {
      if (gedragAntw[v.id] !== undefined) {
        gt += (gedragAntw[v.id] / 5) * 100;
        ga++;
      }
    });
    const gs = ga ? gt / ga : 0;
    
    let ns = 0;
    if (nederlandsAntw.begrijpen === "Moeilijk") ns -= 3;
    if (nederlandsAntw.begrijpen === "Altijd")   ns += 3;
    
    const es = (ps * CONFIG.puntenGewicht) + (gs * CONFIG.gedragGewicht) + ns;
    return Math.max(0, Math.min(100, Math.round(es * 10) / 10));
  };

  const handleNext = () => {
    const finalScore = berekenScore();
    setScore(finalScore);
    navigate("/results");
  };

  return (
    <div>
      <button style={S.back} onClick={()=>navigate("/important-subjects")}>← Terug</button>
      <div style={S.card}>
        <h2 style={S.h2}>Stap 3: Gedrag & Taal 😊</h2>
        <p style={{...S.sub, marginBottom:24}}>Dit telt ook mee voor je attest!</p>
        
        <div style={{marginBottom:32}}>
          <h3 style={{...S.h2, fontSize:16, marginBottom:16}}>Houding in de klas</h3>
          {CONFIG.gedragsVragen.map(v => (
            <div key={v.id} style={{marginBottom:20}}>
              <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:8}}>
                <span style={{fontSize:18}}>{v.icon}</span>
                <span style={{fontSize:13, fontWeight:700, color:ORD}}>{v.vraag}</span>
              </div>
              <div style={{display:"flex", gap:6}}>
                {[1,2,3,4,5].map(n => (
                  <button 
                    key={n} 
                    onClick={()=>handleGedrag(v.id, n)}
                    style={{
                      flex:1, height:40, borderRadius:12, border:`2px solid ${gedragAntw[v.id] === n ? OR : ORPL}`,
                      background: gedragAntw[v.id] === n ? OR : "white",
                      color: gedragAntw[v.id] === n ? "white" : ORD,
                      fontSize:14, fontWeight:800, cursor:"pointer", transition:"all .2s"
                    }}
                  >{n}</button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{marginBottom:32}}>
          <h3 style={{...S.h2, fontSize:16, marginBottom:16}}>Nederlands Niveau</h3>
          {CONFIG.nederlandsVragen.map(v => (
            <div key={v.id} style={{marginBottom:20}}>
              <div style={{fontSize:13, fontWeight:700, color:ORD, marginBottom:8}}>{v.vraag}</div>
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8}}>
                {v.opties.map(opt => (
                  <button 
                    key={opt} 
                    onClick={()=>handleNed(v.id, opt)}
                    style={{
                      padding:"10px 8px", borderRadius:12, border:`2px solid ${nederlandsAntw[v.id] === opt ? OR : ORPL}`,
                      background: nederlandsAntw[v.id] === opt ? OR : "white",
                      color: nederlandsAntw[v.id] === opt ? "white" : ORD,
                      fontSize:12, fontWeight:700, cursor:"pointer", transition:"all .2s"
                    }}
                  >{opt}</button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button style={S.btn} onClick={handleNext}>
          Bereken Resultaat 🎯
        </button>
      </div>
    </div>
  );
};

export default Behavior;
