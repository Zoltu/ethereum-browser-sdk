import { secp256k1, mnemonic, hdWallet, ethereum } from '@zoltu/ethereum-crypto'
import { Address } from '@zoltu/ethereum-types'

export interface NonSigningWallet {
	readonly ethereumAddress: Address
}

export interface SigningWallet {
	readonly mnemonicWords: string[]
	readonly seed: bigint
	readonly privateKey: bigint
	readonly publicKey: secp256k1.JacobianPoint & secp256k1.AffinePoint
	readonly ethereumAddress: Address
}

export type Wallet = SigningWallet | NonSigningWallet

export async function createNonSigningWallet(ethereumAddress: Address): Promise<NonSigningWallet> {
	return { ethereumAddress }
}

export async function createSigningWallet(mnemonicWords: string[]): Promise<SigningWallet> {
	const seed = await mnemonic.toSeed(mnemonicWords)
	const privateKey = await hdWallet.privateKeyFromSeed(seed)
	const publicKey = await secp256k1.privateKeyToPublicKey(privateKey)
	const ethereumAddress = Address.fromByteArray(await ethereum.publicKeyToAddress(publicKey))
	return { mnemonicWords, seed, privateKey, publicKey, ethereumAddress }
}
