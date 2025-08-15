export default {
  entries: [
    "./src/index",
    "./src/plugins/vite", 
    "./src/plugins/webpack",
    "./src/utils/helper",
    "./src/types/interfaces",
  ],
  declaration: true,
  // Generate exports for ALL build entries
  exportImport: true,
  rollup: {
    emitCJS: true,
  },
};
