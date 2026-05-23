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
  getDocFromServer,
  collection,
  addDoc,
  serverTimestamp
} from "firebase/firestore";
import { auth, db } from "./firebase";
import Markdown from "react-markdown";
import { motion, AnimatePresence } from "motion/react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine,
  AreaChart,
  Area
} from "recharts";
import { OrbitControls, Float, Sparkles, Stars, Environment, PerspectiveCamera, MeshDistortMaterial, ContactShadows, PresentationControls, Float as FloatDrei } from "@react-three/drei";
import * as THREE from "three";
import SmileyIcon from "./components/SmileyIcon";
import FeedbackModal from "./components/FeedbackModal";
import SettingsModal from "./components/SettingsModal";
import ProfileCard from "./components/ProfileCard";
import { useApp } from "./context/AppContext";

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

// Hulpmiddel om te voorkomen dat metadata in de document body wordt opgeslagen
function cleanUserForFirestore(user: any) {
  if (!user) return user;
  const { uid, ...clean } = user; // Verwijder de uid, want dat is het document ID, niet data
  return clean;
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
  hoofdvakMultiplier: 3,
  gedragGewicht: 0.12,
  puntenGewicht: 0.88,
  attestA_drempel: 70,
  attestB_drempel: 50,
  gedragsVragen: [
    { id: 1, vraag: "Hoe vaak kom ik op tijd naar school?",      emoji: "⏰" },
    { id: 2, vraag: "Hoe goed maak ik mijn huiswerk?",           emoji: "📚" },
    { id: 3, vraag: "Hoe goed gedraag ik mij in de klas?",       emoji: "😊" },
    { id: 4, vraag: "Als iemand mij kritiek geeft, reageer ik meestal rustig en denk ik erover na.", emoji: "🤝" },
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
  nederlandsVragen: [
    { id: "schrijven", vraag: "Kan ik vlot Nederlandse zinnen schrijven?", emoji: "✍️" },
    { id: "spreken",   vraag: "Kan ik vlot Nederlandse zinnen spreken?",   emoji: "🗣️" },
  ]
};

// ── Kleuren ────────────────────────────────────────────────
const OR   = "#F47920";
const ORL  = "#FF9F45";
const ORD  = "#C85E10";
const ORBG = "#FFF5EC";
const ORPL = "#FFE4C4";

function AttestatieApp() {
  const { 
    setShowFeedback, 
    setShowSettings, 
    setShowProfile,
    currentUser,
    setCurrentUser,
    school,
    setSchool,
    jaar,
    setJaar,
    leeftijd,
    setLeeftijd,
    richting,
    setRichting,
    vakken,
    setVakken,
    gedragAntw,
    setGedragAntw,
    nederlandsAntw,
    setNederlandsAntw,
    score,
    setScore,
    reportImage,
    setReportImage,
    hasApiKey,
    setHasApiKey
  } = useApp();

  const [screen, setScreen] = useState("loading");
  
  // Grades Screen State (Elevated to prevent remount reset)
  const [grades_lv, setGrades_lv] = useState<any[]>([]);
  const [grades_nv, setGrades_nv] = useState("");
  const [grades_ocrMsg, setGrades_ocrMsg] = useState("");
  const [grades_ocrFout, setGrades_ocrFout] = useState("");
  const [grades_ocrLoading, setGrades_ocrLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  interface FocusPoint {
    id: string;
    text: string;
    completed: boolean;
    xpValue: number;
    createdAt: string;
  }

  const cleanJSON = (text: string) => {
    let cleaned = text.trim();
    
    // Verwijder markdown code blocks als die eromheen staan
    if (cleaned.includes("```")) {
      const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match && match[1]) {
        cleaned = match[1].trim();
      } else {
        cleaned = cleaned.replace(/^```(json)?/, "").replace(/```$/, "").trim();
      }
    }

    // Zoek naar de eerste { of [ en de laatste } of ]
    const firstBrace = cleaned.indexOf("{");
    const firstBracket = cleaned.indexOf("[");
    const lastBrace = cleaned.lastIndexOf("}");
    const lastBracket = cleaned.lastIndexOf("]");

    let start = -1;
    let end = -1;

    if (firstBrace !== -1 && (firstBracket === -1 || (firstBrace < firstBracket && firstBrace !== -1))) {
      start = firstBrace;
      end = lastBrace;
    } else if (firstBracket !== -1) {
      start = firstBracket;
      end = lastBracket;
    }

    if (start !== -1 && end !== -1 && end > start) {
      cleaned = cleaned.substring(start, end + 1);
    }

    return cleaned;
  };

  const getApiKey = () => {
    try {
      // @ts-ignore
      const browserProcess = typeof process !== 'undefined' ? process : null;
      return (browserProcess?.env?.API_KEY || browserProcess?.env?.GEMINI_API_KEY) || 
             (import.meta as any).env?.VITE_GEMINI_API_KEY || "";
    } catch (e) {
      return (import.meta as any).env?.VITE_GEMINI_API_KEY || "";
    }
  };

  const checkApiKey = async () => {
    try {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected || !!getApiKey());
      } else {
        setHasApiKey(!!getApiKey());
      }
    } catch (e) {
      console.warn("Error checking API key:", e);
      setHasApiKey(!!getApiKey());
    }
  };

  const [authError, setAuthError] = useState("");

  const handleAuthError = (error: any) => {
    console.error("Auth Error:", error);
    if (error.code === "auth/unauthorized-domain") {
      setAuthError("Dit domein is niet geautoriseerd in Firebase. Voeg de Shared App URL toe aan 'Authorized domains' in de Firebase Console.");
    } else {
      setAuthError("Er ging iets mis bij het inloggen: " + (error.message || "Onbekende fout"));
    }
  };

  const handleSelectKey = async () => {
    console.log("Sleutel selecteren gestart...");
    if (window.aistudio) {
      try {
        await window.aistudio.openSelectKey();
        console.log("Sleutel selectie venster geopend.");
        setHasApiKey(true);
      } catch (err) {
        console.error("Fout bij openen sleutel-venster:", err);
      }
    }
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
        // Silent fail for test connection
      }
    }
    testConnection();
  }, []);

  useEffect(() => {
    if (screen === "loading") {
      const startupTimer = setTimeout(() => {
        if (currentUser) {
          setScreen("dashboard");
        } else {
          setScreen("welcome");
        }
      }, 1000);
      return () => clearTimeout(startupTimer);
    } else {
      if (!currentUser && screen !== "welcome") {
        setScreen("welcome");
      } else if (currentUser && screen === "welcome") {
        setScreen("dashboard");
      }
    }
  }, [currentUser, screen]);

  // ── Score berekening ───────────────────────────────────────
  const berekenScore = (vakkenData: any[], antwoorden: any, nedAntw: any) => {
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
    
    let baseScore = (puntScore * CONFIG.puntenGewicht + gedragScore * CONFIG.gedragGewicht);
    
    // Nederlands impact: +/- 1.5% per vraag (totaal +/- 3%)
    if (nedAntw.schrijven === "ja") baseScore += 1.5; else if (nedAntw.schrijven === "nee") baseScore -= 1.5;
    if (nedAntw.spreken === "ja")   baseScore += 1.5; else if (nedAntw.spreken === "nee")   baseScore -= 1.5;

    return Math.round(Math.max(0, Math.min(100, baseScore)) * 10) / 10;
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
      padding:0, position:"relative", overflowX:"hidden",
    },
    wrap: { 
      width:"100%", 
      maxWidth:460, 
      padding:"env(safe-area-inset-top, 16px) 16px calc(env(safe-area-inset-bottom, 16px) + 48px)", 
      position:"relative", 
      zIndex: 1,
      boxSizing: "border-box"
    },
    card: { 
      background:"white", 
      borderRadius:28, 
      padding:"28px 24px", 
      boxShadow:`0 12px 40px rgba(244,121,32,.12)`, 
      marginBottom:20,
      border: "1px solid rgba(244,121,32,.05)"
    },
    btn: {
      width:"100%", padding:"18px", background:`linear-gradient(135deg,${OR},${ORL})`,
      color:"white", border:"none", borderRadius:20, fontSize:18, fontWeight:800,
      fontFamily:"inherit", cursor:"pointer", boxShadow:`0 8px 24px ${OR}44`,
      marginBottom:14, display:"block", textAlign:"center", letterSpacing:".4px", transition:"all .2s",
      userSelect: "none",
      WebkitTapHighlightColor: "transparent",
    },
    btnSec: {
      width:"100%", padding:"16px", background:"white", color:OR,
      border:`2px solid ${OR}`, borderRadius:20, fontSize:16, fontWeight:800,
      fontFamily:"inherit", cursor:"pointer", marginBottom:14, display:"block", textAlign:"center",
      transition: "all .2s",
      userSelect: "none",
      WebkitTapHighlightColor: "transparent",
      boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
    },
    input: {
      width:"100%", padding:"15px 18px", border:`2px solid ${ORPL}`,
      borderRadius:16, fontSize:16, fontFamily:"inherit", outline:"none",
      marginBottom:14, boxSizing:"border-box", color:"#2D1B00", background:"#FAFAFA", transition:"all .2s",
    },
    lbl:  { fontSize:13, fontWeight:700, color:ORD, marginBottom:5, display:"block" },
    h2:   { fontSize:21, fontWeight:800, color:"#2D1B00", margin:"0 0 6px" },
    sub:  { fontSize:13, color:"#8B6242", lineHeight:1.5 },
    err:  { background:"#FEE2E2", color:"#DC2626", padding:"10px 14px", borderRadius:10, fontSize:13, fontWeight:600, marginBottom:12 },
    ok:   { background:"#DCFCE7", color:"#15803D", padding:"10px 14px", borderRadius:10, fontSize:13, fontWeight:600, marginBottom:12 },
    back: { 
      background:"white", 
      border:`2px solid ${OR}`, 
      fontSize:14, 
      cursor:"pointer", 
      marginBottom:16, 
      color:OR, 
      fontFamily:"inherit", 
      fontWeight:800, 
      padding:"10px 20px",
      borderRadius:16,
      display:"inline-flex",
      alignItems:"center",
      gap:8,
      boxShadow: "0 4px 12px rgba(0,0,0,0.08)"
    },
  };

  const Blobs = () => (
    <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0}}>
      <div style={{position:"absolute",top:-100,right:-100,width:320,height:320,borderRadius:"50%",background:`radial-gradient(circle,${OR}28,transparent 70%)`}}/>
      <div style={{position:"absolute",bottom:-80,left:-80,width:260,height:260,borderRadius:"50%",background:`radial-gradient(circle,${ORL}22,transparent 70%)`}}/>
      <div style={{position:"absolute",top:"35%",right:-50,width:180,height:180,borderRadius:"50%",background:`radial-gradient(circle,${ORPL},transparent 70%)`}}/>
    </div>
  );

  const stappen = ["📊","⭐","😊","🎯"];
  const stpIdx: any  = { grades:0, important_subjects:1, behavior:2, results:3 };
  const StapBar = ({ huidig }: { huidig: string }) => {
    const idx = stpIdx[huidig] ?? -1;
    if (idx < 0) return null;
    return (
      <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:24,padding:"0 4px"}}>
        {stappen.map((em,i) => (
          <div key={i} style={{
            flex:1,
            height:42,
            borderRadius:14,
            background: i <= idx ? `linear-gradient(135deg,${OR},${ORL})` : "white",
            color: i <= idx ? "white" : "#9CA3AF",
            fontSize: i <= idx ? 18 : 14,
            fontWeight:800, 
            display:"flex", 
            alignItems:"center", 
            justifyContent:"center",
            boxShadow: i === idx ? `0 6px 16px ${OR}44` : "0 2px 8px rgba(0,0,0,0.05)",
            border: i <= idx ? "none" : `1px solid ${ORPL}`,
            transition:"all .4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
            transform: i === idx ? "scale(1.1)" : "scale(1)",
            zIndex: i === idx ? 2 : 1
          }}>
            {i < idx ? "✓" : em}
          </div>
        ))}
      </div>
    );
  };

  // ── DISCLAIMER ──────────────────────────────────────────────
  const Disclaimer = ({ mini = false }: { mini?: boolean }) => (
    <div style={{
      marginTop: mini ? 15 : 24,
      padding: mini ? "10px 14px" : "18px 22px",
      background: "rgba(255, 255, 255, 0.6)",
      border: `1.5px solid ${ORPL}`,
      borderRadius: 20,
      fontSize: mini ? 11 : 13,
      color: "#64748B",
      textAlign: "center",
      lineHeight: 1.5,
      backdropFilter: "blur(5px)"
    }}>
      <div style={{ fontWeight: 900, marginBottom: 5, color: ORD, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: mini ? 12 : 14 }}>
        <span>⚠️</span> Belangrijk: Geen garantie
      </div>
      RapportRadar is <strong>niet verbonden aan een officiële school</strong>. 
      Deze voorspelling is <strong>slechts een indicatie</strong>. 
      De echte beslissing over je attest wordt altijd genomen door de <strong>klassenraad</strong> van jouw school.
    </div>
  );

  // ── LAADSCHERM ─────────────────────────────────────────────
  const LoadingScreen = () => {
    const [showSkip, setShowSkip] = useState(false);
    useEffect(() => {
      const t = setTimeout(() => setShowSkip(true), 4000);
      return () => clearTimeout(t);
    }, []);

    return (
      <div style={{textAlign:"center",paddingTop:80}}>
        <div style={{marginBottom:16}}>
          <SmileyIcon size={60} />
        </div>
        <p style={{color:OR,fontWeight:800,fontSize:18}}>Laden...</p>
        {showSkip && (
          <button 
            style={{...S.btnSec, width: "auto", margin: "20px auto", padding: "8px 16px", fontSize: 13}}
            onClick={() => setScreen("welcome")}
          >
            Laden duurt lang? Klik hier ⏩
          </button>
        )}
      </div>
    );
  };

  // ── OCR PROMPT ───────────────────────────────────────────
  const OCR_PROMPT = `Analyseer deze afbeelding(en) van een Belgisch schoolrapport (Smartschool, Skore, PDF, etc.).
Zoek naar vaknamen en hun bijbehorende scores over alle beelden heen.

STRIKTE REGELS VOOR EXTRACTIE:
1. VAKNAAM: De naam van het vak (bv. "Wiskunde", "Frans").
2. PUNT: De behaalde score. Gebruik ALTIJD een punt (.) als decimaalteken (bv. "7,5" wordt "7.5").
3. MAXPUNT: De maximale score voor dat vak (bv. "10", "20", "100").
4. MEERDERE KOLOMMEN: Als er meerdere kolommen zijn (DW1, DW2, EX, JR), neem dan de MEEST RECHTSE kolom die een waarde bevat voor dat vak. Dit is meestal het meest recente resultaat.
5. GEEN TOTALEN: Negeer rijen zoals "Totaal", "Gemiddelde", "Eindtotaal".
6. FORMAAT: Als je "14/20" ziet, zet dan punt="14" en maxPunt="20".
7. PERCENTAGE: Als je een getal ziet zoals "73,3" zonder maximum, zet dan punt="73.3" en maxPunt="100".

OUTPUT FORMAAT:
Geef ENKEL een JSON array terug van objecten met deze velden: "naam", "punt", "maxPunt".
Voorbeeld: [{"naam": "Wiskunde", "punt": "15.5", "maxPunt": "20"}]
Als je niets vindt, geef dan een lege array [] terug. Geen tekst, geen uitleg, enkel de JSON.`;

  // ── 1. WELKOMSTSCHERM ──────────────────────────────────────
  const [showTutorial,  setShowTutorial]  = useState(false);
  const [tutorialStep,  setTutorialStep]  = useState(0);

  // ── 1. WELCOME SCREEN ──────────────────────────────────────
  const TutorialModal = () => {
    if (!showTutorial) return null;
    
    const steps = [
      { 
        icon: "📸", 
        color: "#3B82F6", 
        label: "Punten Inladen", 
        desc: "Upload een foto van je rapport. Onze AI herkent automatisch je scores.",
        extra: "Snel, simpel en foutloos."
      },
      { 
        icon: "🧠", 
        color: "#A855F7", 
        label: "Slimme Analyse", 
        desc: "We combineren je cijfers met je inzet en houding in de klas.",
        extra: "Een eerlijk beeld van je voortgang."
      },
      { 
        icon: "🏆", 
        color: "#F59E0B", 
        label: "Attest Voorspelling", 
        desc: "Zie direct welk attest (A, B of C) je op dit moment zou halen.",
        extra: "Ontdek wat je moet doen om te slagen!"
      }
    ];

    return (
      <div style={{
        position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:3000,
        display:"flex", alignItems:"center", justifyContent:"center", padding:20,
        backdropFilter:"blur(10px)"
      }}>
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={{...S.card, width:"100%", maxWidth:400, textAlign: "center", padding: 40, position: "relative"}}
        >
          <button 
            style={{position:"absolute", top:16, right:16, background:"none", border:"none", fontSize:24, cursor:"pointer", color:"#8B6242"}}
            onClick={() => setShowTutorial(false)}
          >✕</button>

          <AnimatePresence mode="wait">
            <motion.div
              key={tutorialStep}
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -50, opacity: 0 }}
              style={{ padding: "20px 0" }}
            >
              <div style={{ 
                fontSize: 80, marginBottom: 20, 
                filter: `drop-shadow(0 10px 20px ${steps[tutorialStep].color}44)` 
              }}>
                {steps[tutorialStep].icon}
              </div>

              <h3 style={{ fontSize: 22, fontWeight: 900, color: "#2D1B00", marginBottom: 12 }}>
                {steps[tutorialStep].label}
              </h3>
              <p style={{ fontSize: 16, color: "#4B5563", fontWeight: 700, marginBottom: 8, lineHeight: 1.4 }}>
                {steps[tutorialStep].desc}
              </p>
              <p style={{ fontSize: 13, color: "#8B6242", fontStyle: "italic", lineHeight: 1.5 }}>
                {steps[tutorialStep].extra}
              </p>
              
              {/* Visual indicators for what's happening */}
              <div style={{ marginTop: 24 }}>
                {tutorialStep === 0 && (
                  <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
                    <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 1.5 }} style={{ fontSize: 32 }}>📄</motion.div>
                    <div style={{ fontSize: 32 }}>➡️</div>
                    <div style={{ fontSize: 32 }}>📱</div>
                  </div>
                )}
                {tutorialStep === 1 && (
                  <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 3, ease: "linear" }} style={{ fontSize: 32 }}>⚙️</motion.div>
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1 }} style={{ fontSize: 32 }}>🧠</motion.div>
                  </div>
                )}
                {tutorialStep === 2 && (
                  <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
                    <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 0.8 }} style={{ fontSize: 32 }}>⭐</motion.div>
                    <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.5 }} style={{ fontSize: 32 }}>📈</motion.div>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 40, marginBottom: 30 }}>
            {steps.map((_, i) => (
              <div 
                key={i} 
                style={{ 
                  width: i === tutorialStep ? 24 : 8, 
                  height: 8, 
                  borderRadius: 4, 
                  background: i === tutorialStep ? OR : ORPL,
                  transition: "all 0.3s"
                }} 
              />
            ))}
          </div>

          <button 
            style={S.btn} 
            onClick={() => {
              if (tutorialStep < steps.length - 1) {
                setTutorialStep(tutorialStep + 1);
              } else {
                setShowTutorial(false);
              }
            }}
          >
            {tutorialStep < steps.length - 1 ? "Volgende ➡️" : "Ik snap het! 🚀"}
          </button>
        </motion.div>
      </div>
    );
  };

  const WelcomeScreen = () => {
    useEffect(() => {
      const hasSeen = sessionStorage.getItem("hasSeenTutorial");
      if (!hasSeen) {
        setShowTutorial(true);
        sessionStorage.setItem("hasSeenTutorial", "true");
      }
    }, []);

    return (
      <div style={{textAlign:"center",paddingTop:60}}>
        <div style={{marginBottom:12}}>
          <SmileyIcon size={80} />
        </div>
        <h1 style={{fontSize:42,fontWeight:900,color:OR,margin:"0 0 10px",letterSpacing:"-1px"}}>RapportRadar</h1>
        <p style={{...S.sub,fontSize:18,marginBottom:40,lineHeight:1.4,fontWeight:800,color:"#2D1B00"}}>
          Welk attest haal jij? <br/>
          <span style={{color:"#8B6242",fontSize:16,fontWeight:500}}>Krijg direct een slimme voorspelling van je schoolresultaten. 🎓</span>
        </p>
        <button style={S.btn} onClick={()=>setScreen("register")}>🌟 Nieuw account aanmaken</button>
        <button style={S.btnSec} onClick={()=>setScreen("login")}>Ik heb al een account</button>
        <button 
          style={{...S.btnSec, marginTop: 20, border: "none", background: "transparent", color: OR, textDecoration: "underline"}} 
          onClick={() => {
            setTutorialStep(0);
            setShowTutorial(true);
          }}
        >
          Hoe werkt het? ❓
        </button>
        <Disclaimer />
      </div>
    );
  };

  // ── 1.5 DASHBOARD (LANDING VOOR INGELOGDE GEBRUIKERS) ────────
  const DashboardScreen = () => {
    const startNieuweAnalyse = () => {
      setVakken([]);
      setGedragAntw({});
      setNederlandsAntw({});
      setScore(null);
      setReportImage(null);
      setScreen("grades");
    };

    return (
      <div style={{paddingTop:10}}>
        <div style={{...S.card, textAlign:"center", padding:30}}>
          <div style={{marginBottom:16}}>
            <SmileyIcon size={80} />
          </div>
          <h1 style={S.h2}>Welkom terug, {currentUser?.naam}!</h1>
          <p style={{...S.sub, fontSize:16, marginBottom:24, fontWeight: 700, color: ORD}}>
            Klaar om te ontdekken welk attest je dit jaar kunt verwachten? 🎓
          </p>
          
          <button style={S.btn} onClick={startNieuweAnalyse}>
            Voorspel mijn Attest <SmileyIcon size={20} style={{marginLeft:8}} />
          </button>
          
          <Disclaimer mini />
        </div>
      </div>
    );
  };

  // ── 2. REGISTREREN ─────────────────────────────────────────
  const RegisterScreen = () => {
    const [naam,     setNaam]     = useState("");
    const [email,    setEmail]    = useState("");
    const [ww,       setWw]       = useState("");
    const [regSchool, setRegSchool] = useState("");
    const [regJaar,   setRegJaar]   = useState("");
    const [regLeeftijd, setRegLeeftijd] = useState("");
    const [regRichting, setRegRichting] = useState("");
    const [consent,  setConsent]  = useState(false);
    const [discl,    setDiscl]    = useState(false);
    const [fout,     setFout]     = useState("");
    const [bezig,    setBezig]    = useState(false);

    const registreer = async () => {
      if (!naam || !email || !ww || !regSchool || !regJaar || !regLeeftijd || !regRichting) { 
        setFout("Vul alle velden in 😊"); return; 
      }
      if (!consent) { setFout("Geef toestemming om gegevens op te slaan"); return; }
      if (!discl)   { setFout("Bevestig dat je begrijpt dat dit een indicatie is"); return; }
      if (ww.length < 6) { setFout("Wachtwoord moet minstens 6 tekens zijn"); return; }
      setBezig(true);
      setAuthError("");
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, ww);
        const userPath = `users/${cred.user.uid}`;
        try {
          await setDoc(doc(db, "users", cred.user.uid), { 
            naam, 
            email,
            school: regSchool,
            jaar: regJaar,
            leeftijd: regLeeftijd,
            richting: regRichting
          });
        } catch (error) {
          console.error("Firestore primary write failed:", error);
          // Try a minimal write if the full one fails
          try {
             await setDoc(doc(db, "users", cred.user.uid), { naam, email });
          } catch (e2) {
             handleFirestoreError(e2, OperationType.WRITE, userPath);
          }
        }
      } catch (e: any) {
        setBezig(false);
        if (e.code === "auth/email-already-in-use") setFout("Dit e-mailadres is al in gebruik!");
        else if (e.code === "auth/invalid-email")   setFout("Ongeldig e-mailadres");
        else handleAuthError(e);
      } finally {
        setTimeout(() => setBezig(false), 5000);
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
          {authError && (
            <div style={{...S.err, background: "#FEF3C7", color: "#92400E", border: "1px solid #FCD34D"}}>
              <p style={{fontWeight: 800, marginBottom: 4}}>⚠️ Belangrijk:</p>
              <p style={{fontSize: 12}}>{authError}</p>
            </div>
          )}
          <label style={S.lbl}>Voornaam</label>
          <input style={S.input} value={naam} onChange={e=>setNaam(e.target.value)} placeholder="Jouw voornaam"/>
          
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10}}>
            <div>
              <label style={S.lbl}>Leeftijd</label>
              <input style={S.input} type="number" value={regLeeftijd} onChange={e=>setRegLeeftijd(e.target.value)} placeholder="Bv. 14"/>
            </div>
            <div>
              <label style={S.lbl}>Jaar & Graad</label>
              <input style={S.input} value={regJaar} onChange={e=>setRegJaar(e.target.value)} placeholder="Bv. 3e jaar, 2e graad"/>
            </div>
          </div>

          <label style={S.lbl}>School</label>
          <input style={S.input} value={regSchool} onChange={e=>setRegSchool(e.target.value)} placeholder="Naam van je school"/>

          <label style={S.lbl}>Studierichting</label>
          <input style={S.input} value={regRichting} onChange={e=>setRegRichting(e.target.value)} placeholder="Bv. Economie-Wiskunde"/>

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
      setAuthError("");
      try {
        await signInWithEmailAndPassword(auth, email, ww);
        // Note: we don't setBezig(false) here because onAuthStateChanged will change the screen
      } catch (e: any) {
        setBezig(false);
        if (e.code === "auth/wrong-password" || e.code === "auth/user-not-found" || e.code === "auth/invalid-credential") {
          setFout("E-mail of wachtwoord klopt niet 🔑");
        } else {
          handleAuthError(e);
        }
      } finally {
        // Fallback: if we are still on this screen after 5 seconds, unlock the button
        setTimeout(() => setBezig(false), 5000);
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
          {authError && (
            <div style={{...S.err, background: "#FEF3C7", color: "#92400E", border: "1px solid #FCD34D"}}>
              <p style={{fontWeight: 800, marginBottom: 4}}>⚠️ Belangrijk:</p>
              <p style={{fontSize: 12}}>{authError}</p>
            </div>
          )}
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

  // ── 5. HOOFDVAKKEN ─────────────────────────────────────────
  const ImportantSubjectsScreen = () => {
    const [lv, setLv] = useState([...vakken]);
    const toggle = (id: string | number) => setLv(lv.map(v=>v.id===id?{...v,isHoofdvak:!v.isHoofdvak}:v));
    const verder = async () => {
      try {
        if (currentUser?.uid) {
          const userData = cleanUserForFirestore({
            ...currentUser,
            school,
            jaar,
            leeftijd,
            richting,
            vakken: lv
          });
          await setDoc(doc(db, "users", currentUser.uid), userData);
          setCurrentUser({ ...currentUser, school, jaar, leeftijd, richting, vakken: lv });
        }
        setVakken(lv); setScreen("behavior");
      } catch (error: any) {
        console.error("Fout bij opslaan belangrijke vakken:", error);
        // We still move forward if it's just a save error
        setVakken(lv); setScreen("behavior");
      }
    };
    return (
      <div>
        <StapBar huidig="important_subjects"/>
        <button style={S.back} onClick={()=>setScreen("grades")}>← Terug</button>
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
          <button style={S.btn} onClick={verder}>Verder → Attitude & Gedrag 😊</button>
          <Disclaimer mini />
        </div>
      </div>
    );
  };

  // ── 6. PUNTEN INVOEREN ─────────────────────────────────────
  const GradesScreen = () => {
    // Initialiseer elevated state bij eerste ingang
    useEffect(() => {
      if (grades_lv.length === 0 && vakken.length > 0) {
        setGrades_lv([...vakken]);
      }
    }, []);

    const lv = grades_lv;
    const setLv = setGrades_lv;
    const nv = grades_nv;
    const setNv = setGrades_nv;
    const ocrMsg = grades_ocrMsg;
    const setOcrMsg = setGrades_ocrMsg;
    const ocrFout = grades_ocrFout;
    const setOcrFout = setGrades_ocrFout;
    const ocrLoading = grades_ocrLoading;
    const setOcrLoading = setGrades_ocrLoading;

    const updateVak = (id: number, field: string, val: string) => setLv(lv.map(v=>v.id===id?{...v,[field]:val}:v));

    const voegToe = () => {
      if (!nv.trim()) return;
      setLv([...lv, { id: Date.now(), naam: nv.trim(), isHoofdvak: false, punt: "", maxPunt: "20" }]);
      setNv("");
    };
    const verwijder = (id: number) => setLv(lv.filter(v => v.id !== id));

    const handleOCR = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (!fileList || fileList.length === 0) return;
      const files = Array.from(fileList);
      
      setOcrLoading(true); setOcrMsg(""); setOcrFout("");
      
      try {
        // 1. Lees alle bestanden naar base64
        const imageParts = await Promise.all(files.map(async (file) => {
          return new Promise<any>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
              const b64 = (ev.target?.result as string).split(",")[1];
              resolve({ inlineData: { mimeType: file.type, data: b64 } });
            };
            reader.onerror = () => reject(new Error(`Kon ${file.name} niet lezen.`));
            reader.readAsDataURL(file);
          });
        }));

        console.log(`OCR: Bezig met analyseren van ${files.length} bestand(en)...`);
        
        const res = await fetch("/api/analyze-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parts: [...imageParts, { text: OCR_PROMPT }], prompt: OCR_PROMPT })
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Fout bij de AI scan");
        }

        const { text } = await res.json();
        if (!text) {
          throw new Error("De AI gaf geen antwoord terug.");
        }

        const extracted = JSON.parse(cleanJSON(text));
        
        if (extracted.length === 0) {
          setOcrFout("Geen vakken of punten gevonden op deze foto's. Probeer een duidelijkere foto van de tabel.");
          return;
        }
        
        const merged = extracted.reduce((acc: any[], curr: any) => {
          const existingIndex = acc.findIndex(a => a.naam.toLowerCase().trim() === curr.naam.toLowerCase().trim());
          if (existingIndex > -1) {
            acc[existingIndex] = curr;
          } else {
            acc.push(curr);
          }
          return acc;
        }, []);

        setLv(prevLv => {
          const updated = prevLv.map(v => {
            const match = merged.find((e: any) =>
              e.naam.toLowerCase().trim().includes(v.naam.toLowerCase().trim()) ||
              v.naam.toLowerCase().trim().includes(e.naam.toLowerCase().trim())
            );
            if (match) {
              const pStr = match.punt.replace(",", ".");
              const p = parseFloat(pStr);
              const m = match.maxPunt || (p > 20 ? "100" : "20");
              return { ...v, punt: pStr || "", maxPunt: m };
            }
            return v;
          });
          const nieuw = merged
            .filter((e: any) => !prevLv.some(v => v.naam.toLowerCase().includes(e.naam.toLowerCase()) || e.naam.toLowerCase().includes(v.naam.toLowerCase())))
            .map((e: any) => {
              const pStr = e.punt.replace(",", ".");
              const p = parseFloat(pStr);
              const m = e.maxPunt || (p > 20 ? "100" : "20");
              return { id: Date.now() + Math.random(), naam: e.naam, isHoofdvak: false, punt: pStr || "", maxPunt: m };
            });
          return [...updated, ...nieuw];
        });

        setOcrMsg(`✅ ${merged.length} vakken hersteld uit ${files.length} foto's!`);
        
        if (imageParts.length > 0) {
          setReportImage(imageParts[imageParts.length - 1].inlineData.data);
        }
      } catch (error: any) {
        console.error("AI OCR Error (Grades):", error);
        setOcrFout("Systeem kon je rapport niet scannen: " + (error.message || "Probeer het later opnieuw."));
      } finally {
        setOcrLoading(false);
        e.target.value = "";
      }
    };

    const verder = async () => {
      try {
        if (currentUser?.uid) {
          const userData = cleanUserForFirestore({
            ...currentUser,
            school,
            jaar,
            leeftijd,
            richting,
            vakken: lv
          });
          await setDoc(doc(db, "users", currentUser.uid), userData);
          setCurrentUser({ ...currentUser, school, jaar, leeftijd, richting, vakken: lv });
        }
        setVakken(lv); setScreen("important_subjects");
      } catch (error: any) {
        console.error("Fout bij opslaan punten:", error);
        setVakken(lv); setScreen("important_subjects");
      }
    };

    return (
      <div>
        <StapBar huidig="grades"/>
        <button style={S.back} onClick={()=>setScreen("dashboard")}>← Terug</button>
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
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleOCR} style={{display:"none"}}/>
            {ocrLoading
              ? <div style={{color:OR,fontWeight:700}}>🔍 Punten worden herkend...</div>
              : <button onClick={()=>fileRef.current?.click()} style={{
                  background:OR,color:"white",border:"none",borderRadius:12,
                  padding:"10px 22px",fontSize:14,fontWeight:700,cursor:"pointer",
                  fontFamily:"inherit",boxShadow:`0 4px 14px ${OR}44`,
                }}>📷 Foto kiezen</button>
            }
            {ocrMsg  && <div style={{...S.ok,  margin:"12px 0 0"}}>{ocrMsg}</div>}
            {ocrFout && (
              <div style={{marginTop:12}}>
                <div style={{...S.err, marginBottom:8}}>{ocrFout}</div>
                <button 
                  onClick={()=>fileRef.current?.click()} 
                  style={{...S.btnSec, padding:"6px 12px", fontSize:12, background:"white", width:"auto", height:"auto"}}
                >
                  🔄 Opnieuw proberen
                </button>
              </div>
            )}
          </div>

          <div style={{display:"flex",gap:8,marginBottom:16}}>
            <input style={{...S.input,margin:0,flex:1}} value={nv}
              onChange={e=>setNv(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&voegToe()}
              placeholder="Vak toevoegen (bv. Frans)"/>
            <button onClick={voegToe} style={{
              background:OR,color:"white",border:"none",borderRadius:12,
              padding:"0 18px",fontSize:22,cursor:"pointer",fontWeight:900,
              boxShadow:`0 4px 12px ${OR}44`,
            }}>+</button>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 60px 60px 40px",gap:6,marginBottom:8}}>
            <span style={{...S.lbl,margin:0}}>Vak</span>
            <span style={{...S.lbl,margin:0,textAlign:"center"}}>Punt</span>
            <span style={{...S.lbl,margin:0,textAlign:"center"}}>Max</span>
            <span></span>
          </div>
          {lv.map(v=>(
            <div key={v.id} style={{display:"grid",gridTemplateColumns:"1fr 60px 60px 40px",gap:6,marginBottom:6,alignItems:"center"}}>
              <div style={{background:v.isHoofdvak?`${OR}1F`:ORBG,borderRadius:10,padding:"10px 12px",fontWeight:700,fontSize:13,color:"#2D1B00",display:"flex",alignItems:"center",gap:5, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                {v.isHoofdvak&&<span>⭐</span>}{v.naam}
              </div>
              <input style={{...S.input,margin:0,textAlign:"center",padding:"10px 4px",fontSize:16}}
                type="number" value={v.punt} onChange={e=>updateVak(v.id,"punt",e.target.value)} placeholder="0" min="0"/>
              <input style={{...S.input,margin:0,textAlign:"center",padding:"10px 4px",fontSize:13,color:"#8B6242"}}
                type="number" value={v.maxPunt} onChange={e=>updateVak(v.id,"maxPunt",e.target.value)} placeholder="20" min="1"/>
              <button onClick={()=>verwijder(v.id)} style={{
                background:"#FEE2E2",color:"#EF4444",border:"none",borderRadius:8,
                height:"100%",cursor:"pointer",fontWeight:700,fontSize:14,
              }}>✕</button>
            </div>
          ))}
          <div style={{fontSize:11,color:"#8B6242",margin:"8px 0 20px",fontStyle:"italic"}}>⭐ = Hoofdvak (telt {CONFIG.hoofdvakMultiplier}× zwaarder mee)</div>
          <button style={S.btn} onClick={verder}>Verder → Belangrijke vakken ⭐</button>
          <Disclaimer mini />
        </div>
      </div>
    );
  };

  // ── 7. GEDRAGSVRAGEN ───────────────────────────────────────
  const BehaviorScreen = () => {
    const [la,   setLa]  = useState({...gedragAntw});
    const [ln,   setLn]  = useState({...nederlandsAntw});
    const [fout, setFout]= useState("");
    const set = (id: number, w: number) => setLa({...la,[id]:w});
    const setNed = (id: string, w: string) => setLn({...ln,[id]:w});

    const verder = async () => {
      if (Object.keys(la).length < CONFIG.gedragsVragen.length) { setFout("Beantwoord alle gedragsvragen! 😊"); return; }
      if (Object.keys(ln).length < CONFIG.nederlandsVragen.length) { setFout("Beantwoord de vragen over je Nederlands! 🇳🇱"); return; }
      
      const s = berekenScore(vakken, la, ln);
      try {
        if (currentUser?.uid) {
          const userData = cleanUserForFirestore({
            ...currentUser,
            school,
            jaar,
            leeftijd,
            richting,
            vakken,
            gedragAntw: la,
            nederlandsAntw: ln,
            score: s
          });
          await setDoc(doc(db, "users", currentUser.uid), userData);
          setCurrentUser({ 
            ...currentUser, 
            school, 
            jaar, 
            leeftijd, 
            richting, 
            vakken, 
            gedragAntw: la, 
            nederlandsAntw: ln, 
            score: s 
          });
        }
        setGedragAntw(la);
        setNederlandsAntw(ln);
        setScore(s);
        setScreen("results");
      } catch (error: any) {
        console.error("Fout bij opslaan gedrag data:", error);
        setGedragAntw(la);
        setNederlandsAntw(ln);
        setScore(s);
        setScreen("results");
      }
    };
    return (
      <div>
        <StapBar huidig="behavior"/>
        <button style={S.back} onClick={()=>setScreen("grades")}>← Terug</button>
        <div style={S.card}>
          <div style={{textAlign:"center",marginBottom:18}}>
            <div style={{fontSize:52}}>😊</div>
            <h2 style={S.h2}>Attitude & Nederlands</h2>
            <p style={S.sub}>Je houding en taalvaardigheid tellen ook mee! Wees eerlijk 😉</p>
          </div>
          {fout && <div style={S.err}>{fout}</div>}
          
          {/* Gedragsvragen */}
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

          {/* Nederlands Niveau */}
          <div style={{marginTop:24, marginBottom:16}}>
            <h3 style={{fontWeight:900, color:ORD, fontSize:16, marginBottom:12, display:"flex", alignItems:"center", gap:8}}>
              <span>🇳🇱</span> Niveau Nederlands
            </h3>
            {CONFIG.nederlandsVragen.map(vraag => (
              <div key={vraag.id} style={{background:"white", border:`2px solid ${ORPL}`, borderRadius:16, padding:16, marginBottom:12}}>
                <p style={{fontWeight:800, fontSize:14, color:"#2D1B00", margin:"0 0 12px"}}>{vraag.emoji} {vraag.vraag}</p>
                <div style={{display:"flex", gap:10}}>
                  {["ja", "nee"].map(opt => (
                    <button key={opt} onClick={() => setNed(vraag.id, opt)} style={{
                      flex:1, padding:"10px",
                      background: ln[vraag.id] === opt ? (opt === "ja" ? "#22C55E" : "#EF4444") : "white",
                      color: ln[vraag.id] === opt ? "white" : "#4B5563",
                      border: `2px solid ${ln[vraag.id] === opt ? (opt === "ja" ? "#22C55E" : "#EF4444") : "#E5E7EB"}`,
                      borderRadius:12, cursor:"pointer", fontFamily:"inherit", fontWeight:800,
                      textTransform:"uppercase", fontSize:13, transition:"all .2s"
                    }}>
                      {opt === "ja" ? "✅ Ja" : "❌ Nee"}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{background:"#FEF3C7",borderRadius:12,padding:"12px 14px",marginBottom:20,fontSize:13,color:"#92400E"}}>
            💡 Gedrag telt voor <strong>{Math.round(CONFIG.gedragGewicht*100)}%</strong> mee. Je Nederlands kan je score met <strong>3%</strong> verhogen of verlagen.
          </div>
          <button style={S.btn} onClick={verder}>🎯 Bekijk mijn resultaat!</button>
          <Disclaimer mini />
        </div>
      </div>
    );
  };

  // ── 8. RESULTATEN + SPEEDOMETER ───────────────────────────
  const ResultsScreen = () => {
    const [anim, setAnim] = useState(0);
    const attest = getAttest(score||0);
    const achievedLabel = (attest.label === "Attest A" ? "A" : (attest.label === "Attest B" ? "B" : "C")) as "A" | "B" | "C";
    const [openedAttest, setOpenedAttest] = useState<"A" | "B" | "C">(achievedLabel);

    useEffect(() => {
      setOpenedAttest(achievedLabel);
    }, [achievedLabel]);

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
      const color = val >= CONFIG.attestA_drempel ? "#22C55E" : val >= CONFIG.attestB_drempel ? "#F59E0B" : "#EF4444";
      const isGod = val >= 96;
      
      return (
        <div style={{ marginBottom: 24, padding: "0 10px" }}>
          <div style={{ position: "relative", height: 16, marginBottom: 6 }}>
            <span style={{ position: "absolute", left: `${CONFIG.attestB_drempel / 2}%`, transform: "translateX(-50%)", fontSize: 9, fontWeight: 900, color: "#8B6242", textTransform: "uppercase" }}>C-Attest</span>
            <span style={{ position: "absolute", left: `${(CONFIG.attestB_drempel + CONFIG.attestA_drempel) / 2}%`, transform: "translateX(-50%)", fontSize: 9, fontWeight: 900, color: "#8B6242", textTransform: "uppercase" }}>B-Attest</span>
            <span style={{ position: "absolute", left: `${(CONFIG.attestA_drempel + 100) / 2}%`, transform: "translateX(-50%)", fontSize: 9, fontWeight: 900, color: "#8B6242", textTransform: "uppercase" }}>A-Attest</span>
          </div>
          <div style={{ 
            height: 12, 
            background: "#E2E8F0", 
            borderRadius: 100, 
            overflow: "hidden", 
            position: "relative",
            boxShadow: "inset 0 2px 4px rgba(0,0,0,0.1)",
            border: isGod ? "2px solid #FFD700" : "none"
          }}>
            {/* Markers at thresholds */}
            <div style={{ position: "absolute", left: `${CONFIG.attestB_drempel}%`, top: 0, bottom: 0, width: 2, background: "rgba(255,255,255,0.6)", zIndex: 1 }} />
            <div style={{ position: "absolute", left: `${CONFIG.attestA_drempel}%`, top: 0, bottom: 0, width: 2, background: "rgba(255,255,255,0.6)", zIndex: 1 }} />
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${val}%` }}
              transition={{ type: "spring", stiffness: 50, damping: 15 }}
              style={{ 
                height: "100%", 
                background: isGod 
                  ? "linear-gradient(90deg, #F59E0B, #FFD700, #F59E0B)" 
                  : `linear-gradient(90deg, ${color}CC, ${color})`,
                borderRadius: 100,
                boxShadow: isGod ? "0 0 15px #FFD700" : `0 0 10px ${color}66`
              }} 
            />
          </div>
          <div style={{ textAlign: "center", marginTop: 8, fontSize: 12, fontWeight: 900, color: isGod ? "#F59E0B" : color, textTransform: "uppercase", letterSpacing: 1 }}>
            Progressie: {val}% - {getAttest(val).label}
          </div>
        </div>
      );
    };

    const CharacterAnimation = ({ val }: { val: number }) => {
      const getMascotState = (p: number) => {
        if (p < 10) return { label: "Totaal verslagen...", color: "#4B5563", mood: "angry", body: "#4B5563", belly: "#374151", god: false };
        if (p < 30) return { label: "Zwaar gewond!", color: "#EF4444", mood: "angry", body: "#EF4444", belly: "#FEE2E2", god: false };
        if (p < CONFIG.attestB_drempel) return { label: "De weg is lang...", color: "#F59E0B", mood: "sad", body: "#F59E0B", belly: "#FEF3C7", god: false };
        if (p < CONFIG.attestA_drempel) return { label: "Klaar voor de strijd", color: "#10B981", mood: "neutral", body: "#10B981", belly: "#D1FAE5", god: false };
        if (p < 85) return { label: "Echte heldenkracht!", color: "#3B82F6", mood: "happy", body: "#3B82F6", belly: "#DBEAFE", god: false };
        if (p < 96) return { label: "Legendarische status", color: "#8B5CF6", mood: "happy", body: "#8B5CF6", belly: "#EDE9FE", god: false };
        return { label: "GOD MODUS BEREIKT", color: "#F59E0B", mood: "god", body: "#FFD700", belly: "#FFF7ED", god: true };
      };

      const state = getMascotState(val);

      // High-quality Radar Gauge Component (Clean version)
      const RadarGauge = () => {
        const radius = 80;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (val / 100) * circumference;

        return (
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
            <svg viewBox="0 0 200 200" className="w-full h-full max-w-[280px] relative z-10">
              <defs>
                <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={state.color} stopOpacity="0.2" />
                  <stop offset="100%" stopColor={state.color} />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Background Circle */}
              <circle
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                stroke="rgba(0,0,0,0.05)"
                strokeWidth="12"
              />

              {/* Progress Arc */}
              <motion.circle
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                stroke="url(#gaugeGrad)"
                strokeWidth="12"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: offset }}
                transition={{ type: "spring", stiffness: 50, damping: 15 }}
                strokeLinecap="round"
                transform="rotate(-90 100 100)"
                filter="url(#glow)"
              />

              {/* Center Display */}
              <motion.g
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <motion.circle 
                  cx="100" 
                  cy="100" 
                  r="50" 
                  fill="white" 
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                />
                <text
                  x="100"
                  y="95"
                  textAnchor="middle"
                  className="font-black"
                  style={{ fontSize: 28, fill: state.color }}
                >
                  {val}%
                </text>
                <text
                  x="100"
                  y="115"
                  textAnchor="middle"
                  className="font-bold uppercase tracking-widest"
                  style={{ fontSize: 8, fill: "#64748B" }}
                >
                  Score
                </text>
              </motion.g>
            </svg>
          </div>
        );
      };

      return (
        <div style={{ 
          height: 380, 
          width: "100%",
          background: "radial-gradient(circle at center, #F8FAFC 0%, #E2E8F0 100%)",
          borderRadius: 32,
          marginBottom: 24,
          position: "relative",
          overflow: "hidden",
          border: "1px solid #CBD5E1",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}>
          <div style={{ width: "100%", height: "100%", position: "relative", zIndex: 1 }}>
            <RadarGauge />
          </div>

          <div style={{ 
            position: "absolute", 
            bottom: 24, 
            left: 0, 
            right: 0, 
            textAlign: "center",
            pointerEvents: "none"
          }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={state.label}
                initial={{ y: 20, opacity: 0, scale: 0.8 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: -20, opacity: 0, scale: 0.8 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                style={{ 
                  fontSize: 24, 
                  fontWeight: 900, 
                  color: state.color, 
                  textTransform: "uppercase",
                  letterSpacing: 4,
                }}
              >
                {state.label}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      );
    };

    const getStaticFeedbackPoints = () => {
      const points: Array<{ icon: string; title: string; text: string }> = [];
      const scoreNum = score !== null ? score : anim;
      
      // 1. Overall Score & Threshold Feedback
      if (scoreNum > 0) {
        if (scoreNum >= CONFIG.attestA_drempel) {
          const excess = Math.round(scoreNum - CONFIG.attestA_drempel);
          points.push({
            icon: "🚀",
            title: "Super op koers!",
            text: `Je zit ${excess > 0 ? `${excess}% ` : ""}boven de A-drempel (${CONFIG.attestA_drempel}%). Blijf knallen!`
          });
        } else if (scoreNum >= CONFIG.attestB_drempel) {
          const gapToA = Math.round(CONFIG.attestA_drempel - scoreNum);
          points.push({
            icon: "📈",
            title: "Sprint naar A!",
            text: `Nog maar ${gapToA}% extra nodig voor een A-Attest. Dat haal je zo met een kleine eindsprint!`
          });
        } else {
          const gapToB = Math.round(CONFIG.attestB_drempel - scoreNum);
          points.push({
            icon: "🔥",
            title: "Herpakken & vlammen!",
            text: `Nog ${gapToB}% extra en je heft de drempel van herhaling op voor een B-Attest (${CONFIG.attestB_drempel}%). Elk punt telt!`
          });
        }
      }

      // 2. Grades Analysis (Fails & Strengths)
      const validVakken = vakken.filter(v => v.punt !== "" && !isNaN(parseFloat(v.punt)));
      const fails = validVakken.filter(v => {
        const pVal = parseFloat(v.punt);
        const maxVal = parseFloat(v.maxPunt) || 100;
        return (pVal / maxVal) < 0.5;
      });
      const toppers = validVakken.filter(v => {
        const pVal = parseFloat(v.punt);
        const maxVal = parseFloat(v.maxPunt) || 100;
        return (pVal / maxVal) >= 0.75;
      });

      if (toppers.length > 0) {
        const firstTopper = toppers[0];
        points.push({
          icon: "⭐",
          title: "Blikvanger!",
          text: `Je blinkt echt uit in ${firstTopper.naam}! Neem diezelfde motivatie mee naar de rest.`
        });
      }

      if (fails.length > 0) {
        const names = fails.map(v => v.naam).slice(0, 2).join(" & ");
        const hasHoofdvakFail = fails.some(v => v.isHoofdvak);
        points.push({
          icon: "⚠️",
          title: "Snelste winst:",
          text: `Geef ${names} wat extra liefde. ${hasHoofdvakFail ? "Dit zijn hoofdvakken, die wegen zwaar door!" : "Even focussen op deze en je gemiddelde vliegt omhoog."}`
        });
      }

      // 3. Attitude & Behavior Feedback
      const lowAttitudes = CONFIG.gedragsVragen.filter(q => gedragAntw[q.id] !== undefined && gedragAntw[q.id] <= 3);
      if (lowAttitudes.length > 0) {
        const firstLow = lowAttitudes[0];
        const lowTips: Record<number, string> = {
          1: "Probeer stipter de les in te stappen. Op tijd komen is écht de makkelijkste goodwill ever! ⏰",
          2: "Vergeet geen huistaken meer in te dienen. Leerkrachten haten 'niet ingediend' op de klassenraad! 📚",
          3: "Toon inzet en doe lekker actief mee in de klas. Positieve vibes smeren de raderen! 😊",
          4: "Sta open voor feedback en ga constructief met kritiek om. Dat toont echte volwassenheid. 🤝",
          5: "Zorg dat je zo vaak mogelijk op school bent. Minder afwezigheid = minder inhaalstress! 🏫",
          6: "Oortjes uit en focus op de leerkracht. Dat scheelt letterlijk de helft van je studiewerk thuis! 👂"
        };
        points.push({
          icon: "🤝",
          title: "Super-tip attitude:",
          text: lowTips[firstLow.id] || "Toon dat je wilt leren en meewerkt, leerkrachten onthouden dat!"
        });
      } else if (CONFIG.gedragsVragen.length > 0) {
        points.push({
          icon: "✨",
          title: "Goud waard!",
          text: "Je attitude en inzet in de klas zijn voorbeeldig. Jouw leerkrachten dragen je op handen!"
        });
      }

      return points;
    };

    return (
      <div>
        <StapBar huidig="results"/>
        <div style={S.card}>
          <div style={{textAlign:"center",marginBottom:16}}>
            <h2 style={S.h2}>Jouw Resultaat</h2>
          </div>
          
          <Speedo val={anim}/>
          <CharacterAnimation val={anim}/>

          {/* THREE ATTESTS ACCORDION */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 900, color: "#2D1B00", textAlign: "left", marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
              <span>🔮</span> Hoe beïnvloed je jouw attest?
            </h3>
            
            {/* ATTEST A CARD */}
            <motion.div
              layout
              onClick={() => setOpenedAttest("A")}
              style={{
                cursor: "pointer",
                background: openedAttest === "A" ? "#F0FDF4" : "#F8FAFC",
                border: `2px solid ${openedAttest === "A" ? "#22C55E" : achievedLabel === "A" ? "#22C55E55" : "#E2E8F0"}`,
                borderRadius: 20,
                padding: "16px 20px",
                textAlign: "left",
                transition: "background 0.2s, border 0.2s",
                boxShadow: achievedLabel === "A" ? "0 4px 12px rgba(34, 197, 94, 0.08)" : "none",
                position: "relative"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 24 }}>🏆</span>
                  <div>
                    <span style={{ fontSize: 16, fontWeight: 900, color: "#166534" }}>Attest A</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#15803D", background: "#DCFCE7", padding: "2px 8px", borderRadius: 100, marginLeft: 8 }}>
                      Alles oké - overgaan!
                    </span>
                  </div>
                </div>
                {achievedLabel === "A" ? (
                  <span style={{ fontSize: 10, fontWeight: 900, color: "white", background: "#22C55E", padding: "4px 8px", borderRadius: 8, letterSpacing: 0.5 }}>
                    JOUW STATUS ✅
                  </span>
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#64748B", background: "#F1F5F9", padding: "3px 8px", borderRadius: 6 }}>
                    {openedAttest === "A" ? "Geopend 👇" : "Klik voor info 🔍"}
                  </span>
                )}
              </div>

              {openedAttest === "A" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  style={{ marginTop: 16, borderTop: "1px solid #DCFCE7", paddingTop: 14 }}
                >
                  {achievedLabel === "A" && (
                    <div style={{ background: "#FFFFFF", borderRadius: 12, padding: 12, border: "1.5px solid #22C55E3D", marginBottom: 12 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#14532D", fontStyle: "italic", lineHeight: 1.5 }}>
                        💬 <strong>Van leerling tot leerling:</strong> "Lekker bezig, je jaar is zo goed als binnen! 🥳 Blijf wel gewoon je taken indienen en kom op tijd om die voorsprong niet kwijt te spelen."
                      </p>
                    </div>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 4px" }}>
                    <div style={{ fontSize: 12, color: "#15803D" }}>
                      🎯 <strong>Wat is nodig?</strong> Gemiddelde van minstens <strong>{CONFIG.attestA_drempel}%</strong> en geen zware buizen op hoofdvakken.
                    </div>
                    <div style={{ fontSize: 12, color: "#15803D" }}>
                      ⚠️ <strong>Grootste valkuil:</strong> Stoppen met huistaken te maken. \"Niet ingediend\" op de klassenraad is de snelste weg naar problemen!
                    </div>
                    {achievedLabel === "A" && (
                      <div style={{ fontSize: 12, color: "#15803D", fontWeight: 800, marginTop: 4 }}>
                        🔑 <strong>Takeaway:</strong> Trek die eindsprint aan en houd deze mooie voorsprong vast.
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </motion.div>

            {/* ATTEST B CARD */}
            <motion.div
              layout
              onClick={() => setOpenedAttest("B")}
              style={{
                cursor: "pointer",
                background: openedAttest === "B" ? "#FFFBEB" : "#F8FAFC",
                border: `2px solid ${openedAttest === "B" ? "#F59E0B" : achievedLabel === "B" ? "#F59E0B55" : "#E2E8F0"}`,
                borderRadius: 20,
                padding: "16px 20px",
                textAlign: "left",
                transition: "background 0.2s, border 0.2s",
                boxShadow: achievedLabel === "B" ? "0 4px 12px rgba(245, 158, 11, 0.08)" : "none",
                position: "relative"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 24 }}>📋</span>
                  <div>
                    <span style={{ fontSize: 16, fontWeight: 900, color: "#92400E" }}>Attest B</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#B45309", background: "#FEF3C7", padding: "2px 8px", borderRadius: 100, marginLeft: 8 }}>
                      Overgaan met beperkingen
                    </span>
                  </div>
                </div>
                {achievedLabel === "B" ? (
                  <span style={{ fontSize: 10, fontWeight: 900, color: "white", background: "#F59E0B", padding: "4px 8px", borderRadius: 8, letterSpacing: 0.5 }}>
                    JOUW STATUS ✅
                  </span>
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#64748B", background: "#F1F5F9", padding: "3px 8px", borderRadius: 6 }}>
                    {openedAttest === "B" ? "Geopend 👇" : "Klik voor info 🔍"}
                  </span>
                )}
              </div>

              {openedAttest === "B" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  style={{ marginTop: 16, borderTop: "1px solid #FEF3C7", paddingTop: 14 }}
                >
                  {achievedLabel === "B" && (
                    <div style={{ background: "#FFFFFF", borderRadius: 12, padding: 12, border: "1.5px solid #F59E0B3D", marginBottom: 12 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#78350F", fontStyle: "italic", lineHeight: 1.5 }}>
                        💬 <strong>Van leerling tot leerling:</strong> "Geen ramp, je mag over! 🚦 Maar let wel op: sommige richtingen blijven gesloten. Toon nu wat extra motivatie om de klassenraad gunstig te stemmen."
                      </p>
                    </div>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 4px" }}>
                    <div style={{ fontSize: 12, color: "#B45309" }}>
                      📈 <strong>Wanneer krijg je dit?</strong> Jouw score ligt tussen <strong>{CONFIG.attestB_drempel}%</strong> and <strong>{CONFIG.attestA_drempel}%</strong>, of je hebt buizen op kernvakken.
                    </div>
                    <div style={{ fontSize: 12, color: "#B45309" }}>
                      ⚠️ <strong>Wat te vermijden?</strong> Toon geen onverschilligheid. De leerkrachten bepalen mee welke richtingen je niet mag doen, dus een fijne houding is goud waard!
                    </div>
                    {achievedLabel === "B" && (
                      <div style={{ fontSize: 12, color: "#B45309", fontWeight: 800, marginTop: 4 }}>
                        🔑 <strong>Takeaway:</strong> Praat eens kort met je vakleerkrachten over hoe je kunt groeien. Dat maakt echt indruk!
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </motion.div>

            {/* ATTEST C CARD */}
            <motion.div
              layout
              onClick={() => setOpenedAttest("C")}
              style={{
                cursor: "pointer",
                background: openedAttest === "C" ? "#FEF2F2" : "#F8FAFC",
                border: `2px solid ${openedAttest === "C" ? "#EF4444" : achievedLabel === "C" ? "#EF444455" : "#E2E8F0"}`,
                borderRadius: 20,
                padding: "16px 20px",
                textAlign: "left",
                transition: "background 0.2s, border 0.2s",
                boxShadow: achievedLabel === "C" ? "0 4px 12px rgba(239, 68, 68, 0.08)" : "none",
                position: "relative"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 24 }}>📌</span>
                  <div>
                    <span style={{ fontSize: 16, fontWeight: 900, color: "#991B1B" }}>Attest C</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#B91C1C", background: "#FEE2E2", padding: "2px 8px", borderRadius: 100, marginLeft: 8 }}>
                      Jaar overdoen / niet geslaagd
                    </span>
                  </div>
                </div>
                {achievedLabel === "C" ? (
                  <span style={{ fontSize: 10, fontWeight: 900, color: "white", background: "#EF4444", padding: "4px 8px", borderRadius: 8, letterSpacing: 0.5 }}>
                    JOUW STATUS ✅
                  </span>
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#64748B", background: "#F1F5F9", padding: "3px 8px", borderRadius: 6 }}>
                    {openedAttest === "C" ? "Geopend 👇" : "Klik voor info 🔍"}
                  </span>
                )}
              </div>

              {openedAttest === "C" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  style={{ marginTop: 16, borderTop: "1px solid #FEE2E2", paddingTop: 14 }}
                >
                  {achievedLabel === "C" && (
                    <div style={{ background: "#FFFFFF", borderRadius: 12, padding: 12, border: "1.5px solid #EF44443D", marginBottom: 12 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#7F1D1D", fontStyle: "italic", lineHeight: 1.5 }}>
                        💬 <strong>Van leerling tot leerling:</strong> "Dit voelt superzuur, maar laat je koppie niet hangen! 💪 Tip: lever nú nog je openstaande taken in en herpak je attitude. De klassenraad houdt écht rekening met reuzenstappen op het eind!"
                      </p>
                    </div>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 4px" }}>
                    <div style={{ fontSize: 12, color: "#B91C1C" }}>
                      🚨 <strong>Waarom gebeurt dit?</strong> Je gemiddelde zit onder <strong>{CONFIG.attestB_drempel}%</strong> of je hebt te veel zware buizen liggen.
                    </div>
                    <div style={{ fontSize: 12, color: "#B91C1C" }}>
                      ⚠️ <strong>Wat te vermijden?</strong> In stilte opgeven en niks laten horen. Vraag om hulp, dat toont dat je wilt vechten voor je plek!
                    </div>
                    {achievedLabel === "C" && (
                      <div style={{ fontSize: 12, color: "#B91C1C", fontWeight: 800, marginTop: 4 }}>
                        🔑 <strong>Takeaway:</strong> Start vandaag. Een ijzersterke eindsprint dwingt altijd respect af op de klassenraad.
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </motion.div>
          </div>

          {/* ALWAYS VISIBLE DYNAMIC FEEDBACK BOX MATCHING THEIR TRUE ATTEST */}
          <div style={{
            background: achievedLabel === "A" ? "#F0FDF4" : achievedLabel === "B" ? "#FFFBEB" : "#FEF2F2",
            border: `2px solid ${achievedLabel === "A" ? "#22C55E" : achievedLabel === "B" ? "#F59E0B" : "#EF4444"}`,
            borderRadius: 24,
            padding: 20,
            marginBottom: 20,
            textAlign: "left",
            boxShadow: `0 4px 14px ${achievedLabel === "A" ? "#22C55E15" : achievedLabel === "B" ? "#F59E0B15" : "#EF444415"}`
          }}>
            <h3 style={{
              fontSize: 15,
              fontWeight: 900,
              color: achievedLabel === "A" ? "#14532D" : achievedLabel === "B" ? "#78350F" : "#7F1D1D",
              marginBottom: 12,
              display: "flex",
              alignItems: "center",
              gap: 8
            }}>
              <span>⚡</span> Jouw gepersonaliseerde tips & feedback (op basis van {score}%):
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {getStaticFeedbackPoints().map((pt, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 18, marginTop: 1 }}>{pt.icon}</span>
                  <div>
                    <div style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: achievedLabel === "A" ? "#166534" : achievedLabel === "B" ? "#92400E" : "#991B1B"
                    }}>{pt.title}</div>
                    <div style={{
                      fontSize: 12,
                      color: achievedLabel === "A" ? "#14532D" : achievedLabel === "B" ? "#78350F" : "#7F1D1D",
                      lineHeight: 1.4,
                      marginTop: 2
                    }}>{pt.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button style={{ ...S.btn, marginBottom: 12 }} onClick={()=>setScreen("breakdown")}>🔍 Bekijk gedetailleerde berekening</button>
          <Disclaimer />
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10, marginTop:10}}>
            <button style={S.btnSec} onClick={()=>setScreen("grades")}>
              ⚙️ Punten aanpassen
            </button>
            <button style={S.btnSec} onClick={()=>{
              setVakken([]);
              setGedragAntw({});
              setNederlandsAntw({});
              setScore(null);
              setReportImage(null);
              setScreen("grades");
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
    setGedragAntw({}); setNederlandsAntw({}); setScore(null); setReportImage(null);
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
      <SettingsModal/>
      <ProfileCard/>
      <TutorialModal/>

      <div style={S.wrap} key={screen} className="animate-in">
        {!geenHeader.includes(screen) && currentUser && (
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
            <div style={{fontWeight:900,color:OR,fontSize:16,display:"flex",alignItems:"center",gap:6}}>
              <SmileyIcon size={24} /> RapportRadar
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",justifyContent:"flex-end"}}>
              <button 
                onClick={() => setShowSettings(true)}
                style={{
                  background:ORBG, border:`1px solid ${ORPL}`, borderRadius:10,
                  padding:"5px 8px", fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", gap:4
                }}
                title="Instellingen"
              >⚙️</button>
              <button 
                onClick={() => setShowProfile(true)}
                style={{
                  background:ORBG, border:`1px solid ${ORPL}`, borderRadius:20, 
                  padding:"5px 12px", fontSize:12, fontWeight:800, color:ORD, cursor:"pointer",
                  display: "flex", alignItems: "center", gap: 6
                }}
              >
                <span>👋 {currentUser.naam}</span>
              </button>
              <button onClick={handleLogout} style={{
                background:"none",border:`1.5px solid #E5E7EB`,borderRadius:10,
                color:"#8B6242",fontSize:11,fontWeight:700,cursor:"pointer",padding:"5px 8px",fontFamily:"inherit",
              }}>Uitloggen</button>
            </div>
          </div>
        )}
        {screen==="loading"            && <LoadingScreen/>}
        {screen==="welcome"            && <WelcomeScreen/>}
        {screen==="dashboard"          && <DashboardScreen/>}
        {screen==="register"           && <RegisterScreen/>}
        {screen==="login"              && <LoginScreen/>}
        {screen==="important_subjects" && <ImportantSubjectsScreen/>}
        {screen==="grades"             && <GradesScreen />}
        {screen==="behavior"           && <BehaviorScreen/>}
        {screen==="results"            && <ResultsScreen/>}
        {screen==="breakdown"          && <BreakdownScreen/>}
      </div>

      <FeedbackModal />
      <SettingsModal />
      <ProfileCard />

      {/* Subtle floating feedback button */}
      {currentUser && (
        <motion.div
          initial="initial"
          whileHover="hover"
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer"
          }}
          onClick={() => setShowFeedback(true)}
        >
          <motion.div
            variants={{
              initial: { opacity: 0, x: 10, scale: 0.8 },
              hover: { opacity: 1, x: 0, scale: 1 }
            }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            style={{
              background: "white",
              padding: "6px 14px",
              borderRadius: 14,
              fontSize: 13,
              fontWeight: 900,
              color: OR,
              boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
              border: `1.5px solid ${ORPL}`,
              whiteSpace: "nowrap"
            }}
          >
            Feedback geven?
          </motion.div>
          <motion.button
            variants={{
              initial: { scale: 1 },
              hover: { scale: 1.1, rotate: 5 }
            }}
            whileTap={{ scale: 0.9 }}
            style={{
              width: 54,
              height: 54,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${OR}, ${ORL})`,
              color: "white",
              border: "none",
              fontSize: 26,
              cursor: "pointer",
              boxShadow: `0 8px 24px ${OR}44`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            💡
          </motion.button>
        </motion.div>
      )}
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
