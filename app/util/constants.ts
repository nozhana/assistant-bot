import { AssistantTool } from "openai/resources/beta/assistants";

const Constants = {
  thumbnailUrl:
    "https://api.dicebear.com/9.x/notionists/png?seed={{seed}}&size=256&scale=110&backgroundColor=b6e3f4,c0aede,d1d4f9,cfbbef,e4f4f1&backgroundType=gradientLinear",
  thumbnail: (seed: string) => {
    return Constants.thumbnailUrl.replace("{{seed}}", encodeURI(seed));
  },
  downloadChubUrl: "https://api.chub.ai/api/characters/download",
};

export default Constants;

export const RssTool: AssistantTool = {
  type: "function",
  function: {
    name: "fetchRssFeed",
    description: "Get the contents of a valid RSS feed URL.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description:
            "The URL of the RSS feed to browse, e.g. https://reddit.com/.rss",
        },
      },
      required: ["url"],
    },
  },
};
