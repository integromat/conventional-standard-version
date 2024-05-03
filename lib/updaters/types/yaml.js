const detectIndent = require('detect-indent')
const yaml = require('js-yaml')

module.exports.readVersion = function (contents) {
  return yaml.load(contents).version
}

module.exports.writeVersion = function (contents, version) {
  const data = yaml.load(contents)
  const indent = detectIndent(contents).indent
  data.version = version
  if (data.appVersion) {
    if (typeof data.appVersion === 'string' && data.appVersion.startsWith('v')) {
      data.appVersion = `v${version}`
    } else {
      data.appVersion = version
    }
  }
  return yaml.dump(data, { indent: indent })
}
