export const OR = "#F47920";
export const ORL = "#FF9E5E";
export const ORD = "#B45309";
export const ORBG = "#FFF7ED";
export const ORPL = "#FFEDD5";

export const CONFIG = {
  hoofdvakMultiplier: 3,
  puntenGewicht: 0.88,
  gedragGewicht: 0.12,
  attestA_drempel: 70,
  attestB_drempel: 50,
  gedragsVragen: [
    { id: "stipt", vraag: "Ben je altijd op tijd in de les?", icon: "⏰" },
    { id: "huiswerk", vraag: "Maak je al je huiswerk en taken?", icon: "📚" },
    { id: "inzet", vraag: "Toon je actieve inzet tijdens de les?", icon: "💪" },
    { id: "respect", vraag: "Heb je respect voor leerkrachten en medeleerlingen?", icon: "🤝" }
  ],
  nederlandsVragen: [
    { id: "begrijpen", vraag: "Begrijp je de uitleg van de leerkracht vlot?", opties: ["Altijd", "Meestal", "Soms", "Moeilijk"] },
    { id: "spreken", vraag: "Durf je vlot spreken in de klas?", opties: ["Altijd", "Meestal", "Soms", "Moeilijk"] }
  ]
};

export const RANKS = [
  { min: 0, name: "Nieuweling 🐣", color: "#94A3B8" },
  { min: 100, name: "Groeier 🌱", color: "#22C55E" },
  { min: 300, name: "Strijder ⚔️", color: "#3B82F6" },
  { min: 600, name: "Expert 🎓", color: "#8B5CF6" },
  { min: 1000, name: "Legende 👑", color: "#F59E0B" }
];

export const getRankInfo = (xp: number) => {
  return [...RANKS].reverse().find(r => xp >= r.min) || RANKS[0];
};

export const REFERRAL_RANKS = [
  { min: 0, name: "Rekruut", icon: "🔰" },
  { min: 1, name: "Soldaat", icon: "🎖️" },
  { min: 3, name: "Korporaal", icon: "🔱" },
  { min: 5, name: "Sergeant", icon: "⚜️" },
  { min: 10, name: "Luitenant", icon: "⚔️" },
  { min: 20, name: "Kapitein", icon: "🦅" },
  { min: 50, name: "Majoor", icon: "🛡️" },
  { min: 100, name: "Generaal", icon: "👑" },
];

export const getReferralRankInfo = (referrals: number) => {
  return [...REFERRAL_RANKS].reverse().find(r => referrals >= r.min) || REFERRAL_RANKS[0];
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
