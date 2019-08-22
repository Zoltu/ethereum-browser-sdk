import * as path from 'path'
import { promises as filesystem } from 'fs'
import { fileExists } from './filesystem-extensions'

// https://bugs.chromium.org/p/chromium/issues/detail?id=979000
export async function fixSourceMap(filePath: string) {
	const fileExtension = path.extname(filePath)
	if (fileExtension !== '.map') return
	const fileDirectoryName = path.basename(path.dirname(filePath))
	const fileName = path.parse(path.parse(filePath).name).name
	const fileContents = JSON.parse(await filesystem.readFile(filePath, 'utf-8')) as { sources: Array<string> }
	for (let i = 0; i < fileContents.sources.length; ++i) {
		const relativeSourceFilePath = fileContents.sources[i]
		if (await fileExists(path.normalize(path.join(path.dirname(filePath), relativeSourceFilePath)))) return
		const mappedFileName = (fileName === 'index')
			? fileDirectoryName
			: fileName
			fileContents.sources[i] = `./${mappedFileName}.ts`
	}
	filesystem.writeFile(filePath, JSON.stringify(fileContents))
}
