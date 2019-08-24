import { recursiveDirectoryDelete } from '@zoltu/file-copier'
import { vendorDirectoryPath, buildOutputDirectoryPath } from './paths'

const doStuff = async () => {
	await recursiveDirectoryDelete(vendorDirectoryPath)
	await recursiveDirectoryDelete(buildOutputDirectoryPath)
}

doStuff().then(() => {
	process.exit(0)
}).catch(error => {
	console.error(error)
	debugger
	process.exit(1)
})
