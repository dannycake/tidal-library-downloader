import * as Tidal from './lib/Tidal.js';
import * as scan from './lib/scan.js';
import {print} from './lib/globals.js';

const tidalExists = await Tidal.validate();
if (!tidalExists.success) {
    print('error', tidalExists.error);
    process.exit(1);
}

await Tidal.setup();
await Tidal.getLoginCode();

scan.start();
