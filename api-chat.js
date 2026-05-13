import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const conversationHistory = new Map();

const systemPrompt = `You are SUITCASE AI, an expert marketing consultant specializing in helping small businesses in Madinah, Saudi Arabia grow their marketing effectiveness.

Your role is to:
1. Ask thoughtful diagnostic questions about their business and marketing
2. Understand their current situation, challenges, and goals
3. Ask follow-up questions based on their answers
4. Identify what's working and what needs improvement
5. Provide personalized, actionable marketing strategies

IMPORTANT INSTRUCTIONS:
- Ask one or two questions at a time, not too many
- Ask about: marketing channels they use, budget, online presence, customer engagement, conversion rates, competition
- Pay attention to their answers and ask relevant follow-ups
- Be conversational and helpful, not robotic
- If they're struggling, provide step-by-step strategies
- If they're doing well, give focused tips
- Tailor advice to their specific business type and size
- Keep responses detailed but readable (2-3 paragraphs)

Remember: You're a friendly marketing consultant, not a chatbot. Have a real conversation.`;

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { businessType, businessSize, message, sessionId, language } = req.body;

    if (!message || !sessionId) {
      return res.status(400).json({ 
        error: "Missing required fields",
        success: false 
      });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ 
        error: "API key not configured",
        success: false 
      });
    }

    // Get or create conversation history
    if (!conversationHistory.has(sessionId)) {
      conversationHistory.set(sessionId, []);
    }

    const history = conversationHistory.get(sessionId);

    // Add context about the business
    const businessContext = `
Business Type: ${businessType}
Business Size: ${businessSize}
Language: ${language}
    `.trim();

    // Add user message to history
    history.push({
      role: "user",
      content: message,
    });

    // Call Claude API
    const response = await client.messages.create({
      model: "claude-opus-4-1-20250805",
      max_tokens: 1500,
      system: `${systemPrompt}\n\nBusiness Context:\n${businessContext}`,
      messages: history,
    });

    const assistantMessage =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Add assistant response to history
    history.push({
      role: "assistant",
      content: assistantMessage,
    });

    // Keep only last 20 messages to avoid context overflow
    if (history.length > 20) {
      conversationHistory.set(sessionId, history.slice(-20));
    }

    res.status(200).json({
      message: assistantMessage,
      success: true,
    });
  } catch (error) {
    console.error("Claude API Error:", error);
    res.status(500).json({
      error: error.message || "Failed to process request",
      success: false,
    });
  }
}
