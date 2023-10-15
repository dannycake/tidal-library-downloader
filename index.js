import * as Tidal from './lib/Tidal.js';
import * as scan from './lib/scan.js';
import path from 'path';
import {makeDirectory, print} from './lib/globals.js';

makeDirectory(
    path.join(process.cwd(), 'config')
);

const tidalExists = await Tidal.validate();
if (!tidalExists.success) {
    print('error', tidalExists.error);
    process.exit(1);
}

await Tidal.setup();
await Tidal.getLoginCode();

scan.start();
