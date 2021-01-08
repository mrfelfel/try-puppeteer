"use strict";

const fs = require("fs");
const express = require("express");
const cookieParser = require("cookie-parser");

const cors = require("cors");
const upload = require("multer")();
const { v4: uuidv4 } = require("uuid");

let EXAMPLES_CACHE = [];
let unhandledRejectionHandlerAdded = false;

const logses = {};

// Async route handlers are wrapped with this to catch rejected promise errors.
const catchAsyncErrors = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

async function listExamples() {
  if (EXAMPLES_CACHE.length) {
    return EXAMPLES_CACHE;
  }

  return new Promise((resolve, reject) => {
    try {
      const examples = fs
        .readdirSync("./rayjs/examples/")
        .filter(
          (filename) => !filename.startsWith(".") && filename.endsWith(".js")
        );
      EXAMPLES_CACHE = examples;
      return resolve(examples);
    } catch (err) {
      reject(err);
    }
  });
}

listExamples(); // Populate when server fires up.

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }
  console.error("errorHandler", err);
  res.status(500).send({ errors: `Error running your code. ${err}` });
}

function runCodeInFork(code, uuid) {
  const { fork } = require("child_process");

  const vmProcess = fork("vmChildProcess.js");

  logses[uuid] = [];
  vmProcess.send({
    func: "run",
    data: {
      code: code,
      uuid,
    },
  });

  setTimeout(() => {
    vmProcess.kill();
  }, 10000);
  vmProcess.on("message", (msg) => {
    switch (msg.func) {
      case "logs":
        logses[msg.data.token].push(msg.data.log);
        break;

      default:
        break;
    }
  });
  console.log("Master process - finish");
}

const app = express();

app.use(cookieParser());

// CORSs setup comes before static handler to examples can be loaded x-origin.
app.use(cors());

app.use(express.static("./rayjs/examples/"));

app.get("/", (req, res, next) => {
  res.status(200).send("It works!");
});

app.get(
  "/examples",
  catchAsyncErrors(async (req, res, next) => {
    res.status(200).json(await listExamples());
  })
);

app.get(
  "/token",
  catchAsyncErrors(async (req, res, next) => {
    res.status(200).json({
      token: uuidv4(),
    });
  })
);

const readLog = (token) => logses[token];

app.get("/logs", (req, res) => {
  if (!req.headers.token) {
    return res.status(200).json({
      log: [],
    });
  }
  res.status(200).json({
    log: readLog(req.headers.token),
  });
});

app.post(
  "/run",
  upload.single("file"),
  catchAsyncErrors(async (req, res, next) => {
    const code = req.file.buffer.toString();

    // Only add listener once per process.
    if (!unhandledRejectionHandlerAdded) {
      process.on("unhandledRejection", (err) => {
        console.error("unhandledRejection");
        next(err, req, res, next);
      });
      unhandledRejectionHandlerAdded = true;
    }

    try {
      runCodeInFork(code, req.headers.token);
      const result = {
        log: ["started"],
      }; // await runCodeUsingSpawn(code);
      if (!res.headersSent) {
        res.status(200).send(result);
      }
    } catch (err) {
      throw err;
    }
  })
);

app.use(errorHandler);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
  console.log("Press Ctrl+C to quit.");
});
