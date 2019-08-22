import { MessageEnvelope, Message, ClientMessage, EthereumEnvelope, ProviderMessage, Handshake, HotOstrich } from "./shared";
import { EthereumMessageEvent } from "./client";
import { assertNever } from "./utils";

abstract class Channel<T extends MessageEnvelope> {
	protected constructor(private readonly window: Window, private readonly clientWindow: Window) {
		this.window.addEventListener('message', this.onMessage)
	}

	public readonly shutdown = () => {
		this.window.removeEventListener('message', this.onMessage)
	}

	private readonly onMessage = async (messageEvent: MessageEvent) => {
		try {
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
		this.clientWindow.postMessage(ethereumEnvelope, '*')
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
	public constructor(window: Window, clientWindow: Window, private readonly handshakeHandler: HandshakeHandler) {
		super(window, clientWindow)
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
	readonly getCapabilities: () => Promise<Array<'sign'|'call'|'submit'|'log_subscription'|'log_history'>>
	readonly getSignerAddress: () => Promise<Uint8Array>
	readonly localContractCall: (request: HotOstrich.LocalContractCall.Request['payload']) => Promise<Uint8Array>
	readonly signMessage: (message: string) => Promise<HotOstrich.SignMessage.SuccessResponse['payload']>
	readonly submitContractCall: (message: HotOstrich.SubmitContractCall.Request['payload']) => Promise<HotOstrich.SubmitContractCall.SuccessResponse['payload']>
	readonly submitContractDeployment: (requestPayload: HotOstrich.SubmitContractDeployment.Request['payload']) => Promise<HotOstrich.SubmitContractDeployment.SuccessResponse['payload']>
	readonly submitNativeTokenTransfer: (requestPayload: HotOstrich.SubmitNativeTokenTransfer.Request['payload']) => Promise<HotOstrich.SubmitNativeTokenTransfer.SuccessResponse['payload']>
}

export class HotOstrichChannel extends Channel<HotOstrich.Envelope> {
	public static readonly supportedProtocols = [{ name: HotOstrich.KIND, version: HotOstrich.VERSION }] as const

	public constructor(window: Window, clientWindow: Window, private readonly providerId: string, private readonly hotOstrichHandler: HotOstrichHandler) {
		super(window, clientWindow)
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
				: (message.kind === 'get_signer_address') ? await this.onGetSignerAddress(message.payload)
				: (message.kind === 'local_contract_call') ? await this.onLocalContractCall(message.payload)
				: (message.kind === 'sign_message') ? await this.onSignMessage(message.payload)
				: (message.kind === 'submit_contract_call') ? await this.onSubmitContractCall(message.payload)
				: (message.kind === 'submit_contract_deployment') ? await this.onSubmitContractDeployment(message.payload)
				: (message.kind === 'submit_native_token_transfer') ? await this.onSubmitNativeTokenTransfer(message.payload)
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
			this.send({
				type: 'response',
				kind: message.kind,
				correlation_id: message.correlation_id,
				success: false,
				error: {
					message: error.message || 'Unknown error occurred while processing request.',
					data: JSON.stringify(error),
				},
				payload: {}
			})
		}
	}

	private readonly onGetCapabilities = async (_: HotOstrich.GetCapabilities.Request['payload']): Promise<HotOstrich.GetCapabilities.SuccessResponse['payload']> => {
		return { capabilities: await this.hotOstrichHandler.getCapabilities() }
	}

	private readonly onGetSignerAddress = async (_: HotOstrich.GetSignerAddress.Request['payload']): Promise<HotOstrich.GetSignerAddress.SuccessResponse['payload']> => {
		return { address: await this.hotOstrichHandler.getSignerAddress() }
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

const isEthereumMessageEvent = (event: MessageEvent): event is EthereumMessageEvent => typeof event.data === 'object' && 'ethereum' in event.data && typeof event.data.ethereum === 'object'
const isClientMessage = (message: Message): message is ClientMessage => message.type === 'broadcast' || message.type === 'request'
