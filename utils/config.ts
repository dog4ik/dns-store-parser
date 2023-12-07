import { parseArgs } from "node:util";
import { Level } from "pino";

export default function parseConfig() {
  const args = parseArgs({
    options: {
      url: {
        type: "string",
        short: "u",
        default:
          "https://www.dns-shop.ru/catalog/17a8d26216404e77/vstraivaemye-xolodilniki/",
      },
      disableHeadless: {
        type: "boolean",
        default: false,
        short: "d",
      },
      level: {
        type: "string",
        short: "l",
      },
      start: {
        type: "string",
        short: "s",
      },
      end: {
        type: "string",
        short: "e",
      },
      output: {
        type: "string",
        short: "o",
      },
    },
  });

  let values = args.values;

  return {
    headless: values.disableHeadless ? false : ("new" as const),
    url: new URL(values.url!),
    logLevel: (values.level ?? "trace") as Level,
    startPage: +(values.start ?? 1),
    endPage: values.end ? +values.end : undefined,
    output: values.output ?? "output.csv",
  };
}
