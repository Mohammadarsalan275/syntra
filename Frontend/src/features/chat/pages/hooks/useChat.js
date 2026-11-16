import {  initializesocketconnection } from  "../service/chat.socket"
import { sendMessage,getChats,getMessage , deleteChat , addNewMessage } from "../service/chat.api"
import {setChat ,setCurrentId, setError, setLoading} from "../chat.slice"
import {useDispatch} from "react-redux"

export const useChat = () =>{

    const dispatch = useDispatch()
async function handleSendMessage({message, chatId}){
    diapatch(setLoading(true)) 
    const data =await sendMessage({message,chatId})

    const {chat , aiMessage}= data
if(!chatId)
dispatch(createNewchat({
    chatId: chat._id,
    title:chat.title,
}))

    dispatch(setChat((prev)=>{
        return {
            ...prev,
            [chat.title]: {
                ...chat,
                message:[ { content :message , role:"user"},aiMessage]
            },
        }
    }))

    diapatch(setCurrentId(chat._id))
}

dispatch(addNewMessage({
    chatId :chatId || chat._id,
    content :message,
    role : "user"
}))

dispatch(addNewMessage({
    chatId:chat._id ||chatId,
    content:message,
    role:"user",
}))

async function  handleOpenChat (chatId){
    const data = await getMessage(chatId)
const {message} = data

const formattedMessage = message.map(msg =>({
    content :msg.content,
    role:message.role,
}))
dispatch(addMessage({
    chatId,
    messages:formattedMessage,
}))
dispatch(setCurrentId(chatId))

}

    return {
        initializesocketconnection,
        handleSendMessage,
        handleOpenChat,
        handleGetChat
    }
}