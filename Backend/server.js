import "dotenv/config";
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
