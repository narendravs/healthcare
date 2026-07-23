export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { ChatGroq } from "@langchain/groq";
import { Calculator } from "@langchain/community/tools/calculator";
import { DuckDuckGoSearch } from "@langchain/community/tools/duckduckgo_search";
import { BaseLLMCallOptions } from "@langchain/core/language_models/llms";
import { Client } from "langsmith";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";

// Redis Connection Imports
import { UpstashRedisChatMessageHistory } from "@langchain/community/stores/message/upstash_redis";

import {
  GetUserByNameTool,
  GetDoctorsListTool,
  GetPatientTool,
  CreateAppointmentTool,
  NavigateToAdminTool,
} from "@/tools/custom-tools";

// Initialize Upstash Redis Wrapper Factory
export const getRedisChatHistory = (sessionId: string) => {
  return new UpstashRedisChatMessageHistory({
    sessionId,
    config: {
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    },
    sessionTTL: 86400, // 24-hour expiration window
  });
};

const lsClient = new Client();
const GROQ_APIKEY = process.env.GROQ_API_KEY;

const tools = [
  new Calculator(),
  new DuckDuckGoSearch(),
  new GetUserByNameTool(),
  new GetDoctorsListTool(),
  new GetPatientTool(),
  new CreateAppointmentTool(),
  new NavigateToAdminTool(),
];

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
`You are a specialized Medical Appointment Coordinator. Your mission is to move the user through the booking funnel in a strict, non-repetitive, step-by-step sequence.

### CONVERSATION FLOW (STRICT SEQUENCE):
1. **Name & Identity:**
   - Ask for full name -> call 'get_user_by_name'.
   - If found, call 'get_patient_details' to retrieve 'patientId'. Keep IDs silent.
2. **Doctor Selection:**
   - Call 'get_doctor_list' -> ask user to choose.
3. **Reason for Visit:**
   - Ask for reason.
4. **Schedule:**
   - Ask for preferred date and time.
5. **Additional Notes (MANDATORY STEP):**
   - Once date/time is provided, ask: "Got it! Are there any additional notes or special requests you would like to add for the doctor?"
6. **Creation & Redirect:**
   - Only AFTER the user responds to Step 5 (even if they say "no" or "none"), execute 'create_appointment'.
   - Immediately call 'navigate_to_admin'.
   - Tell the user: "Successfully scheduled your appointment! Redirecting to the admin dashboard..."

### CRITICAL RULES:
- Never call 'create_appointment' until Step 5 (Notes) has been answered by the user.
- Always respond in natural language. Never return raw JSON or blank strings to the user.

Available Tools: {tool_names}`,
  ],
  new MessagesPlaceholder("chat_history"),
  ["human", "{input}"],
  new MessagesPlaceholder("agent_scratchpad"),
]);

const llm = new ChatGroq({
  apiKey: GROQ_APIKEY,
  model: "qwen/qwen3.6-27b",
  temperature: 0,
});

const llmWithTools = llm.bind({ tools } as BaseLLMCallOptions);

const agent = await createToolCallingAgent({
  llm: llmWithTools,
  tools,
  prompt,
});

// Primary runtime executor instance
const agentExecutor = new AgentExecutor({
  agent,
  tools,
  handleParsingErrors: true,
  returnIntermediateSteps: true, // 👈 CRITICAL: Exposes tool execution outputs
});

// Unified Message History Wrapper pointing directly to Redis
const agentWithChatHistory = new RunnableWithMessageHistory({
  runnable: agentExecutor,
  // The history object handles updates/appends under the hood upon output return!
  getMessageHistory: async (sessionId: string) => {
    return getRedisChatHistory(sessionId);
  },
  inputMessagesKey: "input",
  historyMessagesKey: "chat_history",
});

export async function POST(req: NextRequest) {
  if (req.method !== "POST") {
    return NextResponse.json({ message: "Method Not Allowed" }, { status: 405 });
  }

  try {
    const { query, sessionId } = await req.json();

    // Add explicit validation guard
    if (!sessionId) {
      console.error("❌ API Error: sessionId is missing in request payload");
      return NextResponse.json(
        { error: "Bad Request: sessionId is required to maintain chat continuity." },
        { status: 400 }
      );
    }
    
    const toolNames = tools.map((tool) => tool.name).join(", ");

    // Run execution context. State changes automatically sync to Upstash via RunnableWrapper
    const result = await agentWithChatHistory.invoke(
      { 
        input: query, 
        tool_names: toolNames 
      },
      { 
        configurable: { sessionId } 
      }
    );

    console.log("Result from the API output:", result.output);

    // 2. Extract tool execution flags from intermediateSteps
    let shouldNavigate = false;
    let targetRoute = null;

    if (result.intermediateSteps && Array.isArray(result.intermediateSteps)) {
    for (const step of result.intermediateSteps) {
      // Check if navigate_to_admin or create_appointment tool was called
      if (step.action?.tool === "navigate_to_admin") {
        shouldNavigate = true;
        targetRoute = "/admin";
        break;
      }
    }
  }

    if (process.env.LANGSMITH_TRACING === "true") {
      await lsClient.awaitPendingTraceBatches();
    }
    
    return NextResponse.json({
      output: result.output,
      action: shouldNavigate ? "navigate" : null,
      targetRoute: targetRoute
     }, { status: 200 });
  } catch (error) {
    console.error("Agent execution error:", error);

    if (process.env.LANGSMITH_TRACING === "true") {
       await lsClient.awaitPendingTraceBatches();
    }
    return NextResponse.json(
      { error: "Failed to process request." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) { 

  try {
    const { sessionId } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    const activeRedisStore = getRedisChatHistory(sessionId);
    await activeRedisStore.clear(); // 🧼 Wipes the Upstash Redis history instantly

    return NextResponse.json({ message: "Chat window session wiped" }, { status: 200 });
  } catch (error) {
    console.error("Failed to clear Redis history on window close:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}