import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useApp } from '../context/AppContext';
import { OR, S } from '../constants';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { setCurrentUser } = useApp();
  const [naam, setNaam] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [load, setLoad] = useState(false);
  const [err, setErr] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!naam) return setErr("Vul je naam in.");
    setLoad(true); setErr("");
    try {
      const res = await createUserWithEmailAndPassword(auth, email, pass);
      const user = { uid: res.user.uid, naam, email, xp: 0, rank: "Nieuweling 🐣", focusPoints: [] };
      await setDoc(doc(db, "users", res.user.uid), user);
      setCurrentUser(user);
      navigate("/dashboard");
    } catch (error: any) {
      setErr("Fout bij registreren: " + (error.message || "Onbekende fout"));
    }
    setLoad(false);
  };

  const handleGoogle = async () => {
    try {
      const res = await signInWithPopup(auth, new GoogleAuthProvider());
      const user = { uid: res.user.uid, naam: res.user.displayName || "Gebruiker", email: res.user.email, xp: 0, rank: "Nieuweling 🐣", focusPoints: [] };
      await setDoc(doc(db, "users", res.user.uid), user, { merge: true });
      setCurrentUser(user);
      navigate("/dashboard");
    } catch (error: any) {
      setErr("Google login mislukt: " + error.message);
    }
  };

  return (
    <div style={{paddingTop:40}}>
      <button style={S.back} onClick={()=>navigate("/")}>← Terug</button>
      <div style={S.card}>
        <h2 style={S.h2}>Maak een account aan! 🚀</h2>
        <p style={{...S.sub, marginBottom:24}}>Sla je resultaten op en zie je vooruitgang.</p>
        
        {err && <div style={S.err}>{err}</div>}
        
        <form onSubmit={handleRegister}>
          <label style={S.lbl}>Voornaam</label>
          <input style={S.input} type="text" value={naam} onChange={e=>setNaam(e.target.value)} required placeholder="Jouw naam" />
          
          <label style={S.lbl}>E-mailadres</label>
          <input style={S.input} type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="naam@voorbeeld.be" />
          
          <label style={S.lbl}>Wachtwoord</label>
          <input style={S.input} type="password" value={pass} onChange={e=>setPass(e.target.value)} required placeholder="••••••••" />
          
          <button style={{...S.btn, opacity: load?0.7:1}} disabled={load}>
            {load ? "Bezig met registreren..." : "Account maken ✨"}
          </button>
        </form>

        <div style={{textAlign:"center", margin:"16px 0", color:"#9CA3AF", fontSize:13, fontWeight:700}}>OF</div>

        <button style={S.btnSec} onClick={handleGoogle}>
          <span style={{marginRight:8}}>🌐</span> Registreer met Google
        </button>

        <p style={{textAlign:"center", fontSize:13, color:"#8B6242", marginTop:20}}>
          Al een account? <span style={{color:OR, fontWeight:800, cursor:"pointer"}} onClick={()=>navigate("/login")}>Log hier in</span>
        </p>
      </div>
    </div>
  );
};

export default Register;
