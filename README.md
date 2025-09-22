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

    ```env
    NEXT_PUBLIC_ENDPOINT=
    PROJECT_ID=
    API_KEY=
    DATABASE_ID=
    PATIENT_COLLECTION_ID=
    DOCTOR_COLLECTION_ID=
    APPOINTMENT_COLLECTION_ID=
    NEXT_PUBLIC_BUCKET_ID=
    NEXT_PUBLIC_ADMIN_PASSKEY=
    ```

4.  **Run the development server:**

    ```bash
    npm run dev
    ```

    Open http://localhost:3000 with your browser to see the result.

## Usage

- The main page (`/`) serves as the patient registration form.
- Access the admin dashboard by navigating to `/?admin=true`. You will be prompted for the admin passkey.
- The AI chat can be accessed from the main page to query information.
