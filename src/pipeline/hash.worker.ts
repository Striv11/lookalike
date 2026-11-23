/// <reference lib="webworker" />
import { createBrowserDecoder } from "./decode";
import { handleRequest } from "./process";
import type { WorkerRequest } from "./types";

const decode = createBrowserDecoder();

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  self.postMessage(await handleRequest(e.data, decode));
};
