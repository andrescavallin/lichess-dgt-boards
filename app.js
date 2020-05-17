/**
 * REQUIRED MODULES
 */
const axios = require('axios'); //Promise based HTTP client
const httpAdapter = require('axios/lib/adapters/http');
const colors = require('colors'); //This is to do colors on the console
const figlet = require('figlet'); /* ASCII Art for BIG Texts */
const tts = require('./text-to-speech'); /* Import Text To Speech Library from IBM Whatson */
const { Chess } = require('chess.js'); /* An open source chessboard management from https://github.com/jhlywa/chess.js/ */
const BoardManager = require('./board-manager'); /* This will manage input from the DGT Board */
//This is to get input from the console, ideally wont be necessary since input will be received from the board
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
})

/**
 * CONFIGURATION VALUES
 */
var nconf = require('nconf');
nconf.argv()
    .env()
    .file({ file: './config.json' });
nconf.defaults({
    "baseURL": "https://lichess.org",
    "personalToken": "",
    "verbose": false,
    "announceAllMoves": false
});
const baseURL = nconf.get('baseURL');
//axios.defaults.proxy = { host: "127.0.0.1", port:8888}
const personalToken = nconf.get('personalToken');
var verbose = Boolean(nconf.get('verbose'));; //Verbose on or off
var announceAllMoves = Boolean(nconf.get('announceAllMoves'));;; //Announce moves for both players or only the opponents

/**
 * GLOBAL VATIABLES
 */
var time = new Date(); //A Global time object
var currentGameId = ''; //Track which is the current Game, in case there are several open games
var currentGameColor = ''; //Track which color is being currently played by the player
var me; //Track my information
var gameInfoMap = new Map(); //A collection of key values to store game inmutable information of all open games
var gameStateMap = new Map(); //A collection of key values to store the changing state of all open games
var gameConnectionMap = new Map(); //A collection of key values to store the network status of a game
var gameChessBoardMap = new Map(); //A collection of Chess Boads representing the current board of the games
var eventSteamStatus = { connected: false, lastEvent: time.getTime() }; //An object to store network status of the main eventStream
var chatArray = [{
    "type": "chatLine",
    "username": "andrescavallin",
    "text": "Please be nice in the chat!",
    "room": "spectator"
}]

/**
 * This make axios treat all http reponses as valid and don't throw an error so its easier to see error body
 * This was added because some useful 4xx error messages were not shown
 */
axios.defaults.validateStatus = function () {
    return true;
};


/**
 * GET /api/account
 * 
 * Get my profile
 * 
 * Shows Public informations about the logged in user.
 * 
 * Example:
{
  id: 'andrescavallin',
  username: 'andrescavallin',
  online: true,
  perfs: {
    blitz: { games: 0, rating: 1500, rd: 350, prog: 0, prov: true },
    bullet: { games: 0, rating: 1500, rd: 350, prog: 0, prov: true },
    correspondence: { games: 0, rating: 1500, rd: 350, prog: 0, prov: true },
    classical: { games: 0, rating: 1500, rd: 350, prog: 0, prov: true },
    rapid: { games: 3, rating: 1362, rd: 178, prog: 0, prov: true }
  },
  createdAt: 1581950312761,
  seenAt: 1587182372646,
  playTime: { total: 3737, tv: 0 },
  language: 'en-US',
  url: 'https://lichess.org/@/andrescavallin',
  playing: 'https://lichess.org/JgauZ9M2/white',
  nbFollowing: 1,
  nbFollowers: 1,
  count: {
    all: 10,
    rated: 3,
    ai: 1,
    draw: 1,
    drawH: 1,
    loss: 6,
    lossH: 5,
    win: 3,
    winH: 3,
    bookmark: 0,
    playing: 1,
    import: 0,
    me: 0
  },
  followable: true,
  following: false,
  blocking: false,
  followsYou: false
}
 */
function getProfile() {
    //Log intention
    if (verbose) console.log(colors.dim.grey('getProfile - About to call /api/account'));
    axios.get('/api/account', {
        baseURL: baseURL,
        headers: { 'Authorization': 'Bearer ' + personalToken }
    }).then(
        function (response) {
            //Log raw data received
            if (verbose) console.log(colors.dim.grey('/api/account Response:' + JSON.stringify(response.data)));
            //Diplay Title + UserName . Title may be undefined
            process.stdout.write("\n");
            console.log("┌─────────────────────────────────────────────────────┐");
            console.log("│ " + colors.bold.white((typeof response.data.title !== "undefined") ? response.data.title : '') + colors.white(' ' + response.data.username));
            //Display performance ratings
            console.table(response.data.perfs);
            //Store my profile
            me = response.data;
        },
        err => console.error('getProfile - Error. '.red + err.message));
}

/** 
GET /api/stream/event
Stream incoming events

Stream the events reaching a lichess user in real time as ndjson.

Each line is a JSON object containing a type field. Possible values are:

challenge Incoming challenge
gameStart Start of a game
When the stream opens, all current challenges and games are sent.

Examples:
{"type":"gameStart","game":{"id":"kjKzl2MO"}}
{"type":"challenge","challenge":{"id":"WTr3JNcm","status":"created","challenger":{"id":"andrescavallin","name":"andrescavallin","title":null,"rating":1362,"provisional":true,"online":true,"lag":3},"destUser":{"id":"godking666","name":"Godking666","title":null,"rating":1910,"online":true,"lag":3},"variant":{"key":"standard","name":"Standard","short":"Std"},"rated":false,"speed":"rapid","timeControl":{"type":"clock","limit":900,"increment":10,"show":"15+10"},"color":"white","perf":{"icon":"#","name":"Rapid"}}}

* @param {string} personalToken - The secret token used for authentication on lichess.org
 */
function connectToEventStream(personalToken) {
    //Log intention
    if (verbose) console.log(colors.dim.grey('connectToEventStream - About to call /api/stream/event'));
    axios.get('/api/stream/event', {
        baseURL: baseURL,
        headers: { 'Authorization': 'Bearer ' + personalToken },
        responseType: 'stream',
        adapter: httpAdapter
    }).then((response) => {
        const stream = response.data;
        stream.on('data', (chunk /* chunk is an ArrayBuffer */) => {
            //Log raw data received
            if (verbose) console.log(colors.dim.grey('connectToEventStream - stream event recevied:' + Buffer.from(chunk)));
            //Update connection status
            eventSteamStatus = { connected: true, lastEvent: time.getTime() };
            //Response may contain several JSON objects on the same chunk separated by \n . This may create an empty element at the end.
            var JSONArray = Decodeuint8arr(chunk).split('\n');
            for (i = 0; i < JSONArray.length; i++) {
                //Skip empty elements that may have happened witht the .split('\n')
                if (JSONArray[i].length > 2) {
                    try {
                        var data = JSON.parse(JSONArray[i]);
                        //JSON data found, let's check if this is a game that started. field type is mandatory except on http 4xx
                        if (data.type == "gameStart") {
                            if (verbose) console.log(colors.dim.gray('connectToEventStream - gameStart event arrived. GameId: ' + data.game.id));
                            try {
                                //Connect to that game's stream
                                connectToGameStream(data.game.id);
                            }
                            catch (error) {
                                //This will trigger if connectToGameStream fails
                                console.log('connectToEventStream - Failed to connect to game stream.'.red + Error(error).message);
                            }
                        }
                        else if (data.type == "challenge") {
                            //Challenge received
                            //TODO
                        }
                        else if (response.status >= 400) {
                            console.log(colors.yellow('connectToEventStream - ' + data.error));
                        }
                    }
                    catch (error) {
                        console.log('connectToEventStream - Unable to parse JSON or Unexpected error. '.red + Error(error).message);
                    }
                }
                else {
                    //Signal that some empty message arrived. This is normal to keep the connection alive.
                    if (verbose) process.stdout.write("*");
                }
            }
        });
        stream.on('end', () => {
            //End Stream output.end();
            console.log('connectToEventStream - Event Stream ended.'.yellow);
            //Update connection status
            eventSteamStatus = { connected: false, lastEvent: time.getTime() };

        });
    });
}


/**
Stream Board game state
 
GET /api/board/game/stream/{gameId}
 
Stream the state of a game being played with the Board API, as ndjson.
Use this endpoint to get updates about the game in real-time, with a single request.
Each line is a JSON object containing a type field. Possible values are:
 
gameFull Full game data. All values are immutable, except for the state field.
gameState Current state of the game. Immutable values not included. Sent when a move is played, a draw is offered, or when the game ends.
chatLine Chat message sent by a user in the room "player" or "spectator".
The first line is always of type gameFull.
 
Examples:
 
New Game
{"id":"972RKuuq","variant":{"key":"standard","name":"Standard","short":"Std"},"clock":{"initial":900000,"increment":10000},"speed":"rapid","perf":{"name":"Rapid"},"rated":false,"createdAt":1586647003562,"white":{"id":"godking666","name":"Godking666","title":null,"rating":1761},"black":{"id":"andrescavallin","name":"andrescavallin","title":null,"rating":1362,"provisional":true},"initialFen":"startpos","type":"gameFull","state":{"type":"gameState","moves":"e2e4","wtime":900000,"btime":900000,"winc":10000,"binc":10000,"wdraw":false,"bdraw":false,"status":"started"}}
First Move
{"type":"gameState","moves":"e2e4","wtime":900000,"btime":900000,"winc":10000,"binc":10000,"wdraw":false,"bdraw":false,"status":"started"}
Middle Game
{"type":"gameState","moves":"e2e4 c7c6 g1f3 d7d5 e4e5 c8f5 d2d4 e7e6 h2h3 f5e4 b1d2 f8b4 c2c3 b4a5 d2e4 d5e4 f3d2 d8h4 g2g3 h4e7 d2e4 e7d7 e4d6 e8f8 d1f3 g8h6 c1h6 h8g8 h6g5 a5c7 e1c1 c7d6 e5d6 d7d6 g5f4 d6d5 f3d5 c6d5 f4d6 f8e8 d6b8 a8b8 f1b5 e8f8 h1e1 f8e7 d1d3 a7a6 b5a4 g8c8 a4b3 b7b5 b3d5 e7f8","wtime":903960,"btime":847860,"winc":10000,"binc":10000,"wdraw":false,"bdraw":false,"status":"started"}
After reconnect
{"id":"ZQDjy4sa","variant":{"key":"standard","name":"Standard","short":"Std"},"clock":{"initial":900000,"increment":10000},"speed":"rapid","perf":{"name":"Rapid"},"rated":true,"createdAt":1586643869056,"white":{"id":"gg60","name":"gg60","title":null,"rating":1509},"black":{"id":"andrescavallin","name":"andrescavallin","title":null,"rating":1433,"provisional":true},"initialFen":"startpos","type":"gameFull","state":{"type":"gameState","moves":"e2e4 c7c6 g1f3 d7d5 e4e5 c8f5 d2d4 e7e6 h2h3 f5e4 b1d2 f8b4 c2c3 b4a5 d2e4 d5e4 f3d2 d8h4 g2g3 h4e7 d2e4 e7d7 e4d6 e8f8 d1f3 g8h6 c1h6 h8g8 h6g5 a5c7 e1c1 c7d6 e5d6 d7d6 g5f4 d6d5 f3d5 c6d5 f4d6 f8e8 d6b8 a8b8 f1b5 e8f8 h1e1 f8e7 d1d3 a7a6 b5a4 g8c8 a4b3 b7b5 b3d5 e7f8 d5b3 a6a5 a2a3 a5a4 b3a2 f7f6 e1e6 f8f7 e6b6","wtime":912940,"btime":821720,"winc":10000,"binc":10000,"wdraw":false,"bdraw":false,"status":"resign","winner":"white"}}
Draw Offered
{"type":"gameState","moves":"e2e4 c7c6","wtime":880580,"btime":900000,"winc":10000,"binc":10000,"wdraw":false,"bdraw":true,"status":"started"}
After draw accepted
{"type":"gameState","moves":"e2e4 c7c6","wtime":865460,"btime":900000,"winc":10000,"binc":10000,"wdraw":false,"bdraw":false,"status":"draw"}
Out of Time
{"type":"gameState","moves":"e2e3 e7e5","wtime":0,"btime":900000,"winc":10000,"binc":10000,"wdraw":false,"bdraw":false,"status":"outoftime","winner":"black"}
Mate
{"type":"gameState","moves":"e2e4 e7e5 f1c4 d7d6 d1f3 b8c6 f3f7","wtime":900480,"btime":907720,"winc":10000,"binc":10000,"wdraw":false,"bdraw":false,"status":"mate"}
Promotion
{"type":"gameState","moves":"e2e4 b8c6 g1f3 c6d4 f1c4 e7e5 d2d3 d7d5 f3d4 f7f6 c4d5 f6f5 f2f3 g7g6 e1g1 c7c6 d5b3 d8d5 e4d5 a8b8 d4e6 f8b4 e6c7 e8e7 d5d6 e7f6 d6d7 b4f8 d7d8q","wtime":2147483647,"btime":2147483647,"winc":0,"binc":0,"wdraw":false,"bdraw":false,"status":"started"}
@param {string} gameId - The alphanumeric identifier of the game to be tracked
 */

function connectToGameStream(gameId) {
    //Log intention
    if (verbose) console.log(colors.dim.grey('connectToGameStream - About to call /api/board/game/stream/' + gameId));
    //gameId = 'ZQDjy4sa';
    //Now hook the on data event to the stream
    axios.get('/api/board/game/stream/' + gameId, {
        baseURL: baseURL,
        headers: { 'Authorization': 'Bearer ' + personalToken },
        responseType: 'stream',
        adapter: httpAdapter
    })
        .then((response) => {
            const stream = response.data;
            stream.on('data', (chunk /* chunk is an ArrayBuffer */) => {
                //Log raw data received
                if (verbose) console.log(colors.dim.grey('connectToGameStream - board game stream recevied:' + Buffer.from(chunk)));
                //Update connection status
                gameConnectionMap.set(gameId, { connected: true, lastEvent: time.getTime() });
                //Response may contain several JSON objects on the same chunk separated by \n . This may create an empty element at the end.
                var JSONArray = Decodeuint8arr(chunk).split('\n');
                for (i = 0; i < JSONArray.length; i++) {
                    //Skip empty elements that may have happened witht the .split('\n')
                    if (JSONArray[i].length > 2) {
                        try {
                            var data = JSON.parse(JSONArray[i]);
                            //The first line is always of type gameFull.
                            if (data.type == "gameFull") {
                                if (!verbose) console.clear();
                                //Log game Summary 
                                //logGameSummary(data);
                                //Store game inmutable information on the gameInfoMap dictionary collection 
                                gameInfoMap.set(gameId, data);
                                //Store game state on the gameStateMap dictionary collection
                                gameStateMap.set(gameId, data.state);
                                //Log the state. Note that we are doing this after storing the state
                                logGameState(gameId);
                                //Show prompt
                                console.log('Enter command and press enter >');
                                //Update the ChessBoard to the ChessBoard Map
                                initializeChessBoard(gameId, data);
                                //Call chooseCurrentGame to determine if this stream will be the new current game
                                chooseCurrentGame();
                            }
                            else if (data.type == "gameState") {
                                if (!verbose) console.clear();
                                //Update the ChessBoard Map
                                updateChessBoard(gameId, gameStateMap.get(gameId), data);
                                //Update game state with most recent state
                                gameStateMap.set(gameId, data);
                                //Log the state. Note that we are doing this after storing the state
                                logGameState(gameId);
                                //Show prompt
                                console.log('Enter command and press enter >');
                            }
                            else if (data.type == "chatLine") {
                                //Received chat line
                                //TODO
                            }
                            else if (response.status >= 400) {
                                console.log(colors.yellow('connectToGameStream - ' + data.error));
                            }
                        }
                        catch (error) {
                            console.log('connectToGameStream - No valid game data or Unexpected error. '.red + Error(error).message);
                        }
                    }
                    else {
                        //Signal that some empty message arrived
                        if (verbose) process.stdout.write(":");
                    }
                }
            });
            stream.on('end', () => {
                //End Stream output.end();
                console.log('connectToGameStream - Game ' + gameId + ' Stream ended.'.yellow);
                //Update connection state
                gameConnectionMap.set(gameId, { connected: false, lastEvent: time.getTime() });
                //Now if the connection was closed but the game is not over, reconnect
                /*
                if (gameStateMap.get(gameId).status == 'started')
                {
                    connectToGameStream(gameId);
                }
                */
            });
        })
        .catch(function (error) {
            console.log(error);
            if (error.response)
                console.log(error.response.data);
        });
}

/**
 * Make a Board move
 * 
 * /api/board/game/{gameId}/move/{move}
 * 
 * Make a move in a game being played with the Board API.
 * The move can also contain a draw offer/agreement.
 * 
 * @param {string} gameId 
 * @param {string} move 
 */
function sendMove(gameId, move) {
    if (move.length > 1) {
        //Automatically decline draws when making a move
        var url = url = `${baseURL}/api/board/game/${gameId}/move/${move}?offeringDraw=false`
        //Log intention
        if (verbose) console.log(colors.dim.grey('sendMove - About to call ' + url));
        axios({
            method: "post",
            url: url,
            headers: { 'Authorization': 'Bearer ' + personalToken }
        })
            .then(function (response) {
                try {
                    if (response.status == 200 || response.status == 201) {
                        //Move sucessfully sent
                        if (verbose) console.log(colors.dim.grey('sendMove - Move sucessfully sent.'));
                    }
                    else {
                        console.error('sendMove - Failed to send move. '.red + response.data.error);
                    }

                }
                catch (error) {
                    console.error('sendMove - Unexpected error. '.red + error);
                }
            })
            .catch(function (error) {
                console.error('sendMove - Error. '.red + error.message);
            });
    }
    else {
        if (verbose) console.log(colors.dim.grey(`sendMove - Received move: "${move}" will not be sent to lichess `));
    }
}

/**
 * Display the summary of the Game excluding the state
 * 
 * @param {string} gameInfo - The alphanumeric identifier of the game to be shown
 */
function logGameSummary(gameInfo) {
    process.stdout.write("\n");
    console.table([
        { white: ((gameInfo.white.title !== null) ? gameInfo.white.title : '@'), black: ((gameInfo.black.title !== null) ? gameInfo.black.title : '@'), game: 'Id: ' + gameInfo.id },
        { white: gameInfo.white.name, black: gameInfo.black.name, game: gameInfo.variant.short + ' ' + (gameInfo.rated ? 'rated' : 'unrated') },
        { white: gameInfo.white.rating, black: gameInfo.black.rating, game: gameInfo.speed + ' ' + ((gameInfo.clock !== null) ? (String(gameInfo.clock.initial / 60000) + "'+" + String(gameInfo.clock.increment / 1000) + "''") : '∞') }]);
}

/**
 * Display the state as stored in the Dictionary collection
 *
 * @param {string} gameId - The alphanumeric identifier of the game for which state is going to be shown
 */
function logGameState(gameId) {
    if (gameStateMap.has(gameId) && gameInfoMap.has(gameId)) {
        var gameInfo = gameInfoMap.get(gameId);
        var gameState = gameStateMap.get(gameId);
        var lastMove = getLastMove(gameId);
        process.stdout.write("\n");
        console.table({
            'Title': { white: ((gameInfo.white.title !== null) ? gameInfo.white.title : '@'), black: ((gameInfo.black.title !== null) ? gameInfo.black.title : '@'), game: 'Id: ' + gameInfo.id },
            'Username': { white: gameInfo.white.name, black: gameInfo.black.name, game: 'Status: ' + gameState.status },
            'Rating': { white: gameInfo.white.rating, black: gameInfo.black.rating, game: gameInfo.variant.short + ' ' + (gameInfo.rated ? 'rated' : 'unrated') },
            'Timer': { white: formattedTimer(gameState.wtime), black: formattedTimer(gameState.btime), game: gameInfo.speed + ' ' + ((gameInfo.clock !== null) ? (String(gameInfo.clock.initial / 60000) + "'+" + String(gameInfo.clock.increment / 1000) + "''") : '∞') },
            'Last Move': { white: (lastMove.player == 'white' ? lastMove.move : '?'), black: (lastMove.player == 'black' ? lastMove.move : '?'), game: lastMove.player },
        });
        switch (gameState.status) {
            case "started":
                //Announce the last move
                if (me.id !== lastMove.by || announceAllMoves) {
                    announcePlay(lastMove, gameState.wtime, gameState.btime);
                }
                break;
            case "outoftime":
                announceWinner(gameState.winner, 'flag', gameState.winner + ' wins by timeout');
                break;
            case "resign":
                var winner = gameState.winner;
                announceWinner(gameState.winner, 'resign', gameState.winner + ' wins by resignation');
                break;
            case "mate":
                announceWinner(lastMove.player, 'mate', lastMove.player + ' wins by checkmate');
                break;
            case "draw":
                announceWinner('draw', 'draw', 'game ends in draw');
                break;
            default:
                console.log(`Unknown status received: ${gameState.status}`.red);
            // code block
        }
    }
}


/**
 * Peeks a game state and calculates who played the last move and what move it was
 * 
 * @param {string} gameId - The alphanumeric identifier of the game where the last move is going to be calculated
 */
function getLastMove(gameId) {
    if (gameStateMap.has(gameId) && gameInfoMap.has(gameId)) {
        var gameInfo = gameInfoMap.get(gameId);
        var gameState = gameStateMap.get(gameId);
        if (String(gameState.moves).length > 1) {
            moves = gameState.moves.split(' ');
            if (moves.length % 2 == 0)
                return { player: 'black', move: moves[moves.length - 1], by: gameInfo.black.id };
            else
                return { player: 'white', move: moves[moves.length - 1], by: gameInfo.white.id };
        }
        else {
            return { player: 'none', move: 'none' };
        }
    }
}

/**
 * Convert an Uint8Array into a string.
 * Useful to parse upcoming chunks of data
 *
 * @returns {String}
 */
function Decodeuint8arr(uint8array) {
    return new TextDecoder("utf-8").decode(uint8array);
}

/**
 * Wait some time without blocking other code
 *
 * @param {number} ms - The number of milliseconds to sleep
 */
function sleep(ms = 0) {
    return new Promise(r => setTimeout(r, ms));
}

/**
 * Return a string representation of the remaining time on the clock
 * 
 * @param {number} timer - Numeric representation of remaining time
 * 
 * @returns {String} - String representation of numeric time
 */
function formattedTimer(timer) {
    // Pad function to pad with 0 to 2 or 3 digits, default is 2
    var pad = (n, z = 2) => ('00' + n).slice(-z);
    return pad(timer / 3.6e6 | 0) + ':' + pad((timer % 3.6e6) / 6e4 | 0) + ':' + pad((timer % 6e4) / 1000 | 0) //+ '.' + pad(timer % 1000, 3);
}


/**
 * mainLoop() is a function that tries to keep the streams connected at all times, up to a maximum of 20 retries
 */
async function mainLoop() {
    //Program ends after 20 re-connection attempts
    for (let attempts = 0; attempts < 20; attempts++) {
        //Connect to main event stream
        connectToEventStream(personalToken);
        //On the first time, if there are no games, it may take several seconds to receive data so lets wait a bit. Also give some time to connect to started games
        await sleep(5000);
        //Now enter a loop to monitor the connection
        do {
            //sleep 5 seconds and just listen to events
            await sleep(5000);
            //Check if any started games are disconnected
            for (let [gameId, networkState] of gameConnectionMap) {
                if (!networkState.connected && gameStateMap.get(gameId).status == "started") {
                    //Game is not conencted and has not finished, reconnect
                    if (verbose) console.log(colors.dim.grey(`Started game is disconnected. Attempting reconnection for gameId: ${gameId}`));
                    connectToGameStream(gameId);
                }
            }
        }
        while (eventSteamStatus.connected)
        //This means event stream is not connected
        console.warn("No conenction to event stream. Attempting re-connection. Attempt: " + attempts);
    }
    console.error("No conenction to event stream after maximum number of attempts (" + attempts + "). Exiting application");
}

/**
 * Iterate the gameConnectionMap dictionary and return an arrays containing only the games that can be played with the board
 * @returns {Array} - Array containing a summary of playable games
 */
function playableGamesArray() {
    var playableGames = [];
    var keys = Array.from(gameConnectionMap.keys());
    //The for each iterator is not used since we don't want to continue execution. We want a syncrhonous result
    //for (let [gameId, networkState] of gameConnectionMap) {
    //    if (gameConnectionMap.get(gameId).connected && gameStateMap.get(gameId).status == "started") {    
    for (var i = 0; i < keys.length; i++) {
        if (gameConnectionMap.get(keys[i]).connected && gameStateMap.get(keys[i]).status == "started") {
            //Game is good for commands
            var gameInfo = gameInfoMap.get(keys[i]);
            var gameState = gameStateMap.get(keys[i]);
            var lastMove = getLastMove(keys[i]);
            var versus = (gameInfo.black.id == me.id) ? ((gameInfo.white.title !== null) ? gameInfo.white.title : '@') + ' ' + gameInfo.white.name : ((gameInfo.black.title !== null) ? gameInfo.black.title : '@') + ' ' + gameInfo.black.name;
            //Since console width may vary, here are 3 versions of the Game Info Summary presented to the user <=100    <=130    >130
            if (process.stdout.columns <= 110) {
                playableGames.push({
                    'gameId': gameInfo.id,
                    'versus': versus,
                    'variant': gameInfo.variant.short,
                    'Timer': gameInfo.speed,
                    'Last Move': lastMove.player + ' ' + lastMove.move
                })
            }
            else if (process.stdout.columns <= 130) {
                playableGames.push({
                    'gameId': gameInfo.id,
                    'versus': versus,
                    'game rating': gameInfo.variant.short + ' ' + (gameInfo.rated ? 'rated' : 'unrated'),
                    'Timer': gameInfo.speed,
                    'Last Move': lastMove.player + ' ' + lastMove.move + ' by ' + lastMove.by
                })
            }
            else {
                playableGames.push({
                    'gameId': gameInfo.id,
                    'versus': versus,
                    'vs rating': (gameInfo.black.id == me.id) ? gameInfo.white.rating : gameInfo.black.rating,
                    'game rating': gameInfo.variant.short + ' ' + (gameInfo.rated ? 'rated' : 'unrated'),
                    'Timer': gameInfo.speed + ' ' + ((gameInfo.clock !== null) ? (String(gameInfo.clock.initial / 60000) + "'+" + String(gameInfo.clock.increment / 1000) + "''") : '∞'),
                    'Last Move': lastMove.player + ' ' + lastMove.move + ' by ' + lastMove.by
                })
            }
        }
    }
    return playableGames;
}

function readLineAsync(prompt) {
    return new Promise((resolve, reject) => {
        readline.question(prompt, (answer) => {
            resolve(answer);
        });
    });
}

async function keyboardInputHandler() {
    do {
        //Register event for text input from console and wait for input without blocking execution
        var command = await readLineAsync("Enter command and press enter >");
        if (verbose) console.log(colors.dim.grey(`keyboardInputHandler - Keyboard input: ${command}`));
        //Find and active game, don't keep trying to find one since keyboard commands can be sent again . Also the command may be a quit
        if (!(gameStateMap.has(currentGameId) && gameConnectionMap.get(currentGameId).connected && gameStateMap.get(currentGameId).status == "started")) {
            await chooseCurrentGame();
        }
        //Now send the move as written, no validation
        sendMove(currentGameId, command);
    } while (String(command).toLowerCase() != 'end' && String(command).toLowerCase() != 'exit' && String(command).toLowerCase() != 'quit')
    readline.close();
    if (verbose) console.log(colors.dim.grey('Exiting...'));
    process.exit(0); //Success
}

function announcePlay(lastMove, wtime, btime) {
    if (lastMove.player == 'white') {
        console.log(colors.bgWhite.black(
            figlet.textSync('  ' + lastMove.move + '  ', { font: 'univers', horizontalLayout: 'full' })
        ));
        console.log(colors.bgWhite.black('                             W H I T E                             '));
    }
    else {
        console.log(colors.bgGray.brightWhite(
            figlet.textSync('  ' + lastMove.move + '  ', { font: 'univers', horizontalLayout: 'full' })
        ));
        console.log(colors.bgGray.brightWhite('                             B L A C K                             '));
    }
    //tts.say(lastMove.player);
    //Now play it using text to speech library
    tts.say(lastMove.move);
}

function announceWinner(winner, status, message) {
    if (winner == 'white') {
        console.log(colors.bgWhite.black(
            figlet.textSync('  ' + status + '  ', { font: 'univers', horizontalLayout: 'full' })
        ));
        console.log(colors.bgWhite.black('                             W H I T E    W I N S                         '));
    }
    else if (winner == 'black') {
        console.log(colors.bgGray.brightWhite(
            figlet.textSync('  ' + status + '  ', { font: 'univers', horizontalLayout: 'full' })
        ));
        console.log(colors.bgGray.brightWhite('                             B L A C K    W I N S                         '));
    }
    else {
        console.log(
            figlet.textSync('  ' + status + '  ', { font: 'univers', horizontalLayout: 'full' })
        );
        console.log('                             * * * * *                             ');
    }
    //Now play message using text to speech library
    tts.say(message);
}

function announceInvalidMove() {
    if (currentGameColor == 'white') {
        console.log(colors.bgWhite.black(
            figlet.textSync('  [ X X ]  ', { font: 'univers', horizontalLayout: 'full' })
        ));
        console.log(colors.bgWhite.black('                             W H I T E                             '));
    }
    else {
        console.log(colors.bgGray.brightWhite(
            figlet.textSync('  [ X X ]  ', { font: 'univers', horizontalLayout: 'full' })
        ));
        console.log(colors.bgGray.brightWhite('                             B L A C K                             '));
    }
    //Now play it using text to speech library
    tts.say('Illegal Move');
}

function start() {
    console.clear();
    console.log("      ,....,            ".blue.bold + "          ▄████▄   ██░ ██ ▓█████   ██████   ██████     ".red);
    console.log("     ,::::::<           ".blue.bold + "         ▒██▀ ▀█  ▓██░ ██▒▓█   ▀ ▒██    ▒ ▒██    ▒     ".red);
    console.log("    ,::/^\\\"``.        ".blue.bold + "           ▒▓█    ▄ ▒██▀▀██░▒███   ░ ▓██▄   ░ ▓██▄       ".red);
    console.log("   ,::/, `   e`.        ".blue.bold + "         ▒▓▓▄ ▄██▒░▓█ ░██ ▒▓█  ▄   ▒   ██▒  ▒   ██▒    ".red);
    console.log("  ,::; |        '.      ".blue.bold + "         ▒ ▓███▀ ░░▓█▒░██▓░▒████▒▒██████▒▒▒██████▒▒    ".red);
    console.log("  ,::|  \___,-.  c)     ".blue.bold + "          ░ ░▒ ▒  ░ ▒ ░░▒░▒░░ ▒░ ░▒ ▒▓▒ ▒ ░▒ ▒▓▒ ▒ ░    ".red);
    console.log("  ;::|     \\   '-'     ".blue.bold + "          ░  ▒    ▒ ░▒░ ░ ░ ░  ░░ ░▒  ░ ░░ ░▒  ░ ░      ".red);
    console.log("  ;::|      \\          ".blue.bold + "          ░         ░  ░░ ░   ░   ░  ░  ░  ░  ░  ░      ".red);
    console.log("  ;::|   _.=`\\         ".blue.bold + "          ░ ░       ░  ░  ░   ░  ░      ░        ░      ".red);
    console.log("  `;:|.=` _.=`\\        ".blue.bold + "          ░                                             ".red);
    console.log("    '|_.=`   __\\       ".blue.bold + "                                                        ".red);
    console.log("    `\\_..==`` /        ".blue.bold + "         Lichess.org - DGT Electronic Board Connector   ".yellow.bold);
    console.log("     .'.___.-'.         ".blue.bold + "       Developed by Andres Cavallin and Juan Cavallin  ".yellow.bold);
    console.log("    /          \\       ".blue.bold + "                                                        ".red);
    console.log("jgs('--......--')       ".blue.bold + "                                                      ".red);
    console.log("   /'--......--'\\      ".blue.bold + "                                                        ".red);
    console.log("   `\"--......--\"`     ".blue.bold + "                                                        ".red);
}

/* New Code to Connect to Board */

/**
 * This function will update the currentGameId with a valid active game
 * and then will attach this game to the DGT Board
 * It requires that all maps are up to date: gameInfoMap, gameStateMap, gameConnectionMap and gameChessBoardMap
 */
async function chooseCurrentGame() {
    //Determine new value for currentGameId. First create an array with only the started games
    //So then there is none or more than one started game
    var playableGames = playableGamesArray();
    //If there is only one started game, then its easy
    if (playableGames.length == 1) {
        currentGameId = playableGames[0].gameId;
        attachCurrentGameIdToDGTBoard(); //Let the board know which color the player is actually playing and setup the position
        console.log('Active game updated. currentGameId: ' + currentGameId);
    }
    else if (playableGames.length == 0) {
        console.log('No started playable games, challenges or games are disconnected. Please start a new game or fix connection.');
        //TODO What happens if the games reconnect and this move is not sent?
    }
    else {
        console.table(playableGames);
        var index = await readLineAsync(`Please enter the index number of the game you want to play with the Board. [0..${playableGames.length - 1}] >\n`);
        if (verbose) console.log(colors.dim.grey(`validateAndSendBoardMove - Game Index: ${index}`));
        if (!isNaN(index) && index.length > 0 && Number(index) >= 0 && Number(index) < playableGames.length) {
            currentGameId = playableGames[Number(index)].gameId;
            //Command looks good for currentGameId 
            attachCurrentGameIdToDGTBoard(); //Let the board know which color the player is actually playing and setup the position
            console.log('Active game updated. currentGameId: ' + currentGameId);
        }
        else {
            console.log('Invalid Index Number. Will not connect to any game at this time.');
            //Retries may be required or not, so retries should be handled on calling function and not here.
        }
    }
}


/**
 * Initialize a ChessBoard when connecting or re-connecting to a game
 * 
 * @param {string} gameId - The gameId of the game to store on the board
 * @param {Object} data - The gameFull event from lichess.org
 */
function initializeChessBoard(gameId, data) {
    try {
        var chess = new Chess();
        if (data.initialFen != "startpos")
            chess.load(data.initialFen);
        var moves = [];
        var moves = data.state.moves.split(' ');
        for (i = 0; i < moves.length; i++) {
            if (moves[i] != '') {
                //Make any move that may have been already played on the ChessBoard. Useful when reconnecting
                chess.move(moves[i], { sloppy: true });
            }
        }
        //Store the ChessBoard on the ChessBoardMap
        gameChessBoardMap.set(gameId, chess);
        if (verbose) console.log(colors.dim.grey(`initializeChessBoard - New Board for gameId: ${gameId}`));
        if (verbose) console.log(colors.dim.grey(chess.ascii()));
    }
    catch (error) {
        console.error(`initializeChessBoard - Error: ${error.message}`.red);
    }
}

/**
 * Update the ChessBoard for the specified gameId with the new moves on newState since the last stored state
 * 
 * @param {string} gameId - The gameId of the game to store on the board
 * @param {Object} currentState - The state stored on the gameStateMap
 * @param {Object} newState - The new state not yet stored
 */
function updateChessBoard(gameId, currentState, newState) {
    try {
        var chess = gameChessBoardMap.get(gameId);
        var pendingMoves
        if (!currentState.moves) {
            //No prior moves. Use the new moves
            pendingMoves = newState.moves;
        }
        else {
            //Get all the moves on the newState that are not present on the currentState
            pendingMoves = newState.moves.substring(currentState.moves.length, newState.moves.length);
        }
        var moves = [];
        var moves = pendingMoves.split(' ');
        for (i = 0; i < moves.length; i++) {
            if (moves[i].length > 1) {
                //Make the new move
                chess.move(moves[i], { sloppy: true });
            }
        }
        //Store the ChessBoard on the ChessBoardMap
        //gameChessBoardMap.set(gameId, chess);
        if (verbose) console.log(colors.dim.grey(`updateChessBoard - Updated Board for gameId: ${gameId}`));
        if (verbose) console.log(colors.dim.grey(chess.ascii()));
    }
    catch (error) {
        console.error(`updateChessBoard - Error: ${error.message}`.red);
    }
}

/**
 * Utility function to update which color is being played with the board
 */
function attachCurrentGameIdToDGTBoard() {
    if (me.id == gameInfoMap.get(currentGameId).white.id)
        currentGameColor = 'white';
    else
        currentGameColor = 'black';
    //Update the board witht the color
    //TODO 

    //TODO Send to setUp a reference to gameChessBoardMap and the currentGameId instead of the object since it may change
    //So the values can be asigned inside the setup function.


    //Setup DGT Board
    dgtBoard.currentGameColor = currentGameColor.substring(0, 1);
    dgtBoard.board_lichess = gameChessBoardMap.get(currentGameId);
    dgtBoard.setUp(gameChessBoardMap.get(currentGameId));
}

function lichessFormattedMove(boardMove) {
    try {
        if ((dgtBoard.currentGameColor == 'w' && boardMove.color == 'w') ||
            (dgtBoard.currentGameColor == 'b' && boardMove.color == 'b')) {
            return boardMove.from + boardMove.to;
        }
        else {
            //TODO: Veify if opponent's piece is adjusted properly COMPLETED. Verification process is in boardManager

            console.error('lichessFormattedMove - Error. Received move is for the wrong color. Expected color is '.red + currentGameColor);
            return '';
        }
    }
    catch (error) {
        console.error(`lichessFormattedMove - Error: ${error.message}`.red);
        return '';
    }
}

/**
 * Listen to events coming from DGT Board
 * Possible events are connect, disconnect and move
 * 
 * This function is used if the way the boards is sending the events and moves
 * is through event emmiters . Event won't lock the application
 */
function connectToBoardEvents() {
    dgtBoard.on('move', async (move) => {
        // Outputs : Received validated move
        if (verbose) console.log(colors.dim.grey(`connectToBoardEvents - Received move event from Board: ${JSON.stringify(move)}`));
        await validateAndSendBoardMove(move);
    });

    dgtBoard.on('invalidMove', async () => {
        // Outputs : Received an invalid move. Notify user.
        if (verbose) console.log(colors.dim.grey(`connectToBoardEvents - Received invalidMove event from Board`));
        // Notify about invalid move.
        announceInvalidMove();
    });

    dgtBoard.on('adjust', async () => {
        // Todo: Send a message to make sure the right adjustment was made
        if (verbose) console.log(colors.dim.grey(`connectToBoardEvents - Received adjust event from Board`));
    })

    dgtBoard.on('invalidAdjust', async (move) => {
        // Todo: Send a message showing the wrong adjustment made
        if (verbose) console.log(colors.dim.grey(`connectToBoardEvents - Received invalidAdjust event from Board: ${JSON.stringify(move)}`));
        //Inform user
        tts.say('Incorrect, move was');
        await sleep(1000);
        //Repeat last game state announcement
        var gameState = gameStateMap.get(currentGameId);
        var lastMove = getLastMove(currentGameId);
        announcePlay(lastMove, gameState.wtime, gameState.btime);
    })
}

/**
 * This function is used if the board implementation uses the approach of
 * waiting for move to be maid on the board.
 * This is similar to awaiting input from a keyboard readling
 * The function is async to prevent locking;
 */
async function boardInputHandler() {
    var command = '';
    do {
        //Register event for text input from console and wait for input without blocking execution
        var boardMove = await dgtBoard.nextMove(getLastMove(currentGameId));
        if (verbose) console.log(colors.dim.grey(`boardInputHandler - Board move: ${boardMove}`));
        await validateAndSendBoardMove(boardMove);
    } while (true) //TODO Put a proper ending condition like game_over()

    if (verbose) console.log(colors.dim.grey('Game Over Exiting...'));
    process.exit(0); //Success
}

/**
 * This functions hanldes the sending the move to the right lichess game. 
 * If more than one game is being played, it will ask which game to connect to,
 * thus waiting for user input and so, it becomes async
 * 
 * @param {Object} boardMove - The move in chess.js format or string if in lichess format
 */
async function validateAndSendBoardMove(boardMove) {
    //While there is not and active game, keep trying to find one so the move is not lost
    while (!(gameStateMap.has(currentGameId) && gameConnectionMap.get(currentGameId).connected && gameStateMap.get(currentGameId).status == "started")) {
        //Wait a few seconds to see if the games reconnects or starts and give some space to other code to run
        await sleep(2000);
        //Now attempt to select for which game is this command intented
        await chooseCurrentGame();
    }
    //Now send the move
    command = lichessFormattedMove(boardMove); //The command needs to be verified so it runs after the color is set
    sendMove(currentGameId, command);
}




/**
 * Show the profile and then
 * Start the Main Loop
 */
start();
getProfile();
mainLoop();
keyboardInputHandler();
const dgtBoard = new BoardManager(); //Store the board manager object
connectToBoardEvents();  //Connect to events, some events may not be moves like connect or disconnect
//boardInputHandler(); //start monitoring moves one at a time
//dgtBoard.playRandom(); //Emulates a board by playing randomly
