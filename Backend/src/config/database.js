import dns from "node:dns";
import mongoose from "mongoose";

export async function connectDB() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI is not configured. Add it to Backend/.env.");
  }

  try {
    await mongoose.connect(mongoUri);
  } catch (error) {
    if (error.code !== "ECONNREFUSED" || !error.syscall?.startsWith("querySrv")) {
      throw error;
    }

    const dnsServers = (
      process.env.MONGODB_DNS_SERVERS || "8.8.8.8,1.1.1.1"
    )
      .split(",")
      .map((server) => server.trim())
      .filter(Boolean);

    if (dnsServers.length === 0) {
      throw new Error("MONGODB_DNS_SERVERS must contain at least one DNS server");
    }

    console.warn(
      `MongoDB SRV lookup was refused by the system DNS resolver; retrying with ${dnsServers.join(", ")}`,
    );
    dns.setServers(dnsServers);
    await mongoose.connect(mongoUri);
  }

  console.log("MongoDB connected");
}
