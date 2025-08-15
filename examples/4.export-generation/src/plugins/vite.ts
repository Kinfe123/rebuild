export interface VitePlugin {
  name: string;
  configFile?: string;
  configure?: () => void;
}

export const createVitePlugin = (name: string, configFile?: string): VitePlugin => ({
  name,
  configFile,
  configure: () => console.log(`Configuring Vite plugin: ${name}`),
});

export const VITE_DEFAULTS = {
  configFile: "vite.config.ts",
  port: 3000,
};
