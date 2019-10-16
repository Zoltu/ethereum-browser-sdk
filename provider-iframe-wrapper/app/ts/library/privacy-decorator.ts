const typeToNoProxyKeys = new WeakMap<object, Set<string|number|symbol>>();

export const NoProxy = () => (target: object, propertyName: string|number|symbol) => {
	if (!typeToNoProxyKeys.has(target.constructor)) typeToNoProxyKeys.set(target.constructor.prototype, new Set<string>())
	const privateKeys = typeToNoProxyKeys.get(target.constructor.prototype)!
	privateKeys.add(propertyName)
}

const getPrototypeChain = (instance: object): object[] => {
	const prototypes = [instance.constructor.prototype as object];

	while (true) {
		const prototype = Object.getPrototypeOf(instance.constructor.prototype as object | null) as object
		if (prototype === null) break
		if (prototypes.indexOf(prototype) !== -1) break
		prototypes.unshift(prototype)
	}

	return prototypes
}

export const isNoProxy = (instance: any, propertyName: string|number|symbol): boolean => {
	const prototypes = getPrototypeChain(instance)
	for (const prototype of prototypes) {
		const privateKeys = typeToNoProxyKeys.get(prototype)
		if (privateKeys === undefined) continue
		if (privateKeys.has(propertyName)) return true
	}
	return false
}
