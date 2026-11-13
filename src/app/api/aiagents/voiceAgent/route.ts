export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { Annotation, StateGraph, MemorySaver } from "@langchain/langgraph";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { ChatGroq } from "@langchain/groq";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { UpstashRedisChatMessageHistory } from "@langchain/community/stores/message/upstash_redis";
import {
  GetUserByNameTool,
  GetDoctorsListTool,
  GetPatientTool,
  CreateAppointmentTool,
  NavigateToAdminTool,
} from "@/tools/custom-tools";

const tools = [
  new GetUserByNameTool(),
  new GetDoctorsListTool(),
  new GetPatientTool(),
  new CreateAppointmentTool(),
  new NavigateToAdminTool(),
];

// Define Redis Chat History helper
export const getRedisChatHistory = (sessionId: string) => {
  return new UpstashRedisChatMessageHistory({
    sessionId,
    config: {
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    },
    sessionTTL: 86400,
  });
};

// Define LangGraph State Schema
const GraphState = Annotation.Root({
  messages: Annotation<any[]>({
    reducer: (left, right) => left.concat(right).slice(-6),
    default: () => [],
  }),
});

const systemPrompt = `You are a hospital management backend assistant. 
When you receive a query about listing doctors, you MUST invoke the GetDoctorsListTool.
When you receive a query about scheduling an appointment:
1. If you only have the patient's name, you MUST first invoke GetUserByNameTool to look up their userId.
2. Once you have retrieved the userId, invoke CreateAppointmentTool using that userId, doctor name, time, and reason.
Never answer appointment scheduling or doctor listing questions from memory; always use the tools.`;

const llm = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "qwen/qwen3.8-27b",
  temperature: 0,
}).bindTools(tools);

// Define Nodes
async function callModel(state: typeof GraphState.State) {
  // Ensure the system prompt is always present at the beginning of the messages list
  const messagesWithSystem = [new SystemMessage(systemPrompt), ...state.messages];
  const response = await llm.invoke(messagesWithSystem);
  return { messages: [response] };
}

const toolNode = new ToolNode(tools);

// Conditional edge router to check if tools need to be called
function shouldContinue(state: typeof GraphState.State) {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1] as any;

  if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    return "tools";
  }
  return "__end__";
}

// Build and compile the Graph with checkpointer for persistence
const workflow = new StateGraph(GraphState)
  .addNode("agent", callModel)
  .addNode("tools", toolNode)
  .addEdge("__start__", "agent")
  .addConditionalEdges("agent", shouldContinue)
  .addEdge("tools", "agent");

const memory = new MemorySaver();

export const graph = workflow.compile({ checkpointer: memory });

/**
 * Core execution function for Graph Agent (Called by API routes or Twilio webhooks)
 */
export async function executeGraphQuery(
  query: string,
  sessionId: string,
  language: string = "en"
): Promise<{ output: string; action?: string | null; targetRoute?: string | null }> {
  if (!sessionId) {
    throw new Error("sessionId is required to process the graph agent query.");
  }

  // 1. Load prior messages from Redis chat history
  const redisHistory = getRedisChatHistory(sessionId);
  const historicMessages = await redisHistory.getMessages();
  const trimmedHistory = historicMessages.slice(-2);

  // 2. Wrap the incoming human query as a proper LangChain HumanMessage
  const currentMessage = new HumanMessage({
    content: `[Language: ${language}] ${query}`,
  });

  const inputMessages = [...trimmedHistory, currentMessage];

  // 3. Invoke LangGraph workflow
  const finalState = await graph.invoke(
    { messages: inputMessages },
    { configurable: { thread_id: sessionId } }
  );

  const latestMessage = finalState.messages[finalState.messages.length - 1];
  const outputText = latestMessage.content || "Response handled successfully.";

  // 4. Save new conversation turns back to Redis history using proper message objects
  await redisHistory.addMessage(new HumanMessage({ content: query }));
  await redisHistory.addMessage(new AIMessage({ content: outputText }));

  // 5. Check if navigation tool was invoked
  let shouldNavigate = false;
  let targetRoute: string | null = null;
  for (const msg of finalState.messages) {
    if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
      for (const call of msg.tool_calls) {
        if (call.name === "navigate_to_admin") {
          shouldNavigate = true;

          targetRoute = "/admin";
          break;
        }
      }
    }
  }
  return {
    output: typeof outputText === "string" ? outputText : JSON.stringify(outputText),
    action: shouldNavigate ? "navigate" : null,
    targetRoute: targetRoute,
  };
}

export async function POST(req: NextRequest) {
  try {
    const text = await req.text();

    // Check if body is empty
    if (!text || text.trim() === "") {
      return NextResponse.json({ error: "Request body is empty" }, { status: 400 });
    }

    const body = await JSON.parse(text);
    const { query, sessionId, language } = body;

    if (!query || !sessionId) {
      return NextResponse.json(
        { error: "Missing required fields: 'query' and 'sessionId' are required." },
        { status: 400 }
      );
    }

    // Execute the LangGraph query
    const result = await executeGraphQuery(query, sessionId, language || "en");

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("Error processing graph query:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
