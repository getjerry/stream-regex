# StreamRegex

![CI](https://github.com/getjerry/stream-regex/actions/workflows/node.js.yml/badge.svg) ![NPM Version](https://img.shields.io/npm/v/stream-regex)


## Installation

```shell
$ npm install --save stream-regex
```

## Usage

```typescript
import { StreamRegex } from 'stream-regex';

const streamRegex = new StreamRegex(regexp: RegExp);
```

### Matching

The `match` method on `StreamRegex` takes a `Readable` stream to match against. The results of the match are provided via callback.

```typescript
match(input: Readable, onMatch: (match: string) => void, options: MatchOptions = {}): void
```
  
```typescript
const inputStream: Readable = ...;
const streamRegex = new StreamRegex(/(a|b)/g);
streamRegex.match(inputStream, (match: string) => {
  console.log(match);
});
```

## Replacing

The `replace` method on `StreamRegex` allows for replacing matches in the input stream. A new stream is returned with the replaced content.

```typescript
replace(input: Readable, replacement: string | ((match: string, ...args: any[]) => string), options: MatchOptions = {}): Readable
```

```typescript
const inputStream: Readable = ...;
const streamRegex = new StreamRegex(/(a|b)/g);
const outputStream = streamRegex.replace(inputStream, (match: string) => {
  return match.toUpperCase();
});
```

## Options

Both `match` and `replace` take an optional `MatchOptions` object.

```typescript
export interface MatchOptions {
  // If true, the algorithm will try to match the longest possible string. If false, it will try to match the shortest possible string.
  greedy?: boolean; // default: true
}
```

## Example

Using `StreamRegex` on an async iterator:

```typescript
// Regex.
const regex = /\[([^\]]+)\]\((getjerry:\/\/[\w-/]+)\)/i;

// Async iterator to push the input stream in chunks.
const asyncIterator = (async function* () {
  yield 'I have a link: ';
  yield '[hel';
  await new Promise((resolve) => setTimeout(resolve, 100));
  yield 'lo](getjerry:/';
  yield '/some/link-to-here)';
})();

// Convert the async iterator to a readable stream.
const input = new Readable();
input._read = () => {};

// Start the stream regex replacer.
const streamRegex = new StreamRegex(regex);
const output = streamRegex.replace(input, (match, p1, p2) => `<a href="${p2}">${p1}</a>`);

// Collect the output.
let outputStr = '';
output.on('data', (chunk) => {
  outputStr += chunk.toString();
}).on('end', () => {
  // Output: 'I have a link: <a href="getjerry://some/link-to-here">hello</a>'
  console.log(outputStr);
});

// Push chunks from the async iterator to the input stream.
for await (const chunk of asyncIterator) {
  input.push(chunk);
}
// End the input stream.
input.push(null);
```
