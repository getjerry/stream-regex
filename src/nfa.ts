import { Readable, PassThrough } from 'stream';

import debug from 'debug';
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
          const quantifier = getValue(node.value[4]);
          return [
            ..._createPostfix(node.value[2], notEqual),
            ...(quantifier ? [{ from: node.type, type: 'operator', value: quantifier }] : []),
          ];
        }
      case 'match':
        {
          const quantifier = getValue(node.value[1]);
          return [
            ..._createPostfix(node.value[0], notEqual),
            ...(quantifier ? [{ from: node.type, type: 'operator', value: quantifier }] : []),
          ];
        }
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
  ignoreCase?: boolean;
  // If true, the algorithm will match from the start of the input string.
  matchFromStart?: boolean;
  // If true, the algorithm will match to the end of the input string.
  matchToEnd?: boolean;
  // Callback that is called when a match is found.
  onMatch?: (val: string) => void;
  // If provided, the algorithm will replace the matched string with the return value of this function.
  onReplace?: (val: string) => string;
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
  const opts = {
    greedy: true,
    global: false,
    ignoreCase: false,
    ...options,
  };
  // Output stream
  const replaceStream = opts.onReplace ? new Readable() : undefined;
  if (replaceStream) {
    replaceStream._read = () => {};
  }
  // First match success flag.
  let matchSucceeded = false;
  // Most recent matched string.
  let lastMatchedString: string | undefined = undefined;
  // Reject matching flag.
  let rejectMatching = false;

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
   * @param char
   */
  const step = (list: State[], char: string) => {
    debugLogger('[step] Step: %o', { listID, char });

    listID++;
    const nextStates: State[] = [];
    each(list, (state) => {
      if (state.type === 'Char' && state.char) {
        const srcChar = opts.ignoreCase ? char.toLowerCase() : char;
        const stateCharArray = isArray(state.char) ? state.char : [state.char];
        const hasMatch = every(stateCharArray, (stateChar) => {
          const stateCharLower = opts.ignoreCase ? stateChar.toLowerCase() : stateChar;
          return (state.notEqual ? stateCharLower !== srcChar : stateCharLower === srcChar);
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
   * @param input
   * @param greedy
   * @param onResult
   */
  const _doMatchStream = (start: State, input: PassThrough, greedy: boolean, onResult: (res: { success: boolean; val?: string; close: boolean; }) => void) => {
    // Start the state list by adding the start state.
    let list: State[] = [];
    addState(list, start);

    let strBuffer = '';
    let lastMatch: string | undefined = undefined;
    let nfaExecuted = false;

    input.on('data', (chunk) => {
      const startBufferLength = strBuffer.length;
      const str: string = chunk.toString();
      strBuffer += str;

      // Run the steps.
      each(str, (char, idx) => {
        nfaExecuted = true;
        // One step.
        list = step(list, char);

        // If we have a match, save the match and stop if not greedy.
        if (some(list, (state) => state.type === 'Match')) {
          debugLogger('[_doMatchStream] Has match');
          lastMatch = strBuffer.substring(0, startBufferLength + idx + 1);
          if (!greedy) {
            input.end();
            return false;
          }
        }

        // If we have no more states to go to, then there is a mismatch. Exit early.
        if (list.length === 0) {
          debugLogger('[_doMatchStream] No match - early exit');
          input.end();
          return false;
        }
      });
    });
    input.on('close', () => {
      debugLogger('[_doMatchStream] input stream closed: %o', lastMatch);
      onResult({ success: !!lastMatch, val: lastMatch, close: !nfaExecuted });
    });
    input.on('end', () => {
      debugLogger('[_doMatchStream] input stream ended: %o', lastMatch);
      onResult({ success: !!lastMatch, val: lastMatch, close: !nfaExecuted });
    });
  };

  /**
   * Creates a processing stream that buffers the string from the input stream, such that we can run the NFA on it.
   *
   * @param input - The input stream.
   * @param onBufferChange - Callback that is called when the buffered string is updated.
   * @param idx - The index to start buffering from.
   * @param bufferedStr - The previously buffered string.
   */
  const createPassThroughStream = (input: Readable, onBufferChange: (newBufferedStr: string) => void, idx = 0, bufferedStr = '') => {
    const procStream = new PassThrough();
    procStream.push(bufferedStr.substring(idx));

    let newBufferedStr = bufferedStr;
    const passThrough = new PassThrough();
    passThrough.on('data', (chunk) => {
      const str: string = chunk.toString();
      newBufferedStr += str;
      onBufferChange(newBufferedStr);

      if (!procStream.writableEnded) {
        procStream.push(str);
      } else {
        input.unpipe(passThrough);
      }
    }).on('end', () => {
      debugLogger('[createPassThroughStream] passThrough stream ended');
      procStream.end();
    });
    procStream.on('end', () => {
      debugLogger('[createPassThroughStream] procStream ended');
      passThrough.end();
    });

    input.pipe(passThrough);
    if (input.readableEnded) {
      debugLogger('[createPassThroughStream] input stream already ended');
      procStream.end();
    }

    return procStream;
  }

  /**
   * Entry point for running the NFA on the input stream. This function progressively matches the input stream.
   *
   * @param start
   * @param input
   * @param options
   * @param idx
   * @param bufferedStr
   */
  const doMatchStream = (start: State, input: Readable, options: MatchOptions, idx = 0, bufferedStr = '') => {
    let strBuffer = bufferedStr;
    const procStream = createPassThroughStream(input, (newBufferedStr) => { strBuffer = newBufferedStr; }, idx, strBuffer);

    let resv: (res: { val?: string; close: boolean }) => void;
    const prom = new Promise<{ val?: string; close: boolean }>((resolve) => { resv = resolve; });

    _doMatchStream(start, procStream, options.greedy || false, ({ success, val, close }) => {
      debugLogger('[doMatchStream] match result: %o', { success, val });
      if (success && !val) {
        // This should not happen.
        throw new Error('Invalid state');
      }
      resv({ val, close });
    });

    prom.then(({ val: matchedStr, close }) => {
      procStream.end();

      debugLogger('[doMatchStream] processing result: %o', { matchedStr, strBuffer, idx });

      const origStr = strBuffer.substring(idx, idx + 1);
      let str = origStr;
      let idxOffset = 1;

      if (matchedStr) {
        idxOffset = matchedStr.length;
        str = matchedStr;

        // If we're not matching globally, then we're done after the first match.
        if (!rejectMatching && (options.global || !matchSucceeded)) {
          if (options.onReplace) {
            str = options.onReplace(matchedStr);
          }

          // If we're not matching to the end of stream, call the onMatch callback.
          if (!options.matchToEnd) {
            options.onMatch?.(matchedStr);
          }
        }
        // If we're not matching to the end of stream, push the matched string to the output stream.
        if (!options.matchToEnd) {
          replaceStream?.push(str)
        }

        // Record this match (used for end matching).
        if (!rejectMatching) {
          lastMatchedString = matchedStr;
        } else {
          lastMatchedString = `${lastMatchedString || ''}${matchedStr}`;
        }

        matchSucceeded = true;
      } else {
        if (!close) {
          rejectMatching = !!options.matchFromStart;
        }
        if (!options.matchToEnd) {
          replaceStream?.push(origStr);
        } else if (!close) {
          if (lastMatchedString) {
            replaceStream?.push(lastMatchedString);
          }
          replaceStream?.push(origStr);
          lastMatchedString = undefined;
        }
      }

      if (idx + idxOffset <= strBuffer.length) {
        doMatchStream(start, input, options, idx + idxOffset, strBuffer);
      } else {
        if (options.matchToEnd) {
          if (lastMatchedString) {
            options.onMatch?.(lastMatchedString);
            replaceStream?.push(!rejectMatching && options.onReplace ? options.onReplace(lastMatchedString) : lastMatchedString);
          }
        }
        replaceStream?.push(null);
      }
    });

    return replaceStream;
  }

  // Start the NFA.
  return doMatchStream(start, input, opts);
};