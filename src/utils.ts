import fsp from "node:fs/promises";
import { readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "pathe";
import { createJiti } from "jiti";
import { consola } from "consola";
import type { PackageJson } from "pkg-types";
import { autoPreset } from "./auto";
import type { BuildPreset, BuildConfig, BuildContext } from "./types";

export async function ensuredir(path: string): Promise<void> {
  await fsp.mkdir(dirname(path), { recursive: true });
}

export function warn(ctx: BuildContext, message: string): void {
  if (ctx.warnings.has(message)) {
    return;
  }
  consola.debug("[unbuild] [warn]", message);
  ctx.warnings.add(message);
}

export async function symlink(
  from: string,
  to: string,
  force = true,
): Promise<void> {
  await ensuredir(to);
  if (force) {
    await fsp.unlink(to).catch(() => {});
  }
  await fsp.symlink(from, to, "junction");
}

export function dumpObject(obj: Record<string, any>): string {
  return (
    "{ " +
    Object.keys(obj)
      .map((key) => `${key}: ${JSON.stringify(obj[key])}`)
      .join(", ") +
    " }"
  );
}

export function getpkg(id = ""): string {
  const s = id.split("/");
  return s[0][0] === "@" ? `${s[0]}/${s[1]}` : s[0];
}

export async function rmdir(dir: string): Promise<void> {
  await fsp.unlink(dir).catch(() => {});
  await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
}

export function listRecursively(path: string): string[] {
  const filenames = new Set<string>();
  const walk = (path: string): void => {
    const files = readdirSync(path);
    for (const file of files) {
      const fullPath = resolve(path, file);
      if (statSync(fullPath).isDirectory()) {
        filenames.add(fullPath + "/");
        walk(fullPath);
      } else {
        filenames.add(fullPath);
      }
    }
  };
  walk(path);
  return [...filenames];
}

export async function resolvePreset(
  preset: string | BuildPreset,
  rootDir: string,
): Promise<BuildConfig> {
  if (preset === "auto") {
    preset = autoPreset;
  } else if (typeof preset === "string") {
    preset =
      (await createJiti(rootDir, { interopDefault: true }).import(preset, {
        default: true,
      })) || {};
  }
  if (typeof preset === "function") {
    preset = preset();
  }
  return preset as BuildConfig;
}

export function inferExportType(
  condition: string,
  previousConditions: string[] = [],
  filename = "",
): "esm" | "cjs" {
  if (filename) {
    if (filename.endsWith(".d.ts")) {
      return "esm";
    }
    if (filename.endsWith(".mjs")) {
      return "esm";
    }
    if (filename.endsWith(".cjs")) {
      return "cjs";
    }
  }
  switch (condition) {
    case "import": {
      return "esm";
    }
    case "require": {
      return "cjs";
    }
    default: {
      if (previousConditions.length === 0) {
        // TODO: Check against type:module for default
        return "esm";
      }
      const [newCondition, ...rest] = previousConditions;
      return inferExportType(newCondition, rest, filename);
    }
  }
}

export type OutputDescriptor = { file: string; type?: "esm" | "cjs" };

export function extractExportFilenames(
  exports: PackageJson["exports"],
  conditions: string[] = [],
): OutputDescriptor[] {
  if (!exports) {
    return [];
  }
  if (typeof exports === "string") {
    return [{ file: exports, type: "esm" }];
  }
  return (
    Object.entries(exports)
      // Filter out .json subpaths such as package.json
      .filter(([subpath]) => !subpath.endsWith(".json"))
      .flatMap(([condition, exports]) =>
        typeof exports === "string"
          ? {
              file: exports,
              type: inferExportType(condition, conditions, exports),
            }
          : extractExportFilenames(exports, [...conditions, condition]),
      )
  );
}

export function arrayIncludes(
  arr: (string | RegExp)[],
  searchElement: string,
): boolean {
  return arr.some((entry) =>
    entry instanceof RegExp
      ? entry.test(searchElement)
      : entry === searchElement,
  );
}

export function removeExtension(filename: string): string {
  return filename.replace(/\.(js|mjs|cjs|ts|mts|cts|json|jsx|tsx)$/, "");
}

export function inferPkgExternals(pkg: PackageJson): (string | RegExp)[] {
  const externals: (string | RegExp)[] = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
    ...Object.keys(pkg.devDependencies || {}).filter((dep) =>
      dep.startsWith("@types/"),
    ),
    ...Object.keys(pkg.optionalDependencies || {}),
  ];

  if (pkg.name) {
    externals.push(pkg.name);
    if (pkg.exports) {
      for (const subpath of Object.keys(pkg.exports)) {
        if (subpath.startsWith("./")) {
          externals.push(pathToRegex(`${pkg.name}/${subpath.slice(2)}`));
        }
      }
    }
  }

  if (pkg.imports) {
    for (const importName of Object.keys(pkg.imports)) {
      if (importName.startsWith("#")) {
        externals.push(pathToRegex(importName));
      }
    }
  }

  return [...new Set(externals)];
}

function pathToRegex(path: string): string | RegExp {
  return path.includes("*")
    ? new RegExp(
        `^${path.replace(/\./g, String.raw`\.`).replace(/\*/g, ".*")}$`,
      )
    : path;
}

export function withTrailingSlash(path: string): string {
  return path.endsWith("/") ? path : `${path}/`;
}

export interface ExportCondition {
  types?: string;
  default: string;
}

export type ExportMap = PackageJson["exports"];

export function generatePackageExports(
  buildEntries: Array<{ path: string; chunk?: boolean }>,
  outDir: string,
  exportImport: boolean | string[] = false,
  pkg?: PackageJson,
): PackageJson["exports"] {
  if (exportImport === false) {
    return undefined;
  }

  const exports: Record<string, any> = {};
  const filterFolders = Array.isArray(exportImport) ? exportImport : [];
  const shouldIncludeAll =
    exportImport === true ||
    (Array.isArray(exportImport) && exportImport.length === 0);

  // Group entries by their base path (directory structure)
  const entryGroups = new Map<string, string[]>();

  for (const entry of buildEntries) {
    // Skip chunk files unless they are TypeScript declaration files
    if (entry.chunk && !entry.path.includes(".d.")) continue;

    const path = entry.path;
    let pathWithoutExt = removeExtension(path);

    // Handle TypeScript declaration files by removing the .d part
    if (pathWithoutExt.endsWith(".d")) {
      pathWithoutExt = pathWithoutExt.slice(0, -2);
    }

    // Determine the base directory structure
    const parts = pathWithoutExt.split("/");
    let baseKey = ".";

    if (parts.length > 1) {
      // For paths like "plugins/vite", create base key like "./plugins"
      baseKey = `./${parts[0]}`;
    }

    // Apply folder filtering if specified
    if (!shouldIncludeAll && filterFolders.length > 0) {
      const folderName = parts[0];
      if (!filterFolders.includes(folderName)) {
        continue;
      }
    }

    if (!entryGroups.has(baseKey)) {
      entryGroups.set(baseKey, []);
    }
    entryGroups.get(baseKey)!.push(path);
  }

  // Generate exports for each group
  for (const [baseKey, files] of entryGroups) {
    // Check if this is a main entry (index file) or a folder pattern
    const isMainEntry = baseKey === ".";
    const hasFolderPattern = files.some((f) => f.includes("/") && !isMainEntry);

    if (isMainEntry) {
      // Main entry exports (usually index files)
      const mainFiles = files.filter((f) => {
        const nameWithoutExt = removeExtension(f);
        return nameWithoutExt === "index" || !f.includes("/");
      });

      if (mainFiles.length > 0) {
        const exportConditions = generateExportConditions(mainFiles, outDir);
        if (exportConditions && Object.keys(exportConditions).length > 0) {
          exports["."] = exportConditions;
        }
      }
    } else if (hasFolderPattern) {
      // Folder pattern exports like "./plugins/*"
      const folderName = baseKey.slice(2); // Remove "./"
      const exportConditions = generateFolderPatternExportConditions(
        files,
        outDir,
        folderName,
      );
      if (exportConditions && Object.keys(exportConditions).length > 0) {
        exports[`${baseKey}/*`] = exportConditions;
      }
    } else {
      // Single file exports in a folder
      const exportConditions = generateExportConditions(files, outDir);
      if (exportConditions && Object.keys(exportConditions).length > 0) {
        exports[baseKey] = exportConditions;
      }
    }
  }

  return Object.keys(exports).length > 0 ? exports : undefined;
}

function generateExportConditions(
  files: string[],
  outDir: string,
  prefix = "",
): any {
  // Group files by extension type
  const filesByType = {
    mjs: files.filter((f) => f.endsWith(".mjs")),
    cjs: files.filter((f) => f.endsWith(".cjs")),
    dts: files.filter((f) => f.endsWith(".d.ts")),
    dmts: files.filter((f) => f.endsWith(".d.mts")),
    dcts: files.filter((f) => f.endsWith(".d.cts")),
  };

  // If only one non-declaration file and no separate declaration files, return simple string export
  const hasDeclarationFiles =
    filesByType.dts.length > 0 ||
    filesByType.dmts.length > 0 ||
    filesByType.dcts.length > 0;

  if (files.length === 1 && !hasDeclarationFiles && !files[0].includes(".d.")) {
    return `./${outDir}/${prefix}${files[0]}`;
  }

  const conditions: any = {};

  // Add top-level types field if we have declaration files
  if (hasDeclarationFiles) {
    if (filesByType.dts.length > 0) {
      conditions.types = `./${outDir}/${prefix}${filesByType.dts[0]}`;
    } else if (filesByType.dmts.length > 0) {
      conditions.types = `./${outDir}/${prefix}${filesByType.dmts[0]}`;
    } else if (filesByType.dcts.length > 0) {
      conditions.types = `./${outDir}/${prefix}${filesByType.dcts[0]}`;
    }
  }

  // ESM imports
  if (filesByType.mjs.length > 0) {
    conditions.import = {
      default: `./${outDir}/${prefix}${filesByType.mjs[0]}`,
    };

    if (filesByType.dmts.length > 0) {
      conditions.import.types = `./${outDir}/${prefix}${filesByType.dmts[0]}`;
    } else if (filesByType.dts.length > 0) {
      conditions.import.types = `./${outDir}/${prefix}${filesByType.dts[0]}`;
    }
  }

  // CJS requires
  if (filesByType.cjs.length > 0) {
    conditions.require = {
      default: `./${outDir}/${prefix}${filesByType.cjs[0]}`,
    };

    if (filesByType.dcts.length > 0) {
      conditions.require.types = `./${outDir}/${prefix}${filesByType.dcts[0]}`;
    } else if (filesByType.dts.length > 0) {
      conditions.require.types = `./${outDir}/${prefix}${filesByType.dts[0]}`;
    }
  }

  // If we only have declaration files, create a types-only export
  if (
    filesByType.mjs.length === 0 &&
    filesByType.cjs.length === 0 &&
    hasDeclarationFiles
  ) {
    if (filesByType.dmts.length > 0) {
      conditions.import = {
        types: `./${outDir}/${prefix}${filesByType.dmts[0]}`,
      };
    }
    if (filesByType.dcts.length > 0) {
      conditions.require = {
        types: `./${outDir}/${prefix}${filesByType.dcts[0]}`,
      };
    }
    if (
      filesByType.dts.length > 0 &&
      !conditions.import &&
      !conditions.require
    ) {
      conditions.types = `./${outDir}/${prefix}${filesByType.dts[0]}`;
    }
  }

  return conditions;
}

function generateFolderPatternExportConditions(
  files: string[],
  outDir: string,
  folderName: string,
): any {
  // Group files by extension type
  const filesByType = {
    mjs: files.filter((f) => f.endsWith(".mjs")),
    cjs: files.filter((f) => f.endsWith(".cjs")),
    dts: files.filter((f) => f.endsWith(".d.ts")),
    dmts: files.filter((f) => f.endsWith(".d.mts")),
    dcts: files.filter((f) => f.endsWith(".d.cts")),
  };

  const conditions: any = {};
  const hasDeclarationFiles =
    filesByType.dts.length > 0 ||
    filesByType.dmts.length > 0 ||
    filesByType.dcts.length > 0;

  // Add top-level types field if we have declaration files
  if (hasDeclarationFiles) {
    if (filesByType.dts.length > 0) {
      conditions.types = `./${outDir}/${folderName}/*.d.ts`;
    } else if (filesByType.dmts.length > 0) {
      conditions.types = `./${outDir}/${folderName}/*.d.mts`;
    } else if (filesByType.dcts.length > 0) {
      conditions.types = `./${outDir}/${folderName}/*.d.cts`;
    }
  }

  // ESM imports
  if (filesByType.mjs.length > 0) {
    conditions.import = {
      default: `./${outDir}/${folderName}/*.mjs`,
    };

    if (filesByType.dmts.length > 0) {
      conditions.import.types = `./${outDir}/${folderName}/*.d.mts`;
    } else if (filesByType.dts.length > 0) {
      conditions.import.types = `./${outDir}/${folderName}/*.d.ts`;
    }
  }

  // CJS requires
  if (filesByType.cjs.length > 0) {
    conditions.require = {
      default: `./${outDir}/${folderName}/*.cjs`,
    };

    if (filesByType.dcts.length > 0) {
      conditions.require.types = `./${outDir}/${folderName}/*.d.cts`;
    } else if (filesByType.dts.length > 0) {
      conditions.require.types = `./${outDir}/${folderName}/*.d.ts`;
    }
  }

  // If we only have declaration files, create a types-only export
  if (
    filesByType.mjs.length === 0 &&
    filesByType.cjs.length === 0 &&
    hasDeclarationFiles
  ) {
    if (filesByType.dmts.length > 0) {
      conditions.import = { types: `./${outDir}/${folderName}/*.d.mts` };
    }
    if (filesByType.dcts.length > 0) {
      conditions.require = { types: `./${outDir}/${folderName}/*.d.cts` };
    }
    if (
      filesByType.dts.length > 0 &&
      !conditions.import &&
      !conditions.require
    ) {
      conditions.types = `./${outDir}/${folderName}/*.d.ts`;
    }
  }

  return conditions;
}
