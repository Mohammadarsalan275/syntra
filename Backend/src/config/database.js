import mongoose from "mongoose";

export async function connectDB() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI is not configured. Add it to Backend/.env.");
  }

  await mongoose.connect(mongoUri);
  console.log("MongoDB connected");
}
