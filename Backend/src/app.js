import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import AuthRouter from "./routes/auth.routes.js";
import morgan from "morgan";
const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan("dev"));
app.use(cors({
  origin : "http://localhost:5173",
  credentials : true,
  methods : ["GET","POST","PUT","DELETE"],
}))

app.use("/api/auth", AuthRouter);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/", (req, res) => {
  res.status(200).json({
    message: "API is running successfully",
    status: "ok",
  });
});

export default app;