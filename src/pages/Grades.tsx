import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { OR, S, ORPL, ORD, ORBG } from '../constants';
import { GoogleGenAI } from "@google/genai";

const Grades: React.FC = () => {
  const navigate = useNavigate();
  const { 
    vakken, setVakken, 
    setReportImage, 
    getApiKey, 
    setFbError, 
    setFbLoad 
  } = useApp();

  const [ocrLoad, setOcrLoad] = useState(false);

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

  const handleOCR = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setOcrLoad(true);
    setFbError("");
    try {
      const apiKey = getApiKey();
      if (!apiKey) throw new Error("Geen API key.");
      
      const ai = new GoogleGenAI({ apiKey });
      const parts: any[] = [{ text: OCR_PROMPT }];
      
      for (let i = 0; i < files.length; i++) {
        const base64 = await toBase64(files[i]);
        parts.push({
          inlineData: {
            mimeType: files[i].type,
            data: base64.split(',')[1]
          }
        });
        if (i === 0) setReportImage(base64.split(',')[1]);
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts },
        config: { responseMimeType: "application/json" }
      });

      const text = response.text;
      const data = JSON.parse(text || "[]");
      
      if (data.length > 0) {
        const newVakken = data.map((v: any) => ({
          id: Math.random().toString(36).substr(2, 9),
          naam: v.naam,
          punt: v.punt,
          maxPunt: v.maxPunt || "100",
          isHoofdvak: false
        }));
        setVakken(newVakken);
      } else {
        setFbError("Geen vakken gevonden op de afbeelding. Probeer een duidelijkere foto.");
      }
    } catch (err: any) {
      console.error(err);
      setFbError("Fout bij het lezen van het rapport: " + err.message);
    }
    setOcrLoad(false);
  };

  const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });

  const voegVakToe = () => {
    setVakken([...vakken, { id: Date.now().toString(), naam: "", punt: "", maxPunt: "100", isHoofdvak: false }]);
  };

  const updateVak = (id: string, veld: string, waarde: any) => {
    setVakken(vakken.map(v => v.id === id ? { ...v, [veld]: waarde } : v));
  };

  const verwijderVak = (id: string) => {
    setVakken(vakken.filter(v => v.id !== id));
  };

  return (
    <div>
      <button style={S.back} onClick={()=>navigate("/dashboard")}>← Terug</button>
      <div style={S.card}>
        <h2 style={S.h2}>Stap 1: Jouw Punten 📊</h2>
        <p style={{...S.sub, marginBottom:20}}>Upload een foto van je rapport of vul je punten handmatig in.</p>
        
        <div style={{marginBottom:24}}>
          <label style={{...S.btnSec, display:"flex", alignItems:"center", justifyContent:"center", gap:10, cursor:"pointer", background:ocrLoad?ORBG:"white"}}>
            {ocrLoad ? "⌛ Bezig met scannen..." : "📸 Scan Rapport (Foto/PDF)"}
            <input type="file" multiple accept="image/*,application/pdf" style={{display:"none"}} onChange={handleOCR} disabled={ocrLoad} />
          </label>
        </div>

        <div style={{display:"flex", flexDirection:"column", gap:12, marginBottom:20}}>
          {vakken.map(v => (
            <div key={v.id} style={{display:"flex", gap:8, alignItems:"center", background:"#F9FAFB", padding:12, borderRadius:16, border:"1px solid #F3F4F6"}}>
              <div style={{flex:1}}>
                <input 
                  style={{...S.input, marginBottom:0, padding:"8px 12px", fontSize:14}} 
                  value={v.naam} 
                  onChange={e=>updateVak(v.id, "naam", e.target.value)} 
                  placeholder="Vaknaam" 
                />
              </div>
              <div style={{width:60}}>
                <input 
                  style={{...S.input, marginBottom:0, padding:"8px 8px", fontSize:14, textAlign:"center"}} 
                  value={v.punt} 
                  onChange={e=>updateVak(v.id, "punt", e.target.value)} 
                  placeholder="Punt" 
                />
              </div>
              <div style={{color:"#9CA3AF", fontWeight:800}}>/</div>
              <div style={{width:60}}>
                <input 
                  style={{...S.input, marginBottom:0, padding:"8px 8px", fontSize:14, textAlign:"center"}} 
                  value={v.maxPunt} 
                  onChange={e=>updateVak(v.id, "maxPunt", e.target.value)} 
                  placeholder="Max" 
                />
              </div>
              <button onClick={()=>verwijderVak(v.id)} style={{background:"none", border:"none", cursor:"pointer", fontSize:18}}>🗑️</button>
            </div>
          ))}
        </div>

        <button style={{...S.btnSec, borderStyle:"dashed", marginBottom:24}} onClick={voegVakToe}>
          ➕ Vak toevoegen
        </button>

        <button 
          style={{...S.btn, opacity: vakken.length > 0 ? 1 : 0.5}} 
          onClick={()=>navigate("/important-subjects")}
          disabled={vakken.length === 0}
        >
          Volgende Stap ➡️
        </button>
      </div>
    </div>
  );
};

export default Grades;
