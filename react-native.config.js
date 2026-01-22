const project = (() => {
  const path = require('path');
  try {
    const { configureProjects } = require('react-native-test-app');
    return configureProjects({
      android: {
        sourceDir: path.join('example', 'android'),
      },
      ios: {
        sourceDir: 'example/ios',
      },
      windows: {
        sourceDir: path.join('example', 'windows'),
        solutionFile: path.join('example', 'windows', 'WebviewExample.sln'),
      },
    });
  } catch (e) {
    return undefined;
  }
})();

module.exports = {
  dependency: {
    platforms: {
      ios: {
        podspecPath: __dirname + '/react-native-webview.podspec',
      },
      windows: {
        sourceDir: 'windows',
        solutionFile: 'ReactNativeWebView.sln',
        projects: [
          {
            projectFile: 'ReactNativeWebView/ReactNativeWebView.vcxproj',
            directDependency: true,
          },
        ],
      },
    },
  },
  ...(project ? { project } : undefined),
};
