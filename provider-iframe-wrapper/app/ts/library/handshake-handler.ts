import { provider } from '@zoltu/ethereum-browser-sdk'
import { ErrorHandler } from './error-handler'

export class HandshakeHandler implements provider.HandshakeHandler {
	public constructor(
		private readonly errorHandler: ErrorHandler
	) {}

	public readonly onError: provider.HandshakeHandler['onError'] = error => {
		this.errorHandler.noticeError(error)
	}

	public readonly getProviderAnnouncement: provider.HandshakeHandler['getProviderAnnouncement'] = async () => {
		return {
			friendly_icon: 'iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==',
			friendly_name: 'My iFrame Provider 😸',
			provider_id: 'my-iframe-provider',
			supported_protocols: provider.HotOstrichChannel.supportedProtocols
		}
	}
}
