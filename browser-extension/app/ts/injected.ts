import { client, shared } from '../vendor/@zoltu/ethereum-browser-sdk/index'

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
					callback(hotOstrich.walletAddress === undefined ? [] : [`0x${hotOstrich.walletAddress.toString(16).padStart(40, '0')}`])
				}
			},
		})
		providers[announcement.provider_id] = { ...announcement, hotOstrich }
	}
})

const jsonRpcBase = { id: 1, jsonrpc: '2.0' }

const enable = async () => {
	const provider = getRandomLegacyProvider()
	if (provider === undefined) return []
	if (provider.hotOstrich.walletAddress === undefined) return []
	return [`0x${provider.hotOstrich.walletAddress.toString(16)}`]
}

const send = async (method: string, parameters: unknown[]) => {
	try {
		const provider = getRandomLegacyProvider()
		if (provider === undefined) return { ...jsonRpcBase, error: {
			code: -32601,
			message: `No available Ethereum providers that work with legacy JSON-RPC.  Consider updating this application to use Ethereum Events.`
		}} as const
		const { result } = await provider.hotOstrich.legacyJsonrpc({method, parameters})
		return { ...jsonRpcBase, result } as const
	} catch (error) {
		return { ...jsonRpcBase, error: {
			code: error.code,
			message: error.message,
			data: error.data,
		}} as const
	}
}

const sendAsync = async (payload: { readonly method: string, readonly params: unknown[] }, callback: (error: { readonly code: number, readonly message: string, readonly data?: unknown } | null, result: unknown | null) => void) => {
	send(payload.method, payload.params)
		.then(result => ('error' in result) ? callback(result.error, null) : callback(null, result.result))
		// catch should be unreachable given that send converts all Errors into JSON-RPC erorrs, but we add the catch here to satisfy unhandled promise rejection warnings in browser
		.catch(error => callback(error, null))
}

const on = async (_: 'accountsChanged', callback: (accounts: string[]) => void) => {
	accountChangedSubscribers.push(callback)
}

;(window as any).ethereum = { enable, send, sendAsync, on }
