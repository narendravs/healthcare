import { NextResponse } from "next/server";
import { executeDocQuery } from "@/app/api/mcp-client-remote/mcp-doc-client";
import { executeAgentQuery } from "@/app/api/aiagents/langchainAgent";
import { executeDBQuery } from "@/app/api/mcp-client-remote/mcp-db-client";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

// Use standard, reliably supported models on HF Serverless
const STT_MODEL = "openai/whisper-large-v3";
const TTS_MODEL = "facebook/mms-tts-eng";

/**
 * Direct execution router without self-referencing HTTP fetches
 */
async function executeDynamicSourceQuery(
  query: string,
  source: "documents" | "database" | "apicall",
  sessionId: string
) {
  switch (source) {
    case "database": {
      const data = await executeDBQuery(query);
      return {
        result: data?.answer || "No response received from Database.",
        meta: { source: "Database", tableName: data?.tableName },
      };
    }

    case "apicall": {
      const data = await executeAgentQuery(query, sessionId);
      return {
        result: data?.output || "No response received from API Agent.",
        meta: { source: "API Call Agent", action: data?.action },
      };
    }

    case "documents":
    default: {
      const data = await executeDocQuery(query);
      return {
        result: data?.answer || "No response received from Documents.",
        meta: { source: "Documents" },
      };
    }
  }
}

export async function POST(request: Request) {
  try {
    // 🛡️ 1. Safe Body Extraction Guard
    const rawText = await request.text();
    if (!rawText || rawText.trim() === "") {
      console.error("Speech API Error: Received empty request body from client.");
      return NextResponse.json({ error: "Empty request body received." }, { status: 400 });
    }

    let action: string;
    let payload: any;
    let source: any;
    let sessionId: string | undefined;

    try {
      const parsedBody = JSON.parse(rawText);
      action = parsedBody.action;
      payload = parsedBody.payload;
      source = parsedBody.source || "documents"; // Default to documents if not specified
      sessionId = parsedBody.sessionId;
    } catch (parseError) {
      console.error("Speech API Error: Failed to parse JSON body:", rawText.slice(0, 100));
      return NextResponse.json({ error: "Invalid JSON format in request body." }, { status: 400 });
    }

    const host = request.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";

    // 🎙️ 2. STT PATH: Speech-to-Text
    if (action === "speech-to-text") {
      if (!payload) {
        return NextResponse.json({ error: "Missing audio payload" }, { status: 400 });
      }

      const base64Audio = payload.replace(/^data:audio\/\w+;base64,/, "");
      const audioBuffer = Buffer.from(base64Audio, "base64");

      // Direct binary POST to HF pipeline endpoint
      const sttResponse = await fetch(
        `https://router.huggingface.co/hf-inference/models/${STT_MODEL}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
            "Content-Type": "audio/webm",
          },
          body: audioBuffer,
        }
      );

      const rawResponseText = await sttResponse.text();
      let sttData: any = {};

      try {
        sttData = JSON.parse(rawResponseText);
      } catch (err) {
        console.error("HF STT Non-JSON Response:", rawResponseText);
        return NextResponse.json(
          {
            error: "Hugging Face endpoint returned non-JSON error",
            raw: rawResponseText,
            status: sttResponse.status,
          },
          { status: sttResponse.status || 500 }
        );
      }

      console.log("=== STT DEBUG LOGS ===");
      console.log("STT Status Code:", sttResponse.status);
      console.log("STT Output:", JSON.stringify(sttData));

      if (
        sttData.error &&
        typeof sttData.error === "string" &&
        sttData.error.toLowerCase().includes("loading")
      ) {
        return NextResponse.json(
          { error: "Model warming up. Please retry in 10 seconds." },
          { status: 503 }
        );
      }
      const transcribedText = Array.isArray(sttData) ? sttData[0]?.text : sttData?.text || "";
      if (!transcribedText) {
        return NextResponse.json(
          { error: "Failed to transcribe audio", details: sttData },
          { status: 400 }
        );
      }
      const mcpData = await executeDynamicSourceQuery(transcribedText, source, sessionId);
      return NextResponse.json({
        transcribedText,
        result: mcpData.result,
        meta: mcpData.meta,
      });
    }

    // 🔊 3. TTS PATH: Text-to-Speech
    if (action === "text-to-speech") {
      const text = payload?.text || payload;
      console.log("Payload data", text);
      if (!text) {
        return NextResponse.json({ error: "Missing text in payload for TTS" }, { status: 400 });
      }

      const mcpData = await executeDynamicSourceQuery(text, source, sessionId);
      const responseText = mcpData.result || "No response from MCP";
      //const responseText = "This is a sample text-to-speech response.";
      const cleanedSpeechText = responseText.replace(/[\*\_~`>#\-\+]/g, "").trim();

      console.log("=== TTS DEBUG LOGS ===");
      // console.log("TTS Status Code:", mcpData.status);
      console.log("TTS Output:", JSON.stringify(cleanedSpeechText));

      // 1. Call Groq Speech API
      const response = await groq.audio.speech.create({
        model: "canopylabs/orpheus-v1-english", // Main Groq English TTS model
        voice: "autumn", // Options: autumn, diana, hannah, austin, daniel, troy
        response_format: "wav",
        input: cleanedSpeechText,
      });

      // 2. Convert raw arrayBuffer to base64
      const audioBuffer = Buffer.from(await response.arrayBuffer());

      return NextResponse.json({
        result: text,
        audio: `data:audio/wav;base64,${audioBuffer.toString("base64")}`,
      });
      return NextResponse.json({ error: "Invalid action specified" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Speech API Exception:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
