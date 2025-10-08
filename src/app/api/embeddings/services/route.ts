import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import { runDocumentProcess } from "@/embeddings/doc-embeddings/documentEmbeddings.ts";
export async function POST(req: NextRequest) {
  if (req.method != "POST") {
    return NextResponse.json(
      { message: "Method not Allowed" },
      { status: 405 }
    );
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

    // Sanitize the filename to make it URL-safe.
    const sanitizedFilename = sanitizeFilename(file.name);
    // Convert the file Blob to a Buffer to save it to the file system.
    const buffer = Buffer.from(await file.arrayBuffer());

    // Define the directory and filename for the uploaded file.
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    const filename = file.name;

    // Ensure the upload directory exists.
    await fs.mkdir(uploadDir, { recursive: true });

    // Construct the full file path.
    const filePath = path.join(uploadDir, filename);

    // Write the file to disk.
    await fs.writeFile(filePath, buffer);

    // Log the path of the written file for debugging purposes.
    console.log(`File successfully written to: ${filePath}`);

    //Sending the file path to the rundocumnet method
    runDocumentProcess(filename);

    // Send a success response immediately. The user gets this response while
    // the document processing is happening in the background.
    return NextResponse.json({
      message:
        "Document Uploaded Successfully. It is being processed and will be ready for chat in about 10 minutes.",
      filePath: `/uploads/${filename}`,
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
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
