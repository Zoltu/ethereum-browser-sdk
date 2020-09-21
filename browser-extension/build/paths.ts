import * as path from 'path'

const projectRootPath = path.normalize(path.join(__dirname, '..'))
export const tsconfigPath = path.join(projectRootPath, 'tsconfig.json')
export const vendorDirectoryPath = path.join(projectRootPath, 'app', 'vendor')

const nodeModuleDirectoryPath = path.join(projectRootPath, 'node_modules')
export const vendorMapping: { [key: string]: string } = {
	'es-module-shims': path.join(nodeModuleDirectoryPath, 'es-module-shims', 'dist'),
	'webextension-polyfill': path.join(nodeModuleDirectoryPath, 'webextension-polyfill', 'dist'),
	'@zoltu/ethereum-browser-sdk': path.join(nodeModuleDirectoryPath, '@zoltu', 'ethereum-browser-sdk', 'output-esm'),
	'@zoltu/ethereum-abi-encoder': path.join(nodeModuleDirectoryPath, '@zoltu', 'ethereum-abi-encoder', 'output-esm'),
	'@zoltu/ethereum-crypto': path.join(nodeModuleDirectoryPath, '@zoltu', 'ethereum-crypto', 'output-es'),
	'@zoltu/ethereum-fetch-json-rpc': path.join(nodeModuleDirectoryPath, '@zoltu', 'ethereum-fetch-json-rpc', 'output-es'),
	'@zoltu/ethereum-types': path.join(nodeModuleDirectoryPath, '@zoltu', 'ethereum-types', 'output-es'),
	'@zoltu/ethereum-ledger': path.join(nodeModuleDirectoryPath, '@zoltu', 'ethereum-ledger', 'output-es'),
}
