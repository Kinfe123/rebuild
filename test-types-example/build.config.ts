export default {
  entries: [
    "./src/index",
    "./src/utils/helper"
  ],
  declaration: true,
  exportImport: true,
  rollup: {
    emitCJS: true
  }
};
