import { provider } from '@zoltu/ethereum-browser-sdk'
import { HotOstrichChannel } from './hot-ostrich-channel'
import { ErrorHandler } from './error-handler'
import { MnemonicWallet } from './wallet'

// user clicked the navbar icon
browser.browserAction.onClicked.addListener(tab => contentInjector(tab).catch(console.error))
browser.runtime.onConnect.addListener(port => onContentScriptConnected(port).catch(console.error))

async function contentInjector(tab: browser.tabs.Tab): Promise<void> {
	if (tab.id === undefined) return
	await browser.tabs.executeScript(tab.id, { file: '/vendor/webextension-polyfill/browser-polyfill.js'})
	await browser.tabs.executeScript(tab.id, { file: '/js/content.js' })
	await browser.tabs.executeScript(tab.id, { file: '/js/legacy-injector.js' })
	// TODO: add a GUI to the extension that shows up on click (as well as injecting the content script) that lets the user inject the legacy provider optionally (rather than forcing it in)
}

async function onContentScriptConnected(port: browser.runtime.Port): Promise<void> {
	const addEventListener = (_: 'message', listener: (payload: any) => void) => port.onMessage.addListener(listener)
	const removeEventListener = (_: 'message', listener: (payload: any) => void) => port.onMessage.removeListener(listener)
	const postMessage = (message: any, _: string) =>  port.postMessage(message)

	const errorHandler = new ErrorHandler()
	const jsonRpcEndpoint = 'https://parity.zoltu.io/' as const
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
	const mnemonicWallet = await MnemonicWallet.create(jsonRpcEndpoint, fetch.bind(window), getGasPrice, ['zoo', 'zoo', 'zoo', 'zoo', 'zoo', 'zoo', 'zoo', 'zoo', 'zoo', 'zoo', 'zoo', 'wrong'])
	hotOstrichChannel.updateWallet(mnemonicWallet)
}
