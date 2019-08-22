// user clicked the navbar icon
browser.browserAction.onClicked.addListener(tab => contentInjector(tab).catch(console.error))
browser.runtime.onConnect.addListener(port => onContentScriptConnected(port).catch(console.error))

async function contentInjector(tab: browser.tabs.Tab): Promise<void> {
	if (tab.id === undefined) return
	await browser.tabs.executeScript(tab.id, { file: 'vendor/webextension-polyfill/browser-polyfill.js'})
	await browser.tabs.executeScript(tab.id, { file: './content-rollup.js' })
}

async function onContentScriptConnected(port: browser.runtime.Port): Promise<void> {
	port.onMessage.addListener(message => onContentScriptMessage.bind(undefined, port)(message).catch(console.error))
}

async function onContentScriptMessage(port: browser.runtime.Port, message: any) {
	console.log(port)
	console.log(message)
}
