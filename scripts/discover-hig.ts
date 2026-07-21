import { resolve } from "node:path";
import { discoverInventory } from "../src/lib/discovery.js";
import { writeJson } from "../src/lib/util.js";

const output = resolve("src/sources/apple-hig/inventory.json");
const inventory = await discoverInventory();
await writeJson(output, inventory);
const blocked = inventory.pages.filter((page) => page.status === "blocked").length;
console.log(`Discovered ${inventory.pages.length} HIG pages (${blocked} blocked).`);
