import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, getDocFromServer, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { GoogleGenAI, Type } from "@google/genai";
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

export interface FocusPoint {
  id: string;
  text: string;
  completed: boolean;
  xpValue: number;
  createdAt: string;
}

export interface FeedbackData {
  predictedAttest: "A" | "B" | "C";
  attests: {
    [key in "A" | "B" | "C"]: {
      status: string;
      title: string;
      description: string;
      actionPlan: string[];
      consequences: string;
      emoji: string;
    };
  };
  motivation: string;
  focusPoints: string[];
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
  focusPoints?: FocusPoint[];
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
  fbData: FeedbackData | null;
  setFbData: (d: FeedbackData | null) => void;
  fbLoad: boolean;
  setFbLoad: (l: boolean) => void;
  fbError: string;
  setFbError: (e: string) => void;
  reportImage: string | null;
  setReportImage: (i: string | null) => void;
  progression: any[];
  setProgression: (p: any[]) => void;
  saveSuccess: boolean;
  setSaveSuccess: (s: boolean) => void;
  hasApiKey: boolean;
  setHasApiKey: (h: boolean) => void;
  selectedAttest: "A" | "B" | "C" | null;
  setSelectedAttest: (a: "A" | "B" | "C" | null) => void;
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
  toggleFocusPoint: (id: string) => Promise<void>;
  getAttest: (s: number) => { label: string; kleur: string; emoji: string; tekst: string };
  vraagFeedback: () => Promise<void>;
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
  const [fbData, setFbData] = useState<FeedbackData | null>(null);
  const [fbLoad, setFbLoad] = useState(false);
  const [fbError, setFbError] = useState("");
  const [reportImage, setReportImage] = useState<string | null>(null);
  const [progression, setProgression] = useState<any[]>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(true);
  const [selectedAttest, setSelectedAttest] = useState<"A" | "B" | "C" | null>(null);
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

  const vraagFeedback = async () => {
    if (score === null) return;
    setFbLoad(true);
    setFbError("");
    try {
      const ingevuld = vakken.filter(v => v.punt !== "" && !isNaN(parseFloat(v.punt)));
      const vakInfo = ingevuld.map(v => {
        const p = Math.round((parseFloat(v.punt) / parseFloat(v.maxPunt)) * 100);
        return `${v.naam}${v.isHoofdvak ? " (HOOFDVAK ⭐)" : ""}: ${v.punt}/${v.maxPunt} (${p}%)`;
      }).join(", ");
      const gedragInfo = CONFIG.gedragsVragen.map(v =>
        gedragAntw[v.id] ? `${v.vraag}: ${gedragAntw[v.id]}/5` : ""
      ).filter(Boolean).join("; ");

      const nedInfo = CONFIG.nederlandsVragen.map(v =>
        nederlandsAntw[v.id] ? `${v.vraag}: ${nederlandsAntw[v.id]}` : ""
      ).filter(Boolean).join("; ");

      const attest = getAttest(score);
      const apiKey = getApiKey();
      if (!apiKey) {
        setHasApiKey(false);
        throw new Error("Gemini API key is niet geconfigureerd.");
      }

      const ai = new GoogleGenAI({ apiKey });

      const prompt = `Je bent een deskundige Belgische schoolcoach (expert in het Vlaamse onderwijssysteem).
Analyseer de resultaten van ${currentUser?.naam || "de student"} (${jaar}).
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

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
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

      const data = JSON.parse(text) as FeedbackData;
      if (!data.predictedAttest || !data.attests) throw new Error("Ongeldige data ontvangen.");

      if (data.focusPoints && currentUser) {
        const newFocusPoints: FocusPoint[] = data.focusPoints.map((text, i) => ({
          id: `fp_${Date.now()}_${i}`,
          text,
          completed: false,
          xpValue: 20,
          createdAt: new Date().toISOString()
        }));

        const updatedUser = {
          ...currentUser,
          focusPoints: newFocusPoints,
          xp: (currentUser.xp || 0) + 50,
          rank: getRankInfo((currentUser.xp || 0) + 50).name
        };
        await setDoc(doc(db, "users", currentUser.uid), updatedUser);
        setCurrentUser(updatedUser);
      }

      setFbData(data);
      setSelectedAttest(data.predictedAttest);
    } catch (error: any) {
      console.error("AI Feedback Error:", error);
      let msg = "Oeps! De coach kon je rapport even niet lezen. Probeer het nog eens! 🔄";
      if (error?.message?.includes("API key") || error?.message?.includes("403") || error?.message?.includes("permission")) {
        msg = "De coach heeft geen toegang tot de AI. Klik op de knop hieronder om dit op te lossen.";
        setHasApiKey(false);
      } else if (error?.message?.includes("quota") || error?.message?.includes("429")) {
        msg = "De coach is even overbelast (limiet bereikt). Wacht een minuutje en probeer het opnieuw.";
      }
      setFbError(msg);
    }
    setFbLoad(false);
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

  const toggleFocusPoint = async (id: string) => {
    if (!currentUser || !currentUser.focusPoints) return;
    const newPoints = currentUser.focusPoints.map(p => {
      if (p.id === id && !p.completed) {
        return { ...p, completed: true };
      }
      return p;
    });
    
    const point = currentUser.focusPoints.find(p => p.id === id);
    if (point && !point.completed) {
      const newXp = (currentUser.xp || 0) + point.xpValue;
      const newRank = getRankInfo(newXp).name;
      const updatedUser = { ...currentUser, focusPoints: newPoints, xp: newXp, rank: newRank };
      await setDoc(doc(db, "users", currentUser.uid), updatedUser);
      setCurrentUser(updatedUser);
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
    return (process.env.API_KEY || process.env.GEMINI_API_KEY || "");
  };

  useEffect(() => {
    checkApiKey();
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const snap = await getDoc(doc(db, "users", fbUser.uid));
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
          console.error("Error loading user profile:", error);
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
      fbData, setFbData,
      fbLoad, setFbLoad,
      fbError, setFbError,
      reportImage, setReportImage,
      progression, setProgression,
      saveSuccess, setSaveSuccess,
      hasApiKey, setHasApiKey,
      selectedAttest, setSelectedAttest,
      showSettings, setShowSettings,
      showProfile, setShowProfile,
      showFeedback, setShowFeedback,
      feedbackRating, setFeedbackRating,
      feedbackMsg, setFeedbackMsg,
      feedbackLoading, feedbackSuccess, setFeedbackSuccess,
      submitFeedback,
      toggleFocusPoint,
      getAttest,
      vraagFeedback,
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
