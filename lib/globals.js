import chalk from 'chalk';
import path from 'path';
import fs from 'fs';

const dir = process.cwd();

export const configurationFolder = path.join(dir, 'config');
export const musicFolder = process.env.MUSIC_LIBRARY_PATH;

export const print = (type, ...args) => {
    let color = 'gray';
    let prefix = '[DEBUG]';

    switch (type) {
        case 'error':
            color = 'red';
            prefix = '[ERROR]';
            break;
        case 'warn':
            color = 'yellow';
            prefix = '[WARNING]';
            break;
        case 'info':
            color = 'blue';
            prefix = '[INFO]';
            break;
        case 'success':
            color = 'green';
            prefix = '[SUCCESS]';
            break;
        default:
            break;
    }

    console.log(
        chalk.gray(`[${new Date().toLocaleString()}]`),
        chalk[color](prefix), ...args);
}
print('debug', `Configuration folder: ${configurationFolder}`);

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export const similar = (a, b) => {
    const aLetters = a.split('');
    const bLetters = b.split('');

    const matches = aLetters.filter(word => bLetters.includes(word));

    return matches.length / aLetters.length;
}

export const makeDirectory = (location) => {
    fs.mkdirSync(path.resolve(location), {
        recursive: true
    });
}
