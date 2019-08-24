import * as path from 'path'

const projectRootPath = path.normalize(path.join(__dirname, '..'))
export const tsconfigPath = path.join(projectRootPath, 'tsconfig.json')
export const vendorDirectoryPath = path.join(projectRootPath, 'app', 'vendor')

const nodeModuleDirectoryPath = path.join(projectRootPath, 'node_modules')
export const vendorMapping: { [key: string]: string } = {
	'es-module-shims': path.join(nodeModuleDirectoryPath, 'es-module-shims', 'dist'),
	'webextension-polyfill': path.join(nodeModuleDirectoryPath, 'webextension-polyfill', 'dist'),
	'@zoltu/ethereum-browser-sdk': path.join(nodeModuleDirectoryPath, '@zoltu', 'ethereum-browser-sdk', 'output-es'),
}
