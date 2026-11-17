import {io} from "socket.io-client";

export const initializeSocket = () => {
const socket = io(import.meta.env.VITE_API_URL || (import.meta.env.DEV ? undefined : "http://localhost:3000"), {
withCredentials: true,
})

socket.on("connect", () => {
console.log("Connected to server with socket id: " + socket.id);
})
} 