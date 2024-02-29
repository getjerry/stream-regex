"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.StreamRegex = void 0;
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
   * 
   * @param input
   * @param options
   */
  match(input, onMatch, options = {}) {
    const opts = {
      global: this.regex.global,
      ignoreCase: this.regex.ignoreCase,
      matchFromStart: this.hasStartMatcher,
      matchToEnd: this.hasEndMatcher,
      greedy: true,
      onMatch,
      ...options
    };
    (0, _nfa.match)(this.nfa, input, opts);
  }

  /**
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
    const output = (0, _nfa.match)(this.nfa, input, opts);
    if (!output) {
      // This should never happen.
      throw new Error('Matcher did not return an output stream.');
    }
    return output;
  }
}
exports.StreamRegex = StreamRegex;
//# sourceMappingURL=stream-regex.js.map