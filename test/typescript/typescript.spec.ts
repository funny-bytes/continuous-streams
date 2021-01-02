import 'mocha';
import { expect } from 'chai';
import SequelizeSimpleCache from "../..";
import { pipeline } from 'stream';
import { ContinuousReader, ContinuousWriter } from '../..';

class Foo {
  id: number;
  name: string;
  constructor({ id, name }) {
    this.id = id;
    this.name = name;
  }
}

describe('Integration TypeScript', () => {
  it('should work', async () => {
    return new Promise<void>((resolve, reject) => {
      let counter = 0;
      const reader = new ContinuousReader<Foo>({ chunkSize: 5 });
      reader.readData = async (count: number): Promise<Foo[]> => {
        const data = [
          new Foo({ id: counter, name: 'foo' }),
          new Foo({ id: counter + 1, name: 'bar' }),
          new Foo({ id: counter + 2, name: 'baz' }),
        ];
        counter += data.length;
        if (counter >= 100) reader.stop();
        return data;
      }
      const writer = new ContinuousWriter<Foo>({ skipOnError: false });
      writer.writeData = async (item: Foo): Promise<void> => {
        expect(item).to.be.an.instanceof(Foo);
        expect(item).to.have.property('id');
        expect(item).to.have.property('name');
      }
      pipeline(
        reader,
        writer,
        (error) => {
          if (error) return reject(error);
          return resolve();
        },
      );
    });
  });
});
