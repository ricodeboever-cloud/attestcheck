import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, getDocFromServer, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { CONFIG, getRankInfo, RANKS } from '../constants';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

// Types
export interface Vak {
  id: string;
  naam: string;
  punt: string;
  maxPunt: string;
  isHoofdvak: boolean;
}

export interface UserProfile {
  uid: string;
  naam?: string;
  email?: string;
  school?: string;
  jaar?: string;
  leeftijd?: string;
  richting?: string;
  vakken?: Vak[];
  gedragAntw?: any;
  nederlandsAntw?: any;
  score?: number;
  xp?: number;
  rank?: string;
  progression?: any[];
  badges?: string[];
  customBadges?: any[];
}

interface AppContextType {
  currentUser: UserProfile | null;
  setCurrentUser: (user: UserProfile | null) => void;
  school: string;
  setSchool: (s: string) => void;
  jaar: string;
  setJaar: (j: string) => void;
  leeftijd: string;
  setLeeftijd: (l: string) => void;
  richting: string;
  setRichting: (r: string) => void;
  vakken: Vak[];
  setVakken: (v: Vak[]) => void;
  gedragAntw: any;
  setGedragAntw: (a: any) => void;
  nederlandsAntw: any;
  setNederlandsAntw: (a: any) => void;
  score: number | null;
  setScore: (s: number | null) => void;
  reportImage: string | null;
  setReportImage: (i: string | null) => void;
  reportMimeType: string | null;
  setReportMimeType: (m: string | null) => void;
  progression: any[];
  setProgression: (p: any[]) => void;
  saveSuccess: boolean;
  setSaveSuccess: (s: boolean) => void;
  hasApiKey: boolean;
  setHasApiKey: (h: boolean) => void;
  showSettings: boolean;
  setShowSettings: (s: boolean) => void;
  showProfile: boolean;
  setShowProfile: (s: boolean) => void;
  showFeedback: boolean;
  setShowFeedback: (s: boolean) => void;
  feedbackRating: number;
  setFeedbackRating: (r: number) => void;
  feedbackMsg: string;
  setFeedbackMsg: (m: string) => void;
  feedbackLoading: boolean;
  feedbackSuccess: boolean;
  setFeedbackSuccess: (s: boolean) => void;
  submitFeedback: () => Promise<void>;
  getAttest: (s: number) => { label: string; kleur: string; emoji: string; tekst: string };
  saveTodayScore: () => Promise<void>;
  logout: () => Promise<void>;
  checkApiKey: () => Promise<void>;
  getApiKey: () => string;
  loading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [school, setSchool] = useState("");
  const [jaar, setJaar] = useState("");
  const [leeftijd, setLeeftijd] = useState("");
  const [richting, setRichting] = useState("");
  const [vakken, setVakken] = useState<Vak[]>([]);
  const [gedragAntw, setGedragAntw] = useState<any>({});
  const [nederlandsAntw, setNederlandsAntw] = useState<any>({});
  const [score, setScore] = useState<number | null>(null);
  const [reportImage, setReportImage] = useState<string | null>(null);
  const [reportMimeType, setReportMimeType] = useState<string | null>(null);
  const [progression, setProgression] = useState<any[]>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  const submitFeedback = async () => {
    if (!feedbackMsg.trim()) return;
    setFeedbackLoading(true);
    try {
      await setDoc(doc(db, "feedback", `fb_${Date.now()}`), {
        uid: currentUser?.uid || "anonymous",
        rating: feedbackRating,
        message: feedbackMsg,
        timestamp: new Date().toISOString(),
        context: { school, jaar, richting, score }
      });
      setFeedbackSuccess(true);
    } catch (e) {
      console.error(e);
    }
    setFeedbackLoading(false);
  };

  const getAttest = (s: number) => {
    if (s >= CONFIG.attestA_drempel) return { label: "Attest A", kleur: "#22C55E", emoji: "🏆", tekst: "Gefeliciteerd! Je bent geslaagd voor dit jaar." };
    if (s >= CONFIG.attestB_drempel) return { label: "Attest B", kleur: "#F59E0B", emoji: "📋", tekst: "Je mag overgaan, maar met bepaalde beperkingen of voorwaarden." };
    return { label: "Attest C", kleur: "#EF4444", emoji: "📌", tekst: "Je slaagt momenteel niet. Je zal dit jaar moeten overdoen of van richting veranderen." };
  };

  const saveTodayScore = async () => {
    if (!currentUser || score === null) return;
    const today = new Date().toISOString().split('T')[0];
    const newEntry = { date: today, score };
    const updatedProgression = [...progression, newEntry];

    try {
      await setDoc(doc(db, "users", currentUser.uid), {
        ...currentUser,
        progression: updatedProgression,
        score: score,
        vakken: vakken,
        gedragAntw: gedragAntw,
        nederlandsAntw: nederlandsAntw
      });
      setProgression(updatedProgression);
      setSaveSuccess(true);
    } catch (e) {
      console.error(e);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setCurrentUser(null);
  };

  const checkApiKey = async () => {
    if (window.aistudio) {
      const ok = await window.aistudio.hasSelectedApiKey();
      setHasApiKey(ok);
    }
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

  useEffect(() => {
    checkApiKey();
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setLoading(true);
        try {
          const snap = await getDocFromServer(doc(db, "users", fbUser.uid));
          if (snap.exists()) {
            const data = snap.data() as UserProfile;
            setCurrentUser({ uid: fbUser.uid, ...data });
            if (data.school) setSchool(data.school);
            if (data.jaar) setJaar(data.jaar);
            if (data.leeftijd) setLeeftijd(data.leeftijd);
            if (data.richting) setRichting(data.richting);
            if (data.vakken) setVakken(data.vakken);
            if (data.gedragAntw) setGedragAntw(data.gedragAntw);
            if (data.nederlandsAntw) setNederlandsAntw(data.nederlandsAntw);
            if (data.score !== undefined) setScore(data.score);
          } else {
            setCurrentUser({ uid: fbUser.uid, naam: fbUser.email?.split('@')[0] || "Gebruiker", email: fbUser.email });
          }
        } catch (error) {
          console.warn("Firestore access error, falling back to basic profile:", error);
          setCurrentUser({ uid: fbUser.uid, naam: fbUser.email?.split('@')[0] || "Gebruiker", email: fbUser.email });
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <AppContext.Provider value={{
      currentUser, setCurrentUser,
      school, setSchool,
      jaar, setJaar,
      leeftijd, setLeeftijd,
      richting, setRichting,
      vakken, setVakken,
      gedragAntw, setGedragAntw,
      nederlandsAntw, setNederlandsAntw,
      score, setScore,
      reportImage, setReportImage,
      reportMimeType, setReportMimeType,
      progression, setProgression,
      saveSuccess, setSaveSuccess,
      hasApiKey, setHasApiKey,
      showSettings, setShowSettings,
      showProfile, setShowProfile,
      showFeedback, setShowFeedback,
      feedbackRating, setFeedbackRating,
      feedbackMsg, setFeedbackMsg,
      feedbackLoading, feedbackSuccess, setFeedbackSuccess,
      submitFeedback,
      getAttest,
      saveTodayScore,
      logout, checkApiKey, getApiKey,
      loading
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
