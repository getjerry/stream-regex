"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getValue = exports.getAST = void 0;
var _map = _interopRequireDefault(require("lodash/map"));
var _regex = _interopRequireDefault(require("./grammar/regex.ohm-bundle"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
// Convert regex grammar to syntax tree.
const semantics = _regex.default.createSemantics().addOperation('toAST', {
  _iter(...children) {
    return {
      type: this.ctorName,
      value: (0, _map.default)(children, child => child.toAST())
    };
  },
  _terminal() {
    return {
      type: this.ctorName,
      value: [this.sourceString]
    };
  },
  _nonterminal(...children) {
    return {
      type: this.ctorName,
      value: (0, _map.default)(children, child => child.toAST())
    };
  }
});

// AST interface.

/**
 * Convert regex to AST.
 *
 * @param regex
 */
const getAST = regex => {
  try {
    return semantics(_regex.default.match(regex.source)).toAST();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unable to parse regex (probably not supported by this library).';
    throw new SyntaxError(`Unable to parse regex: ${msg}. This is probably a limitation of this library and not an error in the input expression.`);
  }
};

/**
 * Gets the terminal value of a partial AST.
 *
 * @param node
 */
exports.getAST = getAST;
const getValue = node => {
  if (node.type === '_terminal') {
    return new String(node.value[0]).toString();
  }
  return (0, _map.default)(node.value, child => getValue(child)).join('');
};
exports.getValue = getValue;
//# sourceMappingURL=ast.js.map