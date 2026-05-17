import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase limit for image uploads
app.use(express.json({ limit: "20mb" }));

// Initialize Gemini
const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
if (!apiKey) {
  console.warn("GEMINI_API_KEY is not set. AI features will fail.");
}
const genAI = new GoogleGenAI({ apiKey: apiKey || "MISSING_KEY" });

// Helper to call Gemini with retries and cleaner errors
async function callGemini(params: { contents: any[], config?: any, schema?: any }) {
  const models = ["gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-1.5-pro"];
  let lastError: any = null;

  for (const modelName of models) {
    try {
      const result = await genAI.models.generateContent({
        model: modelName,
        contents: params.contents,
        config: {
          ...params.config,
          responseSchema: params.schema,
        }
      });
      return result.text;
    } catch (error: any) {
      lastError = error;
      console.warn(`Model ${modelName} failed, trying next...`, error.status || error.message);
      // If it's a quota error (429), it might apply to all models, but we still try others just in case
      continue;
    }
  }

  // If we get here, all models failed
  let friendlyMessage = "De AI coach is op dit moment niet bereikbaar.";
  if (lastError?.status === 429 || lastError?.message?.includes("429") || lastError?.message?.includes("quota")) {
    friendlyMessage = "De AI coach heeft zijn limiet voor vandaag bereikt of is even overbelast. Wacht een minuutje of probeer het morgen opnieuw.";
  } else if (lastError?.status === 401 || lastError?.status === 403) {
    friendlyMessage = "Er is een probleem met de toegang (API-sleutel). Controleer de instellingen.";
  }
  
  throw new Error(friendlyMessage);
}

// API Routes
app.post("/api/analyze-report", async (req, res) => {
  if (!apiKey) {
    return res.status(401).json({ error: "De AI coach is nog niet geconfigureerd. Voeg een GEMINI_API_KEY toe aan de Secrets." });
  }
  try {
    const { parts } = req.body;
    const text = await callGemini({
      contents: [{ role: "user", parts }],
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
      }
    });

    res.json({ text });
  } catch (error: any) {
    console.error("OCR Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/get-feedback", async (req, res) => {
  if (!apiKey) {
    return res.status(401).json({ error: "De AI coach is nog niet geconfigureerd. Voeg een GEMINI_API_KEY toe aan de Secrets." });
  }
  try {
    const { prompt, image, mimeType } = req.body;
    
    const contents: any[] = [{ role: "user", parts: [{ text: prompt }] }];
    if (image) {
      (contents[0].parts as any[]).push({
        inlineData: {
          mimeType: mimeType || "image/jpeg",
          data: image
        }
      });
    }

    const text = await callGemini({
      contents,
      config: {
        responseMimeType: "application/json",
      },
      schema: {
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
    });

    res.json({ text });
  } catch (error: any) {
    console.error("AI Feedback Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/chat", async (req, res) => {
  if (!apiKey) {
    return res.status(401).json({ error: "De AI coach is nog niet geconfigureerd. Voeg een GEMINI_API_KEY toe aan de Secrets." });
  }
  try {
    const { prompt, responseMimeType } = req.body;
    const text = await callGemini({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: responseMimeType || "text/plain",
      }
    });
    res.json({ text });
  } catch (error: any) {
    console.error("Chat Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Vite middleware for development
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

setupVite();
