import "dotenv/config";
import app from "./src/app.js";
import { connectDB } from "./src/config/database.js";
import http from "http";
import { initSocket } from "./src/socket/server.socket.js";


const port = Number(process.env.PORT) || 3000;

const httpServer = http.createServer(app);
initSocket(httpServer);

async function startServer() {
  try {
    await connectDB();
    await new Promise((resolve, reject) => {
      httpServer.once("error", reject);
      httpServer.listen(port, resolve);
    });
    console.log(`Server is running on port ${port}`);
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exitCode = 1;
  }
}

startServer();
