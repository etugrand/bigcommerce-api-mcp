import { readdir } from "fs/promises";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { writesEnabled } from "./bigcommerce.js";

const toolsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../tools"
);

/**
 * Discovers and loads tools from the tools directory.
 *
 * Write tools stay unregistered unless BIGCOMMERCE_ENABLE_WRITES is set, so a
 * default deployment cannot mutate the store even if its endpoint is reached.
 *
 * @returns {Promise<Array>} Array of tool objects.
 */
export async function discoverTools() {
  const files = await readdir(toolsDir, { recursive: true, withFileTypes: true });
  const allowWrites = writesEnabled();

  const modules = await Promise.all(
    files
      .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
      .map(async (entry) => {
        const absolute = path.join(entry.parentPath ?? entry.path, entry.name);
        const { apiTool } = await import(pathToFileURL(absolute).href);
        if (!apiTool?.definition?.function?.name) return null;
        return { ...apiTool, path: path.relative(toolsDir, absolute) };
      })
  );

  return modules
    .filter(Boolean)
    .filter((tool) => allowWrites || !tool.writes)
    .sort((a, b) =>
      a.definition.function.name.localeCompare(b.definition.function.name)
    );
}
