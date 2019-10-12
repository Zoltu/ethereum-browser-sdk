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
		return `${integerPart.toString(10)}.${fractionalPart.toString(10).padStart(18, '0')}`
	}
}

export function hexStringToBigint(valueString: string): bigint | undefined {
	if (!/(?:0x)?[a-zA-Z0-9]{40}/.test(valueString)) return undefined
	const prefix = (valueString.startsWith('0x')) ? '' : '0x'
	return BigInt(`${prefix}${valueString}`)
}

export function uint8ArrayToUnsignedBigint(uint8Array: Iterable<number>): bigint {
	let value = 0n
	for (let byte of uint8Array) {
		value = (value << 8n) + BigInt(byte)
	}
	return value
}
