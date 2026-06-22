import React, {Component} from 'react';
import {View, Text, StyleSheet} from 'react-native';

import WebView from 'react-native-webview';

/**
 * Security regression test for top-frame-only postMessage.
 *
 * The top frame and an embedded iframe both try to reach native via
 * `window.ReactNativeWebView.postMessage`. Only the top frame's message must
 * arrive at `onMessage`:
 *  - iOS injects the bridge with forMainFrameOnly:YES, so the iframe never has
 *    access to window.ReactNativeWebView.
 *  - Android injects the bridge into every frame, but RNCWebView.onPostMessage
 *    drops any message where isMainFrame == false.
 *
 * Expected result: a single "TOP_FRAME" message is received. If a message
 * tagged "IFRAME" ever arrives, the top-frame restriction has regressed.
 */
const IFRAME_HTML = `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"></head>
  <body>
    <script>
      // This runs inside the iframe. On a correctly hardened build this call
      // is either impossible (bridge absent on iOS) or ignored natively
      // (isMainFrame === false on Android).
      try {
        window.ReactNativeWebView.postMessage('IFRAME');
      } catch (e) {
        // Bridge not present in this frame (expected on iOS).
      }
    </script>
    <p>evil iframe</p>
  </body>
</html>`;

const TOP_HTML = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=320, user-scalable=no">
  </head>
  <body>
    <p>top frame</p>
    <iframe
      style="width:100%;height:80px;border:1px solid #c00"
      srcdoc="${IFRAME_HTML.replace(/"/g, '&quot;')}"
    ></iframe>
    <script>
      // The top frame is allowed to message native.
      window.ReactNativeWebView.postMessage('TOP_FRAME');
    </script>
  </body>
</html>`;

type Props = {};
type State = {received: string[]};

export default class IframeMessaging extends Component<Props, State> {
  state: State = {received: []};

  render() {
    const {received} = this.state;
    const iframeLeaked = received.includes('IFRAME');
    return (
      <View style={{flex: 1}}>
        <View style={styles.report}>
          <Text style={styles.heading}>Messages received by native:</Text>
          <Text testID="iframeMessaging_received">
            {received.length ? received.join(', ') : '(none yet)'}
          </Text>
          <Text
            testID="iframeMessaging_verdict"
            style={[styles.verdict, iframeLeaked ? styles.fail : styles.pass]}>
            {iframeLeaked
              ? 'FAIL: iframe message reached native'
              : 'PASS: iframe message blocked'}
          </Text>
        </View>
        <WebView
          source={{html: TOP_HTML}}
          originWhitelist={['*']}
          automaticallyAdjustContentInsets={false}
          onMessage={(e: {nativeEvent: {data?: string}}) => {
            const data = e.nativeEvent.data;
            if (data) {
              this.setState((prev) => ({received: [...prev.received, data]}));
            }
          }}
        />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  report: {padding: 12, backgroundColor: '#eee'},
  heading: {fontWeight: 'bold', marginBottom: 4},
  verdict: {marginTop: 8, fontWeight: 'bold'},
  pass: {color: '#0a0'},
  fail: {color: '#c00'},
});
