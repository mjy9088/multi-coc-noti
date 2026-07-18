import { createGateway } from "./gateway.ts";

const port = Number(process.env.PORT || 3000);
const dashboard = new URL(process.env.DASHBOARD_UPSTREAM || "http://127.0.0.1:3001");
const collector = new URL(process.env.COLLECTOR_UPSTREAM || "http://127.0.0.1:8787");
const server = createGateway({ dashboard, collector });

server.listen(port, "0.0.0.0", () =>
  console.log(`Reverse proxy listening on :${port}; /api -> ${collector.href}, everything else -> ${dashboard.href}`),
);
