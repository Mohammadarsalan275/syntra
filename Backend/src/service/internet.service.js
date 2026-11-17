import { tavily } from "@tavily/core";

const researchTimeoutMs = 5 * 60 * 1000;
const researchPollIntervalMs = 2000;

function getTavilyClient() {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error("Web search is not configured. Add TAVILY_API_KEY to Backend/.env.");
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

export async function searchInternet(query, { deep = false } = {}) {
  const client = getTavilyClient();
  let response;
  try {
    response = await client.search(query, {
      searchDepth: deep ? "advanced" : "basic",
      maxResults: deep ? 10 : 5,
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

export async function deepSearchInternet(query) {
  const client = getTavilyClient();
  let task;
  try {
    task = await client.research(query, {
      model: "mini",
      citationFormat: "numbered",
      output_length: "standard",
      timeout: 30000,
    });
  } catch (error) {
    throw getTavilyError(error);
  }

  const deadline = Date.now() + researchTimeoutMs;
  while (Date.now() < deadline) {
    let result;
    try {
      result = await client.getResearch(task.requestId);
    } catch (error) {
      throw getTavilyError(error);
    }

    if (result.status === "completed") {
      const report =
        typeof result.content === "string"
          ? result.content
          : JSON.stringify(result.content);

      return {
        report,
        sources: normalizeSources(result.sources),
      };
    }

    if (result.status === "failed" || result.status === "cancelled") {
      throw new Error("Tavily could not complete the deep research task.");
    }

    await new Promise((resolve) => setTimeout(resolve, researchPollIntervalMs));
  }

  throw new Error("Deep research timed out. Try a more focused question.");
}
