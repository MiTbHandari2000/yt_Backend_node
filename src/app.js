import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

/-------Enable CORS-------/;
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

/-PARSE JSON PAYLOAD-/;
app.use(express.json({ limit: "16kb" }));

/---PARSE URL-ENCODED PAYLOAD--/;
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

/-SERVES STATIC FILE FROM PUBLIC DIRECTORY-/;
app.use(express.static("public"));

/-PARSE COOKIES_ ALLOWS EASY ACCESS TO COOKIES FOR AUTH,TARCKING-/;
app.use(cookieParser());

/-IMPORT ROUTES FROM ROUTER.JS FILE -/;

import userRouter from "./routes/user.routes.js";

/-ROUTE DECLARATION-/;

app.use("/api/v1/users", userRouter);

export { app };
