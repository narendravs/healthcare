import {
  ServerOptions,
  cli,
  defineAgent,
  llm,
  voice,
  type JobContext,
  type JobProcess,
} from "@livekit/agents";
import * as silero from "@livekit/agents-plugin-silero";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: ".env.local" }); // or ".env", wherever your keys live

const result = dotenv.config({ path: path.resolve(process.cwd(), ".env") });
console.log(
  "dotenv result:",
  result.error ? result.error.message : "loaded",
  Object.keys(result.parsed ?? {})
);

console.log("cwd:", process.cwd());
console.log("OPENAI:", !!process.env.OPENAI_API_KEY, "GROQ:", !!process.env.GROQ_API_KEY);

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    proc.userData.vad = await silero.VAD.load();
  },

  entry: async (ctx: JobContext) => {
    await ctx.connect();

    const hospitalTool = llm.tool({
      description: "Handles patient records, doctor lookups, and appointment scheduling.",
      parameters: z.object({
        user_query: z.string().describe("The user's request, in their own words."),
      }),
      execute: async ({ user_query }) => {
        try {
          const res = await fetch("http://localhost:3000/api/aiagents/voiceAgent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: user_query,
              sessionId: ctx.room.name,
              language: "en",
            }),
            signal: AbortSignal.timeout(8000), // don't leave the caller in silence
          });
          if (!res.ok) return "Sorry, I couldn't reach the hospital system.";
          const text = await res.text();
          try {
            const d = JSON.parse(text);
            return typeof d === "string"
              ? d
              : (d.output ?? d.reply ?? d.message ?? JSON.stringify(d));
          } catch {
            return text || "I got an empty response from the server.";
          }
        } catch (err) {
          console.error("voiceAgent call failed:", err);
          return "Sorry, I'm having trouble connecting to the hospital database.";
        }
      },
    });

    const agent = new voice.Agent({
      instructions:
        "You are CarePulse, a polite medical appointment coordinator. Keep replies short and spoken-friendly. Use the hospital tool for any patient, doctor, or appointment request.",
      tools: { hospital: hospitalTool },
    });

    const session = new voice.AgentSession({
      vad: ctx.proc.userData.vad as silero.VAD,
      stt: "deepgram / nova - 3",
      llm: openai.LLM.withGroq({ model: "qwen/qwen3.8-27b" }), // needs GROQ_API_KEY
      tts: "cartesia/sonic-2",
    });

    await session.start({ agent, room: ctx.room });
    session.say(
      "Welcome to CarePulse Medical. How can I help you schedule your appointment today?"
    );

    session.on(voice.AgentSessionEventTypes.Close, () => {
      console.log("[agent] session closed, shutting down job");
      ctx.shutdown("session closed");
    });
  },
});

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    numIdleProcesses: 1, // spawn + prewarm at worker start, not at job time
    initializeProcessTimeout: 120_000, // 2 min is plenty for a slow machine
  })
);
