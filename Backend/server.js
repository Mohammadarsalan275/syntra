/*import "dotenv/config";
import app from "./src/app.js";
import { connectDB } from "./src/config/database.js";

const port = Number(process.env.PORT) || 3000;

try {
  await connectDB();
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
} catch (error) {
  console.error("Failed to start server:", error);
  process.exitCode = 1;
}

*/

import app from "./config/app.js";
import mongoose from "mongoose";
import dotenv from "dotenv";


dotenv.config();

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/perplexity";

const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
  }
};

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
};

startServer();