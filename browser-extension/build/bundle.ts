import * as path from 'path'
import { rollup, watch, InputOption, RollupBuild, Plugin } from 'rollup'
import nodeResolve from 'rollup-plugin-node-resolve'
import sourcemaps from 'rollup-plugin-sourcemaps'

const options = {
	input: path.join(__dirname, '..', 'output', 'content.js'),
	output: {
		file: path.join(__dirname, '..', 'output', 'content-rollup.js'),
		format: 'module' as const,
		sourcemap: true,
	},
	plugins: [
		nodeResolve({
			preferBuiltins: false,
			modulesOnly: true,
		}),
		sourcemaps(),
	] as Plugin[]
}

export async function bundle() {
	const bundle = await rollup(options)
	await bundle.write(options.output)
}

export async function bundleWatch() {
	const watcher = watch([options])
	watcher.on('event', (event: RollupWatcherEvent) => {
		switch (event.code) {
			case 'START': return console.log(`Watcher started.`)
			case 'BUNDLE_START': return console.log(`Bundling started.`)
			case 'BUNDLE_END': return console.log(`Bundling finished.`)
			case 'END': return console.log(`Watcher finished.`)
			case 'ERROR': return console.error(`Watcher encountered an error: ${event.error.message}\n${event.error.stack}`)
			case 'FATAL': return console.error(`Watcher encountered a fatal error: ${event.error.message}\n${event.error.stack}`)
			default: assertNever(event)
		}
	})
}

type RollupWatcherEvent =
	{code:'START'}
	| {code: 'BUNDLE_START', input: InputOption, output: string | undefined}
	| {code: 'BUNDLE_END', duration: number, input: InputOption, output: string | undefined, result: RollupBuild}
	| {code:'END'}
	| {code:'ERROR', error:Error}
	| {code:'FATAL', error:Error}

function assertNever(_: never): never {
	throw new Error(`Unreachable code reached.`)
}
