# rebuild

<!-- automd:badges -->

[![npm version](https://img.shields.io/npm/v/rebuild)](https://npmjs.com/package/rebuild)
[![npm downloads](https://img.shields.io/npm/dm/rebuild)](https://npm.chart.dev/rebuild)

<!-- /automd -->

> A unified JavaScript build system

> [!NOTE]
> We are experimenting with [obuild](https://github.com/unjs/obuild) as the next next-gen successor based on [rolldown](https://github.com/rolldown/rolldown).
>
> If you mainly need faster build speeds and don't mind trying beta software, give it a try!

### 📦 Optimized bundler

Robust [rollup](https://rollupjs.org) based bundler that supports TypeScript and generates CommonJS and module formats + type declarations.

### 🪄 Automated config

Automagically infer build config and entries from `package.json`.

### 📁 Bundleless build

Integration with [mkdist](https://github.com/unjs/mkdist) for generating bundleless dists with file-to-file transpilation.

### ✨ Passive watcher

Stub `dist` once using `rebuild --stub` (powered by [jiti](https://github.com/unjs/jiti)) and you can try and link your project without needing to watch and rebuild during development.

### ✍ Untype Generator

Integration with [untyped](https://github.com/unjs/untyped).

### ✔️ Secure builds

Automatically check for various build issues such as potential **missing** and **unused** [dependencies](https://docs.npmjs.com/cli/v7/configuring-npm/package-json#dependencies) and fail CI.

CLI output also includes output size and exports for quick inspection.

## Usage

Create `src/index.ts`:

```js
export const log = (...args) => {
  console.log(...args);
};
```

Update `package.json`:

```json
{
  "type": "module",
  "scripts": {
    "build": "rebuild",
    "prepack": "rebuild"
  },
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    }
  },
  "main": "./dist/index.cjs",
  "types": "./dist/index.d.ts",
  "files": ["dist"]
}
```

> **Note**
> You can find a more complete example in [unjs/template](https://github.com/unjs/template) for project setup.

Build with `rebuild`:

```sh
npx rebuild
```

Configuration is automatically inferred from fields in `package.json` mapped to `src/` directory. For more control, continue with next section.

## Configuration

Create `build.config.ts`:

```js
export default {
  entries: ["./src/index"],
};
```

You can either use `rebuild` key in `package.json` or `build.config.{js,cjs,mjs,ts,mts,cts,json}` to specify configuration.

See options [here](./src/types.ts).

Example:

```js
import { defineBuildConfig } from "rebuild";

export default defineBuildConfig({
  // If entries is not provided, will be automatically inferred from package.json
  entries: [
    // default
    "./src/index",
    // mkdist builder transpiles file-to-file keeping original sources structure
    {
      builder: "mkdist",
      input: "./src/package/components/",
      outDir: "./build/components",
    },
  ],

  // Change outDir, default is 'dist'
  outDir: "build",

  // Generates .d.ts declaration file
  declaration: true,

  // Generate package.json exports field automatically
  exportMaps: true,
});
```

Or with multiple builds you can declare an array of configs:

```js
import { defineBuildConfig } from "rebuild";

export default defineBuildConfig([
  {
    // If entries is not provided, will be automatically inferred from package.json
    entries: [
      // default
      "./src/index",
      // mkdist builder transpiles file-to-file keeping original sources structure
      {
        builder: "mkdist",
        input: "./src/package/components/",
        outDir: "./build/components",
      },
    ],

    // Change outDir, default is 'dist'
    outDir: "build",

    /**
     * * `compatible` means "src/index.ts" will generate "dist/index.d.mts", "dist/index.d.cts" and "dist/index.d.ts".
     * * `node16` means "src/index.ts" will generate "dist/index.d.mts" and "dist/index.d.cts".
     * * `true` is equivalent to `compatible`.
     * * `false` will disable declaration generation.
     * * `undefined` will auto detect based on "package.json". If "package.json" has "types" field, it will be `"compatible"`, otherwise `false`.
     */
    declaration: "compatible",
  },
  {
    name: "minified",
    entries: ["./src/index"],
    outDir: "build/min",
    rollup: {
      esbuild: {
        minify: true,
      },
    },
  },
]);
```

### Package.json Exports Generation

Rebuild can automatically generate the `exports` field in your `package.json` based on your build entries using the `exportMaps` option:

```ts
import { defineBuildConfig } from "rebuild";

export default defineBuildConfig({
  entries: [
    "./src/index",
    "./src/plugins/vite",
    "./src/plugins/webpack",
    "./src/utils/helper",
  ],
  declaration: true,
  exportMaps: true, // Generate exports for all entries
  rollup: {
    emitCJS: true,
  },
});
```

This will automatically generate exports like:

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": {
        "types": "./dist/index.d.mts",
        "default": "./dist/index.mjs"
      },
      "require": {
        "types": "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      }
    },
    "./plugins/*": {
      "types": "./dist/plugins/*.d.ts",
      "import": {
        "types": "./dist/plugins/*.d.mts",
        "default": "./dist/plugins/*.mjs"
      },
      "require": {
        "types": "./dist/plugins/*.d.cts",
        "default": "./dist/plugins/*.cjs"
      }
    },
    "./utils/*": {
      "types": "./dist/utils/*.d.ts",
      "import": {
        "types": "./dist/utils/*.d.mts",
        "default": "./dist/utils/*.mjs"
      },
      "require": {
        "types": "./dist/utils/*.d.cts",
        "default": "./dist/utils/*.cjs"
      }
    }
  }
}
```

#### Export Modes

The `exportMaps` option supports three modes:

- **`exportMaps: true`** - Generate exports for ALL build entries
- **`exportMaps: ["folder1", "folder2"]`** - Generate exports only for specified folders (selective mode)
- **`exportMaps: false`** - Disable exports generation (default)

**Selective Export Example:**

```ts
export default defineBuildConfig({
  entries: ["./src/index", "./src/plugins/vite", "./src/utils/helper"],
  declaration: true,
  exportMaps: ["plugins"], // Only export plugins folder
});
```

This generates exports only for the `./plugins/*` pattern, excluding the main entry and utils.

#### Features

- ✅ **Automatic TypeScript support** - Includes `.d.ts`, `.d.mts`, and `.d.cts` declarations
- ✅ **Folder pattern exports** - Generates `./folder/*` patterns for subdirectories
- ✅ **Mixed module formats** - Supports both ESM (`import`) and CJS (`require`) conditions
- ✅ **Selective exports** - Choose which folders to export with array syntax
- ✅ **Package.json updates** - Automatically writes the exports field to your package.json

## Recipes

### Decorators support

In `build.config.ts`

```ts
import { defineBuildConfig } from "rebuild";

export default defineBuildConfig({
  rollup: {
    esbuild: {
      tsconfigRaw: {
        compilerOptions: {
          experimentalDecorators: true,
        },
      },
    },
  },
});
```

### Generate sourcemaps

```ts
import { defineBuildConfig } from "rebuild";

export default defineBuildConfig({
  sourcemap: true,
});
```

## 💻 Development

- Clone this repository
- Enable [Corepack](https://github.com/nodejs/corepack) using `corepack enable` (use `npm i -g corepack` for Node.js < 16.10)
- Install dependencies using `pnpm install`
- Run interactive tests using `pnpm dev`

## License

[MIT](./LICENSE)

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/unbuild?style=flat-square
[npm-version-href]: https://npmjs.com/package/unbuild
[npm-downloads-src]: https://img.shields.io/npm/dm/unbuild?style=flat-square
[npm-downloads-href]: https://npmjs.com/package/unbuild
[github-actions-src]: https://img.shields.io/github/actions/workflow/status/unjs/unbuild/ci.yml?style=flat-square
[github-actions-href]: https://github.com/unjs/unbuild/actions?query=workflow%3Aci
[codecov-src]: https://img.shields.io/codecov/c/gh/unjs/unbuild/main?style=flat-square
[codecov-href]: https://codecov.io/gh/unjs/unbuild
