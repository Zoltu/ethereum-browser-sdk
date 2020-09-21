import { provider } from '@zoltu/ethereum-browser-sdk';
import { PromptingWallet, Wallet } from './library/wallet';
import { ErrorHandler } from './library/error-handler';
import { HandshakeHandler } from './library/handshake-handler';
import { HotOstrichChannel } from './library/hot-ostrich-channel';
import { createOnChangeProxy } from './library/proxy';
import { App, AppModel } from './views/app';
import { Future } from './library/utils';

function render() {
	const element = React.createElement(App, rootModel)
	ReactDOM.render(element, main)
}

const errorHandler = new ErrorHandler()
const fetch = window.fetch.bind(window)
const jsonRpcEndpoint = 'https://ethereum.zoltu.io' as const
// const jsonRpcEndpoint = 'https://mainnet.infura.io/v3/60bdf3ec0a954aa8aba21478529ed1ce' as const
// const jsonRpcEndpoint = 'http://127.0.0.1:1237/' as const
let gasPrice = 10n**9n

let handshakeChannel: provider.HandshakeChannel | undefined = undefined
let hotOstrichChannel: HotOstrichChannel | undefined = undefined
let iframeEventPropagator: ((this: Window, ev: MessageEvent) => any) | undefined = undefined
// let wallet: Wallet | undefined = undefined
const rootModel = createOnChangeProxy<AppModel>(render, {
	errorHandler,
	jsonRpcEndpoint,
	fetch,
	childWindowChanged: childWindow => {
		if (hotOstrichChannel !== undefined) hotOstrichChannel.shutdown()
		if (handshakeChannel !== undefined) handshakeChannel.shutdown()
		if (iframeEventPropagator !== undefined) window.removeEventListener('message', iframeEventPropagator)
		if (childWindow === null) return

		// propogate window events to the iframe window so anyone providing Ethereum access to this page can provide to the iframe as well (e.g., extension)
		iframeEventPropagator = messageEvent => childWindow.postMessage(messageEvent.data, '*')
		window.addEventListener('message', iframeEventPropagator)

		handshakeChannel = new provider.HandshakeChannel(window, childWindow, new HandshakeHandler(errorHandler))
		hotOstrichChannel = new HotOstrichChannel(errorHandler, fetch, window, childWindow, jsonRpcEndpoint, async () => gasPrice)
	},
	walletChanged: async (wallet: Wallet|undefined) => {
		if (wallet === undefined) rootModel.wallet = wallet
		else if (!('submitContractCall' in wallet)) rootModel.wallet = wallet
		else rootModel.wallet = new PromptingWallet(wallet, {
			submitContractCall: async (...[request]: Parameters<provider.HotOstrichHandler['submitContractCall']>) => {
				const future = new Future<boolean>()
				rootModel.signerDetails = {
					kind: 'call',
					action: () => future.resolve(true),
					cancel: () => future.resolve(false),
					contractAddress: request.contract_address,
					methodSignature: request.method_signature,
					methodParameters: request.method_parameters,
					amount: request.value,
				}
				const result = await future
				rootModel.signerDetails = undefined
				return result
			},
			submitContractDeployment: async (...[request]: Parameters<provider.HotOstrichHandler['submitContractDeployment']>) => {
				const future = new Future<boolean>()
				rootModel.signerDetails = {
					kind: 'deploy',
					action: () => future.resolve(true),
					cancel: () => future.resolve(false),
					amount: request.value,
				}
				const result = await future
				rootModel.signerDetails = undefined
				return result
			},
			submitNativeTokenTransfer: async (...[request]: Parameters<provider.HotOstrichHandler['submitNativeTokenTransfer']>) => {
				const future = new Future<boolean>()
				rootModel.signerDetails = {
					kind: 'transfer',
					action: () => future.resolve(true),
					cancel: () => future.resolve(false),
					destination: request.to,
					amount: request.value,
				}
				const result = await future
				rootModel.signerDetails = undefined
				return result
			},
		})
		if (hotOstrichChannel === undefined) return
		hotOstrichChannel.updateWallet(rootModel.wallet)
	},
	setGasPrice: (value: bigint) => gasPrice = value,
	getGasPrice: async () => gasPrice,

	wallet: undefined,
	noProxy: new Set(['wallet']),
})

;(window as any).rootModel = rootModel
const main = document.querySelector('main')
ReactDOM.render(React.createElement(App, { walletAddress: rootModel.wallet === undefined ? undefined : rootModel.wallet.address, ...rootModel}), main)
