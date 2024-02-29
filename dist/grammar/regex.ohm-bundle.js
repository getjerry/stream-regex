'use strict';

const {
  makeRecipe
} = require('ohm-js');
const result = makeRecipe(["grammar", {
  "source": "RegExp {\n  expression = \"^\"? (subExpression ( \"|\" subExpression )*)\n  \n  subExpression = expressionItem*\n  \n  expressionItem\n  \t= anchor\n    | group\n    | match\n//  | Backreference -- Not supported\n\n  group\n  \t= groupExpression\n//  | NamedGroupExpression -- Not supported\n  \n  groupExpression = \"(\" \"?:\"? expression \")\" quantifier?\n  \n// NamedGroupExpression = NamedGroupPrefix Expression \")\" Quantifier?\n   \n  match = matchItem quantifier?\n\n  matchItem = anyChar | matchCharacterClass | character\n\n  anyChar = \".\"\n  \n  escapeCharacter = \"\\\\\"\n\n  specialCharacter = anyChar | \"^\" | \"*\" | \"?\" | \"+\" | \"\\\\\" | \"[\" | \"]\" | \"(\" | \")\" | \"\\\\\\\\\" | \"|\"\n  \n  characterClass = \"\\\\w\" | \"\\\\W\" | \"\\\\d\" | \"\\\\D\" | \"\\\\s\" | \"\\\\S\"\n\n  baseCharacter = ~specialCharacter any\n  \n  character = escapeCharacter specialCharacter | escapeCharacter? baseCharacter\n  \n  matchCharacterClass = characterGroup | characterClass\n  \n  characterGroup = \"[\" \"^\"? characterGroupInner \"]\"\n  \n  characterGroupInner = characterGroupItem*\n  \n  characterGroupItem = characterClass | characterRange | character | anyChar\n  \n  characterRange = characterRangeItem\n  \n  characterRangeItem = alnum \"-\" alnum\n\n  anchor = \"$\"\n  \n  quantifier = quantifierType \"?\"?\n  \n  quantifierType\n    = \"*\"\n    | \"+\"\n    | \"?\"\n//  | matchCount1\n//  | matchCount2\n  \n// matchCount1 = \"{\" digit+ \"}\"\n  \n// matchCount2 = \"{\" digit+ \",\" (digit+)? \"}\"\n}"
}, "RegExp", null, "expression", {
  "expression": ["define", {
    "sourceInterval": [11, 67]
  }, null, [], ["seq", {
    "sourceInterval": [24, 67]
  }, ["opt", {
    "sourceInterval": [24, 28]
  }, ["terminal", {
    "sourceInterval": [24, 27]
  }, "^"]], ["app", {
    "sourceInterval": [30, 43]
  }, "subExpression", []], ["star", {
    "sourceInterval": [44, 66]
  }, ["seq", {
    "sourceInterval": [46, 63]
  }, ["terminal", {
    "sourceInterval": [46, 49]
  }, "|"], ["app", {
    "sourceInterval": [50, 63]
  }, "subExpression", []]]]]],
  "subExpression": ["define", {
    "sourceInterval": [73, 104]
  }, null, [], ["star", {
    "sourceInterval": [89, 104]
  }, ["app", {
    "sourceInterval": [89, 103]
  }, "expressionItem", []]]],
  "expressionItem": ["define", {
    "sourceInterval": [110, 160]
  }, null, [], ["alt", {
    "sourceInterval": [130, 160]
  }, ["app", {
    "sourceInterval": [130, 136]
  }, "anchor", []], ["app", {
    "sourceInterval": [143, 148]
  }, "group", []], ["app", {
    "sourceInterval": [155, 160]
  }, "match", []]]],
  "group": ["define", {
    "sourceInterval": [201, 227]
  }, null, [], ["app", {
    "sourceInterval": [212, 227]
  }, "groupExpression", []]],
  "groupExpression": ["define", {
    "sourceInterval": [277, 331]
  }, null, [], ["seq", {
    "sourceInterval": [295, 331]
  }, ["terminal", {
    "sourceInterval": [295, 298]
  }, "("], ["opt", {
    "sourceInterval": [299, 304]
  }, ["terminal", {
    "sourceInterval": [299, 303]
  }, "?:"]], ["app", {
    "sourceInterval": [305, 315]
  }, "expression", []], ["terminal", {
    "sourceInterval": [316, 319]
  }, ")"], ["opt", {
    "sourceInterval": [320, 331]
  }, ["app", {
    "sourceInterval": [320, 330]
  }, "quantifier", []]]]],
  "match": ["define", {
    "sourceInterval": [411, 440]
  }, null, [], ["seq", {
    "sourceInterval": [419, 440]
  }, ["app", {
    "sourceInterval": [419, 428]
  }, "matchItem", []], ["opt", {
    "sourceInterval": [429, 440]
  }, ["app", {
    "sourceInterval": [429, 439]
  }, "quantifier", []]]]],
  "matchItem": ["define", {
    "sourceInterval": [444, 497]
  }, null, [], ["alt", {
    "sourceInterval": [456, 497]
  }, ["app", {
    "sourceInterval": [456, 463]
  }, "anyChar", []], ["app", {
    "sourceInterval": [466, 485]
  }, "matchCharacterClass", []], ["app", {
    "sourceInterval": [488, 497]
  }, "character", []]]],
  "anyChar": ["define", {
    "sourceInterval": [501, 514]
  }, null, [], ["terminal", {
    "sourceInterval": [511, 514]
  }, "."]],
  "escapeCharacter": ["define", {
    "sourceInterval": [520, 542]
  }, null, [], ["terminal", {
    "sourceInterval": [538, 542]
  }, "\\"]],
  "specialCharacter": ["define", {
    "sourceInterval": [546, 642]
  }, null, [], ["alt", {
    "sourceInterval": [565, 642]
  }, ["app", {
    "sourceInterval": [565, 572]
  }, "anyChar", []], ["terminal", {
    "sourceInterval": [575, 578]
  }, "^"], ["terminal", {
    "sourceInterval": [581, 584]
  }, "*"], ["terminal", {
    "sourceInterval": [587, 590]
  }, "?"], ["terminal", {
    "sourceInterval": [593, 596]
  }, "+"], ["terminal", {
    "sourceInterval": [599, 603]
  }, "\\"], ["terminal", {
    "sourceInterval": [606, 609]
  }, "["], ["terminal", {
    "sourceInterval": [612, 615]
  }, "]"], ["terminal", {
    "sourceInterval": [618, 621]
  }, "("], ["terminal", {
    "sourceInterval": [624, 627]
  }, ")"], ["terminal", {
    "sourceInterval": [630, 636]
  }, "\\\\"], ["terminal", {
    "sourceInterval": [639, 642]
  }, "|"]]],
  "characterClass": ["define", {
    "sourceInterval": [648, 710]
  }, null, [], ["alt", {
    "sourceInterval": [665, 710]
  }, ["terminal", {
    "sourceInterval": [665, 670]
  }, "\\w"], ["terminal", {
    "sourceInterval": [673, 678]
  }, "\\W"], ["terminal", {
    "sourceInterval": [681, 686]
  }, "\\d"], ["terminal", {
    "sourceInterval": [689, 694]
  }, "\\D"], ["terminal", {
    "sourceInterval": [697, 702]
  }, "\\s"], ["terminal", {
    "sourceInterval": [705, 710]
  }, "\\S"]]],
  "baseCharacter": ["define", {
    "sourceInterval": [714, 751]
  }, null, [], ["seq", {
    "sourceInterval": [730, 751]
  }, ["not", {
    "sourceInterval": [730, 747]
  }, ["app", {
    "sourceInterval": [731, 747]
  }, "specialCharacter", []]], ["app", {
    "sourceInterval": [748, 751]
  }, "any", []]]],
  "character": ["define", {
    "sourceInterval": [757, 834]
  }, null, [], ["alt", {
    "sourceInterval": [769, 834]
  }, ["seq", {
    "sourceInterval": [769, 801]
  }, ["app", {
    "sourceInterval": [769, 784]
  }, "escapeCharacter", []], ["app", {
    "sourceInterval": [785, 801]
  }, "specialCharacter", []]], ["seq", {
    "sourceInterval": [804, 834]
  }, ["opt", {
    "sourceInterval": [804, 820]
  }, ["app", {
    "sourceInterval": [804, 819]
  }, "escapeCharacter", []]], ["app", {
    "sourceInterval": [821, 834]
  }, "baseCharacter", []]]]],
  "matchCharacterClass": ["define", {
    "sourceInterval": [840, 893]
  }, null, [], ["alt", {
    "sourceInterval": [862, 893]
  }, ["app", {
    "sourceInterval": [862, 876]
  }, "characterGroup", []], ["app", {
    "sourceInterval": [879, 893]
  }, "characterClass", []]]],
  "characterGroup": ["define", {
    "sourceInterval": [899, 948]
  }, null, [], ["seq", {
    "sourceInterval": [916, 948]
  }, ["terminal", {
    "sourceInterval": [916, 919]
  }, "["], ["opt", {
    "sourceInterval": [920, 924]
  }, ["terminal", {
    "sourceInterval": [920, 923]
  }, "^"]], ["app", {
    "sourceInterval": [925, 944]
  }, "characterGroupInner", []], ["terminal", {
    "sourceInterval": [945, 948]
  }, "]"]]],
  "characterGroupInner": ["define", {
    "sourceInterval": [954, 995]
  }, null, [], ["star", {
    "sourceInterval": [976, 995]
  }, ["app", {
    "sourceInterval": [976, 994]
  }, "characterGroupItem", []]]],
  "characterGroupItem": ["define", {
    "sourceInterval": [1001, 1075]
  }, null, [], ["alt", {
    "sourceInterval": [1022, 1075]
  }, ["app", {
    "sourceInterval": [1022, 1036]
  }, "characterClass", []], ["app", {
    "sourceInterval": [1039, 1053]
  }, "characterRange", []], ["app", {
    "sourceInterval": [1056, 1065]
  }, "character", []], ["app", {
    "sourceInterval": [1068, 1075]
  }, "anyChar", []]]],
  "characterRange": ["define", {
    "sourceInterval": [1081, 1116]
  }, null, [], ["app", {
    "sourceInterval": [1098, 1116]
  }, "characterRangeItem", []]],
  "characterRangeItem": ["define", {
    "sourceInterval": [1122, 1158]
  }, null, [], ["seq", {
    "sourceInterval": [1143, 1158]
  }, ["app", {
    "sourceInterval": [1143, 1148]
  }, "alnum", []], ["terminal", {
    "sourceInterval": [1149, 1152]
  }, "-"], ["app", {
    "sourceInterval": [1153, 1158]
  }, "alnum", []]]],
  "anchor": ["define", {
    "sourceInterval": [1162, 1174]
  }, null, [], ["terminal", {
    "sourceInterval": [1171, 1174]
  }, "$"]],
  "quantifier": ["define", {
    "sourceInterval": [1180, 1212]
  }, null, [], ["seq", {
    "sourceInterval": [1193, 1212]
  }, ["app", {
    "sourceInterval": [1193, 1207]
  }, "quantifierType", []], ["opt", {
    "sourceInterval": [1208, 1212]
  }, ["terminal", {
    "sourceInterval": [1208, 1211]
  }, "?"]]]],
  "quantifierType": ["define", {
    "sourceInterval": [1218, 1262]
  }, null, [], ["alt", {
    "sourceInterval": [1239, 1262]
  }, ["terminal", {
    "sourceInterval": [1239, 1242]
  }, "*"], ["terminal", {
    "sourceInterval": [1249, 1252]
  }, "+"], ["terminal", {
    "sourceInterval": [1259, 1262]
  }, "?"]]]
}]);
module.exports = result;
//# sourceMappingURL=regex.ohm-bundle.js.map