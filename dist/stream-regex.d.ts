/// <reference types="node" />
import { Readable } from 'stream';
export interface MatchOptions {
    greedy?: boolean;
    processingStreamHighWaterMark?: number;
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
     * Match the input stream against the regex.
     * This reuses the `replace` function by providing a replacement that does not change the input.
     * Instead, it just pushes the matches into a separate output stream.
     *
     * @param input
     * @param options
     */
    match(input: Readable, options?: MatchOptions): Readable;
    /**
     * Replace the matches in the input stream with the replacement.
     *
     * @param input
     * @param replacement
     */
    replace(input: Readable, replacement: string | ((match: string, ...args: any[]) => string), options?: MatchOptions): Readable;
}
