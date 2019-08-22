/// <reference path="../../node_modules/knockout/build/types/knockout.d.ts" />
import { provider } from '@zoltu/ethereum-browser-sdk'
import { FetchJsonRpc } from '@zoltu/ethereum-fetch-json-rpc'
import { Address, Bytes, Bytes32, Bytes1 } from '@zoltu/ethereum-types'

// CONSIDER: we use lazy promise evaluation, so we probably want to disable unhandledrejection handling in production
// window.addEventListener('unhandledrejection', event => event.preventDefault())

export class Main {
	public readonly value = ko.observable('hello')
	private readonly fetchJsonRpc = new FetchJsonRpc('https://cloudflare-eth.com', window.fetch.bind(window), async () => 2n*10n**9n)
	public constructor() {
		// these objects spin up listeners that will callback to this object, but we don't need to actually do anything with them once they are started
		const childWindow = (document.querySelector('#child-iframe') as HTMLIFrameElement).contentWindow
		if (!childWindow) throw new Error(`child-iframe has no content window.`)
		new provider.HandshakeChannel(window, childWindow, this)
		new provider.HotOstrichChannel(window, childWindow, 'my-iframe-provider', this)
		// propogate window events to the iframe window so anyone providing Ethereum access to this page can provide to the iframe (e.g., extension)
		window.addEventListener('message', messageEvent => childWindow.postMessage(messageEvent.data, '*'))
	}

	public readonly onError: provider.HandshakeHandler['onError'] = console.error

	// Handshake
	public readonly getProviderAnnouncement: provider.HandshakeHandler['getProviderAnnouncement'] = async () => {
		return {
			friendly_icon: 'iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==',
			friendly_name: 'My iFrame Provider 😸',
			provider_id: 'my-iframe-provider',
			supported_protocols: provider.HotOstrichChannel.supportedProtocols
		}
	}

	// HotOstrich
	public readonly getCapabilities: provider.HotOstrichHandler['getCapabilities'] = async () => ['call', 'sign', 'submit']
	public readonly getSignerAddress: provider.HotOstrichHandler['getSignerAddress'] = async () => Address.fromHexString('913dA4198E6bE1D5f5E4a40D0667f70C0B5430Eb')
	public readonly localContractCall: provider.HotOstrichHandler['localContractCall'] = async request => this.fetchJsonRpc.offChainContractCall({
		to: Address.fromByteArray(request.contract_address),
		// TODO: data: keccak256(request.method_signature).concat(request.method_parameters.map(encode)),
		data: new Bytes(),
	})
	public readonly signMessage: provider.HotOstrichHandler['signMessage'] = async message => {
		const messageBytes = Bytes.fromStringLiteral(message)
		const messageBytesLength = messageBytes.length.toString(10)
		const signature = await this.fetchJsonRpc.sign(await this.fetchJsonRpc.coinbase(), messageBytes)
		return {
			requested_message: message,
			signed_message: `\x19Ethereum Signed Message:\n${messageBytesLength}${message}`,
			signed_bytes: Bytes.fromStringLiteral(`\x19Ethereum Signed Message:\n${messageBytesLength}${message}`),
			signature: {
				r: Bytes32.fromByteArray(signature.subarray(0, 32)),
				s: Bytes32.fromByteArray(signature.subarray(32, 64)),
				v: Bytes1.fromByteArray(signature.subarray(64, 65)),
			}
		}
	}
	public readonly submitContractCall: provider.HotOstrichHandler['submitContractCall'] = async message => {
		await this.fetchJsonRpc.onChainContractCall({
			to: Address.fromByteArray(message.contract_address),
			// TODO: keccak256(request.method_signature).concat(request.method_parameters.map(encode)),
			data: new Bytes(),
		})
		return {
			confidence: 1,
			updateChannelName: 'TODO'
		}
	}
	public readonly submitContractDeployment: provider.HotOstrichHandler['submitContractDeployment'] = async transaction => {
		// TODO: ABI encode constructor parameters from transaction.constructor_parameters
		const encodedConstructorParameters = new Bytes()
		const deploymentBytecode = Bytes.fromByteArray([...transaction.bytecode, ...encodedConstructorParameters])
		await this.fetchJsonRpc.deployContract(deploymentBytecode, transaction.value)
		return {
			confidence: 1,
			updateChannelName: 'TODO'
		}
	}
	public readonly submitNativeTokenTransfer: provider.HotOstrichHandler['submitNativeTokenTransfer'] = async transaction => {
		await this.fetchJsonRpc.onChainContractCall({
			to: Address.fromByteArray(transaction.to),
			value: transaction.value,
			data: new Bytes(),
		})
		return {
			confidence: 1,
			updateChannelName: 'TODO'
		}
	}
}
