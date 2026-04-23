// Type declarations for CSS files
declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}

// Global CSS imports (side-effect imports)
declare module '../styles/globals.css' {
  const _: never;
  export default _;
}
