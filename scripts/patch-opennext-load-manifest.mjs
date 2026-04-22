import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PNPM_DIR = join(process.cwd(), "node_modules", ".pnpm");
const TARGET_SUFFIX = join(
  "node_modules",
  "@opennextjs",
  "cloudflare",
  "dist",
  "cli",
  "build",
  "patches",
  "plugins",
  "load-manifest.js",
);

function getCandidateFiles() {
  if (!existsSync(PNPM_DIR)) {
    return [];
  }

  return readdirSync(PNPM_DIR)
    .filter((entry) => entry.startsWith("@opennextjs+cloudflare@"))
    .map((entry) => join(PNPM_DIR, entry, TARGET_SUFFIX))
    .filter((filePath) => existsSync(filePath));
}

function ensure(content, search, replacement, label) {
  if (content.includes(replacement)) {
    return content;
  }

  if (!content.includes(search)) {
    throw new Error(`[patch-opennext-load-manifest] missing ${label}`);
  }

  return content.replace(search, replacement);
}

function patchFile(filePath) {
  let content = readFileSync(filePath, "utf8");

  content = ensure(
    content,
    "function uniqueFiles(files) {\n    return [...new Set(files)];\n}\n",
    `function uniqueFiles(files) {\n    return [...new Set(files)];\n}\nfunction replaceNamedFunction(contents, functionName, replacement, nextFunctionName) {\n    const start = contents.indexOf(\`function \${functionName}(\`);\n    if (start === -1) {\n        return contents;\n    }\n    const end = contents.indexOf(\`function \${nextFunctionName}(\`, start);\n    if (end === -1) {\n        return contents;\n    }\n    return \`\${contents.slice(0, start)}\${replacement.trim()}\\n\${contents.slice(end)}\`;\n}\n`,
    "replaceNamedFunction helper",
  );

  content = ensure(
    content,
    `            callback: async ({ contents }) => {\n                contents = await patchCode(contents, await getLoadManifestRule(buildOpts));\n                contents = await patchCode(contents, await getEvalManifestRule(buildOpts));\n                return contents;\n            },\n`,
    `            callback: async ({ contents }) => {\n                contents = await patchCode(contents, await getLoadManifestRule(buildOpts));\n                const evalRule = await getEvalManifestRule(buildOpts);\n                contents = await patchCode(contents, evalRule);\n                // Some Next 16 builds keep the original evalManifest shape after AST patching.\n                // Fall back to a direct function replacement so client-reference manifests are\n                // still inlined instead of calling fs.readFileSync at runtime in workerd.\n                if (contents.includes("function evalManifest(") &&\n                    contents.includes("readFileSync") &&\n                    !contents.includes("Unexpected evalManifest")) {\n                    contents = replaceNamedFunction(contents, "evalManifest", evalRule.fix, "loadManifestFromRelativePath");\n                }\n                return contents;\n            },\n`,
    "inlineLoadManifest callback fallback",
  );

  content = content
    .replace(
      "function evalManifest($PATH, $$ARGS) {\n  $$_\n}",
      "function evalManifest($PATH, $$$ARGS) {\n  $$$_\n}",
    )
    .replace(
      "function evalManifest($PATH,$$ARGS){\n  $$_\n}",
      "function evalManifest($PATH, $$$ARGS) {\n  $$$_\n}",
    );

  if (!content.includes("Unexpected evalManifest")) {
    throw new Error(`[patch-opennext-load-manifest] patch did not add fallback marker for ${filePath}`);
  }

  writeFileSync(filePath, content);
  return filePath;
}

const files = getCandidateFiles();

if (files.length === 0) {
  console.warn("[patch-opennext-load-manifest] no OpenNext load-manifest.js found, skipping");
}

const patched = files.map(patchFile);
console.log(`[patch-opennext-load-manifest] patched ${patched.length} file(s)`);
for (const filePath of patched) {
  console.log(` - ${filePath}`);
}
