import { HttpResponse, http } from "msw";
import {
	storyBootstrap,
	storyProjectFetcher,
	storySearchFetcher,
} from "../src/stories/story-fixtures";

export const mswHandlers = [
	http.get("/api/bootstrap", () => HttpResponse.json(storyBootstrap)),
	http.get("/api/search", ({ request }) => storySearchFetcher(request.url)),
	http.get("/api/projects/:projectId/files", ({ request }) =>
		storyProjectFetcher(request.url),
	),
	http.get("/api/projects/:projectId/changes", ({ request }) =>
		storyProjectFetcher(request.url),
	),
	http.get("/api/projects/:projectId/diff", ({ request }) =>
		storyProjectFetcher(request.url),
	),
	http.get("/api/projects/:projectId/file", ({ request }) =>
		storyProjectFetcher(request.url),
	),
];
