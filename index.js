import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { Command } from "commander";
import { registerToolsCommand } from "./commands/tools.js";

dotenv.config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".env"),
  quiet: true,
});

const program = new Command();

// Register commands
registerToolsCommand(program);

program.parse(process.argv);
