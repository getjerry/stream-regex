import map from 'lodash/map';

import g from './grammar/regex.ohm-bundle';

// Convert regex grammar to syntax tree.
const semantics
  = g.createSemantics()
    .addOperation('toAST', {
      _iter(...children) {
        return {
          type: this.ctorName,
          value: map(children, (child) => child.toAST()),
        }
      },
      _terminal() {
        return {
          type: this.ctorName,
          value: [this.sourceString],
        }
      },
      _nonterminal(...children) {
        return {
          type: this.ctorName,
          value: map(children, (child) => child.toAST()),
        }
      },
    });

// AST interface.
export interface AST {
  type: string;
  value: AST[];
}

/**
 * Convert regex to AST.
 *
 * @param regex
 */
export const getAST = (regex: RegExp): AST => {
  try {
    return semantics(g.match(regex.source)).toAST();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unable to parse regex (probably not supported by this library).';
    throw new SyntaxError(`Unable to parse regex: ${msg}. This is probably a limitation of this library and not an error in the input expression.`);
  }
};

/**
 * Gets the terminal value of a partial AST.
 *
 * @param node
 */
export const getValue = (node: AST): string => {
  if (node.type === '_terminal') {
    return (new String(node.value[0])).toString();
  }

  return map(node.value, (child) => getValue(child)).join('');
}
