/// <reference types="node" />
import { Readable } from 'stream';
export interface MatchOptions {
    greedy?: boolean;
}
/**
 * StreamRegex - A class to handle regex matching on a stream of data.
 */
export declare class StreamRegex {
    private readonly regex;
    private postfix;
    private hasStartMatcher;
    private hasEndMatcher;
    private nfa;
    constructor(regex: RegExp);
    /**
     *
     * @param input
     * @param options
     */
    match(input: Readable, onMatch: (match: string) => void, options?: MatchOptions): void;
    /**
     *
     * @param input
     * @param replacement
     */
    replace(input: Readable, replacement: string | ((match: string, ...args: any[]) => string), options?: MatchOptions): Readable;
}
