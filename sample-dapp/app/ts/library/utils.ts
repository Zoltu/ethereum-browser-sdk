import { Address } from '@zoltu/ethereum-types'

export function decimalStringToBigintEth(valueString: string): bigint | undefined {
	if (!/^\d+(?:\.\d+)?$/.test(valueString)) return undefined
	const splitValueString = valueString.split('.')
	const integerPartString = splitValueString[0] + '000000000000000000'
	const fractionalPartString = ((splitValueString.length === 2) ? splitValueString[1] : '0').slice(0, 18).padEnd(18, '0')
	return BigInt(integerPartString) + BigInt(fractionalPartString)
}

export function bigintEthToDecimalString(value: bigint): string {
	const integerPart = value / 10n**18n
	const fractionalPart = value % 10n**18n
	if (fractionalPart === 0n) {
		return integerPart.toString(10)
	} else {
		return `${integerPart}.${fractionalPart}`
	}
}

export function addressStringToAddress(valueString: string): Address | undefined {
	if (!/(?:0x)?[a-zA-Z0-9]{40}/.test(valueString)) return undefined
	return Address.fromHexString(valueString)
}

export function maybeToAddress(value: Uint8Array&{length:20} | undefined) {
	if (value === undefined) return undefined
	else return Address.fromByteArray(value)
}
