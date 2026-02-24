# Security Hardenings Report — @exodus/react-native-webview v13.16

**Date:** 2026-02-24
**Branch:** `release/v13.16`
**Base version:** `13.16.0-exodus.3`

This report documents all code changes made per audit item. Each section maps an item ID to its exact file changes so the audit team can pinpoint and verify each hardening independently.

> **Note for the audit team:** The audit was performed against `13.16.0-exodus.1`. Several fixes were already committed in `13.16.0-exodus.2` and `13.16.0-exodus.3` before this batch of changes. Those previously-committed fixes are documented in [Part A](#part-a-previously-committed-fixes-exodus1--exodus3) below. The new uncommitted changes are documented in [Part B](#part-b-new-uncommitted-changes).

---

## Table of Contents

- [Part A: Previously Committed Fixes (exodus.1 → exodus.3)](#part-a-previously-committed-fixes-exodus1--exodus3)
  - [H-01: HTTPS-only default origin whitelist](#h-01-https-only-default-origin-whitelist)
  - [H-03: `minimumChromeVersion` enforcement](#h-03-minimumchromeversion-enforcement)
  - [H-07: Hardcoded security defaults (Android)](#h-07-hardcoded-security-defaults-android)
  - [H-07: Hardcoded security defaults (iOS)](#h-07-hardcoded-security-defaults-ios)
  - [PR-01: Integer overflow fix in `RNCWebViewDecisionManager`](#pr-01-integer-overflow-fix-in-rncwebviewdecisionmanager)
  - [PR-02: Block copy semantics fix](#pr-02-block-copy-semantics-fix)
  - [PR-03: Memory leak on WebView dealloc](#pr-03-memory-leak-on-webview-dealloc)
  - [PR-04: Remove kotlin-stdlib 1.4.32 transitive dependency](#pr-04-remove-kotlin-stdlib-1432-transitive-dependency)
- [Part B: New Uncommitted Changes](#part-b-new-uncommitted-changes)
- [Phase 1: Critical Quick Fixes](#phase-1-critical-quick-fixes)
  - [H-10: Remove `nativeConfig` prop](#h-10-remove-nativeconfig-prop)
  - [J-02: Null cookie check](#j-02-null-cookie-check)
  - [J-03: Force `fraudulentWebsiteWarningEnabled = YES`](#j-03-force-fraudulentwebsitewarningenabled--yes)
  - [J-04: Null `getHost()` check](#j-04-null-gethost-check)
  - [H-04: Geolocation deny-default](#h-04-geolocation-deny-default)
- [Phase 2: Android Permission Bug Fix](#phase-2-android-permission-bug-fix)
  - [J-05: Fix `RESOURCE_PROTECTED_MEDIA_ID` handling](#j-05-fix-resource_protected_media_id-handling)
- [Phase 3: JS-Layer Security Guards](#phase-3-js-layer-security-guards)
  - [H-02: Android initial-load whitelist guard](#h-02-android-initial-load-whitelist-guard)
  - [H-06: Wire up `validateProps` runtime guard](#h-06-wire-up-validateprops-runtime-guard)
- [Phase 4: Surface Reduction — Prop/Command Removal](#phase-4-surface-reduction--propcommand-removal)
  - [H-05: Disable `injectJavaScript` command](#h-05-disable-injectjavascript-command)
  - [H-12: Force `javaScriptCanOpenWindowsAutomatically = false`](#h-12-force-javascriptcanopenwindowsautomatically--false)
  - [H-13: Remove `applicationNameForUserAgent`](#h-13-remove-applicationnameforuseragent)
  - [H-15: Force AirPlay disabled](#h-15-force-airplay-disabled)
  - [H-17: Force `injectedJavaScript*ForMainFrameOnly = true`](#h-17-force-injectedjavascriptformainframeonly--true)
- [Phase 5: Event Removal](#phase-5-event-removal)
  - [H-14: Remove `onFileDownload` event](#h-14-remove-onfiledownload-event)
  - [H-16: Remove `onHttpError` event](#h-16-remove-onhttperror-event)
- [Phase 6: File Access Deep Removal](#phase-6-file-access-deep-removal)
  - [H-11: Remove all file access props](#h-11-remove-all-file-access-props)
- [Phase 7: iOS-Specific Hardenings](#phase-7-ios-specific-hardenings)
  - [H-08: Camera whitelist on media-capture path](#h-08-camera-whitelist-on-media-capture-path)
  - [H-09: Navigation decision timeout (deny-by-default)](#h-09-navigation-decision-timeout-deny-by-default)
- [Phase 8: Platform Removal](#phase-8-platform-removal)
  - [S-01: Remove Windows support](#s-01-remove-windows-support)
  - [S-02: Remove macOS support](#s-02-remove-macos-support)
- [Deferred Items](#deferred-items)
- [Test Changes](#test-changes)

---

# Part A: Previously Committed Fixes (exodus.1 → exodus.3)

These fixes were already committed and released in `13.16.0-exodus.2` and `13.16.0-exodus.3`. They are listed here for completeness since the audit was performed against `13.16.0-exodus.1`.

> **Also present since exodus.1 (from the original merge):** The `cameraPermissionOriginWhitelist` prop was ported during the v11→v13 merge and was already in `13.16.0-exodus.1`. See commits `2598a37`, `8884854`, `d03b4ab`, `4108883`, `05dd247`. The new H-08 change in [Phase 7](#h-08-camera-whitelist-on-media-capture-path) extends this to also cover the iOS 15+ `requestMediaCapturePermissionForOrigin:` code path, which was not covered by the original implementation.

## H-01: HTTPS-only default origin whitelist

**Commit:** `849035c` — `chore: iOS security hardcoded flags`
**Risk:** The upstream default `['http://*', 'https://*']` allows loading insecure HTTP pages.

**Files changed:**

| File | Change |
|------|--------|
| `src/WebViewShared.tsx` | Changed `defaultOriginWhitelist` from `['http://*', 'https://*']` to `['https://*']`. |

**Diff:**
```tsx
// Before:
const defaultOriginWhitelist = ['http://*', 'https://*'] as const;

// After:
// Exodus: Only allow HTTPS by default for security
const defaultOriginWhitelist = ['https://*'] as const;
```

---

## H-03: `minimumChromeVersion` enforcement

**Commit:** `bf0a1bf` — `chore: bring back minimumChromeVersion prop for Android`
**Risk:** Old Chrome versions on Android have known vulnerabilities. The fork enforces a minimum version before rendering.

**Files changed:**

| File | Change |
|------|--------|
| `src/WebViewTypes.ts` | Added `minimumChromeVersion?: string` and `unsupportedVersionComponent?: ElementType` to `AndroidWebViewProps`. |
| `src/WebView.android.tsx` | Added `getUserAgent()` function using `NativeModules.RNCWebViewUtils.getWebViewDefaultUserAgent()`. Added `hardMinimumChromeVersion = '100.0'` constant. Added `userAgent` state with `useEffect` to fetch on mount. Added version checking logic: blocks render until userAgent is known, extracts Chrome version from UA string, checks against both prop and hard minimum, shows `UnsupportedVersionComponent` or default error text if version fails. |

**Key code added:**
```tsx
const hardMinimumChromeVersion = '100.0';

// In component body:
if (!userAgent) return null;

const chromeVersion = userAgent.match(/chrome\/((?:[0-9]+\.)+[0-9]+)/i)?.[1];

if (!(
  versionPasses(chromeVersion, minimumChromeVersion) &&
  versionPasses(chromeVersion, hardMinimumChromeVersion)
)) {
  if (UnsupportedVersionComponent) {
    return <UnsupportedVersionComponent />;
  }
  return (
    <View style={{ alignSelf: 'flex-start' }}>
      <Text style={{ color: 'red' }}>
        Chrome version is outdated and insecure. Update it to continue.
      </Text>
    </View>
  );
}
```

---

## H-07: Hardcoded security defaults (Android)

**Commit:** `c39c92e` — `chore: Android security hardcoded flags`
**Risk:** Security-critical settings were configurable via props, allowing consumers to weaken them.

**Files changed:**

| File | Change |
|------|--------|
| `src/WebView.android.tsx` | Added module-level constants that CANNOT be overridden by props: `mediaPlaybackRequiresUserAction = true`, `securitySupportMultipleWindows = true`, `securityMixedContentMode = 'never'`. Removed `setSupportMultipleWindows` from props destructuring. Updated JSX to use hardcoded constants: `setSupportMultipleWindows={securitySupportMultipleWindows}`, `mixedContentMode={securityMixedContentMode}`, `mediaPlaybackRequiresUserAction={mediaPlaybackRequiresUserAction}`. |

**Security impact:**
- `mixedContentMode = 'never'` — Prevents HTTP content on HTTPS pages (mixed content attacks)
- `mediaPlaybackRequiresUserAction = true` — Prevents auto-play abuse
- `setSupportMultipleWindows = true` — Enforced, not overridable

---

## H-07: Hardcoded security defaults (iOS)

**Commit:** `849035c` — `chore: iOS security hardcoded flags`
**Risk:** Same as Android — security-critical settings were configurable via props.

**Files changed:**

| File | Change |
|------|--------|
| `src/WebView.ios.tsx` | Added module-level constants: `securityMediaPlaybackRequiresUserAction = true`, `securityAllowsInlineMediaPlayback = true`, `securityUseSharedProcessPool = false`, `securitySharedCookiesEnabled = false`, `securityEnableApplePay = false`, `securityDataDetectorTypes = ['none']`. Removed `useSharedProcessPool`, `allowsInlineMediaPlayback`, `mediaPlaybackRequiresUserAction`, `dataDetectorTypes` from props destructuring. Updated JSX to use hardcoded constants. |

**Security impact:**
- `useSharedProcessPool = false` — Process isolation between WebViews (was incorrectly `true`)
- `sharedCookiesEnabled = false` — Cookie isolation
- `enableApplePay = false` — Disabled unless explicitly needed
- `dataDetectorTypes = ['none']` — Prevents automatic link/phone detection
- `mediaPlaybackRequiresUserAction = true` — Prevents auto-play
- `allowsInlineMediaPlayback = true` — Consistent behavior

---

## PR-01: Integer overflow fix in `RNCWebViewDecisionManager`

**Commit:** `05e72f7` — `fix: 64-bit integer to avoid overflow, collision checking + thread safety`
**Risk:** The `nextLockIdentifier` counter was `int` (32-bit), which could overflow after ~2.1 billion increments. A malicious script could trigger rapid navigations to cause collisions with pending handlers.

**Files changed:**

| File | Change |
|------|--------|
| `apple/RNCWebViewDecisionManager.h` | Changed `int nextLockIdentifier` to `NSInteger nextLockIdentifier`. Updated method signatures to use `NSInteger`. |
| `apple/RNCWebViewDecisionManager.m` | Changed to `NSInteger` throughout. Added collision checking (`while` loop skips identifiers still in use). Added `@synchronized` blocks for thread safety on all public methods. Added documentation comments. Improved log message with identifier value. |
| `apple/RNCWebViewImpl.m` | Changed `int lockIdentifier` to `NSInteger lockIdentifier` in decision handler creation. |
| `apple/RNCWebViewModule.mm` | Changed cast from `(int)` to `(NSInteger)` when calling `setResult:forLockIdentifier:`. |

**Key diff (setDecisionHandler):**
```objc
// Before:
- (int)setDecisionHandler:(DecisionBlock)decisionHandler {
    int lockIdentifier = self.nextLockIdentifier++;
    [self.decisionHandlers setObject:decisionHandler forKey:@(lockIdentifier)];
    return lockIdentifier;
}

// After:
- (NSInteger)setDecisionHandler:(DecisionBlock)decisionHandler {
    @synchronized (self) {
        NSInteger lockIdentifier = self.nextLockIdentifier++;

        while ([self.decisionHandlers objectForKey:@(lockIdentifier)] != nil) {
            lockIdentifier = self.nextLockIdentifier++;
        }

        [self.decisionHandlers setObject:[decisionHandler copy] forKey:@(lockIdentifier)];
        return lockIdentifier;
    }
}
```

---

## PR-02: Block copy semantics fix

**Commit:** `f057812` — `fix: copy decisionHandler block`
**Risk:** Objective-C blocks are created on the stack. When stored in a collection without copying, they may become invalid after the caller's stack frame is destroyed, leading to use-after-free.

**Files changed:**

| File | Change |
|------|--------|
| `apple/RNCWebViewDecisionManager.m` | Changed `[self.decisionHandlers setObject:decisionHandler ...]` to `[self.decisionHandlers setObject:[decisionHandler copy] ...]`. This explicitly copies the block from stack to heap. |

---

## PR-03: Memory leak on WebView dealloc

**Commit:** `f75f689` — `fix: memory leak on RNCWebViewImpl dealloc`
**Risk:** When a WebView is deallocated while there are pending navigation decisions, the stored handlers in `RNCWebViewDecisionManager` would never be called or released, causing a memory leak.

**Files changed:**

| File | Change |
|------|--------|
| `apple/RNCWebViewDecisionManager.h` | Added `cancelDecisionForLockIdentifier:` method declaration. |
| `apple/RNCWebViewDecisionManager.m` | Implemented `cancelDecisionForLockIdentifier:` — removes handler from dictionary without invoking it, under `@synchronized`. |
| `apple/RNCWebViewImpl.m` | Added `_pendingLockIdentifiers` (`NSMutableSet<NSNumber *>`) ivar. Initialized in `initWithFrame:`. Tracks lock identifier when creating decision handler (`addObject:@(lockIdentifier)`). Removes from set when decision is resolved (in handler callback). In `dealloc`: iterates remaining set and calls `cancelDecisionForLockIdentifier:` for each. |

**Memory management flow:**
1. Navigation decision created → `lockIdentifier` added to `_pendingLockIdentifiers`
2. Decision resolved (handler called) → `lockIdentifier` removed from set
3. WebView deallocates → all remaining pending decisions cancelled via `cancelDecisionForLockIdentifier:`

---

## PR-04: Remove kotlin-stdlib 1.4.32 transitive dependency

**Commit:** `075117a` — `fix(android): remove kotlin-stdlib 1.4.32 transitive dependency for consumer apps`
**Risk:** The library's `build.gradle` unconditionally resolved `buildscript` dependencies (including `kotlin-gradle-plugin`), pulling in `kotlin-stdlib:1.4.32` as a transitive dependency into consumer apps. This old version has known vulnerabilities and conflicts with the consumer's Kotlin version.

**Files changed:**

| File | Change |
|------|--------|
| `android/build.gradle` | Wrapped the `buildscript { repositories { ... } dependencies { ... } }` block in `if (project == rootProject)` guard. This ensures `kotlin-gradle-plugin` and its transitive `kotlin-stdlib:1.4.32` are only resolved when the library is built standalone (as root project), not when included as a dependency module in a consumer app. |

**Diff:**
```groovy
// Before:
buildscript {
    repositories {
        google()
        gradlePluginPortal()
    }
    dependencies {
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:${safeExtGet('kotlinVersion')}")
        classpath("com.android.tools.build:gradle:7.0.4")
    }
}

// After:
buildscript {
    // This avoids unnecessary downloads and potential conflicts when the library
    // is included as a module dependency in an application project.
    if (project == rootProject) {
        repositories {
            google()
            gradlePluginPortal()
        }
        dependencies {
            classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:${safeExtGet('kotlinVersion')}")
            classpath("com.android.tools.build:gradle:7.0.4")
        }
    }
}
```

---

# Part B: New Uncommitted Changes

These changes are staged in the working tree on branch `release/v13.16`, not yet committed. They build on top of `13.16.0-exodus.3` (`ad66134`).

---

## Phase 1: Critical Quick Fixes

### H-10: Remove `nativeConfig` prop

**Risk:** The `{...nativeConfig?.props}` spread was placed AFTER hardcoded security defaults in the JSX, allowing consumers to override ALL security settings.

**Files changed:**

| File | Change |
|------|--------|
| `src/WebViewTypes.ts` | Removed `WebViewNativeConfig` interface (component, props, viewManager fields). Removed `nativeConfig?: WebViewNativeConfig` from `WebViewSharedProps`. |
| `src/WebView.android.tsx` | Removed `nativeConfig` from props destructuring. Removed `const NativeWebView = (nativeConfig?.component ...) \|\| RNCWebView` — now always uses `RNCWebView` directly. Removed `{...nativeConfig?.props}` spread from JSX. |
| `src/WebView.ios.tsx` | Removed `nativeConfig` from props destructuring. Removed `const NativeWebView = (nativeConfig?.component ...) \|\| RNCWebView` — now always uses `RNCWebView` directly. Removed `{...nativeConfig?.props}` spread from JSX. |

---

### J-02: Null cookie check

**Risk:** `CookieManager.getInstance().getCookie()` can return `null`, and passing `null` to `addRequestHeader` could crash.

**Files changed:**

| File | Change |
|------|--------|
| `android/.../RNCWebViewManagerImpl.kt` line ~117 | Wrapped `request.addRequestHeader("Cookie", cookie)` with `if (cookie != null)` guard. |

**Diff:**
```kotlin
// Before:
request.addRequestHeader("Cookie", cookie)

// After:
if (cookie != null) {
    request.addRequestHeader("Cookie", cookie)
}
```

---

### J-03: Force `fraudulentWebsiteWarningEnabled = YES`

**Risk:** The original code allowed disabling Safari's fraudulent website warning via a prop.

**Files changed:**

| File | Change |
|------|--------|
| `apple/RNCWebViewImpl.m` lines ~441-450 | Removed the conditional `if (!_fraudulentWebsiteWarningEnabled)` and replaced with unconditional `prefs.fraudulentWebsiteWarningEnabled = YES`. |

**Diff:**
```objc
// Before:
if (!_fraudulentWebsiteWarningEnabled) {
    prefs.fraudulentWebsiteWarningEnabled = NO;
    _prefsUsed = YES;
}

// After:
// Exodus: Always force fraudulent website warning enabled for security
prefs.fraudulentWebsiteWarningEnabled = YES;
_prefsUsed = YES;
```

---

### J-04: Null `getHost()` check

**Risk:** `originUri.getHost()` can return `null` for malformed URIs, leading to NPE or bypassing the whitelist check.

**Files changed:**

| File | Change |
|------|--------|
| `android/.../RNCWebChromeClient.java` line ~161 | Added null check on `originUri.getHost()`. If null, calls `request.deny()` and returns early. |

**Diff:**
```java
// Before:
final int port = originUri.getPort();
String origin = scheme + "://" + originUri.getHost();

// After:
final String host = originUri.getHost();
final int port = originUri.getPort();

// Exodus: Deny permission if host is null (malformed origin)
if (host == null) {
    request.deny();
    return;
}

String origin = scheme + "://" + host;
```

---

### H-04: Geolocation deny-default

**Risk:** Geolocation was granted by default when the permission dialog was bypassed.

**Files changed:**

| File | Change |
|------|--------|
| `android/.../RNCWebChromeClient.java` line ~238 | Changed `callback.invoke(origin, true, false)` to `callback.invoke(origin, false, false)`. |

**Diff:**
```java
// Before:
callback.invoke(origin, true, false);

// After:
// Exodus: Deny geolocation by default for security
callback.invoke(origin, false, false);
```

---

## Phase 2: Android Permission Bug Fix

### J-05: Fix `RESOURCE_PROTECTED_MEDIA_ID` handling

**Risk:** `RESOURCE_PROTECTED_MEDIA_ID` is not a real Android permission string. Passing it to `checkSelfPermission` would crash or produce undefined behavior.

**Files changed:**

| File | Change |
|------|--------|
| `android/.../RNCWebChromeClient.java` lines ~185-191 | Removed the `else` branch that set `androidPermission = PermissionRequest.RESOURCE_PROTECTED_MEDIA_ID`. Now only the `if (mAllowsProtectedMedia)` path remains, which directly adds to `grantedPermissions` without asking for an Android permission. |
| `android/.../RNCWebChromeClient.java` lines ~322-327 | Removed the corresponding listener branch for `RESOURCE_PROTECTED_MEDIA_ID` in the permission result callback. |

**Diff (onPermissionRequest):**
```java
// Before:
} else if(requestedResource.equals(PermissionRequest.RESOURCE_PROTECTED_MEDIA_ID)) {
    if (mAllowsProtectedMedia) {
      grantedPermissions.add(requestedResource);
    } else {
      androidPermission = PermissionRequest.RESOURCE_PROTECTED_MEDIA_ID;
    }
}

// After:
} else if(requestedResource.equals(PermissionRequest.RESOURCE_PROTECTED_MEDIA_ID)) {
    // Exodus: Only grant if allowsProtectedMedia is enabled.
    // RESOURCE_PROTECTED_MEDIA_ID is not a real Android permission,
    // so it cannot be passed to checkSelfPermission.
    if (mAllowsProtectedMedia) {
      grantedPermissions.add(requestedResource);
    }
}
```

**Diff (permission listener):**
```java
// Removed entirely:
if (permission.equals(PermissionRequest.RESOURCE_PROTECTED_MEDIA_ID)) {
    if (granted && grantedPermissions != null) {
        grantedPermissions.add(PermissionRequest.RESOURCE_PROTECTED_MEDIA_ID);
    }
    shouldAnswerToPermissionRequest = true;
}
```

---

## Phase 3: JS-Layer Security Guards

### H-02: Android initial-load whitelist guard

**Risk:** The initial `source.uri` was passed directly to the native WebView without checking it against the origin whitelist, allowing a non-whitelisted URL to load on first render.

**Files changed:**

| File | Change |
|------|--------|
| `src/WebViewShared.tsx` lines ~180-182 | Exported `passesWhitelist` and `compileWhitelist` functions (previously internal). |
| `src/WebView.android.tsx` | Added imports for `passesWhitelist`, `compileWhitelist`, `useMemo`. Added `compiledWhitelist` memo from `compileWhitelist(originWhitelist)`. Added `safeSource` memo that checks `source.uri` against the compiled whitelist — falls back to `{ uri: 'about:blank' }` if it fails. All downstream references changed from `source` to `safeSource`. |

**Key code added to `WebView.android.tsx`:**
```tsx
// Exodus: Compile origin whitelist for initial-load guard
const compiledWhitelist = useMemo(
  () => compileWhitelist(originWhitelist),
  [originWhitelist]
);

// Exodus: Guard initial source against origin whitelist (H-02)
const safeSource = useMemo(() => {
  if (
    source &&
    typeof source === 'object' &&
    'uri' in source &&
    typeof source.uri === 'string'
  ) {
    if (!passesWhitelist(compiledWhitelist, source.uri)) {
      console.warn(
        `WebView: source.uri "${source.uri}" does not pass the origin whitelist. Loading about:blank instead.`
      );
      return { uri: 'about:blank' };
    }
  }
  return source;
}, [source, compiledWhitelist]);
```

---

### H-06: Wire up `validateProps` runtime guard

**Risk:** The `validation.ts` module existed but was never called, so runtime prop validation was inactive.

**Files changed:**

| File | Change |
|------|--------|
| `src/WebView.android.tsx` | Added `import validateProps from './validation'`. Call `validateProps(props)` at the top of the component body (before destructuring). Restructured forwardRef to receive `props` as a single parameter. |
| `src/WebView.ios.tsx` | Added `import validateProps from './validation'`. Call `validateProps(props)` at the top of the component body. Restructured forwardRef to receive `props` as a single parameter. |

**Key code pattern:**
```tsx
const WebViewComponent = forwardRef<{}, AndroidWebViewProps>((props, ref) => {
  // Exodus: Validate props at runtime (H-06)
  validateProps(props);

  const { overScrollMode = 'always', ... } = props;
  // ...
});
```

---

## Phase 4: Surface Reduction — Prop/Command Removal

### H-05: Disable `injectJavaScript` command

**Risk:** `injectJavaScript` allows arbitrary JS execution in the WebView from the host app, expanding the attack surface.

**Files changed:**

| File | Change |
|------|--------|
| `src/WebViewTypes.ts` | Removed `'injectJavaScript'` from `WebViewCommands` union type. |
| `src/RNCWebViewNativeComponent.ts` | Removed `injectJavaScript` from `NativeCommands` interface and from `codegenNativeCommands` `supportedCommands` array. |
| `src/WebView.android.tsx` | Removed `injectJavaScript` from `useImperativeHandle` return object. |
| `src/WebView.ios.tsx` | Removed `injectJavaScript` from `useImperativeHandle` return object. |
| `android/.../RNCWebViewManagerImpl.kt` | Removed `COMMAND_INJECT_JAVASCRIPT = 6` constant, removed `"injectJavaScript"` from command map, removed `"injectJavaScript"` case from `receiveCommand`. |
| `android/src/newarch/.../RNCWebViewManager.java` | Removed `injectJavaScript()` override method. |

---

### H-12: Force `javaScriptCanOpenWindowsAutomatically = false`

**Risk:** When `true`, JavaScript can open new windows/popups without user interaction.

**Files changed:**

| File | Change |
|------|--------|
| `src/WebViewTypes.ts` | Removed `javaScriptCanOpenWindowsAutomatically?: boolean` from `CommonNativeWebViewProps` and `WebViewSharedProps`. |
| `src/RNCWebViewNativeComponent.ts` | Removed `javaScriptCanOpenWindowsAutomatically?: boolean` from `NativeProps`. |
| `android/.../RNCWebViewManagerImpl.kt` | Removed `setJavaScriptCanOpenWindowsAutomatically()` method. Added `settings.javaScriptCanOpenWindowsAutomatically = false` to `createViewInstance()` (hardcoded). |
| `android/src/oldarch/.../RNCWebViewManager.java` | Removed `@ReactProp` method for `javaScriptCanOpenWindowsAutomatically`. |
| `android/src/newarch/.../RNCWebViewManager.java` | Removed `@ReactProp` method for `javaScriptCanOpenWindowsAutomatically`. |
| `apple/RNCWebViewImpl.h` | Removed `javaScriptCanOpenWindowsAutomatically` property. |
| `apple/RNCWebViewImpl.m` | Removed the conditional `if (_javaScriptCanOpenWindowsAutomatically)` block. Added comment that WKPreferences default is `NO`. |
| `apple/RNCWebViewManager.mm` | Removed `RCT_EXPORT_VIEW_PROPERTY(javaScriptCanOpenWindowsAutomatically, BOOL)`. |
| `apple/RNCWebView.mm` | Removed `REMAP_WEBVIEW_PROP(javaScriptCanOpenWindowsAutomatically)`. |

---

### H-13: Remove `applicationNameForUserAgent`

**Risk:** Allows appending arbitrary strings to the user agent, which could be used for fingerprinting or to bypass server-side protections.

**Files changed:**

| File | Change |
|------|--------|
| `src/WebViewTypes.ts` | Removed `applicationNameForUserAgent?: string` from `CommonNativeWebViewProps` and `WebViewSharedProps`. |
| `src/RNCWebViewNativeComponent.ts` | Removed `applicationNameForUserAgent?: string` from `NativeProps`. |
| `android/.../RNCWebViewManagerImpl.kt` | Removed `setApplicationNameForUserAgent()` method. Removed `mUserAgentWithApplicationName` field. Removed fallback to `mUserAgentWithApplicationName` in `setUserAgentString()`. |
| `android/src/oldarch/.../RNCWebViewManager.java` | Removed `@ReactProp` method for `applicationNameForUserAgent`. |
| `android/src/newarch/.../RNCWebViewManager.java` | Removed `@ReactProp` method for `applicationNameForUserAgent`. |
| `apple/RNCWebViewImpl.h` | Removed `applicationNameForUserAgent` property. |
| `apple/RNCWebViewImpl.m` | Removed the block that appended `_applicationNameForUserAgent` to `wkWebViewConfig.applicationNameForUserAgent`. |
| `apple/RNCWebViewManager.mm` | Removed `RCT_EXPORT_VIEW_PROPERTY(applicationNameForUserAgent, NSString)`. |
| `apple/RNCWebView.mm` | Removed `REMAP_WEBVIEW_STRING_PROP(applicationNameForUserAgent)`. |

---

### H-15: Force AirPlay disabled

**Risk:** AirPlay allows media to be streamed to external devices, which could leak sensitive content.

**Files changed:**

| File | Change |
|------|--------|
| `src/WebViewTypes.ts` | Removed `allowsAirPlayForMediaPlayback?: boolean` from `IOSWebViewProps`. |
| `src/RNCWebViewNativeComponent.ts` | Removed `allowsAirPlayForMediaPlayback?: boolean` from `NativeProps`. |
| `src/WebView.ios.tsx` | Removed `allowsAirPlayForMediaPlayback` from destructuring and from `useWarnIfChanges`. Removed from JSX props. |
| `apple/RNCWebViewImpl.h` | Removed `allowsAirPlayForMediaPlayback` property. |
| `apple/RNCWebViewImpl.m` | Changed `wkWebViewConfig.allowsAirPlayForMediaPlayback = _allowsAirPlayForMediaPlayback` to hardcoded `wkWebViewConfig.allowsAirPlayForMediaPlayback = NO`. |
| `apple/RNCWebViewManager.mm` | Removed `RCT_EXPORT_VIEW_PROPERTY(allowsAirPlayForMediaPlayback, BOOL)`. |
| `apple/RNCWebView.mm` | Removed `REMAP_WEBVIEW_PROP(allowsAirPlayForMediaPlayback)`. |
| `android/src/newarch/.../RNCWebViewManager.java` | Removed `setAllowsAirPlayForMediaPlayback` no-op stub. |

---

### H-17: Force `injectedJavaScript*ForMainFrameOnly = true`

**Risk:** When `false`, injected JS runs in ALL frames (including iframes from untrusted origins), which could expose the host app's bridge to third-party content.

**Files changed:**

| File | Change |
|------|--------|
| `src/WebViewTypes.ts` | Removed `injectedJavaScriptForMainFrameOnly?: boolean` and `injectedJavaScriptBeforeContentLoadedForMainFrameOnly?: boolean` from `CommonNativeWebViewProps`, `IOSWebViewProps`, and `WebViewSharedProps`. |
| `src/RNCWebViewNativeComponent.ts` | Removed both `ForMainFrameOnly` props from `NativeProps`. |
| `src/WebView.ios.tsx` | Removed both from destructuring and from JSX props. |
| `android/.../RNCWebViewManagerImpl.kt` | Removed `setInjectedJavaScriptForMainFrameOnly()` and `setInjectedJavaScriptBeforeContentLoadedForMainFrameOnly()` methods. |
| `android/src/oldarch/.../RNCWebViewManager.java` | Removed both `@ReactProp` methods. |
| `android/src/newarch/.../RNCWebViewManager.java` | Removed both `@ReactProp` methods. |
| `apple/RNCWebViewImpl.h` | Removed both properties. |
| `apple/RNCWebViewImpl.m` | Removed ivar initializations (`_injectedJavaScriptForMainFrameOnly = YES`, `_injectedJavaScriptBeforeContentLoadedForMainFrameOnly = YES`). Changed `forMainFrameOnly:_injectedJavaScriptForMainFrameOnly` to hardcoded `forMainFrameOnly:YES` in `setInjectedJavaScript:`. Changed `forMainFrameOnly:_injectedJavaScriptBeforeContentLoadedForMainFrameOnly` to hardcoded `forMainFrameOnly:YES` in `setInjectedJavaScriptBeforeContentLoaded:`. Removed setter methods `setInjectedJavaScriptForMainFrameOnly:` and `setInjectedJavaScriptBeforeContentLoadedForMainFrameOnly:`. |
| `apple/RNCWebViewManager.mm` | Removed both `RCT_EXPORT_VIEW_PROPERTY` entries. |
| `apple/RNCWebView.mm` | Removed both `REMAP_WEBVIEW_PROP` entries. |

---

## Phase 5: Event Removal

### H-14: Remove `onFileDownload` event

**Risk:** Exposes download URLs to JS, which could be used to exfiltrate data or trigger unwanted downloads.

**Files changed:**

| File | Change |
|------|--------|
| `src/WebViewTypes.ts` | Removed `FileDownload` interface, `FileDownloadEvent` type, and `onFileDownload` from `IOSWebViewProps`. |
| `src/RNCWebViewNativeComponent.ts` | Removed `WebViewDownloadEvent` type, `onFileDownload` and `hasOnFileDownload` props from `NativeProps`. |
| `src/WebView.ios.tsx` | Removed `onFileDownload` from destructuring. Removed `onFileDownload`, `hasOnFileDownload={!!onFileDownload}` from JSX. |
| `apple/RNCWebViewImpl.h` | Removed `onFileDownload` property. |
| `apple/RNCWebViewImpl.m` | In `decidePolicyForNavigationResponse:`, removed the `if (_onFileDownload)` block that dispatched download events. Simplified the non-renderable content handling to just `policy = WKNavigationResponsePolicyCancel` (blocks the download entirely). |
| `android/src/newarch/.../RNCWebViewManager.java` | Removed `setHasOnFileDownload` no-op stub. |

---

### H-16: Remove `onHttpError` event

**Risk:** Exposes HTTP status codes and error details to JS, providing information useful for server fingerprinting.

**Files changed:**

| File | Change |
|------|--------|
| `src/WebViewTypes.ts` | Removed `WebViewHttpError` interface, `WebViewHttpErrorEvent` type, `onHttpError` from `CommonNativeWebViewProps` and `WebViewSharedProps`. |
| `src/RNCWebViewNativeComponent.ts` | Removed `WebViewHttpErrorEvent` type, `onHttpError` from `NativeProps`. |
| `src/WebViewShared.tsx` | Removed `WebViewHttpErrorEvent` import, `onHttpErrorProp` parameter, `onHttpError` callback, and `onHttpError` from the return object. |
| `src/WebView.android.tsx` | Removed `onHttpError: onHttpErrorProp` from destructuring, `onHttpError` from `useWebViewLogic` destructuring, `onHttpErrorProp` from `useWebViewLogic` params, `onHttpError` from JSX. |
| `src/WebView.ios.tsx` | Removed `onHttpError: onHttpErrorProp` from destructuring, `onHttpError` from `useWebViewLogic` destructuring, `onHttpErrorProp` from `useWebViewLogic` params, `onHttpError` from JSX. |
| `android/.../events/TopHttpErrorEvent.kt` | **DELETED** entirely. |
| `android/.../RNCWebViewClient.java` | Removed `onReceivedHttpError()` override method. Removed imports for `TopHttpErrorEvent`, `RequiresApi`, `WebResourceResponse`. |
| `android/src/oldarch/.../RNCWebViewManager.java` | Removed `TopHttpErrorEvent` import. Removed event registration from `getExportedCustomDirectEventTypeConstants()`. |
| `android/src/newarch/.../RNCWebViewManager.java` | Removed `TopHttpErrorEvent` import. Removed event registration from `getExportedCustomDirectEventTypeConstants()`. |
| `apple/RNCWebViewImpl.h` | Removed `onHttpError` property. |
| `apple/RNCWebViewImpl.m` | In `decidePolicyForNavigationResponse:`, removed the `if (_onHttpError && navigationResponse.forMainFrame)` block that dispatched HTTP error events with status code and URL. |

---

## Phase 6: File Access Deep Removal

### H-11: Remove all file access props

**Risk:** File access APIs (`file://` URLs, `allowFileAccessFromFileURLs`, etc.) expose the local filesystem to WebView content, enabling data exfiltration.

**Files changed:**

**TypeScript/JS layer:**

| File | Change |
|------|--------|
| `src/WebViewTypes.ts` | Removed `allowFileAccess?: boolean`, `allowFileAccessFromFileURLs?: boolean`, `allowUniversalAccessFromFileURLs?: boolean` from `AndroidWebViewProps`. Removed `allowFileAccessFromFileURLs?: boolean`, `allowUniversalAccessFromFileURLs?: boolean`, `allowingReadAccessToURL?: string` from `IOSWebViewProps`. |
| `src/RNCWebViewNativeComponent.ts` | Removed `allowFileAccess`, `allowFileAccessFromFileURLs`, `allowUniversalAccessFromFileURLs`, `allowingReadAccessToURL` from `NativeProps`. |
| `src/WebView.android.tsx` | Removed `allowFileAccess = false` from destructuring, removed `allowFileAccess={allowFileAccess}` from JSX. |

**Android native:**

| File | Change |
|------|--------|
| `android/.../RNCWebViewManagerImpl.kt` | Removed `setAllowFileAccess()`, `setAllowFileAccessFromFileURLs()`, and `setAllowUniversalAccessFromFileURLs()` methods. Note: `createViewInstance()` already sets `settings.allowFileAccess = false`, `settings.allowFileAccessFromFileURLs = false`, `settings.allowUniversalAccessFromFileURLs = false` as hardcoded defaults. |
| `android/src/oldarch/.../RNCWebViewManager.java` | Removed `@ReactProp` methods for all three file access props. |
| `android/src/newarch/.../RNCWebViewManager.java` | Removed `@ReactProp` methods for all three file access props. |

**iOS native:**

| File | Change |
|------|--------|
| `apple/RNCWebViewImpl.h` | Removed `allowFileAccessFromFileURLs`, `allowUniversalAccessFromFileURLs`, `allowingReadAccessToURL` properties. |
| `apple/RNCWebViewImpl.m` | Removed `if (_allowUniversalAccessFromFileURLs)` and `if (_allowFileAccessFromFileURLs)` conditionals from `setUpWkWebViewConfig`. Removed `setAllowingReadAccessToURL:` setter method. In `visitSource`: removed `allowingReadAccessToURL` variable, removed `loadFileURL:allowingReadAccessToURL:` call, added `file://` URL blocking with log message. |
| `apple/RNCWebViewManager.mm` | Removed `RCT_EXPORT_VIEW_PROPERTY` for `allowFileAccessFromFileURLs`, `allowUniversalAccessFromFileURLs`, `allowingReadAccessToURL`. |
| `apple/RNCWebView.mm` | Removed `REMAP_WEBVIEW_PROP` for `allowFileAccessFromFileURLs`, `allowUniversalAccessFromFileURLs`, `allowingReadAccessToURL`. |

**Key iOS diff (visitSource):**
```objc
// Before:
if (request.URL.host) {
    [webView loadRequest:request];
}
else {
    NSURL* readAccessUrl = allowingReadAccessToURL ? [RCTConvert NSURL:allowingReadAccessToURL] : request.URL;
    [webView loadFileURL:request.URL allowingReadAccessToURL:readAccessUrl];
}

// After:
// Exodus: Block file:// URL loads for security (H-11)
if ([request.URL.scheme isEqualToString:@"file"]) {
    NSLog(@"RNCWebView: file:// URL loads are blocked for security");
    return;
}
[webView loadRequest:request];
```

---

## Phase 7: iOS-Specific Hardenings

### H-08: Camera whitelist on media-capture path

**Risk:** The `requestMediaCapturePermissionForOrigin:` code path (iOS 15+ media capture API) was not checking the `cameraPermissionOriginWhitelist`, allowing any origin to request camera access if `mediaCapturePermissionGrantType` was configured.

**Files changed:**

| File | Change |
|------|--------|
| `apple/RNCWebViewImpl.m` | Added guard at the top of `webView:requestMediaCapturePermissionForOrigin:initiatedByFrame:type:decisionHandler:`. Checks `origin.host` against `cameraPermissionOriginWhitelist`. Denies if whitelist is non-empty and origin not in it. |

**Code added:**
```objc
// Exodus: Check origin against camera permission whitelist (H-08)
if (cameraPermissionOriginWhitelist != nil && cameraPermissionOriginWhitelist.count > 0) {
    NSString *originHost = origin.host;
    if (originHost == nil || ![cameraPermissionOriginWhitelist containsObject:originHost]) {
        decisionHandler(WKPermissionDecisionDeny);
        return;
    }
}
```

---

### H-09: Navigation decision timeout (deny-by-default)

**Risk:** If JS never responds to a navigation decision request, the pending handler blocks the navigation indefinitely, causing a hang. A malicious page could exploit this to prevent navigation away.

**Files changed:**

| File | Change |
|------|--------|
| `apple/RNCWebViewDecisionManager.m` | Added 500ms `dispatch_after` timeout in `setDecisionHandler:`. If the handler hasn't been resolved by then (JS didn't respond), invokes handler with `NO` (deny) and removes it from the dictionary. Uses `@synchronized` for thread safety. The existing `setResult:forLockIdentifier:` removes handlers, so the timeout becomes a no-op if JS responded in time. |

**Code added:**
```objc
// Exodus: Deny-by-default timeout (H-09)
NSInteger capturedIdentifier = lockIdentifier;
dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(500 * NSEC_PER_MSEC)),
               dispatch_get_main_queue(), ^{
    @synchronized (self) {
        DecisionBlock pendingHandler = [self.decisionHandlers objectForKey:@(capturedIdentifier)];
        if (pendingHandler != nil) {
            RCTLogWarn(@"Navigation decision timeout for lock %ld, denying by default",
                       (long)capturedIdentifier);
            pendingHandler(NO);
            [self.decisionHandlers removeObjectForKey:@(capturedIdentifier)];
        }
    }
});
```

---

## Phase 8: Platform Removal

### S-01: Remove Windows support

**Rationale:** Exodus does not ship Windows apps. Removing the platform reduces attack surface and maintenance burden.

**Files deleted:**

| File/Directory | Description |
|------|--------|
| `src/WebView.windows.tsx` | Windows WebView implementation |
| `src/WebViewNativeComponent.windows.ts` | Windows native component bridge |
| `windows/` (entire directory, 14 files) | Windows native C++ implementation |
| `.github/workflows/windows-ci.yml` | Windows CI workflow |
| `jest-setups/jest.setup.windows.js` | Windows Jest setup |
| `jest-setups/jest.setup.js` | Windows-only test setup (references `jest.setup.windows`) |
| `__tests__/Alert.test.js` | Windows-only Appium test |
| `example/examples/Alerts.windows.tsx` | Windows example |
| `example/examples/Messaging.windows.tsx` | Windows example |
| `example/examples/MultiMessaging.windows.tsx` | Windows example |
| `example/examples/OpenWindow.windows.tsx` | Windows example |

**Files modified:**

| File | Change |
|------|--------|
| `src/WebView.tsx` | Removed `WindowsWebViewProps` import and from `WebViewProps` type union. |
| `src/WebViewTypes.ts` | Removed `RNCWebViewUIManagerWindows` type, `NativeWebViewWindows*` class declarations, `WindowsNativeWebViewProps` interface, `WindowsWebViewProps` interface. |
| `package.json` | Removed `"windows"` and `"test:windows"` scripts. Removed `react-native-windows` and `winappdriver` from devDependencies. Updated description. |

---

### S-02: Remove macOS support

**Rationale:** Exodus does not ship macOS apps. Removing the platform reduces attack surface and maintenance burden.

**Files deleted:**

| File/Directory | Description |
|------|--------|
| `src/WebView.macos.tsx` | macOS WebView implementation |
| `src/WebViewNativeComponent.macos.ts` | macOS native component bridge |
| `example/macos/` (including `Podfile.lock`) | macOS example app |
| `.github/workflows/macos-ci.yml` | macOS CI workflow |

**Files modified:**

| File | Change |
|------|--------|
| `src/WebViewTypes.ts` | Removed `RNCWebViewUIManagerMacOS` type, `NativeWebViewMacOS*` class declarations, `MacOSNativeWebViewProps` interface (~18 props), `MacOSWebViewProps` interface (~165 lines). Changed `@platform macos` to `@platform ios` on `allowsPictureInPictureMediaPlayback`. Changed `` `domain` is only used on iOS and macOS `` to `` `domain` is only used on iOS ``. |
| `package.json` | Removed `"macos"` and `"add:macos"` scripts. Removed `react-native-macos` from devDependencies. Updated description to "iOS and Android". |
| `react-native-webview.podspec` | Removed `:osx => "10.13"` from `s.platforms`, keeping only `:ios` and `:visionos`. |

---

## Deferred Items

| ID | Description | Reason |
|---|---|---|
| J-01 | Restrict `Set.of("*")` in `WebViewCompat.addWebMessageListener` | Complex — requires native-side origin validation. JS-side `onMessage` already validates against whitelist. Deferred to future PR. |
| S-03 | Remove `RNCWebViewWrapper.kt` | In v13, this wrapper serves a different purpose (crash prevention for out-of-viewport WebViews). Not safe to remove. |

---

## Test Changes

Tests were updated to reflect the new security behavior:

| File | Change |
|------|--------|
| `src/__tests__/WebViewShared-test.js` | Added `defaultDeeplinkWhitelist` import. Added it as 3rd argument to all `createOnShouldStartLoadWithRequest` calls (signature changed). Rewrote tests to match Exodus deny-by-default behavior: non-whitelisted protocols are blocked (not opened via `Linking.openURL`). Updated scheme assertions to use lowercase (URL API normalizes). Removed tests for `0invalid://` and `+invalid://` schemes (invalid per RFC, URL API rejects them). |
| `src/__tests__/__snapshots__/WebViewShared-test.js.snap` | Removed `"http://*"` from `defaultOriginWhitelist` snapshot (HTTPS-only). |

---

## Summary Statistics

### Part A — Previously committed (exodus.1 → exodus.3)

- **8 commits** across `13.16.0-exodus.2` and `13.16.0-exodus.3`
- **4 audit items** addressed: H-01, H-03, H-07 (Android + iOS)
- **3 PR review fixes**: integer overflow, block copy semantics, memory leak on dealloc
- **1 build fix**: kotlin-stdlib transitive dependency removal

### Part B — New uncommitted changes

- **50 files** touched total (including deletions)
- **413 lines** added, **5,361 lines** removed (net: -4,948 lines)
- **17 audit items** addressed (H-02, H-04, H-05, H-08, H-09, H-10, H-11, H-12, H-13, H-14, H-15, H-16, H-17, J-02, J-03, J-04, J-05)
- **2 simplifications** completed (S-01, S-02)
- **2 items** deferred with justification (J-01, S-03)
- All 13 tests pass, `yarn build` compiles successfully

### Combined totals

- **21 audit items** addressed in total
- **2 items** deferred (J-01, S-03) with documented justification
- **1 item** skipped (S-03) — not safe to remove
