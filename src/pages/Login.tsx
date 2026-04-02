import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebase';
import { useApp } from '../context/AppContext';
import { OR, S } from '../constants';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { setFbError } = useApp();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [load, setLoad] = useState(false);
  const [err, setErr] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoad(true); setErr("");
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      navigate("/dashboard");
    } catch (error: any) {
      setErr("Fout bij inloggen: " + (error.message || "Onbekende fout"));
    }
    setLoad(false);
  };

  const handleGoogle = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      navigate("/dashboard");
    } catch (error: any) {
      setErr("Google login mislukt: " + error.message);
    }
  };

  return (
    <div style={{paddingTop:40}}>
      <button style={S.back} onClick={()=>navigate("/")}>← Terug</button>
      <div style={S.card}>
        <h2 style={S.h2}>Welkom terug! 👋</h2>
        <p style={{...S.sub, marginBottom:24}}>Log in om je voortgang te bekijken.</p>
        
        {err && <div style={S.err}>{err}</div>}
        
        <form onSubmit={handleLogin}>
          <label style={S.lbl}>E-mailadres</label>
          <input style={S.input} type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="naam@voorbeeld.be" />
          
          <label style={S.lbl}>Wachtwoord</label>
          <input style={S.input} type="password" value={pass} onChange={e=>setPass(e.target.value)} required placeholder="••••••••" />
          
          <button style={{...S.btn, opacity: load?0.7:1}} disabled={load}>
            {load ? "Bezig met inloggen..." : "Inloggen 🚀"}
          </button>
        </form>

        <div style={{textAlign:"center", margin:"16px 0", color:"#9CA3AF", fontSize:13, fontWeight:700}}>OF</div>

        <button style={S.btnSec} onClick={handleGoogle}>
          <span style={{marginRight:8}}>🌐</span> Log in met Google
        </button>

        <p style={{textAlign:"center", fontSize:13, color:"#8B6242", marginTop:20}}>
          Nog geen account? <span style={{color:OR, fontWeight:800, cursor:"pointer"}} onClick={()=>navigate("/register")}>Registreer hier</span>
        </p>
      </div>
    </div>
  );
};

export default Login;
