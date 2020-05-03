/**
 * this script executed within the context of the active tab when the user clicks to inject the legacy provider into the page
 * this script adds a script tag to the page which references the injected script, which is then executed within the context of the page
*/

if (!(window as any).legacyEthereumInjected) {
	(window as any).legacyEthereumInjected = true

	// inject a script that converts `ethereum.send` calls to events
	const scriptTag = document.createElement('script')
	scriptTag.setAttribute('type', 'module')
	scriptTag.setAttribute('src', browser.runtime.getURL('js/injected.js'))

	const headOrRoot = document.head || document.documentElement
	headOrRoot.insertBefore(scriptTag, headOrRoot.children[0])
	headOrRoot.removeChild(scriptTag)

	const iframes = document.querySelectorAll('iframe')
	iframes.forEach(iframe => {
		const iframeHead = iframe.querySelector('head')
		const injectionTarget = (iframeHead !== null) ? iframeHead : iframe
		injectionTarget.insertBefore(scriptTag, injectionTarget.children[0])
		injectionTarget.removeChild(scriptTag)
	})

	console.log('legacy ethereum provider script has been injected')
}
