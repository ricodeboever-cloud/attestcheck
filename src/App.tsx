import * as React from "react";
import { useState, useEffect, useRef, ErrorInfo, ReactNode } from "react";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";
import { 
  doc, 
  setDoc, 
  getDoc, 
  getDocFromServer 
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { GoogleGenAI, Type } from "@google/genai";
import Markdown from "react-markdown";

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 🔧 ERROR HANDLING
// ═══════════════════════════════════════════════════════════════════════

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    (this as any).state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    const { hasError, errorMessage } = (this as any).state;
    if (hasError) {
      return (
        <div style={{ padding: "20px", textAlign: "center", background: "#FEE2E2", color: "#DC2626", borderRadius: "12px", margin: "20px" }}>
          <h2 style={{ fontWeight: 800 }}>Oeps! Er is iets misgegaan.</h2>
          <p style={{ fontSize: "14px", marginTop: "10px" }}>{errorMessage}</p>
          <button 
            style={{ marginTop: "15px", padding: "10px 20px", background: "#DC2626", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}
            onClick={() => window.location.reload()}
          >
            Pagina herladen
          </button>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 🔧 ADMIN CONFIGURATIE — Pas hier de gewichten en vragen aan!
// ═══════════════════════════════════════════════════════════════════════
const CONFIG = {
  hoofdvakMultiplier: 2,
  gedragGewicht: 0.20,
  puntenGewicht: 0.80,
  attestA_drempel: 70,
  attestB_drempel: 50,
  gedragsVragen: [
    { id: 1, vraag: "Hoe vaak kom ik op tijd naar school?",      emoji: "⏰" },
    { id: 2, vraag: "Hoe goed maak ik mijn huiswerk?",           emoji: "📚" },
    { id: 3, vraag: "Hoe goed gedraag ik mij in de klas?",       emoji: "😊" },
    { id: 4, vraag: "Hoe goed werk ik samen met anderen?",       emoji: "🤝" },
    { id: 5, vraag: "Hoe regelmatig ben ik aanwezig op school?", emoji: "🏫" },
    { id: 6, vraag: "Hoe goed luister ik naar de leerkracht?",   emoji: "👂" },
  ],
  antwoordOpties: [
    { waarde: 1, label: "Nooit",        emoji: "😞" },
    { waarde: 2, label: "Soms",         emoji: "😐" },
    { waarde: 3, label: "Vaak",         emoji: "🙂" },
    { waarde: 4, label: "Bijna altijd", emoji: "😄" },
    { waarde: 5, label: "Altijd",       emoji: "🌟" },
  ],
};

// ── Kleuren ────────────────────────────────────────────────
const OR   = "#F47920";
const ORL  = "#FF9F45";
const ORD  = "#C85E10";
const ORBG = "#FFF5EC";
const ORPL = "#FFE4C4";

function AttestatieApp() {
  const [screen,        setScreen]       = useState("loading");
  const [currentUser,   setCurrentUser]  = useState<any>(null);
  const [school,        setSchool]       = useState("");
  const [jaar,          setJaar]         = useState("");
  const [leeftijd,      setLeeftijd]     = useState("");
  const [richting,      setRichting]     = useState("");
  const [vakken,        setVakken]       = useState<any[]>([]);
  const [gedragAntw,    setGedragAntw]   = useState<any>({});
  const [score,         setScore]        = useState<number | null>(null);
  const [fbData,        setFbData]       = useState<FeedbackData | null>(null);
  const [fbLoad,        setFbLoad]       = useState(false);
  const [fbError,       setFbError]      = useState("");
  const [reportImage,   setReportImage]  = useState<string | null>(null);
  const [hasApiKey,     setHasApiKey]    = useState(true);

  interface FeedbackData {
    scoreAnalysis: {
      title: string;
      impact: "positive" | "negative" | "neutral";
      description: string;
      emoji: string;
    }[];
    actionPoints: {
      title: string;
      description: string;
      priority: "high" | "medium" | "low";
      category: "punten" | "gedrag" | "algemeen";
    }[];
    betterStudentTips: {
      title: string;
      tip: string;
      emoji: string;
    }[];
    motivation: string;
  }

  const cleanJSON = (text: string) => {
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(json)?/, "").replace(/```$/, "").trim();
    }
    return cleaned;
  };

  const getApiKey = () => process.env.API_KEY || process.env.GEMINI_API_KEY;

  const checkApiKey = async () => {
    if (window.aistudio) {
      const selected = await window.aistudio.hasSelectedApiKey();
      setHasApiKey(selected || !!process.env.GEMINI_API_KEY);
    } else {
      setHasApiKey(!!process.env.GEMINI_API_KEY);
    }
  };

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const vraagFeedback = async () => {
    if (score === null) return;
    setFbLoad(true);
    setFbError("");
    try {
      const ingevuld = vakken.filter(v=>v.punt!==""&&!isNaN(parseFloat(v.punt)));
      const vakInfo = ingevuld.map(v=>{
        const p=Math.round((parseFloat(v.punt)/parseFloat(v.maxPunt))*100);
        return `${v.naam}${v.isHoofdvak?" (HOOFDVAK ⭐)":""}: ${v.punt}/${v.maxPunt} (${p}%)`;
      }).join(", ");
      const gedragInfo = CONFIG.gedragsVragen.map(v=>
        gedragAntw[v.id]?`${v.vraag}: ${gedragAntw[v.id]}/5`:""
      ).filter(Boolean).join("; ");

      const attest = getAttest(score);
      const apiKey = getApiKey();
      if (!apiKey) {
        setHasApiKey(false);
        throw new Error("Gemini API key is niet geconfigureerd.");
      }

      const ai = new GoogleGenAI({ apiKey });

      const prompt = `Je bent een deskundige Belgische schoolcoach.
Analyseer de resultaten van ${currentUser?.naam||"de student"} (${jaar}).
Eindscore: ${score}% → Attest: ${attest.label}

Context:
- Punten tellen voor 70%, gedrag voor 30%.
- Hoofdvakken (⭐) tellen 3x zwaarder.
- Vakken: ${vakInfo}
- Gedrag: ${gedragInfo}

Geef uitvoerige maar hapklare feedback in JSON formaat.
1. scoreAnalysis: Waarom is de score ${score}%? Geef 3-4 punten (positief/negatief).
2. actionPoints: 3 concrete acties om te verbeteren. Prioriteer hoofdvakken.
3. betterStudentTips: 3 tips om het "nog beter te doen" (focus op attitude en studiehouding).
4. motivation: Een korte krachtige uitsmijter.`;

      const contents: any[] = [{ text: prompt }];
      if (reportImage) {
        contents.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: reportImage
          }
        });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts: contents },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              scoreAnalysis: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    impact: { type: Type.STRING, enum: ["positive", "negative", "neutral"] },
                    description: { type: Type.STRING },
                    emoji: { type: Type.STRING }
                  },
                  required: ["title", "impact", "description", "emoji"]
                }
              },
              actionPoints: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    priority: { type: Type.STRING, enum: ["high", "medium", "low"] },
                    category: { type: Type.STRING, enum: ["punten", "gedrag", "algemeen"] }
                  },
                  required: ["title", "description", "priority", "category"]
                }
              },
              betterStudentTips: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    tip: { type: Type.STRING },
                    emoji: { type: Type.STRING }
                  },
                  required: ["title", "tip", "emoji"]
                }
              },
              motivation: { type: Type.STRING }
            },
            required: ["scoreAnalysis", "actionPoints", "betterStudentTips", "motivation"]
          }
        }
      });
      
      const text = response.text;
      if (!text) throw new Error("Geen tekst ontvangen van de coach.");
      
      const data = JSON.parse(cleanJSON(text)) as FeedbackData;
      if (!data.scoreAnalysis || !data.actionPoints) throw new Error("Ongeldige data ontvangen.");
      
      setFbData(data);
    } catch (error: any) {
      console.error("AI Feedback Error:", error);
      let msg = "Oeps! De coach kon je rapport even niet lezen. Probeer het nog eens! 🔄";
      if (error?.message?.includes("API key")) msg = "De coach heeft geen toegang tot de AI. Klik op de knop hieronder om dit op te lossen.";
      setFbError(msg);
    }
    setFbLoad(false);
  };

  // ── Font laden + Firebase auth listener ────────────────────
  useEffect(() => {
    checkApiKey();
    if (!document.getElementById("nunito-link")) {
      const lnk = document.createElement("link");
      lnk.id   = "nunito-link";
      lnk.rel  = "stylesheet";
      lnk.href = "https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap";
      document.head.appendChild(lnk);
    }

    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();

    // Luister naar login/logout events van Firebase
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const snap = await getDoc(doc(db, "users", fbUser.uid));
          if (snap.exists()) {
            const data = snap.data();
            setCurrentUser({ uid: fbUser.uid, ...data });
            if (data.school)   setSchool(data.school);
            if (data.jaar)     setJaar(data.jaar);
            if (data.leeftijd) setLeeftijd(data.leeftijd);
            if (data.richting) setRichting(data.richting);
            if (data.vakken)   setVakken(data.vakken);
            if (data.gedragAntw) setGedragAntw(data.gedragAntw);
            if (data.score !== undefined) setScore(data.score);
          } else {
            setCurrentUser({ uid: fbUser.uid, naam: fbUser.email?.split('@')[0] || "Gebruiker", email: fbUser.email });
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${fbUser.uid}`);
        }
        setScreen("school_info");
      } else {
        setCurrentUser(null);
        setScreen("welcome");
      }
    });
    return () => unsub();
  }, []);

  // ── Score berekening ───────────────────────────────────────
  const berekenScore = (vakkenData: any[], antwoorden: any) => {
    const ingevuld = vakkenData.filter(v => v.punt !== "" && !isNaN(parseFloat(v.punt)));
    if (!ingevuld.length) return 0;
    let gew = 0, totGew = 0;
    ingevuld.forEach(v => {
      const pct = (parseFloat(v.punt) / (parseFloat(v.maxPunt) || 100)) * 100;
      const w   = v.isHoofdvak ? CONFIG.hoofdvakMultiplier : 1;
      gew    += pct * w;
      totGew += w;
    });
    const puntScore = totGew ? gew / totGew : 0;
    let gtot = 0, gaan = 0;
    CONFIG.gedragsVragen.forEach(v => {
      if (antwoorden[v.id] !== undefined) { gtot += (antwoorden[v.id] / 5) * 100; gaan++; }
    });
    const gedragScore = gaan ? gtot / gaan : 60;
    return Math.round((puntScore * CONFIG.puntenGewicht + gedragScore * CONFIG.gedragGewicht) * 10) / 10;
  };

  const getAttest = (s: number) => {
    if (s >= CONFIG.attestA_drempel) return { label:"Attest A", kleur:"#22C55E", emoji:"🏆", tekst:"Gefeliciteerd! 🎉 Je mag door naar het volgende jaar!" };
    if (s >= CONFIG.attestB_drempel) return { label:"Attest B", kleur:"#F59E0B", emoji:"📋", tekst:"Je mag overgaan, maar met bepaalde beperkingen of voorwaarden." };
    return { label:"Attest C", kleur:"#EF4444", emoji:"📌", tekst:"Je slaagt momenteel niet. Je zal dit jaar moeten overdoen of van richting veranderen." };
  };

  const S: any = {
    page: {
      fontFamily: "'Nunito','Arial Rounded MT Bold',sans-serif",
      minHeight:"100vh",
      background:`linear-gradient(150deg,${ORBG} 0%,#FFFBF5 50%,${ORPL} 100%)`,
      display:"flex", flexDirection:"column", alignItems:"center",
      padding:0, position:"relative", overflow:"hidden",
    },
    wrap: { width:"100%", maxWidth:460, padding:"16px 16px 48px", position:"relative", zIndex: 1 },
    card: { background:"white", borderRadius:24, padding:"24px 22px", boxShadow:`0 8px 32px rgba(244,121,32,.15)`, marginBottom:16 },
    btn: {
      width:"100%", padding:"16px", background:`linear-gradient(135deg,${OR},${ORL})`,
      color:"white", border:"none", borderRadius:16, fontSize:17, fontWeight:800,
      fontFamily:"inherit", cursor:"pointer", boxShadow:`0 6px 20px ${OR}44`,
      marginBottom:12, display:"block", textAlign:"center", letterSpacing:".4px", transition:"transform .1s",
    },
    btnSec: {
      width:"100%", padding:"14px", background:"transparent", color:OR,
      border:`2px solid ${OR}`, borderRadius:16, fontSize:15, fontWeight:700,
      fontFamily:"inherit", cursor:"pointer", marginBottom:12, display:"block", textAlign:"center",
    },
    input: {
      width:"100%", padding:"13px 15px", border:`2px solid ${ORPL}`,
      borderRadius:12, fontSize:15, fontFamily:"inherit", outline:"none",
      marginBottom:12, boxSizing:"border-box", color:"#2D1B00", background:"white", transition:"border-color .2s",
    },
    lbl:  { fontSize:13, fontWeight:700, color:ORD, marginBottom:5, display:"block" },
    h2:   { fontSize:21, fontWeight:800, color:"#2D1B00", margin:"0 0 6px" },
    sub:  { fontSize:13, color:"#8B6242", lineHeight:1.5 },
    err:  { background:"#FEE2E2", color:"#DC2626", padding:"10px 14px", borderRadius:10, fontSize:13, fontWeight:600, marginBottom:12 },
    ok:   { background:"#DCFCE7", color:"#15803D", padding:"10px 14px", borderRadius:10, fontSize:13, fontWeight:600, marginBottom:12 },
    back: { background:"none", border:"none", fontSize:22, cursor:"pointer", marginBottom:10, color:ORD, fontFamily:"inherit", fontWeight:700, padding:0 },
  };

  const Blobs = () => (
    <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0}}>
      <div style={{position:"absolute",top:-100,right:-100,width:320,height:320,borderRadius:"50%",background:`radial-gradient(circle,${OR}28,transparent 70%)`}}/>
      <div style={{position:"absolute",bottom:-80,left:-80,width:260,height:260,borderRadius:"50%",background:`radial-gradient(circle,${ORL}22,transparent 70%)`}}/>
      <div style={{position:"absolute",top:"35%",right:-50,width:180,height:180,borderRadius:"50%",background:`radial-gradient(circle,${ORPL},transparent 70%)`}}/>
    </div>
  );

  const stappen = ["🏫","⭐","📊","😊","🎯"];
  const stpIdx: any  = { school_info:0, important_subjects:1, grades:2, behavior:3, results:4 };
  const StapBar = ({ huidig }: { huidig: string }) => {
    const idx = stpIdx[huidig] ?? -1;
    if (idx < 0) return null;
    return (
      <div style={{display:"flex",justifyContent:"center",gap:6,marginBottom:18}}>
        {stappen.map((em,i) => (
          <div key={i} style={{
            width:34,height:34,borderRadius:"50%",
            background: i <= idx ? OR : "#E5E7EB",
            color: i <= idx ? "white" : "#9CA3AF",
            fontSize: i <= idx ? 16 : 13,
            fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow: i === idx ? `0 4px 14px ${OR}44` : "none",
            transition:"all .3s",
          }}>
            {i < idx ? "✓" : em}
          </div>
        ))}
      </div>
    );
  };

  // ── LAADSCHERM ─────────────────────────────────────────────
  const LoadingScreen = () => (
    <div style={{textAlign:"center",paddingTop:80}}>
      <div style={{fontSize:60,marginBottom:16}}>📊</div>
      <p style={{color:OR,fontWeight:800,fontSize:18}}>Laden...</p>
    </div>
  );

  // ── 1. WELKOMSTSCHERM ──────────────────────────────────────
  const WelcomeScreen = () => (
    <div style={{textAlign:"center",paddingTop:60}}>
      <div style={{fontSize:76,marginBottom:12}}>📊</div>
      <h1 style={{fontSize:38,fontWeight:900,color:OR,margin:"0 0 6px"}}>AttestatieCheck</h1>
      <p style={{...S.sub,fontSize:16,marginBottom:40,lineHeight:1.7}}>
        Ontdek welk attest je op dit moment zou krijgen! 🎓
      </p>
      <button style={S.btn} onClick={()=>setScreen("register")}>🌟 Nieuw account aanmaken</button>
      <button style={S.btnSec} onClick={()=>setScreen("login")}>Ik heb al een account</button>
    </div>
  );

  // ── 2. REGISTREREN ─────────────────────────────────────────
  const RegisterScreen = () => {
    const [naam,    setNaam]    = useState("");
    const [email,   setEmail]   = useState("");
    const [ww,      setWw]      = useState("");
    const [consent, setConsent] = useState(false);
    const [discl,   setDiscl]   = useState(false);
    const [fout,    setFout]    = useState("");
    const [bezig,   setBezig]   = useState(false);

    const registreer = async () => {
      if (!naam || !email || !ww) { setFout("Vul alle velden in 😊"); return; }
      if (!consent) { setFout("Geef toestemming om gegevens op te slaan"); return; }
      if (!discl)   { setFout("Bevestig dat je begrijpt dat dit een indicatie is"); return; }
      if (ww.length < 6) { setFout("Wachtwoord moet minstens 6 tekens zijn"); return; }
      setBezig(true);
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, ww);
        const userPath = `users/${cred.user.uid}`;
        try {
          await setDoc(doc(db, "users", cred.user.uid), { naam, email });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, userPath);
        }
      } catch (e: any) {
        setBezig(false);
        if (e.code === "auth/email-already-in-use") setFout("Dit e-mailadres is al in gebruik!");
        else if (e.code === "auth/invalid-email")   setFout("Ongeldig e-mailadres");
        else setFout("Er ging iets mis: " + e.message);
      }
    };

    return (
      <div>
        <button style={S.back} onClick={()=>setScreen("welcome")}>← Terug</button>
        <div style={S.card}>
          <div style={{textAlign:"center",marginBottom:18}}>
            <div style={{fontSize:52}}>👋</div>
            <h2 style={S.h2}>Account aanmaken</h2>
            <p style={S.sub}>Maak een account om je voortgang bij te houden</p>
          </div>
          {fout && <div style={S.err}>{fout}</div>}
          <label style={S.lbl}>Voornaam</label>
          <input style={S.input} value={naam} onChange={e=>setNaam(e.target.value)} placeholder="Jouw voornaam"/>
          <label style={S.lbl}>E-mailadres</label>
          <input style={S.input} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="naam@voorbeeld.be"/>
          <label style={S.lbl}>Wachtwoord (min. 6 tekens)</label>
          <input style={S.input} type="password" value={ww} onChange={e=>setWw(e.target.value)} placeholder="Kies een wachtwoord"/>
          <div style={{background:ORBG,borderRadius:12,padding:"12px 14px",marginBottom:12}}>
            <label style={{display:"flex",alignItems:"flex-start",gap:10,cursor:"pointer"}}>
              <input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}
                style={{marginTop:3,accentColor:OR,width:18,height:18,flexShrink:0}}/>
              <span style={{fontSize:13,color:"#5D3D1A",lineHeight:1.6}}>
                🔒 Ik ga akkoord dat mijn gegevens worden opgeslagen zodat ik later kan inloggen.
              </span>
            </label>
          </div>
          <div style={{background:"#FEF9C3",border:"1px solid #FDE047",borderRadius:12,padding:"12px 14px",marginBottom:20}}>
            <label style={{display:"flex",alignItems:"flex-start",gap:10,cursor:"pointer"}}>
              <input type="checkbox" checked={discl} onChange={e=>setDiscl(e.target.checked)}
                style={{marginTop:3,accentColor:OR,width:18,height:18,flexShrink:0}}/>
              <span style={{fontSize:13,color:"#713F12",lineHeight:1.6}}>
                ⚠️ Ik begrijp dat de resultaten van deze app <strong>slechts een indicatie</strong> zijn en geen officieel attest vervangen.
              </span>
            </label>
          </div>
          <button style={{...S.btn, opacity: bezig ? 0.7 : 1}} onClick={registreer} disabled={bezig}>
            {bezig ? "⏳ Account aanmaken..." : "🚀 Account aanmaken"}
          </button>
          <button style={S.btnSec} onClick={()=>setScreen("login")}>Ik heb al een account</button>
        </div>
      </div>
    );
  };

  // ── 3. INLOGGEN ────────────────────────────────────────────
  const LoginScreen = () => {
    const [email, setEmail] = useState("");
    const [ww,    setWw]    = useState("");
    const [fout,  setFout]  = useState("");
    const [bezig, setBezig] = useState(false);

    const login = async () => {
      if (!email || !ww) { setFout("Vul e-mail en wachtwoord in"); return; }
      setBezig(true);
      try {
        await signInWithEmailAndPassword(auth, email, ww);
      } catch (e) {
        setBezig(false);
        setFout("E-mail of wachtwoord klopt niet 🔑");
      }
    };

    return (
      <div>
        <button style={S.back} onClick={()=>setScreen("welcome")}>← Terug</button>
        <div style={S.card}>
          <div style={{textAlign:"center",marginBottom:18}}>
            <div style={{fontSize:52}}>🔑</div>
            <h2 style={S.h2}>Welkom terug!</h2>
            <p style={S.sub}>Log in om verder te gaan</p>
          </div>
          {fout && <div style={S.err}>{fout}</div>}
          <label style={S.lbl}>E-mailadres</label>
          <input style={S.input} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="naam@voorbeeld.be"/>
          <label style={S.lbl}>Wachtwoord</label>
          <input style={S.input} type="password" value={ww} onChange={e=>setWw(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&login()} placeholder="Jouw wachtwoord"/>
          <button style={{...S.btn, opacity: bezig ? 0.7 : 1}} onClick={login} disabled={bezig}>
            {bezig ? "⏳ Inloggen..." : "🚀 Inloggen"}
          </button>
          <button style={S.btnSec} onClick={()=>setScreen("register")}>Nieuw account aanmaken</button>
        </div>
      </div>
    );
  };

  // ── 4. SCHOOLGEGEVENS ──────────────────────────────────────
  const SchoolInfoScreen = () => {
    const [ls,  setLs]  = useState(school);
    const [lj,  setLj]  = useState(jaar);
    const [ll,  setLl]  = useState(leeftijd);
    const [lr,  setLr]  = useState(richting);
    const [lv,  setLv]  = useState(vakken.length ? [...vakken] : []);
    const [nv,  setNv]  = useState("");
    const [fout,setFout]= useState("");
    const [bezig,setBezig] = useState(false);
    const [ocrMsg,  setOcrMsg]  = useState("");
    const [ocrFout, setOcrFout] = useState("");
    const [ocrLoading, setOcrLoading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const voegToe = () => {
      if (!nv.trim()) return;
      setLv([...lv,{id:Date.now(),naam:nv.trim(),isHoofdvak:false,punt:"",maxPunt:"20"}]);
      setNv("");
    };
    const verwijder = (id: number) => setLv(lv.filter(v=>v.id!==id));

    const handleOCR = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setOcrLoading(true); setOcrMsg(""); setOcrFout("");
      try {
        const reader = new FileReader();
        reader.onload = async (ev) => {
          const b64 = (ev.target?.result as string).split(",")[1];
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          
          try {
            const response = await ai.models.generateContent({
              model: "gemini-3.1-pro-preview",
              contents: [
                {
                  parts: [
                    { inlineData: { mimeType: file.type, data: b64 } },
                    {
                      text: `Analyseer deze afbeelding van een schoolrapport of puntenlijst. 
Zoek naar een tabel of lijst met vaknamen en bijbehorende scores.
Voor elk vak:
1. Extraheer de volledige naam van het vak.
2. Zoek de meest recente score (vaak de laatste kolom of de meest rechtse ingevulde waarde).
3. Splits de score in het behaalde punt en het maximum (bv. "14/20" -> punt: 14, max: 20).
4. Als er geen maximum staat, ga uit van 20 of zoek naar een kolomkop die het maximum aangeeft.
5. Gebruik een punt (.) als decimaalteken voor getallen (bv. 7,5 wordt 7.5).

Geef het resultaat terug als een JSON array van objecten:
[{"naam": "Wiskunde", "punt": "15.5", "maxPunt": "20"}]

Belangrijk:
- Negeer titels, datums of andere tekst die geen vaknaam is.
- Als een vak geen punt heeft, laat "punt" leeg ("").
- Geef ENKEL de JSON array terug, geen extra tekst of uitleg.`
                    }
                  ]
                }
              ],
              config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      naam: { type: Type.STRING },
                      punt: { type: Type.STRING },
                      maxPunt: { type: Type.STRING }
                    },
                    required: ["naam", "punt", "maxPunt"]
                  }
                }
              }
            });

            const text = response.text || "[]";
            const extracted = JSON.parse(text.substring(text.indexOf("["), text.lastIndexOf("]") + 1) || "[]");
            setLv(prevLv => {
              const updated = prevLv.map(v => {
                const match = extracted.find((e: any) =>
                  e.naam.toLowerCase().includes(v.naam.toLowerCase()) ||
                  v.naam.toLowerCase().includes(e.naam.toLowerCase())
                );
                return match ? { ...v, punt: match.punt || "", maxPunt: match.maxPunt || "20" } : v;
              });
              const nieuw = extracted
                .filter((e: any) => !prevLv.some(v => v.naam.toLowerCase().includes(e.naam.toLowerCase()) || e.naam.toLowerCase().includes(v.naam.toLowerCase())))
                .map((e: any) => ({ id: Date.now() + Math.random(), naam: e.naam, isHoofdvak: false, punt: e.punt || "", maxPunt: e.maxPunt || "20" }));
              return [...updated, ...nieuw];
            });
            setOcrMsg(`✅ ${extracted.length} vakken en punten herkend!`);
          } catch (error) {
            console.error("AI Error:", error);
            setOcrFout("Kon de tabel niet lezen. Probeer een duidelijkere foto.");
          }
          setOcrLoading(false);
          e.target.value = "";
        };
        reader.readAsDataURL(file);
      } catch (error) {
        setOcrLoading(false); 
        setOcrFout("Fout bij laden van bestand.");
        e.target.value = "";
      }
    };

    const verder = async () => {
      if (!ls||!lj||!ll||!lr) { setFout("Vul alle schoolgegevens in!"); return; }
      if (!lv.length)    { setFout("Voeg minstens één vak toe!"); return; }
      
      setBezig(true);
      try {
        if (currentUser?.uid) {
          await setDoc(doc(db, "users", currentUser.uid), {
            ...currentUser,
            school: ls,
            jaar: lj,
            leeftijd: ll,
            richting: lr,
            vakken: lv
          });
        }
        setSchool(ls); setJaar(lj); setLeeftijd(ll); setRichting(lr); setVakken(lv);
        setScreen("important_subjects");
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${currentUser?.uid}`);
      }
      setBezig(false);
    };

    return (
      <div>
        <StapBar huidig="school_info"/>
        <div style={S.card}>
          <div style={{textAlign:"center",marginBottom:18}}>
            <div style={{fontSize:52}}>🏫</div>
            <h2 style={S.h2}>Jouw schoolinfo</h2>
            <p style={S.sub}>Deze gegevens worden opgeslagen in je account.</p>
          </div>
          {fout && <div style={S.err}>{fout}</div>}

          <div style={{background:`linear-gradient(135deg,${OR}14,${ORL}08)`,
            border:`2px dashed ${OR}66`,borderRadius:16,padding:18,marginBottom:20,textAlign:"center"}}>
            <div style={{fontSize:36,marginBottom:8}}>📸</div>
            <p style={{fontWeight:800,color:ORD,margin:"0 0 6px",fontSize:15}}>Snelstart: Scan je puntenlijst</p>
            <p style={{fontSize:12,color:"#8B6242",margin:"0 0 14px"}}>De AI herkent direct al je vakken en punten!</p>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleOCR} style={{display:"none"}}/>
            {ocrLoading
              ? <div style={{color:OR,fontWeight:700}}>🔍 Analyseren...</div>
              : <button onClick={()=>fileRef.current?.click()} style={{
                  background:OR,color:"white",border:"none",borderRadius:12,
                  padding:"10px 22px",fontSize:14,fontWeight:700,cursor:"pointer",
                  fontFamily:"inherit",boxShadow:`0 4px 14px ${OR}44`,
                }}>📷 Foto van rapport</button>
            }
            {ocrMsg  && <div style={{...S.ok,  margin:"12px 0 0"}}>{ocrMsg}</div>}
            {ocrFout && <div style={{...S.err, margin:"12px 0 0"}}>{ocrFout}</div>}
          </div>

          <label style={S.lbl}>🏫 Naam van je school</label>
          <input style={S.input} value={ls} onChange={e=>setLs(e.target.value)} placeholder="Bv. Atheneum De Kust"/>
          
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div>
              <label style={S.lbl}>📅 Jaar / Graad</label>
              <select style={{...S.input}} value={lj} onChange={e=>setLj(e.target.value)}>
                <option value="">Kies jaar...</option>
                {["1ste leerjaar","2de leerjaar","3de leerjaar","4de leerjaar","5de leerjaar","6de leerjaar",
                  "1ste middelbaar","2de middelbaar","3de middelbaar","4de middelbaar","5de middelbaar","6de middelbaar"].map(j=>(
                  <option key={j} value={j}>{j}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={S.lbl}>🎂 Leeftijd</label>
              <input style={S.input} type="number" value={ll} onChange={e=>setLl(e.target.value)} placeholder="Bv. 14" min="5" max="25"/>
            </div>
          </div>

          <label style={S.lbl}>🚀 Richting / Afstudeerrichting</label>
          <input style={S.input} value={lr} onChange={e=>setLr(e.target.value)} placeholder="Bv. Latijn-Wiskunde of Economie"/>
          <label style={S.lbl}>📚 Mijn vakken</label>
          <div style={{display:"flex",gap:8,marginBottom:8}}>
            <input style={{...S.input,margin:0,flex:1}} value={nv}
              onChange={e=>setNv(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&voegToe()}
              placeholder="Vak naam (bv. Wiskunde)"/>
            <button onClick={voegToe} style={{
              background:OR,color:"white",border:"none",borderRadius:12,
              padding:"0 18px",fontSize:22,cursor:"pointer",fontWeight:900,
              boxShadow:`0 4px 12px ${OR}44`,
            }}>+</button>
          </div>
          <div style={{marginBottom:16}}>
            {lv.map(v=>(
              <div key={v.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                background:ORBG,borderRadius:10,padding:"10px 14px",marginBottom:6}}>
                <span style={{fontWeight:700,color:"#2D1B00",fontSize:14}}>📖 {v.naam} {v.punt && <span style={{color:OR, marginLeft:5}}>({v.punt}/{v.maxPunt})</span>}</span>
                <button onClick={()=>verwijder(v.id)} style={{
                  background:"#FEE2E2",color:"#EF4444",border:"none",borderRadius:8,
                  padding:"4px 10px",cursor:"pointer",fontWeight:700,fontSize:15,
                }}>✕</button>
              </div>
            ))}
            {!lv.length && (
              <div style={{textAlign:"center",color:"#8B6242",fontSize:13,padding:"20px 0",fontStyle:"italic"}}>
                Nog geen vakken toegevoegd...
              </div>
            )}
          </div>
          <button style={{...S.btn, opacity: bezig ? 0.7 : 1}} onClick={verder} disabled={bezig}>
            {bezig ? "⏳ Opslaan..." : "Verder → Belangrijke vakken ⭐"}
          </button>
        </div>
      </div>
    );
  };

  // ── 5. HOOFDVAKKEN ─────────────────────────────────────────
  const ImportantSubjectsScreen = () => {
    const [lv, setLv] = useState([...vakken]);
    const toggle = (id: number) => setLv(lv.map(v=>v.id===id?{...v,isHoofdvak:!v.isHoofdvak}:v));
    const verder = async () => {
      try {
        if (currentUser?.uid) {
          await setDoc(doc(db, "users", currentUser.uid), {
            ...currentUser,
            school,
            jaar,
            leeftijd,
            richting,
            vakken: lv
          });
        }
        setVakken(lv); setScreen("grades");
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${currentUser?.uid}`);
      }
    };
    return (
      <div>
        <StapBar huidig="important_subjects"/>
        <button style={S.back} onClick={()=>setScreen("school_info")}>← Terug</button>
        <div style={S.card}>
          <div style={{textAlign:"center",marginBottom:18}}>
            <div style={{fontSize:52}}>⭐</div>
            <h2 style={S.h2}>Welke vakken zijn het belangrijkste?</h2>
            <p style={S.sub}>Duid de <strong>hoofdvakken</strong> aan — die tellen zwaarder mee voor je attest.</p>
          </div>
          <div style={{marginBottom:16}}>
            {lv.map(v=>(
              <div key={v.id} onClick={()=>toggle(v.id)} style={{
                display:"flex",justifyContent:"space-between",alignItems:"center",
                background: v.isHoofdvak ? `${OR}1A` : ORBG,
                border: `2px solid ${v.isHoofdvak ? OR : "transparent"}`,
                borderRadius:14,padding:"14px 16px",marginBottom:8,cursor:"pointer",transition:"all .2s",
              }}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:22}}>{v.isHoofdvak?"⭐":"📖"}</span>
                  <span style={{fontWeight:700,fontSize:16,color:"#2D1B00"}}>{v.naam}</span>
                </div>
                <div style={{width:28,height:28,borderRadius:"50%",background:v.isHoofdvak?OR:"#E5E7EB",
                  display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontWeight:900,fontSize:15}}>
                  {v.isHoofdvak?"✓":""}
                </div>
              </div>
            ))}
          </div>
          <div style={{background:"#FEF9C3",border:"1px solid #FDE047",borderRadius:12,padding:"12px 14px",marginBottom:20,fontSize:13,color:"#713F12"}}>
            💡 <strong>Tip:</strong> Hoofdvakken tellen {CONFIG.hoofdvakMultiplier}× zwaarder mee. Tik op een vak om het aan/uit te zetten.
          </div>
          <button style={S.btn} onClick={verder}>Verder → Punten invoeren 📊</button>
        </div>
      </div>
    );
  };

  // ── 6. PUNTEN INVOEREN ─────────────────────────────────────
  const GradesScreen = () => {
    const [lv,      setLv]      = useState([...vakken]);
    const [ocrMsg,  setOcrMsg]  = useState("");
    const [ocrFout, setOcrFout] = useState("");
    const [ocrLoading, setOcrLoading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const updateVak = (id: number, field: string, val: string) => setLv(lv.map(v=>v.id===id?{...v,[field]:val}:v));

    const handleOCR = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setOcrLoading(true); setOcrMsg(""); setOcrFout("");
      try {
        const reader = new FileReader();
        reader.onload = async (ev) => {
          const b64 = (ev.target?.result as string).split(",")[1];
          setReportImage(b64);
          
          const apiKey = process.env.GEMINI_API_KEY;
          if (!apiKey) {
            setOcrFout("API key niet gevonden.");
            setOcrLoading(false);
            return;
          }
          const ai = new GoogleGenAI({ apiKey });
          
          try {
            const response = await ai.models.generateContent({
              model: "gemini-3.1-pro-preview",
              contents: [
                {
                  parts: [
                    {
                      inlineData: {
                        mimeType: file.type,
                        data: b64
                      }
                    },
                    {
                      text: `Analyseer deze afbeelding van een schoolrapport of puntenlijst. 
Zoek naar een tabel of lijst met vaknamen en bijbehorende scores.
Voor elk vak:
1. Extraheer de volledige naam van het vak.
2. Zoek de meest recente score (vaak de laatste kolom of de meest rechtse ingevulde waarde).
3. Splits de score in het behaalde punt en het maximum (bv. "14/20" -> punt: 14, max: 20).
4. Als er geen maximum staat, ga uit van 20 of zoek naar een kolomkop die het maximum aangeeft.
5. Gebruik een punt (.) als decimaalteken voor getallen (bv. 7,5 wordt 7.5).

Geef het resultaat terug als een JSON array van objecten:
[{"naam": "Wiskunde", "punt": "15.5", "maxPunt": "20"}]

Belangrijk:
- Negeer titels, datums of andere tekst die geen vaknaam is.
- Als een vak geen punt heeft, laat "punt" leeg ("").
- Geef ENKEL de JSON array terug, geen extra tekst of uitleg.`
                    }
                  ]
                }
              ],
              config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      naam: { type: Type.STRING },
                      punt: { type: Type.STRING },
                      maxPunt: { type: Type.STRING }
                    },
                    required: ["naam", "punt", "maxPunt"]
                  }
                }
              }
            });

            const text = response.text;
            if (!text) throw new Error("Geen tekst ontvangen.");
            const extracted = JSON.parse(cleanJSON(text)) as any[];
            
            setLv(prevLv => {
              const updated = prevLv.map(v => {
                const match = extracted.find((e: any) =>
                  e.naam.toLowerCase().includes(v.naam.toLowerCase()) ||
                  v.naam.toLowerCase().includes(e.naam.toLowerCase())
                );
                return match ? { ...v, punt: match.punt || "", maxPunt: match.maxPunt || "20" } : v;
              });
              const nieuw = extracted
                .filter((e: any) => !prevLv.some(v => v.naam.toLowerCase().includes(e.naam.toLowerCase()) || e.naam.toLowerCase().includes(v.naam.toLowerCase())))
                .map((e: any) => ({ id: Date.now() + Math.random(), naam: e.naam, isHoofdvak: false, punt: e.punt || "", maxPunt: e.maxPunt || "20" }));
              return [...updated, ...nieuw];
            });
            setOcrMsg(`✅ ${extracted.length} vakken herkend! Controleer en pas aan waar nodig.`);
          } catch (error) {
            console.error("AI Error:", error);
            setOcrFout("Kon de punten niet lezen. Probeer een duidelijkere afbeelding.");
          }
          setOcrLoading(false);
          e.target.value = "";
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.error("File Reader Error:", error);
        setOcrLoading(false); 
        setOcrFout("Er ging iets mis. Probeer opnieuw.");
        e.target.value = "";
      }
    };

    const verder = async () => {
      try {
        if (currentUser?.uid) {
          await setDoc(doc(db, "users", currentUser.uid), {
            ...currentUser,
            school,
            jaar,
            leeftijd,
            richting,
            vakken: lv
          });
        }
        setVakken(lv); setScreen("behavior");
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${currentUser?.uid}`);
      }
    };

    return (
      <div>
        <StapBar huidig="grades"/>
        <button style={S.back} onClick={()=>setScreen("important_subjects")}>← Terug</button>
        <div style={S.card}>
          <div style={{textAlign:"center",marginBottom:18}}>
            <div style={{fontSize:52}}>📊</div>
            <h2 style={S.h2}>Jouw punten invoeren</h2>
            <p style={S.sub}>Vul je punten handmatig in, of upload een screenshot</p>
          </div>
          <div style={{background:`linear-gradient(135deg,${OR}14,${ORL}08)`,
            border:`2px dashed ${OR}66`,borderRadius:16,padding:18,marginBottom:20,textAlign:"center"}}>
            <div style={{fontSize:36,marginBottom:8}}>📸</div>
            <p style={{fontWeight:800,color:ORD,margin:"0 0 6px",fontSize:15}}>Upload een screenshot van je punten</p>
            <p style={{fontSize:12,color:"#8B6242",margin:"0 0 14px"}}>De app vult alles automatisch in!</p>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleOCR} style={{display:"none"}}/>
            {ocrLoading
              ? <div style={{color:OR,fontWeight:700}}>🔍 Punten worden herkend...</div>
              : <button onClick={()=>fileRef.current?.click()} style={{
                  background:OR,color:"white",border:"none",borderRadius:12,
                  padding:"10px 22px",fontSize:14,fontWeight:700,cursor:"pointer",
                  fontFamily:"inherit",boxShadow:`0 4px 14px ${OR}44`,
                }}>📷 Foto kiezen</button>
            }
            {ocrMsg  && <div style={{...S.ok,  margin:"12px 0 0"}}>{ocrMsg}</div>}
            {ocrFout && <div style={{...S.err, margin:"12px 0 0"}}>{ocrFout}</div>}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 76px 70px",gap:6,marginBottom:8}}>
            <span style={{...S.lbl,margin:0}}>Vak</span>
            <span style={{...S.lbl,margin:0,textAlign:"center"}}>Punt</span>
            <span style={{...S.lbl,margin:0,textAlign:"center"}}>Max</span>
          </div>
          {lv.map(v=>(
            <div key={v.id} style={{display:"grid",gridTemplateColumns:"1fr 76px 70px",gap:6,marginBottom:6,alignItems:"center"}}>
              <div style={{background:v.isHoofdvak?`${OR}1F`:ORBG,borderRadius:10,padding:"10px 12px",fontWeight:700,fontSize:13,color:"#2D1B00",display:"flex",alignItems:"center",gap:5}}>
                {v.isHoofdvak&&<span>⭐</span>}{v.naam}
              </div>
              <input style={{...S.input,margin:0,textAlign:"center",padding:"10px 6px",fontSize:16}}
                type="number" value={v.punt} onChange={e=>updateVak(v.id,"punt",e.target.value)} placeholder="0" min="0"/>
              <input style={{...S.input,margin:0,textAlign:"center",padding:"10px 6px",fontSize:13,color:"#8B6242"}}
                type="number" value={v.maxPunt} onChange={e=>updateVak(v.id,"maxPunt",e.target.value)} placeholder="20" min="1"/>
            </div>
          ))}
          <div style={{fontSize:11,color:"#8B6242",margin:"8px 0 20px",fontStyle:"italic"}}>⭐ = Hoofdvak (telt {CONFIG.hoofdvakMultiplier}× zwaarder mee)</div>
          <button style={S.btn} onClick={verder}>Verder → Gedragsvragen 😊</button>
        </div>
      </div>
    );
  };

  // ── 7. GEDRAGSVRAGEN ───────────────────────────────────────
  const BehaviorScreen = () => {
    const [la,   setLa]  = useState({...gedragAntw});
    const [fout, setFout]= useState("");
    const set = (id: number, w: number) => setLa({...la,[id]:w});
    const verder = async () => {
      if (Object.keys(la).length < CONFIG.gedragsVragen.length) { setFout("Beantwoord alle vragen! 😊"); return; }
      const s = berekenScore(vakken, la);
      try {
        if (currentUser?.uid) {
          await setDoc(doc(db, "users", currentUser.uid), {
            ...currentUser,
            school,
            jaar,
            leeftijd,
            richting,
            vakken,
            gedragAntw: la,
            score: s
          });
        }
        setGedragAntw(la);
        setScore(s);
        setScreen("results");
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${currentUser?.uid}`);
      }
    };
    return (
      <div>
        <StapBar huidig="behavior"/>
        <button style={S.back} onClick={()=>setScreen("grades")}>← Terug</button>
        <div style={S.card}>
          <div style={{textAlign:"center",marginBottom:18}}>
            <div style={{fontSize:52}}>😊</div>
            <h2 style={S.h2}>Hoe gedraag jij je op school?</h2>
            <p style={S.sub}>Je gedrag heeft ook invloed op je attest! Wees eerlijk 😉</p>
          </div>
          {fout && <div style={S.err}>{fout}</div>}
          {CONFIG.gedragsVragen.map(vraag=>(
            <div key={vraag.id} style={{background:ORBG,borderRadius:16,padding:16,marginBottom:12}}>
              <p style={{fontWeight:800,fontSize:15,color:"#2D1B00",margin:"0 0 12px"}}>{vraag.emoji} {vraag.vraag}</p>
              <div style={{display:"flex",gap:6}}>
                {CONFIG.antwoordOpties.map(opt=>(
                  <button key={opt.waarde} onClick={()=>set(vraag.id,opt.waarde)} style={{
                    flex:1,padding:"8px 3px",
                    background: la[vraag.id]===opt.waarde ? OR : "white",
                    color:      la[vraag.id]===opt.waarde ? "white" : "#8B6242",
                    border:     `2px solid ${la[vraag.id]===opt.waarde ? OR : "#E5E7EB"}`,
                    borderRadius:10,cursor:"pointer",fontFamily:"inherit",fontWeight:700,
                    display:"flex",flexDirection:"column",alignItems:"center",gap:3,transition:"all .15s",
                    boxShadow: la[vraag.id]===opt.waarde ? `0 4px 12px ${OR}44` : "none",
                  }}>
                    <span style={{fontSize:20}}>{opt.emoji}</span>
                    <span style={{fontSize:9,lineHeight:1.2,textAlign:"center"}}>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div style={{background:"#FEF3C7",borderRadius:12,padding:"12px 14px",marginBottom:20,fontSize:13,color:"#92400E"}}>
            💡 Gedrag telt voor <strong>{Math.round(CONFIG.gedragGewicht*100)}%</strong> mee in je eindscore.
          </div>
          <button style={S.btn} onClick={verder}>🎯 Bekijk mijn resultaat!</button>
        </div>
      </div>
    );
  };

  // ── 8. RESULTATEN + SPEEDOMETER ───────────────────────────
  const ResultsScreen = () => {
    const [anim, setAnim] = useState(0);
    const attest = getAttest(score||0);
    useEffect(()=>{
      let raf: number;
      const start=Date.now(),dur=2200,target=score||0;
      const tick=()=>{
        const t=Math.min((Date.now()-start)/dur,1);
        const e=1-Math.pow(1-t,3);
        setAnim(Math.round(e*target*10)/10);
        if(t<1) raf=requestAnimationFrame(tick);
      };
      raf=requestAnimationFrame(tick);
      return ()=>cancelAnimationFrame(raf);
    }, [score]);

    const Speedo = ({val}: { val: number }) => {
      const cx=160,cy=132,R=108;
      const rad=(d: number)=>d*Math.PI/180;
      const pt=(d: number,r: number)=>({x:cx+r*Math.cos(rad(d)),y:cy+r*Math.sin(rad(d))});
      const arc=(a1: number,a2: number,ri: number,ro: number)=>{
        const s1=pt(a1,ro),e1=pt(a2,ro),s2=pt(a1,ri),e2=pt(a2,ri);
        const lg=Math.abs(a2-a1)>180?1:0;
        return `M${s1.x} ${s1.y} A${ro} ${ro} 0 ${lg} 1 ${e1.x} ${e1.y} L${e2.x} ${e2.y} A${ri} ${ri} 0 ${lg} 0 ${s2.x} ${s2.y}Z`;
      };
      const SA=150,SW=240;
      const segs: [number, number, string][] = [[SA,SA+SW*.35,"#EF4444"],[SA+SW*.35,SA+SW*.65,"#F59E0B"],[SA+SW*.65,SA+SW,"#22C55E"]];
      const na=SA+(val/100)*SW, ne=pt(na,R-18);
      return (
        <svg width="320" height="200" viewBox="0 0 320 200" style={{display:"block",margin:"0 auto"}}>
          {segs.map(([a1,a2,c],i)=><path key={i} d={arc(a1,a2,78,113)} fill={c} opacity=".88"/>)}
          <circle cx={cx} cy={cy} r="76" fill="white"/>
          <circle cx={cx} cy={cy} r="74" fill={ORBG}/>
          {[0,25,50,75,100].map(v=>{const a=SA+(v/100)*SW;const p1=pt(a,78),p2=pt(a,96);return <line key={v} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="white" strokeWidth="2"/>;
          })}
          {[{p:.17,l:"C",c:"#EF4444"},{p:.50,l:"B",c:"#F59E0B"},{p:.83,l:"A",c:"#22C55E"}].map(({p,l,c})=>{
            const pos=pt(SA+p*SW,R+22);return <text key={l} x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="middle" fill={c} fontSize="15" fontWeight="900" fontFamily="Nunito,sans-serif">{l}</text>;
          })}
          <text x={cx} y={cy-10} textAnchor="middle" fontSize="38" fontWeight="900" fill="#2D1B00" fontFamily="Nunito,sans-serif">{val}%</text>
          <text x={cx} y={cy+22} textAnchor="middle" fontSize="15" fontWeight="800" fill={attest.kleur} fontFamily="Nunito,sans-serif">{attest.label}</text>
          <line x1={cx} y1={cy} x2={ne.x} y2={ne.y} stroke="#2D1B00" strokeWidth="3.5" strokeLinecap="round"/>
          <circle cx={cx} cy={cy} r="9" fill="#2D1B00"/>
          <circle cx={cx} cy={cy} r="4" fill="white"/>
        </svg>
      );
    };

    return (
      <div>
        <StapBar huidig="results"/>
        <div style={S.card}>
          <div style={{textAlign:"center",marginBottom:16}}>
            <div style={{fontSize:54}}>{attest.emoji}</div>
            <h2 style={S.h2}>Jouw resultaat</h2>
          </div>
          <Speedo val={anim}/>
          <div style={{textAlign:"center",background:`${attest.kleur}14`,border:`2px solid ${attest.kleur}44`,
            borderRadius:16,padding:"16px 20px",marginTop:16,marginBottom:16}}>
            <div style={{fontSize:26,fontWeight:900,color:attest.kleur,marginBottom:8}}>{attest.emoji} {attest.label}</div>
            <p style={{fontSize:14,color:"#5D3D1A",margin:0,lineHeight:1.6}}>{attest.tekst}</p>
          </div>
          
          <div style={{marginBottom:20}}>
            <button style={{...S.btn, background:OR, boxShadow:`0 6px 20px ${OR}66`, height:60, fontSize:18}} onClick={vraagFeedback} disabled={fbLoad}>
              {fbLoad ? "⏳ De coach analyseert jouw rapport..." : fbData ? "🔄 Nieuwe analyse vragen" : "✨ Hoe kan ik het nog beter doen?"}
            </button>
            {fbError && (
              <div style={{marginTop:12, textAlign:"center"}}>
                <div style={{...S.err, marginBottom:8}}>{fbError}</div>
                {!hasApiKey && (
                  <button 
                    style={{...S.btnSec, padding:"8px 16px", fontSize:13}} 
                    onClick={handleSelectKey}
                  >
                    🔑 API Sleutel Instellen
                  </button>
                )}
              </div>
            )}
          </div>

          {fbData && (
            <div style={{display:"flex",flexDirection:"column",gap:24,marginBottom:24,textAlign:"left"}}>
              {/* Score Analyse Grid */}
              <div>
                <h3 style={{fontWeight:900,color:"#2D1B00",fontSize:16,marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
                  <span>📊</span> Waarom deze score?
                </h3>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  {fbData.scoreAnalysis.map((item, i) => (
                    <div key={i} style={{
                      background: item.impact === "positive" ? "#F0FDF4" : item.impact === "negative" ? "#FEF2F2" : "#F9FAFB",
                      border: `1px solid ${item.impact === "positive" ? "#DCFCE7" : item.impact === "negative" ? "#FEE2E2" : "#F3F4F6"}`,
                      borderRadius:14,padding:12,fontSize:12
                    }}>
                      <div style={{fontSize:20,marginBottom:6}}>{item.emoji}</div>
                      <div style={{fontWeight:800,color:"#2D1B00",marginBottom:4}}>{item.title}</div>
                      <div style={{color:"#4B5563",lineHeight:1.4}}>{item.description}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actiepunten */}
              <div>
                <h3 style={{fontWeight:900,color:"#2D1B00",fontSize:16,marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
                  <span>🎯</span> Jouw Actieplan
                </h3>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {fbData.actionPoints.map((point, i) => (
                    <div key={i} style={{
                      background:"white",border:`1px solid ${point.priority === "high" ? OR : "#E5E7EB"}`,
                      borderRadius:14,padding:14,display:"flex",gap:12,alignItems:"flex-start",
                      boxShadow: point.priority === "high" ? `0 4px 12px ${OR}1A` : "none"
                    }}>
                      <div style={{
                        background: point.priority === "high" ? OR : "#F3F4F6",
                        color: point.priority === "high" ? "white" : "#4B5563",
                        width:24,height:24,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",
                        fontSize:12,fontWeight:900,flexShrink:0
                      }}>{i+1}</div>
                      <div>
                        <div style={{fontWeight:800,color:"#2D1B00",fontSize:14,marginBottom:2}}>{point.title}</div>
                        <div style={{fontSize:12,color:"#4B5563",lineHeight:1.5}}>{point.description}</div>
                        {point.priority === "high" && <span style={{fontSize:10,background:`${OR}1A`,color:OR,padding:"2px 8px",borderRadius:10,fontWeight:800,marginTop:6,display:"inline-block"}}>Hoge Prioriteit ⚡</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Nog beter doen Tips */}
              <div style={{background:"#2D1B00",borderRadius:20,padding:20,color:"white"}}>
                <h3 style={{fontWeight:900,color:OR,fontSize:16,marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
                  <span>✨</span> Het nog beter doen
                </h3>
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  {fbData.betterStudentTips.map((tip, i) => (
                    <div key={i} style={{display:"flex",gap:12,alignItems:"center"}}>
                      <div style={{fontSize:24}}>{tip.emoji}</div>
                      <div>
                        <div style={{fontWeight:800,fontSize:13,color:OR}}>{tip.title}</div>
                        <div style={{fontSize:11,color:"#D1D5DB",lineHeight:1.4}}>{tip.tip}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{textAlign:"center",padding:10}}>
                <p style={{fontSize:16,fontWeight:900,color:OR,fontStyle:"italic"}}>"{fbData.motivation}"</p>
              </div>
            </div>
          )}

          <div style={{fontSize:12,color:"#8B6242",marginBottom:20,textAlign:"center",fontStyle:"italic",lineHeight:1.5}}>
            ⚠️ Dit is een indicatie. De officiële beslissing ligt altijd bij de school.
          </div>
          <button style={S.btn} onClick={()=>setScreen("breakdown")}>🔍 Bekijk gedetailleerde berekening</button>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <button style={S.btnSec} onClick={()=>setScreen("school_info")}>
              ⚙️ Gegevens aanpassen
            </button>
            <button style={S.btnSec} onClick={()=>{
              setVakken([]);
              setGedragAntw({});
              setScore(null);
              setFbData(null);
              setScreen("school_info");
            }}>
              🔄 Nieuwe puntenlijst
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── 9. BREAKDOWN ────────────────────────────
  const BreakdownScreen = () => {
    const ingevuld = vakken.filter(v=>v.punt!==""&&!isNaN(parseFloat(v.punt)));
    const pctKleur = (p: number) => p>=70?"#22C55E":p>=50?"#F59E0B":"#EF4444";
    const attest   = getAttest(score||0);

    let gw=0,tw=0;
    ingevuld.forEach(v=>{const p=(parseFloat(v.punt)/(parseFloat(v.maxPunt)||100))*100;const w=v.isHoofdvak?CONFIG.hoofdvakMultiplier:1;gw+=p*w;tw+=w;});
    const ps = tw?Math.round(gw/tw*10)/10:0;
    let gt=0,ga=0;
    CONFIG.gedragsVragen.forEach(v=>{if(gedragAntw[v.id]!==undefined){gt+=(gedragAntw[v.id]/5)*100;ga++;}});
    const gs = ga?Math.round(gt/ga*10)/10:0;

    return (
      <div>
        <button style={S.back} onClick={()=>setScreen("results")}>← Terug naar resultaat</button>
        <div style={S.card}>
          <div style={{textAlign:"center",marginBottom:18}}>
            <div style={{fontSize:46}}>🔍</div>
            <h2 style={S.h2}>Hoe is jouw score berekend?</h2>
            <p style={S.sub}>Eindscore: <strong style={{color:OR,fontSize:18}}>{score}%</strong></p>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
            {[{label:"📊 Punten",pct:Math.round(CONFIG.puntenGewicht*100),sc:ps,kleur:OR},
              {label:"😊 Gedrag", pct:Math.round(CONFIG.gedragGewicht*100),sc:gs,kleur:"#22C55E"}].map(({label,pct,sc,kleur})=>(
              <div key={label} style={{background:ORBG,borderRadius:14,padding:14,textAlign:"center"}}>
                <div style={{fontWeight:800,fontSize:13,color:"#2D1B00",marginBottom:4}}>{label}</div>
                <div style={{fontSize:24,fontWeight:900,color:kleur}}>{sc}%</div>
                <div style={{fontSize:11,color:"#8B6242"}}>telt {pct}% mee</div>
              </div>
            ))}
          </div>
          <div style={{background:ORBG,borderRadius:16,padding:16,marginBottom:14}}>
            <h3 style={{fontWeight:800,color:"#2D1B00",fontSize:14,margin:"0 0 12px"}}>📚 Scores per vak</h3>
            {ingevuld.map(v=>{
              const pct=Math.round((parseFloat(v.punt)/parseFloat(v.maxPunt))*100);
              const kl=pctKleur(pct);
              return (
                <div key={v.id} style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:13,fontWeight:700,color:"#2D1B00"}}>
                      {v.isHoofdvak?"⭐":"📖"} {v.naam}
                      {v.isHoofdvak&&<span style={{fontSize:10,color:OR,marginLeft:4}}>({CONFIG.hoofdvakMultiplier}×)</span>}
                    </span>
                    <span style={{fontSize:13,fontWeight:800,color:kl}}>{v.punt}/{v.maxPunt} ({pct}%)</span>
                  </div>
                  <div style={{background:"#E5E7EB",borderRadius:6,height:8,overflow:"hidden"}}>
                    <div style={{width:`${pct}%`,height:"100%",background:kl,borderRadius:6,transition:"width 1.2s ease"}}/>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{background:"#F0FDF4",border:"1px solid #DCFCE7",borderRadius:16,padding:16}}>
            <h3 style={{fontWeight:800,color:"#2D1B00",fontSize:14,margin:"0 0 12px"}}>😊 Gedragsscores</h3>
            {CONFIG.gedragsVragen.map(v=>{
              const a=gedragAntw[v.id];
              const opt=CONFIG.antwoordOpties.find(o=>o.waarde===a);
              if (!a) return null;
              return (
                <div key={v.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                  background:"white",borderRadius:10,padding:"8px 12px",marginBottom:6}}>
                  <span style={{fontSize:12,fontWeight:700,color:"#2D1B00",flex:1}}>{v.emoji} {v.vraag}</span>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:18}}>{opt?.emoji}</span>
                    <span style={{fontSize:11,color:"#8B6242",fontWeight:700}}>{opt?.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════
  const geenHeader = ["welcome","register","login","loading"];

  const handleLogout = async () => {
    await signOut(auth);
    setSchool(""); setJaar(""); setLeeftijd(""); setVakken([]);
    setGedragAntw({}); setScore(null); setFbData(null);
  };

  return (
    <div style={S.page}>
      <style>{`
        @keyframes bounce { 0%{transform:scale(.6);opacity:0} 60%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
        @keyframes loading { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
        input:focus { border-color:${OR}!important; }
        button:active { transform:scale(.97)!important; }
        .markdown-body h1, .markdown-body h2, .markdown-body h3 { color: #2D1B00; margin-top: 16px; margin-bottom: 8px; font-weight: 900; }
        .markdown-body p { margin-bottom: 12px; }
        .markdown-body ul { padding-left: 20px; margin-bottom: 12px; list-style-type: disc; }
        .markdown-body li { margin-bottom: 6px; }
        .markdown-body strong { color: ${OR}; font-weight: 800; }
      `}</style>
      <Blobs/>
      <div style={S.wrap}>
        {!geenHeader.includes(screen) && currentUser && (
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontWeight:900,color:OR,fontSize:18}}>📊 AttestatieCheck</div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{fontSize:13,color:"#8B6242",background:ORBG,padding:"6px 12px",borderRadius:20,fontWeight:700}}>
                👋 {currentUser.naam}
              </div>
              <button onClick={handleLogout} style={{
                background:"none",border:`1.5px solid #E5E7EB`,borderRadius:10,
                color:"#8B6242",fontSize:12,fontWeight:700,cursor:"pointer",padding:"6px 10px",fontFamily:"inherit",
              }}>Uitloggen</button>
            </div>
          </div>
        )}
        {screen==="loading"            && <LoadingScreen/>}
        {screen==="welcome"            && <WelcomeScreen/>}
        {screen==="register"           && <RegisterScreen/>}
        {screen==="login"              && <LoginScreen/>}
        {screen==="school_info"        && <SchoolInfoScreen/>}
        {screen==="important_subjects" && <ImportantSubjectsScreen/>}
        {screen==="grades"             && <GradesScreen/>}
        {screen==="behavior"           && <BehaviorScreen/>}
        {screen==="results"            && <ResultsScreen/>}
        {screen==="breakdown"          && <BreakdownScreen/>}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AttestatieApp />
    </ErrorBoundary>
  );
}
