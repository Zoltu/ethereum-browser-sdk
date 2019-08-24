import * as path from 'path'
import { recursiveDirectoryCopy } from '@zoltu/file-copier'
import { getAllFilesRecursively } from './filesystem-extensions'
import { fixSourceMap } from './source-map-fixer'
import { compile } from './compile-typescript'
import { vendorMapping, vendorDirectoryPath, tsconfigPath } from './paths'

async function main() {
	for (let vendor in vendorMapping) {
		await recursiveDirectoryCopy(vendorMapping[vendor], path.join(vendorDirectoryPath, vendor))
	}
	await fixSourceMaps()
	compile(tsconfigPath)
}

async function fixSourceMaps() {
	for await (let filePath of getAllFilesRecursively(vendorDirectoryPath)) {
		await fixSourceMap(filePath)
	}
}

main().then(() => {
	process.exit(0)
}).catch(error => {
	console.error(error)
	debugger
	process.exit(1)
})
