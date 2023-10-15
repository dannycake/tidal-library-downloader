import fs from 'fs';
import path from 'path';
import Fuse from 'fuse.js';
import * as Tidal from './Tidal.js';
import {makeDirectory, musicFolder, print, similar} from "./globals.js";

const getArtistFolders = (location) => {
    return fs.readdirSync(location, {
        withFileTypes: true
    })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => ({
            path: path.join(location, dirent.name),
            artist: dirent.name
                .split('&')[0]
                .split(', ')[0]
                .split(' (')[0]
                .toLowerCase(),
            name: dirent.name
        }));
}
const getArtistFiles = async (artist, folders = getArtistFolders(musicFolder)) => {
    const matchingFolders =
        folders.filter(folder => folder.artist === artist);

    if (!matchingFolders || !matchingFolders.length) return null;

    let files = [];

    for (const folder of matchingFolders) {
        const foundFiles = fs.readdirSync(folder.path, {});
        files.push(...foundFiles);
    }

    return files;
}

export const start = async () => {
    const folders = getArtistFolders(musicFolder)
        .filter((folder, index, self) =>
            index === self.findIndex(t => (
                t.artist === folder.artist
            ))
        );

    for (const folder of folders) {
        // if (folder.artist !== 'jane remover') continue;

        const artists = await Tidal.searchArtists(folder.artist);
        if (!artists || !artists.length) continue;

        if (similar(folder.artist, artists[0].name.toLowerCase()) < 0.8) {
            print('warn',
                `Artist name mismatch: ${folder.artist} != ${artists[0].name}`);
            continue;
        }

        const tidalArtistId = artists[0].id;
        print('info', `Found artist match for '${folder.artist}'`);

        const media = await Tidal.getArtistProfile(tidalArtistId);
        if (!media) continue;

        const localFiles = await getArtistFiles(folder.artist);
        const searchFiles = new Fuse(localFiles, {
            includeScore: true,
            threshold: 0.3,
            location: 0,
        });

        for (const mediaPart of media) {
            const {
                id,
                title,
                releaseYear,
                type,
            } = mediaPart;

            const searchResults = searchFiles.search(title);

            if (searchResults && searchResults.length /* && title !== 'Lips' */) {
                print('success', `Found local match for '${title}'`)
                continue;
            }

            print('warn', `No local match for '${title}'`);

            const folderName = `${title} (${releaseYear}) - ${
                type === 'album' ? 'Album' : 'Single'
            }`;
            const folderPath = path.join(folder.path, folderName);

            const success = await Tidal.downloadAlbum(id, folderPath);

            if (success)
                print('success', `Downloaded ${folderName} by ${folder.name}`);
        }
    }
}
