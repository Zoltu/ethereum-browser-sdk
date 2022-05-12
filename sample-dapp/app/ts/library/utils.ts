export function decimalStringToBigint(valueString: string, power: bigint): bigint | undefined {
	if (!/^\d+(?:\.\d+)?$/.test(valueString)) return undefined
	const splitValueString = valueString.split('.')
	const integerPartString = splitValueString[0] + '0'.repeat(Number(power))
	const fractionalPartString = ((splitValueString.length === 2) ? splitValueString[1] : '0').slice(0, Number(power)).padEnd(Number(power), '0')
	return BigInt(integerPartString) + BigInt(fractionalPartString)
}

export function bigintEthToDecimalString(value: bigint): string {
	return bigintToDecimalString(value, 18n)
}

export function bigintToDecimalString(value: bigint, power: bigint): string {
	const integerPart = value / 10n**power
	const fractionalPart = value % 10n**power
	if (fractionalPart === 0n) {
		return integerPart.toString(10)
	} else {
		return `${integerPart.toString(10)}.${fractionalPart.toString(10).padStart(Number(power), '0')}`
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
