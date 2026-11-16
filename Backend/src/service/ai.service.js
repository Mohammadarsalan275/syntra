
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanChatMessage, SystemMessage } from "langchain";
import {chatMistral} from "@langchain/mistralai";

const model = new ChatGoogleGenerativeAI({
    model :"gemini-2.5-flash-lite",
    apikey:process.env.GEMINI_API_KEY
});

const mistralModel = new chatMistral({
    model:"mistral-small-latest",
    apikey:process.env.MISTRAL_API_KEY
})

export async function getResponseFrom(message){
    const response = await geminiModel.invoke(messages.map(msg => {
        if(msg.role == "user"){
            response = new HumanChatMessage(msg.content);
        }
        else if(msg.role == "AI"){
            return new AIMessage(msg.content);
        }
    }));
return response.text;
}


export async function testai(){
    model.invoke("what is the capita of india?").then((response)=>{
        console.log(response.text);
    })
}


export async function generateTitle(message){
    const response= await mistralModel.invoke([
        new SystemMessage(' 
            You are a helpful assistant that provides concise and accurate answers to user questions.
            
            user will provide you with the first message of chat  conversation and you will provide the response to that message.
            
            '),
        new HumanChatMessage(message)
    ])
    return response.text;
}