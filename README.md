# Healthcare Management System - CarePulse

CarePulse is a modern, full-stack healthcare management platform designed to streamline patient and appointment management for medical facilities. It features a user-friendly interface for patients, a comprehensive admin dashboard for staff, and an AI-powered chat assistant for querying information.

## ✨ Features

- **Patient Registration:** Securely register new patients with detailed information.
- **Appointment Management:** Schedule, cancel, and update appointments with ease.
- **Admin Dashboard:** An intuitive dashboard for administrators to view key statistics like scheduled, pending, and cancelled appointments.
- **AI Chat Assistant:** Interact with an intelligent chatbot to get information about patients and documents from your database or uploaded files.
- **Secure Admin Access:** Protected admin section with passkey verification.
- **Theming:** Switch between light and dark modes for user comfort.
- **File Uploads:** Upload and manage patient-related documents.
- **SMS Notifications:** Automated SMS notifications for appointment scheduling and cancellations.

## 🛠️ Tech Stack

- **Framework:** [Next.js](https://nextjs.org/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) & [Shadcn/ui](https://ui.shadcn.com/)
- **Backend:** [Appwrite](https://appwrite.io/) (Database, Authentication, Storage, Messaging)
- **AI & Embeddings:** [LangChain](https://www.langchain.com/) & [Pinecone](https://www.pinecone.io/)
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

    
# =============================================================
#           REQUIRED ENVIRONMENT VARIABLES
# =============================================================

# -----------------------------------------------
# 1. Appwrite Data Base API Configuration
# -----------------------------------------------
# Get these credentials from your Appwrite project dashboard.
    NEXT_PUBLIC_ENDPOINT="[Your Appwrite Endpoint URL]"
    PROJECT_ID="[Your Appwrite Project ID]"
    API_KEY="[Your Appwrite API Key]"
    DATABASE_ID="[Your Appwrite Database ID]"
    PATIENT_COLLECTION_ID="[Your Patient Collection ID]"
    DOCTOR_COLLECTION_ID="[Your Doctor Collection ID]"
    APPOINTMENT_COLLECTION_ID="[Your Appointment Collection ID]"
    NEXT_PUBLIC_BUCKET_ID="[Your Appwrite Storage Bucket ID]"
    NEXT_PUBLIC_ADMIN_PASSKEY="[A Secret Passkey for Admin Access]"

# -----------------------------------------------
# 2. AI Model & Search Configuration
# -----------------------------------------------
    # Open API Configuration
    OPENAI_API_KEY="[Your OpenAI API Key]"

    # Pinecone API Key
    PINECONE_API_KEY="[Your Pinecone API Key]"

    # For AI Agents supporting from huggingface & Langchain
    GROQ_API_KEY="[Your Groq API Key]"

# -----------------------------------------------
# 3. Pinecone Index Configuration
# -----------------------------------------------
    # For Document Search (e.g., medical documents)
    PINECONE_DOC_INDEX_NAME="[Pinecone Document Index Name]"
    PINECONE_DOC_INDEX_HOST="[Pinecone Document Index Host URL]"
    PINECONE_DOC_INDEX_NAME_SPACE="[Pinecone Document Namespace]"

    # For Data Base Search (e.g., patient records)
    PINECONE_DB_INDEX_NAME="[Pinecone DB Index Name]"
    PINECONE_DB_INDEX_HOST="[Pinecone DB Index Host URL]"
    PINECONE_DB_INDEX_NAME_SPACE="[Pinecone DB Namespace]"

# -----------------------------------------------
# 4. Other Configuration
# -----------------------------------------------
    # Timestamp File for Cron Job Persistence (e.g., a file path)
    LAST_CHECKED_TIMESTAMP_FILE="[Path/to/timestamp_file.txt]"

    # SERVER PORT (Commonly 3000 or 8080)
    PORT=3000

    # Duplication of Admin Passkey for clarity (can remove one instance)
    NEXT_PUBLIC_ADMIN_PASSKEY="[A Secret Passkey for Admin Access]"
 
   

4.  **Run the development server:**

    ```bash
    npm run dev
    ```

    Open http://localhost:3000 with your browser to see the result.

## Usage

- The main page (`/`) serves as the patient registration form.
- Access the admin dashboard by navigating to `/?admin=true`. You will be prompted for the admin passkey.
- The AI chat can be accessed from the main page to query information.
