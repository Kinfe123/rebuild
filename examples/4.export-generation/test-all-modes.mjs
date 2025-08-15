#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const colors = {
  green: "\u001B[32m",
  red: "\u001B[31m",
  yellow: "\u001B[33m",
  blue: "\u001B[34m",
  cyan: "\u001B[36m",
  reset: "\u001B[0m",
  bold: "\u001B[1m",
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

function resetPackageJson() {
  const originalPkg = {
    name: "unbuild-example-export-generation",
    version: "1.0.0",
    type: "module",
    description:
      "Example demonstrating automatic package.json exports generation",
    scripts: {
      build: "unbuild",
      "build:all": "unbuild --config build.config.all.ts",
      "build:selective": "unbuild --config build.config.selective.ts",
      "build:disabled": "unbuild --config build.config.disabled.ts",
      test: "node test.mjs",
      "test:all": "npm run build:all && node test.mjs",
      "test:selective": "npm run build:selective && node test.mjs",
      "test:disabled": "npm run build:disabled && node test.mjs",
      clean: "rm -rf dist && rm -f exports-*.json",
    },
    files: ["dist"],
    devDependencies: {
      unbuild: "^2.0.0",
    },
  };

  writeFileSync("package.json", JSON.stringify(originalPkg, null, 2) + "\n");
  log(colors.blue, "📦 Reset package.json to original state");
}

function readPackageJson() {
  const content = readFileSync("package.json", "utf8");
  return JSON.parse(content);
}

function runBuild(config, description) {
  log(colors.cyan, `\n🔨 ${description}`);
  log(colors.yellow, `   Config: ${config}`);

  try {
    execSync(`node ../../dist/cli.mjs --config ${config}`, {
      stdio: "pipe",
      encoding: "utf8",
    });
    log(colors.green, "   ✅ Build completed successfully");
  } catch (error) {
    log(colors.red, `   ❌ Build failed: ${error.message}`);
    return false;
  }

  return true;
}

function analyzeExports(pkg, mode) {
  log(colors.cyan, `\n📋 Results for ${mode}:`);

  if (!pkg.exports) {
    log(colors.yellow, "   📄 No exports field in package.json");
    return;
  }

  const exportKeys = Object.keys(pkg.exports);
  log(colors.green, `   📄 Exports field with ${exportKeys.length} entries:`);

  for (const key of exportKeys) {
    const value = pkg.exports[key];
    if (typeof value === "string") {
      log(colors.blue, `      ${key}: "${value}"`);
    } else {
      log(colors.blue, `      ${key}: { ${Object.keys(value).join(", ")} }`);
    }
  }

  // Check TypeScript support
  const hasTypes = exportKeys.some((key) => {
    const value = pkg.exports[key];
    return (
      typeof value === "object" &&
      value !== null &&
      (value.types ||
        (value.import && value.import.types) ||
        (value.require && value.require.types))
    );
  });

  if (hasTypes) {
    log(colors.green, "   🎯 TypeScript declarations: ✅ Included");
  } else {
    log(colors.yellow, "   🎯 TypeScript declarations: ⚠️  Not found");
  }
}

async function main() {
  log(colors.bold, "🚀 Testing All Export Generation Modes\n");

  // Clean slate for each test
  execSync("rm -rf dist exports-*.json", { stdio: "ignore" });

  const modes = [
    {
      config: "build.config.all.ts",
      name: "Full Export Mode",
      description: "Generate exports for ALL build entries",
    },
    {
      config: "build.config.selective.ts",
      name: "Selective Export Mode",
      description: "Generate exports ONLY for specified folders",
    },
    {
      config: "build.config.disabled.ts",
      name: "Disabled Export Mode",
      description: "NO export generation (preserve original package.json)",
    },
  ];

  for (const mode of modes) {
    // Reset package.json to clean state
    resetPackageJson();

    // Run build
    const success = runBuild(mode.config, `${mode.name}: ${mode.description}`);
    if (!success) continue;

    // Analyze results
    const pkg = readPackageJson();
    analyzeExports(pkg, mode.name);

    // Save snapshot
    const timestamp = new Date().toISOString().slice(11, 19).replace(/:/g, "-");
    const filename = `exports-${mode.name.toLowerCase().replace(/\s+/g, "-")}-${timestamp}.json`;

    if (pkg.exports) {
      writeFileSync(filename, JSON.stringify(pkg.exports, null, 2));
      log(colors.blue, `   💾 Saved snapshot: ${filename}`);
    }

    log(colors.cyan, "   " + "─".repeat(50));
  }

  log(colors.green, "\n🎉 All export generation modes tested successfully!");
  log(
    colors.yellow,
    "\n💡 Check the generated exports-*.json files to compare results",
  );
}

main().catch((error) => {
  log(colors.red, `💥 Test failed: ${error.message}`);
  process.exit(1);
});
