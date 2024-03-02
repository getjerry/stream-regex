# StreamRegex

![CI](https://github.com/getjerry/stream-regex/actions/workflows/node.js.yml/badge.svg) ![NPM Version](https://img.shields.io/npm/v/stream-regex)

## What?

`stream-regex` is a Node.js library that allows for executing regular expressions (match and replace) on a `Readable` stream.

## Why?

RegExp in JavaScript operates on strings. This means that the entire string must be available before the RegExp can be executed. If your input is a stream instead of a string, you would have to buffer the entire stream before you can execute the RegExp. For long streams, this may not be feasible. `stream-regex` allows you to execute RegExp on a stream without buffering the entire stream. It progressively matches the stream data as it arrives, maintaining the regex evaluation state between chunks. Only the segment of the input that has a potential to match is buffered at any given time. As soon as a match is determined, either matching or not matching, the result is emitted and the buffer is cleared.

## Limitations

`stream-regex` does not support the entire regular expression grammar that is supported by `RegExp` object. It is designed to work with simple regular expressions that can be evaluated progressively. Please see the grammar supported by `stream-regex` in the [src/grammar/regex.ohm](src/grammar/regex.ohm).

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

The `match` method on `StreamRegex` takes a `Readable` stream to match against. A new stream is returned that will have the matched strings.

```typescript
match(input: Readable, options: MatchOptions = {}): Readable
```
  
```typescript
const inputStream: Readable = ...;
const streamRegex = new StreamRegex(/(a|b)/g);
const matchStream = streamRegex.match(inputStream);
matchStream.on('data', (chunk) => {
  console.log(chunk.toString());
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

Using `StreamRegex` on an async iterator. [Run on Repl.it](https://replit.com/@musawir1/Example-for-stream-regex)

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
const input = Readable.from(asyncIterator);

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
```
