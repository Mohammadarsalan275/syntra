import "dotenv/config";
import app from "./src/app.js";
import { connectDB } from "./src/config/database.js";
import http from "http";
import net from "node:net";
import { initSocket } from "./src/socket/server.socket.js";


const port = Number(process.env.PORT) || 3000;

const httpServer = http.createServer(app);

async function ensurePortAvailable() {
  const probe = net.createServer();

  try {
    await new Promise((resolve, reject) => {
      probe.once("error", reject);
      probe.listen(port, resolve);
    });
  } finally {
    if (probe.listening) {
      await new Promise((resolve, reject) => {
        probe.close((error) => (error ? reject(error) : resolve()));
      });
    }
  }
}

async function startServer() {
  try {
    await ensurePortAvailable();

    try {
      await connectDB();
    } catch (error) {
      if (process.env.NODE_ENV === "production" || process.env.DEMO_AUTH_ENABLED === "false") {
        throw error;
      }

      console.warn(
        "MongoDB is unavailable; starting demo mode with in-memory accounts and chats.",
        error.message,
      );
    }

    initSocket(httpServer);
    await new Promise((resolve, reject) => {
      httpServer.once("error", reject);
      httpServer.listen(port, resolve);
    });
    console.log(`Server is running on port ${port}`);
  } catch (error) {
    if (error.code === "EADDRINUSE") {
      console.error(
        `Port ${port} is already in use. Another backend instance is running; use it, or stop it before starting this one.`,
      );
      process.exitCode = 0;
      return;
    }

    console.error("Failed to start server:", error);
    process.exitCode = 1;
  }
}

startServer();
