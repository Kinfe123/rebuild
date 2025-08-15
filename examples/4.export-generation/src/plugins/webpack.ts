export interface WebpackPlugin {
  apply: (compiler: any) => void;
  name: string;
}

export const createWebpackPlugin = (name: string): WebpackPlugin => ({
  name,
  apply: (compiler) =>
    console.log(`Applying webpack plugin: ${name}`, compiler),
});

export const WEBPACK_DEFAULTS = {
  mode: "production" as const,
  devtool: "source-map" as const,
};
