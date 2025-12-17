declare module '@heyputer/puter.js' {
  const puter: {
    ai: {
      chat: (prompt: string, options?: any) => Promise<any>;
    };
  };
  export default puter;
}
