import { JsonRpc, Bytes } from '@zoltu/ethereum-types'
import { provider } from '@zoltu/ethereum-browser-sdk'
import { ethereum, keccak256 } from '@zoltu/ethereum-crypto'
import { FetchJsonRpc } from '@zoltu/ethereum-fetch-json-rpc'
import { ErrorHandler } from './error-handler'
import { SigningWallet, NonSigningWallet } from './wallet'
import { contractParametersToEncodables, constructorDataBytes } from './abi-stuff'
import { encodeMethod } from '@zoltu/ethereum-abi-encoder'

const JSON_RPC_ADDRESS = 'https://parity.zoltu.io/'

export class HotOstrichChannel implements provider.HotOstrichHandler {
	private readonly hotOstrichChannel: provider.HotOstrichChannel
	public constructor(
		private readonly errorHandler: ErrorHandler,
		private readonly window: Window,
		childWindow: Window,
	) {
		// CONSIDER: this is a bit sketchy, if the channel constructor makes any calls to the the handler during construction they will fail because we aren't done constructing this yet
		this.hotOstrichChannel = new provider.HotOstrichChannel(window, childWindow, 'my-iframe-provider', this)
		this.hotOstrichChannel.updateCapabilities({ 'call': true, 'submit': true })
	}

	public readonly shutdown = () => this.hotOstrichChannel.shutdown()

	private wallet?: SigningWallet | NonSigningWallet = undefined
	public readonly updateWallet = (wallet: SigningWallet | NonSigningWallet | undefined) => {
		this.wallet = wallet
		this.hotOstrichChannel.walletAddress = (this.wallet === undefined) ? undefined : this.wallet.ethereumAddress
		this.hotOstrichChannel.updateCapabilities({'sign': (this.wallet !== undefined && 'sign' in this.wallet)})
		this.jsonRpc = this.createJsonRpc()
	}

	private readonly createJsonRpc = () => {
		const getGasPrice = async () => 2n*10n**9n
		const wallet = this.wallet
		const getSignerAddress = (wallet === undefined) ? undefined : async () => wallet.ethereumAddress
		const signer = (wallet === undefined) || !('sign' in wallet) ? undefined : wallet.sign
		return new FetchJsonRpc(JSON_RPC_ADDRESS, this.window.fetch.bind(this.window), getGasPrice, getSignerAddress, signer)
	}
	private jsonRpc: JsonRpc = this.createJsonRpc()

	public readonly onError: provider.HotOstrichHandler['onError'] = error => {
		this.errorHandler.noticeError(error)
	}

	public readonly getBalance: provider.HotOstrichHandler['getBalance'] = async address => {
		return await this.jsonRpc.getBalance(address)
	}

	public readonly localContractCall: provider.HotOstrichHandler['localContractCall'] = async request => {
		const from = (this.wallet || {}).ethereumAddress || 0n
		const parameters = contractParametersToEncodables(request.method_parameters)
		const data = await encodeMethod(keccak256.hash, request.method_signature, parameters)
		return await this.jsonRpc.offChainContractCall({
			from: from,
			to: request.contract_address,
			value: request.value,
			gasPrice: request.gas_price,
			gasLimit: request.gas_limit,
			data: data,
		})
	}

	public readonly signMessage: provider.HotOstrichHandler['signMessage'] = async message => {
		const wallet = this.wallet
		if (wallet === undefined || !('sign' in wallet)) throw new Error(`Cannot sign a message without a signing wallet.`)
		const bytesToHash = Bytes.fromByteArray(ethereum.mutateMessageForSigning(message))
		const stringToHash = new TextDecoder().decode(bytesToHash)
		const bytesToSign = await keccak256.hash(bytesToHash)
		const signature = await wallet.sign(bytesToHash, Bytes.fromStringLiteral(message))
		if (signature.v !== 27n && signature.v !== 28n) throw new Error(`Message signature contained an invalid 'v' (${signature.v}), verify signing tool is correctly signing messages.`)
		return {
			requested_message: message,
			signed_message: stringToHash,
			signed_bytes: bytesToSign,
			signature: {
				r: signature.r,
				s: signature.s,
				v: signature.v,
			}
		}
	}

	public readonly submitContractCall: provider.HotOstrichHandler['submitContractCall'] = async request => {
		const jsonRpc = this.jsonRpc
		if (this.wallet === undefined) throw new Error(`Cannot submit a contract call without a wallet.`)

		const parameters = contractParametersToEncodables(request.method_parameters)
		const data = await encodeMethod(keccak256.hash, request.method_signature, parameters)
		const receipt = await jsonRpc.onChainContractCall({
			to: request.contract_address,
			data: data,
		})
		receipt // TODO: utilize
		return {
			confidence: 0.5,
			update_channel_name: `contract call status - ${receipt.hash}`
		}
	}

	public readonly submitContractDeployment: provider.HotOstrichHandler['submitContractDeployment'] = async request => {
		const jsonRpc = this.jsonRpc
		if (this.wallet === undefined) throw new Error(`Cannot deploy a contract without a wallet.`)

		const parameters = contractParametersToEncodables(request.constructor_parameters)
		const deploymentBytecode = await constructorDataBytes(request.constructor_signature, parameters, request.bytecode)
		const receipt = await jsonRpc.deployContract(deploymentBytecode, request.value)
		// TODO: we need transaction hash so we can monitor progress
		return {
			confidence: 50,
			update_channel_name: `contract deployment status - ${receipt}`
		}
	}

	public readonly submitNativeTokenTransfer: provider.HotOstrichHandler['submitNativeTokenTransfer'] = async request => {
		const jsonRpc = this.jsonRpc
		if (this.wallet === undefined) throw new Error(`Cannot execute a native token transfer without a wallet.`)

		const receipt = await jsonRpc.sendEth(request.to, request.value)
		return {
			confidence: 1,
			update_channel_name: `native token transfer status - ${receipt.hash}`
		}
	}
}
