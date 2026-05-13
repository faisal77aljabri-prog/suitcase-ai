import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const history = new Map();

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed", success: false });
  }

  try {
    const { businessType, businessSize, message, sessionId } = req.body;
    
    if (!message || !sessionId) {
      return res.status(400).json({ error: "Missing fields", success: false });
    }

    if (!history.has(sessionId)) {
      history.set(sessionId, []);
    }

    const h = history.get(sessionId);
    h.push({ role: "user", content: message });

    const response = await client.messages.create({
      model: "claude-opus-4-1-20250805",
      max_tokens: 1500,
      system: `You are SUITCASE AI, a marketing consultant for small businesses in Madinah. Ask diagnostic questions about their marketing, understand their situation, and provide personalized strategies. Business: ${businessType}, Size: ${businessSize}. Be conversational and helpful.`,
      messages: h,
    });

    const resp = response.content[0].type === "text" ? response.content[0].text : "";
    h.push({ role: "assistant", content: resp });

    if (h.length > 20) {
      history.set(sessionId, h.slice(-20));
    }

    res.status(200).json({ message: resp, success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Error", success: false });
  }
}
