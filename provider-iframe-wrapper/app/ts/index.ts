import { Wallet } from './library/wallet';
import { ErrorHandler } from './library/error-handler';
import { App } from './views/app';
import { HandshakeHandler } from './library/handshake-handler';
import { HotOstrichChannel } from './library/hot-ostrich-channel';
import { provider } from '@zoltu/ethereum-browser-sdk';

const renderOnChangeProxyHandler: ProxyHandler<any> = {
	set: (object: any, property, newValue): boolean => {
		object[property] = typeof newValue === 'object' ? createProxy(newValue) : newValue
		ReactDOM.render(React.createElement(App, { walletAddress: rootModel.wallet === undefined ? undefined : rootModel.wallet.ethereumAddress, ...rootModel }), main)
		return true
	}
}
function createProxy<T extends object>(target: T): T {
	for (const key in target) {
		if (typeof target[key] !== 'object') continue
		if (target[key] instanceof Uint8Array) continue
		target[key] = createProxy(target[key] as unknown as object) as unknown as T[Extract<keyof T, string>]
	}
	return new Proxy<T>(target, renderOnChangeProxyHandler)
}

const errorHandler = new ErrorHandler()

interface RootModel {
	readonly errorHandler: ErrorHandler
	readonly childWindowChanged: (window: Window|null) => void
	readonly walletChanged: (wallet: Wallet|undefined) => void
	wallet: Wallet | undefined
}

let handshakeChannel: provider.HandshakeChannel | undefined = undefined
let hotOstrichChannel: HotOstrichChannel | undefined = undefined
let iframeEventPropagator: ((this: Window, ev: MessageEvent) => any) | undefined = undefined
const rootModel: RootModel = createProxy<RootModel>({
	errorHandler,
	childWindowChanged: childWindow => {
		if (hotOstrichChannel !== undefined) hotOstrichChannel.shutdown()
		if (handshakeChannel !== undefined) handshakeChannel.shutdown()
		if (iframeEventPropagator !== undefined) window.removeEventListener('message', iframeEventPropagator)
		if (childWindow === null) return

		// propogate window events to the iframe window so anyone providing Ethereum access to this page can provide to the iframe as well (e.g., extension)
		iframeEventPropagator = messageEvent => childWindow.postMessage(messageEvent.data, '*')
		window.addEventListener('message', iframeEventPropagator)

		handshakeChannel = new provider.HandshakeChannel(window, childWindow, new HandshakeHandler(errorHandler))
		hotOstrichChannel = new HotOstrichChannel(errorHandler, window, childWindow)
	},
	walletChanged: async (wallet: Wallet|undefined) => {
		rootModel.wallet = wallet
		if (hotOstrichChannel === undefined) return
		hotOstrichChannel.updateWallet(rootModel.wallet)
	},
	wallet: undefined,
})
;(window as any).rootModel = rootModel
const main = document.querySelector('main')
ReactDOM.render(React.createElement(App, { walletAddress: rootModel.wallet === undefined ? undefined : rootModel.wallet.ethereumAddress, ...rootModel}), main)
