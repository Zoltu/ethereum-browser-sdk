import * as path from 'path'

const projectRootPath = path.normalize(path.join(__dirname, '..'))
export const tsconfigPath = path.join(projectRootPath, 'tsconfig.json')
export const appDirectoryPath = path.join(projectRootPath, 'app')
export const vendorDirectoryPath = path.join(appDirectoryPath, 'vendor')

const nodeModuleDirectoryPath = path.join(projectRootPath, 'node_modules')
export const vendorMapping: { [key: string]: string } = {
	'react': path.join(nodeModuleDirectoryPath, 'react', 'umd'),
	'react-dom': path.join(nodeModuleDirectoryPath, 'react-dom', 'umd'),
	'es-module-shims': path.join(nodeModuleDirectoryPath, 'es-module-shims', 'dist'),
	'@zoltu/ethereum-browser-sdk': path.join(nodeModuleDirectoryPath, '@zoltu', 'ethereum-browser-sdk', 'output-es'),
}
