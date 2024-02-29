import { Readable } from 'stream';

import debug from 'debug';
import isString from 'lodash/isString';

import { PostfixNode, createPostfix, postfixToNFA, State, match } from './nfa';

const debugLogger = debug('StreamRegex');

export interface MatchOptions {
  greedy?: boolean;
}

/**
 * StreamRegex - A class to handle regex matching on a stream of data.
 */
export class StreamRegex {
  private postfix: PostfixNode[];
  private hasStartMatcher: boolean;
  private hasEndMatcher: boolean;

  private nfa: State;


  constructor(private readonly regex: RegExp) {
    const res = createPostfix(regex)
    debugLogger('Postfix: %o', res);

    this.postfix = res.postfix;
    this.hasStartMatcher = res.hasStartMatcher;
    this.hasEndMatcher = res.hasEndMatcher;

    const nfa = postfixToNFA(this.postfix);
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
  match(input: Readable, onMatch: (match: string) => void, options: MatchOptions = {}): void {
    const opts = {
      global: this.regex.global,
      ignoreCase: this.regex.ignoreCase,
      matchFromStart: this.hasStartMatcher,
      matchToEnd: this.hasEndMatcher,
      greedy: true,
      onMatch,
      ...options,
    }

    match(this.nfa, input, opts);
  }

  /**
   * 
   * @param input
   * @param replacement
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  replace(input: Readable, replacement: string | ((match: string, ...args: any[]) => string), options: MatchOptions = {}): Readable {
    const opts = {
      global: this.regex.global,
      ignoreCase: this.regex.ignoreCase,
      matchFromStart: this.hasStartMatcher,
      matchToEnd: this.hasEndMatcher,
      greedy: true,
      onReplace: (v: string) => { 
        return isString(replacement) ? v.replace(this.regex, replacement) :  v.replace(this.regex, replacement);
      },
      ...options,
    }

    const output = match(this.nfa, input, opts);
    if (!output) {
      // This should never happen.
      throw new Error('Matcher did not return an output stream.');
    }
    return output;
  }
}