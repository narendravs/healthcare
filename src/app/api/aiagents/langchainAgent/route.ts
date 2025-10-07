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
import { createAppointment } from "@/lib/actions/appointment.actions";
import { getUserByExactName, getPatient } from "@/lib/actions/patient.actions";
import * as dotenv from "dotenv";
import { BaseLLMCallOptions } from "@langchain/core/language_models/llms";
import {
  GetUserByNameTool,
  GetPatientTool,
  CreateAppointmentTool,
  NavigateToAdminTool,
} from "@/tools/custom-tools";

dotenv.config();

const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Define the tools the agent will have access to.
// You can still add your custom tools here.
const tools = [
  new Calculator(),
  new DuckDuckGoSearch(),
  new GetUserByNameTool(),
  new GetPatientTool(),
  new CreateAppointmentTool(),
  new NavigateToAdminTool(),
];

// Create a ChatPromptTemplate with the required placeholders.
const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are a helpful AI assistant for managing patient appointments.
You have access to the following tools: {tool_names}.
Your mission is to book an appointment. You MUST follow this multi-step process:

    1.  **GATHER DATA:** Ask the user for their full name and all required appointment details. The required details are:
        - A full name (e.g., 'John Doe')
        - A doctor's name (primaryPhysician)
        - A reason for the visit (reason)
        - A preferred schedule (e.g., 'next Tuesday at 10 AM')
        - A status (e.g., 'scheduled')
        - Any notes.
        If any of this information is missing, you must ask the user for it and nothing else.

    2.  **EXECUTE TOOLS IN SEQUENCE:**
        a. First, call the 'get_user_by_name' tool with the user's name.
        b. Use the 'userId' from the result of the previous tool to call the 'get_patient_details' tool.
        c. Once you have a valid userId and patientId from your previous tool calls, and you have received all the other required details from the user, you are ready for the final step.

    3.  **FINAL ACTION:** Do not ask any more questions. Your final response must be a single, conclusive call to the 'create_appointment' tool. You must format the input for this tool as a single JSON object containing the 'userId', 'patient', 'primaryPhysician', 'reason', 'schedule', 'status', and 'note' gathered from the user and your previous tool calls.
    4.  **POST-APPOINTMENT ACTION:** Immediately after successfully creating the appointment, you must make a final call to the 'navigate_to_admin' tool. This action signals to the system that it should redirect the user to the admin dashboard. Do not provide a verbal confirmation after calling this tool.
    `,
  ],
  new MessagesPlaceholder("chat_history"), // Placeholder for conversation history
  ["human", "{input}"], // The user's new input
  new MessagesPlaceholder("agent_scratchpad"), // Placeholder for agent's thought/action loop
]);

// Initialize the Hugging Face LLM using the model and your API key
const llm = new ChatGroq({
  apiKey: GROQ_API_KEY,
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

export async function POST(req: NextRequest, res: NextResponse) {
  if (req.method !== "POST") {
    return NextResponse.json(
      { message: "Method Not Allowed" },
      { status: 405 }
    );
  }

  const { query } = await req.json();
  try {
    // Extract tool names for the prompt
    const toolNames = tools.map((tool) => tool.name).join(", ");

    const result = await agentExecutor.invoke({
      input: query,
      chat_history: [],
      tools: tools,
      tool_names: toolNames,
    });
    console.log("Result from the api", result);
    console.log("Result from the pai output", result.output);
    return NextResponse.json({ output: result.output }, { status: 200 });
  } catch (error) {
    console.error("Agent execution error:", error);
    return NextResponse.json(
      { error: "Failed to process request." },
      { status: 500 }
    );
  }
}
