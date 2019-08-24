import * as path from 'path'
import { FileCopier } from '@zoltu/file-copier'
import { watch } from './compile-typescript'
import { vendorMapping, vendorDirectoryPath, tsconfigPath } from './paths'
import { fixSourceMap } from './source-map-fixer';

const postCopyTransformer = async (_: string, destinationPath: string)  => fixSourceMap(destinationPath)

// kick off the file copier
for (let vendor in vendorMapping) {
	new FileCopier(vendorMapping[vendor], path.join(vendorDirectoryPath, vendor), undefined, postCopyTransformer)
}

// kick off the typescript watcher
watch(tsconfigPath)
