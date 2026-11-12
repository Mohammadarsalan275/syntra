
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

const model = new ChatGoogleGenerativeAI({
    model :"gemini-2.5-flash-lite",
    apikey:process.env.GEMINI_API_KEY
});

export async function testai(){
    model.invoke("what is the capita of india?").then((response)=>{
        console.log(response.text);
    })
}