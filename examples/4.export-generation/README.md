# Export Generation Example

This example demonstrates the **automatic package.json exports generation** feature in unbuild.

## Features Tested

- ✅ **Automatic exports generation** based on build entries
- ✅ **TypeScript declaration file support** (`.d.ts`, `.d.mts`, `.d.cts`)
- ✅ **Folder pattern exports** (`./plugins/*`, `./utils/*`)
- ✅ **Selective exports** (opt-in specific folders)
- ✅ **Mixed module formats** (ESM + CJS)
- ✅ **Package.json writing** and preservation

## Test Configurations

### 1. Full Export Generation (`build.config.all.ts`)

```typescript
exportImport: true; // Generate exports for ALL build entries
```

**Expected Result:**

- Main entry exports (`.`)
- Folder pattern exports (`./plugins/*`, `./utils/*`, `./types/*`)
- Full TypeScript support

### 2. Selective Export Generation (`build.config.selective.ts`)

```typescript
exportImport: ["plugins", "types"]; // Only specific folders
```

**Expected Result:**

- NO main entry exports
- ONLY `./plugins/*` and `./types/*` exports
- Selective TypeScript support

### 3. Disabled Export Generation (`build.config.disabled.ts`)

```typescript
exportImport: false; // Disable feature
```

**Expected Result:**

- NO exports field added to package.json
- Original package.json preserved

## Source Structure

```
src/
├── index.ts           # Main entry point
├── plugins/
│   ├── vite.ts        # Vite plugin utilities
│   └── webpack.ts     # Webpack plugin utilities
├── utils/
│   └── helper.ts      # Utility functions
└── types/
    └── interfaces.ts  # TypeScript interfaces
```

## Running Tests

### Quick Test

```bash
npm run test
```

### Test All Configurations

```bash
# Test full export generation
npm run test:all

# Test selective export generation
npm run test:selective

# Test disabled export generation
npm run test:disabled
```

### Manual Testing

```bash
# Clean previous builds
npm run clean

# Build with different configs
npm run build:all        # Full exports
npm run build:selective  # Selective exports
npm run build:disabled   # No exports

# Inspect package.json after each build
cat package.json
```

## Expected Export Outputs

### Full Export Mode (`exportImport: true`)

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
      /* similar structure */
    },
    "./types/*": {
      /* similar structure */
    }
  }
}
```

### Selective Export Mode (`exportImport: ["plugins", "types"]`)

```json
{
  "exports": {
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
    "./types/*": {
      /* similar structure */
    }
  }
}
```

## Test Validation

The test script (`test.mjs`) validates:

1. ✅ **Exports field exists** in package.json
2. ✅ **Main entry structure** is correct
3. ✅ **TypeScript support** is included
4. ✅ **Folder patterns** are generated
5. ✅ **Export paths exist** on disk
6. ✅ **Configuration modes** work correctly

## Integration Usage

Add to your `build.config.ts`:

```typescript
export default {
  entries: ["./src/index", "./src/plugins/vite"],
  declaration: true,
  exportImport: true, // or ["plugins"] for selective
  rollup: {
    emitCJS: true,
  },
};
```

The exports will be automatically generated and written to your `package.json`!
