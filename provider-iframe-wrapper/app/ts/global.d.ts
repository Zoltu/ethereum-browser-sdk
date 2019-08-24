declare namespace global {
	interface ArrayConstructor {
		isArray(arg: ReadonlyArray<any> | any): arg is ReadonlyArray<any>
	}
}
