
import { FastifyInstance, RouteOptions, HTTPMethods } from 'fastify';

export type CallRouteOptions = {
	method: HTTPMethods | string;
	url: string;
	payload?: Record<string, unknown> | string;
	headers?: Record<string, string>;
};


export async function callRoute(
		app: FastifyInstance,
		options: CallRouteOptions
	): Promise<{ statusCode: number; body: unknown; headers: Record<string, string | string[]> }> {
		const { method, url, payload, headers } = options;
		const response = await app.inject({
			method: method as any,
			url,
			payload,
			headers,
		}).then((res: any) => res);
		let body: unknown;
		const contentType = response.headers && typeof response.headers['content-type'] === 'string' ? response.headers['content-type'] : '';
		if (contentType.includes('application/json')) {
			try {
				body = JSON.parse(response.body);
			} catch {
				body = response.body;
			}
		} else {
			body = response.body;
		}
		return {
			statusCode: response.statusCode,
			body,
			headers: response.headers as Record<string, string | string[]>,
		};
	}

export function registerDynamicRoute(
	app: FastifyInstance,
	routeOptions: RouteOptions
): void {
	app.route(routeOptions);
}


