import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { localeCookie, normalizeLocale } from "../app/i18n-config";
import { loadMessages } from "../app/load-messages";

export default getRequestConfig(async () => {
  const locale = normalizeLocale((await cookies()).get(localeCookie)?.value);
  return {
    locale,
    messages: await loadMessages(locale),
    timeZone: "Asia/Seoul",
  };
});
