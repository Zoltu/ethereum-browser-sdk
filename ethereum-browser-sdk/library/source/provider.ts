import { MessageEnvelope, Message, ClientMessage, EthereumEnvelope, ProviderMessage, Handshake, HotOstrich, BaseFailureResponse } from "./shared"
import { EthereumMessageEvent } from "./client"
import { assertNever } from "./utils"

interface IncomingWindowLike {
	addEventListener(type: 'message', listener: (message: any) => void): void
	removeEventListener(type: 'message', listener: (message: any) => void): void
}

interface OutgoingWindowLike {
	postMessage(message: any, targetOrigin: string): void
}

abstract class Channel<T extends MessageEnvelope> {
	protected constructor(private readonly incomingWindow: IncomingWindowLike, private readonly outgoingWindow: OutgoingWindowLike) {
		this.incomingWindow.addEventListener('message', this.onMessage)
	}

	public readonly shutdown = () => {
		this.incomingWindow.removeEventListener('message', this.onMessage)
	}

	private readonly onMessage = async (messageEvent: any) => {
		try {
			if (!isMessageEvent(messageEvent)) return
			if (!isEthereumMessageEvent(messageEvent)) return
			if (messageEvent.data.ethereum.channel !== this.clientChannelName) return
			// CONSIDER: error here instead of silently returning if we see messages over this channel that we don't expect
			if (!this.isT(messageEvent.data.ethereum)) return
			if (!isClientMessage(messageEvent.data.ethereum.message)) return
			// https://github.com/microsoft/TypeScript/issues/32591
			await this.onClientMessage(messageEvent.data.ethereum.message as Extract<T['message'], ClientMessage>)
		} catch (error) {
			if (error instanceof Error) {
				this.onError(error)
			} else if (typeof error === 'string') {
				this.onError(new Error(error))
			} else {
				this.onError(new Error(JSON.stringify(error)))
			}
		}
	}

	protected readonly send = (message: Extract<T['message'], ProviderMessage>): void => {
		const ethereumEnvelope: EthereumEnvelope = {
			ethereum: {
				channel: this.providerChannelName,
				kind: this.kind,
				message: message,
			} as MessageEnvelope // https://github.com/microsoft/TypeScript/issues/32591
		}
		this.outgoingWindow.postMessage(ethereumEnvelope, '*')
	}

	private readonly isT = (messageEnvelope: MessageEnvelope): messageEnvelope is T => messageEnvelope.kind === this.kind

	protected abstract readonly onClientMessage: (message: Extract<T['message'], ClientMessage>) => Promise<void>
	protected abstract readonly onError: (error: Error) => void
	protected abstract readonly providerChannelName: T['channel']
	protected abstract readonly clientChannelName: T['channel']
	protected abstract readonly kind: T['kind']
}

export interface HandshakeHandler {
	readonly onError: (error: Error) => void
	readonly getProviderAnnouncement: () => Promise<Handshake.ProviderAnnouncementNotification['payload']>
}

export class HandshakeChannel extends Channel<Handshake.Envelope> {
	public constructor(incomingWindow: IncomingWindowLike, outgoingWindow: OutgoingWindowLike, private readonly handshakeHandler: HandshakeHandler) {
		super(incomingWindow, outgoingWindow)
		this.announceProvider()
	}

	protected readonly onClientMessage = async (message: Handshake.ClientMessage): Promise<void> => {
		switch (message.type) {
			case 'broadcast': return await this.onBroadcast(message)
			// TS doesn't support discriminated unions of one type, so we can't assertNever(message) until at least 2 types are in the Handshake.Event union; if a second is added change this to assertNever(message)
			default: return assertNever(message.type)
		}
	}
	protected readonly onError = this.handshakeHandler.onError
	protected readonly providerChannelName = Handshake.PROVIDER_CHANNEL_NAME
	protected readonly clientChannelName = Handshake.CLIENT_CHANNEL_NAME
	protected readonly kind = Handshake.KIND

	private readonly onBroadcast = async (message: Handshake.ClientBroadcast): Promise<void> => {
		switch (message.kind) {
			case 'client_announcement': return await this.announceProvider()
			// TS doesn't support discriminated unions of one type, so we can't assertNever(message) until at least 2 types are in the Handshake.Event union; if a second is added change this to assertNever(message)
			default: return assertNever(message.kind)
		}
	}

	private readonly announceProvider = async (): Promise<void> => {
		this.send({
			type: 'notification',
			kind: 'provider_announcement',
			payload: await this.handshakeHandler.getProviderAnnouncement()
		})
	}
}

export interface HotOstrichHandler {
	readonly onError: (error: Error) => void
	readonly getBalance: (request: HotOstrich.GetBalance.Request['payload']['address']) => Promise<HotOstrich.GetBalance.SuccessResponse['payload']['balance']>
	readonly localContractCall: (request: HotOstrich.LocalContractCall.Request['payload']) => Promise<HotOstrich.LocalContractCall.SuccessResponse['payload']['result']>
	readonly signMessage: (message: HotOstrich.SignMessage.Request['payload']['message']) => Promise<HotOstrich.SignMessage.SuccessResponse['payload']>
	readonly submitContractCall: (request: HotOstrich.SubmitContractCall.Request['payload']) => Promise<HotOstrich.SubmitContractCall.SuccessResponse['payload']>
	readonly submitContractDeployment: (request: HotOstrich.SubmitContractDeployment.Request['payload']) => Promise<HotOstrich.SubmitContractDeployment.SuccessResponse['payload']>
	readonly submitNativeTokenTransfer: (request: HotOstrich.SubmitNativeTokenTransfer.Request['payload']) => Promise<HotOstrich.SubmitNativeTokenTransfer.SuccessResponse['payload']>
}

export class HotOstrichChannel extends Channel<HotOstrich.Envelope> {
	public static readonly supportedProtocols = [{ name: HotOstrich.KIND, version: HotOstrich.VERSION }] as const

	private readonly capabilities = new Set<Capability>()

	private _walletAddress?: HotOstrich.WalletAddressChanged['payload']['address'] = undefined
	public get walletAddress(): HotOstrich.WalletAddressChanged['payload']['address'] | undefined { return this._walletAddress }
	public set walletAddress(newWalletAddress: bigint | undefined) {
		if (newWalletAddress === this._walletAddress) return
		this._walletAddress = newWalletAddress
		this.updateCapabilities({'address': this._walletAddress !== undefined})
		// we don't announce wallet changes when it is being set to undefined, that is handled through the dropping of the `address` capability
		if (this._walletAddress !== undefined) {
			this.send({
				type: 'notification',
				kind: 'wallet_address_changed',
				payload: { address: this._walletAddress }
			})
		}
	}

	public readonly updateCapabilities = (capabilitiesToUpdate: Partial<{[key in Capability]: boolean}>) => {
		let capabilitiesChanged = false
		for (const capability of HotOstrich.ALL_CAPABILITIES) {
			const newCapabilityState = capabilitiesToUpdate[capability]
			if (newCapabilityState === undefined) continue

			// the address is managed internally, but lets let people clear that capability this way for convenience
			if (capability === 'address') {
				if (!newCapabilityState) this._walletAddress = undefined
				else if (this._walletAddress === undefined) throw new Error(`To update the address capability you must set the walletAddress property on this class.`)
			}

			if (newCapabilityState === this.capabilities.has(capability)) continue
			capabilitiesChanged = true

			if (newCapabilityState) this.capabilities.add(capability)
			else this.capabilities.delete(capability)
		}

		if (capabilitiesChanged) {
			this.send({
				type: 'notification',
				kind: 'capabilities_changed',
				payload: { capabilities: this.capabilities }
			})
		}
	}

	public constructor(incomingWindow: IncomingWindowLike, outgoingWindow: OutgoingWindowLike, private readonly providerId: string, private readonly hotOstrichHandler: HotOstrichHandler) {
		super(incomingWindow, outgoingWindow)
	}

	protected readonly onClientMessage = async (message: HotOstrich.ClientMessage): Promise<void> => {
		switch (message.type) {
			case 'request': return await this.onRequest(message)
			// TS doesn't support discriminated unions of one type, so we can't assertNever(message) until at least 2 types are in the Handshake.Event union; if a second is added change this to assertNever(message)
			default: assertNever(message.type)
		}
	}

	protected readonly onError = this.hotOstrichHandler.onError
	protected readonly providerChannelName = `${HotOstrich.PROVIDER_CHANNEL_PREFIX}${this.providerId}`
	protected readonly clientChannelName = `${HotOstrich.CLIENT_CHANNEL_PREFIX}${this.providerId}`
	protected readonly kind = HotOstrich.KIND

	private readonly onRequest = async (message: HotOstrich.ClientRequest): Promise<void> => {
		try {
			const payload = (message.kind === 'get_capabilities') ? await this.onGetCapabilities(message.payload)
				: (message.kind === 'get_wallet_address') ? await this.onGetWalletAddress(message.payload)
				: (message.kind === 'local_contract_call') ? await this.onLocalContractCall(message.payload)
				: (message.kind === 'sign_message') ? await this.onSignMessage(message.payload)
				: (message.kind === 'submit_contract_call') ? await this.onSubmitContractCall(message.payload)
				: (message.kind === 'submit_contract_deployment') ? await this.onSubmitContractDeployment(message.payload)
				: (message.kind === 'submit_native_token_transfer') ? await this.onSubmitNativeTokenTransfer(message.payload)
				: (message.kind === 'get_balance') ? await this.onGetBalance(message.payload)
				: assertNever(message)
			this.send({
				type: 'response',
				kind: message.kind,
				correlation_id: message.correlation_id,
				success: true,
				payload: payload,
			// cast is unfortunately necessary since even though we know that message.kind and payload will align (due to ternary above, the compiler doesn't track type dependencies)
			} as Extract<HotOstrich.ProviderResponse, {payload:typeof payload}>)
		} catch (error) {
			const errorMessage = {
				type: 'response',
				kind: message.kind,
				correlation_id: message.correlation_id,
				success: false,
				payload: {
					message: (typeof error === 'object' && 'message' in error) ? error.message : 'Unknown error occurred while processing request.',
					data: (typeof error === 'object' && 'data' in error) ? error.data : JSON.stringify(error),
					code: (typeof error === 'object' && 'code' in error) ? error.code : undefined,
				},
			} as Extract<HotOstrich.ProviderResponse, BaseFailureResponse>
			this.send(errorMessage)
		}
	}

	private readonly onGetCapabilities = async (_: HotOstrich.GetCapabilities.Request['payload']): Promise<HotOstrich.GetCapabilities.SuccessResponse['payload']> => {
		return { capabilities: this.capabilities }
	}

	private readonly onGetWalletAddress = async (_: HotOstrich.GetAddress.Request['payload']): Promise<HotOstrich.GetAddress.SuccessResponse['payload']> => {
		// it is an error to ask for a wallet address when the 'address' capability is disabled, so just politely error if the user tries to call this while walletAddress is undefined
		if (this.walletAddress === undefined) throw new Error(`No wallet address available.`)
		return { address: this.walletAddress }
	}

	private readonly onGetBalance = async (requestPayload: HotOstrich.GetBalance.Request['payload']): Promise<HotOstrich.GetBalance.SuccessResponse['payload']> => {
		return { balance: await this.hotOstrichHandler.getBalance(requestPayload.address) }
	}

	private readonly onLocalContractCall = async (requestPayload: HotOstrich.LocalContractCall.Request['payload']): Promise<HotOstrich.LocalContractCall.SuccessResponse['payload']> => {
		return { result: await this.hotOstrichHandler.localContractCall(requestPayload) }
	}

	private readonly onSignMessage = async (requestPayload: HotOstrich.SignMessage.Request['payload']): Promise<HotOstrich.SignMessage.SuccessResponse['payload']> => {
		return await this.hotOstrichHandler.signMessage(requestPayload.message)
	}

	private readonly onSubmitContractCall = async (requestPayload: HotOstrich.SubmitContractCall.Request['payload']): Promise<HotOstrich.SubmitContractCall.SuccessResponse['payload']> => {
		return await this.hotOstrichHandler.submitContractCall(requestPayload)
	}

	private readonly onSubmitContractDeployment = async (requestPayload: HotOstrich.SubmitContractDeployment.Request['payload']): Promise<HotOstrich.SubmitContractDeployment.SuccessResponse['payload']> => {
		return await this.hotOstrichHandler.submitContractDeployment(requestPayload)
	}

	private readonly onSubmitNativeTokenTransfer = async (requestPayload: HotOstrich.SubmitNativeTokenTransfer.Request['payload']): Promise<HotOstrich.SubmitNativeTokenTransfer.SuccessResponse['payload']> => {
		return await this.hotOstrichHandler.submitNativeTokenTransfer(requestPayload)
	}
}

const isMessageEvent = (maybe: object): maybe is MessageEvent => 'data' in maybe
const isEthereumMessageEvent = (event: MessageEvent): event is EthereumMessageEvent => typeof event.data === 'object' && 'ethereum' in event.data && typeof event.data.ethereum === 'object'
const isClientMessage = (message: Message): message is ClientMessage => message.type === 'broadcast' || message.type === 'request'

type ExtractReadonlySetType<T extends ReadonlySet<any>> = T extends ReadonlySet<infer U> ? U : never
type Capability = ExtractReadonlySetType<HotOstrich.CapabilitiesChanged['payload']['capabilities']>
