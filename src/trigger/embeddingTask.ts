import { task } from '@trigger.dev/sdk';
import { runDocumentProcess } from '@/embeddings/doc-embeddings/documentCloudEmbeddings.ts';

export const embeddingTask = task({
  id: "process-document-embeddings",
  
  run: async (payload: { fileSource: string }) => {
    console.log(`Starting document embedding pipeline for source: ${payload.fileSource}`);
    
    // Your heavy 15-minute embedding logic executes here securely without timeouts!
    await runDocumentProcess(payload.fileSource);
    
    return { status: "completed" };
  },
});