import { parseQueryArgs, QUERY_HELP, queryRules } from "../src/lib/query.js";
import { loadRules } from "../src/lib/store.js";

try {
  const options = parseQueryArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(QUERY_HELP);
  } else {
    const result = queryRules(await loadRules(), options);
    process.stdout.write(result.output);
    process.exitCode = result.exitCode;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
