import escapeStringRegexp from 'escape-string-regexp';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Linking, View, ActivityIndicator, Text, Platform } from 'react-native';
import {
  OnShouldStartLoadWithRequest,
  ShouldStartLoadRequestEvent,
  WebViewError,
  WebViewErrorEvent,
  WebViewHttpErrorEvent,
  WebViewMessage,
  WebViewMessageEvent,
  WebViewNavigation,
  WebViewNativeEvent,
  WebViewNavigationEvent,
  WebViewOpenWindowEvent,
  WebViewProgressEvent,
  WebViewRenderProcessGoneEvent,
  WebViewTerminatedEvent,
} from './WebViewTypes';
import styles from './WebView.styles';

// Exodus: Only allow HTTPS by default for security
const defaultOriginWhitelist = ['https://*'] as const;

// Exodus: Default protocol schemes for deep linking
const defaultDeeplinkWhitelist = ['https:'] as const;
const defaultDeeplinkBlocklist = ['http:', 'file:', 'javascript:'] as const;

// Exodus: Extract protocol scheme from URL using native URL parsing
const urlToProtocolScheme = (url: string): string | null => {
  try {
    return new URL(url).protocol;
  } catch {
    // Protocol schemes must start with a letter and cannot start with digits, underscores etc.
    // e.g 0invalid, _invalid, +invalid, -invalid, .invalid will all become null
    return null;
  }
};

// Exodus: Check if a value exists in a list of strings
const matchWithStringList = (
  prefixes: readonly string[],
  value: string
): boolean => {
  if (typeof value !== 'string') {
    throw new Error('value was not a string');
  }
  return Array.prototype.includes.call(prefixes, value);
};

// Exodus: Convert whitelist string to RegExp with exact matching (^ and $ anchors)
const stringWhitelistToRegex = (originWhitelist: string): RegExp =>
  new RegExp(`^${escapeStringRegexp(originWhitelist).replace(/\\\*/g, '.*')}$`);

// Exodus: Test value against a list of compiled RegExp patterns
const matchWithRegexList = (
  compiledRegexList: readonly RegExp[],
  value: string
): boolean => {
  return compiledRegexList.some((x) => x.test(value));
};

// Exodus: Compile whitelist strings into RegExp array for efficient matching
const compileWhitelist = (
  originWhitelist: readonly string[]
): readonly RegExp[] =>
  ['about:blank', ...(originWhitelist || [])].map(stringWhitelistToRegex);

// Exodus: Check if URL passes whitelist using native URL API for robust parsing
// Falls back to href when origin is null (handles data:, blob:, etc.)
const passesWhitelist = (
  compiledWhitelist: readonly RegExp[],
  url: string
): boolean => {
  try {
    const { href, origin } = new URL(url);

    // Check origin first (most common case)
    if (origin && origin !== 'null') {
      return matchWithRegexList(compiledWhitelist, origin);
    }

    // Fallback to href for URLs where origin is null (data:, blob:, javascript:, etc.)
    return matchWithRegexList(compiledWhitelist, href);
  } catch {
    // Malformed URL - fail closed for security
    return false;
  }
};

const createOnShouldStartLoadWithRequest = (
  loadRequest: (
    shouldStart: boolean,
    url: string,
    lockIdentifier: number
  ) => void,
  originWhitelist: readonly string[],
  deeplinkWhitelist: readonly string[],
  onShouldStartLoadWithRequest?: OnShouldStartLoadWithRequest
) => {
  const compiledWhitelist = compileWhitelist(originWhitelist);

  return ({ nativeEvent }: ShouldStartLoadRequestEvent) => {
    let shouldStart = true;
    const { url, lockIdentifier, isTopFrame } = nativeEvent;

    // Exodus: Check if the url passes the origin whitelist
    if (!passesWhitelist(compiledWhitelist, url)) {
      const protocol = urlToProtocolScheme(url);

      // Check that the protocol was properly parsed
      if (protocol !== null) {
        // Exodus: Check if the protocol passes the hardcoded deeplink blocklist
        const foundMatchInBlocklist = matchWithStringList(
          defaultDeeplinkBlocklist,
          protocol
        );
        if (!foundMatchInBlocklist) {
          // Exodus: Check if the protocol passes the dynamic deeplink allowlist
          const foundMatchInAllowlist = matchWithStringList(
            deeplinkWhitelist,
            protocol
          );

          if (foundMatchInAllowlist) {
            Linking.canOpenURL(url)
              .then((supported) => {
                // Allow mailto: even if canOpenURL returns false (RN Linking quirk)
                if (
                  (supported && isTopFrame) ||
                  protocol.startsWith('mailto:')
                ) {
                  return Linking.openURL(url);
                }
                console.warn(`Can't open url: ${url}`);
                return undefined;
              })
              .catch((e) => {
                console.warn('Error opening URL: ', e);
              });
          } else {
            console.warn(`Failed to pass whitelist for deep link url: ${url}`);
          }
        } else {
          console.warn(
            `Failed to pass default block list for deep link url: ${url}`
          );
        }
      }

      shouldStart = false;
    } else if (onShouldStartLoadWithRequest) {
      shouldStart = onShouldStartLoadWithRequest(nativeEvent);
    }

    loadRequest(shouldStart, url, lockIdentifier);
  };
};

const defaultRenderLoading = () => (
  <View style={styles.loadingOrErrorView}>
    <ActivityIndicator />
  </View>
);
const defaultRenderError = (
  errorDomain: string | undefined,
  errorCode: number,
  errorDesc: string
) => (
  <View style={styles.loadingOrErrorView}>
    <Text style={styles.errorTextTitle}>Error loading page</Text>
    <Text style={styles.errorText}>{`Domain: ${errorDomain}`}</Text>
    <Text style={styles.errorText}>{`Error Code: ${errorCode}`}</Text>
    <Text style={styles.errorText}>{`Description: ${errorDesc}`}</Text>
  </View>
);

export {
  defaultOriginWhitelist,
  defaultDeeplinkWhitelist,
  createOnShouldStartLoadWithRequest,
  defaultRenderLoading,
  defaultRenderError,
};

export const useWebViewLogic = ({
  startInLoadingState,
  onNavigationStateChange,
  onLoadStart,
  onLoad,
  onLoadProgress,
  onLoadEnd,
  onError,
  onLoadSubResourceError,
  onHttpErrorProp,
  onMessageProp,
  onOpenWindowProp,
  onRenderProcessGoneProp,
  onContentProcessDidTerminateProp,
  originWhitelist,
  deeplinkWhitelist,
  onShouldStartLoadWithRequestProp,
  onShouldStartLoadWithRequestCallback,
  validateMeta,
  validateData,
}: {
  startInLoadingState?: boolean;
  onNavigationStateChange?: (event: WebViewNavigation) => void;
  onLoadStart?: (event: WebViewNavigationEvent) => void;
  onLoad?: (event: WebViewNavigationEvent) => void;
  onLoadProgress?: (event: WebViewProgressEvent) => void;
  onLoadEnd?: (event: WebViewNavigationEvent | WebViewErrorEvent) => void;
  onError?: (event: WebViewErrorEvent) => void;
  onLoadSubResourceError?: (event: WebViewErrorEvent) => void;
  onHttpErrorProp?: (event: WebViewHttpErrorEvent) => void;
  onMessageProp?: (event: WebViewMessage) => void;
  onOpenWindowProp?: (event: WebViewOpenWindowEvent) => void;
  onRenderProcessGoneProp?: (event: WebViewRenderProcessGoneEvent) => void;
  onContentProcessDidTerminateProp?: (event: WebViewTerminatedEvent) => void;
  originWhitelist: readonly string[];
  deeplinkWhitelist: readonly string[];
  onShouldStartLoadWithRequestProp?: OnShouldStartLoadWithRequest;
  onShouldStartLoadWithRequestCallback: (
    shouldStart: boolean,
    url: string,
    lockIdentifier?: number | undefined
  ) => void;
  validateMeta: (event: WebViewNativeEvent) => WebViewNativeEvent;
  validateData: (data: object) => object;
}) => {
  const [viewState, setViewState] = useState<'IDLE' | 'LOADING' | 'ERROR'>(
    startInLoadingState ? 'LOADING' : 'IDLE'
  );
  const [lastErrorEvent, setLastErrorEvent] = useState<WebViewError | null>(
    null
  );
  const startUrl = useRef<string | null>(null);

  // Exodus: Helper to check if URL passes origin whitelist
  const passesWhitelistCallback = useCallback(
    (url: string) => {
      if (!url || typeof url !== 'string') return false;
      return passesWhitelist(compileWhitelist(originWhitelist), url);
    },
    [originWhitelist]
  );

  // Exodus: Extract and sanitize metadata from native event
  const extractMeta = (
    nativeEvent: WebViewNativeEvent
  ): WebViewNativeEvent => ({
    url: String(nativeEvent.url),
    loading: Boolean(nativeEvent.loading),
    title: String(nativeEvent.title).slice(0, 512),
    canGoBack: Boolean(nativeEvent.canGoBack),
    canGoForward: Boolean(nativeEvent.canGoForward),
    lockIdentifier: Number(nativeEvent.lockIdentifier),
  });

  const updateNavigationState = useCallback(
    (event: WebViewNavigationEvent) => {
      onNavigationStateChange?.(event.nativeEvent);
    },
    [onNavigationStateChange]
  );

  const onLoadingStart = useCallback(
    (event: WebViewNavigationEvent) => {
      // Needed for android
      startUrl.current = event.nativeEvent.url;
      // !Needed for android

      onLoadStart?.(event);
      updateNavigationState(event);
    },
    [onLoadStart, updateNavigationState]
  );

  const onLoadingError = useCallback(
    (event: WebViewErrorEvent) => {
      event.persist();
      if (onError) {
        onError(event);
      } else {
        console.warn('Encountered an error loading page', event.nativeEvent);
      }
      onLoadEnd?.(event);
      if (event.isDefaultPrevented()) {
        return;
      }
      setViewState('ERROR');
      setLastErrorEvent(event.nativeEvent);
    },
    [onError, onLoadEnd]
  );

  const onLoadingSubResourceError = useCallback(
    (event: WebViewErrorEvent) => {
      onLoadSubResourceError?.(event);
    },
    [onLoadSubResourceError]
  );

  const onHttpError = useCallback(
    (event: WebViewHttpErrorEvent) => {
      onHttpErrorProp?.(event);
    },
    [onHttpErrorProp]
  );

  // Android Only
  const onRenderProcessGone = useCallback(
    (event: WebViewRenderProcessGoneEvent) => {
      onRenderProcessGoneProp?.(event);
    },
    [onRenderProcessGoneProp]
  );
  // !Android Only

  // iOS Only
  const onContentProcessDidTerminate = useCallback(
    (event: WebViewTerminatedEvent) => {
      onContentProcessDidTerminateProp?.(event);
    },
    [onContentProcessDidTerminateProp]
  );
  // !iOS Only

  const onLoadingFinish = useCallback(
    (event: WebViewNavigationEvent) => {
      onLoad?.(event);
      onLoadEnd?.(event);
      const {
        nativeEvent: { url },
      } = event;
      // on Android, only if url === startUrl
      if (Platform.OS !== 'android' || url === startUrl.current) {
        setViewState('IDLE');
      }
      // !on Android, only if url === startUrl
      updateNavigationState(event);
    },
    [onLoad, onLoadEnd, updateNavigationState]
  );

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const { nativeEvent } = event;
      // Exodus: Validate URL against whitelist before processing message
      if (!passesWhitelistCallback(nativeEvent.url)) return;

      try {
        const parsedData = JSON.parse(nativeEvent.data);
        const data = JSON.stringify(validateData(parsedData));
        const meta = validateMeta(extractMeta(nativeEvent));

        onMessageProp?.({ ...meta, data });
      } catch (err) {
        console.error('Error parsing WebView message', err);
      }
    },
    [onMessageProp, passesWhitelistCallback, validateData, validateMeta]
  );

  const onLoadingProgress = useCallback(
    (event: WebViewProgressEvent) => {
      const {
        nativeEvent: { progress },
      } = event;
      // patch for Android only
      if (Platform.OS === 'android' && progress === 1) {
        setViewState((prevViewState) =>
          prevViewState === 'LOADING' ? 'IDLE' : prevViewState
        );
      }
      // !patch for Android only
      onLoadProgress?.(event);
    },
    [onLoadProgress]
  );

  const onShouldStartLoadWithRequest = useMemo(
    () =>
      createOnShouldStartLoadWithRequest(
        onShouldStartLoadWithRequestCallback,
        originWhitelist,
        deeplinkWhitelist,
        onShouldStartLoadWithRequestProp
      ),
    [
      originWhitelist,
      deeplinkWhitelist,
      onShouldStartLoadWithRequestProp,
      onShouldStartLoadWithRequestCallback,
    ]
  );

  const onOpenWindow = useCallback(
    (event: WebViewOpenWindowEvent) => {
      onOpenWindowProp?.(event);
    },
    [onOpenWindowProp]
  );

  return {
    onShouldStartLoadWithRequest,
    onLoadingStart,
    onLoadingProgress,
    onLoadingError,
    onLoadingSubResourceError,
    onLoadingFinish,
    onHttpError,
    onRenderProcessGone,
    onContentProcessDidTerminate,
    onMessage,
    onOpenWindow,
    viewState,
    setViewState,
    lastErrorEvent,
  };
};

/**
 * Exodus: Check if a version string passes the minimum version requirement.
 * Supports complex version constraints like "12.5.6 <13, 13.6.1 <14, 14.8.1 <15, 15.7.1"
 * which means:
 * - 12.5.6 or higher but less than 13
 * - OR 13.6.1 or higher but less than 14
 * - OR 14.8.1 or higher but less than 15
 * - OR 15.7.1 or higher (no upper bound)
 */
export const versionPasses = (
  version: string | undefined,
  minimum: string | undefined
): boolean => {
  if (!version || !minimum) return false;
  if (typeof version !== 'string' || typeof minimum !== 'string') return false;

  // Handle multiple version ranges separated by ", "
  if (minimum.includes(', ')) {
    const variants = minimum.split(', ');
    // Every entry but the last one should have an upper bound
    if (!variants.slice(0, -1).every((x) => x.includes(' <'))) return false;
    // Any match passes
    return variants.some((x) => versionPasses(version, x));
  }

  // Handle version range with upper bound (e.g., "12.5.6 <13")
  if (minimum.includes(' <')) {
    const [min, max, ...rest] = minimum.split(' <');
    if (rest.length > 0) return false;
    // Must be >= min AND < max
    // Last check validates that max > min (formatting validation)
    return (
      versionPasses(version, min) &&
      !versionPasses(version, max) &&
      versionPasses(max, version)
    );
  }

  // Simple version comparison (e.g., "15.7.1")
  const versionRegex = /^[0-9]+(\.[0-9]+)*$/;
  if (!versionRegex.test(version) || !versionRegex.test(minimum)) return false;

  const versionParts = version.split('.').map(Number);
  const minimumParts = minimum.split('.').map(Number);
  const len = Math.max(versionParts.length, minimumParts.length);

  for (let i = 0; i < len; i += 1) {
    const ver = versionParts[i] || 0;
    const min = minimumParts[i] || 0;
    if (ver > min) return true;
    if (ver < min) return false;
  }

  return true; // equals
};
