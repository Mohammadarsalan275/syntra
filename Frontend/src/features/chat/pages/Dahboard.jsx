import React from 'react'
import { useSelector } from 'react-redux';
import {useChat} from "../hooks/useChat";

const Dahboard = () => {
const chat = usechat();
    const {user} = useSelector((state) => state.auth);
    console.log(user);
useEffect(() => {
    chat.initializeSocket();
}, [])

  return (
    <div>Dahboard</div>
  )
}

export default Dahboard