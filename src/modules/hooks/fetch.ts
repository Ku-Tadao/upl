import { Once } from 'src/utils/once';

type HookPreOriginal = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type HookPostOriginal = (response: Response) => void;
type HookPreCallback = (input: RequestInfo | URL, init: RequestInit | undefined, original: HookPreOriginal) => Promise<Response>;
type HookPostCallback = (response: Response, original: HookPostOriginal) => void;

type HookTextPreOriginal = (body: string | undefined) => void;
type HookTextPostOriginal = (body: string) => void;
type HookTextPreCallback = (body: string | undefined, original: HookTextPreOriginal) => void;
type HookTextPostCallback = (response: string, original: HookTextPostOriginal) => void;

interface HookEntry {
  pre_callback: HookPreCallback[];
  post_callback: HookPostCallback[];
}

// Store hooks for exact string matches
const _entriesText = new Map<string, HookEntry>();
// Store hooks for RegExp patterns
const _entriesRegex: (readonly [RegExp, HookEntry])[] = [];
const _initOnce = new Once(init);

/**
 * Hook fetch request before it's sent.
 * @param endpoint String path or RegExp pattern to match
 * @param callback Callback to execute before request is sent
 */
export function hookPre(endpoint: string | RegExp, callback: HookPreCallback) {
  _initOnce.trigger();
  
  if (typeof endpoint === 'string') {
    let entry = _entriesText.get(endpoint);
    if (entry === undefined) {
      entry = { pre_callback: [callback], post_callback: [] };
      _entriesText.set(endpoint, entry);
    } else {
      entry.pre_callback.push(callback);
    }
  } else if (endpoint instanceof RegExp) {
    const existingEntry = _entriesRegex.find(x => x[0].toString() === endpoint.toString());
    if (existingEntry === undefined) {
      _entriesRegex.push([endpoint, { pre_callback: [callback], post_callback: [] }]);
    } else {
      existingEntry[1].pre_callback.push(callback);
    }
  } else {
    throw new TypeError('Invalid endpoint type!');
  }
}

/**
 * Hook fetch response after it's received.
 * @param endpoint String path or RegExp pattern to match
 * @param callback Callback to execute after response is received
 */
export function hookPost(endpoint: string | RegExp, callback: HookPostCallback) {
  _initOnce.trigger();
  
  if (typeof endpoint === 'string') {
    let entry = _entriesText.get(endpoint);
    if (entry === undefined) {
      entry = { pre_callback: [], post_callback: [callback] };
      _entriesText.set(endpoint, entry);
    } else {
      entry.post_callback.push(callback);
    }
  } else if (endpoint instanceof RegExp) {
    const existingEntry = _entriesRegex.find(x => x[0].toString() === endpoint.toString());
    if (existingEntry === undefined) {
      _entriesRegex.push([endpoint, { pre_callback: [], post_callback: [callback] }]);
    } else {
      existingEntry[1].post_callback.push(callback);
    }
  } else {
    throw new TypeError('Invalid endpoint type!');
  }
}

/**
 * Hook text request body for fetch.
 * @param endpoint String path or RegExp pattern to match
 * @param callback Callback to modify request body
 */
export function hookTextPre(endpoint: string | RegExp, callback: HookTextPreCallback) {
  hookPre(endpoint, async (input, init, original) => {
    if (init?.body !== undefined && typeof init.body !== 'string') {
      console.error('UPL: Tried to hook text fetch request but body is not a string!');
      return original(input, init);
    }
    
    return new Promise((resolve, reject) => {
      const _original = (newBody: string | undefined) => {
        if (newBody !== undefined && init !== undefined) {
          init.body = newBody;
        }
        original(input, init)
          .then(response => resolve(response))
          .catch(error => reject(error));
      };
      
      try {
        callback(init?.body as string | undefined, _original);
      } catch (error) {
        reject(error);
      }
    });
  });
}

/**
 * Hook text response for fetch.
 * @param endpoint String path or RegExp pattern to match
 * @param callback Callback to modify response text
 */
export function hookTextPost(endpoint: string | RegExp, callback: HookTextPostCallback) {
  hookPost(endpoint, (response, original) => {
    const originalClone = response.clone();
    
    // Override text method to allow modification of response text
    response.text = async function() {
      const text = await originalClone.text();
      return new Promise((resolve) => {
        const _original = (newBody: string) => {
          resolve(newBody);
        };
        callback(text, _original);
      });
    };
    
    original(response);
  });
}

/**
 * Find the matching hook entry for an endpoint
 * @param url The URL to match against
 * @returns The hook entry if found, undefined otherwise
 */
function findMatchingEntry(url: string): HookEntry | undefined {
  // Try exact string match first
  const exactMatch = _entriesText.get(url);
  if (exactMatch !== undefined) {
    return exactMatch;
  }
  
  // Fall back to RegExp match
  const regexMatch = _entriesRegex.find(x => x[0].test(url));
  return regexMatch?.[1];
}

const _originalFetch = window.fetch;

/**
 * Hooked fetch implementation
 */
async function hookedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let url: string;
  
  // Get URL string from input
  if (typeof input === 'string') {
    url = input;
  } else if (input instanceof URL) {
    url = input.toString();
  } else if (input instanceof Request) {
    url = input.url;
    // Handle Request objects by creating a new request with the same properties
    if (!init) {
      init = {};
    }
    // Copy headers if any
    if (input.headers) {
      init.headers = input.headers;
    }
    // Copy method if any
    if (input.method) {
      init.method = input.method;
    }
    // Get body if any and not GET/HEAD
    if (input.method !== 'GET' && input.method !== 'HEAD') {
      // We clone the request to not consume the original
      const clonedRequest = input.clone();
      try {
        // Try to get the body as text
        const body = await clonedRequest.text();
        if (body) {
          init.body = body;
        }
      } catch (e) {
        console.error('UPL: Failed to get body from Request object', e);
      }
    }
    input = url;
  } else {
    // Fallback for other types
    url = String(input);
  }
  
  const entry = findMatchingEntry(url);
  if (entry === undefined) {
    return _originalFetch(input, init);
  }
  
  // Apply pre-callbacks
  if (entry.pre_callback.length > 0) {
    let finalPromise: Promise<Response> = Promise.resolve(
      _originalFetch(input, init)
    );
    
    for (const callback of entry.pre_callback) {
      finalPromise = finalPromise.then(async (response) => {
        // Create a function that will call the original fetch with possibly modified parameters
        const original = async (_input: RequestInfo | URL, _init?: RequestInit) => {
          input = _input;
          init = _init;
          return _originalFetch(input, init);
        };
        
        return callback(input, init, original);
      });
    }
    
    const response = await finalPromise;
    
    // Apply post-callbacks
    if (entry.post_callback.length > 0) {
      const clonedResponse = response.clone();
      let index = 0;
      
      const applyNextPostCallback = () => {
        if (index >= entry.post_callback.length) {
          return clonedResponse;
        }
        
        const currentCallback = entry.post_callback[index++];
        const nextOriginal = () => {
          applyNextPostCallback();
        };
        
        currentCallback(clonedResponse, nextOriginal);
        return clonedResponse;
      };
      
      applyNextPostCallback();
    }
    
    return response;
  }
  
  // If no pre-callbacks, just apply post-callbacks to the response
  const response = await _originalFetch(input, init);
  
  if (entry.post_callback.length > 0) {
    const clonedResponse = response.clone();
    let index = 0;
    
    const applyNextPostCallback = () => {
      if (index >= entry.post_callback.length) {
        return;
      }
      
      const currentCallback = entry.post_callback[index++];
      const nextOriginal = () => {
        applyNextPostCallback();
      };
      
      currentCallback(clonedResponse, nextOriginal);
    };
    
    applyNextPostCallback();
    return clonedResponse;
  }
  
  return response;
}

function init() {
  window.fetch = hookedFetch;
}