import {configurationFolder, makeDirectory, print} from './globals.js';
import {spawn} from 'child_process';
import fs from 'fs';
import path from 'path';
import superagent from 'superagent';

const linkRegex = /http:\/\/link.tidal.com\/[A-Z0-9]{5}/gm;
const configFile = path.join(
    configurationFolder,
    '.tidal-dl.json'
);
const accessTokenFile = path.join(
    configurationFolder,
    '.tidal-dl.token.json'
);

const configuration = {
    albumFolderFormat: '/',
    apiKeyIndex: 4,
    audioQuality: 'HiFi',
    checkExist: true,
    downloadDelay: true,
    downloadPath: path.resolve(configurationFolder, 'downloads'),
    includeEP: true,
    language: 0,
    lyricFile: true,
    multiThread: false,
    playlistFolderFormat: 'Playlist/{PlaylistName} [{PlaylistUUID}]',
    saveAlbumInfo: false,
    saveCovers: true,
    showProgress: true,
    showTrackInfo: true,
    trackFileFormat: "{TrackNumber}. {TrackTitle}",
    usePlaylistFolder: true,
    videoFileFormat: "{VideoNumber} - {ArtistName} - {VideoTitle}{ExplicitFlag}",
    videoQuality: "P360"
}
const spawnOptions = {
    // cwd: configurationFolder,
    env: {
        ...process.env,
        HOME: configurationFolder,
        HOMEPATH: configurationFolder,
    }
}

let bearerToken = null;

export const name = 'Tidal';
const execute = (args = [], display = false) => new Promise(resolve => {
    try {
        let output = '';
        let error = '';

        const execute = spawn('tidal-dl', args, spawnOptions);

        execute.stdout.on('data', (data) => {
            output += data;
            if (display)
                print('info', '[TIDAL-DL]', data.toString().trim());
        });

        execute.stderr.on('data', (data) => {
            error += data;
            if (display)
                print('error', '[TIDAL-DL]', data.toString().trim());
        });

        execute.on('close', _code => {
            resolve({
                success: !!output,
                output,
                error,
            })
        });
    } catch (e) {
        resolve({
            success: false,
            error: e.message,
        });
    }
});

export const validate = () => new Promise(async resolve => {
    const check = await execute(['--version']);
    if (check.success) {
        return resolve({
            success: true,
        });
    }

    resolve({
        error: 'tidal-dl was not found.'
    });
});

export const setup = () => new Promise(async resolve => {
    fs.writeFileSync(configFile, JSON.stringify(configuration, null, 4));
    print('warn', 'Wrote tidal-dl configuration file.');

    resolve();
});

const readToken = () => new Promise(resolve => {
    fs.readFile(accessTokenFile, (err, data) => {
        if (err) return resolve(false);

        const token = data.toString();
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        const json = JSON.parse(decoded);

        bearerToken = json.accessToken;
        if (!bearerToken) return resolve(false);

        // print('success', 'Read tidal-dl access token successfully.', bearerToken)

        resolve(bearerToken);
    });
});

export const getLoginCode = () => new Promise(async resolve => {
    const instance = spawn('tidal-dl', spawnOptions);

    instance.stdout.on('data', async (data) => {
        const string = data.toString();

        if (string.includes('Login failed.Error while checking for authorization.')) {
            // login timed out after 5 minutes
            print('error', 'Tidal login failed; downloading will not be available.');
            instance.kill();
            return resolve(false);
        }

        if (string.includes('AccessToken good for')) {
            // logged in to tidal successfully
            print('success', 'Logged in to Tidal successfully.');
            instance.kill();

            await readToken();

            return resolve(true);
        }

        const match = linkRegex.exec(string);

        const loginLink = match && match[0];
        if (!loginLink) return;

        print('info', '[TIDAL-DL]', `Please login to tidal with the following link: ${loginLink}`);
    });
});

export const searchAlbums = (artistName, albumName, type) => new Promise(async resolve => {
    superagent('GET', `https://listen.tidal.com/v1/search/${type}`)
        .query({
            query: `${artistName} ${albumName}`,
            limit: 25,
            offset: 0,
            // types: 'ALBUMS',
            countryCode: 'US',
            locale: 'en_US',
            deviceType: 'DESKTOP',
        })
        .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0')
        .set('Authorization', `Bearer ${bearerToken}`)
        .then(resp => {
            const {
                body: {
                    items: rawAlbums,
                }
            } = resp;

            const albums = [...rawAlbums]
                .filter(album => {
                    if (type === 'tracks')
                        return album.album.title === albumName
                    return album.title === albumName
                })
                .map(album => ({
                    id: album.id,
                    name: album.title,
                    artist: album.artists[0].name,
                    tags: album?.mediaMetadata?.tags || [],
                    explicit: album.explicit,
                    popularity: album.popularity,
                }))
                .sort((a, b) => b.popularity - a.popularity);

            // combine albums with the same name, keep id of the explicit/lossless version (if any)
            const albumMap = {};

            for (const album of albums) {
                const key = `${album.artist} - ${album.name}`;

                if (!albumMap[key]) {
                    albumMap[key] = album;
                    continue;
                }

                if (albumMap[key].explicit && !album.explicit) continue;
                if (albumMap[key].tags.includes('LOSSLESS') && !album.tags.includes('LOSSLESS')) continue;

                albumMap[key] = album;
            }

            resolve(Object.values(albumMap));
        })
        .catch(error => {
            print(
                'error', 'Failed to search for albums on Tidal:',
                error.response ? error.response.text : error);
            resolve([]);
        });
});

export const searchArtists = (artistName) => new Promise(async resolve => {
    superagent('GET', 'https://listen.tidal.com/v1/search/top-hits')
        .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0')
        .set('Authorization', `Bearer ${bearerToken}`)
        .query({
            query: artistName,
            limit: 25,
            offset: 0,
            types: 'ARTISTS',
            countryCode: 'US',
            locale: 'en_US',
            deviceType: 'DESKTOP',
        })
        .then(resp => {
            resolve(resp.body.artists.items.map(artist => ({
                id: artist.id,
                name: artist.name,
            })));
        })
        .catch(error => {
            print(
                'error', 'Failed to search for artists on Tidal:',
                error.response ? error.response.text : error);
            resolve([]);
        })
});

export const getArtistProfile = (artistId) => new Promise(async resolve => {
    superagent('GET', 'https://listen.tidal.com/v1/pages/artist')
        .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0')
        .set('Authorization', `Bearer ${bearerToken}`)
        .query({
            artistId,
            countryCode: 'US',
            locale: 'en_US',
            deviceType: 'BROWSER',
        })
        .then(resp => {
            const {
                rows
            } = resp.body;

            const data = [];

            for (const row of rows) {
                const {
                    modules: [module]
                } = row;

                const {
                    // type,
                    title,
                    pagedList
                } = module;

                if (!pagedList) continue;
                let key = null;

                switch (title) {
                    case 'Albums':
                        key = 'album';
                        break;
                    case 'EP & Singles':
                        key = 'single';
                        break;
                    default:
                        continue;
                }

                data.push(...pagedList.items.map(item => ({
                    id: item.id,
                    title: item.title,
                    releaseYear: new Date(
                        item.streamStartDate || item.releaseDate
                    ).getFullYear(),
                    type: key,
                })));
            }

            resolve(data);
        })
        .catch(error => {
            print(
                'error', 'Failed to get artist profile on Tidal:',
                error.response ? error.response.text : error);
            resolve(null);
        })
})

export const downloadAlbum = (albumLink, outputFolder = '') => new Promise(async resolve => {
    makeDirectory(outputFolder);

    const download = await execute([
        '--link', albumLink,
        '--output', path.resolve(outputFolder),
    ], true);

    if (!download.success) {
        print('error', 'Failed to download album:', download.error);
        return resolve(false);
    }

    resolve(true);
});
