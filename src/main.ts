import {Hono} from "hono";
import {serve} from "@hono/node-server";
import {createNodeWebSocket} from "@hono/node-ws";
import env from "./env";
import {logger} from "./routes/middleware/logger";

const app = new Hono();

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app })

app.use(logger);
app.get(
    '/ws',
    upgradeWebSocket((c) => {
      return {
        onMessage(event, ws) {
          console.log(`Message from client: ${event.data}`)
          ws.send('Hello from server!')
        },
        onClose: () => {
          console.log('Connection closed')
        },
      }
    })
)

const server = serve({
  fetch: app.fetch,
  port: env.PORT,
});
injectWebSocket(server);
console.log("Server started" + (env.NODE_ENV === 'development' ? ` at http://localhost:${env.PORT}` : ''));
