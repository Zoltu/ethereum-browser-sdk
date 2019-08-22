/**
 * boolean => bool
 * bigint => uint<M> for 0 < M <= 256, M % 8 == 0
 * bigint => int<M> for 0 < M <= 256, M % 8 == 0
 * bigint => ufixed<M>x<N> for 8 <= M <= 256, M % 8 == 0 and 0 < N <= 80
 * bigint => fixed<M>x<N> for 8 <= M <= 256, M % 8 == 0 and 0 < N <= 80
 * number => uint<M> for 0 < M <= 48, M % 8 == 0
 * number => int<M> 0 < M <= 48, M % 8 == 0
 * string => string
 * Uint8Array(20) => address
 * Uint8Array(M) => bytes<M> for 0 < M <= 32
 * Uint8Array => bytes
 * Uint8Array => function
 * Array<type>(M) => <type>[M] for type is any type in this list
 * Array<type> => <type>[] for type is any type in this list
 * Array<type>(N) => (T1,T2,...,Tn) for T is any type in this list
 */
export type ContractParameter = Uint8Array | bigint | number | boolean | string | ContractParameterArray
export interface ContractParameterArray extends ReadonlyArray<ContractParameter> { }

export interface BaseMessage { readonly type: MessageType, readonly kind: MessageKind, readonly payload: MessagePayload }
export interface BaseBroadcast extends BaseMessage { readonly type: 'broadcast', readonly kind: Extract<Message, {type:'broadcast'}>['kind'] }
export interface BaseNotification extends BaseMessage { readonly type: 'notification', readonly kind: Extract<Message, {type:'notification'}>['kind'] }
export interface BaseRequest extends BaseMessage { readonly type: 'request', readonly kind: Extract<Message, {type:'request'}>['kind'], readonly correlation_id: string }
export interface BaseResponse extends BaseMessage { readonly type: 'response', readonly kind: Extract<Message, {type:'response'}>['kind'], readonly correlation_id: string, readonly success: boolean }
export interface BaseSuccessResponse extends BaseResponse { readonly success: true }
export interface BaseFailureResponse extends BaseResponse { readonly success: false, readonly error: { readonly message: string, readonly data: unknown } }

interface BaseEnvelope {
	readonly kind: MessageEnvelopeKind
	readonly channel: string
	readonly message: Message
}

// Handshake Protocol
// The ClientAnnouncement and ProviderAnnouncement messages are the only thing that is part of the Handshake protocol, everything else is part of the HotOstrich protocol.
// Messages for this protocol should be sent by broadcasting an 'EthereumHandshake-client' event to the window with the ClientAnnonucement object in the 'data' property of the event.  Providers should send ProviderAnnouncement via the 'data' property of an 'EthereumHandshake-provider' event both when they first come online, and anytime they see a ClientAnnouncement.
//

export namespace Handshake {
	export const CLIENT_CHANNEL_NAME = 'EthereumHandshake-client' as const
	export const PROVIDER_CHANNEL_NAME = 'EthereumHandshake-provider' as const
	export const KIND = 'handshake' as const

	export interface ClientAnnouncementBroadcast extends BaseBroadcast {
		readonly kind: 'client_announcement'
		readonly type: 'broadcast'
		readonly payload: {}
	}

	export interface Protocol {
		readonly name: string
		readonly version: string
	}
	export interface ProviderAnnouncementNotification extends BaseNotification {
		readonly kind: 'provider_announcement'
		readonly type: 'notification'
		readonly payload: {
			/** used to allow the application to communicate with a specific provider in the case when there are many available providers */
			readonly provider_id: string
			/** the client must communicate with this provider using one of the protocols listed here */
			readonly supported_protocols: ReadonlyArray<Protocol>
			/** the friendly name of this provider to present to the user */
			readonly friendly_name: string
			/** base64 encoded png for an icon to present to the user */
			readonly friendly_icon: string
		}
	}

	export type Message = ClientAnnouncementBroadcast | ProviderAnnouncementNotification
	export type ClientMessage = Extract<Message, BaseRequest | BaseBroadcast>
	export type ProviderMessage = Extract<Message, BaseResponse | BaseNotification>
	export type ClientBroadcast = Extract<ClientMessage, BaseBroadcast>
	export type ProviderNotification = Extract<ProviderMessage, BaseNotification>
	export type ClientRequest = Extract<ClientMessage, BaseRequest>
	export type ProviderResponse = Extract<ProviderMessage, BaseResponse>

	export interface Envelope extends BaseEnvelope {
		readonly kind: typeof KIND
		readonly channel: typeof CLIENT_CHANNEL_NAME | typeof PROVIDER_CHANNEL_NAME
		readonly message: Message
	}
}

// HotOstritch Protocol
// Everything from here on down is part of the HotOstrich protocol.  You should only send these messages if the Hello message indicates that the HotOstrich protocol is supported by the provider.
// Messages sent from the client for this protocol should be sent by broadcasting an event to the window of type 'HotOstritch-client-<provider_id>'.
// Messages sent from the server for this protocol should be sent by broadcasting an event to the window of type 'HotOstritch-provider-<provider_id>'.
//

export namespace HotOstrich {
	export const CLIENT_CHANNEL_PREFIX = 'HotOstrich-client-' as const
	export const PROVIDER_CHANNEL_PREFIX = 'HotOstrich-provider-' as const
	export const KIND = 'hot_ostrich' as const
	export const VERSION = '1.0.0' as const

	export namespace GetCapabilities {
		interface Kind extends BaseMessage { readonly kind: 'get_capabilities' }
		export interface Request extends Kind, BaseRequest {
			readonly kind: 'get_capabilities'
			readonly type: 'request'
			readonly payload: {}
		}
		export interface SuccessResponse extends Kind, BaseSuccessResponse {
			readonly kind: 'get_capabilities'
			readonly type: 'response'
			readonly payload: {
				readonly capabilities: ReadonlyArray<'sign'|'call'|'submit'|'log_subscription'|'log_history'>
			}
		}
		export interface FailureResponse extends Kind, BaseFailureResponse {
			readonly kind: 'get_capabilities'
			readonly type: 'response'
			readonly payload: {}
		}
		export type Response = SuccessResponse | FailureResponse
		export type Message = Request | Response
	}

	export namespace SubmitNativeTokenTransfer {
		interface Kind extends BaseMessage { readonly kind: 'submit_native_token_transfer' }
		export interface Request extends Kind, BaseRequest {
			readonly kind: 'submit_native_token_transfer'
			readonly type: 'request'
			readonly payload: {
				/** 20 bytes long */
				readonly to: Uint8Array
				/** 0 <= value < 2^256 */
				readonly value: bigint
				/** 0 <= nonce <= 2^52; nonce % 1 == 0 */
				readonly nonce?: number
				/** 0 <= gasPrice <= 2^256 */
				readonly gasPrice?: bigint
				/** 0 <= gas <= 2^52; gasLimit % 1 == 0 */
				readonly gasLimit?: number
				/** 0 <= chainId < 2^52; nonce % 1 == 0 */
				readonly chainId?: number
			}
		}
		export interface SuccessResponse extends Kind, BaseSuccessResponse {
			readonly kind: 'submit_native_token_transfer'
			readonly type: 'response'
			readonly payload: {
				readonly confidence: number
				readonly updateChannelName: string
			}
		}
		export interface FailureResponse extends Kind, BaseFailureResponse {
			readonly kind: 'submit_native_token_transfer'
			readonly type: 'response'
			readonly payload: {}
		}
		export type Response = SuccessResponse | FailureResponse
		export type Message = Request | Response
	}

	export namespace SubmitContractCall {
		interface Kind extends BaseMessage { readonly kind: 'submit_contract_call' }
		export interface Request extends Kind, BaseRequest {
			readonly kind: 'submit_contract_call'
			readonly type: 'request'
			readonly payload: {
				/** 20 bytes long */
				readonly contract_address: Uint8Array
				/** ABI style: `myMethod(address,address[],uint256,(bool,bytes))` */
				readonly method_signature: string
				readonly method_parameters: ReadonlyArray<ContractParameter>
				/** 0 <= value < 2^256 */
				readonly value: bigint
				/** 0 <= nonce <= 2^52; nonce % 1 == 0 */
				readonly nonce?: number
				/** 0 <= gasPrice <= 2^256 */
				readonly gasPrice?: bigint
				/** 0 <= gas <= 2^52; gasLimit % 1 == 0 */
				readonly gasLimit?: number
				/** 0 <= chainId < 2^52; nonce % 1 == 0 */
				readonly chainId?: number
				/** Something like EIP 719 for presenting the user with a custom interface for transaction presentation. Validated by signer against contract with transaction details. */
				readonly presentation_dsls: { [name: string]: unknown }
			}
		}
		export interface SuccessResponse extends Kind, BaseSuccessResponse {
			readonly kind: 'submit_contract_call'
			readonly type: 'response'
			readonly payload: {
				readonly confidence: number
				readonly updateChannelName: string
			}
		}
		export interface FailureResponse extends Kind, BaseFailureResponse {
			readonly kind: 'submit_contract_call',
			readonly type: 'response',
			readonly payload: {}
		}
		export type Response = SuccessResponse | FailureResponse
		export type Message = Request | Response
	}

	export namespace SubmitContractDeployment {
		interface Kind extends BaseMessage { readonly kind: 'submit_contract_deployment' }
		export interface Request extends Kind, BaseRequest {
			readonly kind: 'submit_contract_deployment'
			readonly type: 'request'
			readonly payload: {
				readonly bytecode: Uint8Array
				/** ABI style: `myMethod(address,address[],uint256,(bool,bytes))` */
				readonly constructor_signature: string
				readonly constructor_parameters: ReadonlyArray<ContractParameter>
				/** 0 <= value < 2^256 */
				readonly value: bigint
				/** 0 <= nonce <= 2^52; nonce % 1 == 0 */
				readonly nonce?: number
				/** 0 <= gasPrice <= 2^256 */
				readonly gasPrice?: bigint
				/** 0 <= gas <= 2^52; gasLimit % 1 == 0 */
				readonly gasLimit?: number
				/** 0 <= chainId < 2^52; nonce % 1 == 0 */
				readonly chainId?: number
			}
		}
		export interface SuccessResponse extends Kind, BaseSuccessResponse {
			readonly kind: 'submit_contract_deployment'
			readonly type: 'response'
			readonly payload:  {
				readonly confidence: number
				readonly updateChannelName: string
			}
		}
		export interface FailureResponse extends Kind, BaseFailureResponse {
			readonly kind: 'submit_contract_deployment'
			readonly type: 'response'
			readonly payload: {}
		}
		export type Response = SuccessResponse | FailureResponse
		export type Message = Request | Response
	}

	export namespace SignMessage {
		interface Kind extends BaseMessage { readonly kind: 'sign_message' }
		export interface Request extends Kind, BaseRequest {
			readonly kind: 'sign_message'
			readonly type: 'request'
			readonly payload: {
				readonly message: string
			}
		}
		export interface SuccessResponse extends Kind, BaseSuccessResponse {
			readonly kind: 'sign_message'
			readonly type: 'response'
			readonly payload: {
				/** The message requested to be signed. */
				readonly requested_message: string
				/** The message that was actually signed. */
				readonly signed_message: string
				/** 32 bytes long.  The keccak256 of `signed_message`, which is what is really signed. */
				readonly signed_bytes: Uint8Array
				/** The signature of the keccak256 of `signed_message` */
				readonly signature: {
					/** 1 byte long */
					readonly v: Uint8Array
					/** 32 bytes long */
					readonly r: Uint8Array
					/** 32 bytes long */
					readonly s: Uint8Array
				}
			}
		}
		export interface FailureResponse extends Kind, BaseFailureResponse {
			readonly kind: 'sign_message'
			readonly type: 'response'
			readonly payload: {}
		}
		export type Response = SuccessResponse | FailureResponse
		export type Message = Request | Response
	}

	export namespace GetSignerAddress {
		interface Kind extends BaseMessage { readonly kind: 'get_signer_address' }
		export interface Request extends Kind, BaseRequest {
			readonly kind: 'get_signer_address'
			readonly type: 'request'
			readonly payload: {}
		}
		export interface SuccessResponse extends Kind, BaseSuccessResponse {
			readonly kind: 'get_signer_address'
			readonly type: 'response'
			readonly payload: {
				readonly address: Uint8Array
			}
		}
		export interface FailureResponse extends Kind, BaseFailureResponse {
			readonly kind: 'get_signer_address'
			readonly type: 'response'
			readonly payload: {}
		}
		export type Response = SuccessResponse | FailureResponse
		export type Message = Request | Response
	}

	export namespace LocalContractCall {
		interface Kind extends BaseMessage { readonly kind: 'local_contract_call' }
		export interface Request extends Kind, BaseRequest {
			readonly kind: 'local_contract_call'
			readonly type: 'request'
			readonly payload: {
				/** 20 bytes long */
				readonly contract_address: Uint8Array
				/** ABI style: `myMethod(address,address[],uint256,(bool,bytes))` */
				readonly method_signature: string
				readonly method_parameters: ReadonlyArray<ContractParameter>
				/** 0 <= value < 2^256 */
				readonly value: bigint
				/** 20 bytes long */
				readonly caller?: Uint8Array
				/** 0 <= gasPrice <= 2^256 */
				readonly gasPrice?: bigint
				/** 0 <= gas <= 2^52; gasLimit % 1 == 0 */
				readonly gasLimit?: number
			}
		}
		export interface SuccessResponse extends Kind, BaseSuccessResponse {
			readonly kind: 'local_contract_call'
			readonly type: 'response'
			readonly payload: {
				/** ABI encoded method return data */
				readonly result: Uint8Array
			}
		}
		export interface FailureResponse extends Kind, BaseFailureResponse {
			readonly kind: 'local_contract_call'
			readonly type: 'response'
			readonly payload: {}
		}
		export type Response = SuccessResponse | FailureResponse
		export type Message = Request | Response
	}

	// export namespace FetchLogs {
	// 	// TODO: this is for fetching old logs, use subscription for new logs
	// 	// CONSIDER: results likely need to be paginated, is page size a client setting or server setting?
	// }

	// export namespace LogsSubscription {
	// 	// CONSIDER: is a subscription just a request with many responses?
	// 	// CONSIDER: is unsubscribing necessary?
	// 	// CONSIDER: one response per log, or multiple logs per response?
	// 	// CONSIDER: how are chain reorgs handled, just a message indicating removal or something more complex?
	// }

	// export namespace BlockSubscription {
	// 	// CONSIDER: is this necessary?  why do people want to fetch a block for a dapp?  what information do they _really_ want?  What information do end-users care about?
	// }

	export interface SignerAddressChanged extends BaseNotification {
		readonly kind: 'signer_address_changed'
		readonly type: 'notification'
		readonly payload: {
			readonly address: Uint8Array
		}
	}

	export type Message = GetCapabilities.Message | SubmitNativeTokenTransfer.Message | SubmitContractCall.Message | SubmitContractDeployment.Message | SignMessage.Message | GetSignerAddress.Message | LocalContractCall.Message | SignerAddressChanged
	export type ClientMessage = Extract<Message, BaseRequest | BaseBroadcast>
	export type ProviderMessage = Extract<Message, BaseResponse | BaseNotification>
	export type ClientBroadcast = Extract<ClientMessage, BaseBroadcast>
	export type ProviderNotification = Extract<ProviderMessage, BaseNotification>
	export type ClientRequest = Extract<ClientMessage, BaseRequest>
	export type ProviderResponse = Extract<ProviderMessage, BaseResponse>

	export interface Envelope extends BaseEnvelope {
		readonly kind: typeof KIND
		readonly channel: string
		readonly message: Message
	}
}

export type Message = Handshake.Message | HotOstrich.Message
export type ClientMessage = Extract<Message, BaseRequest | BaseBroadcast>
export type ProviderMessage = Extract<Message, BaseResponse | BaseNotification>
export type ClientBroadcast = Extract<ClientMessage, BaseBroadcast>
export type ProviderNotification = Extract<ProviderMessage, BaseNotification>
export type ClientRequest = Extract<ClientMessage, BaseRequest>
export type ProviderResponse = Extract<ProviderMessage, BaseResponse>
export type MessageKind = Message['kind']
export type MessageType = Message['type']
export type MessagePayload = Message['payload']

export type MessageEnvelope = Handshake.Envelope | HotOstrich.Envelope
export type MessageEnvelopeKind = MessageEnvelope['kind']

export interface EthereumEnvelope {
	readonly ethereum: MessageEnvelope
}
