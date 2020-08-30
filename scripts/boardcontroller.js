import { Chess } from '../node_modules/chess.js'; /* An open source chessboard management from https://github.com/jhlywa/chess.js/ */

/**
 * Utilitary function to retrieve and store values from browser storage and manage default values
 * 
 * @param {string} key The key for the configuration value
 * @param {string} defaultValue The default configuration value if not found in browser storage. Blank if not provided.
 * 
 * @returns {string} The configuration value for the provided key stored on the browser, of the default if not found
 */
function getConfig(key, defaultValue = "") {
    var tempConfigValue;
    if (localStorage.getItem(key) === null) {
        var tempConfigValue = localStorage.getItem(key);
    }
    else {
        var tempConfigValue = defaultValue;
    }
    return tempConfigValue;
}

/**
 * CONFIGURATION VALUES
 */
var personalToken = getConfig('personalToken', 'DarxErZAypxvzLri'); //to communicate with Lichess.org
var verbose = Boolean(getConfig('verbose'), 'false');; //Verbose on or off
var announceAllMoves = Boolean(getConfig('announceAllMoves'), 'false');;; //Announce moves for both players or only the opponents
var announceMoveFormat = getConfig('announceMoveFormat', 'san');
var defaultKeywords = JSON.stringify({
    "keywords": {
        "K": "King",
        "Q": "Queen",
        "R": "Rook",
        "B": "Bishop",
        "N": "Knight",
        "P": "Pawn",
        "x": "Takes",
        "+": "Check",
        "#": "Checkmate",
        "(=)": "Game ends in draw",
        "O-O": "Castles kingside",
        "O-O-O": "Castles queenside",
        "white": "White",
        "black": "Black",
        "wins by": "wins by",
        "timeout": "timeout",
        "resignation": "resignation",
        "illegal": "illegal",
        "move": "move"
    }
})
var keywords = JSON.parse(getConfig('keywords', defaultKeywords));
var keywordsBase = ["K", "Q", "R", "B", "N", "P", "x", "+", "#", "(=)", "O-O", "O-O-O", "white", "black", "wins by", "timeout", "resignation"]

/**
 * GLOBAL VATIABLES For Lichess Interaction
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
const dgtBoard = new BoardManager(); //Store the board manager object
var chatArray = [{
    "type": "chatLine",
    "username": "andrescavallin",
    "text": "Please be nice in the chat!",
    "room": "spectator"
}]


/**
 * Global Variables for DGT Board Connection (JACM)
 */
var boards = []; //An array to store all the board recognized by DGT LiveChess 
//subscription stores the information about the board being connected, most importantly the serialnr
var subscription = { "id": 2, "call": "subscribe", "param": { "feed": "eboardevent", "id": 1, "param": { "serialnr": "" } } };
const letterNotation = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']; //Array to easily get the letter for a square

var moveObject;
var SANMove;
var localBoard = new Chess()
var connection; // = new WebSocket(liveChessURL)

