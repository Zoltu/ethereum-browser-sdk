export interface IFrameModel {
	readonly childWindowChanged: (window: Window|null) => void
	readonly dappAddress: string|undefined
}
export const IFrame = (model: IFrameModel) => {
	const onChange = React.useCallback((node: HTMLIFrameElement|null) => { if (node !== null) model.childWindowChanged(node.contentWindow) }, [])
	return <iframe
		id='child-iframe'
		ref={onChange}
		sandbox='allow-forms allow-modals allow-orientation-lock allow-pointer-lock allow-popups allow-presentation allow-scripts allow-same-origin'
		src={model.dappAddress || 'about:blank'}
		style={{display: model.dappAddress === undefined ? 'none' : ''}}
	/>
}
