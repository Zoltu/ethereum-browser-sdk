export function createOnChangeProxy<T extends object>(onChange: () => void, target: T): T {
	for (const key in target) {
		const item = target[key]
		if (!isMutableObject(item)) continue
		target[key] = createOnChangeProxy(onChange, item)
	}
	return new Proxy<T>(target, createProxyHandler(onChange))
}

function createProxyHandler<T extends object>(onChange: () => void): ProxyHandler<T> {
	return {
		set: (object, property, newValue): boolean => {
			(object as any)[property] = (typeof newValue === 'object' ? createOnChangeProxy(onChange, newValue) : newValue)
			onChange()
			return true
		}
	}
}

function isMutableObject(maybe: any): maybe is object {
	if (maybe === null) return false
	if (maybe instanceof Date) return false
	// treat Uint8Arrays as immutable, even though they technically aren't, because we use them a lot and we treat them as immutable
	if (maybe instanceof Uint8Array) return false
	// TODO: filter out any other special cases we can find, where something identifies as an `object` but is effectively immutable
	return typeof maybe === 'object'
}
