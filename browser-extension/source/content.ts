/**
 * this script executed within the context of the active tab when the user clicks the plugin navbar button
*/

import { provider } from '@zoltu/ethereum-browser-sdk'
import { Address } from '@zoltu/ethereum-types'

if (!(window as any).recoverableWalletInjected) {
	(window as any).recoverableWalletInjected = true
	new provider.HandshakeChannel(window, window, {
		onError: console.error,
		getProviderAnnouncement: async () => ({
			friendly_icon: 'iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==',
			friendly_name: 'My Extension Provider 😎',
			provider_id: 'my-extension-provider',
			supported_protocols: [ ...provider.HotOstrichChannel.supportedProtocols ],
		})
	})
	new provider.HotOstrichChannel(window, window, 'my-extension-provider', {
		onError: console.error,
		getCapabilities: async () => ['call', 'sign', 'submit'],
		getSignerAddress: async () => Address.fromHexString('913dA4198E6bE1D5f5E4a40D0667f70C0B5430Eb'),
		localContractCall: async () => { throw new Error(`Not implemented yet.`) },
		signMessage: async () => { throw new Error(`Not implemented yet.`) },
		submitContractCall: async () => { throw new Error(`Not implemented yet.`) },
		submitContractDeployment: async () => { throw new Error(`Not implemented yet.`) },
		submitNativeTokenTransfer: async () => { throw new Error(`Not implemented yet.`) },
	})
}

console.log('content script has been attached')
