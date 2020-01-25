import { encodeMethod } from '@zoltu/ethereum-abi-encoder'
import { provider } from '@zoltu/ethereum-browser-sdk'
import { keccak256 } from '@zoltu/ethereum-crypto'
import { FetchJsonRpc } from '@zoltu/ethereum-fetch-json-rpc'
import { JsonRpc, JsonRpcMethod } from '@zoltu/ethereum-types'
import { ErrorHandler, JsonRpcError } from './error-handler'
import { Wallet } from './wallet'
import { contractParametersToEncodables, bigintToHexString } from './abi-stuff'

export class HotOstrichChannel implements provider.HotOstrichHandler {
	private readonly hotOstrichChannel: provider.HotOstrichChannel
	public constructor(
		private readonly errorHandler: ErrorHandler,
		private readonly fetch: Window['fetch'],
		thisWindow: ConstructorParameters<typeof provider.HotOstrichChannel>[0],
		childWindow: ConstructorParameters<typeof provider.HotOstrichChannel>[1],
		private readonly jsonRpcEndpoint: string,
		private readonly getGasPrice: () => Promise<bigint>
	) {
		// CONSIDER: this is a bit sketchy, if the channel constructor makes any calls to the the handler during construction they will fail because we aren't done constructing `this` yet
		this.hotOstrichChannel = new provider.HotOstrichChannel(thisWindow, childWindow, 'my-extension-provider', this)
		this.hotOstrichChannel.updateCapabilities({ 'call': true, 'submit': true })
	}

	public readonly shutdown = () => this.hotOstrichChannel.shutdown()

	private wallet?: Wallet = undefined
	public readonly updateWallet = (wallet: Wallet | undefined) => {
		this.wallet = wallet
		this.hotOstrichChannel.walletAddress = (this.wallet === undefined) ? undefined : this.wallet.address
		const canSignMessage = this.wallet && 'signMessage' in this.wallet
		const canSignTransaction = this.wallet && 'submitContractCall' in this.wallet
		const supportsLegacy = this.wallet && 'legacyJsonrpc' in this.wallet
		this.hotOstrichChannel.updateCapabilities({ signMessage: canSignMessage, signTransaction: canSignTransaction, legacy: supportsLegacy })
	}

	// for submitting transactions/queries only (e.g., getBalance), for anything that requires an account or signing, go through the wallet
	private jsonRpc: JsonRpc = new FetchJsonRpc(this.jsonRpcEndpoint, this.fetch, { gasPriceInAttoethProvider: this.getGasPrice })

	public readonly onError: provider.HotOstrichHandler['onError'] = error => {
		this.errorHandler.noticeError(error)
	}

	public readonly getBalance: provider.HotOstrichHandler['getBalance'] = async address => {
		return await this.jsonRpc.getBalance(address)
	}

	public readonly localContractCall: provider.HotOstrichHandler['localContractCall'] = async request => {
		if (this.wallet !== undefined) {
			return this.wallet.localContractCall(request)
		} else {
			const parameters = contractParametersToEncodables(request.method_parameters)
			const data = await encodeMethod(keccak256.hash, request.method_signature, parameters)
			return await this.jsonRpc.offChainContractCall({
				to: request.contract_address,
				data: data,
				value: request.value,
				gasPrice: request.gas_price,
				gasLimit: request.gas_limit,
			})
		}
	}

	public readonly signMessage: provider.HotOstrichHandler['signMessage'] = async message => {
		if (this.wallet === undefined) throw new Error(`Cannot sign a message without connecting a wallet.`)
		if (!('signMessage' in this.wallet)) throw new Error(`Cannot sign a message with this type of wallet.  Are you using a view-only wallet?`)
		return this.wallet.signMessage(message)
	}

	public readonly submitContractCall: provider.HotOstrichHandler['submitContractCall'] = async request => {
		if (this.wallet === undefined) throw new Error(`Cannot submit transactions without connecting a wallet.`)
		if (!('submitContractCall' in this.wallet)) throw new Error(`Cannot submit transactions with this type of wallet.  Are you using a view-only wallet?`)
		return this.wallet.submitContractCall(request)
	}

	public readonly submitContractDeployment: provider.HotOstrichHandler['submitContractDeployment'] = async request => {
		if (this.wallet === undefined) throw new Error(`Cannot submit transactions without connecting a wallet.`)
		if (!('submitContractCall' in this.wallet)) throw new Error(`Cannot submit transactions with this type of wallet.  Are you using a view-only wallet?`)
		return this.wallet.submitContractDeployment(request)
	}

	public readonly submitNativeTokenTransfer: provider.HotOstrichHandler['submitNativeTokenTransfer'] = async request => {
		if (this.wallet === undefined) throw new Error(`Cannot transfer ETH without connecting a wallet.`)
		if (!('submitContractCall' in this.wallet)) throw new Error(`Cannot transfer ETH with this type of wallet.  Are you using a view-only wallet?`)
		return this.wallet.submitNativeTokenTransfer(request)
	}

	public readonly legacyJsonrpc: provider.HotOstrichHandler['legacyJsonrpc'] = async (method, parameters) => {
		switch (method) {
			case 'eth_gasPrice': {
				return bigintToHexString(await this.getGasPrice())
			}
			case 'eth_coinbase': {
				return this.wallet === undefined
					? null
					: bigintToHexString(this.wallet.address)
			}
			case 'eth_accounts': {
				return this.wallet === undefined
					? []
					: [bigintToHexString(this.wallet.address)]
			}
			case 'eth_estimateGas':
			case 'eth_call': {
				return this.wallet === undefined
					? (await this.jsonRpc.remoteProcedureCall({ id: 1, jsonrpc: '2.0', method: method as JsonRpcMethod, params: parameters })).result
					: await this.wallet.legacyJsonrpc(method, parameters)
			}
			case 'eth_sendTransaction':
			case 'eth_signTransaction': {
				if (this.wallet === undefined) throw new JsonRpcError(-32601, `Cannot call ${method} without choosing a wallet.`)
				else return await this.wallet.legacyJsonrpc(method, parameters)
			}
			default: {
				return (await this.jsonRpc.remoteProcedureCall({ id: 1, jsonrpc: '2.0', method: method as JsonRpcMethod, params: parameters })).result
			}
		}
	}
}
