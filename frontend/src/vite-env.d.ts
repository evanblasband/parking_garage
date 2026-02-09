/// <reference types="vite/client" />

// Declare raw text imports for markdown files
declare module '*.md?raw' {
  const content: string;
  export default content;
}

// Declare the @docs alias path
declare module '@docs/*.md?raw' {
  const content: string;
  export default content;
}
