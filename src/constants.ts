export const OR = "#F47920";
export const ORL = "#FF9F45";
export const ORD = "#C85E10";
export const ORBG = "#FFF5EC";
export const ORPL = "#FFE4C4";

export const CONFIG = {
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
    { id: "focus_master", name: "Focus Meester 🏆", description: "Voltooi 25 focus punten.", requirement: (user: any) => (user.focusPoints?.filter((p: any) => p.completed).length || 0) >= 25 },
    { id: "focus_legend", name: "Focus Legende 🌌", description: "Voltooi 50 focus punten.", requirement: (user: any) => (user.focusPoints?.filter((p: any) => p.completed).length || 0) >= 50 },
    { id: "focus_god", name: "Focus God-mode ⚡", description: "Voltooi 100 focus punten.", requirement: (user: any) => (user.focusPoints?.filter((p: any) => p.completed).length || 0) >= 100 },
    { id: "veteran", name: "Rapport Radar Veteraan 🎖️", description: "Sla 3 verschillende scores op.", requirement: (user: any, progression: any[]) => (progression?.length || 0) >= 3 },
    { id: "rising_star", name: "Stijgende Lijn 📈", description: "Heb een stijgende trend in je progressie.", requirement: (user: any, progression: any[]) => {
      if (!progression || progression.length < 2) return false;
      return progression[progression.length - 1].score > progression[0].score;
    }},
    { id: "math_wizard", name: "Wiskunde Wonder 🔢", description: "Behaal meer dan 85% op Wiskunde.", requirement: (user: any) => user.vakken?.some((v: any) => v.naam.toLowerCase().includes('wiskunde') && (parseFloat(v.punt)/parseFloat(v.maxPunt)) >= 0.85) },
    { id: "language_hero", name: "Talenknobbel 🗣️", description: "Behaal een topscore op een taalvak (NL, FR of ENG).", requirement: (user: any) => user.vakken?.some((v: any) => (v.naam.toLowerCase().includes('frans') || v.naam.toLowerCase().includes('engels') || v.naam.toLowerCase().includes('nederlands')) && (parseFloat(v.punt)/parseFloat(v.maxPunt)) >= 0.85) },
    { id: "behavior_star", name: "Modelstudent ✨", description: "Scoor maximaal op al je gedragsvragen.", requirement: (user: any) => Object.keys(user.gedragAntw || {}).length >= 5 && Object.values(user.gedragAntw || {}).every(v => v === 5) },
    { id: "perfectionist", name: "Perfectionist 💎", description: "Behaal een totale score van meer dan 90%.", requirement: (user: any) => (user.score || 0) >= 90 },
    { id: "comeback_kid", name: "Comeback Kid 🔝", description: "Verbeter je score met meer dan 10% in één meting.", requirement: (user: any, progression: any[]) => {
      if (!progression || progression.length < 2) return false;
      return (progression[progression.length - 1].score - progression[progression.length - 2].score) >= 10;
    }},
    { id: "heavy_lifter", name: "Zware Lader 🏋️", description: "Behaal meer dan 75% op al je hoofdvakken.", requirement: (user: any) => {
      const hoofdvakken = user.vakken?.filter((v: any) => v.isHoofdvak);
      return hoofdvakken && hoofdvakken.length > 0 && hoofdvakken.every((v: any) => (parseFloat(v.punt)/parseFloat(v.maxPunt)) >= 0.75);
    }},
    { id: "early_bird", name: "Vroege Vogel 🐦", description: "Voer een analyse uit voor 8u 's ochtends.", requirement: () => new Date().getHours() < 8 },
  ]
};

export const RANKS = [
  { min: 0,      name: "Starter 🔰", color: "#94A3B8" },
  { min: 50,     name: "Nieuwkomer ✨", color: "#CBD5E1" },
  { min: 100,    name: "Groeier 🌱", color: "#22C55E" },
  { min: 150,    name: "Verkenner  Telescope", color: "#4ADE80" },
  { min: 200,    name: "Doorzetter 🏃", color: "#86EFAC" },
  { min: 250,    name: "Ontdekker 🗺️", color: "#3B82F6" },
  { min: 300,    name: "Strijder 💪", color: "#60A5FA" },
  { min: 400,    name: "Klimmer 🧗", color: "#93C5FD" },
  { min: 500,    name: "Talent 🌟", color: "#FACC15" },
  { min: 600,    name: "Expert 🎓", color: "#A855F7" },
  { min: 700,    name: "Specialist 🧪", color: "#C084FC" },
  { min: 800,    name: "Gevorderde 🚀", color: "#E879F9" },
  { min: 900,    name: "Prof 👨‍🏫", color: "#F472B6" },
  { min: 1000,   name: "Meester 🏆", color: "#F59E0B" },
  { min: 1500,   name: "Mentor 🧠", color: "#D946EF" },
  { min: 2000,   name: "Elite 💎", color: "#EF4444" },
  { min: 3000,   name: "Legende 🛡️", color: "#FB923C" },
  { min: 5000,   name: "Kampioen 🥇", color: "#F97316" },
  { min: 7500,   name: "Grootmeester 🏛️", color: "#EA580C" },
  { min: 10000,  name: "Fenomeen 🎇", color: "#C026D3" },
  { min: 15000,  name: "Titan ⚡", color: "#4F46E5" },
  { min: 20000,  name: "Oracle 👁️", color: "#7C3AED" },
  { min: 30000,  name: "Overlord 👑", color: "#9333EA" },
  { min: 45000,  name: "Demi-God 🌪️", color: "#DB2777" },
  { min: 60000,  name: "Alwetende ♾️", color: "#E11D48" },
  { min: 80000,  name: "Universeel Genie 🌌", color: "#F43F5E" },
  { min: 100000, name: "Oneindige Wijsheid 🏮", color: "#FF0000" },
];

export const getRankInfo = (xp: number) => {
  return [...RANKS].reverse().find(r => xp >= r.min) || RANKS[0];
};

export const S: any = {
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

