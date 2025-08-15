export default {
  entries: [
    "./src/index",
    "./src/plugins/vite",
    "./src/plugins/webpack",
    "./src/utils/helper",
  ],
  declaration: true,
  // Generate exports for all build entries
  exportImport: true,
  rollup: {
    emitCJS: true,
  },
};
