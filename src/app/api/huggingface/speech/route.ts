import { NextResponse } from "next/server";
import { executeDocQuery } from "../../mcp-client-remote/mcp-doc-client/route";
import { executeAgentQuery } from "../../aiagents/langchainAgent/route";
import { executeDBQuery } from "../../mcp-client-remote/mcp-db-client/route";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

// Use standard, reliably supported models on HF Serverless
const STT_MODEL = "whisper-large-v3-turbo";
const TTS_MODEL = "canopylabs/orpheus-v1-english";

/**
 * Direct execution router without self-referencing HTTP fetches
 */
async function executeDynamicSourceQuery(
  query: string,
  source: "documents" | "database" | "apicall",
  sessionId: string,
  targetLanguage: string
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
      const data = await executeAgentQuery(query, sessionId, targetLanguage);
      return {
        result: data?.output || "No response received from API Agent.",
        meta: { source: "API Call Agent", action: data?.action },
      };
    }

    case "documents":
    default: {
      const data = await executeDocQuery(query);
      return {
        result: data?.result || data?.answer || "No response received from Documents.",
        meta: { source: "Documents", ...(data?.meta || {}) },
      };
    }
  }
}

/**
 * Split text into sub-200-character sentence chunks for Groq TTS
 */
function chunkTextForTTS(text: string, maxLength: number = 190): string[] {
  // Match sentences ending in punctuation
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    if ((currentChunk + " " + trimmed).trim().length <= maxLength) {
      currentChunk = (currentChunk + " " + trimmed).trim();
    } else {
      if (currentChunk) chunks.push(currentChunk);
      // If a single sentence exceeds maxLength, hard slice it
      if (trimmed.length > maxLength) {
        let remaining = trimmed;
        while (remaining.length > 0) {
          chunks.push(remaining.slice(0, maxLength));
          remaining = remaining.slice(maxLength);
        }
        currentChunk = "";
      } else {
        currentChunk = trimmed;
      }
    }
  }

  if (currentChunk) chunks.push(currentChunk);
  return chunks;
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
    let targetLanguage: string | undefined;

    try {
      const parsedBody = JSON.parse(rawText);
      action = parsedBody.action;
      payload = parsedBody.payload;
      source = parsedBody.source || payload?.source || "documents"; // Default to documents if not specified
      sessionId = parsedBody.sessionId || payload?.sessionId;
      targetLanguage = parsedBody.targetLanguage || payload?.targetLanguage;

      // Fixed console typo here
      console.log("Action from TTS/STT:", action);
      console.log("Source from TTS/STT:", source);
      console.log("Session from TTS/STT:", sessionId);
      console.log("Language from TTS/STT:", targetLanguage);
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

      try {
        // 1. Convert base64 audio string to Buffer safely
        const base64Audio =
          typeof payload === "string"
            ? payload.replace(/^data:audio\/\w+;base64,/, "")
            : payload?.audio;

        if (!base64Audio) {
          return NextResponse.json({ error: "Invalid audio format provided." }, { status: 400 });
        }

        const audioBuffer = Buffer.from(base64Audio, "base64");

        // 2. Use Groq SDK's native `toFile` helper to ensure cross-runtime compatibility
        const file = await Groq.toFile(audioBuffer, "audio.webm", { type: "audio/webm" });

        // 3. Call Groq Whisper API
        const transcription = await groq.audio.transcriptions.create({
          file,
          model: "whisper-large-v3-turbo", // Use Groq's supported STT model string
          response_format: "json",
        });

        // 🟢 Read `transcription.text` directly as a string property
        const transcribedText = transcription?.text?.trim() || "";

        if (!transcribedText) {
          return NextResponse.json(
            { error: "Failed to transcribe audio or clear speech was not detected." },
            { status: 400 }
          );
        }

        console.log("Transcribed Text:", transcribedText);

        let searchQuery = transcribedText;
        const currentLang = targetLanguage || "en";

        if (currentLang !== "en") {
          const translationCompletion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
              {
                role: "system",
                content:
                  "Translate the user input into English. Output ONLY the translated query, no explanations.",
              },
              { role: "user", content: transcribedText },
            ],
          });
          searchQuery =
            translationCompletion.choices[0]?.message?.content?.trim() || transcribedText;
          console.log("Translated Search Query for English RAG:", searchQuery);
        }
        // 4. Query downstream RAG / Database / Agent tools safely
        let mcpData: { result: string; meta?: any } = { result: "" };

        try {
          mcpData = await executeDynamicSourceQuery(
            searchQuery,
            source,
            sessionId || "",
            targetLanguage
          );

          // Diagnostic check on mcpData return payload
          console.log("=== MCP DATA RETURN CHECK ===");
          console.log("Raw Return Object:", JSON.stringify(mcpData, null, 2));
        } catch (mcpErr: any) {
          console.error("Upstream MCP Query execution failed:", mcpErr?.message);
          mcpData = {
            result:
              "I transcribed your speech, but encountered an error processing the request with our system records.",
            meta: { source: source || "unknown", error: mcpErr?.message },
          };
        }

        let finalAnswer = mcpData.result;
        if (currentLang !== "en") {
          const multilingualResponse = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
              {
                role: "system",
                content: `You are an AI assistant. Answer the user strictly in the language corresponding to language code: '${currentLang}'. Use the provided English CONTEXT to form your response accurately.`,
              },
              {
                role: "user",
                content: `English Context:\n${mcpData.result}\n\nUser Question (${currentLang}):\n${nativeTranscribedText}`,
              },
            ],
          });
          finalAnswer = multilingualResponse.choices[0]?.message?.content || mcpData.result;
        }
        return NextResponse.json({
          transcribedText,
          result: finalAnswer || "No records returned from downstream handler.",
          meta: mcpData.meta || {},
        });
      } catch (sttError: any) {
        console.error("Groq Whisper STT Error:", sttError);
        return NextResponse.json(
          { error: sttError?.message || "Internal error during speech transcription." },
          { status: 500 }
        );
      }
    }

    // 🔊 3. TTS PATH: Text-to-Speech
    if (action === "text-to-speech") {
      const text = payload?.text || payload;
      console.log("Payload data", text);
      if (!text) {
        return NextResponse.json({ error: "Missing text in payload for TTS" }, { status: 400 });
      }

      let responseText = "";
      let sourceMeta = {};

      try {
        // Step 1: Translate non-English input query to English for optimal RAG Vector retrieval
        let searchQuery = text;
        if (targetLanguage !== "en") {
          const translationCompletion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
              {
                role: "system",
                content:
                  "Translate the user input to English. Return ONLY the translated string without commentary.",
              },
              { role: "user", content: transcribedText },
            ],
          });
          searchQuery = translationCompletion.choices[0]?.message?.content || transcribedText;
        }
        const mcpData = await executeDynamicSourceQuery(
          searchQuery,
          source,
          sessionId || "",
          targetLanguage
        );
        sourceMeta = mcpData?.meta || {};
        responseText =
          typeof mcpData === "string"
            ? mcpData
            : mcpData?.result || mcpData?.answer || "No text available for synthesis.";

        if (currentLang !== "en") {
          const targetLangCompletion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
              {
                role: "system",
                content: `Use the provided Context to answer the user request. Respond ONLY in language code '${currentLang}'.`,
              },
              {
                role: "user",
                content: `Context:\n${rawEnglishContext}\n\nUser Question (${currentLang}):\n${text}`,
              },
            ],
          });
          responseText = targetLangCompletion.choices[0]?.message?.content || rawEnglishContext;
        } else {
          responseText = rawEnglishContext;
        }
      } catch (err: any) {
        console.error("MCP Source Query failed during TTS execution:", err.message);
        responseText = "Sorry, I could not retrieve data due to an upstream provider error.";
      }

      const cleanedSpeechText = responseText.replace(/[\*\_~`>#\-\+]/g, "").trim();

      console.log("TTS DEBUG LOGS TTS Output:", JSON.stringify(cleanedSpeechText));

      if (!cleanedSpeechText) {
        return NextResponse.json(
          { error: "Cannot generate speech: Input text is empty." },
          { status: 400 }
        );
      }

      // Chunk text so database outputs longer than 200 chars don't get truncated or rejected
      const textChunks = chunkTextForTTS(cleanedSpeechText, 190);
      console.log(`🎙️ Processing ${textChunks.length} audio chunks for Groq TTS...`);

      const activeTtsModel =
        currentLang === "en" ? TTS_MODEL : getMultilingualTtsModel(currentLang);

      const audioBuffers: Buffer[] = [];

      for (const chunk of textChunks) {
        const response = await groq.audio.speech.create({
          model: activeTtsModel,
          voice: "autumn",
          input: chunk,
          response_format: "wav",
        });

        const chunkBuffer = Buffer.from(await response.arrayBuffer());
        audioBuffers.push(chunkBuffer);
      }

      // Combine audio buffers into a single binary payload
      const finalAudioBuffer = Buffer.concat(audioBuffers);

      return NextResponse.json({
        result: text,
        audio: `data:audio/wav;base64,${finalAudioBuffer.toString("base64")}`,
      });
    }
    return NextResponse.json({ error: "Invalid action specified" }, { status: 400 });
  } catch (error: any) {
    console.error("Speech API Exception:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Helper function to pick correct TTS model based on target language
function getMultilingualTtsModel(langCode: string): string {
  switch (langCode.toLowerCase()) {
    case "ar":
      return "canopylabs/orpheus-arabic-saudi";
    default:
      // Fallback for languages not directly supported by specialized Groq TTS models
      return "canopylabs/orpheus-v1-english";
  }
}
