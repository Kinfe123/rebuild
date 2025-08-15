import { describe, it, expect } from "vitest";
import {
  arrayIncludes,
  extractExportFilenames,
  inferExportType,
  inferPkgExternals,
  generatePackageExports,
} from "../src/utils";

describe("inferExportType", () => {
  it("infers export type by condition", () => {
    expect(inferExportType("import")).to.equal("esm");
    expect(inferExportType("require")).to.equal("cjs");
    expect(inferExportType("node")).to.equal("esm");
    expect(inferExportType("some_unknown_condition")).to.equal("esm");
  });
  it("infers export type based on previous conditions", () => {
    expect(inferExportType("import", ["require"])).to.equal("esm");
    expect(inferExportType("node", ["require"])).to.equal("cjs");
    expect(inferExportType("node", ["import"])).to.equal("esm");
    expect(inferExportType("node", ["unknown", "require"])).to.equal("cjs");
  });
});

describe("extractExportFilenames", () => {
  it("handles strings", () => {
    expect(extractExportFilenames("test")).to.deep.equal([
      { file: "test", type: "esm" },
    ]);
  });
  it("handles nested objects", () => {
    expect(extractExportFilenames({ require: "test" })).to.deep.equal([
      { file: "test", type: "cjs" },
    ]);
    expect(
      extractExportFilenames({
        require: { node: "test", other: { import: "this", require: "that" } },
      }),
    ).to.deep.equal([
      { file: "test", type: "cjs" },
      { file: "this", type: "esm" },
      { file: "that", type: "cjs" },
    ]);
  });
});

describe("arrayIncludes", () => {
  it("handles strings", () => {
    expect(arrayIncludes(["test1", "test2"], "test1")).to.eq(true);
    expect(arrayIncludes(["test1", "test2"], "test3")).to.eq(false);
  });
  it("handles regular expressions", () => {
    expect(arrayIncludes([/t1$/, "test2"], "test1")).to.eq(true);
    expect(arrayIncludes([/t3$/, "test2"], "test1")).to.eq(false);
  });
});

describe("inferPkgExternals", () => {
  it("infers externals from package.json", () => {
    expect(
      inferPkgExternals({
        name: "test",
        dependencies: { react: "17.0.0" },
        peerDependencies: { "react-dom": "17.0.0" },
        devDependencies: { "@types/react": "17.0.0", webpack: "*" },
        optionalDependencies: { test: "1.0.0", optional: "1.0.0" },
        exports: {
          ".": "index.js",
          "./extra/utils": "utils.js",
          "./drivers/*.js": "drivers/*.js",
          invalid: "invalid.js",
        },
        imports: {
          "#*": "src/*",
          "#test": "test.js",
          invalid: "invalid.js",
        },
      }),
    ).to.deep.equal([
      "react",
      "react-dom",
      "@types/react",
      "test",
      "optional",
      "test/extra/utils",
      /^test\/drivers\/.*\.js$/,
      /^#.*$/,
      "#test",
    ]);
  });
});

describe("generatePackageExports", () => {
  it("returns undefined when exportImport is false", () => {
    const buildEntries = [{ path: "index.mjs" }];
    const result = generatePackageExports(buildEntries, "dist", false);
    expect(result).toBe(undefined);
  });

  it("generates basic exports for main entry", () => {
    const buildEntries = [
      { path: "index.mjs" },
      { path: "index.cjs" },
      { path: "index.d.mts" },
      { path: "index.d.cts" },
    ];
    const result = generatePackageExports(buildEntries, "dist", true);
    expect(result).to.deep.equal({
      ".": {
        types: "./dist/index.d.mts",
        import: {
          types: "./dist/index.d.mts",
          default: "./dist/index.mjs",
        },
        require: {
          types: "./dist/index.d.cts",
          default: "./dist/index.cjs",
        },
      },
    });
  });

  it("generates folder pattern exports", () => {
    const buildEntries = [
      { path: "plugins/vite.mjs" },
      { path: "plugins/vite.cjs" },
      { path: "plugins/vite.d.mts" },
      { path: "plugins/vite.d.cts" },
      { path: "plugins/webpack.mjs" },
      { path: "plugins/webpack.cjs" },
      { path: "plugins/webpack.d.mts" },
      { path: "plugins/webpack.d.cts" },
    ];
    const result = generatePackageExports(buildEntries, "dist", true);
    expect(result).to.deep.equal({
      "./plugins/*": {
        types: "./dist/plugins/*.d.mts",
        import: {
          types: "./dist/plugins/*.d.mts",
          default: "./dist/plugins/*.mjs",
        },
        require: {
          types: "./dist/plugins/*.d.cts",
          default: "./dist/plugins/*.cjs",
        },
      },
    });
  });

  it("filters exports by specified folders", () => {
    const buildEntries = [
      { path: "index.mjs" },
      { path: "plugins/vite.mjs" },
      { path: "utils/helper.mjs" },
    ];
    const result = generatePackageExports(buildEntries, "dist", ["plugins"]);
    expect(result).to.deep.equal({
      "./plugins/*": {
        import: {
          default: "./dist/plugins/*.mjs",
        },
      },
    });
  });

  it("skips chunk files", () => {
    const buildEntries = [
      { path: "index.mjs" },
      { path: "chunk-123.mjs", chunk: true },
    ];
    const result = generatePackageExports(buildEntries, "dist", true);
    expect(result).to.deep.equal({
      ".": "./dist/index.mjs",
    });
  });

  it("generates combined main and folder exports", () => {
    const buildEntries = [
      { path: "index.mjs" },
      { path: "index.cjs" },
      { path: "index.d.ts" },
      { path: "plugins/vite.mjs" },
      { path: "plugins/vite.cjs" },
      { path: "plugins/vite.d.mts" },
      { path: "plugins/vite.d.cts" },
    ];
    const result = generatePackageExports(buildEntries, "dist", true);
    expect(result).to.deep.equal({
      ".": {
        types: "./dist/index.d.ts",
        import: {
          types: "./dist/index.d.ts",
          default: "./dist/index.mjs",
        },
        require: {
          types: "./dist/index.d.ts",
          default: "./dist/index.cjs",
        },
      },
      "./plugins/*": {
        types: "./dist/plugins/*.d.mts",
        import: {
          types: "./dist/plugins/*.d.mts",
          default: "./dist/plugins/*.mjs",
        },
        require: {
          types: "./dist/plugins/*.d.cts",
          default: "./dist/plugins/*.cjs",
        },
      },
    });
  });

  it("handles empty array as exportImport (same as true)", () => {
    const buildEntries = [{ path: "index.mjs" }];
    const result = generatePackageExports(buildEntries, "dist", []);
    expect(result).to.deep.equal({
      ".": "./dist/index.mjs",
    });
  });

  it("generates types-only exports when only declaration files exist", () => {
    const buildEntries = [
      { path: "types/index.d.ts" },
      { path: "types/utils.d.mts" },
      { path: "types/helpers.d.cts" },
    ];
    const result = generatePackageExports(buildEntries, "dist", true);
    expect(result).to.deep.equal({
      "./types/*": {
        types: "./dist/types/*.d.ts",
        import: { types: "./dist/types/*.d.mts" },
        require: { types: "./dist/types/*.d.cts" },
      },
    });
  });
});
