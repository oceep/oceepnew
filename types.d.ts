/// <reference types="vite/client" />

// Add this part below the existing reference line:
declare module '@heyputer/puter.js' {
    const puter: {
        ai: {
            chat: (prompt: string, options?: any) => Promise<any>;
        };
        // You can add more methods here if needed
    };
    export default puter;
}
