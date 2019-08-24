import * as path from 'path'

const projectRootPath = path.normalize(path.join(__dirname, '..'))
export const tsconfigPath = path.join(projectRootPath, 'tsconfig.json')
export const appDirectoryPath = path.join(projectRootPath, 'app')
export const buildOutputDirectoryPath = path.join(appDirectoryPath, 'js')
export const vendorDirectoryPath = path.join(appDirectoryPath, 'vendor')

export const nodeModuleDirectoryPath = path.join(projectRootPath, 'node_modules')
export const vendorMapping: { [key: string]: string } = {
	'react': path.join(nodeModuleDirectoryPath, 'react', 'umd'),
	'react-dom': path.join(nodeModuleDirectoryPath, 'react-dom', 'umd'),
	'es-module-shims': path.join(nodeModuleDirectoryPath, 'es-module-shims', 'dist'),
	'@zoltu/ethereum-types': path.join(nodeModuleDirectoryPath, '@zoltu', 'ethereum-types', 'output-es'),
	'@zoltu/ethereum-abi-encoder': path.join(nodeModuleDirectoryPath, '@zoltu', 'ethereum-abi-encoder', 'output-es'),
	'@zoltu/ethereum-crypto': path.join(nodeModuleDirectoryPath, '@zoltu', 'ethereum-crypto', 'output-es'),
	'@zoltu/ethereum-fetch-json-rpc': path.join(nodeModuleDirectoryPath, '@zoltu', 'ethereum-fetch-json-rpc', 'output-es'),
	'@zoltu/ethereum-browser-sdk': path.join(nodeModuleDirectoryPath, '@zoltu', 'ethereum-browser-sdk', 'output-es'),
	'@zoltu/rlp-encoder': path.join(nodeModuleDirectoryPath, '@zoltu', 'rlp-encoder', 'output-es'),
}
