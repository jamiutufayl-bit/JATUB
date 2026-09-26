import express from "express";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

const PORT = process.env.PORT || 10000;

if (!process.env.OPENAI_API_KEY) {
  console.error("ERROR: OPENAI_API_KEY is missing.");
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({
  limit: "25mb"
}));

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);


/* =========================
   HEALTH CHECK
========================= */

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    app: "JATUB AI",
    status: "online"
  });
});


/* =========================
   CHAT
========================= */

app.post("/api/chat", async (req, res) => {

  try {

    const {
      message,
      history = [],
      thinkHarder = false
    } = req.body;

    if (
      !message ||
      typeof message !== "string"
    ) {
      return res.status(400).json({
        ok: false,
        error: "Message is required."
      });
    }

    const safeHistory =
      Array.isArray(history)
        ? history
            .filter(item =>
              item &&
              typeof item.content === "string" &&
              (
                item.role === "user" ||
                item.role === "assistant"
              )
            )
            .slice(-30)
        : [];

    const input = [
      {
        role: "system",
        content:
          "You are JATUB AI, a helpful AI assistant. " +
          "Answer naturally, clearly and accurately. " +
          "Use markdown when useful."
      },

      ...safeHistory.map(item => ({
        role: item.role,
        content: item.content
      })),

      {
        role: "user",
        content: message
      }
    ];

    const response =
      await openai.responses.create({

        model: "gpt-5.6-luna",

        input,

        reasoning: {
          effort:
            thinkHarder
              ? "high"
              : "low"
        }
      });

    res.json({
      ok: true,
      text:
        response.output_text ||
        "I couldn't generate a response."
    });

  } catch (error) {

    console.error(
      "CHAT ERROR:",
      error
    );

    res.status(500).json({
      ok: false,
      error:
        error?.message ||
        "AI request failed."
    });
  }
});


/* =========================
   IMAGE GENERATION
========================= */

app.post("/api/image", async (req, res) => {

  try {

    const {
      prompt
    } = req.body;

    if (
      !prompt ||
      typeof prompt !== "string"
    ) {
      return res.status(400).json({
        ok: false,
        error: "Image prompt is required."
      });
    }

    const response =
      await openai.responses.create({

        model: "gpt-5.6-luna",

        input:
          "Create an image based on this request: " +
          prompt,

        tools: [
          {
            type: "image_generation"
          }
        ]
      });

    const imageCall =
      response.output?.find(
        item =>
          item.type ===
          "image_generation_call"
      );

    if (
      !imageCall ||
      !imageCall.result
    ) {
      return res.status(500).json({
        ok: false,
        error:
          "No image was returned."
      });
    }

    res.json({
      ok: true,
      image:
        "data:image/png;base64," +
        imageCall.result
    });

  } catch (error) {

    console.error(
      "IMAGE ERROR:",
      error
    );

    res.status(500).json({
      ok: false,
      error:
        error?.message ||
        "Image generation failed."
    });
  }
});


/* =========================
   CATCH-ALL
========================= */

app.get("*", (req, res) => {

  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );

});


/* =========================
   START SERVER
========================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `JATUB AI running on port ${PORT}`
    );

  }
);
