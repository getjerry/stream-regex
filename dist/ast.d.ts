export interface AST {
    type: string;
    value: AST[];
}
/**
 * Convert regex to AST.
 *
 * @param regex
 */
export declare const getAST: (regex: RegExp) => AST;
/**
 * Gets the terminal value of a partial AST.
 *
 * @param node
 */
export declare const getValue: (node: AST) => string;
