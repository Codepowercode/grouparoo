import fs from "fs-extra";
import path from "path";
import Ora from "ora";
import * as glob from "glob";
import { readPackageJSON } from "./readPackageJSON";
import { ensureNoTsHeaderFiles } from "./ensureNoTsHeaderFiles";

export async function loadLocalCommands(program) {
  // are we in a grouparoo project directory?
  const localPackageFile = path.join(process.env.INIT_CWD, "package.json");
  if (!fs.existsSync(localPackageFile)) return;
  const nodeModulesDir = path.join(process.env.INIT_CWD, "node_modules");
  if (!fs.existsSync(nodeModulesDir)) return;
  const pkgJSON = readPackageJSON(localPackageFile);
  if (!Object.keys(pkgJSON?.dependencies || {}).includes("@grouparoo/core")) {
    return;
  }

  try {
    const { config } = getActionhero();

    let pathsLoaded: string[] = [];

    // grouparoo core
    for (const i in config.general.paths.cli) {
      await loadDirectory(
        program,
        path.join(config.general.paths.cli[i]),
        pathsLoaded
      );
    }

    // plugins
    for (const pluginName in config.plugins) {
      if (config.plugins[pluginName].cli !== false) {
        await loadDirectory(
          program,
          path.join(config.plugins[pluginName].path, "dist", "bin"),
          pathsLoaded
        );
      }
    }
  } catch (error) {
    Ora().fail(error.message || error);
    process.exit(1);
  } finally {
    process.chdir(process.env.INIT_CWD);
  }
}

// --- UTILS ---

function getActionhero() {
  const corePath = path.join(
    process.env.INIT_CWD,
    "node_modules",
    "@grouparoo",
    "core"
  );
  if (fs.existsSync(corePath)) {
    process.chdir(corePath);
  } else {
    throw new Error(
      `Cannot find @grouparoo/core package.  Did you "grouparoo install"?`
    );
  }

  let actionheroPackage = null;

  // TODO: If we are running globally, and there is also a global install of actionhero, we'll find it.  That's bad
  // try {
  //   // we are in a client project with `grouparoo` installed, or we can resolve the package directly (best case)
  //   actionheroPackage = require("actionhero");
  // } catch {}

  if (!actionheroPackage) {
    try {
      // the actionhero package is a peer of @grouparoo/core (client install)
      actionheroPackage = require(path.join(
        process.env.INIT_CWD,
        "node_modules",
        "actionhero"
      ));
    } catch {}
  }

  if (!actionheroPackage) {
    try {
      // the actionhero package is a child of @grouparoo/core (monorepo)
      actionheroPackage = require(path.join(
        process.cwd(),
        "node_modules",
        "actionhero"
      ));
    } catch {}
  }

  if (!actionheroPackage) {
    throw new Error(
      `Cannot find actionhero package.  Did you "grouparoo install"?`
    );
  }

  return actionheroPackage;
}

async function loadDirectory(
  program,
  dir: string,
  pathsLoaded: string[],
  match = "*"
) {
  if (!fs.existsSync(dir)) return;
  const realpath = fs.realpathSync(dir);
  if (pathsLoaded.includes(realpath)) return;
  pathsLoaded.push(realpath);

  const matcher = `${realpath}/**/+(${`${match}.js`})`;
  const files = ensureNoTsHeaderFiles(glob.sync(matcher));
  for (const i in files) {
    const collection = await import(files[i]);
    for (const j in collection) {
      const command = collection[j];
      convertCLIToCommanderAction(command, program);
    }
  }
}

async function convertCLIToCommanderAction(cli, program) {
  if (Object.getPrototypeOf(cli?.prototype?.constructor || {}).name !== "CLI") {
    return;
  }

  const instance = new cli();
  const command = program
    .command(instance.name)
    .description(instance.description)
    .action(async (_program) => {
      await runCommand(instance, _program);
    })
    .on("--help", () => {
      if (instance.example) {
        console.log("");
        console.log("Example: \r\n" + "  " + instance.example);
      }
    });

  for (const key in instance.inputs) {
    const input = instance.inputs[key];
    if (input.required && !input.default) {
      command.requiredOption(`--${key} <${key}>`, input.description);
    } else {
      command.option(`--${key} <${key}>`, input.description, input.default);
    }
  }
}

async function runCommand(instance, _program) {
  let toStop = false;
  const params = _program.opts();

  if (instance.initialize === false && instance.start === false) {
    toStop = await instance.run({ params });
  } else {
    try {
      const { Process } = getActionhero();
      const actionHeroProcess = new Process();

      if (instance.initialize) await actionHeroProcess.initialize();
      if (instance.start) await actionHeroProcess.start();

      toStop = await instance.run({ params });
    } catch (error) {
      console.error(error.toString());
      process.exit(1);
    }
  }

  if (toStop || toStop === null || toStop === undefined) {
    setTimeout(process.exit, 500, 0);
  }
}
