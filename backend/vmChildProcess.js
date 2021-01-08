const { VM } = require("vm2");
const mime = require("mime");
const Rayconnect = require("rayconnect-client").default;

process.on("message", (msg) => {
  console.log("Child process - message received");

  switch (msg.func) {
    case "run":
      runCodeInSandbox(msg.data.code, msg.data.uuid);
      break;

    default:
      break;
  }
  console.log("Child process - after runCode() call");
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
  
        return true
      })();
    `;

  // Sandbox user code. Provide new context with limited scope.
  const sandbox = {
    mime,
    setTimeout,
    setInterval,
  };

  const vm = new VM({
    timeout: 60 * 1000,
    sandbox,
  });

  vm.freeze(Rayconnect, "Rayconnect");
  vm.freeze(writeLog, "writeLog");

  return vm.run(code);
}

const writeLog = function (token, args) {
  process.send({
    func: "logs",
    data: {
      token: token,
      log: args,
    },
  });
};
