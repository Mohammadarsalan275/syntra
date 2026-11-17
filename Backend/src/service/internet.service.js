import { tavily } from "@tavily/core";

function getTavilyClient() {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error("Internet search is not configured. Add TAVILY_API_KEY to Backend/.env.");
  }

  return tavily({ apiKey });
}

function getTavilyError(error) {
  if (error?.status === 401 || error?.status === 403) {
    return new Error("Tavily rejected its API key. Check TAVILY_API_KEY in Backend/.env.");
  }
  if (error?.status === 429 || error?.status === 432 || error?.status === 433) {
    return new Error("Tavily search quota or rate limit was reached. Check your Tavily plan.");
  }
  return error;
}

function normalizeSources(results = []) {
  return results
    .filter((result) => typeof result.url === "string")
    .map((result) => ({
      title: result.title || result.url,
      url: result.url,
      content: typeof result.content === "string" ? result.content : "",
    }));
}

export async function searchInternet(query) {
  const client = getTavilyClient();
  let response;
  try {
    response = await client.search(query, {
      searchDepth: "basic",
      maxResults: 5,
      includeAnswer: false,
      includeRawContent: false,
    });
  } catch (error) {
    throw getTavilyError(error);
  }

  return {
    query: response.query,
    sources: normalizeSources(response.results),
  };
}
