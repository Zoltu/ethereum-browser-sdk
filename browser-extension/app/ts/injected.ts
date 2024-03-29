import { client, shared } from '../vendor/@zoltu/ethereum-browser-sdk/index'
import { JsonRpcError } from './error-handler'
import { IJsonRpcError, IJsonRpcSuccess } from '@zoltu/ethereum-types'

const providers: Record<string, shared.Handshake.ProviderAnnouncementNotification['payload'] & { hotOstrich: client.HotOstrichChannel }> = {}
const getRandomLegacyProvider = () => Object.values(providers).length === 0 ? undefined : Object.values(providers).find(provider => provider.hotOstrich.capabilities.has('legacy'))
const accountChangedSubscribers: ((accounts: string[]) => void)[] = []

new client.HandshakeChannel(window, {
	onError: console.error,
	onProviderAnnounced: announcement => {
		if (providers[announcement.provider_id] !== undefined) return
		const hotOstrich = new client.HotOstrichChannel(window, announcement.provider_id, {
			onError: console.error,
			onCapabilitiesChanged: () => {},
			onWalletAddressChanged: () => {
				for (const callback of accountChangedSubscribers) {
					callback(hotOstrich.walletAddress === undefined ? [] : [hotOstrich.walletAddress])
				}
			},
		})
		providers[announcement.provider_id] = { ...announcement, hotOstrich }
	}
})

const enable = async () => {
	const provider = getRandomLegacyProvider()
	if (provider === undefined) return []
	if (provider.hotOstrich.walletAddress === undefined) return []
	return [provider.hotOstrich.walletAddress]
}

const request = async (options: { readonly method: string, readonly params?: unknown[] }) => {
	try {
		const provider = getRandomLegacyProvider()
		if (provider === undefined) throw new JsonRpcError(-32601, `No available Ethereum providers that work with legacy JSON-RPC.  Consider updating this application to use Ethereum Events.`)
		const { result } = await provider.hotOstrich.legacyJsonrpc({ method: options.method, parameters: options.params })
		return result
	} catch (error) {
		// if it is an Error, add context to it if context doesn't already exist
		if (error instanceof Error) {
			if (!('code' in error)) (error as any).code = -32603
			if (!('data' in error) || (error as any).data === undefined || (error as any).data === null) (error as any).data = { request: options }
			else if (!('request' in (error as any).data)) (error as any).data.request = options
			throw error
		}
		// if someone threw something besides an Error, wrap it up in an error
		throw new JsonRpcError(-32603, `Unexpected thrown value.`, { error: error, request: options })
	}
}

// 🤬 Uniswap, among others, require `send` to be implemented even though it was never part of any final specification.
// To make matters worse, some versions of send will have a first parameter that is an object (like `request`) and others will have a first and second parameter.
// On top of all that, some applications have a mix of both!
const send = async (method: string | {method: string, params: unknown[]}, params: unknown[]) => {
	if (typeof method === 'object') {
		return await request({ method: method.method, params: method.params})
	} else {
		return await request({ method, params })
	}
}

const sendAsync = async (payload: { id: string | number | null, method: string, params: unknown[] }, callback: (error: IJsonRpcError | null, response: IJsonRpcSuccess<unknown> | null) => void) => {
	request(payload)
		.then(result => callback(null, { jsonrpc: '2.0', id: payload.id, result }))
		// since `request(...)` only throws things shaped like `JsonRpcError`, we can rely on it having those properties.
		.catch(error => callback({ jsonrpc: '2.0', id: payload.id, error: { code: error.code, message: error.message, data: { ...error.data, stack: error.stack } } }, null))
}

const on = async (kind: string, callback: (accounts: string[]) => void) => {
	switch (kind) {
		case 'accountsChanged':
			accountChangedSubscribers.push(callback)
			break
	}
}

;(window as any).ethereum = { enable, request, send, sendAsync, on }
