"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.postfixToNFA = exports.match = exports.createPostfix = void 0;
var _stream = require("stream");
var _debug = _interopRequireDefault(require("debug"));
var _each = _interopRequireDefault(require("lodash/each"));
var _isNil = _interopRequireDefault(require("lodash/isNil"));
var _range = _interopRequireDefault(require("lodash/range"));
var _some = _interopRequireDefault(require("lodash/some"));
var _every = _interopRequireDefault(require("lodash/every"));
var _isArray = _interopRequireDefault(require("lodash/isArray"));
var _reduce = _interopRequireDefault(require("lodash/reduce"));
var _map = _interopRequireDefault(require("lodash/map"));
var _ast = require("./ast");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
const debugLogger = (0, _debug.default)('NFA');
/**
 * Helper function to construct the postfix notation for a range of characters.
 * TODO: This is inefficient. We should construct the NFA from the range directly instead of creating a node for each character.
 *
 * @param node
 * @param start
 * @param end
 * @param pfNodes
 * @param notEqual
 */
const createRangePostfixNodes = (node, start, end, pfNodes, notEqual) => {
  const newNodes = [...pfNodes];
  (0, _each.default)((0, _range.default)(start.charCodeAt(0), end.charCodeAt(0) + 1), charCode => {
    newNodes.push({
      from: node.type,
      type: 'operand',
      value: String.fromCharCode(charCode),
      notEqual
    });
    if (newNodes.length > 1) {
      newNodes.push({
        from: node.type,
        type: 'operator',
        value: '|'
      });
    }
  });
  return newNodes;
};

/**
 * Converts an AST to postfix notation.
 *
 * @param regex
 */
const createPostfix = regex => {
  let hasEndMatcher = false;
  let hasStartMatcher = false;

  /**
   * Recursively creates the postfix notation.
   *
   * @param node
   * @param notEqual - If true, the node character value is matched against any character except the one specified.
   */
  const _createPostfix = (node, notEqual) => {
    switch (node.type) {
      case 'expression':
        {
          hasStartMatcher = node.value[0].value.length !== 0;
          const pfNodes = [];
          (0, _each.default)([node.value[1], ...node.value[3].value], (subExp, idx) => {
            pfNodes.push(..._createPostfix(subExp, notEqual));
            if (idx > 0 && idx <= node.value[3].value.length) {
              pfNodes.push({
                from: node.type,
                type: 'operator',
                value: '|'
              });
            }
          });
          return pfNodes;
        }
      case 'subExpression':
        {
          // This node is an iteration list. Unroll.
          const expressionItems = node.value[0].value;
          const pfNodes = [];
          (0, _each.default)(expressionItems, (expressionItem, idx) => {
            hasEndMatcher = (0, _ast.getValue)(expressionItem) === '$';
            if (hasEndMatcher) {
              return false;
            }
            pfNodes.push(..._createPostfix(expressionItem, notEqual));
            if (idx > 0 && idx < expressionItems.length) {
              pfNodes.push({
                from: node.type,
                type: 'operator',
                value: '.'
              });
            }
          });
          return pfNodes;
        }
      case 'characterGroupInner':
        {
          // This node is an iteration list. Unroll.
          const expressionItems = node.value[0].value;
          const pfNodes = [];
          (0, _each.default)(expressionItems, (expressionItem, idx) => {
            // Character groups with the '^' exclusion character need to have have all characters in a single node.
            if (!notEqual) {
              pfNodes.push(..._createPostfix(expressionItem, notEqual));
            } else {
              const pfNode = (0, _reduce.default)(_createPostfix(expressionItem, notEqual), (memo, n) => ({
                ...memo,
                value: [...memo.value, ...n.value]
              }), {
                from: node.type,
                type: 'operand',
                value: [],
                notEqual
              });
              if (idx === 0) {
                pfNodes.push(pfNode);
              } else {
                pfNodes[0].value = [...pfNodes[0].value, ...pfNode.value];
              }
            }

            // Character groups without the '^' exclusion character need to have an OR operator between each character.
            if (!notEqual && idx > 0 && idx < expressionItems.length) {
              pfNodes.push({
                from: node.type,
                type: 'operator',
                value: '|'
              });
            }
          });
          return pfNodes;
        }
      case 'expressionItem':
      case 'matchCharacterClass':
      case 'characterGroupItem':
      case 'characterRange':
      case 'matchItem':
      case 'group':
        {
          // Should have only one child.
          return _createPostfix(node.value[0], notEqual);
        }
      case 'groupExpression':
        {
          const quantifier = (0, _ast.getValue)(node.value[4]);
          return [..._createPostfix(node.value[2], notEqual), ...(quantifier ? [{
            from: node.type,
            type: 'operator',
            value: quantifier
          }] : [])];
        }
      case 'match':
        {
          const quantifier = (0, _ast.getValue)(node.value[1]);
          return [..._createPostfix(node.value[0], notEqual), ...(quantifier ? [{
            from: node.type,
            type: 'operator',
            value: quantifier
          }] : [])];
        }
      case 'character':
      case 'characterClass':
        {
          let val = (0, _ast.getValue)(node);
          if (node.type !== 'characterClass') {
            val = val.replace(/^\\/, '');
            return [{
              from: node.type,
              type: 'operand',
              value: val,
              notEqual
            }];
          }
          switch (val) {
            case '\\w':
              {
                let pfNodes = [];
                pfNodes = createRangePostfixNodes(node, 'a', 'z', pfNodes, notEqual);
                pfNodes = createRangePostfixNodes(node, 'A', 'Z', pfNodes, notEqual);
                pfNodes = createRangePostfixNodes(node, '0', '9', pfNodes, notEqual);
                pfNodes.push({
                  from: node.type,
                  type: 'operand',
                  value: '_',
                  notEqual: notEqual
                });
                pfNodes.push({
                  from: node.type,
                  type: 'operator',
                  value: '|'
                });
                return pfNodes;
              }
            case '\\W':
              return [{
                from: node.type,
                type: 'operand',
                value: (0, _map.default)([...(0, _range.default)('a'.charCodeAt(0), 'z'.charCodeAt(0) + 1), ...(0, _range.default)('A'.charCodeAt(0), 'Z'.charCodeAt(0) + 1), ...(0, _range.default)('0'.charCodeAt(0), '9'.charCodeAt(0) + 1), '_'.charCodeAt(0)], charCode => String.fromCharCode(charCode)),
                notEqual: true
              }];
            case '\\d':
              return createRangePostfixNodes(node, '0', '9', [], notEqual);
            case '\\D':
              return [{
                from: node.type,
                type: 'operand',
                value: (0, _map.default)((0, _range.default)('0'.charCodeAt(0), '9'.charCodeAt(0) + 1), charCode => String.fromCharCode(charCode)),
                notEqual: true
              }];
            case '\\s':
              {
                const pfNodes = [];
                pfNodes.push({
                  from: node.type,
                  type: 'operand',
                  value: ' ',
                  notEqual: notEqual
                });
                pfNodes.push({
                  from: node.type,
                  type: 'operand',
                  value: '\t',
                  notEqual: notEqual
                });
                pfNodes.push({
                  from: node.type,
                  type: 'operator',
                  value: '|'
                });
                pfNodes.push({
                  from: node.type,
                  type: 'operand',
                  value: '\n',
                  notEqual: notEqual
                });
                pfNodes.push({
                  from: node.type,
                  type: 'operator',
                  value: '|'
                });
                pfNodes.push({
                  from: node.type,
                  type: 'operand',
                  value: '\r',
                  notEqual: notEqual
                });
                pfNodes.push({
                  from: node.type,
                  type: 'operator',
                  value: '|'
                });
                pfNodes.push({
                  from: node.type,
                  type: 'operand',
                  value: '\f',
                  notEqual: notEqual
                });
                pfNodes.push({
                  from: node.type,
                  type: 'operator',
                  value: '|'
                });
                pfNodes.push({
                  from: node.type,
                  type: 'operand',
                  value: '\v',
                  notEqual: notEqual
                });
                pfNodes.push({
                  from: node.type,
                  type: 'operator',
                  value: '|'
                });
                return pfNodes;
              }
            case '\\S':
              return [{
                from: node.type,
                type: 'operand',
                value: [' ', '\t', '\n', '\r', '\f', '\v'],
                notEqual: true
              }];
            default:
              throw new Error(`Do not know how to handle: "${val}"`);
          }
        }
      case 'anyChar':
        {
          return [{
            from: node.type,
            type: 'operand',
            value: '',
            notEqual: (0, _isNil.default)(notEqual) ? true : !notEqual
          }];
        }
      case 'characterGroup':
        {
          // Check if the '^' slot is not empty. This means that the group is an exclusion group.
          const exclusionGroup = node.value[1].value[0];
          return _createPostfix(node.value[2], exclusionGroup ? true : undefined);
        }
      case 'characterRangeItem':
        {
          const start = (0, _ast.getValue)(node.value[0]);
          const end = (0, _ast.getValue)(node.value[2]);
          const pfNodes = [];
          return createRangePostfixNodes(node, start, end, pfNodes, notEqual);
        }
      default:
        throw new Error(`Do not know how to handle: "${node.type}"`);
    }
  };
  return {
    postfix: _createPostfix((0, _ast.getAST)(regex), undefined),
    hasStartMatcher,
    hasEndMatcher
  };
};
exports.createPostfix = createPostfix;
/**
 * Patches the NFA fragment with the new state.
 * The dangling pointers are set to the provided state.
 *
 * @param ptrList
 * @param state
 */
const patch = (ptrList, state) => {
  (0, _each.default)(ptrList, ptr => {
    if (ptr.state[ptr.outAttr] === null) {
      ptr.state[ptr.outAttr] = state;
    }
  });
};

/**
 * Converts the postfix notation to an NFA.
 *
 * @param postfix
 */
const postfixToNFA = postfix => {
  const stack = [];
  (0, _each.default)(postfix, p => {
    if (p.type === 'operator') {
      switch (p.value) {
        // Concatenation
        case '.':
          {
            const e2 = stack.pop();
            const e1 = stack.pop();
            if (!e1 || !e2) {
              throw new Error('Invalid postfix expression');
            }
            patch(e1.out, e2.start);
            stack.push({
              start: e1.start,
              out: e2.out
            });
          }
          break;
        // Alternation
        case '|':
          {
            const e2 = stack.pop();
            const e1 = stack.pop();
            if (!e1 || !e2) {
              throw new Error('Invalid postfix expression');
            }
            const s = {
              type: 'Split',
              out: e1.start,
              out1: e2.start
            };
            stack.push({
              start: s,
              out: [...e1.out, ...e2.out]
            });
          }
          break;
        // Zero or one
        case '?':
          {
            const e = stack.pop();
            if (!e) {
              throw new Error('Invalid postfix expression');
            }
            const s = {
              type: 'Split',
              out: e.start,
              out1: null
            };
            stack.push({
              start: s,
              out: [{
                state: s,
                outAttr: 'out1'
              }, ...e.out]
            });
          }
          break;
        // Zero or more
        case '*':
          {
            const e = stack.pop();
            if (!e) {
              throw new Error('Invalid postfix expression');
            }
            const s = {
              type: 'Split',
              out: e.start,
              out1: null
            };
            patch(e.out, s);
            stack.push({
              start: s,
              out: [{
                state: s,
                outAttr: 'out1'
              }]
            });
          }
          break;
        // One or more
        case '+':
          {
            const e = stack.pop();
            if (!e) {
              throw new Error('Invalid postfix expression');
            }
            const s = {
              type: 'Split',
              out: e.start,
              out1: null
            };
            patch(e.out, s);
            stack.push({
              start: e.start,
              out: [{
                state: s,
                outAttr: 'out1'
              }]
            });
          }
          break;
        default:
          throw new Error(`Unknown operator: ${p.value}`);
      }
    } else {
      const s = {
        type: 'Char',
        char: p.value,
        notEqual: p.notEqual,
        out: null,
        out1: null
      };
      stack.push({
        start: s,
        out: [{
          state: s,
          outAttr: 'out'
        }]
      });
    }
  });

  // The stack should have only one fragment left.
  // Patch in the match state.
  const e = stack.pop();
  if (!e) {
    throw new Error('Invalid postfix expression');
  }
  patch(e.out, {
    type: 'Match',
    out: null,
    out1: null
  });
  return e.start;
};
exports.postfixToNFA = postfixToNFA;
/**
 * Runs the NFA on the input string.
 *
 * @param start - The start state of the NFA.
 * @param input - Input stream to match.
 * @param options - Options for the match.
 */
const match = (start, input, options) => {
  // This ID is used to prevent adding the same state to a list multiple times.
  // We do this by giving each state list a unique ID (listID) and then setting the lastList property of the state to the listID.
  // If the lastList property of the state is the same as the listID, we skip adding the state to the list.
  let listID = 1;
  // Default options.
  const opts = {
    greedy: true,
    global: false,
    ignoreCase: false,
    processingStreamHighWaterMark: 1024,
    ...options
  };

  /**
   * Adds a state to the list. Handles the split nodes by adding both out and out1 states.
   *
   * @param list
   * @param s
   */
  const addState = (list, s) => {
    // If the state is null or the lastList property is the same as the listID, skip adding the state to the list.
    if (s === null || s.lastListID === listID) {
      return;
    }
    s.lastListID = listID;
    // If the state is a split node, add both out and out1 states.
    if (s.type === 'Split') {
      addState(list, s.out);
      addState(list, s.out1);
      return;
    }
    list.push(s);
  };

  /**
   * Runs one step of NFA on the input character.
   * The output is the next state list.
   *
   * @param list
   * @param char
   */
  const step = (list, char) => {
    debugLogger('[step] Step: %o', {
      listID,
      char
    });
    listID++;
    const nextStates = [];
    (0, _each.default)(list, state => {
      if (state.type === 'Char' && !(0, _isNil.default)(state.char)) {
        const srcChar = opts.ignoreCase ? char.toLowerCase() : char;
        const stateCharArray = (0, _isArray.default)(state.char) ? state.char : [state.char];
        const hasMatch = (0, _every.default)(stateCharArray, stateChar => {
          const stateCharLower = opts.ignoreCase ? stateChar.toLowerCase() : stateChar;
          return state.notEqual ? stateCharLower !== srcChar : stateCharLower === srcChar;
        });
        if (hasMatch) {
          debugLogger('[step] Match: %o', state);
          addState(nextStates, state.out);
        } else {
          debugLogger('[step] No match: %o', state);
        }
      }
    });
    debugLogger('[step] Next states: %o', nextStates);
    return nextStates;
  };

  /**
   * Main function. Runs the NFA on the input stream.
   *
   * @param start
   * @param greedy
   * @param highWaterMark
   */
  const _doMatchStream = (start, greedy, highWaterMark) => {
    let list = [];
    let strBuffer = '';
    let lastMatch = undefined;
    const matchStream = new _stream.PassThrough({
      readableObjectMode: true,
      writableHighWaterMark: highWaterMark
    });
    matchStream._write = (chunk, encoding, callback) => {
      const chunkStr = chunk.toString();
      for (let i = 0; i < chunkStr.length; i++) {
        const char = chunkStr[i];
        strBuffer += char;
        if (list.length === 0) {
          // Start the state list by adding the start state.
          addState(list, start);
        }

        // Run one step of the NFA.
        list = step(list, char);

        // If we have a match, save the match and stop if not greedy.
        if ((0, _some.default)(list, state => state.type === 'Match')) {
          debugLogger('[_doMatchStream] Has match');
          lastMatch = strBuffer;
          if (!greedy) {
            matchStream.push({
              matchedValue: lastMatch,
              srcValue: strBuffer
            });
            strBuffer = '';
            list = [];
            lastMatch = undefined;
          }
        }

        // If we have no more states to go to, then there is a mismatch. Exit early.
        if (list.length === 0) {
          debugLogger('[_doMatchStream] No match - early exit');
          matchStream.push({
            matchedValue: lastMatch,
            srcValue: lastMatch ? strBuffer.substring(0, strBuffer.length - 1) : strBuffer
          });
          strBuffer = '';
          list = [];
          if (lastMatch) {
            lastMatch = undefined;
            i--;
          }
        }
      }
      callback();
    };

    // Flush any pending match.
    matchStream._final = callback => {
      matchStream.push({
        matchedValue: lastMatch,
        srcValue: strBuffer
      });
      callback();
    };
    return matchStream;
  };

  /**
   * Entry point for running the NFA on the input stream. This function progressively matches the input stream.
   *
   * @param start
   * @param input
   * @param options
   */
  const doMatchStream = (start, input, options) => {
    // Output stream.
    const replaceStream = new _stream.Readable();
    // TODO: Respect the highWaterMark.
    replaceStream._read = () => {};

    // First match success flag.
    let matchSucceeded = false;
    // Most recent matched string.
    let lastMatchedString = undefined;
    // Reject matching flag.
    let rejectMatching = false;
    const matchStream = _doMatchStream(start, options.greedy || false, options.processingStreamHighWaterMark);
    input.pipe(matchStream).on('data', ({
      matchedValue,
      srcValue
    }) => {
      let str = srcValue;
      if (matchedValue) {
        // If we're not matching globally, then we're done after the first match.
        if (!rejectMatching && (options.global || !matchSucceeded)) {
          if (options.onReplace) {
            str = options.onReplace(matchedValue);
          }
        }
        // Prevent further matching if we're matching globally.
        matchSucceeded = true;

        // If we're not matching to the end of stream, push the matched string to the output stream.
        if (!options.matchToEnd) {
          replaceStream.push(str);
        } else if (!rejectMatching) {
          // Record this match (used for end matching).
          // The replacement processing is done at the end when the stream is finished. If subsequent chunks are not matched, then we'll need the original source string.
          // NOTE: `global` has no effect on `matchToEnd`.
          lastMatchedString = matchedValue;
        }
      } else {
        // Start rejecting future matches after the first non-match if we're matching from the start.
        rejectMatching = !!options.matchFromStart;
        // On a non-match, the last matched string is treated as an unmatched string.
        if (lastMatchedString) {
          replaceStream.push(lastMatchedString);
        }
        replaceStream.push(str);
        lastMatchedString = undefined;
      }
    }).on('finish', () => {
      // If we're matching to the end of stream, if a match has survived, run the replacement process and push to output.
      if (options.matchToEnd) {
        if (lastMatchedString) {
          replaceStream.push(options.onReplace ? options.onReplace(lastMatchedString) : lastMatchedString);
        }
      }
      replaceStream.push(null);
    });
    return replaceStream;
  };

  // Start the NFA.
  return doMatchStream(start, input, opts);
};
exports.match = match;
//# sourceMappingURL=nfa.js.map