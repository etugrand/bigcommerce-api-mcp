import { discoverTools } from "../lib/tools.js";
import { writesEnabled } from "../lib/bigcommerce.js";

export function registerToolsCommand(program) {
  program
    .command("tools")
    .description("List all available API tools")
    .action(async () => {
      const tools = await discoverTools();
      if (tools.length === 0) {
        console.log("No tools found under tools/<workspace>/<group>/<tool>.js");
        return;
      }

      // path is "<workspace>/<group>/<file>.js"; group the listing by <group>.
      const groups = {};
      for (const tool of tools) {
        const group = tool.path.split("/").at(-2) ?? "ungrouped";
        (groups[group] ??= []).push(tool);
      }

      console.log(`\n${tools.length} tools available:\n`);
      for (const [group, groupTools] of Object.entries(groups).sort()) {
        console.log(`${group}`);
        for (const { definition, writes } of groupTools) {
          const { name, description, parameters } = definition.function;
          console.log(`  ${name}${writes ? "  [write]" : ""}`);
          console.log(`    ${description}`);
          const required = parameters?.required ?? [];
          const params = Object.keys(parameters?.properties ?? {});
          if (params.length) {
            console.log(
              `    params: ${params
                .map((p) => (required.includes(p) ? `${p}*` : p))
                .join(", ")}`
            );
          }
          console.log("");
        }
      }

      if (!writesEnabled()) {
        console.log("Write tools are hidden. Set BIGCOMMERCE_ENABLE_WRITES=true to expose them.\n");
      }
    });
}
