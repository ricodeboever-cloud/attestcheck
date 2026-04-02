import React, { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useApp } from '../context/AppContext';
import { S, OR } from '../constants';

const SettingsModal: React.FC = () => {
  const { 
    currentUser, 
    setCurrentUser, 
    showSettings, 
    setShowSettings, 
    school, setSchool, 
    jaar, setJaar, 
    leeftijd, setLeeftijd, 
    richting, setRichting 
  } = useApp();

  const [ls, setLs] = useState(school);
  const [lj, setLj] = useState(jaar);
  const [ll, setLl] = useState(leeftijd);
  const [lr, setLr] = useState(richting);
  const [saveLoad, setSaveLoad] = useState(false);

  if (!showSettings || !currentUser) return null;

  const handleSave = async () => {
    setSaveLoad(true);
    try {
      const updated = { ...currentUser, school: ls, jaar: lj, leeftijd: ll, richting: lr };
      await setDoc(doc(db, "users", currentUser.uid), updated);
      setCurrentUser(updated);
      setSchool(ls); setJaar(lj); setLeeftijd(ll); setRichting(lr);
      setShowSettings(false);
    } catch (e) {
      console.error(e);
    }
    setSaveLoad(false);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1100,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{...S.card, width:"100%", maxWidth:400, marginBottom:0}}>
        <h2 style={S.h2}>⚙️ Instellingen</h2>
        <p style={{...S.sub, marginBottom:20}}>Pas je profielgegevens aan.</p>
        
        <label style={S.lbl}>School</label>
        <input style={S.input} value={ls} onChange={e=>setLs(e.target.value)} placeholder="Naam van je school" />
        
        <label style={S.lbl}>Leerjaar</label>
        <input style={S.input} value={lj} onChange={e=>setLj(e.target.value)} placeholder="Bv. 4de Middelbaar" />
        
        <label style={S.lbl}>Leeftijd</label>
        <input style={S.input} value={ll} onChange={e=>setLl(e.target.value)} placeholder="Bv. 16" />
        
        <label style={S.lbl}>Richting</label>
        <input style={S.input} value={lr} onChange={e=>setLr(e.target.value)} placeholder="Bv. Economie-Wiskunde" />
        
        <div style={{display:"flex", gap:10}}>
          <button style={{...S.btnSec, flex:1, marginBottom:0}} onClick={()=>setShowSettings(false)}>Annuleren</button>
          <button style={{...S.btn, flex:1, marginBottom:0, opacity:saveLoad?0.7:1}} onClick={handleSave} disabled={saveLoad}>
            {saveLoad ? "Opslaan..." : "Opslaan ✅"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
