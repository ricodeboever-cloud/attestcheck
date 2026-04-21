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
import { GoogleGenAI, Type } from "@google/genai";
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
  ],
  BADGES: [
    { id: "first_step", name: "Eerste Stap 👣", description: "Voltooi je eerste focus punt.", requirement: (user: any) => (user.focusPoints?.filter((p: any) => p.completed).length || 0) >= 1 },
    { id: "focus_fan", name: "Focus Fanaat 🎯", description: "Voltooi 5 focus punten.", requirement: (user: any) => (user.focusPoints?.filter((p: any) => p.completed).length || 0) >= 5 },
    { id: "consistency", name: "Consistentie Koning 👑", description: "Voltooi 10 focus punten.", requirement: (user: any) => (user.focusPoints?.filter((p: any) => p.completed).length || 0) >= 10 },
    { id: "veteran", name: "Rapport Radar Veteraan 🎖️", description: "Sla 3 verschillende scores op.", requirement: (user: any, progression: any[]) => progression.length >= 3 },
    { id: "rising_star", name: "Stijgende Lijn 📈", description: "Heb een stijgende trend in je progressie.", requirement: (user: any, progression: any[]) => {
      if (progression.length < 2) return false;
      return progression[progression.length - 1].score > progression[0].score;
    }},
    { id: "expert_rank", name: "Elite Student 🎓", description: "Bereik de rang 'Expert'.", requirement: (user: any) => (user.xp || 0) >= 600 },
  ]
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
  const [nederlandsAntw, setNederlandsAntw] = useState<any>({});
  const [score,         setScore]        = useState<number | null>(null);
  const [fbData,        setFbData]       = useState<FeedbackData | null>(null);
  const [selectedAttest, setSelectedAttest] = useState<"A" | "B" | "C" | null>(null);
  const [fbLoad,        setFbLoad]       = useState(false);
  const [fbError,       setFbError]      = useState("");
  const [reportImage,   setReportImage]  = useState<string | null>(null);
  const [hasApiKey,     setHasApiKey]    = useState(true);
  const [showFeedback,  setShowFeedback] = useState(false);
  const [feedbackMsg,   setFeedbackMsg]  = useState("");
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [showSettings,   setShowSettings]  = useState(false);
  const [progression,    setProgression]   = useState<any[]>([]);
  const [progressionLoading, setProgressionLoading] = useState(false);
  const [saveSuccess,    setSaveSuccess]   = useState(false);
  const [newBadge,       setNewBadge]      = useState<any>(null);

  // ── 9. PROGRESSIE LOGICA ──────────────────────────────
  const generateNewFocusPoint = async (updatedUser: any) => {
    try {
      const apiKey = getApiKey();
      if (!apiKey) return;
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Je bent een schoolcoach. De student heeft net een focusdoel voltooid.
      Genereer ÉÉN nieuw, concreet en haalbaar focusdoel (max 10 woorden) voor deze student.
      Huidige vakken: ${updatedUser.vakken?.map((v: any) => v.naam).join(", ")}
      Huidige score: ${updatedUser.score}%
      Geef alleen de tekst van het doel terug, niks anders.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      const newText = response.text?.trim() || "Blijf gefocust op je doelen!";
      const newPoint = {
        id: Date.now().toString(),
        text: newText,
        completed: false,
        xpValue: 50,
        createdAt: new Date().toISOString()
      };

      const finalPoints = [...(updatedUser.focusPoints || []), newPoint];
      await setDoc(doc(db, "users", updatedUser.uid), {
        ...updatedUser,
        focusPoints: finalPoints
      });
      setCurrentUser({ ...updatedUser, focusPoints: finalPoints });
    } catch (error) {
      console.error("Error generating new focus point:", error);
    }
  };

  const generateNewBadge = async (updatedUser: any, earnedBadgeId: string) => {
    try {
      const apiKey = getApiKey();
      if (!apiKey) return;
      const ai = new GoogleGenAI({ apiKey });
      
      const earnedBadge = CONFIG.BADGES.find(b => b.id === earnedBadgeId) || 
                         (updatedUser.customBadges || []).find((b: any) => b.id === earnedBadgeId);
      
      if (!earnedBadge) return;

      const prompt = `Je bent een gamification expert. De student heeft de badge "${earnedBadge.name}" behaald (${earnedBadge.description}).
      Bedenk ÉÉN nieuwe, uitdagendere badge (naam + beschrijving + vereiste in tekst) die hierop volgt.
      Geef dit terug in JSON formaat met velden: name, description, requirementText.
      De requirementText moet een simpele voorwaarde zijn (bijv. "Voltooi 15 focus punten").`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const data = JSON.parse(response.text || "{}");
      if (!data.name) return;

      const newBadge = {
        id: `custom_${Date.now()}`,
        name: data.name,
        description: data.description,
        requirementText: data.requirementText,
        // We'll use a generic requirement for custom badges for now, 
        // or try to parse the requirementText if we want to be fancy.
        // For simplicity, let's say custom badges are earned by completing more focus points.
        requirement: (user: any) => (user.focusPoints?.filter((p: any) => p.completed).length || 0) >= ((user.focusPoints?.filter((p: any) => p.completed).length || 0) + 5)
      };

      const customBadges = [...(updatedUser.customBadges || []), newBadge];
      await setDoc(doc(db, "users", updatedUser.uid), {
        ...updatedUser,
        customBadges: customBadges
      });
      setCurrentUser({ ...updatedUser, customBadges: customBadges });
    } catch (error) {
      console.error("Error generating new badge:", error);
    }
  };

  const checkBadges = async (updatedUser: any, currentProgression: any[]) => {
    const earnedBadges = updatedUser.badges || [];
    const newlyEarned = [];
    const allAvailableBadges = [...CONFIG.BADGES, ...(updatedUser.customBadges || [])];

    for (const badge of allAvailableBadges) {
      if (!earnedBadges.includes(badge.id)) {
        // For custom badges, we might need to handle requirements differently if they are text-based
        // but for now we use the function if it exists.
        if (typeof badge.requirement === 'function' && badge.requirement(updatedUser, currentProgression)) {
          newlyEarned.push(badge.id);
        }
      }
    }

    if (newlyEarned.length > 0) {
      const allEarned = [...earnedBadges, ...newlyEarned];
      try {
        const userToUpdate = { ...updatedUser, badges: allEarned };
        await setDoc(doc(db, "users", updatedUser.uid), userToUpdate);
        setCurrentUser(userToUpdate);
        
        // Show notification for the first new badge
        const badgeInfo = allAvailableBadges.find(b => b.id === newlyEarned[0]);
        setNewBadge(badgeInfo);
        setTimeout(() => setNewBadge(null), 5000);

        // Generate a new badge challenge for each earned badge
        for (const bId of newlyEarned) {
          generateNewBadge(userToUpdate, bId);
        }
      } catch (error) {
        console.error("Error saving badges:", error);
      }
    }
  };

  const fetchProgression = async () => {
    if (!currentUser) return;
    setProgressionLoading(true);
    try {
      const path = `users/${currentUser.uid}/progression`;
      const { getDocs, query, orderBy } = await import("firebase/firestore");
      const q = query(collection(db, path), orderBy("date", "asc"));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProgression(data);
    } catch (error) {
      console.error("Error fetching progression:", error);
    } finally {
      setProgressionLoading(false);
    }
  };

  const saveTodayScore = async () => {
    if (!currentUser || score === null) return;
    const today = new Date().toISOString().split('T')[0];
    try {
      const path = `users/${currentUser.uid}/progression`;
      await setDoc(doc(db, path, today), {
        userId: currentUser.uid,
        score: score,
        date: today,
        timestamp: serverTimestamp()
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      const { getDocs, query, orderBy } = await import("firebase/firestore");
      const q = query(collection(db, path), orderBy("date", "asc"));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProgression(data);
      checkBadges(currentUser, data);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${currentUser.uid}/progression/${today}`);
    }
  };

  const deleteProgressionPoint = async (date: string) => {
    if (!currentUser) return;
    if (!window.confirm(`Weet je zeker dat je de meting van ${date} wilt verwijderen?`)) return;
    try {
      const { deleteDoc } = await import("firebase/firestore");
      await deleteDoc(doc(db, `users/${currentUser.uid}/progression`, date));
      fetchProgression();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${currentUser.uid}/progression/${date}`);
    }
  };

  const RANKS = [
    { min: 0, name: "Starter 🔰", color: "#94A3B8" },
    { min: 100, name: "Groeier 🌱", color: "#22C55E" },
    { min: 300, name: "Strijder 💪", color: "#3B82F6" },
    { min: 600, name: "Expert 🎓", color: "#A855F7" },
    { min: 1000, name: "Meester 🏆", color: "#F59E0B" },
  ];

  const getRankInfo = (xp: number) => {
    return [...RANKS].reverse().find(r => xp >= r.min) || RANKS[0];
  };

  const addXP = async (amount: number) => {
    if (!currentUser) return;
    const newXP = (currentUser.xp || 0) + amount;
    const newRank = getRankInfo(newXP).name;
    
    try {
      await setDoc(doc(db, "users", currentUser.uid), {
        ...currentUser,
        xp: newXP,
        rank: newRank
      });
      setCurrentUser({ ...currentUser, xp: newXP, rank: newRank });
    } catch (error) {
      console.error("Error updating XP:", error);
    }
  };

  const toggleFocusPoint = async (pointId: string) => {
    if (!currentUser) return;
    const points = [...(currentUser.focusPoints || [])];
    const idx = points.findIndex(p => p.id === pointId);
    if (idx === -1) return;

    const point = points[idx];
    const wasCompleted = point.completed;
    point.completed = !wasCompleted;

    try {
      const updatedUser = { 
        ...currentUser, 
        focusPoints: points,
        xp: (currentUser.xp || 0) + (point.completed ? point.xpValue : -point.xpValue),
        rank: getRankInfo((currentUser.xp || 0) + (point.completed ? point.xpValue : -point.xpValue)).name
      };
      await setDoc(doc(db, "users", currentUser.uid), updatedUser);
      setCurrentUser(updatedUser);
      if (point.completed) {
        checkBadges(updatedUser, progression);
        generateNewFocusPoint(updatedUser);
      }
    } catch (error) {
      console.error("Error toggling focus point:", error);
    }
  };

  useEffect(() => {
    if (currentUser && screen === "progression") {
      fetchProgression();
    }
  }, [currentUser, screen]);

  const calculatePrognosis = (data: any[]) => {
    if (data.length < 2) return null;
    const last = data[data.length - 1].score;
    const first = data[0].score;
    const diff = last - first;
    
    // Trend bepalen
    let trend = "stabiel";
    if (diff > 5) trend = "stijgend";
    if (diff < -5) trend = "dalend";

    // Prognose score
    let prognosisScore = last;
    if (trend === "stijgend") prognosisScore += 5;
    if (trend === "dalend") prognosisScore -= 5;
    if (last > 70 && trend === "stabiel") prognosisScore += 2;

    prognosisScore = Math.min(100, Math.max(0, prognosisScore));

    return { trend, prognosisScore };
  };

  interface FocusPoint {
    id: string;
    text: string;
    completed: boolean;
    xpValue: number;
    createdAt: string;
  }

  interface AttestInfo {
    status: "behaald" | "mogelijk" | "gevaar";
    title: string;
    description: string;
    actionPlan: string[];
    consequences: string;
    emoji: string;
  }

  interface FeedbackData {
    predictedAttest: "A" | "B" | "C";
    attests: {
      A: AttestInfo;
      B: AttestInfo;
      C: AttestInfo;
    };
    motivation: string;
    focusPoints: string[];
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
    // @ts-ignore
    return import.meta.env.VITE_GEMINI_API_KEY || 
           (typeof process !== 'undefined' && (process.env.GEMINI_API_KEY || process.env.API_KEY)) || 
           (window as any).API_KEY;
  };

  const checkApiKey = async () => {
    try {
      const currentKey = getApiKey();
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected || !!currentKey);
      } else {
        setHasApiKey(!!currentKey);
      }
    } catch (e) {
      console.error("Error checking API key:", e);
      setHasApiKey(!!getApiKey());
    }
  };

  /**
   * Fallback Logic: Probeert verschillende modellen in volgorde als de quota op is.
   */
  const callGeminiWithFallback = async (params: any, retriesPerModel = 3): Promise<any> => {
    const models = [
      "gemini-3-flash-preview",       // De standaard (snel & gratis)
      "gemini-flash-latest",          // Stabiele alias (soms ander quotum)
      "gemini-3.1-flash-lite-preview", // Fallback 1 (extra lichte quota)
      "gemini-3.1-pro-preview"        // Fallback 2 (krachtigste model)
    ];

    const apiKey = getApiKey();
    if (!apiKey) {
      if (window.aistudio) {
        await window.aistudio.openSelectKey();
        setHasApiKey(true);
        // Geen return hier, we proberen het met de nieuwe sleutel (die in process.env komt)
      } else {
        throw new Error("Geen API-sleutel geconfigureerd. Voeg VITE_GEMINI_API_KEY toe.");
      }
    }
    
    const ai = new GoogleGenAI({ apiKey: getApiKey() || "" });

    for (const modelName of models) {
      let attempts = 0;
      while (attempts < retriesPerModel) {
        try {
          console.log(`AI aanroep met model: ${modelName} (Poging ${attempts + 1})`);
          const response = await ai.models.generateContent({
            ...params,
            model: modelName,
            config: {
              ...params.config,
              safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_NONE" }
              ]
            }
          });
          return response;
        } catch (error: any) {
          console.warn(`Fout bij model ${modelName}:`, error);
          const msg = error?.message || "";
          const status = error?.status;
          
          const isRateLimit = msg.includes("quota") || msg.includes("429") || status === 429;
          const isTransient = msg.includes("fetch") || msg.includes("network") || msg.includes("deadline") || msg.includes("500") || msg.includes("503");
          const isNotFoundError = msg.includes("Requested entity was not found");

          if (isNotFoundError && window.aistudio) {
            console.error("API Key error: Requested entity not found. Re-opening key selector...");
            setHasApiKey(false);
            await window.aistudio.openSelectKey();
            setHasApiKey(true);
            // Probeer het opnieuw met de nieuwe sleutel
            attempts++;
            continue;
          }

          if (isRateLimit || isTransient) {
            if (attempts < retriesPerModel - 1) {
              const delay = isRateLimit ? 2500 : 1000;
              console.warn(`Transient/Rate limit op ${modelName}. Retry over ${delay}ms...`);
              await new Promise(res => setTimeout(res, delay));
              attempts++;
              continue;
            } else {
              console.warn(`Model ${modelName} mislukt na ${retriesPerModel} pogingen. Schakel over...`);
              break; 
            }
          }
          
          // Andere fatale fout?
          throw error;
        }
      }
    }
    throw new Error("Alle beschikbare AI-modellen hebben hun limiet bereikt of geven fouten. Probeer het over een minuutje opnieuw.");
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
        setFbError(""); // Wis foutmelding zodat gebruiker opnieuw kan proberen
      } catch (err) {
        console.error("Fout bij openen sleutel-venster:", err);
        setFbError("Kon het venster niet openen. Probeer de pagina te verversen.");
      }
    } else {
      setFbError("Geen AI-sleutel gevonden. Neem contact op met de beheerder.");
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

      const nedInfo = CONFIG.nederlandsVragen.map(v=>
        nederlandsAntw[v.id]?`${v.vraag}: ${nederlandsAntw[v.id]}`:""
      ).filter(Boolean).join("; ");

      const attest = getAttest(score);
      const apiKey = getApiKey();
      if (!apiKey) {
        setHasApiKey(false);
        throw new Error("Gemini API key is niet geconfigureerd.");
      }

      const ai = new GoogleGenAI({ apiKey });

      const prompt = `Je bent een deskundige Belgische schoolcoach (expert in het Vlaamse onderwijssysteem).
Analyseer de resultaten van ${currentUser?.naam||"de student"} (${jaar}).
Eindscore: ${score}% → Huidig voorspeld attest: ${attest.label}

Context:
- Punten tellen voor 88%, gedrag voor 12%.
- Hoofdvakken (⭐) tellen 3x zwaarder.
- Nederlands niveau (impact +/- 3%): ${nedInfo}
- Vakken: ${vakInfo}
- Gedrag: ${gedragInfo}

Terminologie-hulp:
- Attest A: Geslaagd. Attest B: Geslaagd, maar met uitsluiting van bepaalde richtingen. Attest C: Niet geslaagd.

Geef uitvoerige maar hapklare feedback in JSON formaat.
Bepaal welk attest (A, B of C) de student momenteel zou krijgen.
Geef voor ELK van de drie attesten (A, B en C) een analyse:
1. status: 'behaald' (huidig), 'mogelijk' (verbetering), 'gevaar' (verslechtering).
2. title: Pakkende titel.
3. description: Wat betekent dit specifiek voor deze student?
4. actionPlan: 3-4 concrete stappen om dit te bereiken/behouden.
5. consequences: Gevolgen van dit attest.
6. emoji: Passende emoji.
Voeg ook een algemene 'motivation' toe. Dit moet een ZEER KORTE en KRACHTIGE samenvatting zijn (max 10 woorden) die de essentie van het rapport vat en de student direct raakt.
Voeg ook een lijst 'focusPoints' toe met exact 3 concrete, haalbare doelen (max 10 woorden per doel) die de student zelf kan afvinken (bijv. 'Elke dag 15 min woordjes Frans leren').`;

      const contents: any[] = [{ text: prompt }];
      if (reportImage) {
        contents.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: reportImage
          }
        });
      }

      const response = await callGeminiWithFallback({
        contents: { parts: contents },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              predictedAttest: { type: Type.STRING, enum: ["A", "B", "C"] },
              attests: {
                type: Type.OBJECT,
                properties: {
                  A: {
                    type: Type.OBJECT,
                    properties: {
                      status: { type: Type.STRING, enum: ["behaald", "mogelijk", "gevaar"] },
                      title: { type: Type.STRING },
                      description: { type: Type.STRING },
                      actionPlan: { type: Type.ARRAY, items: { type: Type.STRING } },
                      consequences: { type: Type.STRING },
                      emoji: { type: Type.STRING }
                    },
                    required: ["status", "title", "description", "actionPlan", "consequences", "emoji"]
                  },
                  B: {
                    type: Type.OBJECT,
                    properties: {
                      status: { type: Type.STRING, enum: ["behaald", "mogelijk", "gevaar"] },
                      title: { type: Type.STRING },
                      description: { type: Type.STRING },
                      actionPlan: { type: Type.ARRAY, items: { type: Type.STRING } },
                      consequences: { type: Type.STRING },
                      emoji: { type: Type.STRING }
                    },
                    required: ["status", "title", "description", "actionPlan", "consequences", "emoji"]
                  },
                  C: {
                    type: Type.OBJECT,
                    properties: {
                      status: { type: Type.STRING, enum: ["behaald", "mogelijk", "gevaar"] },
                      title: { type: Type.STRING },
                      description: { type: Type.STRING },
                      actionPlan: { type: Type.ARRAY, items: { type: Type.STRING } },
                      consequences: { type: Type.STRING },
                      emoji: { type: Type.STRING }
                    },
                    required: ["status", "title", "description", "actionPlan", "consequences", "emoji"]
                  }
                },
                required: ["A", "B", "C"]
              },
              motivation: { type: Type.STRING },
              focusPoints: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["predictedAttest", "attests", "motivation", "focusPoints"]
          }
        }
      });
      
      const text = response.text;
      if (!text) throw new Error("Geen tekst ontvangen van de coach.");
      
      const data = JSON.parse(cleanJSON(text)) as FeedbackData;
      if (!data.predictedAttest || !data.attests) throw new Error("Ongeldige data ontvangen.");
      
      // Focus points omzetten naar objecten voor de checklist
      if (data.focusPoints && currentUser) {
        const newFocusPoints: FocusPoint[] = data.focusPoints.map((text, i) => ({
          id: `fp_${Date.now()}_${i}`,
          text,
          completed: false,
          xpValue: 20,
          createdAt: new Date().toISOString()
        }));
        
        // Opslaan in Firestore
        await setDoc(doc(db, "users", currentUser.uid), {
          ...currentUser,
          focusPoints: newFocusPoints,
          xp: (currentUser.xp || 0) + 50, // 50 XP voor de analyse zelf
          rank: getRankInfo((currentUser.xp || 0) + 50).name
        });
        setCurrentUser({ 
          ...currentUser, 
          focusPoints: newFocusPoints, 
          xp: (currentUser.xp || 0) + 50,
          rank: getRankInfo((currentUser.xp || 0) + 50).name
        });
      }

      setFbData(data);
      setSelectedAttest(data.predictedAttest);
    } catch (error: any) {
      console.error("AI Feedback Error:", error);
      let msg = "Oeps! De coach kon je rapport even niet lezen. Probeer het nog eens! 🔄";
      if (error?.message?.includes("API key") || error?.message?.includes("403") || error?.message?.includes("permission")) {
        msg = "De coach heeft geen toegang tot de AI. Klik op de knop hieronder om dit op te lossen.";
        setHasApiKey(false); // Forceer de knop om te verschijnen
      } else if (error?.message?.includes("quota") || error?.message?.includes("429")) {
        msg = "De coach is even overbelast (limiet bereikt). Wacht een minuutje en probeer het opnieuw.";
      }
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
            if (data.nederlandsAntw) setNederlandsAntw(data.nederlandsAntw);
            if (data.score !== undefined) setScore(data.score);
            
            // Skip onboarding if profile is complete
            if (data.school && data.jaar && data.leeftijd && data.richting) {
              setScreen("dashboard");
            } else {
              setScreen("dashboard"); // Always go to dashboard if logged in, profile can be set in settings
            }
          } else {
            setCurrentUser({ uid: fbUser.uid, naam: fbUser.email?.split('@')[0] || "Gebruiker", email: fbUser.email });
            setScreen("dashboard");
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${fbUser.uid}`);
          setScreen("dashboard");
        }
      } else {
        setCurrentUser(null);
        setScreen("welcome");
      }
    });
    return () => unsub();
  }, []);

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

  // ── LAADSCHERM ─────────────────────────────────────────────
  const LoadingScreen = () => (
    <div style={{textAlign:"center",paddingTop:80}}>
      <div style={{marginBottom:16}}>
        <SmileyIcon size={60} />
      </div>
      <p style={{color:OR,fontWeight:800,fontSize:18}}>Laden...</p>
    </div>
  );

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
        label: "Punten Ingeven", 
        desc: "Upload een foto van je rapport of vul je cijfers handmatig in.",
        extra: "Onze AI herkent automatisch je vakken en scores."
      },
      { 
        icon: "✨", 
        color: "#A855F7", 
        label: "Slimme Analyse", 
        desc: "De AI combineert je cijfers met je inzet en gedrag in de klas.",
        extra: "Eerlijk en objectief inzicht in je huidige niveau."
      },
      { 
        icon: "🏆", 
        color: "#F59E0B", 
        label: "Attest Voorspelling", 
        desc: "Zie direct of je op koers bent voor een A, B of C attest.",
        extra: "Ontdek wat je nog moet doen om je doel te bereiken!"
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
        <h1 style={{fontSize:38,fontWeight:900,color:OR,margin:"0 0 6px"}}>RapportRadar</h1>
        <p style={{...S.sub,fontSize:18,marginBottom:40,lineHeight:1.6,fontWeight:800}}>
          Krijg direct een voorspelling van jouw attest op basis van je huidige cijfers. 🎓
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
      </div>
    );
  };

  // ── 1.5 DASHBOARD (LANDING VOOR INGELOGDE GEBRUIKERS) ────────
  const DashboardScreen = () => {
    const xp = currentUser?.xp || 0;
    const rank = getRankInfo(xp);

    const startNieuweAnalyse = () => {
      setVakken([]);
      setGedragAntw({});
      setNederlandsAntw({});
      setScore(null);
      setFbData(null);
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
          
          <div style={{background:ORBG, borderRadius:16, padding:18, marginBottom:24, textAlign:"left", border:`1px solid ${ORPL}`}}>
            <p style={{fontWeight:800, color:ORD, marginBottom:10, fontSize:14}}>📝 Jouw Profiel:</p>
            <div style={{display:"grid", gap:8, fontSize:14, color:"#5D3D1A"}}>
              <div>🏫 <strong>School:</strong> {school || "Niet ingesteld"}</div>
              <div>📅 <strong>Jaar:</strong> {jaar || "Niet ingesteld"}</div>
              <div>🚀 <strong>Richting:</strong> {richting || "Niet ingesteld"}</div>
            </div>
          </div>

          <button style={S.btn} onClick={startNieuweAnalyse}>
            Voorspel mijn Attest <SmileyIcon size={20} style={{marginLeft:8}} />
          </button>

          <button 
            style={{ ...S.btn, background: `linear-gradient(135deg, #6366F1, #8B5CF6)`, boxShadow: "0 8px 24px rgba(99, 102, 241, 0.3)" }} 
            onClick={() => setScreen("game")}
          >
            Mijn Spel & Progressie 🎮
          </button>
          
          <button style={S.btnSec} onClick={()=>setShowSettings(true)}>
            Profiel Aanpassen ⚙️
          </button>
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
          handleFirestoreError(error, OperationType.WRITE, userPath);
        }
      } catch (e: any) {
        setBezig(false);
        if (e.code === "auth/email-already-in-use") setFout("Dit e-mailadres is al in gebruik!");
        else if (e.code === "auth/invalid-email")   setFout("Ongeldig e-mailadres");
        else handleAuthError(e);
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
      } catch (e: any) {
        setBezig(false);
        if (e.code === "auth/wrong-password" || e.code === "auth/user-not-found" || e.code === "auth/invalid-credential") {
          setFout("E-mail of wachtwoord klopt niet 🔑");
        } else {
          handleAuthError(e);
        }
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
        setVakken(lv); setScreen("behavior");
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${currentUser?.uid}`);
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
          <button style={S.btn} onClick={verder}>Verder → Punten invoeren 📊</button>
        </div>
      </div>
    );
  };

  // ── 6. PUNTEN INVOEREN ─────────────────────────────────────
  const GradesScreen = () => {
    const [lv,      setLv]      = useState([...vakken]);
    const [nv,      setNv]      = useState("");
    const [ocrMsg,  setOcrMsg]  = useState("");
    const [ocrFout, setOcrFout] = useState("");
    const [ocrLoading, setOcrLoading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const updateVak = (id: number, field: string, val: string) => setLv(lv.map(v=>v.id===id?{...v,[field]:val}:v));

    const voegToe = () => {
      if (!nv.trim()) return;
      setLv([...lv, { id: Date.now(), naam: nv.trim(), isHoofdvak: false, punt: "", maxPunt: "20" }]);
      setNv("");
    };
    const verwijder = (id: number) => setLv(lv.filter(v => v.id !== id));

    const handleOCR = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
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

        if (imageParts.length > 0) {
          setReportImage(imageParts[imageParts.length - 1].inlineData.data);
        }

        console.log(`OCR: Bezig met analyseren van ${files.length} bestand(en) in één verzoek...`);
        
        // 2. Stuur één enkel verzoek met alle beelden
        const response = await callGeminiWithFallback({
          contents: [
            {
              parts: [
                ...imageParts,
                { text: OCR_PROMPT }
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
        console.log("OCR Raw Response:", text);
        
        if (!text) {
          throw new Error("De AI gaf geen antwoord terug.");
        }

        const extracted = JSON.parse(cleanJSON(text));
        
        if (extracted.length === 0) {
          setOcrFout("Geen vakken of punten gevonden op deze foto's. Probeer een duidelijkere foto van de tabel.");
          return;
        }
        
        const merged = extracted.reduce((acc: any[], curr: any) => {
          const existingIndex = acc.findIndex(a => a.naam.toLowerCase() === curr.naam.toLowerCase());
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
              e.naam.toLowerCase().includes(v.naam.toLowerCase()) ||
              v.naam.toLowerCase().includes(e.naam.toLowerCase())
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
        setOcrMsg(`✅ ${merged.length} vakken en punten herkend uit ${files.length} foto's!`);
      } catch (error: any) {
        console.error("AI OCR Error (Grades):", error);
        let msg = "Kon de rapporten niet volledig lezen. Probeer duidelijkere foto's.";
        if (error?.message?.includes("API key") || error?.message?.includes("403") || error?.message?.includes("401")) {
          msg = "Fout met de AI-sleutel. Controleer je 'Secrets' in AI Studio (VITE_GEMINI_API_KEY).";
        } else if (error?.message?.includes("quota") || error?.message?.includes("429")) {
          msg = "De AI is even overbelast (limiet bereikt). Wacht een minuutje en probeer het opnieuw.";
        } else if (error?.message?.includes("Safety")) {
          msg = "De AI weigerde dit bestand te lezen vanwege veiligheidsinstellingen.";
        } else if (error instanceof SyntaxError) {
          msg = "De AI gaf een ongeldig antwoord terug. Probeer het nog eens.";
        }
        setOcrFout(msg);
      } finally {
        setOcrLoading(false);
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
        setVakken(lv); setScreen("important_subjects");
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${currentUser?.uid}`);
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
          await setDoc(doc(db, "users", currentUser.uid), {
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
        </div>
      </div>
    );
  };

  // ── 8. RESULTATEN + SPEEDOMETER ───────────────────────────
  const ResultsScreen = () => {
    const [anim, setAnim] = useState(0);
    const attest = getAttest(score||0);

    useEffect(() => {
      if (!fbData && !fbLoad && score !== null) {
        vraagFeedback();
      }
    }, [score, fbData, fbLoad]);

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

    return (
      <div>
        <StapBar huidig="results"/>
        <div style={S.card}>
          <div style={{textAlign:"center",marginBottom:16}}>
            <h2 style={S.h2}>Jouw Resultaat</h2>
          </div>
          
          <Speedo val={anim}/>
          <CharacterAnimation val={anim}/>

          {!fbData && (
            <div style={{textAlign:"center",background:`${attest.kleur}14`,border:`2px solid ${attest.kleur}44`,
              borderRadius:16,padding:"16px 20px",marginBottom:16}}>
              <div style={{fontSize:22,fontWeight:900,color:attest.kleur,marginBottom:8}}>{attest.emoji} {attest.label}</div>
              <p style={{fontSize:14,color:"#5D3D1A",margin:0,lineHeight:1.6}}>{attest.tekst}</p>
            </div>
          )}
          
          {fbLoad && !fbData && (
            <div style={{textAlign:"center", padding:20, background:ORBG, borderRadius:16, marginBottom:20}}>
              <div style={{fontSize:30, marginBottom:10, animation:"spin 2s linear infinite"}}>⏳</div>
              <p style={{fontWeight:800, color:OR, margin:0}}>De coach analyseert jouw rapport...</p>
            </div>
          )}

          {fbError && (
            <div style={{marginBottom:20, textAlign:"center"}}>
              <div style={{...S.err, marginBottom:8}}>{fbError}</div>
              <div style={{display:"flex", gap:8, justifyContent:"center"}}>
                {!hasApiKey && (
                  <button 
                    style={{...S.btnSec, padding:"8px 16px", fontSize:13, flex:1, cursor:"pointer"}} 
                    onClick={handleSelectKey}
                  >
                    🔑 Sleutel Instellen
                  </button>
                )}
                <button 
                  style={{...S.btnSec, padding:"8px 16px", fontSize:13, flex:1, cursor:"pointer"}} 
                  onClick={vraagFeedback}
                >
                  🔄 Opnieuw Proberen
                </button>
              </div>
            </div>
          )}

          {fbData && (
            <div style={{display:"flex",flexDirection:"column",gap:20,marginBottom:24,textAlign:"left"}}>
              {/* Samenvatting Quote */}
              <div style={{textAlign:"center", padding:"16px 20px", background:`${OR}0D`, borderRadius:16, border:`1px dashed ${OR}44`}}>
                <div style={{fontSize:10, fontWeight:900, color:OR, textTransform:"uppercase", letterSpacing:1, marginBottom:6}}>De Coach in 1 zin:</div>
                <p style={{fontSize:18, fontWeight:900, color:OR, fontStyle:"italic", margin:0, lineHeight:1.3}}>"{fbData.motivation}"</p>
              </div>

              {/* Attest Knoppen */}
              <div style={{display:"flex", gap:8, background:ORBG, padding:6, borderRadius:16}}>
                {(["A", "B", "C"] as const).map((at) => {
                  const isActive = selectedAttest === at;
                  const isPredicted = fbData.predictedAttest === at;
                  const info = fbData.attests[at];
                  
                  return (
                    <button
                      key={at}
                      onClick={() => setSelectedAttest(at)}
                      style={{
                        flex: 1,
                        padding: "12px 8px",
                        borderRadius: 12,
                        border: "none",
                        cursor: "pointer",
                        background: isActive ? OR : "transparent",
                        color: isActive ? "white" : "#8B6242",
                        transition: "all .2s",
                        position: "relative",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 4
                      }}
                    >
                      <span style={{fontSize:18, fontWeight:900}}>{at}</span>
                      <span style={{fontSize:9, fontWeight:800, textTransform:"uppercase", opacity:0.8}}>Attest</span>
                      {isPredicted && (
                        <div style={{
                          position:"absolute", top:-4, right:-4, background:"#22C55E", color:"white",
                          fontSize:8, padding:"2px 5px", borderRadius:10, fontWeight:900, border:"2px solid white"
                        }}>HUIDIG</div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Attest Content */}
              {selectedAttest && (
                <div style={{
                  background: "white", border: `2px solid ${selectedAttest === fbData.predictedAttest ? "#22C55E" : ORPL}`,
                  borderRadius: 20, padding: 20, animation: "bounce .3s ease"
                }}>
                  <div style={{display:"flex", alignItems:"center", gap:12, marginBottom:16}}>
                    <div style={{fontSize:32}}>{fbData.attests[selectedAttest].emoji}</div>
                    <div>
                      <h3 style={{fontWeight:900, color:"#2D1B00", fontSize:18, margin:0}}>
                        {fbData.attests[selectedAttest].title}
                      </h3>
                      <div style={{
                        fontSize:10, fontWeight:800, color: selectedAttest === fbData.predictedAttest ? "#22C55E" : OR,
                        textTransform:"uppercase", letterSpacing:0.5
                      }}>
                        Status: {fbData.attests[selectedAttest].status}
                      </div>
                    </div>
                  </div>

                  <p style={{fontSize:14, color:"#4B5563", lineHeight:1.6, marginBottom:20}}>
                    {fbData.attests[selectedAttest].description}
                  </p>

                  <div style={{background:ORBG, borderRadius:14, padding:16, marginBottom:20}}>
                    <h4 style={{fontSize:13, fontWeight:900, color:"#2D1B00", marginBottom:12, display:"flex", alignItems:"center", gap:6}}>
                      <span>🎯</span> {selectedAttest === fbData.predictedAttest ? "Hoe behoud ik dit?" : "Wat moet ik doen?"}
                    </h4>
                    <ul style={{margin:0, paddingLeft:20, fontSize:13, color:"#5D3D1A"}}>
                      {fbData.attests[selectedAttest].actionPlan.map((step, i) => (
                        <li key={i} style={{marginBottom:8, fontWeight:700}}>{step}</li>
                      ))}
                    </ul>
                  </div>

                  <div style={{borderTop:"1px solid #E5E7EB", paddingTop:16}}>
                    <h4 style={{fontSize:13, fontWeight:900, color:"#2D1B00", marginBottom:8}}>
                      ⚠️ Gevolgen
                    </h4>
                    <p style={{fontSize:12, color:"#6B7280", fontStyle:"italic", margin:0}}>
                      {fbData.attests[selectedAttest].consequences}
                    </p>
                  </div>
                </div>
              )}

            </div>
          )}

          <div style={{fontSize:12,color:"#8B6242",marginBottom:20,textAlign:"center",fontStyle:"italic",lineHeight:1.5}}>
            ⚠️ Dit is een indicatie. De officiële beslissing ligt altijd bij de school.
          </div>
          
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <button style={{ ...S.btn, flex: 1, background: `linear-gradient(135deg, #6366F1, #8B5CF6)`, boxShadow: "0 8px 24px rgba(99, 102, 241, 0.3)" }} onClick={() => setScreen("game")}>🎮 Mijn Spel</button>
            <button 
              style={{ ...S.btn, flex: 1, background: saveSuccess ? "#22C55E" : OR }} 
              onClick={saveTodayScore}
              disabled={saveSuccess}
            >
              {saveSuccess ? "✅ Opgeslagen!" : "💾 Sla score op"}
            </button>
          </div>

          {fbData && (
            <button 
              style={{ ...S.btn, background: "#3B82F6", boxShadow: "0 8px 24px rgba(59, 130, 246, 0.3)" }} 
              onClick={() => setScreen("game")}
            >
              🎯 Bekijk Focus Checklist
            </button>
          )}

          <button style={S.btnSec} onClick={()=>setScreen("breakdown")}>🔍 Bekijk gedetailleerde berekening</button>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <button style={S.btnSec} onClick={()=>setScreen("grades")}>
              ⚙️ Punten aanpassen
            </button>
            <button style={S.btnSec} onClick={()=>{
              setVakken([]);
              setGedragAntw({});
              setNederlandsAntw({});
              setScore(null);
              setFbData(null);
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

  // ── 9. FEEDBACK MODAL ───────────────────────────
  const FeedbackModal = () => {
    if (!showFeedback) return null;

    const submitFeedback = async () => {
      if (!feedbackMsg.trim()) return;
      setFeedbackLoading(true);
      try {
        await addDoc(collection(db, "feedback"), {
          userId: currentUser?.uid || "anonymous",
          userEmail: currentUser?.email || "anonymous",
          userName: currentUser?.naam || "anonymous",
          message: feedbackMsg,
          rating: feedbackRating,
          timestamp: serverTimestamp()
        });
        setFeedbackSuccess(true);
        setTimeout(() => {
          setShowFeedback(false);
          setFeedbackSuccess(false);
          setFeedbackMsg("");
          setFeedbackRating(0);
        }, 2000);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, "feedback");
      } finally {
        setFeedbackLoading(false);
      }
    };

    return (
      <div style={{
        position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:1000,
        display:"flex", alignItems:"center", justifyContent:"center", padding:20,
        backdropFilter:"blur(4px)"
      }}>
        <div style={{...S.card, width:"100%", maxWidth:400, position:"relative", animation:"bounce .3s ease"}}>
          <button 
            style={{position:"absolute", top:16, right:16, background:"none", border:"none", fontSize:24, cursor:"pointer", color:"#8B6242"}}
            onClick={() => setShowFeedback(false)}
          >✕</button>
          
          <div style={{textAlign:"center", marginBottom:20}}>
            <div style={{fontSize:40, marginBottom:8}}>💡</div>
            <h2 style={S.h2}>Laat ons weten wat je vindt!</h2>
            <p style={S.sub}>Jouw feedback helpt ons RapportRadar te verbeteren.</p>
          </div>

          {feedbackSuccess ? (
            <div style={{...S.ok, textAlign:"center", padding:20}}>
              <div style={{fontSize:30, marginBottom:10}}>✨</div>
              Bedankt voor je feedback!
            </div>
          ) : (
            <>
              <div style={{marginBottom:16}}>
                <label style={S.lbl}>Hoe tevreden ben je? (optioneel)</label>
                <div style={{display:"flex", justifyContent:"center", gap:10, marginTop:8}}>
                  {[1,2,3,4,5].map(star => (
                    <button 
                      key={star} 
                      onClick={() => setFeedbackRating(star)}
                      style={{
                        background:"none", border:"none", fontSize:28, cursor:"pointer",
                        filter: feedbackRating >= star ? "none" : "grayscale(100%) opacity(0.3)",
                        transition:"all .2s"
                      }}
                    >⭐</button>
                  ))}
                </div>
              </div>

              <div style={{marginBottom:20}}>
                <label style={S.lbl}>Wat kan er beter?</label>
                <textarea 
                  style={{...S.input, height:120, resize:"none", marginTop:4}}
                  placeholder="Typ hier je suggesties of opmerkingen..."
                  value={feedbackMsg}
                  onChange={(e) => setFeedbackMsg(e.target.value)}
                />
              </div>

              <button 
                style={{...S.btn, opacity: feedbackMsg.trim() ? 1 : 0.5}} 
                onClick={submitFeedback}
                disabled={feedbackLoading || !feedbackMsg.trim()}
              >
                {feedbackLoading ? "⏳ Verzenden..." : "Verzenden 🚀"}
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  // ── 13. GAME SCREEN (GAMIFICATION HUB) ─────────────────────
  const BadgeNotification = () => {
    if (!newBadge) return null;
    return (
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        style={{
          position: "fixed", bottom: 40, left: "50%", transform: "translateX(-50%)",
          zIndex: 2000, background: "white", padding: "16px 24px", borderRadius: 24,
          boxShadow: "0 10px 25px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", gap: 16,
          border: `2px solid ${OR}`, width: "90%", maxWidth: 400
        }}
      >
        <div style={{ fontSize: 40 }}>{newBadge.name.split(' ').pop()}</div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: OR, textTransform: "uppercase" }}>Nieuwe Badge Behaald! 🏆</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#2D1B00" }}>{newBadge.name}</div>
          <div style={{ fontSize: 13, color: "#8B6242" }}>{newBadge.description}</div>
        </div>
      </motion.div>
    );
  };

  const GameScreen = () => {
    const xp = currentUser?.xp || 0;
    const rank = getRankInfo(xp);
    const nextRank = RANKS.find(r => r.min > xp);
    const progress = nextRank ? ((xp - rank.min) / (nextRank.min - rank.min)) * 100 : 100;
    const prognosis = calculatePrognosis(progression);
    const today = new Date().toISOString().split('T')[0];
    const alreadySaved = progression.some(p => p.date === today);

    return (
      <div style={{ paddingBottom: 40 }}>
        <button style={S.back} onClick={() => setScreen("dashboard")}>← Terug naar Dashboard</button>
        
        <div style={{textAlign:"center", marginBottom:24}}>
          <div style={{fontSize:52, marginBottom:8}}>🎮</div>
          <h2 style={S.h2}>Mijn Spel & Progressie</h2>
          <p style={S.sub}>Hier vind je alles over je groei en beloningen.</p>
        </div>

        {/* XP & Rank Card */}
        <div style={{...S.card, padding: 24, marginBottom: 20, background: `linear-gradient(135deg, white, ${ORBG})`, border: `2px solid ${ORPL}`}}>
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 60, filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.1))" }}>{rank.name.split(' ')[1]}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#8B6242", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Huidige Status</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: rank.color }}>{rank.name}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: OR }}>{xp}</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#8B6242" }}>TOTAAL XP</div>
            </div>
          </div>

          <div style={{ background: "white", borderRadius: 20, padding: 16, border: "1px solid rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13, fontWeight: 800 }}>
              <span style={{color: "#64748B"}}>Voortgang naar volgende rang</span>
              <span style={{color: OR}}>{Math.round(progress)}%</span>
            </div>
            <div style={{ width: "100%", height: 14, background: "#F1F5F9", borderRadius: 10, overflow: "hidden", border: "1px solid #E2E8F0" }}>
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                style={{ height: "100%", background: `linear-gradient(90deg, ${OR}, ${ORL})` }}
              />
            </div>
            {nextRank && (
              <p style={{ fontSize: 12, color: "#8B6242", marginTop: 10, fontWeight: 700, textAlign: "center" }}>
                Nog <span style={{color: OR}}>{nextRank.min - xp} XP</span> tot <span style={{color: nextRank.color}}>{nextRank.name}</span>
              </p>
            )}
          </div>
        </div>

        {/* Focus Checklist */}
        {currentUser?.focusPoints && currentUser.focusPoints.length > 0 && (
          <div style={{...S.card, padding: 24, marginBottom: 20}}>
            <h3 style={{...S.h2, fontSize: 20, marginBottom: 16, display: "flex", alignItems: "center", gap: 10}}>
              <span style={{fontSize: 24}}>🎯</span> Focus Checklist
            </h3>
            <p style={{...S.sub, marginBottom: 20}}>Voltooi deze doelen om extra XP te verdienen en sneller te stijgen in rang!</p>
            <div style={{ 
              display: "flex", 
              flexDirection: "column", 
              gap: 12,
              maxHeight: 280, // Fits roughly 3 items (each ~80px + gap)
              overflowY: "auto",
              paddingRight: 8,
              scrollbarWidth: "thin",
              scrollbarColor: `${OR} #F1F5F9`
            }}>
              {[...(currentUser.focusPoints || [])]
                .sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1))
                .map((p: any) => (
                <motion.div 
                  key={p.id} 
                  layout
                  whileTap={{ scale: 0.98 }}
                  onClick={() => toggleFocusPoint(p.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 14, padding: "16px 20px",
                    background: p.completed ? "#F0FDF4" : "#F8FAFC",
                    borderRadius: 20, cursor: "pointer", transition: "all .2s",
                    border: `2px solid ${p.completed ? "#DCFCE7" : "#F1F5F9"}`,
                    boxShadow: p.completed ? "none" : "0 2px 8px rgba(0,0,0,0.02)"
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: 10, border: `2.5px solid ${p.completed ? "#22C55E" : ORPL}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: p.completed ? "#22C55E" : "white", color: "white", fontSize: 16
                  }}>
                    {p.completed && "✓"}
                  </div>
                  <div style={{ flex: 1, fontSize: 15, fontWeight: 700, color: p.completed ? "#166534" : "#2D1B00", textDecoration: p.completed ? "line-through" : "none" }}>
                    {p.text}
                  </div>
                  {!p.completed && (
                    <div style={{ 
                      fontSize: 11, fontWeight: 800, color: OR, background: ORBG, 
                      padding: "4px 10px", borderRadius: 10, border: `1px solid ${ORPL}` 
                    }}>
                      +{p.xpValue} XP
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Badges Section */}
        <div style={{...S.card, padding: 24, marginBottom: 20}}>
          <h3 style={{...S.h2, fontSize: 20, marginBottom: 16, display: "flex", alignItems: "center", gap: 10}}>
            <span style={{fontSize: 24}}>🏅</span> Mijn Badges
          </h3>
          <p style={{...S.sub, marginBottom: 20}}>Verzamel badges door doelen te bereiken en je rapport te verbeteren!</p>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[...CONFIG.BADGES, ...(currentUser?.customBadges || [])].map((badge: any) => {
              const isEarned = currentUser?.badges?.includes(badge.id);
              
              const shareBadge = () => {
                if (!isEarned) return;
                const text = `🏆 Ik heb de badge "${badge.name}" behaald op RapportRadar! 📊\n\n${badge.description}\n\nCheck je eigen rapport op RapportRadar! 🚀`;
                navigator.clipboard.writeText(text);
                alert("Badge info gekopieerd naar klembord! Je kunt het nu delen op sociale media. 🚀");
              };

              return (
                <motion.div
                  key={badge.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={shareBadge}
                  style={{
                    background: "white",
                    borderRadius: 24,
                    padding: 0,
                    border: `2px solid ${isEarned ? OR : "#F1F5F9"}`,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                    opacity: isEarned ? 1 : 0.5,
                    filter: isEarned ? "none" : "grayscale(80%)",
                    position: "relative",
                    overflow: "hidden",
                    cursor: isEarned ? "pointer" : "default",
                    boxShadow: isEarned ? `0 8px 20px ${OR}22` : "none"
                  }}
                >
                  {/* Strava-like "Challenge" Header */}
                  <div style={{ 
                    width: "100%", 
                    background: isEarned ? OR : "#F1F5F9", 
                    padding: "4px 0",
                    fontSize: 9,
                    fontWeight: 900,
                    color: isEarned ? "white" : "#94A3B8",
                    textTransform: "uppercase",
                    letterSpacing: 1.5
                  }}>
                    {isEarned ? "Challenge Voltooid" : "Badge Challenge"}
                  </div>

                  <div style={{ padding: "20px 12px 16px" }}>
                    <div style={{ 
                      fontSize: 56, marginBottom: 12, 
                      filter: isEarned ? "drop-shadow(0 4px 12px rgba(244, 121, 32, 0.4))" : "none",
                      transform: isEarned ? "scale(1.1)" : "scale(1)",
                      transition: "transform 0.3s ease"
                    }}>
                      {badge.name.split(' ').pop()}
                    </div>
                    
                    <div style={{ 
                      fontSize: 15, fontWeight: 900, color: "#2D1B00", marginBottom: 6,
                      lineHeight: 1.2
                    }}>
                      {badge.name.split(' ').slice(0, -1).join(' ')}
                    </div>
                    
                    <div style={{ fontSize: 11, color: "#8B6242", fontWeight: 700, lineHeight: 1.4, minHeight: 32 }}>
                      {badge.description}
                    </div>
                  </div>

                  {/* Status Bar */}
                  <div style={{
                    width: "100%",
                    padding: "10px",
                    background: isEarned ? "#F0FDF4" : "#F8FAFC",
                    borderTop: `1px solid ${isEarned ? "#DCFCE7" : "#F1F5F9"}`,
                    fontSize: 10,
                    fontWeight: 800,
                    color: isEarned ? "#166534" : "#64748B",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4
                  }}>
                    {isEarned ? (
                      <><span>✅</span> BEHAALD</>
                    ) : (
                      <><span>🔒</span> NOG TE BEHALEN</>
                    )}
                  </div>
                  
                  {isEarned && (
                    <div style={{
                      position: "absolute", top: 32, right: 12,
                      fontSize: 10, color: OR, fontWeight: 900,
                      opacity: 0.6
                    }}>
                      SHARE ↗
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Progressie Grafiek */}
        <div style={S.card}>
          <h3 style={{...S.h2, fontSize: 20, marginBottom: 16, display: "flex", alignItems: "center", gap: 10}}>
            <span style={{fontSize: 24}}>📈</span> Mijn Progressie
          </h3>
          <div style={{ 
            background: "white", 
            borderRadius: 20, 
            padding: "20px 10px", 
            border: `2px solid ${ORPL}`,
            marginBottom: 24,
            height: 300
          }}>
            {progression.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={progression}>
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={OR} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={OR} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 10, fontWeight: 700, fill: "#8B6242" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(str) => str.split('-').slice(1).reverse().join('/')}
                  />
                  <YAxis 
                    domain={[0, 100]} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: "#8B6242" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontWeight: 800 }}
                    itemStyle={{ color: OR }}
                  />
                  <ReferenceLine y={70} stroke="#22C55E" strokeDasharray="3 3" label={{ position: 'right', value: 'A-Attest', fill: '#22C55E', fontSize: 10, fontWeight: 800 }} />
                  <ReferenceLine y={50} stroke="#F59E0B" strokeDasharray="3 3" label={{ position: 'right', value: 'B-Attest', fill: '#F59E0B', fontSize: 10, fontWeight: 800 }} />
                  <Area 
                    type="monotone" 
                    dataKey="score" 
                    stroke={OR} 
                    strokeWidth={4}
                    fillOpacity={1} 
                    fill="url(#colorScore)" 
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#8B6242", fontWeight: 700, textAlign: "center", padding: 20 }}>
                Nog geen gegevens beschikbaar.<br/>Sla je score op om je grafiek te starten!
              </div>
            )}
          </div>

          {prognosis && (
            <div style={{ 
              background: prognosis.trend === "stijgend" ? "#F0FDF4" : (prognosis.trend === "dalend" ? "#FEF2F2" : "#FFFBEB"),
              border: `2px solid ${prognosis.trend === "stijgend" ? "#DCFCE7" : (prognosis.trend === "dalend" ? "#FEE2E2" : "#FEF3C7")}`,
              borderRadius: 20,
              padding: 20,
              marginBottom: 24
            }}>
              <h4 style={{ fontWeight: 900, color: "#2D1B00", fontSize: 16, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <span>🔮</span> Prognose
              </h4>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ 
                  width: 64, height: 64, borderRadius: 100, 
                  background: "white", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 24, fontWeight: 900, color: OR, border: `3px solid ${ORPL}`
                }}>
                  {Math.round(prognosis.prognosisScore)}%
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: "#2D1B00" }}>
                    Trend: <span style={{ color: prognosis.trend === "stijgend" ? "#16A34A" : (prognosis.trend === "dalend" ? "#DC2626" : "#D97706") }}>
                      {prognosis.trend.toUpperCase()} {prognosis.trend === "stijgend" ? "📈" : (prognosis.trend === "dalend" ? "📉" : "➡️")}
                    </span>
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#8B6242", lineHeight: 1.4 }}>
                    {prognosis.trend === "stijgend" && "Je bent goed bezig! Als je deze lijn doortrekt, ziet je attestering er rooskleurig uit."}
                    {prognosis.trend === "dalend" && "Let op! Je score daalt. Probeer extra inzet te tonen."}
                    {prognosis.trend === "stabiel" && "Je behoudt een stabiel niveau. Ga zo door!"}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div style={{ background: ORBG, borderRadius: 20, padding: 20 }}>
            <h4 style={{ fontWeight: 900, color: "#2D1B00", fontSize: 16, marginBottom: 16 }}>📅 Historiek</h4>
            {progression.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[...progression].reverse().slice(0, 5).map(p => (
                  <div key={p.id} style={{ 
                    background: "white", borderRadius: 12, padding: "12px 16px", 
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
                  }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#2D1B00" }}>{p.date.split('-').reverse().join('/')}</div>
                      <div style={{ fontSize: 11, color: "#8B6242", fontWeight: 700 }}>Score: {p.score}%</div>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: p.score >= 70 ? "#22C55E" : (p.score >= 50 ? "#F59E0B" : "#EF4444") }}>
                      {p.score}%
                    </div>
                  </div>
                ))}
                {progression.length > 5 && (
                  <p style={{textAlign:"center", fontSize:12, color:OR, fontWeight:800, marginTop:10}}>
                    En nog {progression.length - 5} andere metingen...
                  </p>
                )}
              </div>
            ) : (
              <p style={{ textAlign: "center", fontSize: 13, color: "#8B6242", fontStyle: "italic" }}>Geen historiek gevonden.</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const [showProfile, setShowProfile] = useState(false);

  const ProfileCard = () => {
    if (!currentUser || !showProfile) return null;
    const xp = currentUser.xp || 0;
    const rank = getRankInfo(xp);
    const nextRank = RANKS.find(r => r.min > xp);
    const progress = nextRank ? ((xp - rank.min) / (nextRank.min - rank.min)) * 100 : 100;

    return (
      <div style={{
        position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:1200,
        display:"flex", alignItems:"center", justifyContent:"center", padding:20,
        backdropFilter:"blur(6px)"
      }} onClick={() => setShowProfile(false)}>
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={{...S.card, width:"100%", maxWidth:400, position:"relative", textAlign: "center"}}
          onClick={e => e.stopPropagation()}
        >
          <button 
            style={{position:"absolute", top:16, right:16, background:"none", border:"none", fontSize:24, cursor:"pointer", color:"#8B6242"}}
            onClick={() => setShowProfile(false)}
          >✕</button>

          <div style={{ fontSize: 64, marginBottom: 16 }}>{rank.name.split(' ')[1]}</div>
          <h2 style={S.h2}>{currentUser.naam}</h2>
          <p style={{...S.sub, fontWeight: 800, color: rank.color, fontSize: 16, marginBottom: 20 }}>
            {rank.name}
          </p>

          <div style={{ background: ORBG, borderRadius: 20, padding: 20, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14, fontWeight: 800 }}>
              <span>XP Voortgang</span>
              <span>{xp} XP</span>
            </div>
            <div style={{ width: "100%", height: 12, background: ORPL, borderRadius: 10, overflow: "hidden" }}>
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                style={{ height: "100%", background: `linear-gradient(90deg, ${OR}, ${ORL})` }}
              />
            </div>
            {nextRank && (
              <p style={{ fontSize: 11, color: "#8B6242", marginTop: 8, fontWeight: 700 }}>
                Nog {nextRank.min - xp} XP tot {nextRank.name}
              </p>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            <div style={{ background: "#F8FAFC", padding: 12, borderRadius: 16 }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>📈</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B" }}>Metingen</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#1E293B" }}>{progression.length}</div>
            </div>
            <div style={{ background: "#F8FAFC", padding: 12, borderRadius: 16 }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>🎯</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B" }}>Focus Doelen</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#1E293B" }}>
                {currentUser.focusPoints?.filter((p: any) => p.completed).length || 0}
              </div>
            </div>
          </div>

          <button 
            style={{ ...S.btn, background: `linear-gradient(135deg, #6366F1, #8B5CF6)`, boxShadow: "0 8px 24px rgba(99, 102, 241, 0.3)" }} 
            onClick={() => {
              setScreen("game");
              setShowProfile(false);
            }}
          >
            Bekijk Volledige Progressie 🎮
          </button>
        </motion.div>
      </div>
    );
  };

  // ── 12. INSTELLINGEN MODAL ──────────────────────────────────
  const SettingsModal = () => {
    const [ls, setLs] = useState(school);
    const [lj, setLj] = useState(jaar);
    const [ll, setLl] = useState(leeftijd);
    const [lr, setLr] = useState(richting);
    const [ln, setLn] = useState(currentUser?.naam || "");
    const [bezig, setBezig] = useState(false);
    const [success, setSuccess] = useState(false);

    if (!showSettings) return null;

    const opslaan = async () => {
      setBezig(true);
      try {
        if (currentUser?.uid) {
          await setDoc(doc(db, "users", currentUser.uid), {
            ...currentUser,
            naam: ln,
            school: ls,
            jaar: lj,
            leeftijd: ll,
            richting: lr
          });
          setSchool(ls); setJaar(lj); setLeeftijd(ll); setRichting(lr);
          setCurrentUser({ ...currentUser, naam: ln, school: ls, jaar: lj, leeftijd: ll, richting: lr });
          setSuccess(true);
          setTimeout(() => {
            setSuccess(false);
            setShowSettings(false);
          }, 1500);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${currentUser?.uid}`);
      } finally {
        setBezig(false);
      }
    };

    return (
      <div style={{
        position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:1100,
        display:"flex", alignItems:"center", justifyContent:"center", padding:20,
        backdropFilter:"blur(4px)"
      }}>
        <div style={{...S.card, width:"100%", maxWidth:450, position:"relative", animation:"bounce .3s ease"}}>
          <button 
            style={{position:"absolute", top:16, right:16, background:"none", border:"none", fontSize:24, cursor:"pointer", color:"#8B6242"}}
            onClick={() => setShowSettings(false)}
          >✕</button>
          
          <div style={{textAlign:"center", marginBottom:20}}>
            <div style={{fontSize:40, marginBottom:8}}>⚙️</div>
            <h2 style={S.h2}>Mijn Instellingen</h2>
            <p style={S.sub}>Pas hier je profielgegevens aan.</p>
          </div>

          {success ? (
            <div style={{...S.ok, textAlign:"center", padding:20}}>
              <div style={{fontSize:30, marginBottom:10}}>✅</div>
              Gegevens succesvol bijgewerkt!
            </div>
          ) : (
            <div style={{maxHeight:"70vh", overflowY:"auto", paddingRight:10}}>
              <label style={S.lbl}>Voornaam</label>
              <input style={S.input} value={ln} onChange={e=>setLn(e.target.value)} placeholder="Jouw voornaam"/>

              <label style={S.lbl}>🏫 School</label>
              <input style={S.input} value={ls} onChange={e=>setLs(e.target.value)} placeholder="Naam van je school"/>

              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10}}>
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
                  <input style={S.input} type="number" value={ll} onChange={e=>setLl(e.target.value)} placeholder="Bv. 14"/>
                </div>
              </div>

              <label style={S.lbl}>🚀 Studierichting</label>
              <input style={S.input} value={lr} onChange={e=>setLr(e.target.value)} placeholder="Bv. Economie-Wiskunde"/>

              <button 
                style={{...S.btn, marginTop:10}} 
                onClick={opslaan}
                disabled={bezig}
              >
                {bezig ? "⏳ Opslaan..." : "Opslaan ✅"}
              </button>
            </div>
          )}
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
    setGedragAntw({}); setNederlandsAntw({}); setScore(null); setFbData(null); setReportImage(null);
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
      <FeedbackModal/>
      <SettingsModal/>
      <ProfileCard/>
      <BadgeNotification/>
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
                onClick={() => setShowFeedback(true)}
                style={{
                  background:ORBG, border:`1px solid ${ORPL}`, borderRadius:20, 
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
        {screen==="grades"             && <GradesScreen/>}
        {screen==="behavior"           && <BehaviorScreen/>}
        {screen==="results"            && <ResultsScreen/>}
        {screen==="breakdown"          && <BreakdownScreen/>}
        {screen==="game"               && <GameScreen/>}
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
