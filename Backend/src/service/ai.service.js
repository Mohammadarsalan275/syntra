
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AIMessage, HumanMessage, SystemMessage , tool, createAgent} from "@langchain/core/messages";
import { ChatMistralAI } from "@langchain/mistralai";
import *as z from "zod" ;
import { searchInternet } from "./internet.service";

const googleApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const mistralApiKey = process.env.MISTRAL_API_KEY;

const googleModel = googleApiKey
  ? new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash-lite",
      apiKey: googleApiKey,
    })
  : null;

const mistralModel = mistralApiKey
  ? new ChatMistralAI({
      model: "mistral-small-latest",
      apiKey: mistralApiKey,
    })
  : null;

    const searchInternetTool = tool (
      searchInternet,
      {
        name:"searchInternet",
        descriotion :"use this tool to search the internet relevent information to answer user quaries",
        inputSchema :z.string(),
      }
    )

const agent = createAgent({
  model:geminiModel,
  tools:[searchInternetTool],
})
export async function generateResponse(message){
  console.log(message)

  const response = await agent.invoke({
    messages:messages.map(msg =>{
      if(msg.role == "ai"){
        return new AIMessage(msg.content)
      }
    })
  });
return response.messages [response.messages.length -1].text;

}

function getTextContent(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => (typeof part?.text === "string" ? part.text : "")).join("");
  }
  if (content && typeof content === "object" && typeof content.text === "string") {
    return content.text;
  }
  return String(content ?? "");
}

function mapHistoryToMessages(messages = []) {
  return messages.map((msg) => {
    if (msg.role === "user") return new HumanMessage(msg.content);
    if (msg.role === "assistant" || msg.role === "ai") return new AIMessage(msg.content);
    if (msg.role === "system") return new SystemMessage(msg.content);
    return new HumanMessage(String(msg.content ?? ""));
  });
}

export async function generateResponse(message, history = []) {
  if (!googleModel) {
    return "AI suggestions are unavailable because no Gemini API key is configured.";
  }

  const response = await googleModel.invoke([
    new SystemMessage("You are a helpful assistant that provides clear, accurate, and concise answers."),
    ...mapHistoryToMessages(history),
    new HumanMessage(message),
  ]);

  return getTextContent(response.content).trim();
}

export const getResponseFrom = generateResponse;

export async function testai() {
  if (!googleModel) {
    console.log("AI is unavailable because no Gemini API key is configured.");
    return;
  }

  const response = await googleModel.invoke([
    new HumanMessage("What is the capital of India?"),
  ]);

  console.log(getTextContent(response.content));
}

export async function generateTitle(message) {
  if (!mistralModel) {
    return message.slice(0, 60).trim() || "New chat";
  }

  const response = await mistralModel.invoke([
    new SystemMessage(
      "Create a short, clear, and practical title for a chat based on the user's first message. Keep it under 60 characters.",
    ),
    new HumanMessage(message),
  ]);

  const title = getTextContent(response.content).trim();
  return title || "New chat";
}