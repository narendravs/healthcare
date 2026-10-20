import { WorkerOptions, cli, JobContext } from "@livekit/agents";
import { VoicePipelineAgent } from "@livekit/agents/voice";
import * as openai from "@livekit/plugins-openai";
import * as silero from "@livekit/plugins-silero";
import executeGraphQuery from "@/app/api/aiagents/voiceAgent/route";
import dotenv from "dotenv";

dotenv.config();

export default function entrypoint(ctx: JobContext) {
  return async () => {
    await ctx.connect();

    // Define a custom tool in TypeScript that proxies the prompt to your Next.js Webhook
    const hospitalTool = {
      description: "Handles patient records, doctor lookups, and medical appointment scheduling.",
      parameters: {
        type: "object",
        properties: {
          user_query: {
            type: "string",
            description: "The exact request or speech statement made by the user.",
          },
        },
        required: ["user_query"],
      },
      execute: async ({ user_query }: { user_query: string }) => {
        try {
          // Directly invoke your existing graph logic with Redis memory and tools!
          const result = await executeGraphQuery(
            user_query,
            ctx.room.name, // Uses the LiveKit room name as the persistent Redis session ID
            "en"
          );
          return result.output || "I have processed your request.";
        } catch (error) {
          console.error("Failed to reach Next.js voice webhook:", error);
          error;
          return "Sorry, I am having trouble connecting to the hospital database right now.";
        }
      },
    };

    // Initialize the Voice Pipeline Agent
    const agent = new VoicePipelineAgent({
      vad: new silero.VAD(),
      stt: new openai.STT(),
      llm: openai.LLM.with_groq({
        model: "qwen/qwen3.8-27b",
        apiKey: process.env.GROQ_API_KEY,
      }),
      tts: new openai.TTS(),
      tools: [hospitalTool as any],
      instructions:
        "You are CarePulse, a polite medical appointment coordinator. Always use your hospital tool to address patient appointments or queries.",
    });

    agent.start(ctx.room);

    await agent.say(
      "Welcome to CarePulse Medical. How can I help you schedule your appointment today?",
      true
    );
  };
}

cli.run_app(new WorkerOptions({ entrypointFnc: entrypoint }));
