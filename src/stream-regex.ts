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
   * Match the input stream against the regex.
   * This reuses the `replace` function by providing a replacement that does not change the input.
   * Instead, it just pushes the matches into a separate output stream.
   *
   * @param input
   * @param options
   */
  match(input: Readable, options: MatchOptions = {}): Readable {
    const output = new Readable();
    output._read = () => {};

    this.replace(input, (match) => {
      output.push(match);
      return match;
    }, options).on('data', () => {
      // Do nothing.
    })
    .on('end', () => {
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

    return match(this.nfa, input, opts);
  }
}