export class ErrorHandler {
	// TODO: surface the error in the UI somewhere, perhaps an error toast
	public readonly noticeError = (error: any) => {
		if (error instanceof Error) {
			console.error(error)
		} else if (typeof error === 'string') {
			console.error(error)
		} else {
			console.error(error)
		}
	}

	public readonly asyncWrapper = <R, P extends any[]>(asyncFunction: (...args: P) => Promise<R>): (...args: P) => void => {
		return (...args: P) => asyncFunction(...args).catch(this.noticeError)
	}
}

export class JsonRpcError extends Error {
	constructor(public readonly code: number, message: string, public readonly data?: object) {
		super(message)
		this.name = this.constructor.name
	}
}
