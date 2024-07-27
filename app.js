import express from "express";
import compression from "compression";
import cors from "cors";
import chatRouter from "./router/chatBot/chatRouter.js";
import { mongodb } from "./config/db.js";
import dotenv from 'dotenv'
const app = express();
const PORT = 3000;

dotenv.config();
app.use(compression()); // Compress all routes

app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: "https://bot-react.onrender.com",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  })
);

//database connecting
mongodb();

app.use("/chat", chatRouter);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
