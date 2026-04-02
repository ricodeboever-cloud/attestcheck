import React from 'react';
import { useApp } from '../context/AppContext';
import { S, OR, ORBG } from '../constants';

const FeedbackModal: React.FC = () => {
  const { 
    showFeedback, setShowFeedback, 
    feedbackRating, setFeedbackRating, 
    feedbackMsg, setFeedbackMsg, 
    feedbackLoading, feedbackSuccess, setFeedbackSuccess, 
    submitFeedback 
  } = useApp();

  if (!showFeedback) return null;

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1100,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{...S.card, width:"100%", maxWidth:400, marginBottom:0}}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16}}>
          <h2 style={S.h2}>💡 Jouw Feedback</h2>
          <button 
            style={{background:"none", border:"none", fontSize:20, cursor:"pointer", color:"#8B6242"}}
            onClick={() => { setShowFeedback(false); setFeedbackSuccess(false); }}
          >✕</button>
        </div>

        {feedbackSuccess ? (
          <div style={{textAlign:"center", padding:"20px 0"}}>
            <div style={{fontSize:48, marginBottom:16}}>🚀</div>
            <h3 style={{...S.h2, color:"#15803D"}}>Bedankt!</h3>
            <p style={S.sub}>Je feedback is verzonden. We gaan ermee aan de slag!</p>
            <button style={{...S.btn, marginTop:24}} onClick={() => { setShowFeedback(false); setFeedbackSuccess(false); }}>Sluiten</button>
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

export default FeedbackModal;
