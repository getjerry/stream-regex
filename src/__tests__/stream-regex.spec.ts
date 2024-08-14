import { Readable } from 'stream';
import Graphemer from 'graphemer';
import { StreamRegex } from '../';

/**
 * Utility function to convert a string to a stream.
 * Splits the string into chunks and pushes them into the stream.
 *
 * @param str
 * @param chunkSize
 */
const stringToStream = (str: string, chunkSize: number): Readable => {
  const stream = new Readable();
  stream._read = () => {
  };

  const graphemer = new Graphemer();
  const graphemes = graphemer.splitGraphemes(str);

  for (let i = 0; i < graphemes.length; i += chunkSize) {
    const chunk = graphemes.slice(i, i + chunkSize).join('');
    stream.push(chunk);
  }

  stream.push(null);
  return stream;
};

/**
 * Utility function to convert a stream to a promise that resolves to the data in the stream.
 *
 * @param stream
 * @param type
 */
const streamToPromise = <T extends 'match' | 'replace', U = T extends 'match' ? string[] : string>(stream: Readable, type: T): Promise<U> => {
  return new Promise((resolve, reject) => {
    const data: string[] = [];
    stream.on('data', (chunk) => {
      data.push(chunk.toString());
    }).on('end', () => {
      const retVal = type === 'match' ? data : data.join('');
      resolve(retVal as U);
    }).on('error', (err) => {
      reject(err);
    });
  });
};

describe('StreamRegex', () => {
  it('/ab/ (match)', async () => {
    const regex = /ab/;
    const input = stringToStream('abcdef', 1);
    const streamRegex = new StreamRegex(regex);
    return expect(streamToPromise(streamRegex.match(input), 'match')).resolves.toEqual(['ab']);
  });

  it('/ab/ (no match)', async () => {
    const regex = /ab/;
    const input = stringToStream('bacdef', 1);
    const streamRegex = new StreamRegex(regex);
    return expect(streamToPromise(streamRegex.match(input), 'match')).resolves.toEqual([]);
  });

  it('/ab/i', async () => {
    const regex = /ab/i;
    const input = stringToStream('MMm...ab--XAbssBAB', 1);
    const streamRegex = new StreamRegex(regex);
    return expect(streamToPromise(streamRegex.match(input), 'match')).resolves.toEqual(['ab']);
  });

  it('/ab/ig', async () => {
    const regex = /ab/ig;
    const input = stringToStream('MMm...ab--XAbssBAB', 5);
    const streamRegex = new StreamRegex(regex);
    return expect(streamToPromise(streamRegex.match(input), 'match')).resolves.toEqual(['ab', 'Ab', 'AB']);
  });

  it('/^ab/ (match)', async () => {
    const regex = /^ab/;
    const input = stringToStream('ab--XAbssBAB', 1);
    const streamRegex = new StreamRegex(regex);
    return expect(streamToPromise(streamRegex.replace(input, (match) => `_${match}_`), 'replace')).resolves.toBe('_ab_--XAbssBAB');
  });

  it('/^ab/ (no match)', async () => {
    const regex = /^ab/;
    const input = stringToStream('MMm...ab--XAbssBAB', 1);
    const streamRegex = new StreamRegex(regex);
    return expect(streamToPromise(streamRegex.replace(input, (match) => `_${match}_`), 'replace')).resolves.toBe('MMm...ab--XAbssBAB');
  });

  it('/ab$/i (match)', async () => {
    const regex = /ab$/i;
    const input = stringToStream('MMm...ab--XAbssBAB', 1);
    const streamRegex = new StreamRegex(regex);
    return expect(streamToPromise(streamRegex.replace(input, (match) => `_${match}_`), 'replace')).resolves.toBe('MMm...ab--XAbssB_AB_');
  });

  it('/ab$/i (no-match)', async () => {
    const regex = /ab$/i;
    const input = stringToStream('MMm...ab--XAbssBABa', 1);
    const streamRegex = new StreamRegex(regex);
    return expect(streamToPromise(streamRegex.replace(input, (match) => `_${match}_`), 'replace')).resolves.toBe('MMm...ab--XAbssBABa');
  });

  // eslint-disable-next-line no-useless-escape
  it('/\[([^\]]+)\]\((getjerry:\/\/[\w-/]+)\)/i (match)', async () => {
    const regex = /\[([^\]]+)\]\((getjerry:\/\/[\w-/]+)\)/i;
    const input = stringToStream('[hello](getjerry://some/link-to-here)', 4);
    const streamRegex = new StreamRegex(regex);
    return expect(streamToPromise(streamRegex.replace(input, (match, p1, p2) => `<a href="${p2}">${p1}</a>`), 'replace')).resolves.toBe('<a href="getjerry://some/link-to-here">hello</a>');
  });

  // eslint-disable-next-line no-useless-escape
  it('/\[([^\]]+)\]\((getjerry:\/\/[\w-/]+)\)/i (async iterator)', async () => {
    const regex = /\[([^\]]+)\]\((getjerry:\/\/[\w-/]+)\)/i;
    const asyncIterator = (async function* () {
      yield 'I have a link: ';
      yield '[hel';
      await new Promise((resolve) => setTimeout(resolve, 100));
      yield 'lo](getjerry:/';
      yield '/some/link-to-here)';
    })();

    const input = new Readable();
    input._read = () => {};
    const streamRegex = new StreamRegex(regex);
    const output = streamRegex.replace(input, (match, p1, p2) => `<a href="${p2}">${p1}</a>`);

    for await (const chunk of asyncIterator) {
      input.push(chunk);
    }
    input.push(null);

    return expect(streamToPromise(output, 'replace')).resolves.toBe('I have a link: <a href="getjerry://some/link-to-here">hello</a>');
  });

  it('works with (?:)', async () => {
    const input = new Readable();
    const regex = /(?:<|\[)\s*ACTION:\s*([\w-]+)\s*(?:;\s*DATA:\s*({[^>\]]+}))?\s*(?:>|\])/gi;
    const streamRegex = new StreamRegex(regex);

    const actions: string[] = [];
    const output = streamRegex.replace(input, (match, action, data) => {
      actions.push(`${action}(${data || ''})`);
      return '';
    });

    input.push('Hell');
    input.push('o, ho');
    input.push('w can I assist you today?');
    input.push('<ACTI');
    input.push('ON:action1;DATA:{');
    input.push('"a":1}> This is a<ACTION: acti');
    input.push('on2> sample <action:  action3>text.');
    input.push(null);

    const prom = streamToPromise(output, 'replace').then((text) => ({ text, actions }));
    await expect(prom).resolves.toEqual({
      text: 'Hello, how can I assist you today? This is a sample text.',
      actions: ['action1({"a":1})', 'action2()', 'action3()'],
    });
  });

  it('supports {n} quantifier', async () => {
    const regex = /a+b{1}[cd]{2}(ef)/g;
    const input = stringToStream('abaabcbaaaeaaabdcef333', 3);
    const streamRegex = new StreamRegex(regex);
    return expect(streamToPromise(streamRegex.match(input), 'match')).resolves.toEqual(['aaabdcef']);
  });

  it('supports {n,m} quantifier', async () => {
    const regex = /a+b{1,5}[cd]{2}(ef)/g;
    const input = stringToStream('abaabcbaaaeaaabbdcef333', 3);
    const streamRegex = new StreamRegex(regex);
    return expect(streamToPromise(streamRegex.match(input), 'match')).resolves.toEqual(['aaabbdcef']);
  });

  it('supports {n,} quantifier', async () => {
    const regex = /a+b{1,}[cd]{2}(ef)/g;
    const input = stringToStream('abaabcbaaaeaaabbdcef333', 3);
    const streamRegex = new StreamRegex(regex);
    return expect(streamToPromise(streamRegex.match(input), 'match')).resolves.toEqual(['aaabbdcef']);
  });
  it('support handle emoji', async () => {
    const regex = /👍/g;
    const input = stringToStream('😄👍', 1);
    const streamRegex = new StreamRegex(regex);
    return expect(streamToPromise(streamRegex.match(input), 'match')).resolves.toEqual(['👍']);
  });
  it('support handle emoji replace', async () => {
    const regex = /👍/g;
    const input = stringToStream('😄👍', 1);
    const streamRegex = new StreamRegex(regex);
    return expect(streamToPromise(streamRegex.replace(input, (match) => `_${match}_`), 'replace')).resolves.toBe('😄_👍_');
  });
});
