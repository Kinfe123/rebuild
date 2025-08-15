export default {
  entries: [
    "./src/index",
    "./src/plugins/vite",
    "./src/plugins/webpack",
    "./src/utils/helper",
    "./src/types/interfaces",
  ],
  declaration: true,
  // Generate exports ONLY for plugins and types folders (selective)
  exportMaps: ["plugins", "types"],
  rollup: {
    emitCJS: true,
  },
};
