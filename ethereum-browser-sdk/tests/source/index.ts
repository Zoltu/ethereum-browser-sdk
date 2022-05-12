import { JSDOM } from 'jsdom'
import { client, provider, shared } from '@zoltu/ethereum-browser-sdk'

const { providerWindow, clientWindow } = createWindowWithIframe()

const providerAnnouncement: shared.Handshake.ProviderAnnouncementNotification['payload'] = {
	friendly_icon: 'iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==',
	friendly_name: 'My Awesome Provider',
	provider_id: 'my-provider-id',
	supported_protocols: [...client.HotOstrichChannel.supportedProtocols],
	chain_name: 'Ethereum Mainnet',
} as const

const handshakeClient = new client.HandshakeChannel(clientWindow, {
	onError: console.error,
	// we'll get 3 provider announcements:
	// 1. construction of provider announces itself
	// 2. construction of client announces itself, and provider responds to that
	// 3. the client calls reRequestProviders, which causes all providers to announce themselves
	onProviderAnnounced: console.log,
})
new provider.HandshakeChannel(providerWindow, clientWindow, {
	onError: console.error,
	getProviderAnnouncement: async () => providerAnnouncement,
})
handshakeClient.reRequestProviders()
setTimeout(() => {
	console.log(handshakeClient.knownProviders)
}, 2000)


function createWindowWithIframe() {
	const providerWindow = new JSDOM().window as any
	const iframe = providerWindow.document.createElement('iframe')
	providerWindow.document.body.appendChild(iframe)
	const clientWindow = iframe.contentWindow
	if (!clientWindow) throw new Error(`Unexpected, recommend debugging.`)
	return { providerWindow, clientWindow }
}
