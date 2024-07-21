import { AssistantTool } from "openai/resources/beta/assistants";

const Constants = {
  thumbnailUrl:
    "https://api.dicebear.com/9.x/notionists/png?seed={{seed}}&size=256&scale=110&backgroundColor=b6e3f4,c0aede,d1d4f9,cfbbef,e4f4f1&backgroundType=gradientLinear",
  thumbnail: (seed: string) => {
    return Constants.thumbnailUrl.replace(/{{seed}}/g, encodeURI(seed));
  },
  downloadChubUrl: "https://api.chub.ai/api/characters/download",
  getWeatherUrl:
    "http://api.weatherstack.com/current?access_key={{apiKey}}&query={{query}}",
  getWeather: (apiKey: string, query: string) =>
    Constants.getWeatherUrl
      .replace(/{{apiKey}}/g, apiKey)
      .replace(/{{query}}/g, encodeURI(query)),
  fetchGoogleUrl:
    "https://www.googleapis.com/customsearch/v1?key={{key}}&cx={{cx}}&q={{query}}",
  fetchGoogle: (key: string, cx: string, query: string) =>
    Constants.fetchGoogleUrl
      .replace(/{{key}}/g, key)
      .replace(/{{cx}}/g, cx)
      .replace(/{{query}}/g, query),
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

export const GoogleTool: AssistantTool = {
  type: "function",
  function: {
    name: "fetchGoogleResults",
    description:
      "Google a search term and get information about the results in JSON.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "The search term to use for Google search API. e.g. 'Bananas'",
        },
        page: {
          type: "number",
          description:
            "The requested page from the results to be returned. Each page contains 10 results by default. If undefined, it will be equal to 1.",
        },
        siteSearch: {
          type: "object",
          description:
            "Filter the results by either only including results from a certain website or excluding that website from the results.",
          properties: {
            site: {
              type: "string",
              description: "The site URL to filter the results by.",
            },
            siteSearchFilter: {
              type: "string",
              enum: ["i", "e"],
              description:
                "Indicates whether to only include results from the specified website or to exclude that certain website from the results. (i means include, e means exclude)",
            },
          },
          required: ["site", "siteSearchFilter"],
        },
        fileType: {
          type: "string",
          enum: [
            "pdf",
            "ps",
            "csv",
            "epub",
            "kml",
            "kmz",
            "gpx",
            "hwp",
            "htm",
            "html",
            "xls",
            "xlsx",
            "ppt",
            "pptx",
            "doc",
            "docx",
            "odp",
            "ods",
            "odt",
            "rtf",
            "svg",
            "tex",
            "bas",
            "c",
            "cpp",
            "cxx",
            "h",
            "hpp",
            "cs",
            "java",
            "pl",
            "py",
            "wml",
            "wap",
            "xml",
          ],
          description:
            "Only include results containing a direct link to a file with the specified fileType.",
        },
      },
      required: ["query"],
    },
  },
};
