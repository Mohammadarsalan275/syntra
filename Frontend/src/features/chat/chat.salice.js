import {createSlice} from '@reduxjs/toolkit';

const chatSlice = createSlice({
    name:"chat",
    initialState:{
        chat:{},
        currentChatId:null,
        isLoading:false,
        error:null,
    },
    reducers:{
addNewMessage :(state , action )=>{
const { chatId , content,role} = action.payload
state.chats [chatId] .messsage.push({content,role})
},

        setChats:(state,action)=>{
            state.chats =action.payload
        },
        setCurrentChatId: (state,action)=>{
            state.currentChatId = action.payload
        },
        setLoading : (state,action) =>{
            state.isLoading = action.payload
        },
        setError : (state, action) => {
            state.error = action.payload;
        }
    }
})

export const {setChats,setCurrentChatId, setLoading, setError ,createNewChat, addNewMessage} =chatSlice.actions

export default chatSlice.reducer

