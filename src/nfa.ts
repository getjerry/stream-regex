import { Readable, PassThrough } from 'stream';

import debug from 'debug';
import Graphemer from 'graphemer';
import each from 'lodash/each';
import isNil from 'lodash/isNil';
import range from 'lodash/range';
import some from 'lodash/some';
import every from 'lodash/every';
import isArray from 'lodash/isArray';
import reduce from 'lodash/reduce';
import map from 'lodash/map';

import type { AST } from './ast';
import { getAST, getValue } from './ast';

const debugLogger = debug('NFA');

export interface PostfixNode {
  from: string;
  type: string;
  value: string | string[];
  notEqual?: boolean;
}

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
const createRangePostfixNodes = (node: AST, start: string, end: string, pfNodes: PostfixNode[], notEqual?: boolean): PostfixNode[] => {
  const newNodes = [...pfNodes];
  each(range(start.charCodeAt(0), end.charCodeAt(0) + 1), (charCode) => {
    newNodes.push({ from: node.type, type: 'operand', value: String.fromCharCode(charCode), notEqual });
    if (newNodes.length > 1) {
      newNodes.push({ from: node.type, type: 'operator', value: '|' });
    }
  });
  return newNodes;
}

const createPostfixNodesWithQuantifier = (operands: PostfixNode[], quantifier: PostfixNode[]): PostfixNode[] => {
  // Single character quantifier (`?` or `*` or `+`)
  if (quantifier.length <= 1) {
    return [
      ...operands,
      ...quantifier,
    ];
  }
  // Range quantifier (`{m,n}`)
  const minStr = quantifier[0].value;
  const maxStr = quantifier[1].value;
  if (isArray(minStr) || isArray(maxStr)) {
    throw new Error(`Invalid quantifier: ${minStr} - ${maxStr}`);
  }

  const min = minStr ? parseInt(minStr, 10) : 0;
  const max = maxStr ? parseInt(maxStr, 10) : -1;
  if (max !== -1 && max < min) {
    throw new Error(`Invalid quantifier: ${min} - ${max}`);
  }

  // To handle the `min`, we concatenate the operands `min` times.
  let pushCount = 0;
  const res: PostfixNode[] = [];
  each(range(0, min), () => {
    res.push(...operands);
    pushCount++;
    if (pushCount > 1) {
      res.push({ from: 'quantifier', type: 'operator', value: '.' });
    }
  });

  // If max is not specified (i.e. -1), then we match 0 or more times.
  if (max === -1) {
    res.push(...operands);
    res.push({ from: 'quantifier', type: 'operator', value: '*' });
    pushCount++;
    if (pushCount > 1) {
      res.push({ from: 'quantifier', type: 'operator', value: '.' });
    }
  } else {
    // To handle the `max`, we add the operands "optionally" `max - min` times.
    each(range(min, max), () => {
      res.push(...operands);
      res.push({ from: 'quantifier', type: 'operator', value: '?' });
      pushCount++;
      if (pushCount > 1) {
        res.push({ from: 'quantifier', type: 'operator', value: '.' });
      }
    });
  }

  return res;
}

/**
 * Converts an AST to postfix notation.
 *
 * @param regex
 */
export const createPostfix = (regex: RegExp) => {
  let hasEndMatcher = false;
  let hasStartMatcher = false;

  /**
   * Recursively creates the postfix notation.
   *
   * @param node
   * @param notEqual - If true, the node character value is matched against any character except the one specified.
   */
  const _createPostfix = (node: AST, notEqual: boolean | undefined): PostfixNode[] => {
    switch (node.type) {
      case 'expression':
      {
        hasStartMatcher = node.value[0].value.length !== 0;
        const pfNodes: PostfixNode[] = [];
        each([node.value[1], ...node.value[3].value], (subExp, idx) => {
          pfNodes.push(..._createPostfix(subExp, notEqual));
          if (idx > 0 && idx <= node.value[3].value.length) {
            pfNodes.push({ from: node.type, type: 'operator', value: '|' });
          }
        });
        return pfNodes;
      }
      case 'subExpression':
      {
        // This node is an iteration list. Unroll.
        const expressionItems = node.value[0].value;
        const pfNodes: PostfixNode[] = [];
        each(expressionItems, (expressionItem, idx) => {
          hasEndMatcher = getValue(expressionItem) === '$';
          if (hasEndMatcher) {
            return false;
          }
          pfNodes.push(..._createPostfix(expressionItem, notEqual));
          if (idx > 0 && idx < expressionItems.length) {
            pfNodes.push({ from: node.type, type: 'operator', value: '.' });
          }
        });
        return pfNodes;
      }
      case 'characterGroupInner':
      {
        // This node is an iteration list. Unroll.
        const expressionItems = node.value[0].value;
        const pfNodes: PostfixNode[] = [];
        each(expressionItems, (expressionItem, idx) => {
          // Character groups with the '^' exclusion character need to have have all characters in a single node.
          if (!notEqual) {
            pfNodes.push(..._createPostfix(expressionItem, notEqual));
          } else {
            const pfNode: PostfixNode = reduce(_createPostfix(expressionItem, notEqual), (memo, n) => ({
              ...memo,
              value: [...memo.value, ...n.value],
            }), {
              from: node.type,
              type: 'operand',
              value: [] as string[],
              notEqual,
            });
            if (idx === 0) {
              pfNodes.push(pfNode);
            } else {
              pfNodes[0].value = [...pfNodes[0].value, ...pfNode.value];
            }
          }

          // Character groups without the '^' exclusion character need to have an OR operator between each character.
          if (!notEqual && idx > 0 && idx < expressionItems.length) {
            pfNodes.push({ from: node.type, type: 'operator', value: '|' });
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
        const quantifier = node.value[4].value.length ? _createPostfix(node.value[4].value[0], notEqual) : [];
        const operands = _createPostfix(node.value[2], notEqual);
        return createPostfixNodesWithQuantifier(operands, quantifier);
        // return [
        //   ..._createPostfix(node.value[2], notEqual),
        //   ...(quantifier ? [{ from: node.type, type: 'operator', value: quantifier }] : []),
        // ];
      }
      case 'match':
      {
        const quantifier = node.value[1].value.length ? _createPostfix(node.value[1].value[0], notEqual) : [];
        const operands = _createPostfix(node.value[0], notEqual);
        return createPostfixNodesWithQuantifier(operands, quantifier);
        // return [
        //   ..._createPostfix(node.value[0], notEqual),
        //   ...(quantifier ? [{ from: node.type, type: 'operator', value: quantifier }] : []),
        // ];
      }
      case 'quantifier':
        return _createPostfix(node.value[0], notEqual);
      case 'quantifierType':
        if (node.value.length === 0) {
          return [];
        }
        if (node.value[0].value.length === 1) {
          return [{ from: node.type, type: 'operator', value: getValue(node) }];
        }
        return _createPostfix(node.value[0], notEqual);
      case 'matchCount1':
      {
        const count = getValue(node.value[1]);
        return [{ from: node.type, type: 'operator', value: count }, { from: node.type, type: 'operator', value: count }];
      }
      case 'matchCount2':
        return [{ from: node.type, type: 'operator', value: getValue(node.value[1]) }, { from: node.type, type: 'operator', value: getValue(node.value[3]) }];
      case 'character':
      case 'characterClass':
      {
        let val = getValue(node);
        if (node.type !== 'characterClass') {
          val = val.replace(/^\\/, '');
          return [{ from: node.type, type: 'operand', value: val, notEqual }];
        }
        switch (val) {
          case '\\w':
          {
            let pfNodes: PostfixNode[] = [];
            pfNodes = createRangePostfixNodes(node, 'a', 'z', pfNodes, notEqual);
            pfNodes = createRangePostfixNodes(node, 'A', 'Z', pfNodes, notEqual);
            pfNodes = createRangePostfixNodes(node, '0', '9', pfNodes, notEqual);
            pfNodes.push({ from: node.type, type: 'operand', value: '_', notEqual: notEqual });
            pfNodes.push({ from: node.type, type: 'operator', value: '|' });
            return pfNodes;
          }
          case '\\W':
            return [{
              from: node.type,
              type: 'operand',
              value: map([
                ...range('a'.charCodeAt(0), 'z'.charCodeAt(0) + 1),
                ...range('A'.charCodeAt(0), 'Z'.charCodeAt(0) + 1),
                ...range('0'.charCodeAt(0), '9'.charCodeAt(0) + 1),
                '_'.charCodeAt(0),
              ], (charCode) => String.fromCharCode(charCode)),
              notEqual: true,
            }];
          case '\\d':
            return createRangePostfixNodes(node, '0', '9', [], notEqual);
          case '\\D':
            return [{
              from: node.type,
              type: 'operand',
              value: map(range('0'.charCodeAt(0), '9'.charCodeAt(0) + 1), (charCode) => String.fromCharCode(charCode)),
              notEqual: true,
            }];
          case '\\s':
          {
            const pfNodes: PostfixNode[] = [];
            pfNodes.push({ from: node.type, type: 'operand', value: ' ', notEqual: notEqual });
            pfNodes.push({ from: node.type, type: 'operand', value: '\t', notEqual: notEqual });
            pfNodes.push({ from: node.type, type: 'operator', value: '|' });
            pfNodes.push({ from: node.type, type: 'operand', value: '\n', notEqual: notEqual });
            pfNodes.push({ from: node.type, type: 'operator', value: '|' });
            pfNodes.push({ from: node.type, type: 'operand', value: '\r', notEqual: notEqual });
            pfNodes.push({ from: node.type, type: 'operator', value: '|' });
            pfNodes.push({ from: node.type, type: 'operand', value: '\f', notEqual: notEqual });
            pfNodes.push({ from: node.type, type: 'operator', value: '|' });
            pfNodes.push({ from: node.type, type: 'operand', value: '\v', notEqual: notEqual });
            pfNodes.push({ from: node.type, type: 'operator', value: '|' });
            return pfNodes;
          }
          case '\\S':
            return [{
              from: node.type,
              type: 'operand',
              value: [' ', '\t', '\n', '\r', '\f', '\v'],
              notEqual: true,
            }];
          default:
            throw new Error(`Do not know how to handle: "${val}"`);
        }
      }
      case 'anyChar':
      {
        return [{ from: node.type, type: 'operand', value: '', notEqual: isNil(notEqual) ? true : !notEqual}];
      }
      case 'characterGroup':
      {
        // Check if the '^' slot is not empty. This means that the group is an exclusion group.
        const exclusionGroup = node.value[1].value[0];
        return _createPostfix(node.value[2], exclusionGroup ? true : undefined);
      }
      case 'characterRangeItem':
      {
        const start = getValue(node.value[0]);
        const end = getValue(node.value[2]);
        const pfNodes: PostfixNode[] = [];
        return createRangePostfixNodes(node, start, end, pfNodes, notEqual);
      }
      default:
        throw new Error(`Do not know how to handle: "${node.type}"`);
    }
  };

  return {
    postfix: _createPostfix(getAST(regex), undefined),
    hasStartMatcher,
    hasEndMatcher,
  };
}

export interface State {
  type: 'Split' | 'Match' | 'Char';
  notEqual?: boolean;
  // For `Char` type, this is the character to match.
  char?: string | string[];
  // The next state to go to.
  out: State | null;
  // For `Split` type, this is the second state to go to.
  out1: State | null;
  // This field is used in the NFA stepping algorithm to prevent adding the same state to a list multiple times.
  lastListID?: number;
}

interface FragOutPtr {
  state: State;
  outAttr: 'out' | 'out1';
}

interface Frag {
  start: State;
  out: FragOutPtr[];
}

/**
 * Patches the NFA fragment with the new state.
 * The dangling pointers are set to the provided state.
 *
 * @param ptrList
 * @param state
 */
const patch = (ptrList: FragOutPtr[], state: State) => {
  each(ptrList, (ptr) => {
    if (ptr.state[ptr.outAttr] === null) {
      ptr.state[ptr.outAttr] = state;
    }
  });
}

/**
 * Converts the postfix notation to an NFA.
 *
 * @param postfix
 */
export const postfixToNFA = (postfix: PostfixNode[]): State | undefined => {
  const stack: Frag[] = [];

  each(postfix, (p) => {
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
          stack.push({ start: e1.start, out: e2.out });
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
          const s: State = { type: 'Split', out: e1.start, out1: e2.start };
          stack.push({ start: s, out: [...e1.out, ...e2.out] });
        }
          break;
        // Zero or one
        case '?':
        {
          const e = stack.pop();
          if (!e) {
            throw new Error('Invalid postfix expression');
          }
          const s: State = { type: 'Split', out: e.start, out1: null };
          stack.push({ start: s, out: [{ state: s, outAttr: 'out1' }, ...e.out] });
        }
          break;
        // Zero or more
        case '*':
        {
          const e = stack.pop();
          if (!e) {
            throw new Error('Invalid postfix expression');
          }
          const s: State = { type: 'Split', out: e.start, out1: null };
          patch(e.out, s);
          stack.push({ start: s, out: [{ state: s, outAttr: 'out1' }] });
        }
          break;
        // One or more
        case '+':
        {
          const e = stack.pop();
          if (!e) {
            throw new Error('Invalid postfix expression');
          }
          const s: State = { type: 'Split', out: e.start, out1: null };
          patch(e.out, s);
          stack.push({ start: e.start, out: [{ state: s, outAttr: 'out1' }] });
        }
          break;
        default:
          throw new Error(`Unknown operator: ${p.value}`);
      }
    } else {
      const s: State = { type: 'Char', char: p.value, notEqual: p.notEqual, out: null, out1: null };
      stack.push({ start: s, out: [{ state: s, outAttr: 'out' }] });
    }
  });

  // The stack should have only one fragment left.
  // Patch in the match state.
  const e = stack.pop();
  if (!e) {
    throw new Error('Invalid postfix expression');
  }
  patch(e.out, { type: 'Match', out: null, out1: null });

  return e.start;
};

interface MatchOptions {
  // If true, the algorithm will try to match the longest possible string. If false, it will try to match the shortest possible string.
  // default: true
  greedy?: boolean;
  // If true, the algorithm will try to match all occurrences of the pattern in the input string. If false, it will only try to match the first occurrence.
  // default: false
  global?: boolean;
  // If true, the algorithm will ignore the case of the input string.
  // default: false
  ignoreCase?: boolean;
  // If true, the algorithm will match from the start of the input string.
  // default: false
  matchFromStart?: boolean;
  // If true, the algorithm will match to the end of the input string.
  // default: false
  matchToEnd?: boolean;
  // If provided, the algorithm will replace the matched string with the return value of this function.
  onReplace?: (val: string) => string;
  // Size of the highWaterMark for the processing stream.
  // default: 1024
  processingStreamHighWaterMark?: number;
}

interface _MatchResult {
  matchedValue: string | undefined;
  srcValue: string;
}

/**
 * Runs the NFA on the input string.
 *
 * @param start - The start state of the NFA.
 * @param input - Input stream to match.
 * @param options - Options for the match.
 */
export const match = (start: State, input: Readable, options?: MatchOptions) => {
  // This ID is used to prevent adding the same state to a list multiple times.
  // We do this by giving each state list a unique ID (listID) and then setting the lastList property of the state to the listID.
  // If the lastList property of the state is the same as the listID, we skip adding the state to the list.
  let listID = 1;
  // Default options.
  const opts: MatchOptions = {
    greedy: true,
    global: false,
    ignoreCase: false,
    processingStreamHighWaterMark: 1024,
    ...options,
  };

  /**
   * Adds a state to the list. Handles the split nodes by adding both out and out1 states.
   *
   * @param list
   * @param s
   */
  const addState = (list: State[], s: State | null) => {
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
  }

  /**
   * Runs one step of NFA on the input character.
   * The output is the next state list.
   *
   * @param list
   * @param grapheme - A grapheme is the smallest unit of a writing system that is capable of conveying a distinct meaning.
   */
  const step = (list: State[], grapheme: string) => {
    debugLogger('[step] Step: %o', { listID, grapheme });

    listID++;
    const nextStates: State[] = [];
    each(list, (state) => {
      if (state.type === 'Char' && !isNil(state.char)) {
        const srcGrapheme = opts.ignoreCase ? grapheme.toLowerCase() : grapheme;
        const stateCharArray = isArray(state.char) ? state.char : [state.char];
        const hasMatch = every(stateCharArray, (stateChar) => {
          const stateGrapheme = opts.ignoreCase ? stateChar.toLowerCase() : stateChar;
          return (state.notEqual ? stateGrapheme !== srcGrapheme : stateGrapheme === srcGrapheme);
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
  }

  /**
   * Main function. Runs the NFA on the input stream.
   *
   * @param start
   * @param greedy
   * @param highWaterMark
   */
  const _doMatchStream = (start: State, greedy: boolean, highWaterMark?: number) => {
    let list: State[] = [];

    let strBuffer = '';
    let lastMatch: string | undefined = undefined;
    let lastMatchEnd = 0;
    const splitter = new Graphemer();

    const matchStream = new PassThrough({ readableObjectMode: true, writableHighWaterMark: highWaterMark });
    matchStream._write = (chunk, encoding, callback) => {
      const chunkStr = chunk.toString();
      const graphemes = splitter.splitGraphemes(chunkStr);

      for (const grapheme of graphemes) {
        strBuffer += grapheme;

        if (list.length === 0) {
          // Start the state list by adding the start state.
          addState(list, start);
        }

        list = step(list, grapheme);

        // If we have a match, save the match and stop if not greedy.
        if (some(list, (state) => state.type === 'Match')) {
          debugLogger('[_doMatchStream] Has match');
          lastMatch = strBuffer;
          lastMatchEnd = strBuffer.length;

          if (!greedy) {
            matchStream.push({ matchedValue: lastMatch, srcValue: strBuffer });
            strBuffer = '';
            list = [];
            lastMatch = undefined;
            lastMatchEnd = 0;
            addState(list, start);
          }
        }

        // If we have no more states to go to, then there is a mismatch. Exit early.
        if (list.length === 0) {
          debugLogger('[_doMatchStream] No match - early exit');
          matchStream.push({ matchedValue: lastMatch, srcValue: lastMatch ? strBuffer.substring(0, strBuffer.length - grapheme.length) : strBuffer });
          strBuffer = '';
          list = [];
          if (lastMatch) {
            lastMatch = undefined;
            // Move back one grapheme
            strBuffer = grapheme;
            addState(list, start);
          }
        }
      }

      callback();
    };

    // Flush any pending match.
    matchStream._final = (callback) => {
      if (lastMatch) {
        matchStream.push({ matchedValue: lastMatch, srcValue: strBuffer.substring(0, lastMatchEnd) });
        strBuffer = strBuffer.substring(lastMatchEnd);
      }
      if (strBuffer.length > 0) {
        matchStream.push({ matchedValue: undefined, srcValue: strBuffer });
      }
      callback();
    }

    return matchStream;
  };

  /**
   * Entry point for running the NFA on the input stream. This function progressively matches the input stream.
   *
   * @param start
   * @param input
   * @param options
   */
  const doMatchStream = (start: State, input: Readable, options: MatchOptions) => {
    // Output stream.
    const replaceStream = new Readable();
    // TODO: Respect the highWaterMark.
    replaceStream._read = () => {};

    // First match success flag.
    let matchSucceeded = false;
    // Most recent matched string.
    let lastMatchedString: string | undefined = undefined;
    // Reject matching flag.
    let rejectMatching = false;

    const matchStream = _doMatchStream(start, options.greedy || false, options.processingStreamHighWaterMark);
    input
      .pipe(matchStream)
      .on('data', ({ matchedValue, srcValue }: _MatchResult) => {
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
            replaceStream.push(str)
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
      })
      .on('finish', () => {
        // If we're matching to the end of stream, if a match has survived, run the replacement process and push to output.
        if (options.matchToEnd) {
          if (lastMatchedString) {
            replaceStream.push(options.onReplace ? options.onReplace(lastMatchedString) : lastMatchedString);
          }
        }
        replaceStream.push(null);
      });

    return replaceStream;
  }

  // Start the NFA.
  return doMatchStream(start, input, opts);
};
