/**
 * REQUIRED MODULES
 */
const { Chess } = require('chess.js');
//const board_lichess = new Chess(); //This board contains the position shown on Lichess.org
const EventEmitter = require('events'); //This is to send events to subscribed applications like move and connect
const colors = require('colors'); //This is to do colors on the console
const WebSocket = require('ws'); //Websockets to communicate with LiveChes from DGT


/**
 * CONFIGURATION VALUES
 */
var nconf = require('nconf');
nconf.argv()
    .env()
    .file({ file: './config.json' });
nconf.defaults({
    "verbose": false,
    "liveChessURL": "ws://localhost:1982/api/v1.0"
});
var verbose = Boolean(nconf.get('verbose'));; //Verbose on or off
const liveChessURL = nconf.get('liveChessURL');


/**
 * Global Variables for DGT Board Connection (JACM)
 */
var boards = []; //An array to store all the board recognized by DGT LiveChess 
//subscription stores the information about the board being connected, most importantly the serialnr
var subscription = { "id": 2, "call": "subscribe", "param": { "feed": "eboardevent", "id": 1, "param": { "serialnr": "" } } };
const letterNotation = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']; //Array to easy get the letter for a square
const lastPosition = new Chess() // A Chess.js object to store the last position received from DGT LiveChess
const boardPosition = new Chess() // A Chess.js object to store the current position on the DGT LiveChes

var moveObject;
var SANMove; 
const connection = new WebSocket(liveChessURL)
//Starting position FEN 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
//var startFEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'
//var boardFEN = 'rnbqkbnr/pppp1ppp/8/4p3/8/8/PPPPPPPP/RNBQKBNR'
//var turn = 'white';
//var playerColor = 'white'; currentGameColor
var hasMadeInvalidAdjustment
class BoardManager extends EventEmitter {
    constructor() {
        super();

        

        connection.onopen = () => {
            if (verbose) console.log(colors.dim.magenta("Websocket onopen: Connection to LiveChess was sucessful"))
            connection.send('{"id":1,"call":"eboards"}');
        }

        connection.onerror = error => {
            console.log(colors.dim.red("Websocket ERROR: " + error.message));
        }

        connection.onmessage = e => {
            if (verbose) console.log(colors.dim.magenta('Websocket onmessage with data:' + e.data));
            var message = JSON.parse(e.data);
            if (message.response == 'call' && message.id == '1') {
                //Get the list of availble boards on LiveChess
                boards = message.param;
                console.table(boards)
                console.log(boards[0].serialnr)
                //TODO we need to be able to handle more than one board
                //Update the base subscription message with the serial number
                var serial = boards[0].serialnr;
                subscription.param.param.serialnr = serial;
                if (verbose) console.log(colors.dim.magenta('Websocket onmessage[call]: board serial number updated to: ' + serial));
                if (verbose) console.log(colors.dim.magenta('Webscoket - about to send the following message \n' + JSON.stringify(subscription)));
                connection.send(JSON.stringify(subscription))
                //Check if the board is properly connected
                if (boards[0].state != "ACTIVE") // "NOTRESPONDING"
                    console.error(`Board with serial ${serial} is not properly connected. Please fix`);
                //Send setup with stating position
                //const newChess = new Chess()
                //this.setUp(newChess);
            }
            else if (message.response == 'feed' && !(!message.param.san)) {
                try {
                    var dgtChess = new Chess(this.board_lichess.fen())
                    if (verbose) console.log(colors.dim.magenta('onmessage - san: ' + message.param.san))
                    SANMove = message.param.san[message.param.san.length-1]
                    moveObject = dgtChess.move(SANMove)
                    this.emit('move', moveObject)
                }
                catch (err) {
                    console.error(err.message)
                    if(moveObject.color == this.currentGameColor)
                        this.emit('invalidMove', err)
                    else if(this.board_lichess.history()[this.board_lichess.history().length - 1] == SANMove) { //If this doesn't work, store moves from Lichess to compare
                        if(hasMadeInvalidAdjustment) {
                            this.setUp(this.board_lichess)
                            hasMadeInvalidAdjustment = false;
                        }
                        this.emit('adjust')
                     }
                    else if(!hasMadeInvalidAdjustment) {
                        hasMadeInvalidAdjustment = true;
                        this.emit('invalidAdjust', moveObject)
                    }


                }


            }
        }
    }

    currentGameColor = ''; //Public instance field to store the color being played with the board
    board_lichess = new Chess(); //Public reference to the lichess board representation

    async setUp(chess) {
        var fen = await chess.fen()
        var setupMessage = {
            "id":3,
            "call":"call",
            "param":{
                "id":1,
                "method":"setup",
                "param":{
                    "fen": fen
                }
            }}
        if (verbose) console.log(colors.dim.magenta("setUp -: " + JSON.stringify(setupMessage)))
        connection.send(JSON.stringify(setupMessage))
    }

    async boardMove(start, current) {
        var piece;
        var color;
        var originalSquare = ''
        var moveSquare = '';
        var captures = '';
        var captured = '';

        current.move('a6') //TODO Remove this line
        //Get the 2D Array from each chess.js object
        var startBoard = start.board(); var currentBoard = current.board();

        //Iterate the 8x8 2D Arrays of startBoard and currentBoard
        for (var i = 0; i < 8; i++) {
            for (var j = 0; j < 8; j++) {
                //Check if the square on startBoard is different to square on currentBoard
                if (JSON.stringify(startBoard[i][j]) != JSON.stringify(currentBoard[i][j])) {
                    //If they are different, check if the current board has that square as empty
                    if (JSON.stringify(currentBoard[i][j]) == "null") {
                        //If this square is now empty is because this is the origin (from) square
                        piece = startBoard[i][j].type;
                        color = startBoard[i][j].color;
                        originalSquare = `${letterNotation[j] + (i + 1)}`;
                        if (verbose) console.log(colors.dim.magenta("boardMove - Calcuated origin square: " + originalSquare));
                    }
                    else {
                        //If the square is not empty on the current board is because this is the end (to) square
                        moveSquare = `${letterNotation[j] + (i + 1)}`;
                        if (verbose) console.log(colors.dim.magenta("boardMove - Found end square: " + moveSquare))
                        //end square

                        //Check if it was a capture
                        // TODO: doesnt not work for en pasante
                        if (JSON.stringify(startBoard[i][j]) != "null" && startBoard[i][j].color != currentBoard[i][j].color) {
                            captures = 'x';
                            captured = startBoard[i][j].type;
                        }
                    }
                    //Check if we already found the move, then no need to continue iterating
                    if (originalSquare != '' && moveSquare != '') { break; }
                }
            }
        }
        //Check if both originalSquare (from) and moveSquare (To) were found
        if (originalSquare != '' && moveSquare != '') {
            //Create a move object similar to the chess.js move object but with a move property with the lichess move format
            var verboseMove = { move: `${originalSquare + moveSquare}`, color: color, piece: piece, from: originalSquare, to: moveSquare }
            //Calculate an add the san property
            SANMove = `${piece + captures + moveSquare}`;
            verboseMove.san = SANMove;
            //Add the captured piece if available
            if (captures == 'x') verboseMove.captured = captured;
            if (verbose) console.log(colors.dim.magenta(`boardMove - Lichess: ${originalSquare + moveSquare} SAN: ${piece + captures + moveSquare}`));
            if (verbose) console.log(colors.dim.magenta(JSON.stringify(verboseMove)));
            return verboseMove;
        }
        else {
            //No move was found
            if (verbose) console.log(colors.dim.magenta("boardMove - No move found."));
            return null;
        }
    }

    /**
     * Wait some time without blocking other code
     *
     * @param {number} ms - The number of milliseconds to sleep
     */
    sleep(ms = 0) {
        return new Promise(r => setTimeout(r, ms));
    }

    async playRandom() {
        var move;
        var moves = [];
        while (!this.board_lichess.game_over()) {
            if (!this.currentGameColor) {
                //Don't have a color yet, attempt playing as white
                //First move, go for e4
                move = { "color": "w", "from": "e2", "to": "e4", "flags": "b", "piece": "p", "san": "e4" };
            }
            else {
                //Wait for my turn
                while (this.currentGameColor != this.board_lichess.turn())
                    await this.sleep(1000);
                //Get the list of possible moves. Use verbose to get the from and to values
                moves = this.board_lichess.moves({ verbose: true });
                //Get a random valid move
                move = moves[Math.floor(Math.random() * moves.length)];

            }
            //resolve the export promise
            this.emit('move', move);
            await this.sleep(5000);
        }
        if (verbose) console.log(colors.dim.blue(`playRandom - Game is Over.`));
    }

    /**
     * @typedef {Object} move
     * @property {string} color - color of the piece being moved
     * @property {string} from - square where the piece was before the move
     * @property {string} to - sqare where the piece is moved to
     * @property {string} flags - if there is a flag event
     * @property {string} piece - type of piece moved
     * @property {string} san - move in Standard Notation
     * @property {string} captured - key is included when the move is a capture
     * @property {string} promotion - key is included when the move is a promotion
     */

    /**
     * 
     * @param {Object} lastMove - The lastMove object as received from lichess
     * @param {string} lastMove.player - The color of the player who played it. Used only for validations
     * @param {string} lastMove.move - The move in lichess format which from concatenated with to
     * @param {string} lastMove.by - The name of the player. This is not used
     * 
     * @returns {move} - The mov in chess.js format
     */
    async nextMove(lastMove) {
        var move;
        var moves = [];
        try {
            if (!(!lastMove) && lastMove.player != 'none') {
                // lastMove is a valid variable
                //Sample last move: { player: 'white', move: moves[moves.length - 1], by: gameInfo.white.id }
                //board_lichess.move(lastMove.move, { sloppy: true })
                //Get the list of possible moves. Use verbose to get the from and to values
                moves = this.board_lichess.moves({ verbose: true });
                //Get a random valid move
                move = moves[Math.floor(Math.random() * moves.length)];
            }
            else {
                //First move, go for e4
                move = { "color": "w", "from": "e2", "to": "e4", "flags": "b", "piece": "p", "san": "e4" };
            }
        }
        catch (error) {
            console.error(`nextMove - Error: ${error.message}`.red);
        }
        await this.sleep(5000);
        //resolve the export promise
        return move;
    }

    /**
     * Check if the board thinks its game over.
     */
    game_over() {
        return board_lichess.game_over();
    }

}

module.exports = BoardManager






