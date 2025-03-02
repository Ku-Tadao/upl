import { Once } from "src/utils/once"

type ObserverCallback = (element: Element) => void
type Entry = { selector: string, callback: ObserverCallback }

let _observer: MutationObserver | undefined
const _initOnce = new Once(init)
const _entriesCreation: Entry[] = []
const _entriesDeletion: Entry[] = []
const _observedIframes = new Set<HTMLIFrameElement>()

// Riot sometimes overrides 'matches' method...
function matches(element: Element, selector: string) {
  return Element.prototype.matches.call(element, selector)
}

function observeIframeContent(iframe: HTMLIFrameElement): void {
  // Don't observe the same iframe twice
  if (_observedIframes.has(iframe)) {
    return
  }

  // Mark this iframe as observed
  _observedIframes.add(iframe)

  const setupObserver = () => {
    try {
      // Access might be restricted due to same-origin policy
      const iframeDocument = iframe.contentDocument
      if (iframeDocument && _observer) {
        _observer.observe(iframeDocument, {
          attributes: false,
          childList: true,
          subtree: true
        })

        // Process any existing content in the iframe
        for (const child of iframeDocument.body.children) {
          observeHandleElement(child as Element, true)
        }
      }
    } catch (e) {
      console.warn('UPL: Failed to observe iframe content due to security restrictions', e)
    }
  }

  // If the iframe is already loaded
  if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
    setupObserver()
  } else {
    // Otherwise wait for it to load
    iframe.addEventListener('load', setupObserver)
  }
}

function cleanupIframeReference(iframe: HTMLIFrameElement): void {
  _observedIframes.delete(iframe)
}

function observeHandleElement(element: Element, isNew: boolean) {
  if (isNew) {
    for (const entry of _entriesCreation) {
      if (matches(element, entry.selector)) {
        entry.callback(element)
      }
    }
  } else {
    for (const entry of _entriesDeletion) {
      if (matches(element, entry.selector)) {
        entry.callback(element)
      }
    }
  }

  // Handle iframes
  if (element.tagName === 'IFRAME') {
    if (isNew) {
      observeIframeContent(element as HTMLIFrameElement)
    } else {
      cleanupIframeReference(element as HTMLIFrameElement)
    }
  }

  for (const child of element.children) {
    observeHandleElement(child, isNew)
  }

  if (element.shadowRoot != null) {
    for (const child of element.shadowRoot.children) {
      observeHandleElement(child, isNew)
    }
    if (isNew) {
      _observer!.observe(element.shadowRoot, {
        attributes: false,
        childList: true,
        subtree: true
      })
    }
  }
}

function observerCallback(mutationsList: MutationRecord[]) {
  for (const mutation of mutationsList) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        observeHandleElement((node as Element), true)
      }
    }
    for (const node of mutation.removedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        observeHandleElement((node as Element), false)
      }
    }
  }
}

function init() {
  _observer = new MutationObserver(observerCallback)
  _observer!.observe(document, {
    attributes: false,
    childList: true,
    subtree: true
  })
}

/**
 * Subscribe to element creation.
 * @param selector [CSS Selector]{@link https://www.w3schools.com/jsref/met_document_queryselector.asp}.
 * @param callback Fired when element matching {@link selector} is created.
 */
export function subscribeToElementCreation(selector: string, callback: ObserverCallback) {
  _initOnce.trigger()
  _entriesCreation.push({ selector: selector, callback: callback })
}

/**
 * Exactly like {@link subscribeToElementCreation} except {@link callback} is called when
 * element is deleted.
 */
export function subscribeToElementDeletion(selector: string, callback: ObserverCallback) {
  _initOnce.trigger()
  _entriesDeletion.push({ selector: selector, callback: callback })
}

// load callback
let loadCallbacks: (() => void)[] = []
let loadInitialized: boolean = false
let loadedOnce: boolean = false

/**
 * Subscribe to load.
 * @param callback Fired when League's loading screen fades away.
 */
export function subscribeToLoad(callback: () => void) {
  if (!loadInitialized) {
    loadInitialized = true
    subscribeToElementDeletion('.lol-loading-screen-container', () => {
      if (loadedOnce) {
        return
      }
      loadedOnce = true
      for (let callback of loadCallbacks) {
        callback()
      }
    })
  }
  loadCallbacks.push(callback)
}