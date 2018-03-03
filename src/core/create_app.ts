import * as fs from 'fs';
import * as path from 'path';
import mkdirp from 'mkdirp';
import create_routes from './create_routes';
import { fudge_mtime, posixify, write } from './utils';
import { dev } from '../config';
import { Route } from '../interfaces';

export default function create_app({ routes, dev_port }: {
	routes: Route[];
	dev_port: number;
}) {
	mkdirp.sync('app/manifest');

	write('app/manifest/client.js', generate_client(routes, dev_port));
	write('app/manifest/server.js', generate_server(routes));
}

function generate_client(routes: Route[], dev_port?: number) {
	let code = `
		// This file is generated by Sapper — do not edit it!
		export const routes = [
			${routes
				.map(route => {
					if (route.type !== 'page') {
						return `{ pattern: ${route.pattern}, ignore: true }`;
					}

					const file = posixify(`../../routes/${route.file}`);

					if (route.id === '_4xx' || route.id === '_5xx') {
						return `{ error: '${route.id.slice(1)}', load: () => import(/* webpackChunkName: "${route.id}" */ '${file}') }`;
					}

					const params = route.params.length === 0
						? '{}'
						: `{ ${route.params.map((part, i) => `${part}: match[${i + 1}]`).join(', ')} }`;

					return `{ pattern: ${route.pattern}, params: ${route.params.length > 0 ? `match` : `()`} => (${params}), load: () => import(/* webpackChunkName: "${route.id}" */ '${file}') }`;
				})
				.join(',\n\t')}
		];`.replace(/^\t\t/gm, '').trim();

	if (dev()) {
		const hmr_client = posixify(
			path.resolve(__dirname, 'hmr-client.js')
		);

		code += `

			if (module.hot) {
				import('${hmr_client}').then(client => {
					client.connect(${dev_port});
				});
			}`.replace(/^\t{3}/gm, '');
	}

	return code;
}

function generate_server(routes: Route[]) {
	let code = `
		// This file is generated by Sapper — do not edit it!
		${routes
			.map(route => {
				const file = posixify(`../../routes/${route.file}`);
				return route.type === 'page'
					? `import ${route.id} from '${file}';`
					: `import * as ${route.id} from '${file}';`;
			})
			.join('\n')}

		export const routes = [
			${routes
				.map(route => {
					const file = posixify(`../../${route.file}`);

					if (route.id === '_4xx' || route.id === '_5xx') {
						return `{ error: '${route.id.slice(1)}', module: ${route.id} }`;
					}

					const params = route.params.length === 0
						? '{}'
						: `{ ${route.params.map((part, i) => `${part}: match[${i + 1}]`).join(', ')} }`;

					return `{ id: '${route.id}', type: '${route.type}', pattern: ${route.pattern}, params: ${route.params.length > 0 ? `match` : `()`} => (${params}), module: ${route.id} }`;
				})
				.join(',\n\t')
			}
		];`.replace(/^\t\t/gm, '').trim();

	return code;
}