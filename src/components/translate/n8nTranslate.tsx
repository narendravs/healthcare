import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const GROQ_MODEL = "qwen/qwen3.8-27b";

export async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string> {
  if (!text || sourceLang === targetLang) return text;

  try {
    const response = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: "system",
          content: `You are a professional translator. Translate the given text accurately from ${sourceLang} to ${targetLang}. Preserve formatting, markdown, and technical terms. Return ONLY the translated text without explanations, greetings, or backticks.`,
        },
        {
          role: "user",
          content: text,
        },
      ],
      temperature: 0.2,
    });

    const translated = response.choices[0]?.message?.content || text;
    return sanitizeLLMContent(translated);
  } catch (error) {
    console.error("Translation Error:", error);
    return text; // Fallback to original text if translation fails
  }
}

function sanitizeLLMContent(text: string): string {
  if (!text) return "";
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}
