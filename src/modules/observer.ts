import { Once } from "src/utils/once"

type ObserverCallback = (element: Element) => void

type Entry = {
    selector: string,
    callback: ObserverCallback
}

let _observer: MutationObserver | undefined
const _initOnce = new Once(init)
const _entriesCreation: Entry[] = []
const _entriesDeletion: Entry[] = []

// Because Riot sometimes overrides 'matches' method...
function matches(element: Element, selector: string) {
    return Element.prototype.matches.call(element, selector)
}

// Track observed iframes to avoid duplicate observers.
const observedIframes = new WeakSet<HTMLIFrameElement>()

function observeIFrame(iframe: HTMLIFrameElement) {
    try {
        if (iframe.contentDocument) {
            const iframeObserver = new MutationObserver(observerCallback)
            iframeObserver.observe(iframe.contentDocument, {
                attributes: false,
                childList: true,
                subtree: true
            })
        }
    } catch (error) {
        console.error("Error observing iframe:", iframe, error)
    }
}


function observerHandleElement(element: Element, isNew: boolean) {
    // If the element is a local iframe, attach an observer and exit.
    if (element instanceof HTMLIFrameElement) {
        if (!observedIframes.has(element)) {
            observedIframes.add(element)
            if (element.contentDocument) {
                observeIFrame(element)
            } else {
                // If not loaded yet, attach a load listener.
                element.addEventListener("load", () => {
                    observeIFrame(element)
                })
            }
        }
        return // Do not process fallback children inside the iframe.
    }

    if (isNew) {
        for (const entry of _entriesCreation) {
            try {
                if (matches(element, entry.selector)) {
                    entry.callback(element)
                }
            } catch (error) {
                console.error("Error in creation callback for element:", element, error)
            }
        }
    } else {
        for (const entry of _entriesDeletion) {
            try {
                if (matches(element, entry.selector)) {
                    entry.callback(element)
                }
            } catch (error) {
                console.error("Error in deletion callback for element:", element, error)
            }
        }
    }

    // Safely iterate over the element's children.
    try {
        for (const child of element.children) {
            observerHandleElement(child, isNew)
        }
    } catch (error) {
        console.error("Error iterating element.children for:", element, error)
    }

    // If the element has a shadow DOM, process its children and attach an observer.
    if (element.shadowRoot != null) {
        try {
            for (const child of element.shadowRoot.children) {
                observerHandleElement(child, isNew)
            }
        } catch (error) {
            console.error("Error iterating element.shadowRoot.children for:", element, error)
        }

        if (isNew && _observer) {
            try {
                _observer.observe(element.shadowRoot, { attributes: false, childList: true, subtree: true })
            } catch (error) {
                console.error("Error observing shadowRoot for element:", element, error)
            }
        }
    }
}

function observerCallback(mutationsList: MutationRecord[]) {
    for (const mutation of mutationsList) {
        for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                observerHandleElement((node as Element), true)
            }
        }

        for (const node of mutation.removedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                observerHandleElement((node as Element), false)
            }
        }
    }
}

function init() {
    _observer = new MutationObserver(observerCallback)
    _observer!.observe(document, { attributes: false, childList: true, subtree: true })

    // Observe any already-present iframes.
    const iframes = document.querySelectorAll("iframe")
    iframes.forEach((iframe) => {
        if (iframe instanceof HTMLIFrameElement) {
            if (!observedIframes.has(iframe)) {
                observedIframes.add(iframe)
                if (iframe.contentDocument) {
                    observeIFrame(iframe)
                } else {
                    iframe.addEventListener("load", () => {
                        observeIFrame(iframe)
                    })
                }
            }
        }
    })
}

/**
 * Subscribe to element creation.
 * @param selector [CSS Selector]{@link https://www.w3schools.com/jsref/met_document_queryselector.asp}.
 * @param callback Fired when an element matching {@link selector} is created.
 */
export function subscribeToElementCreation(selector: string, callback: ObserverCallback) {
    _initOnce.trigger()
    _entriesCreation.push({ selector: selector, callback: callback })
}

/**
 * Exactly same as {@link subscribeToElementCreation} except the {@link callback} is called
 * when an element is deleted.
 */
export function subscribeToElementDeletion(selector: string, callback: ObserverCallback) {
    _initOnce.trigger()
    _entriesDeletion.push({ selector: selector, callback: callback })
}

// LOAD CALLBACK

let loadCallbacks: (() => void)[] = []
let loadInitialized: boolean = false
let loadedOnce: boolean = false

/**
 * Subscribe to load.
 * @param callback Fired when league's loading screen fades away.
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
