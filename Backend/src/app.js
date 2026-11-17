import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import morgan from "morgan";
import AuthRouter from "./routes/auth.routes.js";
import chatRouter from "./routes/chat.routes.js";

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      const configuredOrigin = process.env.CLIENT_URL || "http://localhost:5173";
      const isLocalDevelopmentOrigin =
        process.env.NODE_ENV !== "production" &&
        typeof origin === "string" &&
        /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(origin);

      if (!origin || origin === configuredOrigin || isLocalDevelopmentOrigin) {
        return callback(null, true);
      }

      return callback(new Error("Origin is not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan("dev"));

app.use("/api/auth", AuthRouter);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/", (_req, res) => {
  res.status(200).json({
    message: "API is running successfully",
    status: "ok",
  });
});

app.use("/api/chat", chatRouter);

export default app;