/// <reference path="../node_modules/knockout/build/types/knockout.d.ts" />
import { client } from '@zoltu/ethereum-browser-sdk'
import { Address } from '@zoltu/ethereum-types';

export class Main {
	public readonly handshakeChannel = new client.HandshakeChannel(window, this)
	public hotOstrichChannel?: client.HotOstrichChannel

	public readonly providers = ko.observableArray<Parameters<client.HandshakeHandlers['onProviderAnnounced']>[0]>([])
	public readonly signerAddress = ko.observable<string | undefined>()
	public readonly selectedProvider = ko.observable<Parameters<client.HandshakeHandlers['onProviderAnnounced']>[0] | undefined>()

	public readonly onError: client.HandshakeHandlers['onError'] = console.error

	public readonly onProviderAnnounced: client.HandshakeHandlers['onProviderAnnounced'] = async announcement => {
		try {
			if (!this.providers().find(x => x.provider_id === announcement.provider_id)) {
				this.providers.push(announcement)
			}
		} catch (error) {
			console.error(error)
		}
	}

	public readonly onProviderChanged = async () => {
		const provider = this.selectedProvider()
		if (provider === undefined) return this.reset()

		if (this.hotOstrichChannel !== undefined) this.hotOstrichChannel.shutdown()
		this.hotOstrichChannel = new client.HotOstrichChannel(window, provider.provider_id, this)
		const signerAddress = await this.hotOstrichChannel.getSignerAddress()
		this.signerAddress(Address.fromByteArray(signerAddress).toString())
	}

	public readonly onSignerAddressChanged: client.HotOstrichHandlers['onSignerAddressChanged'] = newSignerAddress => {
		this.signerAddress(Address.fromByteArray(newSignerAddress).toString())
	}

	public constructor() {
		this.selectedProvider.subscribe(this.onProviderChanged)
	}

	private reset = () => {
		this.signerAddress(undefined)
	}
}
