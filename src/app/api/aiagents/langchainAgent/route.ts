export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";

import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { ChatGroq } from "@langchain/groq";
import { Calculator } from "@langchain/community/tools/calculator";
import { DuckDuckGoSearch } from "@langchain/community/tools/duckduckgo_search";

// This is still needed for your custom actions, but not in this examplecd
import { BaseLLMCallOptions } from "@langchain/core/language_models/llms";
import {
  GetUserByNameTool,
  GetDoctorsListTool,
  GetPatientTool,
  CreateAppointmentTool,
  NavigateToAdminTool,
  
} from "@/tools/custom-tools";

// Import the Client from LangSmith to ensure it's available for tracing
import { Client } from "langsmith";

// NEW: Import for history management
import { ChatMessageHistory } from "langchain/stores/message/in_memory";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";

// Initialize the client outside the handler
const lsClient = new Client();

const GROQ_APIKEY = process.env.GROQ_API_KEY;

// Define the tools the agent will have access to.
// You can still add your custom tools here.
const tools = [
  new Calculator(),
  new DuckDuckGoSearch(),
  new GetUserByNameTool(),
  new GetDoctorsListTool(),
  new GetPatientTool(),
  new CreateAppointmentTool(),
  new NavigateToAdminTool(),
];

// Create a ChatPromptTemplate with the required placeholders.
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

// Initialize the Hugging Face LLM using the model and your API key
const llm = new ChatGroq({
  apiKey: GROQ_APIKEY,
  model: "meta-llama/llama-4-scout-17b-16e-instruct", // or 'mixtral-8x7b-instruct'
  temperature: 0,
});

// Explicitly bind the tools to the LLM
const llmWithTools = llm.bind({ tools } as BaseLLMCallOptions);

// Use createToolCallingAgent
const agent = await createToolCallingAgent({
  llm: llmWithTools,
  tools,
  prompt,
});

const agentExecutor = new AgentExecutor({
  agent,
  tools,
  handleParsingErrors: true, // Optional: handle parsing errors
  //maxIterations: 25,
  // verbose: true, // Add this line
});

/** 
 * IN-MEMORY STORAGE 
 * Note: In Next.js production (Vercel), this variable is wiped between requests.
 * We will populate it from the 'history' sent by your frontend.
 */
const messageHistoryStore: Record<string, ChatMessageHistory> = {};

// Wrap the executor with history logic
const agentWithChatHistory = new RunnableWithMessageHistory({
  runnable: agentExecutor,
  getMessageHistory: async (sessionId: string) => {
    if (!messageHistoryStore[sessionId]) {
      messageHistoryStore[sessionId] = new ChatMessageHistory();
    }
    return messageHistoryStore[sessionId];
  },
  inputMessagesKey: "input",
  historyMessagesKey: "chat_history",
});

export async function POST(req: NextRequest) {
  if (req.method !== "POST") {
    return NextResponse.json(
      { message: "Method Not Allowed" },
      { status: 405 },
    );
  }

  const { query, history, sessionId = "default-session" } = await req.json();
  
  try {
    // Extract tool names for the prompt
    const toolNames = tools.map((tool) => tool.name).join(", ");

    // 1. If the frontend sends history, seed the in-memory store for this request
    if (history && history.length > 0) {
      const chatHistory = new ChatMessageHistory();
      // Map your incoming history objects to LangChain Message classes
      for (const msg of history) {
        if (msg.role === "user") await chatHistory.addUserMessage(msg.content);
        else await chatHistory.addAIChatMessage(msg.content);
      }
      messageHistoryStore[sessionId] = chatHistory;
    }

    // 2. Execute the agent
    const result = await agentWithChatHistory.invoke(
      { 
        input: query, 
        tool_names: toolNames 
      },
      { 
        configurable: { sessionId } 
      }
    );

    console.log("Result from the api", result);
    console.log("Result from the api output", result.output);

    // CRITICAL: Wait for all traces to be uploaded
    // This ensures that the background upload finishes before the response is sent
    if (process.env.LANGSMITH_TRACING === "true") {
       await lsClient.awaitPendingTraceBatches();
    }
    
    return NextResponse.json({ output: result.output }, { status: 200 });
  } catch (error) {
    console.error("Agent execution error:", error);

    // Also flush on error to see the failure in LangSmith
    if (process.env.LANGSMITH_TRACING === "true") {
       await lsClient.awaitPendingTraceBatches();
    }
    return NextResponse.json(
      { error: "Failed to process request." },
      { status: 500 },
    );
  }
}
