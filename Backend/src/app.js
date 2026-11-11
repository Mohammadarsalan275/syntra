/*import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";

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

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

export default app;
*/

import express from "express";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import AuthRouter from "../routes/auth.routes.js";

dotenv.config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api/auth", AuthRouter);

app.get("/", (req, res) => {
  res.status(200).json({
    message: "API is running successfully",
    status: "ok",
  });
});

export default app;