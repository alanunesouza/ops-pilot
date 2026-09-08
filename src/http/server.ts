import { createApp } from "./app.js";

const app = createApp();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

export const server = app.listen(PORT, () => {
  console.log(`🚀 OpsPilot HTTP Server ativo em http://localhost:${PORT}`);
  console.log(`📡 Rota de chat disponível em POST http://localhost:${PORT}/chat`);
});

export { app };
