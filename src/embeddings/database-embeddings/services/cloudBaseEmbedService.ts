export async function getEmbeddingForQuery(query: string): Promise<number[]> {
  try {
    // 🔑 SAFETY CHECK: Guard against missing environment variables
    const apiKey = process.env.CLOUD_JINA_EMBEDDING_API_KEY;

    if (!apiKey) {
      throw new Error(
        "CRITICAL: CLOUD_JINA_EMBEDDING_API_KEY is missing from environment variables."
      );
    }

    const response = await fetch("https://api.jina.ai/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey.trim()}`, // Trim avoids hidden trailing space/newline errors
      },
      body: JSON.stringify({
        model: "jina-embeddings-v3",
        input: [query],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    console.log("👉 Received embedding response from Jina API:", data);
    return data.data[0].embedding;
  } catch (error) {
    console.error("Error in Cloud Embedding generation:", error);
    throw error;
  }
}
