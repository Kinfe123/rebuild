export default {
  entries: [
    "./src/index",
    "./src/plugins/vite",
    "./src/plugins/webpack",
    "./src/utils/helper",
  ],
  declaration: true,
  // Disable exports generation
  exportMaps: false,
  rollup: {
    emitCJS: true,
  },
};
