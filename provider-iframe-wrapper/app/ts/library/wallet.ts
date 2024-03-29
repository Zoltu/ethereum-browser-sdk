import { secp256k1, mnemonic, hdWallet, ethereum, keccak256 } from '@zoltu/ethereum-crypto'
import { Bytes, JsonRpc, RawOnChainTransaction, IOffChainTransaction, RawOffChainTransaction } from '@zoltu/ethereum-types'
import { getAddress, signTransaction, signMessage } from '@zoltu/ethereum-ledger'
import { provider } from '@zoltu/ethereum-browser-sdk'
import { encodeMethod, decodeParameters, decodeMethod } from '@zoltu/ethereum-abi-encoder'
import { FetchJsonRpc } from '@zoltu/ethereum-fetch-json-rpc'
import { contractParametersToEncodables, constructorDataBytes } from './abi-stuff'
import { JsonRpcError } from './error-handler'

export class ViewingWallet {
	private readonly jsonRpc: JsonRpc
	public constructor(
		jsonRpcEndpoint: string,
		fetch: Window['fetch'],
		getGasPrice: () => Promise<bigint>,
		public readonly address: bigint,
	) {
		this.jsonRpc = new FetchJsonRpc(jsonRpcEndpoint, fetch, { gasPriceInAttoethProvider: getGasPrice, addressProvider: async () => address })
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

	public readonly legacyJsonrpc: (method: 'eth_call'|'eth_estimateGas'|'eth_sendTransaction'|'eth_signTransaction', parameters: unknown[]) => Promise<unknown> = async (method, parameters) => {
		if (method === 'eth_sendTransaction' || method === 'eth_signTransaction') throw new JsonRpcError(-32601, `${method} is not supported by this wallet.`)
		const response = await this.jsonRpc.remoteProcedureCall({ jsonrpc: '2.0', id: 1, method, params: parameters })
		return response.result
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
		this.jsonRpc = new FetchJsonRpc(jsonRpcEndpoint, fetch, { gasPriceInAttoethProvider: getGasPrice, addressProvider: async () => address, signatureProvider: this.sign })
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

	public readonly legacyJsonrpc: (method: 'eth_call'|'eth_estimateGas'|'eth_sendTransaction'|'eth_signTransaction', parameters: unknown[]) => Promise<unknown> = async (method, parameters) => {
		const transaction = parameters[0] as Partial<RawOnChainTransaction>
		switch (method) {
			case 'eth_estimateGas': {
				const result = await this.jsonRpc.estimateGas({
					from: BigInt(transaction.from || await this.jsonRpc.coinbase() || 0n),
					to: (transaction.to !== null && transaction.to !== undefined) ? BigInt(transaction.to) : null,
					value: BigInt(transaction.value || 0n),
					data: Bytes.fromHexString(transaction.data || ''),
					gasLimit: BigInt(transaction.gas || 1_000_000_000n),
					gasPrice: BigInt(transaction.gasPrice || await this.jsonRpc.getGasPrice()),
				})
				return `0x${result.toString(16)}`
			}
			case 'eth_call': {
				const result = await this.jsonRpc.offChainContractCall({
					to: (transaction.to !== null && transaction.to !== undefined) ? BigInt(transaction.to) : null,
					data: Bytes.fromHexString(transaction.data || ''),
					...(transaction.from === undefined ? {} : {from: BigInt(transaction.from)}),
					...(transaction.value === undefined ? {} : {value: BigInt(transaction.value)}),
					...(transaction.gas === undefined ? {} : {gasLimit: BigInt(transaction.gas)}),
					...(transaction.gasPrice === undefined ? {} : {gasPrice: BigInt(transaction.gasPrice)}),
				})
				return result.to0xString()
			}
			case 'eth_sendTransaction': {
				const result = await this.jsonRpc.onChainContractCall({
					to: transaction.to === null || transaction.to === undefined ? null : BigInt(transaction.to),
					data: transaction.data === undefined ? new Uint8Array(0) : Bytes.fromHexString(transaction.data),
					...(transaction.from === undefined ? {} : {from: BigInt(transaction.from)}),
					...(transaction.value === undefined ? {} : {value: BigInt(transaction.value)}),
					...(transaction.gas === undefined ? {} : {gasLimit: BigInt(transaction.gas)}),
					...(transaction.gasPrice === undefined ? {} : {gasPrice: BigInt(transaction.gasPrice)}),
				})
				return `0x${result.hash.toString(16).padStart(64, '0')}`
			}
			case 'eth_signTransaction': {
				const gasEstimatingTransaction: Required<IOffChainTransaction> = {
					from: BigInt(transaction.from || await this.jsonRpc.coinbase() || 0n),
					to: (transaction.to !== null && transaction.to !== undefined) ? BigInt(transaction.to) : null,
					value: BigInt(transaction.value || 0n),
					data: Bytes.fromHexString(transaction.data || ''),
					gasLimit: BigInt(transaction.gas || 1_000_000_000n),
					gasPrice: BigInt(transaction.gasPrice || await this.jsonRpc.getGasPrice()),
				}
				const unsignedTransaction = {
					...gasEstimatingTransaction,
					gasLimit: BigInt(transaction.gas || await this.jsonRpc.estimateGas(gasEstimatingTransaction)),
					nonce: BigInt(transaction.nonce || await this.jsonRpc.getTransactionCount(gasEstimatingTransaction.from, 'pending')),
					chainId: await this.jsonRpc.getChainId(),
				}
				const result = await this.jsonRpc.signTransaction(unsignedTransaction)
				return Bytes.fromByteArray(result.encodedTransaction).to0xString()
			}
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
		this.jsonRpc = new FetchJsonRpc(jsonRpcEndpoint, fetch, { gasPriceInAttoethProvider: getGasPrice, addressProvider: async () => address, signatureProvider: this.sign })
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

	public readonly legacyJsonrpc: (method: 'eth_call'|'eth_estimateGas'|'eth_sendTransaction'|'eth_signTransaction', parameters: unknown[]) => Promise<unknown> = async (method, parameters) => {
		const transaction = parameters[0] as Partial<RawOnChainTransaction>
		switch (method) {
			case 'eth_estimateGas': {
				const result = await this.jsonRpc.estimateGas({
					from: BigInt(transaction.from || await this.jsonRpc.coinbase() || 0n),
					to: (transaction.to !== null && transaction.to !== undefined) ? BigInt(transaction.to) : null,
					value: BigInt(transaction.value || 0n),
					data: Bytes.fromHexString(transaction.data || ''),
					gasLimit: BigInt(transaction.gas || 1_000_000_000n),
					gasPrice: BigInt(transaction.gasPrice || await this.jsonRpc.getGasPrice()),
				})
				return `0x${result.toString(16)}`
			}
			case 'eth_call': {
				const result = await this.jsonRpc.offChainContractCall({
					to: (transaction.to !== null && transaction.to !== undefined) ? BigInt(transaction.to) : null,
					data: Bytes.fromHexString(transaction.data || ''),
					...(transaction.from === undefined ? {} : {from: BigInt(transaction.from)}),
					...(transaction.value === undefined ? {} : {value: BigInt(transaction.value)}),
					...(transaction.gas === undefined ? {} : {gasLimit: BigInt(transaction.gas)}),
					...(transaction.gasPrice === undefined ? {} : {gasPrice: BigInt(transaction.gasPrice)}),
				})
				return result.to0xString()
			}
			case 'eth_sendTransaction': {
				const result = await this.jsonRpc.onChainContractCall({
					to: transaction.to === null || transaction.to === undefined ? null : BigInt(transaction.to),
					data: transaction.data === undefined ? new Uint8Array(0) : Bytes.fromHexString(transaction.data),
					...(transaction.from === undefined ? {} : {from: BigInt(transaction.from)}),
					...(transaction.value === undefined ? {} : {value: BigInt(transaction.value)}),
					...(transaction.gas === undefined ? {} : {gasLimit: BigInt(transaction.gas)}),
					...(transaction.gasPrice === undefined ? {} : {gasPrice: BigInt(transaction.gasPrice)}),
				})
				return `0x${result.hash.toString(16).padStart(64, '0')}`
			}
			case 'eth_signTransaction': {
				const gasEstimatingTransaction: Required<IOffChainTransaction> = {
					from: BigInt(transaction.from || await this.jsonRpc.coinbase() || 0n),
					to: (transaction.to !== null && transaction.to !== undefined) ? BigInt(transaction.to) : null,
					value: BigInt(transaction.value || 0n),
					data: Bytes.fromHexString(transaction.data || ''),
					gasLimit: BigInt(transaction.gas || 1_000_000_000n),
					gasPrice: BigInt(transaction.gasPrice || await this.jsonRpc.getGasPrice()),
				}
				const unsignedTransaction = {
					...gasEstimatingTransaction,
					gasLimit: BigInt(transaction.gas || await this.jsonRpc.estimateGas(gasEstimatingTransaction)),
					nonce: BigInt(transaction.nonce || await this.jsonRpc.getTransactionCount(gasEstimatingTransaction.from, 'pending')),
					chainId: await this.jsonRpc.getChainId(),
				}
				const result = await this.jsonRpc.signTransaction(unsignedTransaction)
				return Bytes.fromByteArray(result.encodedTransaction).to0xString()
			}
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

	public readonly legacyJsonrpc: (method: 'eth_call'|'eth_estimateGas'|'eth_sendTransaction'|'eth_signTransaction', parameters: unknown[]) => Promise<unknown> = async (method, parameters) => {
		if (method === 'eth_sendTransaction' || method === 'eth_signTransaction') throw new JsonRpcError(-32601, `${method} is not supported by this wallet.`)
		const originalTransaction = parameters[0] as Partial<RawOffChainTransaction>
		const originalDataBytes = Bytes.fromHexString(originalTransaction.data || '')
		const data = originalTransaction.to
			? Bytes.fromByteArray([
				// execute(address,uint256,bytes)
				...Bytes.fromUnsignedInteger(0xb61d27f6n, 32),
				// to
				...Bytes.fromUnsignedInteger(BigInt(originalTransaction.to), 256),
				// value
				...Bytes.fromUnsignedInteger(BigInt(originalTransaction.value || 0n), 256),
				// offset to data
				...Bytes.fromUnsignedInteger(96, 256),
				// length of data
				...Bytes.fromUnsignedInteger(originalDataBytes.length, 256),
				// data
				...originalDataBytes,
				// data padding
				...new Bytes(originalDataBytes.length !== 32 ? 32 - originalDataBytes.length % 32 : 0),
			])
			: Bytes.fromByteArray([
				// deploy(uint256,bytes,uint256)
				...Bytes.fromUnsignedInteger(0xf9899326n, 32),
				...Bytes.fromUnsignedInteger(BigInt(originalTransaction.value || 0n), 256),
				// offset to data
				...Bytes.fromUnsignedInteger(96, 256),
				...Bytes.fromUnsignedInteger(0n, 256),
				// length of data
				...Bytes.fromUnsignedInteger(originalDataBytes.length, 256),
				// data
				...originalDataBytes,
				// data padding
				...new Bytes(originalDataBytes.length !== 32 ? 32 - originalDataBytes.length % 32 : 0),
			])
			const to = `0x${this.address.toString(16).padStart(40, '0')}`
			const from = `0x${this.underlyingWallet.address.toString(16).padStart(40, '0')}`
			const mutatedTransaction = { ...originalTransaction, to, from, data: data.to0xString(), value: `0x0` }
			const result = await this.underlyingWallet.legacyJsonrpc(method, [mutatedTransaction])
			if (method === 'eth_call') {
				// TODO: see if we can do better with the types here so we don't have to typecast as much
				return Bytes.fromByteArray(decodeParameters([{ name: 'result', type: 'bytes' }], Bytes.fromHexString(result as string)).result as Uint8Array).to0xString()
			} else {
				return result
			}
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

	public readonly legacyJsonrpc: (method: 'eth_call'|'eth_estimateGas'|'eth_sendTransaction'|'eth_signTransaction', parameters: unknown[]) => Promise<unknown> = async (method, parameters) => {
		const originalTransaction = parameters[0] as Partial<RawOffChainTransaction>
		const originalDataBytes = Bytes.fromHexString(originalTransaction.data || '')
		const data = originalTransaction.to
			? Bytes.fromByteArray([
				// execute(address,uint256,bytes)
				...Bytes.fromUnsignedInteger(0xb61d27f6n, 32),
				// to
				...Bytes.fromUnsignedInteger(BigInt(originalTransaction.to), 256),
				// value
				...Bytes.fromUnsignedInteger(BigInt(originalTransaction.value || 0n), 256),
				// offset to data
				...Bytes.fromUnsignedInteger(96, 256),
				// length of data
				...Bytes.fromUnsignedInteger(originalDataBytes.length, 256),
				// data
				...originalDataBytes,
				// data padding
				...new Bytes(originalDataBytes.length !== 32 ? 32 - originalDataBytes.length % 32 : 0),
			])
			: Bytes.fromByteArray([
				// deploy(uint256,bytes,uint256)
				...Bytes.fromUnsignedInteger(0xf9899326n, 32),
				...Bytes.fromUnsignedInteger(BigInt(originalTransaction.value || 0n), 256),
				// offset to data
				...Bytes.fromUnsignedInteger(96, 256),
				...Bytes.fromUnsignedInteger(0n, 256),
				// length of data
				...Bytes.fromUnsignedInteger(originalDataBytes.length, 256),
				// data
				...originalDataBytes,
				// data padding
				...new Bytes(originalDataBytes.length !== 32 ? 32 - originalDataBytes.length % 32 : 0),
			])
		const to = `0x${this.address.toString(16).padStart(40, '0')}`
		const from = `0x${this.underlyingWallet.address.toString(16).padStart(40, '0')}`
		const mutatedTransaction = { ...originalTransaction, to, from, data: data.to0xString(), value: `0x0` }
		const result = await this.underlyingWallet.legacyJsonrpc(method, [mutatedTransaction])
		if (method === 'eth_call') {
			// TODO: see if we can do better with the types here so we don't have to typecast as much
			return Bytes.fromByteArray(decodeParameters([{ name: 'result', type: 'bytes' }], Bytes.fromHexString(result as string)).result as Uint8Array).to0xString()
		} else {
			return result
		}
	}
}

export class PromptingWallet {
	public constructor(
		public readonly underlyingWallet: SigningWallet,
		public readonly prompts: {
			submitContractCall?: (...parameters: Parameters<provider.HotOstrichHandler['submitContractCall']>) => Promise<boolean>
			submitContractDeployment?: (...parameters: Parameters<provider.HotOstrichHandler['submitContractDeployment']>) => Promise<boolean>
			submitNativeTokenTransfer?: (...parameters: Parameters<provider.HotOstrichHandler['submitNativeTokenTransfer']>) => Promise<boolean>
		},
	) {
		this.localContractCall = this.underlyingWallet.localContractCall
	}

	public get address(): bigint { return this.underlyingWallet.address }
	public readonly localContractCall: provider.HotOstrichHandler['localContractCall']
	public readonly submitContractCall: provider.HotOstrichHandler['submitContractCall'] = async request => {
		if (this.prompts.submitContractCall) {
			if (!await this.prompts.submitContractCall(request)) throw new Error(`User rejected.`)
		}
		return await this.underlyingWallet.submitContractCall(request)
	}
	public readonly submitContractDeployment: provider.HotOstrichHandler['submitContractDeployment'] = async request => {
		if (this.prompts.submitContractDeployment) {
			if (!await this.prompts.submitContractDeployment(request)) throw new Error(`User rejected.`)
		}
		return await this.underlyingWallet.submitContractDeployment(request)
	}
	public readonly submitNativeTokenTransfer: provider.HotOstrichHandler['submitNativeTokenTransfer'] = async request => {
		if (this.prompts.submitNativeTokenTransfer) {
			if (!await this.prompts.submitNativeTokenTransfer(request)) throw new Error(`User rejected.`)
		}
		return await this.underlyingWallet.submitNativeTokenTransfer(request)
	}
	public readonly legacyJsonrpc: (method: 'eth_call'|'eth_estimateGas'|'eth_sendTransaction'|'eth_signTransaction', parameters: unknown[]) => Promise<unknown> = async (method, parameters) => {
		function extractToAndData(transaction: object) {
			const to = 'to' in transaction
				? BigInt((transaction as {to:string}).to)
				: 0n
			const data = 'data' in transaction
				? Bytes.fromHexString((transaction as {data:string}).data)
				: new Bytes()
			return { to, data }
		}
		function isDeploy(transaction: object): transaction is { data: string, value?: string, gas?: string } {
			const {to, data} = extractToAndData(transaction)
			if (data.length === 0) return false
			// 0x7A0D94F55792C434d74a40883C6ed8545E406D12 is deterministic deployment proxy
			if (to !== 0n && to !== 0x7A0D94F55792C434d74a40883C6ed8545E406D12n) return false
			return true
		}
		function isNativeTransfer(transaction: object): transaction is { to: string, value?: string, gas?: string } {
			const {to, data} = extractToAndData(transaction)
			if (data.length !== 0) return false
			if (to === 0n) return false
			return true
		}
		function isContractCall(transaction:object): transaction is { to: string, data: string, value?: string, gas?: string } {
			const {to, data} = extractToAndData(transaction)
			if (to === 0n) return false
			if (data.length === 0) return false
			return true
		}
		async function getSignatureAndParameters(data: string) {
			const dataBytes = Bytes.fromHexString(data)
			const selectorBytes = Bytes.fromByteArray(dataBytes.slice(0, 4))
			const selectorString = selectorBytes.toString()
			const response = await fetch(`https://www.4byte.directory/api/v1/signatures/?hex_signature=${selectorString}`, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
			if (!response.ok) return {signature: `HTTP ${response.status} when trying to fetch function selector from 4byte.directory.`, parameters: []}
			const results = (await response.json())?.results as Array<{id: number, text_signature: string}> | undefined
			if (results === undefined) return {signature: `No results returned by 4byte.directory.`, parameters: []}
			if (!Array.isArray(results)) return {signature: `4byte.directory returned an unexpected shaped object.`, parameters: []}
			if (results.length === 0) return {signature: `No signatures found for ${selectorString}`, parameters: []}
			const signature = results.sort((a,b) => a.id - b.id)[0].text_signature
			const namedParameters = await decodeMethod(keccak256.hash, signature, dataBytes)
			const parameters = Object.entries(namedParameters)
				.map(([key, value]) => [ Number.parseInt(key.substring('arg'.length)), value] as const)
				.sort(([keyA], [keyB]) => keyA - keyB)
				.map(([, value]) => value)
			return {signature, parameters}
		}

		if (method === 'eth_sendTransaction' || method === 'eth_signTransaction') {
			const transaction = parameters[0]
			if (typeof transaction !== 'object') throw new Error(`Expectede an object for first parameter of ${method} but got ${typeof transaction}`)
			if (transaction === null) throw new Error(`Expected an object for first parameter of ${method} but got null.`)
			if (isDeploy(transaction) && this.prompts.submitContractDeployment) {
				const userApproved = await this.prompts.submitContractDeployment({
					constructor_signature: 'Unknown constructor',
					constructor_parameters: [],
					bytecode: Bytes.fromHexString(transaction.data),
					value: BigInt(transaction.value || 0n),
					gas_limit: transaction.gas ? BigInt(transaction.gas) : undefined,
				})
				if (!userApproved) throw new Error(`User rejected.`)
			}
			if (isNativeTransfer(transaction) && this.prompts.submitNativeTokenTransfer) {
				const userApproved = await this.prompts.submitNativeTokenTransfer({
					to: BigInt(transaction.to),
					value: BigInt(transaction.value || 0n),
					gas_limit: transaction.gas ? BigInt(transaction.gas) : undefined,
				})
				if (!userApproved) throw new Error(`User rejected.`)
			}
			if (isContractCall(transaction) && this.prompts.submitContractCall) {
				const {signature, parameters} = await getSignatureAndParameters(transaction.data)
				const userApproved = await this.prompts.submitContractCall({
					contract_address: BigInt(transaction.to),
					method_signature: signature,
					method_parameters: parameters,
					value: BigInt(transaction.value || 0n),
					gas_limit: transaction.gas ? BigInt(transaction.gas) : undefined,
					presentation_dsls: {},
				})
				if (!userApproved) throw new Error(`User rejected.`)
			}
		}
		return await this.underlyingWallet.legacyJsonrpc(method, parameters)
	}
}

export type ViewOnlyWallet = ViewingWallet | ViewingRecoverableWallet
export type SigningWallet = PromptingWallet | MnemonicWallet | LedgerWallet | RecoverableWallet
export type Wallet = ViewingWallet | MnemonicWallet | LedgerWallet | ViewingRecoverableWallet | RecoverableWallet
