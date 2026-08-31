"use strict";
const path = require("path");
const fs = require("fs");
const express = require("express");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const { Pool } = require("pg");
const config = require("./config");
const authRouter = require("./auth").router;
const apiRouter = require("./routes/api");
const { startCron } = require("./cron");

const app = express();
app.set("trust proxy", 1); // Railway sits behind a proxy — needed for secure cookies to work

const sessionPool = new Pool({ connectionString: config.databaseUrl });

app.use(express.json());
app.use(
  session({
    store: new pgSession({ pool: sessionPool, tableName: "session", createTableIfMissing: true }),
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  })
);

app.use("/api/auth", authRouter);
app.use("/api", apiRouter);

// Serve the built frontend (see /web) as static files, with SPA fallback.
const webDist = path.join(__dirname, "..", "..", "web", "dist");
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(webDist, "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.send("Frame Friends API is running. Build /web to serve the frontend from here (see README).");
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "server_error" });
});

app.listen(config.port, () => {
  console.log(`Frame Friends server listening on :${config.port}`);
  startCron();
});
