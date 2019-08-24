export function assertNever(x: never): never {
	throw new Error(`Unreachable code reached with this object: ${JSON.stringify(x)}`)
}

export function newCorrelationId(): string {
	return uuidv4()
}

// thanks internet!
export function uuidv4() {
	function base10DigitToRandomBase16Digit(character: string) {
		const number = Number.parseInt(character, 10)
		const randomValue = Math.random() * (2**8-1 - 0)
		return (number ^ randomValue & 15 >> number / 4).toString(16)
	}
	return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, base10DigitToRandomBase16Digit)
}

export function setsAreEqual<T extends ReadonlySet<any>>(left: T, right: T): boolean {
	if (left.size !== right.size) return false
	for (const item of left) {
		if (!right.has(item)) return false
	}
	return true
}
