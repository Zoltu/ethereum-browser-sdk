import { provider } from '@zoltu/ethereum-browser-sdk'
import { HotOstrichChannel } from './hot-ostrich-channel'
import { ErrorHandler } from './error-handler'
import { MnemonicWallet } from './wallet'

// user clicked the navbar icon
browser.browserAction.onClicked.addListener(tab => contentInjector(tab).catch(console.error))
browser.runtime.onConnect.addListener(port => onContentScriptConnected(port).catch(console.error))

async function contentInjector(tab: browser.tabs.Tab): Promise<void> {
	if (tab.id === undefined) return
	await browser.tabs.executeScript(tab.id, { file: '/vendor/webextension-polyfill/browser-polyfill.js', allFrames: true })
	// await browser.tabs.executeScript(tab.id, { file: '/js/content.js', allFrames: true })
	await browser.tabs.executeScript(tab.id, { file: '/js/legacy-injector.js', allFrames: true })
	// TODO: add a GUI to the extension that shows up on click (as well as injecting the content script) that lets the user inject the legacy provider optionally (rather than forcing it in)
}

async function onContentScriptConnected(port: browser.runtime.Port): Promise<void> {
	const addEventListener = (_: 'message', listener: (payload: any) => void) => port.onMessage.addListener(listener)
	const removeEventListener = (_: 'message', listener: (payload: any) => void) => port.onMessage.removeListener(listener)
	const postMessage = (message: any, _: string) =>  port.postMessage(message)

	const errorHandler = new ErrorHandler()
	const jsonRpcEndpoint = 'https://ethereum.zoltu.io/' as const
	// const jsonRpcEndpoint = 'https://mainnet.infura.io/v3/60bdf3ec0a954aa8aba21478529ed1ce' as const
	// const jsonRpcEndpoint = 'http://127.0.0.1:1237/' as const
	const getGasPrice = async () => 1n

	new provider.HandshakeChannel({addEventListener, removeEventListener}, {postMessage}, {
		onError: console.error,
		getProviderAnnouncement: async () => ({
			friendly_icon: 'iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==',
			friendly_name: 'My Extension Provider 😎',
			provider_id: 'my-extension-provider',
			supported_protocols: [ ...provider.HotOstrichChannel.supportedProtocols ],
			chain_name: 'Ethereum Mainnet',
		})
	})
	const hotOstrichChannel = new HotOstrichChannel(errorHandler, fetch.bind(window), {addEventListener, removeEventListener}, {postMessage}, jsonRpcEndpoint, getGasPrice)
	const wallet = await MnemonicWallet.create(jsonRpcEndpoint, fetch.bind(window), getGasPrice, ['zoo', 'zoo', 'zoo', 'zoo', 'zoo', 'zoo', 'zoo', 'zoo', 'zoo', 'zoo', 'zoo', 'wrong'])
	// Ledger FF blocked by https://bugzilla.mozilla.org/show_bug.cgi?id=1370728 (cannot workaround)
	// Extension Chrome blocked by https://bugs.chromium.org/p/chromium/issues/detail?id=1045782 (can workaround)
	// Alternatively, we could create an extension that will inject into iframes and then use the provider iframe page. caveat is we would need to give the extension permission to mutate all pages
	// const wallet = await LedgerWallet.create(jsonRpcEndpoint, fetch.bind(window), getGasPrice)
	hotOstrichChannel.updateWallet(wallet)
}
