import * as path from 'path'
import { promises as filesystem } from 'fs'

export async function fileExists(absoluteFilePath: string) {
	// !@#$ you nodejs and not providing any way to check for file existence without an exception
	try {
		await filesystem.access(absoluteFilePath)
		return true
	} catch (_) {
		return false
	}
}

export async function getFileType(filePath: string): Promise<'file'|'directory'|'nonexistent'|'other'> {
	try {
		const fileDetails = await filesystem.lstat(filePath)
		if (fileDetails.isDirectory()) return 'directory'
		else if (fileDetails.isFile()) return 'file'
		else return 'other'
	} catch (error) {
		if (error.code === 'ENOENT') return 'nonexistent'
		throw error
	}
}

export async function* getAllFilesRecursively(absoluteDirectoryPath: string): AsyncIterableIterator<string> {
	if (!path.isAbsolute(absoluteDirectoryPath)) throw new Error(`Absolute source path required.  Provided: ${absoluteDirectoryPath}`)
	const fileNames = await filesystem.readdir(absoluteDirectoryPath)
	for (let fileName of fileNames) {
		const filePath = path.join(absoluteDirectoryPath, fileName)
		switch (await getFileType(filePath)) {
			case 'directory':
				for await (let childFile of getAllFilesRecursively(filePath)) {
					yield childFile
				}
				break
			case 'file':
				yield filePath
				break
			case 'nonexistent':
				break
			case 'other':
				console.log(`${filePath} is neither a file nor a directory, so it was skipped. If you see this, figure out what it means and add a case for handling it properly.`)
				break
			default:
				throw new Error(`Missing case statement in switch block, see getFileType`)
		}
	}
}
