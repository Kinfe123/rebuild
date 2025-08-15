#!/usr/bin/env node

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// ANSI color codes for pretty output
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

function readPackageJson() {
  try {
    const content = readFileSync("package.json", "utf8");
    return JSON.parse(content);
  } catch (error) {
    log(colors.red, `❌ Failed to read package.json: ${error.message}`);
    return null;
  }
}

async function saveExportsSnapshot(exports, filename) {
  try {
    const fs = await import("node:fs");
    fs.writeFileSync(filename, JSON.stringify(exports, null, 2));
    log(colors.blue, `📁 Saved exports snapshot to ${filename}`);
  } catch (error) {
    log(colors.yellow, `⚠️  Could not save snapshot: ${error.message}`);
  }
}

function testExportsStructure(exports, testName) {
  log(colors.cyan, `\n🧪 Testing: ${testName}`);

  if (!exports) {
    log(colors.red, "❌ No exports field found");
    return false;
  }

  let passed = 0;
  let failed = 0;

  // Test 1: Check for main entry (may not exist in selective mode)
  const hasMainEntry = exports["."];
  const isSelectiveMode =
    !hasMainEntry && Object.keys(exports).some((key) => key.includes("/*"));

  if (hasMainEntry) {
    log(colors.green, "✅ Has main entry export ('.')");
    passed++;
  } else if (isSelectiveMode) {
    log(colors.yellow, "⚠️  No main entry (selective mode detected)");
    passed++; // This is expected in selective mode
  } else {
    log(colors.red, "❌ Missing main entry export ('.')");
    failed++;
  }

  // Test 2: Check if main entry has proper structure
  const mainEntry = exports["."];
  if (mainEntry && typeof mainEntry === "object") {
    if (mainEntry.import || mainEntry.require || mainEntry.types) {
      log(colors.green, "✅ Main entry has proper conditions");
      passed++;
    } else {
      log(colors.red, "❌ Main entry missing import/require/types conditions");
      failed++;
    }
  }

  // Test 3: Check TypeScript support
  let hasTypes = false;
  for (const [key, value] of Object.entries(exports)) {
    if (
      typeof value === "object" &&
      value !== null &&
      (value.types ||
        (value.import && value.import.types) ||
        (value.require && value.require.types))
    ) {
      hasTypes = true;
      break;
    }
  }

  if (hasTypes) {
    log(colors.green, "✅ Exports include TypeScript declaration files");
    passed++;
  } else {
    log(colors.yellow, "⚠️  No TypeScript declaration files found in exports");
  }

  // Test 4: Check for folder patterns
  const folderPatterns = Object.keys(exports).filter((key) =>
    key.includes("/*"),
  );
  if (folderPatterns.length > 0) {
    log(
      colors.green,
      `✅ Has folder pattern exports: ${folderPatterns.join(", ")}`,
    );
    passed++;
  } else {
    log(colors.yellow, "⚠️  No folder pattern exports found");
  }

  // Test 5: Validate export paths exist
  let validPaths = 0;
  let totalPaths = 0;

  for (const [key, value] of Object.entries(exports)) {
    if (typeof value === "object" && value !== null) {
      const checkPath = (path) => {
        if (path && !path.includes("*")) {
          totalPaths++;
          if (existsSync(path.replace("./", ""))) {
            validPaths++;
          }
        }
      };

      if (typeof value === "string") {
        checkPath(value);
      } else {
        checkPath(value.types);
        if (value.import) {
          checkPath(value.import.default);
          checkPath(value.import.types);
        }
        if (value.require) {
          checkPath(value.require.default);
          checkPath(value.require.types);
        }
      }
    }
  }

  if (totalPaths > 0) {
    log(colors.green, `✅ Valid export paths: ${validPaths}/${totalPaths}`);
    if (validPaths === totalPaths) {
      passed++;
    } else {
      failed++;
    }
  }

  log(colors.bold, `\n📊 Test Results: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

function displayExportsStructure(exports) {
  log(colors.cyan, "\n📋 Exports Structure:");
  console.log(JSON.stringify(exports, null, 2));
}

async function main() {
  log(colors.bold, "🚀 Testing Unbuild Export Generation Feature\n");

  const pkg = readPackageJson();
  if (!pkg) {
    process.exit(1);
  }

  log(colors.blue, `📦 Package: ${pkg.name} v${pkg.version}`);

  if (!pkg.exports) {
    log(colors.red, "❌ No exports field found in package.json");
    log(
      colors.yellow,
      "💡 Make sure to run 'npm run build' first with exportMaps enabled",
    );
    process.exit(1);
  }

  // Save a snapshot of the exports for comparison
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  await saveExportsSnapshot(pkg.exports, `exports-${timestamp}.json`);

  // Display the exports structure
  displayExportsStructure(pkg.exports);

  // Run tests
  const testResult = testExportsStructure(
    pkg.exports,
    "Export Generation Validation",
  );

  if (testResult) {
    log(
      colors.green,
      "\n🎉 All tests passed! Export generation is working correctly.",
    );
  } else {
    log(
      colors.red,
      "\n💥 Some tests failed. Check the output above for details.",
    );
    process.exit(1);
  }

  // Additional checks for specific scenarios
  log(colors.cyan, "\n🔍 Additional Checks:");

  const exportKeys = Object.keys(pkg.exports);
  log(colors.blue, `   Export entries count: ${exportKeys.length}`);
  log(colors.blue, `   Export keys: ${exportKeys.join(", ")}`);

  // Check if selective export mode was used
  const hasMainExport = exportKeys.includes(".");
  const hasFolderExports = exportKeys.some((key) => key.includes("/*"));

  if (!hasMainExport && hasFolderExports) {
    log(
      colors.yellow,
      "   🎯 Detected: Selective export mode (no main entry, only specific folders)",
    );
  } else if (hasMainExport && hasFolderExports) {
    log(
      colors.green,
      "   🎯 Detected: Full export mode (main entry + folder patterns)",
    );
  } else if (hasMainExport && !hasFolderExports) {
    log(colors.green, "   🎯 Detected: Simple export mode (main entry only)");
  }

  log(colors.green, "\n✨ Export generation test completed successfully!");
}

main().catch((error) => {
  log(colors.red, `💥 Test failed with error: ${error.message}`);
  process.exit(1);
});
