"use strict";

const fs = require("fs");
const express = require("express");
const cookieParser = require("cookie-parser");

const cors = require("cors");
const Rayconnect = require("rayconnect-client").default;

// const {spawn} = require('child_process');
const mime = require("mime");
const upload = require("multer")();
const { VM } = require("vm2");
const { v4: uuidv4 } = require("uuid");

let EXAMPLES_CACHE = [];
let unhandledRejectionHandlerAdded = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

/**
 * @param {!Array<string>} log
 * @return {!Promise<!Object>}
 */
async function buildResponse(log) {
  const respObj = { log: log.join("\n") };

  return respObj;
}

/**
 * @param {string} code User code to run.
 * @param {Browser=} browser An instance of Chrome to connect to. Assumes the
 *     user's code launches Chrome if not provided.
 * @return {!Promise}
 */
async function runCodeInSandbox(code, token = null) {
  if (code.match(/file:/g) || code.match(/metadata\.google\.internal/g)) {
    throw new Error("Sorry. Cannot access that URL.");
  }

  logses[token] = [];

  const lines = code.split("\n");

  code = lines.join("\n");

  code = `

    // Define inline functions and capture user console logs.
    const logger = (args) => writeLog('${token}', args);
    console.log = logger;
    console.info = logger;
    console.warn = logger;

    const sleep = ${sleep.toString()}; // inline function

    // Wrap user code in an async function so async/await can be used out of the box.
    (async() => {
      ${code} // user's code
      return ${buildResponse.toString()}(readLog('${token}')); // inline function, call it
    })();
  `;

  // Sandbox user code. Provide new context with limited scope.
  const sandbox = {
    mime,
    logses,
    setTimeout,
  };

  const vm = new VM({
    timeout: 60 * 1000,
    sandbox,
  });

  vm.freeze(Rayconnect, "Rayconnect");
  vm.freeze(writeLog, "writeLog");
  vm.freeze(readLog, "readLog");

  return vm.run(code);
}

const writeLog = (token, args) => logses[token].push(args);
const readLog = (token) => logses[token];

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }
  console.error("errorHandler", err);
  res.status(500).send({ errors: `Error running your code. ${err}` });
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
    const browser = app.locals.browser;
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
      const result = await runCodeInSandbox(code, req.headers.token); // await runCodeUsingSpawn(code);
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
