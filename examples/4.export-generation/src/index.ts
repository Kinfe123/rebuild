export const greet = (name: string): string => `Hello, ${name}!`;

export const version = "1.0.0";

// Re-export from utils for convenience
export * from "./utils/helper";
