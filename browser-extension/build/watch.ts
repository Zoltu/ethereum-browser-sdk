import * as path from 'path'
import { FileCopier } from '@zoltu/file-copier'
import { watch } from './compile-typescript'
import { inputDirectoryPath, outputDirectoryPath, vendorMapping, vendorDirectoryPath, tsconfigPath } from './paths'
import { fixSourceMap } from './source-map-fixer';
import { bundleWatch } from './bundle';

const postCopyTransformer = async (_: string, destinationPath: string)  => fixSourceMap(destinationPath)

// kick off the file copier
new FileCopier(inputDirectoryPath, outputDirectoryPath, undefined, postCopyTransformer)
for (let vendor in vendorMapping) {
	new FileCopier(vendorMapping[vendor], path.join(vendorDirectoryPath, vendor), undefined, postCopyTransformer)
}

// kick off the typescript watcher
watch(tsconfigPath)
// kick off rollup watcher
bundleWatch().catch(error => {
	console.error(error)
	process.exit(1)
})
