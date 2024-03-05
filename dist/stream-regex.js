"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.StreamRegex = void 0;
var _stream = require("stream");
var _debug = _interopRequireDefault(require("debug"));
var _isString = _interopRequireDefault(require("lodash/isString"));
var _nfa = require("./nfa");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
const debugLogger = (0, _debug.default)('StreamRegex');
/**
 * StreamRegex - A class to handle regex matching on a stream of data.
 */
class StreamRegex {
  constructor(regex) {
    this.regex = regex;
    const res = (0, _nfa.createPostfix)(regex);
    debugLogger('Postfix: %o', res);
    this.postfix = res.postfix;
    this.hasStartMatcher = res.hasStartMatcher;
    this.hasEndMatcher = res.hasEndMatcher;
    const nfa = (0, _nfa.postfixToNFA)(this.postfix);
    if (!nfa) {
      throw new Error('Failed to build NFA');
    }
    debugLogger('NFA: %o', nfa);
    this.nfa = nfa;
  }

  /**
   * Match the input stream against the regex.
   * This reuses the `replace` function by providing a replacement that does not change the input.
   * Instead, it just pushes the matches into a separate output stream.
   *
   * @param input
   * @param options
   */
  match(input, options = {}) {
    const output = new _stream.Readable({
      objectMode: true
    });
    output._read = () => {};
    this.replace(input, match => {
      output.push(match);
      return match;
    }, options).resume().on('end', () => {
      output.push(null);
    });
    return output;
  }

  /**
   * Replace the matches in the input stream with the replacement.
   *
   * @param input
   * @param replacement
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  replace(input, replacement, options = {}) {
    const opts = {
      global: this.regex.global,
      ignoreCase: this.regex.ignoreCase,
      matchFromStart: this.hasStartMatcher,
      matchToEnd: this.hasEndMatcher,
      greedy: true,
      onReplace: v => {
        return (0, _isString.default)(replacement) ? v.replace(this.regex, replacement) : v.replace(this.regex, replacement);
      },
      ...options
    };
    return (0, _nfa.match)(this.nfa, input, opts);
  }
}
exports.StreamRegex = StreamRegex;
//# sourceMappingURL=stream-regex.js.map