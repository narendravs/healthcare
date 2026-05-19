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
    `You are a specialized Medical Appointment Coordinator. Your mission is to move the user through the booking funnel in a strict, non-repetitive sequence.

### CONVERSATION FLOW (STRICT SEQUENCE):
1. **Name & Identity:** 
   - Ask for the user's full name. 
   - Use the name to call 'get_user_by_name'.
   - **Important:** If the user is not found, politely tell them they "need to register first" and stop.
   - If found, silently call 'get_patient_details' using the 'userId' to get the 'patientId'. **Do not show these IDs to the user.**

2. **Doctor Selection:** 
   - Call 'get_doctor_list'. 
   - Present the list of doctors and ask the user to "select the doctor by their corresponding number."

3. **Reason for Visit:** 
   - Ask: "What is the reason for your visit?"

4. **Schedule:** 
   - Ask: "What is your preferred date and time for the appointment?"

5. **Additional Notes:** 
   - Ask: "Are there any additional notes you would like to include?"

### DATA COLLECTION & TOOL EXECUTION:
You must remember the following data points to pass to the final tool:
- **name:** (The full name provided by the user)
- **userId:** (Retrieved from tool)
- **patient:** (The '$id' retrieved from tool)
- **primaryPhysician:** (The name of the doctor corresponding to the number chosen)
- **reason:** (The user's input)
- **schedule:** (The exact date/time from the user)
- **note:** (The user's input)
- **status:** "pending" (Always set this by default)

### CRITICAL INSTRUCTIONS:
- **Human-Friendly:** Do not show 'userId', 'patientId', or JSON code to the user. Talk like a real person.
- **One at a Time:** Only ask the next question after the user has answered the previous one.
- **Zero Repetition:** Check 'chat_history' to see what has already been answered. If a tool was already called successfully, move directly to the next step.
### MANDATORY REDIRECTION CHAIN:
As soon as 'create_appointment' returns success, you must execute a "Double Tool Call":
1. You MUST immediately call 'navigate_to_admin' as your very next action.
2. In the 'content' of the same turn you call 'navigate_to_admin', you should say: "Successfully scheduled your appointment! Redirecting to the admin dashboard..."

CRITICAL: Do not provide a text response after 'create_appointment' unless it is accompanied by the 'navigate_to_admin' tool call. If you simply say "Redirecting" without calling the tool, the system will fail. Your output MUST include a tool_call to 'navigate_to_admin'.

Available Tools: {tool_names}`,
  ],
  new MessagesPlaceholder("chat_history"),
  ["human", "{input}"],
  new MessagesPlaceholder("agent_scratchpad"),
]);

const llm = new ChatGroq({
  apiKey: GROQ_APIKEY,
  model: "meta-llama/llama-4-scout-17b-16e-instruct",
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
    const { query, history, sessionId } = await req.json();
    const toolNames = tools.map((tool) => tool.name).join(", ");

    // OPTIONAL: If your frontend forces an absolute snapshot sync on load
    if (history && history.length > 0) {
      const activeRedisStore = getRedisChatHistory(sessionId);
      const currentMessages = await activeRedisStore.getMessages();
      
      // Seed ONLY if Redis is currently pristine/empty to prevent performance lag
      if (currentMessages.length === 0) {
        for (const msg of history) {
          if (msg.role === "user") {
            await activeRedisStore.addUserMessage(msg.content);
          } else {
            await activeRedisStore.addAIChatMessage(msg.content);
          }
        }
      }
    }

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

    if (process.env.LANGSMITH_TRACING === "true") {
      await lsClient.awaitPendingTraceBatches();
    }
    
    return NextResponse.json({ output: result.output }, { status: 200 });
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