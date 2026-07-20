# Healthcare Management System - CarePulse

CarePulse is a modern, full-stack healthcare management platform designed to streamline patient and appointment management for medical facilities. It features a user-friendly interface for patients, a comprehensive admin dashboard for staff, and an AI-powered chat assistant for querying information.

🔗 **Live Production URL:** [https://healthcare-three-snowy.vercel.app/](https://healthcare-three-snowy.vercel.app/)

## ✨ Features

- **Patient Registration:** Securely register new patients with detailed information.
- **Appointment Management:** Schedule, cancel, and update appointments with ease.
- **Admin Dashboard:** An intuitive dashboard for administrators to view key statistics like scheduled, pending, and cancelled appointments.
- **AI Chat Assistant:** Interact with an intelligent chatbot to get information about patients and documents from your database or uploaded files.
- **AI Appointment & Chat Agent:** Interact with an intelligent agent capable of booking, rescheduling, and validating appointments natively through chat dialog workflows.
- **Vectorized Document & DB Search:** Implemented semantic indexing using **Pinecone** for deep contextual queries across unstructured uploaded files and database entities.
- **Hybrid Embedding Pipeline:** Flexible infrastructure supporting both local/open-source **Hugging Face Transformers** and high-throughput cloud-based embedding abstractions.
- **Model Context Protocol (MCP) Integration:** Implements an enterprise-grade MCP architecture to securely bridge the LLM with database systems and local document vector indices—preventing hallucinations by cross-checking constraints against live ground-truth data.
- **Secure Admin Access:** Protected admin section with passkey verification.
- **Theming:** Switch between light and dark modes for user comfort.
- **File Uploads:** Upload and manage patient-related documents.
- **SMS Notifications:** Automated SMS notifications for appointment scheduling and cancellations.

## 🛠️ Tech Stack

- **Framework:** [Next.js](https://nextjs.org/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) & [Shadcn/ui](https://ui.shadcn.com/)
- **Backend:** [Appwrite](https://appwrite.io/) (Database, Authentication, Storage, Messaging)
- **AI & Embeddings:** [LangChain](https://www.langchain.com/) & [Pinecone](https://www.pinecone.io/)
- **AI Agent Orchestration:** [LangChain](https://www.langchain.com/) & [LangGraph](https://www.langchain.com/langgraph)
- **Vector Database:** [Pinecone](https://www.pinecone.io/)
- **Embeddings Providers:** Hugging Face Transformers & Silicon Cloud / OpenAI
- **Context Protocol Layer:** Model Context Protocol (MCP) Client/Server Specification
- **Session State Cache:** [Upstash Redis](https://upstash.com/)
- **Background Task Processing:** [Trigger.dev](https://trigger.dev/)
- **Blob Storage:** [Vercel Blob Storage](https://vercel.com/docs/storage/vercel-blob)
- **Form Management:** [React Hook Form](https://react-hook-form.com/)
- **Schema Validation:** [Zod](https://zod.dev/)

## 🚀 Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

- Node.js (v18 or later)
- npm, yarn, or pnpm

### Installation

1.  **Clone the repository:**

    ```bash
    git clone <your-repository-url>
    cd healthcare
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Set up environment variables:**

    Create a `.env.local` file in the root of your project and add the necessary environment variables from your Appwrite and Pinecone project dashboards.

    ```dotenv
    # ==================================================
    #         REQUIRED ENVIRONMENT VARIABLES
    # ==================================================

    # -----------------------------------------------
    # 1. Appwrite Database & API Configuration
    # -----------------------------------------------
    NEXT_PUBLIC_ENDPOINT="[Your Appwrite Endpoint URL]"
    PROJECT_ID="[Your Appwrite Project ID]"
    API_KEY="[Your Appwrite API Key]"
    DATABASE_ID="[Your Appwrite Database ID]"
    PATIENT_COLLECTION_ID="[Your Patient Collection ID]"
    DOCTOR_COLLECTION_ID="[Your Doctor Collection ID]"
    APPOINTMENT_COLLECTION_ID="[Your Appointment Collection ID]"
    NEXT_PUBLIC_BUCKET_ID="[Your Appwrite Storage Bucket ID]"
    NEXT_PUBLIC_BUCKET_URL="[Your Appwrite Bucket File URL]"
    NEXT_PUBLIC_STORAGE_ENDPOINT="[Your Appwrite Storage Endpoint]"
    NEXT_PUBLIC_ADMIN_PASSKEY="[A Secret Passkey for Admin Access]"

    # -----------------------------------------------
    # 2. AI Model & Embedding Pipeline Configuration
    # -----------------------------------------------
    OPENAI_API_KEY="[Your OpenAI API Key]"
    GROQ_API_KEY="[Your Groq API Key]"
    GOOGLE_API_KEY="[Your Google Gemini API Key]"
    CLOUD_SILICON_EMBEDDING_API_KEY="[Your Silicon Cloud Embeddings API Key]"

    # Set to "true" to use cloud-based embeddings, or "false" to use local CPU-based embeddings
    USE_CLOUD_EMBEDDINGS=true

    # -----------------------------------------------
    # 3. Vector Database Indexing (Pinecone)
    # -----------------------------------------------
    PINECONE_API_KEY="[Your Pinecone API Key]"

    # Document Vector Indices (Unstructured Medical Files / Standard & Cloud)
    PINECONE_DOC_INDEX_NAME="[Pinecone Document Index Name]"
    PINECONE_DOC_INDEX_HOST="[Pinecone Document Index Host URL]"
    PINECONE_DOC_INDEX_NAME_SPACE="[Pinecone Document Namespace]"

    PINECONE_CLOUD_DOC_INDEX_NAME="[Pinecone Cloud Document Index Name]"
    PINECONE_CLOUD_DOC_INDEX_HOST="[Pinecone Cloud Document Index Host URL]"
    PINECONE_CLOUD_DOC_INDEX_NAME_SPACE="[Pinecone Cloud Document Namespace]"

    # Database Vector Indices (Semantic Record Mappings / Local & Cloud)
    PINECONE_LOCAL_DB_INDEX_NAME="[Pinecone Local DB Index Name]"
    PINECONE_LOCAL_DB_INDEX_HOST="[Pinecone Local DB Index Host URL]"
    PINECONE_LOCAL_DB_INDEX_NAME_SPACE="[Pinecone Local DB Namespace]"

    PINECONE_CLOUD_DB_INDEX_NAME="[Pinecone Cloud DB Index Name]"
    PINECONE_CLOUD_DB_INDEX_HOST="[Pinecone Cloud DB Index Host URL]"
    PINECONE_CLOUD_DB_INDEX_NAME_SPACE="[Pinecone Cloud DB Namespace]"

    # Standard DB Index Alias Fallbacks
    PINECONE_DB_INDEX_NAME="[Pinecone DB Fallback Index Name]"
    PINECONE_DB_INDEX_HOST="[Pinecone DB Fallback Index Host URL]"
    PINECONE_DB_INDEX_NAME_SPACE="[Pinecone DB Fallback Namespace]"

    # -----------------------------------------------
    # 4. Model Context Protocol (MCP) Configuration
    # -----------------------------------------------
    MCP_SERVER_APP_URL="http://localhost:3000"
    MCP_DB_SERVER_URL="[Your Appwrite MCP Server Connection Endpoint]"
    MCP_DOC_SERVER_URL="[Your Pinecone MCP Server Connection Endpoint]"

    # -----------------------------------------------
    # 5. Background Task Queue (Trigger.dev)
    # -----------------------------------------------
    TRIGGER_SECRET_KEY="[Your Trigger.dev Secret API Key]"

    # -----------------------------------------------
    # 6. LangSmith Observability Configuration
    # -----------------------------------------------
    LANGSMITH_TRACING=true
    LANGSMITH_ENDPOINT="https://api.smith.langchain.com"
    LANGSMITH_API_KEY="[Your LangSmith Secret API Key]"
    LANGSMITH_PROJECT="[Your LangSmith Project Name]"

    # -----------------------------------------------
    # 7. Upstash Redis Configuration (Chat Session Memory)
    # -----------------------------------------------
    UPSTASH_REDIS_REST_URL="https://[your-database-name].upstash.io"
    UPSTASH_REDIS_REST_TOKEN="[Your Upstash Redis REST Token]"

    # -----------------------------------------------
    # 8. Vercel Blob Storage & Deployment Variables
    # -----------------------------------------------
    BLOB_STORE_ID="[Your Vercel Blob Store ID]"
    BLOB_READ_WRITE_TOKEN="[Your Vercel Blob Read/Write Token]"
    VERCEL_OIDC_TOKEN="[Your Vercel OIDC Token]"

    # -----------------------------------------------
    # 9. Server & Environment Operational Settings
    # -----------------------------------------------
    LAST_CHECKED_TIMESTAMP_FILE="last_checked_timestamp.txt"
    PORT=8000
    NODE_ENV="production"
    NEXT_PUBLIC_FORCE_CLOUD_UPLOAD="true"
    ```

4.  **Run the development server in Terminal 1:**

    ```bash
    npm run dev
    ```

    Open http://localhost:3000 with your browser to see the result.

5. **Run Trigger.dev for local in Terminal 2 (Trigger.dev Background Worker):**
   npx trigger.dev@latest dev --config ./trigger.config.ts    

## Usage

- **Patient Workspace:** The main page (`/`) serves as the core patient interface and registration entry form.
- **Admin Dashboard:** Access structural operations by navigating to `/?admin=true`. Access is secured via administrative passkey verification.
- **AI Agent Interface:** Engage with the interactive chat module directly on the workspace interface. The agent processes slots in real-time, pulling context from Upstash Redis, cross-referencing vector records via Pinecone, and verifying scheduling rules over live infrastructure data through custom MCP server queries.
