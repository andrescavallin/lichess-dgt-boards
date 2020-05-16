/**
 * REQUIRED MODULES
 */
const axios = require('axios'); //To make HTTP calls to IBM Watson Text To Speech API
const fs = require('fs'); //To save the mp3 or wav file to disk
const colors = require('colors'); //This is to do colors on the console
const spawn = require('child_process').spawn; //To spawn a process to play audio file. NodeJS does not play audio.
const spawnSync = require('child_process').spawnSync; //To spawn a process to play audio file. NodeJS does not play audio.
var os = require('os'); //To detect operating system and launch external process to play audio accordingly
var sem = require('semaphore')(1); //A semaphore to prevent audio files to oeverlap

/**
 * CONFIGURATION VALUES
 */
/**
 * CONFIGURATION VALUES
 */
var nconf = require('nconf');
nconf.argv()
    .env()
    .file({ file: './config.json' });
nconf.defaults({
    "voice": "Michael",
    "availableVoices": {
        "Allison": "en-US_AllisonV3Voice",
        "Michael": "en-US_MichaelV3Voice",
        "Sofia": "es-LA_SofiaV3Voice",
        "Enrique": "es-ES_EnriqueV3Voice",
        "Renee": "fr-FR_ReneeV3Voice",
        "Francesca": "it-IT_FrancescaV3Voice"
    },
    "Watson_APIKEY": "",
    "audioFormat": "audio/mp3",
    "windowsAudioPlayer": "./audioplayer/mpg123/mpg123.exe"
});
var verbose = Boolean(nconf.get('verbose'));; //Verbose on or off
const voices = nconf.get('availableVoices');
const voice = voices[nconf.get('voice')];
const audioFormat = nconf.get('audioFormat');

/**
 * GLOBAL VATIABLES
 */
var lastText = '';

module.exports = {
    say: (text) => {
        //Check if the text is the same as the last one, if so, skip this play
        if (text == lastText) {
            if (verbose) console.log(colors.dim.cyan(`Text: '${text}' is the same as the last Text received. Will be skipped.`));
            return;
        }
        else
            lastText = text;
        //Now attempt to generate the audio file and play it
        try {
            var path = "./audio/" + text + "_" + voice + "." + audioFormat;
            if (!fs.existsSync(path)) {
                //File does not exists, generate using IBM Whatson TTS
                axios({
                    method: "post",
                    url: "https://api.us-south.text-to-speech.watson.cloud.ibm.com/instances/89a85b60-d9e8-4d3d-b612-d941d032182d/v1/synthesize",
                    params: { voice: voice },
                    responseType: "stream",
                    headers: { Accept: 'audio/' + audioFormat },
                    auth: {
                        username: 'apikey',
                        password: nconf.get('Watson_APIKEY')
                    },
                    data: { text: text }
                })
                    .then(function (response) {
                        try {
                            if (response.status == 200 || response.status == 201) {
                                response.data.pipe(fs.createWriteStream(path));
                                const stream = response.data;
                                stream.on('end', () => {
                                    //Download finished;
                                    if (verbose) console.log(colors.dim.cyan(path + " finished downloading."));
                                    //At this moment the file should exists
                                    //playOnProcess(path)
                                    //syncPlay(path);
                                    //Wait 100 milliseconds to make sure file is closed
                                    setTimeout(function () {syncPlay(path); }, 100);
                                });
                            }
                            else {
                                console.log('TTS say failed with ' + response.status + ' ' + response.statusText);
                            }

                        }
                        catch (error) {
                            console.error(error);
                        }
                    })
                    .catch(function (error) {
                        console.log(error);
                        if (error.response)
                            console.log(error.response.data);
                    });
            }
            else {
                // File is laready downloaded, just play it
                //playOnProcess(path);
                syncPlay(path);
            }
        }
        catch (error) {
            console.error(error)
        }
    }
};

function playOnProcess(path) {
    var player;
    if (os.platform() === 'win32') {
        player = spawn('./audioplayer/mpg123.exe', [path]);
    } else if (os.platform() === 'darwin') {
        player = spawn('afplay', [path]);
    }

    player.on('exit', function (code) {
        if (verbose) console.log(colors.dim.cyan('Audio player closed.'));
    });

    player.stdout.on('data', function (data) {
        if (verbose) console.log(colors.dim.cyan('Player stdout: ' + data));
    });
}

function syncPlay(path) {
    var player;
    var playerPath;
    //Determine which player to use depending on operating system
    if (os.platform() === 'win32') {
        playerPath = nconf.get('windowsAudioPlayer');
    } else if (os.platform() === 'darwin') {
        playerPath = 'afplay';
    }

    //This semaphore will prevent overlapping of audio. The acquire will be released after audio is played because it is a sync spawn
    try {
        sem.take(function () {
            if (verbose) console.log(colors.dim.cyan('Semaphore acquired. ' + Date.now()));
            //Use spawnSync to block execution until audio finished playing.
            //This will prevent audio overlaping
            player = spawnSync(playerPath, [path]);
            if (verbose) {
                console.log(colors.dim.cyan(`Finished executing ${playerPath} for audio ${path}. Output:`));
                console.log(colors.dim.blue(player.stderr.toString().trim()));
            }
        });
    }
    catch (error) {
        console.log(colors.dim.cyan(`Error spawning ${playerPath} for audio ${path}. ${error.message}`));
    }
    finally {
        //Wait a little bit before releasing the semaphore since this may cause problems
        setTimeout(sem.leave, 200)
        //sem.leave();
        if (verbose) console.log(colors.dim.cyan('Semaphore released. ' + Date.now()));
    }
}