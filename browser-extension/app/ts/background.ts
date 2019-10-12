import { provider } from '@zoltu/ethereum-browser-sdk'

// user clicked the navbar icon
browser.browserAction.onClicked.addListener(tab => contentInjector(tab).catch(console.error))
browser.runtime.onConnect.addListener(port => onContentScriptConnected(port).catch(console.error))

async function contentInjector(tab: browser.tabs.Tab): Promise<void> {
	if (tab.id === undefined) return
	await browser.tabs.executeScript(tab.id, { file: '/vendor/webextension-polyfill/browser-polyfill.js'})
	await browser.tabs.executeScript(tab.id, { file: '/js/content.js' })
}

async function onContentScriptConnected(port: browser.runtime.Port): Promise<void> {
	const addEventListener = (_: 'message', listener: (payload: any) => void) => port.onMessage.addListener(listener)
	const removeEventListener = (_: 'message', listener: (payload: any) => void) => port.onMessage.removeListener(listener)
	const postMessage = (message: any, _: string) =>  port.postMessage(message)

	new provider.HandshakeChannel({addEventListener, removeEventListener}, {postMessage}, {
		onError: console.error,
		getProviderAnnouncement: async () => ({
			friendly_icon: 'iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==',
			friendly_name: 'My Extension Provider 😎',
			provider_id: 'my-extension-provider',
			supported_protocols: [ ...provider.HotOstrichChannel.supportedProtocols ],
		})
	})
	const hotOstrichChannel = new provider.HotOstrichChannel({addEventListener, removeEventListener}, {postMessage}, 'my-extension-provider', {
		onError: console.error,
		getBalance: async () => { throw new Error(`Not implemented yet.`)},
		localContractCall: async () => { throw new Error(`Not implemented yet.`) },
		signMessage: async () => { throw new Error(`Not implemented yet.`) },
		submitContractCall: async () => { throw new Error(`Not implemented yet.`) },
		submitContractDeployment: async () => { throw new Error(`Not implemented yet.`) },
		submitNativeTokenTransfer: async () => { throw new Error(`Not implemented yet.`) },
	})
	hotOstrichChannel.walletAddress = 0n
	hotOstrichChannel.updateCapabilities({call:true,submit:true})
}
