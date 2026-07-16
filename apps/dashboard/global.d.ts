import type messages from "./messages/en-US.json";
import type { Locale } from "./app/i18n-config";

declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
