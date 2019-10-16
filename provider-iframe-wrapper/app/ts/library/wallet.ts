import { secp256k1, mnemonic, hdWallet, ethereum, keccak256 } from '@zoltu/ethereum-crypto'
import { Bytes, JsonRpc } from '@zoltu/ethereum-types'
import { getAddress, signTransaction, signMessage } from '@zoltu/ethereum-ledger'
import { provider } from '@zoltu/ethereum-browser-sdk'
import { encodeMethod, decodeParameters } from '@zoltu/ethereum-abi-encoder'
import { FetchJsonRpc } from '@zoltu/ethereum-fetch-json-rpc'
import { contractParametersToEncodables, constructorDataBytes } from './abi-stuff'

export class ViewingWallet {
	private readonly jsonRpc: JsonRpc
	public constructor(
		jsonRpcEndpoint: string,
		fetch: Window['fetch'],
		getGasPrice: () => Promise<bigint>,
		public readonly address: bigint,
	) {
		this.jsonRpc = new FetchJsonRpc(jsonRpcEndpoint, fetch, getGasPrice, async () => address)
	}

	public readonly localContractCall: provider.HotOstrichHandler['localContractCall'] = async request => {
		const from = this.address
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
}

export class MnemonicWallet {
	private readonly jsonRpc: JsonRpc
	private constructor(
		jsonRpcEndpoint: string,
		fetch: ConstructorParameters<typeof FetchJsonRpc>[1],
		getGasPrice: () => Promise<bigint>,
		public readonly address: bigint,
		private readonly privateKey: bigint,
	) {
		this.jsonRpc = new FetchJsonRpc(jsonRpcEndpoint, fetch, getGasPrice, async () => address, this.sign)
	}
	public static async create(jsonRpcEndpoint: string, fetch: Window['fetch'], getGasPrice: () => Promise<bigint>, mnemonicWords: string[]): Promise<MnemonicWallet> {
		const seed = await mnemonic.toSeed(mnemonicWords)
		const privateKey = await hdWallet.privateKeyFromSeed(seed)
		const publicKey = await secp256k1.privateKeyToPublicKey(privateKey)
		const address = await ethereum.publicKeyToAddress(publicKey)
		return new MnemonicWallet(jsonRpcEndpoint, fetch, getGasPrice, address, privateKey)
	}

	public readonly localContractCall: provider.HotOstrichHandler['localContractCall'] = async request => {
		const from = this.address
		const to = request.contract_address
		const value = request.value
		const gasPrice = request.gas_price
		const gasLimit = request.gas_limit
		const parameters = contractParametersToEncodables(request.method_parameters)
		const data = await encodeMethod(keccak256.hash, request.method_signature, parameters)
		return await this.jsonRpc.offChainContractCall({ from, to, value, gasPrice, gasLimit, data })
	}

	public readonly signMessage: provider.HotOstrichHandler['signMessage'] = async message => {
		const bytesToHash = ethereum.mutateMessageForSigning(message)
		const stringToHash = new TextDecoder().decode(bytesToHash)
		const bytesToSign = await keccak256.hash(bytesToHash)
		const signature = await secp256k1.sign(this.privateKey, bytesToSign)
		const v = BigInt(signature.recoveryParameter) + 27n as 27n | 28n
		return {
			requested_message: message,
			signed_message: stringToHash,
			signed_bytes: bytesToSign,
			signature: { r: signature.r, s: signature.s, v }
		}
	}

	public readonly submitContractCall: provider.HotOstrichHandler['submitContractCall'] = async request => {
		const parameters = contractParametersToEncodables(request.method_parameters)
		const data = await encodeMethod(keccak256.hash, request.method_signature, parameters)
		const receipt = await this.jsonRpc.onChainContractCall({
			to: request.contract_address,
			data: data,
		})
		receipt // TODO: utilize
		// TODO: return the transaction receipt (or maybe even the transaction hash) and deal with confidence stuff at a higher layer
		return {
			confidence: 0.5,
			update_channel_name: `contract call status - ${receipt.hash}`
		}
	}

	public readonly submitContractDeployment: provider.HotOstrichHandler['submitContractDeployment'] = async request => {
		const parameters = contractParametersToEncodables(request.constructor_parameters)
		const deploymentBytecode = await constructorDataBytes(request.constructor_signature, parameters, request.bytecode)
		const receipt = await this.jsonRpc.deployContract(deploymentBytecode, request.value)
		// TODO: we need transaction hash so we can monitor progress
		return {
			confidence: 50,
			update_channel_name: `contract deployment status - ${receipt}`
		}
	}

	public readonly submitNativeTokenTransfer: provider.HotOstrichHandler['submitNativeTokenTransfer'] = async request => {
		const receipt = await this.jsonRpc.sendEth(request.to, request.value)
		return {
			confidence: 1,
			update_channel_name: `native token transfer status - ${receipt.hash}`
		}
	}

	private readonly sign = async (bytes: Uint8Array) => {
		const bytesToSign = await keccak256.hash(bytes)
		const signature = await secp256k1.sign(this.privateKey, bytesToSign)
		return {
			r: signature.r,
			s: signature.s,
			yParity: signature.recoveryParameter === 0 ? 'even' as const : 'odd' as const,
		}
	}
}

export class LedgerWallet {
	private readonly jsonRpc: JsonRpc
	private constructor(
		jsonRpcEndpoint: string,
		fetch: ConstructorParameters<typeof FetchJsonRpc>[1],
		getGasPrice: () => Promise<bigint>,
		public readonly address: bigint,
	) {
		this.jsonRpc = new FetchJsonRpc(jsonRpcEndpoint, fetch, getGasPrice, async () => address, this.sign)
	}
	public static async create(jsonRpcEndpoint: string, fetch: Window['fetch'], getGasPrice: () => Promise<bigint>): Promise<LedgerWallet> {
		const address = await getAddress()
		return new LedgerWallet(jsonRpcEndpoint, fetch, getGasPrice, address)
	}

	public readonly localContractCall: provider.HotOstrichHandler['localContractCall'] = async request => {
		const from = this.address
		const to = request.contract_address
		const value = request.value
		const gasPrice = request.gas_price
		const gasLimit = request.gas_limit
		const parameters = contractParametersToEncodables(request.method_parameters)
		const data = await encodeMethod(keccak256.hash, request.method_signature, parameters)
		return await this.jsonRpc.offChainContractCall({ from, to, value, gasPrice, gasLimit, data })
	}

	public readonly signMessage: provider.HotOstrichHandler['signMessage'] = async message => {
		const bytesToHash = ethereum.mutateMessageForSigning(message)
		const stringToHash = new TextDecoder().decode(bytesToHash)
		const bytesToSign = await keccak256.hash(bytesToHash)
		const signature = await signMessage(message)
		if (signature.v !== 27n && signature.v !== 28n) throw new Error(`Ledger returned a signature with a 'v' value of ${signature.v}.  The only valid values for 'v' are 27 or 28.`)
		return {
			requested_message: message,
			signed_message: stringToHash,
			signed_bytes: bytesToSign,
			signature: { r: signature.r, s: signature.s, v: signature.v as 27n | 28n }
		}
	}

	public readonly submitContractCall: provider.HotOstrichHandler['submitContractCall'] = async request => {
		const parameters = contractParametersToEncodables(request.method_parameters)
		const data = await encodeMethod(keccak256.hash, request.method_signature, parameters)
		const receipt = await this.jsonRpc.onChainContractCall({
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
		const parameters = contractParametersToEncodables(request.constructor_parameters)
		const deploymentBytecode = await constructorDataBytes(request.constructor_signature, parameters, request.bytecode)
		const receipt = await this.jsonRpc.deployContract(deploymentBytecode, request.value)
		// TODO: we need transaction hash so we can monitor progress
		return {
			confidence: 50,
			update_channel_name: `contract deployment status - ${receipt}`
		}
	}

	public readonly submitNativeTokenTransfer: provider.HotOstrichHandler['submitNativeTokenTransfer'] = async request => {
		const receipt = await this.jsonRpc.sendEth(request.to, request.value)
		return {
			confidence: 1,
			update_channel_name: `native token transfer status - ${receipt.hash}`
		}
	}

	public readonly sign = async (bytes: Bytes, unprefixedMessage?: string) => {
		const signature = await ((unprefixedMessage === undefined || typeof unprefixedMessage === 'bigint')
			? signTransaction(bytes)
			: signMessage(unprefixedMessage))
		const yParity = signature.v % 2n ? 'even' as const : 'odd' as const
		return {
			r: signature.r,
			s: signature.s,
			yParity,
		}
	}
}

export class ViewingRecoverableWallet {
	public constructor(
		public readonly underlyingWallet: ViewOnlyWallet,
		public readonly address: bigint,
	) { }

	public readonly localContractCall: provider.HotOstrichHandler['localContractCall'] = async request => {
		const parameters = contractParametersToEncodables(request.method_parameters)
		const calldata = await encodeMethod(keccak256.hash, request.method_signature, parameters)
		const mutatedRequest = {
			contract_address: this.address,
			method_signature: 'execute(address _to, uint256 _value, bytes _data)',
			method_parameters: [request.contract_address, request.value, calldata],
			value: 0n,
			gas_price: request.gas_price,
			gas_limit: request.gas_limit,
			caller: request.caller,
		}
		const encodedResult = await this.underlyingWallet.localContractCall(mutatedRequest)
		return decodeParameters([{ name: 'result', type: 'bytes' }], encodedResult).result as Uint8Array
	}
}

export class RecoverableWallet {
	public constructor(
		public readonly underlyingWallet: SigningWallet,
		public readonly address: bigint,
	) { }

	public readonly localContractCall: provider.HotOstrichHandler['localContractCall'] = async request => {
		const parameters = contractParametersToEncodables(request.method_parameters)
		const calldata = await encodeMethod(keccak256.hash, request.method_signature, parameters)
		const mutatedRequest = {
			contract_address: this.address,
			method_signature: 'execute(address _to, uint256 _value, bytes _data)',
			method_parameters: [request.contract_address, request.value, calldata],
			value: 0n,
			gas_price: request.gas_price,
			gas_limit: request.gas_limit,
			caller: request.caller,
		}
		const encodedResult = await this.underlyingWallet.localContractCall(mutatedRequest)
		return decodeParameters([{ name: 'result', type: 'bytes' }], encodedResult).result as Uint8Array
	}

	public readonly submitContractCall: provider.HotOstrichHandler['submitContractCall'] = async request => {
		const parameters = contractParametersToEncodables(request.method_parameters)
		const calldata = await encodeMethod(keccak256.hash, request.method_signature, parameters)
		const mutatedRequest = {
			contract_address: this.address,
			method_signature: 'execute(address _to, uint256 _value, bytes _data)',
			method_parameters: [request.contract_address, request.value, calldata],
			value: 0n,
			nonce: request.nonce,
			gas_price: request.gas_price,
			gas_limit: request.gas_limit,
			chain_id: request.chain_id,
			// TODO: hard problem: figure out how to do presentation DSLs here,
			presentation_dsls: {},
		}
		return this.underlyingWallet.submitContractCall(mutatedRequest)
	}

	public readonly submitContractDeployment: provider.HotOstrichHandler['submitContractDeployment'] = async request => {
		const parameters = contractParametersToEncodables(request.constructor_parameters)
		const deploymentBytecode = await constructorDataBytes(request.constructor_signature, parameters, request.bytecode)
		const mutatedRequest = {
			contract_address: this.address,
			method_signature: 'deploy(uint256 _value, bytes _data, uint256 _salt)',
			method_parameters: [request.value, deploymentBytecode, 0n],
			value: 0n,
			nonce: request.nonce,
			gas_price: request.gas_price,
			gas_limit: request.gas_limit,
			chain_id: request.chain_id,
			// TODO: RecoverableWallet.deployPresentationDsl or something,
			presentation_dsls: {},
		}
		return this.underlyingWallet.submitContractCall(mutatedRequest)
	}

	public readonly submitNativeTokenTransfer: provider.HotOstrichHandler['submitNativeTokenTransfer'] = async request => {
		const mutatedRequest = {
			contract_address: this.address,
			method_signature: 'execute(address _to, uint256 _value, bytes _data)',
			method_parameters: [request.to, request.value, new Uint8Array()],
			value: 0n,
			nonce: request.nonce,
			gas_price: request.gas_price,
			gas_limit: request.gas_limit,
			chain_id: request.chain_id,
			// TODO: hard problem: figure out how to do presentation DSLs here,
			presentation_dsls: {},
		}
		return this.underlyingWallet.submitContractCall(mutatedRequest)
	}
}

export type ViewOnlyWallet = ViewingWallet | ViewingRecoverableWallet
export type SigningWallet = MnemonicWallet | LedgerWallet | RecoverableWallet
export type Wallet = ViewingWallet | MnemonicWallet | LedgerWallet | ViewingRecoverableWallet | RecoverableWallet
