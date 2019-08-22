import * as http from 'http'
import * as url from 'url'
import * as net from 'net'
import { promises as filesystem } from 'fs'
import * as path from 'path'
import { getFileType } from './filesystem-extensions'

// maps file extention to MIME types
const mimeType = {
	'.ico': 'image/x-icon',
	'.html': 'text/html',
	'.js': 'text/javascript',
	'.json': 'application/json',
	'.css': 'text/css',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.wav': 'audio/wav',
	'.mp3': 'audio/mpeg',
	'.svg': 'image/svg+xml',
	'.pdf': 'application/pdf',
	'.doc': 'application/msword',
	'.eot': 'appliaction/vnd.ms-fontobject',
	'.ttf': 'aplication/font-sfnt'
}

async function listener(request: http.IncomingMessage, response: http.ServerResponse) {
	try {
		console.log(`${request.method} ${request.url}`)

		if (request.url === undefined) return

		// parse URL
		const parsedUrl = url.parse(request.url)
		parsedUrl.pathname = parsedUrl.pathname || ''

		// extract URL path
		// Avoid https://en.wikipedia.org/wiki/Directory_traversal_attack
		// e.g curl --path-as-is http://localhost:9000/../fileInDanger.txt
		// by limiting the path to current directory only
		const sanitizePath = path.normalize(parsedUrl.pathname).replace(/^(\.\.[\/\\])+/, '')
		let pathname = path.join(__dirname, '..', 'output', sanitizePath)

		// if is a directory, then look for index.html
		let filetype = await getFileType(pathname)
		if (filetype === 'directory') {
			pathname += `${pathname.endsWith(path.sep) ? '' :path.sep}index.html`
			filetype = await getFileType(pathname)
		}
		if (filetype === 'nonexistent') {
			console.log(`${404} - ${pathname}`)
			// if the file is not found, return 404
			response.statusCode = 404
			response.end(`File ${pathname} not found!`)
			return
		}

		// read file from file system
		const contents = await filesystem.readFile(pathname)
		// based on the URL path, extract the file extention. e.g. .js, .doc, ...
		const extension = path.parse(pathname).ext
		// if the file is found, set Content-type and send data
		response.setHeader('Access-Control-Allow-Origin', '*')
		response.setHeader('Access-Control-Allow-Methods', '*')
		response.setHeader('Access-Control-Allow-Headers', '*')
		response.setHeader('Content-type', isKnownMimetype(extension) ? mimeType[extension] : 'text/plain' )
		response.end(contents)
	} catch (error) {
		response.statusCode = 500
		response.end(`<pre>Internal server error: ${error.code}: ${error.message}\n${error.stack}</pre>`)
	}
}

function isKnownMimetype(extension: string): extension is keyof typeof mimeType {
	return extension in mimeType
}

const server = http.createServer((request, response) => { listener(request, response).catch(console.error) })

server.addListener('listening', () => {
	const address = server.address() as net.AddressInfo
	console.log(`Server listening on port ${address.port}`);
})
server.listen(62091)
