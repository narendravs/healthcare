import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { existsSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { runDocumentProcess } from "@/embeddings/doc-embeddings/documentCloudEmbeddings.ts";
import { put } from "@vercel/blob";
import { embeddingTask } from "@/trigger/embeddingTask.ts";
import { configure } from "@trigger.dev/sdk";

// Configure the SDK globally at the module level
configure({
  secretKey: process.env.TRIGGER_SECRET_KEY,
});
export async function POST(req: NextRequest) {
  if (req.method != "POST") {
    return NextResponse.json({ message: "Method not Allowed" }, { status: 405 });
  }
  try {
    console.log("entered into the route");
    // Directly access the FormData from the request object.
    // This is a built-in feature of the Next.js App Router and the Web API.
    const formData = await req.formData();
    const file = formData.get("file");

    // Check if a file was uploaded AND if it is an instance of a File object.
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { message: "No file uploaded or invalid file type." },
        { status: 400 }
      );
    }

    console.log("File name uploaded", file.name);

    let fileSource: string;

    // Check if we are running in production cloud or local development
    if (process.env.NEXT_PUBLIC_FORCE_CLOUD_UPLOAD === "true") {
      console.log("Cloud environment detected: Uploading to Vercel Blob...");

      // 1. Upload the raw stream directly to your private Vercel Blob store
      const blob = await put(file.name, file.stream(), {
        access: "private",
        allowOverwrite: true,
        addRandomSuffix: true,
        // 🌟 Manually forcing the token here completely kills the OIDC check!
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });

      // 2. The target source becomes the secure cloud absolute URL string
      fileSource = blob.url;
      // 🌟 PRODUCTION / CLOUD PATHWAY
      // Kick off the heavy background task via Trigger.dev's cloud runners
      const handle = await embeddingTask.trigger({ fileSource });
      console.log(`Cloud background pipeline triggered. Task ID: ${handle.id}`);
    } else {
      console.log("Local environment detected: Saving to public disk...");

      // Fallback: Write file to public/uploads directory for local testing
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const uploadDir = path.join(process.cwd(), "public", "uploads");
      if (!existsSync(uploadDir)) {
        await mkdir(uploadDir, { recursive: true });
      }

      const localPath = path.join(uploadDir, file.name);
      await writeFile(localPath, buffer);

      fileSource = localPath;
      // 💻 LOCAL DEVELOPMENT PATHWAY
      // Since your local terminal doesn't have a 10-second timeout, you can run it
      // locally. We drop the 'await' so it runs asynchronously in the background
      // without blocking this route's JSON response!
      runDocumentProcess(file.name).catch((err) => {
        console.error("Local background embedding failed:", err);
      });
      console.log("Local background processing started directly on your machine.");
    }

    // Send a success response immediately. The user gets this response while
    // the document processing is happening in the background.
    return NextResponse.json({
      message:
        "Document Uploaded Successfully. It is being processed and will be ready for chat in about 10 minutes.",
      filePath: fileSource,
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
/**
 * Sanitizes a filename to make it URL-safe.
 * Replaces special characters and spaces, and converts to lowercase.
 * @param {string} filename The original filename.
 * @returns {string} The sanitized filename.
 */
function sanitizeFilename(filename: string) {
  // Replace spaces with hyphens
  let sanitized = filename.replace(/\s+/g, "-");
  // Remove non-alphanumeric characters, except hyphens and dots
  sanitized = sanitized.replace(/[^a-zA-Z0-9-.]/g, "");
  // Convert to lowercase
  sanitized = sanitized.toLowerCase();
  return sanitized;
}
