import { createHandler } from "./logic.js";

export {
  TTL_MS,
  TZ,
  QUOTE_SOURCE,
  QUOTE_SOURCE_DOC,
  DEFAULT_SNAPSHOT,
  SKIP_TICKERS,
  memoryKv,
  etParts,
  usRegularSession,
  readCache,
  decideFetch,
  tickersFromSnapshot,
  parseYahooChart,
  missingRow,
  toPayload,
  yahooChartUrl,
  isAllowedOrigin,
  createHandler
} from "./logic.js";

const handle = createHandler();

export default {
  async fetch(request, env) {
    return handle(request, env);
  }
};
