import createNextIntlPlugin from "next-intl/plugin";
import path from "node:path";
import { fileURLToPath } from "node:url";

const withNextIntl = createNextIntlPlugin();
const dashboardRoot = path.dirname(fileURLToPath(import.meta.url));

export default withNextIntl({
  output: "standalone",
  outputFileTracingRoot: path.join(dashboardRoot, "../.."),
});
