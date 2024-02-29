/// <reference types="node" />
import { Readable } from 'stream';
export interface PostfixNode {
    from: string;
    type: string;
    value: string | string[];
    notEqual?: boolean;
}
/**
 * Converts an AST to postfix notation.
 *
 * @param regex
 */
export declare const createPostfix: (regex: RegExp) => {
    postfix: PostfixNode[];
    hasStartMatcher: boolean;
    hasEndMatcher: boolean;
};
export interface State {
    type: 'Split' | 'Match' | 'Char';
    notEqual?: boolean;
    char?: string | string[];
    out: State | null;
    out1: State | null;
    lastListID?: number;
}
/**
 * Converts the postfix notation to an NFA.
 *
 * @param postfix
 */
export declare const postfixToNFA: (postfix: PostfixNode[]) => State | undefined;
interface MatchOptions {
    greedy?: boolean;
    global?: boolean;
    ignoreCase?: boolean;
    matchFromStart?: boolean;
    matchToEnd?: boolean;
    onReplace?: (val: string) => string;
}
/**
 * Runs the NFA on the input string.
 *
 * @param start - The start state of the NFA.
 * @param input - Input stream to match.
 * @param options - Options for the match.
 */
export declare const match: (start: State, input: Readable, options?: MatchOptions) => Readable;
export {};
