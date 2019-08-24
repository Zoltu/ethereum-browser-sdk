import { ethereum as ethereumCrypto } from '@zoltu/ethereum-crypto'
import { shared } from '@zoltu/ethereum-browser-sdk'
import { Encodable, EncodableTuple, MethodSignatureHash, BytesLike } from '@zoltu/ethereum-types'
import { parseSignature, generateSignature, encodeParameters } from '@zoltu/ethereum-abi-encoder'

// https://github.com/Microsoft/TypeScript/issues/17002
declare global {
	interface ArrayConstructor {
		isArray(arg: ReadonlyArray<any> | any): arg is ReadonlyArray<any>
	}
}

export async function constructorDataBytes(constructorSignature: string, constructorParameters: ReadonlyArray<Encodable>, deploymentBytecode: Iterable<number>): Promise<BytesLike> {
	const parsedSignature = parseSignature(constructorSignature)
	const encodedParameters = encodeParameters(parsedSignature.inputs, constructorParameters)
	return [...deploymentBytecode, ...encodedParameters]
}

export async function toDataBytes(methodSignature: string, parameters: ReadonlyArray<Encodable>): Promise<BytesLike> {
	const parsedSignature = parseSignature(methodSignature)
	const canonicalSignature = generateSignature(parsedSignature)
	const signatureHashBytes = MethodSignatureHash.fromUnsignedInteger(await ethereumCrypto.functionSignatureToSelector(canonicalSignature))
	const encodedParameters = encodeParameters(parsedSignature.inputs, parameters)
	return [...signatureHashBytes, ...encodedParameters]
}

export function contractParametersToEncodables(contractParameters: shared.ContractParameterArray): ReadonlyArray<Encodable> {
	return contractParameters.map(contractParameterToEncodable)
}

function contractParameterToEncodable(contractParameter: shared.ContractParameter): Encodable {
	if (Array.isArray(contractParameter)) {
		return contractParametersToEncodables(contractParameter)
	} else if (typeof contractParameter === 'object' && !(contractParameter instanceof Uint8Array) && !Array.isArray(contractParameter)) {
		let encodableTuple: EncodableTuple = {}
		for (const propertyKey in contractParameter) {
			encodableTuple[propertyKey] = contractParameterToEncodable(contractParameter[propertyKey])
		}
		return encodableTuple
	} else if (typeof contractParameter === 'number') {
		return BigInt(contractParameter)
	} else {
		return contractParameter
	}
}
