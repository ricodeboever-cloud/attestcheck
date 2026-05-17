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

// API Routes
app.post("/api/analyze-report", async (req, res) => {
  if (!apiKey) {
    return res.status(401).json({ error: "De AI coach is nog niet geconfigureerd. Voeg een GEMINI_API_KEY toe aan de Secrets." });
  }
  try {
    const { parts } = req.body;
    
    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts }],
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
      }
    });

    res.json({ text: result.text });
  } catch (error: any) {
    console.error("OCR Error:", error);
    res.status(500).json({ error: error.message || "Er is iets misgegaan bij de AI." });
  }
});

app.post("/api/get-feedback", async (req, res) => {
  if (!apiKey) {
    return res.status(401).json({ error: "De AI coach is nog niet geconfigureerd. Voeg een GEMINI_API_KEY toe aan de Secrets." });
  }
  try {
    const { prompt, image, mimeType } = req.body;
    
    const contents: any[] = [{ text: prompt }];
    if (image) {
      contents.push({
        inlineData: {
          mimeType: mimeType || "image/jpeg",
          data: image
        }
      });
    }

    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: contents }],
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

    res.json({ text: result.text });
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
    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: responseMimeType || "text/plain",
      }
    });
    res.json({ text: result.text });
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
