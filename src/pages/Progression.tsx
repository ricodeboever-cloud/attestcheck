import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { OR, S, ORPL, ORD, ORL } from '../constants';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, ReferenceLine 
} from 'recharts';

const Progression: React.FC = () => {
  const navigate = useNavigate();
  const { progression } = useApp();

  const calculatePrognosis = (data: any[]) => {
    if (data.length < 2) return null;
    const last = data[data.length - 1].score;
    const prev = data[data.length - 2].score;
    const diff = last - prev;
    const trend = diff > 0 ? "stijgend" : (diff < 0 ? "dalend" : "stabiel");
    const next = Math.max(0, Math.min(100, last + diff));
    return { trend, next, diff: Math.abs(diff) };
  };

  const prognosis = calculatePrognosis(progression);

  return (
    <div style={{ paddingBottom: 40 }}>
      <button style={S.back} onClick={() => navigate("/dashboard")}>← Terug naar dashboard</button>
      
      <div style={S.card}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📈</div>
          <h2 style={S.h2}>Mijn Progressie</h2>
          <p style={S.sub}>Volg je groei doorheen het jaar. Elke dag telt!</p>
        </div>

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
            <h3 style={{ fontWeight: 900, color: "#2D1B00", fontSize: 16, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <span>🔮</span> Prognose Attestering
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ 
                width: 64, height: 64, borderRadius: 100, 
                background: "white", border: `4px solid ${prognosis.trend === "stijgend" ? "#22C55E" : (prognosis.trend === "dalend" ? "#EF4444" : "#F59E0B")}`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900, color: "#1E293B"
              }}>
                {prognosis.next}%
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, color: "#2D1B00", fontWeight: 800, margin: 0 }}>
                  Trend is <span style={{ color: prognosis.trend === "stijgend" ? "#22C55E" : (prognosis.trend === "dalend" ? "#EF4444" : "#F59E0B") }}>{prognosis.trend}</span>
                </p>
                <p style={{ fontSize: 12, color: "#64748B", fontWeight: 700, margin: "4px 0 0" }}>
                  Verandering van {prognosis.diff}% t.o.v. vorige meting.
                </p>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {progression.slice().reverse().map((p: any, i: number) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "#F8FAFC", borderRadius: 16, border: "1px solid #E2E8F0" }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#1E293B" }}>{p.date.split('-').reverse().join('/')}</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: OR }}>{p.score}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Progression;
