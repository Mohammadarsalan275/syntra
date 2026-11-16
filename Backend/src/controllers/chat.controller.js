
import { Result } from 'express-validator';
import {generateResponse,generateTitle} from '../service/ai.service.js';
import { AIMessage } from 'langchain';
import chatModel from "../models/chat.model.js";

export async function sendMessage(req, res) {
    const {sendMessage,chat:chatId} = req.body;

let chat=null, tirle=null;

title = await generateTitle(sendMessage);
console.log(title);


    const result = await generateResponse(sendMessage);
chat =await chatModel.create({
    user:req.user._id,
    title
})

const aiMessage = await messageModel.create({
    chat:chat._id,
    content:result,
    role:"AI"
})

    res.json({
        AIMessage: result,
        title,
        chat,
        aiMessage
})


}
export async function  getChats(req,res){
    const user = req.user

    const chats =await chatModel.find({user:user._id})
    res.status(200).json({
        message:"Chats fetched successfully",
    })

    export async function getMessages(req,res){
const {chatId} = req.params;

const chat = await chatModel.findOne({
    _id:chatId,
    user:req.user._id
})
if(!chat){
    return res.status(404).json({
        message:"Chat not found"
    })
}

const messages = await messageModel.find({
    chat:chat._id
})

res.status(200).json({
    messages:"messages fetched successfully",
    messages
    })
}

export async function deleteChat(req,res){
    const {chatId} = req.params;

    const chat = await chatModel.findOneAndDelete({
        _id:chatId,
        user:req.user._id
    })

    await messageModel.deleteMany({
        chat:chat._id
    })
    if(!chat){
        return res.status(404).json({
            message:"Chat not found"
        })
    }
}