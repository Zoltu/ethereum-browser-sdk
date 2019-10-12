import { secp256k1, mnemonic, hdWallet, ethereum, keccak256 } from '@zoltu/ethereum-crypto'
import { Bytes } from '@zoltu/ethereum-types'
import { getAddress, signTransaction } from '@zoltu/ethereum-ledger'

export interface NonSigningWallet {
	readonly ethereumAddress: bigint
}

export interface SigningWallet {
	readonly ethereumAddress: bigint
	readonly sign: (bytes: Bytes, unprefixedMessageOrChainId?: Bytes|bigint) => Promise<{ r: bigint, s: bigint, v: bigint }>
}

export type Wallet = SigningWallet | NonSigningWallet

export async function createNonSigningWallet(ethereumAddress: bigint): Promise<NonSigningWallet> {
	return { ethereumAddress }
}

export async function createLedgerWallet(): Promise<SigningWallet> {
	const ethereumAddress = await getAddress()
	const sign = async (bytes: Bytes, unprefixedMessage?: Bytes|bigint) => {
		const signature = await ((unprefixedMessage === undefined || typeof unprefixedMessage === 'bigint')
			? signTransaction(bytes)
			: signTransaction(unprefixedMessage))
		return {
			r: signature.r,
			s: signature.s,
			v: signature.v,
		}
	}
	return { ethereumAddress, sign }
}

export async function createMemoryWallet(mnemonicWords: string[]): Promise<SigningWallet> {
	const seed = await mnemonic.toSeed(mnemonicWords)
	const privateKey = await hdWallet.privateKeyFromSeed(seed)
	const publicKey = await secp256k1.privateKeyToPublicKey(privateKey)
	const ethereumAddress = await ethereum.publicKeyToAddress(publicKey)
	const sign = async (bytes: Bytes, chainId?: Bytes|bigint) => {
		const bytesToSign = await keccak256.hash(bytes)
		const signature = await secp256k1.sign(privateKey, bytesToSign)
		const recoveryParameterModifier = (chainId === undefined || typeof chainId !== 'bigint')
			? 27n
			: chainId * 2n + 35n
		return {
			r: signature.r,
			s: signature.s,
			v: BigInt(signature.recoveryParameter) + recoveryParameterModifier,
		}
	}
	return { ethereumAddress, sign }
}
