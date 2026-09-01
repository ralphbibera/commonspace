import type { ProxyOptions } from "vite";
import { describe, expect, it, vi } from "vitest";
import { apiProxy } from "../ui/vite-api-proxy.ts";

function apiProxyOptions(): ProxyOptions {
	return apiProxy();
}

describe("Vite API proxy", () => {
	it("forwards actual browser host when Vite selects an alternate port", () => {
		const proxy = apiProxyOptions();
		expect(proxy.configure).toBeTypeOf("function");

		const on = vi.fn();
		proxy.configure?.({ on } as never, proxy);
		const proxyRequestListener = on.mock.calls.find(
			([event]) => event === "proxyReq",
		)?.[1];
		expect(proxyRequestListener).toBeTypeOf("function");

		const setHeader = vi.fn();
		proxyRequestListener?.(
			{ setHeader } as never,
			{ headers: { host: "127.0.0.1:5174" } } as never,
			undefined,
			undefined,
			undefined,
		);

		expect(setHeader).toHaveBeenCalledWith(
			"x-forwarded-host",
			"127.0.0.1:5174",
		);
	});
});
