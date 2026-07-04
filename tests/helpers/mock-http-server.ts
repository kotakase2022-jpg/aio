import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

export type RecordedRequest = {
  method: string;
  pathname: string;
  search: string;
  headers: IncomingMessage["headers"];
  bodyText: string;
  json?: unknown;
};

type Handler = (request: RecordedRequest, response: ServerResponse) => void | Promise<void>;

export async function createMockHttpServer(handler: Handler) {
  const requests: RecordedRequest[] = [];
  const server = createServer(async (incoming, response) => {
    const bodyText = await readRequestBody(incoming);
    const url = new URL(incoming.url ?? "/", "http://localhost");
    const request: RecordedRequest = {
      method: incoming.method ?? "GET",
      pathname: url.pathname,
      search: url.search,
      headers: incoming.headers,
      bodyText,
      json: parseJson(bodyText),
    };
    requests.push(request);

    try {
      await handler(request, response);
    } catch (error) {
      response.statusCode = 500;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Mock server did not expose a TCP address.");
  }

  return {
    origin: `http://127.0.0.1:${address.port}`,
    requests,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

export function sendJson(response: ServerResponse, data: unknown, status = 200) {
  response.statusCode = status;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(data));
}

async function readRequestBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function parseJson(value: string) {
  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}
