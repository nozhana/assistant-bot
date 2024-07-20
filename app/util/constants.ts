import { AssistantTool } from "openai/resources/beta/assistants";

const Constants = {
  thumbnailUrl:
    "https://api.dicebear.com/9.x/notionists/png?seed={{seed}}&size=256&scale=110&backgroundColor=b6e3f4,c0aede,d1d4f9,cfbbef,e4f4f1&backgroundType=gradientLinear",
  thumbnail: (seed: string) => {
    return Constants.thumbnailUrl.replace(/{{seed}}/g, encodeURI(seed));
  },
  downloadChubUrl: "https://api.chub.ai/api/characters/download",
  getWeatherPath: `http://api.weatherstack.com/current?access_key=${process.env.WEATHERSTACK_API_KEY}&query={{query}}`,
  getWeather: (query: string) =>
    Constants.getWeatherPath.replace(/{{query}}/g, encodeURI(query)),
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

export const WeatherTool: AssistantTool = {
  type: "function",
  function: {
    name: "fetchWeather",
    description:
      "Get the weather for a specific location, either by name or coordinates.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            'The name of the location to fetch the weather from, or the lat and long separated by a comma. e.g. "New Delhi", "40.7831,-73.9712"',
        },
      },
      required: ["query"],
    },
  },
};
